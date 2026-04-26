import docx
import sys
import io

file_path = r'c:\Users\Siddhant\Desktop\Building A DOC utility website\Mobile to Mobile Logs\Implementation Plan Review for v 02.2.80.docx'
out_path = 'review_content.txt'
try:
    doc = docx.Document(file_path)
    with io.open(out_path, "w", encoding="utf-8") as f:
        for p in doc.paragraphs:
            if p.text.strip():
                f.write(p.text + "\n")
    print("Success")
except Exception as e:
    print(f"Error reading docx: {e}")
