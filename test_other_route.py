import requests

small_pdf_path = "c:\\Users\\Siddhant\\Desktop\\tiny_test.pdf"

url = "https://ai-pdfai-pdf-backend.onrender.com/api/pdf-to-word"
print("Uploading to /api/pdf-to-word...")
try:
    with open(small_pdf_path, "rb") as f:
        response = requests.post(url, files={"file": f}, timeout=30)
        print(f"Status Code: {response.status_code}")
except Exception as e:
    print(f"EXCEPTION: {e}")
