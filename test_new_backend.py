import requests
import sys

URL = "https://ai-pdfai-pdf-backend.onrender.com"

print(f"Testing basic connection to {URL}...")
try:
    response = requests.get(f"{URL}/")
    print(f"Status Code: {response.status_code}")
    print(f"Text: {response.text}")
except Exception as e:
    print(f"Error connecting: {e}")

print(f"\nTesting health check endpoint...")
try:
    response = requests.get(f"{URL}/health")
    print(f"Status Code: {response.status_code}")
    print(f"Text: {response.text}")
except Exception as e:
    print(f"Error connecting: {e}")
