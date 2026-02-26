import urllib.request
import re

html_url = "https://ai-pdf-frontend.vercel.app/tools/compress-pdf"
req = urllib.request.Request(html_url, headers={'User-Agent': 'Mozilla/5.0'})
try:
    with urllib.request.urlopen(req) as response:
        html = response.read().decode('utf-8')
        
    js_files = re.findall(r'src="(/_next/static/chunks/.*?\.js)"', html)
    print(f"Found {len(js_files)} JS chunk references.")
    
    found_render = False
    found_local = False
    
    for js_route in js_files:
        js_url = "https://ai-pdf-frontend.vercel.app" + js_route
        try:
            with urllib.request.urlopen(urllib.request.Request(js_url, headers={'User-Agent': 'Mozilla'})) as chunk_resp:
                js_content = chunk_resp.read().decode('utf-8')
                if "ai-pdfai-pdf-backend.onrender.com" in js_content:
                    found_render = True
                    print(f"✅ Render URL baked into: {js_route}")
                if "localhost:8000" in js_content:
                    found_local = True
                    print(f"❌ Localhost port 8000 found in: {js_route}")
        except Exception as e:
            print(f"Failed to fetch {js_route}: {e}")
            
    print("\n--- RESULTS ---")
    if found_render and not found_local:
        print("PERFECT: Only the Render URL is present in the chunks. The build is absolutely flawless.")
    elif found_local and not found_render:
        print("FAIL: The Render URL is totally missing, and localhost:8000 is still hardcoded. Vercel ignored the environment variable!")
    elif found_render and found_local:
        print("MIXED: Both URLs are present. It baked the URL but the fallback logic preserved both strings in the AST.")
    else:
        print("UNKNOWN: Neither string was found in the JS chunks. Maybe it's SSR strictly, but client fetch should have it.")
        
except Exception as e:
    print("Error:", e)
