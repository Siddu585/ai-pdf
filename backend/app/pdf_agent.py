import fitz  # PyMuPDF
import os
import zipfile
import subprocess
from PIL import Image
from pdf2docx import Converter

def run_iterative_pdf_compression(input_path: str, quality_slider: int) -> str:
    """
    Standard Tier High-Power Compressor: 
    Targets every single embedded XREF image (even in XObjects), re-encodes based on slider,
    and applies maximum structural cleaning enabled by the 2GB RAM upgrade.
    """
    out_path = input_path + "_compressed.pdf"
    doc = fitz.open(input_path)
    
    try:
        # Determine target DPI and JPEG quality based on slider (1-100)
        # 1-30: High Comp (72 DPI, 10-25 Quality, Greyscale)
        # 31-60: Balanced (120 DPI, 40-50 Quality)
        # 61-100: Quality (150-200 DPI, 70-85 Quality)
        
        target_dpi = 150
        jpg_quality = 60
        force_grey = False
        
        if quality_slider <= 30:
            target_dpi = 72
            jpg_quality = 15 # Ultra-low for 1/3 reduction
            force_grey = True # Massive savings for textbooks
        elif quality_slider <= 60:
            target_dpi = 120
            jpg_quality = 40
        elif quality_slider <= 85:
            target_dpi = 150
            jpg_quality = 70
        else:
            target_dpi = 200
            jpg_quality = 85

        # --- STEP 1: Exhaustive XREF Image Re-encoding ---
        for xref in range(1, doc.xref_length()):
            if not doc.xref_is_image(xref):
                continue
                
            try:
                pix = fitz.Pixmap(doc, xref)
                
                # target width (standard 8.5" page at target DPI)
                target_width = int(8.5 * target_dpi)
                
                # Downsample large images
                if pix.width > target_width:
                    scale = target_width / pix.width
                    new_pix = fitz.Pixmap(pix, int(pix.width * scale), int(pix.height * scale))
                else:
                    new_pix = pix

                # Colorspace conversion
                if force_grey:
                    if new_pix.colorspace.n != 1: # If not already grey
                        new_pix = fitz.Pixmap(fitz.csGRAY, new_pix)
                elif new_pix.n >= 4 or new_pix.alpha:
                    # JPEG mandatory RGB
                    new_pix = fitz.Pixmap(fitz.csRGB, new_pix)
                
                # Re-encode using THE CORRECT KEYWORD: jpg_quality
                img_bytes = new_pix.tobytes("jpeg", jpg_quality=jpg_quality)
                
                # Only replace if actually smaller
                old_stream = doc.xref_stream(xref)
                if old_stream and len(img_bytes) < len(old_stream):
                    doc.update_stream(xref, img_bytes)
                    doc.xref_set_key(xref, "Filter", "/DCTDecode")
                    try: doc.xref_set_key(xref, "DecodeParms", "null")
                    except: pass
                
                new_pix = None
                pix = None
            except Exception as e:
                print(f"Skipping internal image {xref}: {e}")

        # --- STEP 2: Structural Optimization (Standard Tier Safe) ---
        doc.set_metadata({})
        try: doc.subset_fonts()
        except: pass

        save_options = {
            "garbage": 4,          
            "deflate": True,       
            "clean": True,         
            "deflate_fonts": True, 
            "deflate_images": True,
            "pretty": False,       
            "incremental": False   
        }
        doc.save(out_path, **save_options)
            
    except Exception as e:
        print(f"Error during exhaustive compression: {e}")
        doc.save(out_path)
    finally:
        doc.close()
        
    return out_path

def organize_pdf(input_path: str, order_string: str) -> str:
    """
    Rearranges or deletes pages in a PDF based on a comma-separated string of 0-indexed page numbers.
    e.g., '2,0' keeps only the 3rd, then 1st page.
    """
    out_path = input_path + "_organized.pdf"
    
    try:
        doc = fitz.open(input_path)
        
        # Parse the comma-separated string into a list of integers
        if not order_string.strip():
            # If empty, that means they deleted all pages
            # PyMuPDF cannot save a 0-page PDF, so just save an empty one.
            new_doc = fitz.open()
            new_doc.new_page()
            new_doc.save(out_path)
            new_doc.close()
            return out_path
            
        page_indices = [int(x) for x in order_string.split(",")]
        
        # select() natively handles reordering, deletion, and duplication
        doc.select(page_indices)
        doc.save(out_path)
        doc.close()
    except Exception as e:
        print(f"Error organizing PDF: {e}")
        # fallback
        import shutil
        shutil.copyfile(input_path, out_path)
        
    return out_path

import base64

def extract_pdf_thumbnails(input_path: str) -> list[str]:
    """
    Extracts a highly compressed base64 JPEG thumbnail for every page in a PDF.
    Uses native C-bindings in PyMuPDF so it won't crash on 1000+ page documents.
    """
    thumbnails = []
    try:
        doc = fitz.open(input_path)
        for page in doc:
            # Generate a very low-res pixmap for snappy UI loading
            pix = page.get_pixmap(dpi=36, colorspace=fitz.csRGB)
            # Get JPEG bytes via PyMuPDF native conversion
            img_bytes = pix.tobytes("jpeg")
            b64_str = base64.b64encode(img_bytes).decode('utf-8')
            thumbnails.append(f"data:image/jpeg;base64,{b64_str}")
        doc.close()
    except Exception as e:
        print(f"Error extracting thumbnails: {e}")
    
    return thumbnails

