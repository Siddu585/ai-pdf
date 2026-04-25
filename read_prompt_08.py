import docx
import sys
import io

path = r'c:\Users\Siddhant\Desktop\Building A DOC utility website\Mobile to Mobile Logs\Prompt 08.docx'
out_path = r'c:\Users\Siddhant\Desktop\Building A DOC utility website\Mobile to Mobile Logs\Prompt_08_Extracted.txt'
try:
    doc = docx.Document(path)
    with io.open(out_path, "w", encoding="utf-8") as f:
        for p in doc.paragraphs:
            f.write(p.text + "\n")
    print(f"Success: Wrote to {out_path}")
except Exception as e:
    print(f"Error: {e}")
