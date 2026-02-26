import sys
import os
import time

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "backend")))
from app.pdf_agent import pdf_to_word

target_pdf = r"c:\Users\Siddhant\Desktop\Building A DOC utility website\Zenia Agreement scanned copy.pdf"

print(f"File size: {os.path.getsize(target_pdf) / (1024*1024):.2f} MB")
print("Running local conversion...")

start_time = time.time()
try:
    res = pdf_to_word(target_pdf)
    print(f"Success in {time.time() - start_time:.2f} seconds")
    print(f"Output saved to: {res}")
except Exception as e:
    print(f"Failed in {time.time() - start_time:.2f} seconds: {e}")
