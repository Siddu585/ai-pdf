import asyncio
import os
import sys
from playwright.async_api import async_playwright

async def run():
    async with async_playwright() as p:
        print("Launching Chromium browser...")
        browser = await p.chromium.launch(headless=True)
        
        # SENDER CONTEXT
        print("\n--- [SENDER] Initializing ---")
        sender_context = await browser.new_context()
        sender_page = await sender_context.new_page()
        
        sender_logs = []
        sender_page.on("console", lambda msg: sender_logs.append(f"[SENDER] [{msg.type}] {msg.text}"))
        
        # Create a dummy file
        dummy_file_path = os.path.join(os.getcwd(), "dummy_test_file.txt")
        with open(dummy_file_path, "w") as f:
            f.write("This is a 1MB test file for testing WebRTC stability." * 20000)
            
        print("[SENDER] Navigating to http://localhost:3000/tools/instant-drop")
        try:
            await sender_page.goto("http://localhost:3000/tools/instant-drop", wait_until="networkidle", timeout=30000)
        except Exception as e:
            print(f"[SENDER] Error loading page. Is server running? {e}")
            await browser.close()
            return
            
        print("[SENDER] Uploading dummy file...")
        file_input = sender_page.locator('input[type="file"]')
        await file_input.set_input_files(dummy_file_path)
        
        print("[SENDER] Waiting for Room ID to be generated...")
        room_element = sender_page.locator('div.text-3xl.font-mono.font-bold')
        await room_element.wait_for(state="visible", timeout=15000)
        room_id = await room_element.inner_text()
        room_id = room_id.strip()
        print(f"[SENDER] Room ID obtained: {room_id}")
        
        # RECEIVER CONTEXT
        print(f"\n--- [RECEIVER] Initializing for Room {room_id} ---")
        receiver_context = await browser.new_context()
        receiver_page = await receiver_context.new_page()
        
        receiver_logs = []
        receiver_page.on("console", lambda msg: receiver_logs.append(f"[RECEIVER] [{msg.type}] {msg.text}"))
        
        receiver_url = f"http://localhost:3000/tools/instant-drop?room={room_id}"
        print(f"[RECEIVER] Navigating to {receiver_url}")
        await receiver_page.goto(receiver_url, wait_until="networkidle", timeout=30000)
        
        print("\n--- Waiting for Transfer to Complete (Timeout: 45s) ---")
        try:
            # Wait for "Files Received" text specifically on the receiver page
            await receiver_page.wait_for_selector('text="Files Received"', timeout=45000)
            print("\n✅ E2E TEST PASSED: WebRTC Transfer completed successfully!")
            
        except Exception as e:
            print(f"\n[FAIL] E2E TEST FAILED or TIMED OUT: {e}")
            
        print("\n--- SENDER LOGS DUMP ---")
        for log in sender_logs:
            if any(k in log for k in ["WebRTC", "Sender", "Receiver", "error", "offer", "answer", "ice", "channel", "Generating", "TURN", "[SENDER]"]):
                print(log)
                
        print("\n--- RECEIVER LOGS DUMP ---")
        for log in receiver_logs:
            if any(k in log for k in ["WebRTC", "Sender", "Receiver", "error", "offer", "answer", "ice", "channel", "Generating", "TURN", "[RECEIVER]"]):
                print(log)
        
        if os.path.exists(dummy_file_path):
            os.remove(dummy_file_path)
            
        await browser.close()

if __name__ == "__main__":
    asyncio.run(run())
