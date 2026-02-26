import sys
import os
import time

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "backend")))
from app.pdf_agent import run_iterative_pdf_compression

res = run_iterative_pdf_compression("c:\\Users\\Siddhant\\Desktop\\tiny_test.pdf", 50)
print(f"Compressed PDF saved to {res}")
import os
print(f"Size: {os.path.getsize(res)} bytes")
