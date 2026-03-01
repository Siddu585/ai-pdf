import fitz
import os

path = r"c:\Users\Siddhant\Desktop\Building A DOC utility website\Quantitative Aptitude for Competitive Examinations.pdf"
doc = fitz.open(path)
total_font_size = 0
font_count = 0

for i in range(1, doc.xref_length()):
    obj = doc.xref_object(i)
    if "/FontFile" in obj or "/FontDescriptor" in obj:
        try:
            stream = doc.xref_stream(i)
            if stream:
                size = len(stream)
                total_font_size += size
                font_count += 1
                if size > 1024 * 50: # Only print large fonts
                    print(f"Large Font XREF {i}: {size/1024:.2f} KB")
        except:
            pass

print(f"Total Fonts Found: {font_count}")
print(f"Total Font Size: {total_font_size / 1024 / 1024:.2f} MB")
doc.close()
