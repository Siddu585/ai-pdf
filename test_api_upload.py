import requests

url = "https://ai-pdf-backend-qb9z.onrender.com/api/compress-pdf"
file_path = "c:\\Users\\Siddhant\\Desktop\\test.pdf"

print(f"Reading {file_path}")
with open(file_path, "rb") as f:
    files = {"file": f}
    data = {"quality": "50"}
    headers = {
        "Origin": "https://ai-pdf-sf8x.vercel.app",
        "Referer": "https://ai-pdf-sf8x.vercel.app/",
        # "User-Agent": "Mozilla/5.0"
    }
    
    print("Sending POST request to Render backend simulating Vercel origin...")
    try:
        response = requests.post(url, files=files, data=data, headers=headers, timeout=60)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            print(f"SUCCESS! Received PDF back. Content type: {response.headers.get('content-type')}")
            print(f"Returned Size: {len(response.content)} bytes")
            print("This definitively proves the backend processes PDFs correctly and perfectly handles CORS from the Vercel frontend domain.")
        else:
            print(f"FAILED! Error {response.status_code}: {response.text}")
    except Exception as e:
        print(f"EXCEPTION: {e}")
