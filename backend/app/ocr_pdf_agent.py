import os
import fitz  # PyMuPDF
import pytesseract
from PIL import Image, ImageStat
import io
import json
import gc
import numpy as np

def get_word_metrics(img, box_300dpi):
    """
    Analyzes a word crop to detect font properties.
    Returns {fontWeight, fontStyle, color, backgroundColor}
    """
    try:
        crop = img.crop((
            box_300dpi['left'] + 2, 
            box_300dpi['top'] + 2, 
            box_300dpi['left'] + box_300dpi['width'] - 2,
            box_300dpi['top'] + box_300dpi['height'] - 2
        ))
        
        # 1. Colors (S.C.O.T Color Logic)
        colors = crop.getcolors(maxcolors=10000)
        if not colors:
            return "normal", "sans-serif", (0,0,0), (1,1,1), 1.0
            
        colors.sort(key=lambda x: x[0], reverse=True)
        bg_rgb = colors[0][1]
        
        fg_rgb = (0, 0, 0)
        contrast_colors = []
        for count, rgb in colors[1:]:
            diff = sum([abs(rgb[j] - bg_rgb[j]) for j in range(3)])
            if diff > 100:
                contrast_colors.append((count, rgb))
                
        if contrast_colors:
            # Sort by absolute geometric darkness to avoid blurry edge bleed greys
            contrast_colors.sort(key=lambda item: sum(item[1]))
            fg_rgb = contrast_colors[0][1]
            
        # 2. Boldness detection
        grayscale = crop.convert("L")
        std_dev = ImageStat.Stat(grayscale).stddev[0]
        weight = "bold" if std_dev > 38 else "normal"
        
        # 3. B (Blurriness) Detection - S.C.O.T Stage 5
        # We use a Laplcian-like variance detection to see how 'soft' the original edges are
        pixels = np.array(grayscale).astype(float)
        # Simple finite difference approximation of Laplacian variance
        laplacian = pixels[:-2, 1:-1] + pixels[2:, 1:-1] + pixels[1:-1, :-2] + pixels[1:-1, 2:] - 4*pixels[1:-1, 1:-1]
        blur_val = laplacian.var()
        # Clean up numpy array immediately
        del pixels
        del laplacian
        
        # Scale: 0 (extremely blurry) to 1.0 (digital sharp)
        # Scanned text usually falls between 50 and 500. Digital is > 1000.
        sharpness = min(1.0, max(0.1, blur_val / 800.0))
        
        style = "sans-serif"
        
        norm_bg = tuple(c / 255.0 for c in bg_rgb[:3])
        norm_fg = tuple(c / 255.0 for c in fg_rgb[:3])
        
        # Close the crop
        crop.close()
        
        return weight, style, norm_fg, norm_bg, sharpness
    except Exception as e:
        print(f"Metrics Error: {e}")
        return "normal", "sans-serif", (0,0,0), (1,1,1), 1.0

