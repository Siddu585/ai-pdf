import asyncio
import os
import re
from playwright.async_api import async_playwright

async def run():
    async with async_playwright() as p:
        print("Launching Chromium browser for NMI test...")
        browser = await p.chromium.launch(headless=True)
        
        # SENDER CONTEXT (Unthrottled for Peak Performance Baseline)
        sender_context = await browser.new_context()
        sender_page = await sender_context.new_page()
        
        sender_logs = []
        def on_sender_console(msg):
            text = msg.text
            # Strip CSS console styling markers like %c
            clean_text = text.replace('%c', '')
            sender_logs.append(clean_text)
            if "MB/s" in clean_text or "SPEED" in clean_text or "Stall" in clean_text or "Scale" in clean_text or "Watermark" in clean_text:
                try:
                    print(f"[SPEED] {clean_text}")
                except UnicodeEncodeError:
                    print(f"[SPEED] {clean_text.encode('ascii', 'replace').decode('ascii')}")

        sender_page.on("console", on_sender_console)
        
        print("[NMI] Navigating Sender to http://localhost:3000/tools/instant-drop")
        await sender_page.goto("http://localhost:3000/tools/instant-drop", wait_until="networkidle", timeout=30000)
        
        print("[NMI] Triggering Autonomous 150MB Stress Test (__RUN_STRESS_TEST__)")
        await sender_page.evaluate('window.__RUN_STRESS_TEST__(1, 150)')
        
        # Wait a moment for React state to update and Room ID to render
        await asyncio.sleep(2)
        content = await sender_page.content()
        
        # Regex to find the 6-digit Room ID in the DOM
        matches = re.findall(r'\b\d{6}\b', content)
        if not matches:
            print("[FAIL] Could not find Room ID in Sender DOM!")
            return
        
        room_id = matches[0]
        print(f"[NMI] Captured Room ID: {room_id}")

        # RECEIVER CONTEXT (Unthrottled)
        receiver_context = await browser.new_context()
        receiver_page = await receiver_context.new_page()
        
        receiver_logs = []
        receiver_page.on("console", lambda msg: receiver_logs.append(msg.text))

        receiver_url = f"http://localhost:3000/tools/instant-drop?room={room_id}"
        print(f"[NMI] Navigating Receiver to {receiver_url}")
        await receiver_page.goto(receiver_url, wait_until="networkidle", timeout=30000)
        
        print("\n--- Transferring 150MB Payload (Unthrottled Baseline, Timeout: 300s) ---")
        try:
            # We wait for the Transferring screen to disappear, or for "Done"
            await receiver_page.wait_for_selector('text="Done" | text="Files Received" | text="Save"', timeout=300000)
            print("\n✅ [NMI] E2E TEST PASSED: WebRTC Transfer completed successfully!")
        except Exception as e:
            print(f"\n[FAIL] E2E TEST FAILED or TIMED OUT: {e}".encode('ascii', 'replace').decode('ascii'))
            for l in sender_logs[-30:]: print(f"SENDER: {l}".encode('ascii', 'replace').decode('ascii'))
            for l in receiver_logs[-30:]: print(f"RECEIVER: {l}".encode('ascii', 'replace').decode('ascii'))
            
        print("\n--- Test Finished ---")
        await browser.close()

if __name__ == "__main__":
    asyncio.run(run())