def images_to_pdf(image_paths: list[str]) -> str:
    """
    Combines a list of image paths into a single PDF file using Pillow's native PDF sequence saving.
    """
    if not image_paths:
        raise ValueError("No images provided")
        
    out_path = image_paths[0] + "_combined.pdf"
    
    images = []
    for path in image_paths:
        try:
            img = Image.open(path)
            if img.mode != "RGB":
                img = img.convert("RGB")
            images.append(img)
        except Exception as e:
            print(f"Failed to open image {path}: {e}")
            
    if not images:
        raise ValueError("Could not parse any provided images into PDF.")
        
    # Save the first image, appending subsequent images as extra PDF pages
    images[0].save(out_path, "PDF", save_all=True, append_images=images[1:])
    
    return out_path

def split_pdf(input_path: str, ranges: str) -> str:
    """
    Splits a PDF into multiple PDFs based on comma-separated ranges (e.g. "1-3, 5, 7-9").
    Returns a ZIP file containing the split PDFs, or a single PDF if there is only one range.
    """
    doc = fitz.open(input_path)
    base_name = os.path.basename(input_path).replace('.pdf', '')
    
    parts = ranges.split(',')
    out_files = []
    
    for i, part in enumerate(parts):
        part = part.strip()
        if not part: continue
        
        new_doc = fitz.open()
        
        try:
            if '-' in part:
                start, end = part.split('-')
                start_idx = max(0, int(start) - 1)
                end_idx = min(len(doc) - 1, int(end) - 1)
                new_doc.insert_pdf(doc, from_page=start_idx, to_page=end_idx)
            else:
                idx = int(part) - 1
                if 0 <= idx < len(doc):
                    new_doc.insert_pdf(doc, from_page=idx, to_page=idx)
                    
            if new_doc.page_count > 0:
                out_name = f"{input_path}_part_{i+1}.pdf"
                new_doc.save(out_name)
                out_files.append((out_name, f"{base_name}_part_{i+1}.pdf"))
        except Exception as e:
            print(f"Error parsing split range '{part}': {e}")
        finally:
            new_doc.close()
            
    doc.close()
    
    if len(out_files) == 0:
        raise ValueError("Invalid ranges or no pages found.")
    
    if len(out_files) == 1:
        return out_files[0][0] # return the single pdf directly
        
    zip_path = input_path + "_split.zip"
    with zipfile.ZipFile(zip_path, 'w') as zipf:
        for fpath, fname in out_files:
            zipf.write(fpath, fname)
            
    return zip_path

def pdf_to_word(input_path: str) -> str:
    """
    Converts a PDF file to a Word document (.docx) using pdf2docx.
    """
    out_path = input_path + ".docx"
    
    try:
        import fitz
        doc = fitz.open(input_path)
        total_pages = len(doc)
        doc.close()

        cv = Converter(input_path)
        
        # Render Standard Tier (1 CPU / 2GB RAM) Config
        kwargs = {
            "multi_processing": True,
            "cpu_count": 2  # Utilize multi-threading to speed up heavy conversions
        }
        
        cv.convert(out_path, **kwargs)
        cv.close()
    except Exception as e:
        print(f"Error converting PDF to Word: {e}")
        raise
        
    return out_path

def office_to_pdf(input_path: str) -> str:
    """
    Converts a Word document (.docx, .doc) to PDF using LibreOffice headless (Linux/Cloud).
    Falls back to docx2pdf (MS Word) for local Windows development if LibreOffice is missing.
    """
    ext = os.path.splitext(input_path)[1].lower()
    if ext not in [".docx", ".doc"]:
        raise ValueError("Only Word documents (.docx, .doc) are supported at this time.")
        
    out_path = input_path.replace(ext, ".pdf")
    out_dir = os.path.dirname(os.path.abspath(out_path))
    
    try:
        # 1. Attempt LibreOffice headless (Standard in Cloud / Linux)
        args = ["soffice", "--headless", "--convert-to", "pdf", "--outdir", out_dir, input_path]
        subprocess.run(args, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        
        expected_lo_out = os.path.join(out_dir, os.path.splitext(os.path.basename(input_path))[0] + ".pdf")
        if expected_lo_out != out_path and os.path.exists(expected_lo_out):
            os.rename(expected_lo_out, out_path)
            
    except (subprocess.CalledProcessError, FileNotFoundError):
        # 2. Fallback to docx2pdf on Windows (requires MS Word)
        try:
            from docx2pdf import convert
            convert(input_path, out_path)
        except Exception as e:
            print(f"Error converting Office to PDF: {e}")
            raise ValueError(f"Could not convert Office to PDF. Ensure LibreOffice ('soffice') is installed on the server, or MS Word on Windows. Error: {e}")
        
    return out_path

def unlock_pdf(input_path: str, password: str = "") -> str:
    """
    Removes password protection from a PDF file if the correct password is provided.
    """
    out_path = input_path + "_unlocked.pdf"
    doc = fitz.open(input_path)
    
    try:
        if doc.needs_pass:
            if not doc.authenticate(password):
                raise ValueError("Incorrect password or file cannot be unlocked.")
                
        doc.save(out_path)
    finally:
        doc.close()
        
    return out_path


def repair_pdf(input_path: str) -> str:
    """
    Attempts to repair a PDF file by saving it with aggressive garbage collection and cross-reference table rebuilding.
    """
    out_path = input_path + "_repaired.pdf"
    
    try:
        doc = fitz.open(input_path)
        doc.save(out_path, garbage=4, clean=True, deflate=True)
        doc.close()
    except Exception as e:
        print(f"Error repairing PDF: {e}")
        raise ValueError(f"Could not repair PDF. The file may be unreadably corrupted. ({e})")
        
    return out_path
