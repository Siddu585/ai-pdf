import os
import fitz  # PyMuPDF
import pytesseract
from PIL import Image
import io

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
        
        # Render page to high-res image (300 DPI)
        zoom = 300 / 72.0
        mat = fitz.Matrix(zoom, zoom)
        pix = page.get_pixmap(matrix=mat)
        
        # Convert to PIL Image
        img_data = pix.tobytes("jpeg")
        img = Image.open(io.BytesIO(img_data))
        
        # Run Tesseract OCR
        # We use pytesseract.image_to_data to get bounding boxes
        # --psm 3 : Fully automatic page segmentation, but no OSD.
        custom_config = r'-l eng+hin --psm 3'
        
        data = pytesseract.image_to_data(img, config=custom_config, output_type=pytesseract.Output.DICT)
        
        words = []
        for i in range(len(data['text'])):
            text = data['text'][i].strip()
            conf = int(data['conf'][i])
            
            if text and conf > -1:
                # Calculate coordinates back to 72 DPI (standard PDF coordinate system)
                x = data['left'][i] / zoom
                y = data['top'][i] / zoom
                w = data['width'][i] / zoom
                h = data['height'][i] / zoom
                
                words.append({
                    "text": text,
                    "x": x,
                    "y": y,
                    "width": w,
                    "height": h,
                    "confidence": conf
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
    'edits' format: [{"page": 1, "text": "New Text", "x": 100, "y": 200, "fontSize": 14, "fontFamily": "Helvetica", "color": "#000000"}]
    """
    out_path = original_pdf_path + "_true_edit.pdf"
    doc = fitz.open(original_pdf_path)
    
    # To properly simulate "editing" scanned patches, users typically draw a white rectangle over the old text and write new text.
    for edit in edits:
        page_idx = edit.get("page", 1) - 1
        if 0 <= page_idx < len(doc):
            page = doc[page_idx]
            
            # 1. White out the old bounding area
            x, y = edit.get("x", 0), edit.get("y", 0)
            w, h = edit.get("width", 50), edit.get("height", 14)
            rect = fitz.Rect(x, y, x + w, y + h)
            page.draw_rect(rect, color=(1, 1, 1), fill=(1, 1, 1))
            
            # 2. Insert new text at the same coordinates
            # A trick to align baseline is adding h * 0.8 to y for PyMuPDF
            point = fitz.Point(x, y + (h * 0.8))
            fontname = "helv"  # Fallback
            page.insert_text(point, edit.get("text", ""), fontsize=edit.get("fontSize", 12), color=(0, 0, 0), fontname=fontname)
            
    doc.save(out_path)
    doc.close()
    
    return out_path
