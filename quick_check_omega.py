import asyncio
import os
import json
from playwright.async_api import async_playwright

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        print("Navigating to http://localhost:3000/tools/instant-drop")
        await page.goto("http://localhost:3000/tools/instant-drop", wait_until="networkidle")
        
        # Wait for Omega to initialize
        await asyncio.sleep(5)
        
        print("\n--- [OMEGA] INSTANT HEALTH CHECK ---")
        health = await page.evaluate("window.__GET_OMEGA_HEALTH__()")
        print(json.dumps(health, indent=2))
        
        await browser.close()

if __name__ == "__main__":
    asyncio.run(run())
