import asyncio
from playwright.async_api import async_playwright

async def run():
    async with async_playwright() as p:
        print("Launching local Chromium browser for WebRTC testing...")
        
        # We need to grant permissions for clipboard/downloads if necessary, and bypass headless WebRTC restrictions
        browser = await p.chromium.launch(
            headless=True,
            args=[
                '--use-fake-ui-for-media-stream',
                '--disable-web-security',
                '--allow-file-access-from-files',
            ]
        )
        context = await browser.new_context(
            permissions=["clipboard-read", "clipboard-write"]
        )
        
        page = await context.new_page()
        
        # Listen to console logs
        page.on("console", lambda msg: print(f"Browser Log: {msg.text}"))
        
        # Mock Pro status and TURN API to ensure high-speed relay is used for testing
        await page.route("**/api/usage/status*", lambda route: route.fulfill(
            status=200,
            content_type="application/json",
            body='{"count": 0, "limit": 999, "remaining": 999, "is_pro": true}'
        ))
        
        # Mock TURN API to return real credentials (bypassing whitelist check for the bot)
        # We'll actually let the bot try to fetch it, but if it fails we could mock a 200.
        # For now, just ensuring is_pro is true is enough to trigger the fetch.
        
        room_code = "646431"
        # Try both with and without www if needed, but swap-pdf.com is the primary
        url = f"https://swap-pdf.com/tools/instant-drop?room={room_code}"
        print(f"Navigating to {url}...")
        
        try:
            await page.goto(url, wait_until="networkidle", timeout=60000)
        except Exception as e:
            print(f"Failed to load with primary URL: {e}. Trying WWW...")
            url_www = f"https://www.swap-pdf.com/tools/instant-drop?room={room_code}"
            await page.goto(url_www, wait_until="networkidle", timeout=60000)
        
        print("Joined room as receiver. Waiting for sender to initiate transfer...")
        
        peak_speed = 0.0
        
        # Wait for either completion or stall
        for i in range(120): # wait up to 2 minutes
            await asyncio.sleep(1)
            
            # Check for speed indicator
            try:
                speed_element = await page.query_selector('.bg-emerald-500\\/10')
                if speed_element:
                    text = await speed_element.inner_text()
                    parts = text.split(" ")
                    if len(parts) >= 2:
                        try:
                            speed = float(parts[1])
                            if speed > peak_speed:
                                peak_speed = speed
                        except ValueError:
                            pass
            except Exception:
                pass
                
            # Check for completion
            content = await page.content()
            if "Transfer Complete!" in content or "All Files Received!" in content or "Download as ZIP" in content:
                print(f"[PASSED] TRANSFER COMPLETE! Peak Speed logged: {peak_speed} MB/s")
                await browser.close()
                return
                
            if i % 10 == 0:
                print(f"Still waiting... {i} seconds elapsed. Peak speed so far: {peak_speed} MB/s")
                
        print(f"[FAILED] TIMEOUT or STALL. Peak speed seen: {peak_speed} MB/s")
        await browser.close()

if __name__ == '__main__':
    asyncio.run(run())
