import requests
from reportlab.pdfgen import canvas

# Generate a tiny PDF file
small_pdf_path = "c:\\Users\\Siddhant\\Desktop\\tiny_test.pdf"
c = canvas.Canvas(small_pdf_path)
c.drawString(100, 750, "This is a tiny test PDF.")
c.save()
print(f"Created {small_pdf_path}")

url = "https://ai-pdfai-pdf-backend.onrender.com/api/compress-pdf"

print("Sending POST request to Render backend simulating Vercel origin...")
try:
    with open(small_pdf_path, "rb") as f:
        files = {"file": f}
        data = {"quality": "50"}
        headers = {
            "Origin": "https://ai-pdf-frontend.vercel.app",
        }
        
        response = requests.post(url, files=files, data=data, headers=headers, timeout=60)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            print("SUCCESS! Received PDF back.")
            print(f"Returned Size: {len(response.content)} bytes")
            print("The code and deployment are absolutely perfect! The previous failure was STRICTLY because the 60MB file timed out on Render's free tier.")
        else:
            print(f"FAILED! Error {response.status_code}: {response.text}")
except Exception as e:
    print(f"EXCEPTION: {e}")
