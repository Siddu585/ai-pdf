import requests
import time
from reportlab.pdfgen import canvas

# Generate a 1MB PDF file
small_pdf_path = "c:\\Users\\Siddhant\\Desktop\\1mb_test.pdf"
print(f"Generating 1MB PDF at {small_pdf_path}...")
c = canvas.Canvas(small_pdf_path)
for i in range(100):
    c.drawString(100, 750, f"This is a test PDF page {i} to make it larger. " * 50)
    c.showPage()
c.save()
print(f"Created {small_pdf_path}")

url = "https://ai-pdfai-pdf-backend.onrender.com/api/compress-pdf"

print("Sending POST request to Render backend simulating Vercel origin...")
start_time = time.time()
try:
    with open(small_pdf_path, "rb") as f:
        files = {"file": f}
        data = {"quality": "50"}
        headers = {
            "Origin": "https://ai-pdf-frontend.vercel.app",
        }
        
        response = requests.post(url, files=files, data=data, headers=headers)
        end_time = time.time()
        print(f"Status Code: {response.status_code}")
        print(f"Time Taken: {end_time - start_time:.2f} seconds")
        
        if response.status_code == 200:
            print("SUCCESS! Received PDF back.")
            print(f"Returned Size: {len(response.content)} bytes")
        else:
            print(f"FAILED! Error {response.status_code}: {response.text}")
except Exception as e:
    end_time = time.time()
    print(f"Time before exception: {end_time - start_time:.2f} seconds")
    print(f"EXCEPTION: {e}")
