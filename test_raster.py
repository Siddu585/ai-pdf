import os
import fitz

def test_raster(dpi, quality, grey=True):
    input_file = r"c:\Users\Siddhant\Desktop\Building A DOC utility website\Quantitative Aptitude for Competitive Examinations.pdf"
    doc = fitz.open(input_file)
    new_doc = fitz.open()
    
    # Test only first 50 pages to estimate
    test_pages = min(50, len(doc))
    total_size = 0
    
    for i in range(test_pages):
        page = doc[i]
        pix = page.get_pixmap(dpi=dpi, colorspace=fitz.csGRAY if grey else fitz.csRGB)
        img_bytes = pix.tobytes("jpeg", jpg_quality=quality)
        total_size += len(img_bytes)
        pix = None
        
    estimated_total_mb = (total_size / test_pages * len(doc)) / 1024 / 1024
    print(f"DPI: {dpi} | Q: {quality} | Grey: {grey} | Mono: {False} | Estimated Size: {estimated_total_mb:.2f} MB")
    doc.close()

def test_mono(dpi):
    input_file = r"c:\Users\Siddhant\Desktop\Building A DOC utility website\Quantitative Aptitude for Competitive Examinations.pdf"
    doc = fitz.open(input_file)
    test_pages = min(50, len(doc))
    total_size = 0
    
    for i in range(test_pages):
        page = doc[i]
        # Get 1-bit monochrome pixmap
        pix = page.get_pixmap(dpi=dpi, colorspace=fitz.csGRAY)
        pix.colorspace = fitz.csGRAY # Ensure gray for thresholding
        
        # Simple thresholding to 1-bit
        # Since pix.tobytes("png") or similar is needed, we'll use a png proxy size
        # True CCITT G4 would be even smaller, but PNG-1bit is a good estimate.
        img_bytes = pix.tobytes("png") # placeholder for size estimate
        total_size += len(img_bytes)
        pix = None
        
    estimated_total_mb = (total_size / test_pages * len(doc)) / 1024 / 1024
    print(f"DPI: {dpi} | Mono-PNG Estimated Size: {estimated_total_mb:.2f} MB")
    doc.close()

test_raster(72, 50)
test_raster(72, 30)
test_raster(60, 50)
test_mono(72)
test_mono(96)
test_mono(150)
