import docx
import sys
import io

# Setup UTF-8 output
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

file_path = r'c:\Users\Siddhant\Desktop\Building A DOC utility website\Mobile to Mobile Logs\Implementation Plan Review for v 02.2.80.docx'
try:
    doc = docx.Document(file_path)
    for p in doc.paragraphs:
        if p.text.strip():
            print(p.text)
except Exception as e:
    print(f"Error reading docx: {e}")
