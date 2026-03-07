import requests

url = "https://ai-pdfai-pdf-backend.onrender.com/api/compress-image"
files = {'file': open('dummy_image.jpg', 'rb')}
data = {'target_kb': 50, 'deviceId': 'test-cli-device-123'}

try:
    response = requests.post(url, files=files, data=data)
    print(f"Status Code: {response.status_code}")
    if response.status_code != 200:
        print(f"Error Content: {response.text}")
    else:
        print(f"Success! Output size: {len(response.content)} bytes")
except Exception as e:
    print(f"Request failed: {e}")
