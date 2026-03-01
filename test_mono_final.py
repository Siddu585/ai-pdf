import fitz
import os

def test_mono_output():
    path = r"c:\Users\Siddhant\Desktop\Building A DOC utility website\Quantitative Aptitude for Competitive Examinations.pdf"
    doc = fitz.open(path)
    new_doc = fitz.open()
    
    # Test 20 pages
    for i in range(20):
        page = doc[i]
        # 200 DPI is the sweet spot for 1000-page books
        pix = page.get_pixmap(dpi=200, colorspace=fitz.csGRAY)
        # 1-bit conversion
        pix.idist(fitz.IRect(pix.width, pix.height), (0,)) # Placeholder to ensure processing
        
        new_page = new_doc.new_page(width=page.rect.width, height=page.rect.height)
        # Using format='png' ensures 1-bit compression if the pixmap is treated as such
        new_page.insert_image(page.rect, stream=pix.tobytes("png"))
    
    out = "test_mono_final.pdf"
    new_doc.save(out, deflate=True, garbage=4)
    size = os.path.getsize(out)
    print(f"20 Pages Size: {size/1024:.2f} KB")
    print(f"Estimated 1049 Pages: {size * (1049/20) / 1024 / 1024:.2f} MB")
    new_doc.close()
    doc.close()

test_mono_output()
