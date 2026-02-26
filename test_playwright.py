import asyncio
from playwright.async_api import async_playwright
import sys
import os

async def run():
    async with async_playwright() as p:
        print("Launching Chromium browser...")
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context()
        page = await context.new_page()
        
        pdf_path = "c:\\Users\\Siddhant\\Desktop\\test.pdf"
        print(f"Targeting PDF File: {pdf_path}")
        
        url = "https://ai-pdf-sf8x.vercel.app/tools/compress-pdf"
        print(f"Navigating to {url}...")
        
        response = await page.goto(url, wait_until="networkidle")
        print(f"Page loaded with status: {response.status}")
        
        print("Locating the file input element...")
        file_input = page.locator('input[type="file"]')
        
        print("Uploading PDF file...")
        await file_input.set_input_files(pdf_path)
        
        print("Waiting for upload UI to reflect state...")
        await page.wait_for_timeout(1000)
        
        print("Clicking Compress PDF button...")
        compress_button = page.get_by_text("Compress PDF", exact=True)
        await compress_button.click()
        
        print("Waiting for compression network response (max 60 seconds)...")
        try:
            # We wait for the specific 'Compression Complete!' text to appear on the screen
            await page.wait_for_selector('text="Compression Complete!"', timeout=60000)
            print("\n✅ E2E TEST PASSED: The frontend successfully communicated with the Render backend and the UI displayed the success state!")
        except Exception as e:
            print("\n❌ E2E TEST FAILED: The compression took more than 60 seconds or failed.")
            
            # Let's see if the alert popped up
            print("Checking page content for errors...")
            content = await page.content()
            if "Is the Python backend running" in content:
                print("Found the port 8000 error message in the DOM.")
            
        await browser.close()

if __name__ == "__main__":
    asyncio.run(run())
