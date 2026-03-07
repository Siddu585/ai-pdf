import asyncio
from playwright.async_api import async_playwright
import os

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        
        print("Navigating to live Image Compressor tool...")
        await page.goto('https://www.swap-pdf.com/tools/compress-image')
        await page.wait_for_load_state('networkidle')
        
        # Create a dummy image
        print("Creating dummy image...")
        os.system('fsutil file createnew dummy_image.jpg 1024000') # 1MB dummy file
        
        # We need a real image for image processing validation
        from PIL import Image
        img = Image.new('RGB', (1000, 1000), color='red')
        img.save('dummy_image.jpg')
        
        print("Uploading dummy image...")
        await page.set_input_files('input[type="file"]', 'dummy_image.jpg')
        
        print("Clicking Start Compressing...")
        # Find the button by text
        await page.click('button:has-text("Start Compressing")')
        
        print("Waiting for compression to finish or error...")
        try:
            # Wait for either the success state or an alert dialog
            # Playwright handles alerts via an event listener
            async def handle_dialog(dialog):
                print(f"Alert received: {dialog.message}")
                await dialog.dismiss()
                
            page.on("dialog", handle_dialog)
            
            # Wait for the "Download Image" button to appear (success)
            # or wait 10 seconds for the alert to pop up (failure)
            await page.wait_for_selector('button:has-text("Download Image")', timeout=10000)
            print("Compression succeeded! 'Download Image' button appeared.")
        except Exception as e:
            print(f"Exception while waiting: {e}")
            
        await browser.close()
        
        if os.path.exists('dummy_image.jpg'):
            os.remove('dummy_image.jpg')

if __name__ == '__main__':
    asyncio.run(main())
