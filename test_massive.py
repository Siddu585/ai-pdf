import sys
import os
import time
import requests
import fitz

# Create a 6MB dummy PDF
dummy_path = "c:\\Users\\Siddhant\\Desktop\\massive_test.pdf"
doc = fitz.open()

print("Generating 250 page text document...")
for i in range(250):
    page = doc.new_page()
    page.insert_text((50, 50), "This is a heavy text line to simulate textbook size. " * 30 * 40)
doc.save(dummy_path)
doc.close()

from backend.app.pdf_agent import pdf_to_word

print(f"Generated. Size: {os.path.getsize(dummy_path) / (1024*1024):.2f} MB")
print("Running local conversion...")

start_time = time.time()
try:
    res = pdf_to_word(dummy_path)
    print(f"Success in {time.time() - start_time:.2f} seconds")
except Exception as e:
    print(f"Failed in {time.time() - start_time:.2f} seconds: {e}")
