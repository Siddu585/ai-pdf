import sys
import os

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "backend")))
from app.pdf_agent import run_iterative_pdf_compression

res = run_iterative_pdf_compression("c:\\Users\\Siddhant\\Desktop\\text_and_image.pdf", 30)
print(f"Compressed PDF saved to {res}")
import os
print(f"Size: {os.path.getsize(res)} bytes")