def process_ocr_pdf(file_path: str) -> dict:
    """
    Extracts text, bounding boxes, and font properties.
    Groups words into lines and blocks.
    """
    results = {"pages": []}
    doc = fitz.open(file_path)
    
    for page_num in range(len(doc)):
        page = doc[page_num]
        
        # MEMORY OPTIMIZATION: Adaptive DPI (144 instead of 300)
        # Reduces pixel count by ~4x, keeping RAM under Render limits
        zoom = 2.0 
        mat = fitz.Matrix(zoom, zoom)
        pix = page.get_pixmap(matrix=mat)
        
        # Process image
        raw_bytes = pix.tobytes("png")
        img = Image.open(io.BytesIO(raw_bytes)).convert("RGB")
        
        # Clear large pixmap immediately
        del pix
        
        # Run Tesseract with detailed data
        custom_config = r'-l eng+hin --psm 3'
        data = pytesseract.image_to_data(img, config=custom_config, output_type=pytesseract.Output.DICT)
        
        words = []
        for i in range(len(data['text'])):
            text = data['text'][i].strip()
            conf = int(data['conf'][i])
            
            if text and conf > -1:
                # Metrics
                weight, style, fg, bg, sharpness = get_word_metrics(img, {
                    'left': data['left'][i], 
                    'top': data['top'][i], 
                    'width': data['width'][i], 
                    'height': data['height'][i]
                })
                
                words.append({
                    "text": text,
                    "x": data['left'][i] / zoom,
                    "y": data['top'][i] / zoom,
                    "width": data['width'][i] / zoom,
                    "height": data['height'][i] / zoom,
                    "confidence": conf,
                    "lineId": f"{data['block_num'][i]}_{data['par_num'][i]}_{data['line_num'][i]}",
                    "blockId": f"{data['block_num'][i]}",
                    "color": fg,
                    "backgroundColor": bg,
                    "fontWeight": weight,
                    "fontStyle": style,
                    "sharpness": sharpness
                })
        import math
        from collections import defaultdict
        
        # Calculate mathematically precise Orientation Vectors (Angles) per line
        lines_dict = defaultdict(list)
        for w in words:
            lines_dict[w['lineId']].append(w)
            
        for lid, lwords in lines_dict.items():
            if len(lwords) > 1:
                lwords = sorted(lwords, key=lambda x: x["x"])
                first_w, last_w = lwords[0], lwords[-1]
                # Measure slope between the center points of the first and last word bounding boxes
                dx = (last_w["x"] + last_w["width"]/2) - (first_w["x"] + first_w["width"]/2)
                dy = (last_w["y"] + last_w["height"]/2) - (first_w["y"] + first_w["height"]/2)
                
                # Math angle in degrees
                angle = math.degrees(math.atan2(dy, dx))
                # Hardware scanners rarely skew > 30 degrees unless it's an art piece
                if abs(angle) > 30:
                    angle = 0.0
            else:
                angle = 0.0
                
            for w in lwords:
                w["angle"] = angle

        # MEMORY CLEANUP
        img.close()
        del img
        gc.collect()

        results["pages"].append({
            "page_number": page_num + 1,
            "width": page.rect.width,
            "height": page.rect.height,
            "words": words
        })
        
    doc.close()
    return results

