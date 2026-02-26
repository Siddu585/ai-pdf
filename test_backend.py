import urllib.request
import urllib.error
import urllib.parse
from PIL import Image
import io

# create a dummy image
img = Image.new('RGB', (10, 10), color = 'red')
img_byte_arr = io.BytesIO()
img.save(img_byte_arr, format='PNG')
img_byte_arr = img_byte_arr.getvalue()

url = "https://ai-pdf-backend-qb9z.onrender.com/api/compress-image"
req = urllib.request.Request(url, method="POST")
req.add_header('Origin', 'https://ai-pdf-sf8x.vercel.app')
# We need multipart/form-data, but we can just test if the endpoint is reachable

try:
    response = urllib.request.urlopen(req)
    print("Success:", response.status)
except urllib.error.HTTPError as e:
    print("HTTP Error:", e.code, e.reason)
except Exception as e:
    print("Error:", e)
