import fitz

def compress_pdf_images(input_path, output_path, quality=50):
    doc = fitz.open(input_path)
    
    # Iterate through all objects to find images
    for xref in range(1, doc.xref_length()):
        if not doc.xref_is_image(xref):
            continue
            
        try:
            pix = fitz.Pixmap(doc, xref)
            
            # Convert to RGB if it has other color spaces
            # Since JPEG does not support alpha, we must drop it
            if pix.n >= 4 or pix.alpha:
                pix = fitz.Pixmap(fitz.csRGB, pix)
                
            img_bytes = pix.tobytes("jpeg", jpg_quality=quality)
            
            # If the compressed bytes are smaller than the original stream, replace it
            old_size = doc.xref_length(xref) # wait, stream length is doc.xref_length(xref) - no it's stream size
            old_stream = doc.xref_stream(xref)
            old_len = len(old_stream) if old_stream else 0
            
            if len(img_bytes) < old_len or old_len == 0:
                doc.update_stream(xref, img_bytes)
                doc.xref_set_key(xref, "Filter", "/DCTDecode")
                
                # Clean up potentially conflicting keys
                try: doc.xref_set_key(xref, "DecodeParms", "null")
                except: pass
        except Exception as e:
            print(f"Failed to compress xref {xref}: {e}")
            
    doc.save(output_path, garbage=4, deflate=True)
    doc.close()

if __name__ == "__main__":
    # Create a test PDF with text and an image
    import time
    from reportlab.pdfgen import canvas
    
    small_pdf_path = "c:\\Users\\Siddhant\\Desktop\\text_and_image.pdf"
    c = canvas.Canvas(small_pdf_path)
    c.drawString(100, 750, "This is a test PDF with pure vector text.")
    # Add some text
    for i in range(100):
        c.drawString(100, 730 - (i*10), "This is text that should NOT be rasterized. " * 5)
    c.save()
    
    out_path = "c:\\Users\\Siddhant\\Desktop\\text_and_image_compressed.pdf"
    start = time.time()
    compress_pdf_images(small_pdf_path, out_path, 30)
    end = time.time()
    
    import os
    orig_size = os.path.getsize(small_pdf_path)
    new_size = os.path.getsize(out_path)
    
    print(f"Original: {orig_size} bytes")
    print(f"Compressed: {new_size} bytes")
    print(f"Time: {end - start:.2f}s")
