import urllib.request
import re

html_url = "https://ai-pdf-sf8x.vercel.app/tools/compress-pdf"
req = urllib.request.Request(html_url, headers={'User-Agent': 'Mozilla/5.0'})
try:
    with urllib.request.urlopen(req) as response:
        html = response.read().decode('utf-8')
        
    js_route = re.search(r'src="(/_next/static/chunks/app/tools/compress-pdf/page-[^"]+\.js)"', html)
    if js_route:
        js_url = "https://ai-pdf-sf8x.vercel.app" + js_route.group(1)
        print("Found JS Chunk:", js_url)
        
        with urllib.request.urlopen(urllib.request.Request(js_url, headers={'User-Agent': 'Mozilla'})) as chunk_resp:
            js_content = chunk_resp.read().decode('utf-8')
            
            if "ai-pdf-backend-qb9z.onrender.com" in js_content:
                print("CONCLUSION: Vercel successfully deployed the NEXT_PUBLIC_API_URL string into the build!")
            elif "localhost:8000" in js_content:
                print("CONCLUSION: Vercel is serving a build that only contains localhost:8000 as the fallback!")
            else:
                print("CONCLUSION: None of the URL strings were found directly in the main chunk.")
    else:
        print("Could not find the chunk regex match in the HTML.")
except Exception as e:
    print("Error:", e)
