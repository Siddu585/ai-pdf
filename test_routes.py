import requests

url = "https://ai-pdfai-pdf-backend.onrender.com/docs"
try:
    response = requests.get(url, timeout=10)
    print(f"Docs Status: {response.status_code}")
except Exception as e:
    print(f"Docs Exception: {e}")

url = "https://ai-pdfai-pdf-backend.onrender.com/api/compress-image"
try:
    # We can just send a bad request, we just want to see if it responds fast
    response = requests.post(url, timeout=10)
    print(f"Image Compress Status: {response.status_code} - {response.text}")
except Exception as e:
    print(f"Image Compress Exception: {e}")
