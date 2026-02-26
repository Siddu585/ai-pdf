import requests
from reportlab.pdfgen import canvas
import time

# Generate a medium PDF file
medium_pdf_path = "c:\\Users\\Siddhant\\Desktop\\medium_test.pdf"
c = canvas.Canvas(medium_pdf_path)
for page in range(100):
    for i in range(100):
        c.drawString(50, 800 - (i*8), "This is text to inflate the PDF size. " * 5)
    c.showPage()
c.save()

import os
print(f"Created {medium_pdf_path}, Size: {os.path.getsize(medium_pdf_path) / 1024:.2f} KB")

url = "https://ai-pdfai-pdf-backend.onrender.com/api/pdf-to-word"

print(f"Sending POST to {url}...")
start_time = time.time()
try:
    with open(medium_pdf_path, "rb") as f:
        response = requests.post(url, files={"file": f}, timeout=120)
        end_time = time.time()
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            print(f"SUCCESS in {end_time - start_time:.2f} seconds!")
            print(f"Returned Size: {len(response.content)} bytes")
        else:
            print(f"FAILED in {end_time - start_time:.2f} seconds! Error {response.status_code}: {response.text}")
except Exception as e:
    end_time = time.time()
    print(f"EXCEPTION in {end_time - start_time:.2f} seconds: {e}")