def extract_edited_pdf(original_pdf_path: str, edits: list, full_ocr_data: dict = None) -> str:
    """
    Applies user text modifications over the original scanned PDF.
    Inserts a hidden text layer to make the entire PDF copiable.
    """
    out_path = original_pdf_path + "_true_edit.pdf"
    doc = fitz.open(original_pdf_path)
    
    for page_num in range(len(doc)):
        page = doc[page_num]
        
        # 1. Add Invisible Text Layer for Searchability (if OCR data provided)
        if full_ocr_data and "pages" in full_ocr_data:
            page_data = next((p for p in full_ocr_data["pages"] if p["page_number"] == page_num + 1), None)
            if page_data:
                for word in page_data.get("words", []):
                    # Check if this word box is being overwritten by an edit
                    is_edited = any(
                        e.get("page", 1) == page_num + 1 and 
                        abs(e.get("x", 0) - word["x"]) < 2 and 
                        abs(e.get("y", 0) - word["y"]) < 2
                        for e in edits
                    )
                    
                    if not is_edited:
                        # Insert invisible text (render_mode=3)
                        # We use the original coordinates and text
                        p_point = fitz.Point(word["x"], word["y"] + (word["height"] * 0.8))
                        page.insert_text(p_point, word["text"], fontsize=word["height"]*0.8, render_mode=3)

        # 2. Apply visible edits for this page
        page_edits = [e for e in edits if e.get("page", 1) == page_num + 1]
        
        for edit in page_edits:
            x, y = edit.get("x", 0), edit.get("y", 0)
            w, h = edit.get("width", 50), edit.get("height", 14)
            
            # Use detected background color for the patch
            bg = edit.get("backgroundColor", [1, 1, 1])
            fg = edit.get("color", [0, 0, 0])
            
            # S.C.O.T Type Logic
            is_bold = edit.get("fontWeight") == "bold"
            is_serif = edit.get("fontStyle") == "serif"
            fontname = "times-bold" if (is_serif and is_bold) else ("times-roman" if is_serif else ("helv-bold" if is_bold else "helv"))
            
            # S.C.O.T Typographical Calculus (Size & Baseline Parity)
            orig_text = edit.get("originalText", "")
            has_ascender = any(c in "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789bdfhklit|/\\()[]{}<>" for c in orig_text)
            has_descender = any(c in "gjpqy_,;Q()" for c in orig_text)
            
            if has_ascender and has_descender:
                sf, bo = 0.95, 0.72
            elif has_ascender:
                sf, bo = 0.72, 0.72
            elif has_descender:
                sf, bo = 0.72, 0.52
            else:
                sf, bo = 0.52, 0.52
                
            if not orig_text:
                sf, bo = 0.72, 0.72
                
            true_point_size = h / sf
            baseline_y = y + (true_point_size * bo)
            
            # Baseline Anchor Point
            point = fitz.Point(x, baseline_y)
            
            # Calculate dynamic background patch scaling
            new_text = edit.get("text", "")
            try:
                # Need to use standard PyMuPDF text length calculations
                new_text_width = fitz.get_text_length(new_text, fontname=fontname, fontsize=true_point_size)
            except:
                new_text_width = w
                
            patch_w = max(w, new_text_width)
            # Expand the patch box around the full EM-square to protect long new descenders/ascenders
            rect = fitz.Rect(x, baseline_y - (true_point_size * 0.75), x + patch_w, baseline_y + (true_point_size * 0.25))
            
            # Patch the background
            page.draw_rect(rect, color=bg, fill=bg, overlay=True)

            # Orientation Vector Logic (S.C.O.T Matrix Override)
            import math
            angle_deg = edit.get("angle", 0.0)
            rad = math.radians(angle_deg)
            dir_vec = (math.cos(rad), math.sin(rad))
            
            # B (Blurriness): DUAL-LAYER GHOST RENDERING (S.C.O.T Forensic Tier v3)
            # To simulate scan-blur and 'Ink Bloom', we draw the text in multiple jittered layers
            sharpness = edit.get("sharpness", 1.0)
            
            # Sub-pixel Baseline Jitter: Adds organic misalignment (+/- 0.02pt)
            import random
            jitter_y = (random.random() - 0.5) * 0.04
            point_j = fitz.Point(x, baseline_y + jitter_y)
            
            # Layer A: 'Optical Glow' (Subtle bloom around the edges)
            bloom_color = [min(1.0, c + 0.08) for c in fg] 
            page.insert_text(fitz.Point(x - 0.06, baseline_y - 0.06), new_text, fontsize=true_point_size, color=bloom_color, fontname=fontname, dir=dir_vec, fill_opacity=0.12)
            page.insert_text(fitz.Point(x + 0.06, baseline_y + 0.06), new_text, fontsize=true_point_size, color=bloom_color, fontname=fontname, dir=dir_vec, fill_opacity=0.12)
                
            # Layer B: 'Ink Saturation' (Simulates non-uniform ink spread on paper grain)
            # Use render_mode=2 (Fill then Stroke) to simulate 'Stroke Expansion' (ink spread)
            # High-fidelity patches need a lower opacity (0.91) to appear 'printed' vs 'digital overlay'
            # We add a hairline stroke (0.08) in the same color to 'bulk up' the digital font to match scan density
            page.insert_text(point_j, new_text, 
                             fontsize=true_point_size, 
                             color=fg, 
                             fontname=fontname, 
                             dir=dir_vec, 
                             fill_opacity=0.91,
                             stroke_opacity=0.91,
                             render_mode=2) # 2 = fill then stroke
            
            # Layer C: 'Detail Sharpening' (Center anchor to maintain legibility)
            page.insert_text(point_j, new_text, fontsize=true_point_size, color=fg, fontname=fontname, dir=dir_vec, fill_opacity=0.35, render_mode=0)
            
    doc.save(out_path)
    doc.close()
    
    return out_path
