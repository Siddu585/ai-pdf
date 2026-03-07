import requests

print("Checking live swap-pdf.com...")
try:
    response = requests.get("https://www.swap-pdf.com/")
    html = response.text
    if 'Go Pro' in html:
        print("YES: 'Go Pro' text is found on the live site.")
    else:
        print("NO: 'Go Pro' text is NOT found on the live site.")
    if 'Gigabit Pro' in html:
        print("YES: 'Gigabit Pro' text is found on the live site.")
        
except Exception as e:
    print(f"Error: {e}")
