import asyncio
import websockets
import json

async def test_ws():
    uri = "wss://ai-pdfai-pdf-backend.onrender.com/ws/drop/123456/sender"
    print(f"Connecting to {uri}...")
    try:
        async with websockets.connect(uri) as websocket:
            print("Connected successfully!")
            print("Listening for 5 seconds...")
            try:
                msg = await asyncio.wait_for(websocket.recv(), timeout=5.0)
                print(f"Received: {msg}")
            except asyncio.TimeoutError:
                print("No immediate message received, but connection is stable.")
            
    except Exception as e:
        print(f"WebSocket connection failed: {e}")

if __name__ == "__main__":
    asyncio.run(test_ws())
