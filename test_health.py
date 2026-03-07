import requests

url = "https://ai-pdfai-pdf-backend.onrender.com/docs"
try:
    response = requests.get(url, timeout=10)
    print(f"Status Code: {response.status_code}")
except Exception as e:
    print(f"Error: {e}")
