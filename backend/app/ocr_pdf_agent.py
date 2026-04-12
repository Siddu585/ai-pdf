import os
import fitz  # PyMuPDF
import pytesseract
from PIL import Image, ImageStat
import io
import json

def get_word_colors(img, box_300dpi):
    """
    Samples the background and text colors from a PIL image given a 300dpi box.
    Returns (bg_rgb, text_rgb) as tuples of (r, g, b) normalized 0.0-1.0.
    """
    try:
        # Crop to the word box
        crop = img.crop((
            box_300dpi['left'], 
            box_300dpi['top'], 
            box_300dpi['left'] + box_300dpi['width'],
            box_300dpi['top'] + box_300dpi['height']
        ))
        
        # Get dominant color (background) - usually the most frequent color at the edges
        colors = crop.getcolors(maxcolors=1000000)
        if not colors:
            return (1, 1, 1), (0, 0, 0) # Fallback
            
        colors.sort(key=lambda x: x[0], reverse=True)
        
        # Dominate color
        dom_rgb = colors[0][1]
        
        # Text color - look for a color that contrasts with the dominant color
        # We'll take the 2nd or 3rd most frequent color if it's different enough,
        # or just use the mean color if the contrast is high.
        text_rgb = (0, 0, 0)
        for count, rgb in colors[1:10]:
            # Simple brightness difference
            diff = sum([abs(rgb[j] - dom_rgb[j]) for j in range(3)])
            if diff > 100: # Threshold for "different enough"
                text_rgb = rgb
                break
        
        # Normalize for PyMuPDF (0.0 - 1.0)
        norm_bg = tuple(c / 255.0 for c in dom_rgb[:3])
        norm_text = tuple(c / 255.0 for c in text_rgb[:3])
        
        return norm_bg, norm_text
    except:
        return (1, 1, 1), (0, 0, 0)

def process_ocr_pdf(file_path: str) -> dict:
    """
    Extracts text, bounding boxes, and confidence for every word in a PDF.
    Supports English and Hindi.
    """
    results = {"pages": []}
    doc = fitz.open(file_path)
    
    # Process each page
    for page_num in range(len(doc)):
        page = doc[page_num]
        
        # Render page to high-res image (300 DPI) for OCR and Color sampling
        zoom = 300 / 72.0
        mat = fitz.Matrix(zoom, zoom)
        pix = page.get_pixmap(matrix=mat)
        
        # Convert to PIL Image
        img_data = pix.tobytes("png")
        img = Image.open(io.BytesIO(img_data)).convert("RGB")
        
        # Run Tesseract OCR
        custom_config = r'-l eng+hin --psm 3'
        data = pytesseract.image_to_data(img, config=custom_config, output_type=pytesseract.Output.DICT)
        
        words = []
        for i in range(len(data['text'])):
            text = data['text'][i].strip()
            conf = int(data['conf'][i])
            
            if text and conf > -1:
                # Calculate coordinates back to 72 DPI
                x = data['left'][i] / zoom
                y = data['top'][i] / zoom
                w = data['width'][i] / zoom
                h = data['height'][i] / zoom
                
                # Get Colors
                bg, fg = get_word_colors(img, {
                    'left': data['left'][i], 
                    'top': data['top'][i], 
                    'width': data['width'][i], 
                    'height': data['height'][i]
                })
                
                words.append({
                    "text": text,
                    "x": x,
                    "y": y,
                    "width": w,
                    "height": h,
                    "confidence": conf,
                    "color": fg, # [r, g, b]
                    "backgroundColor": bg # [r, g, b]
                })
        
        results["pages"].append({
            "page_number": page_num + 1,
            "width": page.rect.width,
            "height": page.rect.height,
            "words": words
        })
        
    doc.close()
    return results

def extract_edited_pdf(original_pdf_path: str, edits: list) -> str:
    """
    Applies user text modifications over the original scanned PDF.
    Inserts a hidden text layer to make the entire PDF copiable.
    """
    out_path = original_pdf_path + "_true_edit.pdf"
    doc = fitz.open(original_pdf_path)
    
    # To truly make it a "professional" OCR output, we should add an invisible text layer
    # for all original words, and visible text for Edited words.
    
    # We need the original OCR data again or passed through
    # For simplicity, if 'edits' includes the full word set, we use that.
    # Otherwise, we'd re-run OCR or use a cached version.
    
    for page_num in range(len(doc)):
        page = doc[page_num]
        
        # Apply edits for this page
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
            # Baseline adjustment 0.8h
            point = fitz.Point(x, y + (h * 0.8))
            fontname = "helv" 
            page.insert_text(point, edit.get("text", ""), fontsize=edit.get("fontSize", 12), color=fg, fontname=fontname)
            
        # Optional: Add invisible text layer for searchability (if full words are provided)
        # For now, let's at least ensure edited text is searchable.
        # insert_text automatically adds a text layer.
            
    doc.save(out_path)
    doc.close()
    
    return out_path
