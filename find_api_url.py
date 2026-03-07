import requests
import re

print("Fetching swap-pdf.com homepage...")
try:
    response = requests.get("https://www.swap-pdf.com/")
    html = response.text
    
    # Extract all JS script URLs
    scripts = re.findall(r'src="(/_next/static/chunks/[^"]+\.js)"', html)
    print(f"Found {len(scripts)} JS chunks.")
    
    found_urls = set()
    for script in scripts:
        script_url = f"https://www.swap-pdf.com{script}"
        try:
            js_code = requests.get(script_url).text
            # Search for anything matching .onrender.com
            matches = re.findall(r'https?://[a-zA-Z0-9-]+\.onrender\.com', js_code)
            for m in matches:
                found_urls.add(m)
        except Exception as e:
            pass
            
    print("\n--- Discovered Render URLs ---")
    if found_urls:
        for u in found_urls:
            print(u)
    else:
        print("No Render URLs found in the JS bundles.")

except Exception as e:
    print(f"Error: {e}")
