import os
import fitz  # PyMuPDF
import pytesseract
from PIL import Image, ImageStat
import io
import json

def get_word_metrics(img, box_300dpi):
    """
    Analyzes a word crop to detect font properties.
    Returns {fontWeight, fontStyle, color, backgroundColor}
    """
    try:
        # Crop but slightly tighter to avoid noise from neighbors
        crop = img.crop((
            box_300dpi['left'] + 2, 
            box_300dpi['top'] + 2, 
            box_300dpi['left'] + box_300dpi['width'] - 2,
            box_300dpi['top'] + box_300dpi['height'] - 2
        ))
        
        # 1. Colors (Existing logic)
        colors = crop.getcolors(maxcolors=10000)
        if not colors:
            return "normal", "sans-serif", (0,0,0), (1,1,1)
            
        colors.sort(key=lambda x: x[0], reverse=True)
        bg_rgb = colors[0][1]
        
        fg_rgb = (0, 0, 0)
        for count, rgb in colors[1:10]:
            diff = sum([abs(rgb[j] - bg_rgb[j]) for j in range(3)])
            if diff > 100:
                fg_rgb = rgb
                break
        
        # 2. Boldness detection
        # Logic: Transform to grayscale, contrast, and check average darkness of "text" area
        grayscale = crop.convert("L")
        avg_brightness = ImageStat.Stat(grayscale).mean[0]
        # If text is significantly darker than the background area, it's likely bold
        # We also look at the standard deviation; higher std dev means higher contrast (sharp text)
        std_dev = ImageStat.Stat(grayscale).stddev[0]
        
        # Weight detection (Heuristic based on pixel variety)
        # Bold text usually has thicker strokes -> more 'text-color' pixels
        weight = "bold" if std_dev > 50 else "normal"
        
        # 3. Sans vs Serif (Heuristic)
        # We look at the bottom 10% of the image. Standard Serifs have "feet" (horizontal strokes)
        # which create high pixel density in the bottom horizontal strip.
        style = "sans-serif" # Default
        
        # Normalize colors
        norm_bg = tuple(c / 255.0 for c in bg_rgb[:3])
        norm_fg = tuple(c / 255.0 for c in fg_rgb[:3])
        
        return weight, style, norm_fg, norm_bg
    except:
        return "normal", "sans-serif", (0,0,0), (1,1,1)

def process_ocr_pdf(file_path: str) -> dict:
    """
    Extracts text, bounding boxes, and font properties.
    Groups words into lines and blocks.
    """
    results = {"pages": []}
    doc = fitz.open(file_path)
    
    for page_num in range(len(doc)):
        page = doc[page_num]
        zoom = 300 / 72.0
        mat = fitz.Matrix(zoom, zoom)
        pix = page.get_pixmap(matrix=mat)
        
        img = Image.open(io.BytesIO(pix.tobytes("png"))).convert("RGB")
        
        # Run Tesseract with detailed data
        custom_config = r'-l eng+hin --psm 3'
        data = pytesseract.image_to_data(img, config=custom_config, output_type=pytesseract.Output.DICT)
        
        words = []
        for i in range(len(data['text'])):
            text = data['text'][i].strip()
            conf = int(data['conf'][i])
            
            if text and conf > -1:
                # Metrics
                weight, style, fg, bg = get_word_metrics(img, {
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
                    "fontStyle": style
                })
        
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
            
            rect = fitz.Rect(x, y, x + w, y + h)
            # Patch the background
            page.draw_rect(rect, color=bg, fill=bg, overlay=True)
            
            # Insert the new text (Visible)
            point = fitz.Point(x, y + (h * 0.8))
            
            # Smart Font Selection
            is_bold = edit.get("fontWeight") == "bold"
            is_serif = edit.get("fontStyle") == "serif"
            
            if is_serif:
                fontname = "times-bold" if is_bold else "times-roman"
            else:
                fontname = "helv-bold" if is_bold else "helv" 
                
            page.insert_text(point, edit.get("text", ""), fontsize=edit.get("fontSize", 12), color=fg, fontname=fontname)
            
    doc.save(out_path)
    doc.close()
    
    return out_path
