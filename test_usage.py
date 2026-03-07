import requests

# Test usage status to see if it has the updated limit logic
url = "https://ai-pdfai-pdf-backend.onrender.com/api/usage/status?deviceId=test-cli-device-123"
try:
    response = requests.get(url, timeout=10)
    print(f"Status Code: {response.status_code}")
    print(f"Response: {response.text}")
except Exception as e:
    print(f"Error: {e}")
