import urllib.request
import urllib.error

url = "https://ai-pdfai-pdf-backend.onrender.com/api/compress-pdf"
req = urllib.request.Request(url, method="OPTIONS")
req.add_header('Origin', 'https://ai-pdf-frontend.vercel.app')
req.add_header('Access-Control-Request-Method', 'POST')
req.add_header('Access-Control-Request-Headers', 'content-type')

try:
    response = urllib.request.urlopen(req)
    print("Success:", response.status)
    print("Headers:\n", response.headers)
except urllib.error.HTTPError as e:
    print("HTTP Error:", e.code, e.reason)
    print("Headers:\n", e.headers)
except Exception as e:
    print("Error:", e)
