import asyncio
from playwright.async_api import async_playwright
import os

async def main():
    print("Launching Desktop Browser Test...")
    
    # Create test PDF
    test_pdf = os.path.abspath("test_playwright.pdf")
    from reportlab.pdfgen import canvas
    c = canvas.Canvas(test_pdf)
    c.drawString(100, 750, "Playwright test pdf.")
    c.save()

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(ignore_https_errors=True)
        page = await context.new_page()

        # Listen to all console logs
        page.on("console", lambda msg: print(f"BROWSER CONSOLE: {msg.type}: {msg.text}"))
        
        # Listen to network errors
        page.on("requestfailed", lambda request: print(f"NETWORK ERROR: {request.url} failed: {request.failure}"))
        
        print("Navigating to https://ai-pdf-frontend.vercel.app/")
        await page.goto("https://ai-pdf-frontend.vercel.app/")

        print("Waiting for page load...")
        await page.wait_for_load_state("networkidle")
        
        print("Clicking Compress PDF...")
        # Find the compress tool link
        await page.click("text='Compress PDF'")
        
        print("Waiting for upload page...")
        await page.wait_for_selector("input[type='file']")
        
        print(f"Uploading {test_pdf}...")
        file_input = page.locator("input[type='file']")
        await file_input.set_input_files(test_pdf)
        
        print("Clicking Compress button...")
        # Since it's a label for the input, maybe we just need to wait for the Compress button
        await page.wait_for_selector("button:has-text('Compress PDF')")
        await page.click("button:has-text('Compress PDF')")
        
        print("Waiting 10 seconds for network requests...")
        await page.wait_for_timeout(10000)
        
        print("Checking if alert was fired...")
        page.on("dialog", lambda dialog: print(f"ALERT FOUND: {dialog.message}"))
        
        await browser.close()
        print("Test complete.")

if __name__ == "__main__":
    asyncio.run(main())
