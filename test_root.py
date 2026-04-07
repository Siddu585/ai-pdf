import requests

urls = [
    "https://ai-pdfai-pdf-backend.onrender.com/",
    "http://localhost:8000/"
]

for url in urls:
    try:
        print(f"Probing {url}...")
        response = requests.get(url, timeout=5)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.json()}")
    except Exception as e:
        print(f"Error for {url}: {e}")
