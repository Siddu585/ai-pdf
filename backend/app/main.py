from fastapi import FastAPI, UploadFile, File, Form, HTTPException, WebSocket, WebSocketDisconnect, Request
from starlette.websockets import WebSocketState
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
import stripe
import tempfile
import os
import shutil
import json
import asyncio

from app.pdf_agent import run_iterative_pdf_compression, organize_pdf, extract_pdf_thumbnails, images_to_pdf, split_pdf, pdf_to_word, office_to_pdf, unlock_pdf, repair_pdf
from app.ocr_agent import extract_text_from_image
from app.chat_agent import chat_with_pdf
from app.image_agent import run_iterative_image_compression
from fastapi.concurrency import run_in_threadpool
import functools
import sys
import os

# ==========================================
# ENTERPRISE SCALING HACK
# Automatically hijack the Render single-threaded startup
# and respawn the server utilizing 4 parallel CPU processes
# without requiring the user to change the dashboard Start Command.
# ==========================================
if sys.platform != "win32" and "uvicorn" in os.path.basename(sys.argv[0]):
    if "--workers" not in sys.argv:
        print("🚀 [AUTO-SCALE] Single-core startup detected! Scaling up to 4 parallel CPU workers...", flush=True)
        # Re-execute the exact same python process, but append --workers 4
        args = [sys.executable]
        for arg in sys.argv:
            args.append(arg)
        args.extend(["--workers", "4"])
        os.execl(sys.executable, *args)

# Force unbuffered output globally for Render live logs visibility
print = functools.partial(print, flush=True)

app = FastAPI(title="PDF Ninja Intelligent Backend")

# Fully open CORS since this is a public stateless tool
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Paddle Configuration
PADDLE_API_KEY = os.getenv("PADDLE_API_KEY", "test_key")
PADDLE_WEBHOOK_SECRET = os.getenv("PADDLE_WEBHOOK_SECRET", "whsec_placeholder")
FRONTEND_URL = os.getenv("FRONTEND_URL", "https://www.swap-pdf.com")

class ConnectionManager:
    def __init__(self):
        # Maps room_id -> {"sender": WebSocket, "receiver": WebSocket}
        self.rooms: dict[str, dict[str, WebSocket]] = {}

    async def connect(self, websocket: WebSocket, room_id: str, client_type: str):
        await websocket.accept()
        if room_id not in self.rooms:
            self.rooms[room_id] = {}
        self.rooms[room_id][client_type] = websocket

    def disconnect(self, websocket: WebSocket, room_id: str, client_type: str):
        if room_id in self.rooms and client_type in self.rooms[room_id]:
            if self.rooms[room_id][client_type] == websocket:
                del self.rooms[room_id][client_type]
            if not self.rooms[room_id]:
                del self.rooms[room_id]

    def is_connected(self, websocket: WebSocket):
        return websocket.client_state == WebSocketState.CONNECTED

    async def send_message(self, message: dict, room_id: str, to_client: str):
        if room_id in self.rooms and to_client in self.rooms[room_id]:
            ws = self.rooms[room_id][to_client]
            if self.is_connected(ws):
                try:
                    await asyncio.wait_for(ws.send_json(message), timeout=2.0)
                except Exception:
                    pass

manager = ConnectionManager()

# --- MONETIZATION ENDPOINTS (Phase 8) ---

# --- MONETIZATION ENDPOINTS (Phase 8 - PADDLE) ---

@app.post("/api/paddle/webhook")
async def paddle_webhook(request: Request):
    # Paddle sends webhooks as JSON
    payload = await request.body()
    try:
        data = json.loads(payload)
        event_type = data.get("event_type")
        
        if event_type == "transaction.completed":
            print(f"Paddle Payment Successful: {data.get('data', {}).get('id')}")
            # Identify the user by the custom device_id passed in custom_data
            custom_data = data.get("data", {}).get("custom_data", {})
            user_key = custom_data.get("userKey")
            
            if user_key:
                tracker.make_pro(user_key)
                print(f"User {user_key} upgraded to Pro!")
            
        return {"status": "success"}
    except Exception as e:
        print(f"Webhook error: {str(e)}")
        return JSONResponse(content={"error": str(e)}, status_code=400)

# ----------------------------------------

# --- USAGE TRACKING (Hardened) ---
import hashlib
from datetime import datetime

class UsageTracker:
    def __init__(self):
        # Use absolute path to ensure reliability across CWD changes
        base_dir = os.path.dirname(os.path.abspath(__file__))
        self.usage_file = os.path.join(base_dir, "usage_log.json")
        self.pro_file = os.path.join(base_dir, "..", "pro_users.json") # One level up in backend/
        
        self.data = self._load(self.usage_file)
        self.pro_users = self._load(self.pro_file)
        
        # Hardcoded Fail-safe Whitelist (matches pro-whitelist.ts)
        self.HARDCODED_PRO = {
            "siddhantjangam33@gmail.com",
            "swapnali89narwade@gmail.com",
            "siddhantcil590@gmail.com",
            "siddhant.jangams@gmail.com"
        }

    def _load(self, filename):
        if os.path.exists(filename):
            try:
                with open(filename, "r") as f:
                    return json.load(f)
            except: 
                print(f"Error loading {filename}")
                return {}
        return {}

    def _save(self, filename, data):
        try:
            with open(filename, "w") as f:
                json.dump(data, f)
        except: pass

    def get_key(self, request: Request, device_id: str = ""):
        ip = request.client.host
        # Hash IP + Device ID to create a unique tracker
        return hashlib.sha256(f"{ip}:{device_id}".encode()).hexdigest()

    def check_and_record(self, key: str, device_id: str = "", email: str = ""):
        # Skip limits for Pro users (Check raw device ID or Email whitelist)
        email_norm = email.lower().strip() if email else ""
        if (device_id and device_id in self.pro_users) or \
           (email_norm and email_norm in self.pro_users) or \
           (email_norm and email_norm in self.HARDCODED_PRO):
            return True, 0
            
        today = datetime.now().strftime("%Y-%m-%d")
        if today not in self.data:
            self.data[today] = {}
        
        count = self.data[today].get(key, 0)
        limit = 5
        
        if count >= limit:
            return False, count
            
        self.data[today][key] = count + 1
        self._save(self.usage_file, self.data)
        return True, count + 1

    def make_pro(self, device_id: str):
        self.pro_users[device_id] = True
        self._save(self.pro_file, self.pro_users)

tracker = UsageTracker()

@app.get("/api/usage/status")
async def get_usage_status(request: Request, deviceId: str = "", email: str = ""):
    # Normalize email
    email_norm = email.lower().strip() if email else ""
    is_pro = (deviceId in tracker.pro_users if deviceId else False) or \
             (email_norm in tracker.pro_users if email_norm else False) or \
             (email_norm in tracker.HARDCODED_PRO if email_norm else False)
    
    if is_pro:
        return {"count": 0, "limit": 999, "remaining": 999, "is_pro": True}
        
    key = tracker.get_key(request, deviceId)
    today = datetime.now().strftime("%Y-%m-%d")
    count = tracker.data.get(today, {}).get(key, 0)
    limit = 5
    remaining = max(0, limit - count)
    return {"count": count, "limit": limit, "remaining": remaining, "is_pro": False}

@app.post("/api/usage/record")
async def record_usage_endpoint(request: Request, data: dict):
    deviceId = data.get("deviceId", "")
    email = data.get("email", "")
    key = tracker.get_key(request, deviceId)
    allowed, count = tracker.check_and_record(key, deviceId, email)
    limit = 5
    remaining = max(0, limit - count)
    return {"allowed": count <= limit, "count": count, "remaining": remaining}

@app.get("/api/turn")
async def get_turn_servers(request: Request, email: str = "", deviceId: str = ""):
    # Since the personal 500MB free trial requires manual activation, we autonomously 
    # utilize the Metered OpenRelay Project which provides 50GB of free TURN usage.
    # We allow this for EVERYONE to ensure "Turbo Drop" "Magic" (cross-network) 
    # works 100% of the time without requiring a manual login/Pro status on mobile.
    openRelayServers = [
        {
            "urls": "turn:openrelay.metered.ca:80",
            "username": "openrelayproject",
            "credential": "openrelayproject"
        },
        {
            "urls": "turn:openrelay.metered.ca:443",
            "username": "openrelayproject",
            "credential": "openrelayproject"
        },
        {
            "urls": "turn:openrelay.metered.ca:443?transport=tcp",
            "username": "openrelayproject",
            "credential": "openrelayproject"
        }
    ]

    return openRelayServers

# -------------------------------
@app.websocket("/ws/drop/{room_id}/{client_type}")
async def drop_websocket(websocket: WebSocket, room_id: str, client_type: str):
    print(f"WS Connect Attempt: Room={room_id}, Type={client_type}")
    await manager.connect(websocket, room_id, client_type)
    
    # Notify the other peer
    other = "receiver" if client_type == "sender" else "sender"
    await manager.send_message({"type": "peer-connected", "client_type": client_type}, room_id, other)
    
    try:
        while True:
            message = await websocket.receive()
            
            # 1. Handle Disconnect Message correctly for low-level receive()
            if message.get("type") == "websocket.disconnect":
                print(f"WS Disconnect Message: Room={room_id}, Type={client_type}")
                break

            # 2. Relay messages to the other client verbatim
            if room_id in manager.rooms and other in manager.rooms[room_id]:
                other_ws = manager.rooms[room_id][other]
                if manager.is_connected(other_ws):
                    # Debug logging for critical handshake steps
                    if "text" in message and message["text"]:
                        msg_text = message["text"]
                        if '"type"' in msg_text:
                            # Log the type of signal passing through
                            try:
                                msg_json = json.loads(msg_text)
                                print(f"Relaying Signal: {msg_json.get('type')} from {client_type} to {other} in {room_id}")
                            except: pass

                        try:
                            await asyncio.wait_for(other_ws.send_text(message["text"]), timeout=2.0)
                        except Exception as e:
                            print(f"Relay Error (text): {e}")
                    elif "bytes" in message and message["bytes"]:
                        try:
                            await asyncio.wait_for(other_ws.send_bytes(message["bytes"]), timeout=5.0)
                        except Exception as e:
                            print(f"Relay Error (bytes): {e}")
            else:
                # Other peer not yet connected, message dropped
                pass
    except (WebSocketDisconnect, RuntimeError) as e:
        print(f"WS Loop Exit: Room={room_id}, Type={client_type}, Reason={e}")
    finally:
        manager.disconnect(websocket, room_id, client_type)
        print(f"Peer Disconnected Cleaned Up: Room={room_id}, Type={client_type}")
        await manager.send_message({"type": "peer-disconnected", "client_type": client_type}, room_id, other)

@app.post("/api/compress-image")
async def compress_image(
    request: Request,
    file: UploadFile = File(...), 
    target_kb: int = Form(50),
    deviceId: str = Form("")
):
    key = tracker.get_key(request, deviceId)
    allowed, count = tracker.check_and_record(key, deviceId)
    if not allowed:
        raise HTTPException(status_code=402, detail="Daily limit reached. Upgrade to Pro for unlimited use!")
    
    try:
        # Save uploaded file to a temporary location with the CORRECT extension
        ext = os.path.splitext(file.filename)[1] or ".png"
        
        is_pro = deviceId in tracker.pro_users
        
        # If not Pro, we could enforce a 5MB limit here
        if not is_pro and getattr(file, 'size', 0) > 5 * 1024 * 1024:
             raise HTTPException(status_code=402, detail="File too large for free tier. Upgrade to Pro!")

        with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp:
            shutil.copyfileobj(file.file, tmp)
            tmp_path = tmp.name

        # Agentic iterative compression loop (offload to prevent blocking asyncio)
        optimized_path = await run_in_threadpool(run_iterative_image_compression, tmp_path, target_kb)
        
        return FileResponse(
            optimized_path, 
            media_type="image/jpeg", 
            filename=f"compressed-{file.filename}"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/compress-pdf")
async def compress_pdf(
    request: Request,
    file: UploadFile = File(...), 
    quality: int = Form(50),
    deviceId: str = Form("")
):
    key = tracker.get_key(request, deviceId)
    allowed, count = tracker.check_and_record(key, deviceId)
    if not allowed:
        raise HTTPException(status_code=402, detail="Daily limit reached. Upgrade to Pro for unlimited use!")
    try:
        ext = os.path.splitext(file.filename)[1] or ".pdf"
        with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp:
            shutil.copyfileobj(file.file, tmp)
            tmp_path = tmp.name

        # Offload sync PDF processing to threadpool
        optimized_path = await run_in_threadpool(run_iterative_pdf_compression, tmp_path, quality)
        
        return FileResponse(
            optimized_path, 
            media_type="application/pdf", 
            filename=f"compressed-{file.filename}"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/ocr")
async def ocr_scan(
    request: Request,
    file: UploadFile = File(...),
    deviceId: str = Form("")
):
    key = tracker.get_key(request, deviceId)
    allowed, count = tracker.check_and_record(key, deviceId)
    if not allowed:
        raise HTTPException(status_code=402, detail="Daily limit reached. Upgrade to Pro for unlimited use!")
    try:
        ext = os.path.splitext(file.filename)[1] or ".png"
        with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp:
            shutil.copyfileobj(file.file, tmp)
            tmp_path = tmp.name

        text = await run_in_threadpool(extract_text_from_image, tmp_path)
        return {"filename": file.filename, "extracted_text": text}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/chat-pdf")
async def chat_pdf(
    request: Request,
    file: UploadFile = File(...), 
    query: str = Form(...),
    deviceId: str = Form("")
):
    key = tracker.get_key(request, deviceId)
    allowed, count = tracker.check_and_record(key, deviceId)
    if not allowed:
        raise HTTPException(status_code=402, detail="Daily limit reached. Upgrade to Pro for unlimited use!")
    try:
        ext = os.path.splitext(file.filename)[1] or ".pdf"
        with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp:
            shutil.copyfileobj(file.file, tmp)
            tmp_path = tmp.name

        response = await run_in_threadpool(chat_with_pdf, tmp_path, query)
        return {"filename": file.filename, "query": query, "response": response}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/organize-pdf")
async def organize_pdf_endpoint(
    request: Request,
    file: UploadFile = File(...), 
    order: str = Form(...),
    deviceId: str = Form("")
):
    key = tracker.get_key(request, deviceId)
    allowed, count = tracker.check_and_record(key, deviceId)
    if not allowed:
        raise HTTPException(status_code=402, detail="Daily limit reached. Upgrade to Pro for unlimited use!")
    try:
        ext = os.path.splitext(file.filename)[1] or ".pdf"
        with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp:
            shutil.copyfileobj(file.file, tmp)
            tmp_path = tmp.name

        optimized_path = await run_in_threadpool(organize_pdf, tmp_path, order)
        
        return FileResponse(
            optimized_path, 
            media_type="application/pdf", 
            filename=f"organized-{file.filename}"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/extract-thumbnails")
async def extract_thumbnails_endpoint(
    request: Request,
    file: UploadFile = File(...),
    deviceId: str = Form("")
):
    key = tracker.get_key(request, deviceId)
    allowed, count = tracker.check_and_record(key, deviceId)
    if not allowed:
        raise HTTPException(status_code=402, detail="Daily limit reached. Upgrade to Pro for unlimited use!")
    try:
        ext = os.path.splitext(file.filename)[1] or ".pdf"
        with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp:
            shutil.copyfileobj(file.file, tmp)
            tmp_path = tmp.name

        thumbnails = await run_in_threadpool(extract_pdf_thumbnails, tmp_path)
        return {"thumbnails": thumbnails}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/image-to-pdf")
async def image_to_pdf_endpoint(
    request: Request,
    files: list[UploadFile] = File(...),
    deviceId: str = Form("")
):
    key = tracker.get_key(request, deviceId)
    allowed, count = tracker.check_and_record(key, deviceId)
    if not allowed:
        raise HTTPException(status_code=402, detail="Daily limit reached. Upgrade to Pro for unlimited use!")
    try:
        temp_paths = []
        for file in files:
            ext = os.path.splitext(file.filename)[1] or ".png"
            with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp:
                shutil.copyfileobj(file.file, tmp)
                temp_paths.append(tmp.name)
                
        compiled_pdf_path = await run_in_threadpool(images_to_pdf, temp_paths)
        
        return FileResponse(
            compiled_pdf_path, 
            media_type="application/pdf", 
            filename="combined-images.pdf"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/split-pdf")
async def split_pdf_endpoint(
    request: Request,
    file: UploadFile = File(...), 
    ranges: str = Form(...),
    deviceId: str = Form("")
):
    key = tracker.get_key(request, deviceId)
    allowed, count = tracker.check_and_record(key, deviceId)
    if not allowed:
        raise HTTPException(status_code=402, detail="Daily limit reached. Upgrade to Pro for unlimited use!")
    try:
        ext = os.path.splitext(file.filename)[1] or ".pdf"
        with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp:
            shutil.copyfileobj(file.file, tmp)
            tmp_path = tmp.name
            
        output_path = await run_in_threadpool(split_pdf, tmp_path, ranges)
        
        is_zip = output_path.endswith('.zip')
        media_type = "application/zip" if is_zip else "application/pdf"
        filename = f"split-{file.filename}"
        if is_zip:
            filename = filename.replace('.pdf', '') + '.zip'
            
        return FileResponse(
            output_path, 
            media_type=media_type, 
            filename=filename
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/pdf-to-word")
async def pdf_to_word_endpoint(
    request: Request,
    file: UploadFile = File(...),
    deviceId: str = Form("")
):
    key = tracker.get_key(request, deviceId)
    allowed, count = tracker.check_and_record(key, deviceId)
    if not allowed:
        raise HTTPException(status_code=402, detail="Daily limit reached. Upgrade to Pro for unlimited use!")
    try:
        ext = os.path.splitext(file.filename)[1] or ".pdf"
        with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp:
            shutil.copyfileobj(file.file, tmp)
            tmp_path = tmp.name
            
        output_path = await run_in_threadpool(pdf_to_word, tmp_path)
        
        return FileResponse(
            output_path, 
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document", 
            filename=file.filename.replace(".pdf", "") + ".docx"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/office-to-pdf")
async def office_to_pdf_endpoint(
    request: Request,
    file: UploadFile = File(...),
    deviceId: str = Form("")
):
    key = tracker.get_key(request, deviceId)
    allowed, count = tracker.check_and_record(key, deviceId)
    if not allowed:
        raise HTTPException(status_code=402, detail="Daily limit reached. Upgrade to Pro for unlimited use!")
    try:
        ext = os.path.splitext(file.filename)[1].lower() or ".docx"
        with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp:
            shutil.copyfileobj(file.file, tmp)
            tmp_path = tmp.name
            
        output_path = await run_in_threadpool(office_to_pdf, tmp_path)
        
        return FileResponse(
            output_path, 
            media_type="application/pdf", 
            filename=file.filename.replace(ext, ".pdf")
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/unlock-pdf")
async def unlock_pdf_endpoint(
    request: Request,
    file: UploadFile = File(...), 
    password: str = Form(""),
    deviceId: str = Form("")
):
    key = tracker.get_key(request, deviceId)
    allowed, count = tracker.check_and_record(key, deviceId)
    if not allowed:
        raise HTTPException(status_code=402, detail="Daily limit reached. Upgrade to Pro for unlimited use!")
    try:
        ext = os.path.splitext(file.filename)[1] or ".pdf"
        with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp:
            shutil.copyfileobj(file.file, tmp)
            tmp_path = tmp.name
            
        output_path = await run_in_threadpool(unlock_pdf, tmp_path, password)
        
        return FileResponse(
            output_path, 
            media_type="application/pdf", 
            filename=file.filename.replace(".pdf", "") + "_unlocked.pdf"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/repair-pdf")
async def repair_pdf_endpoint(
    request: Request,
    file: UploadFile = File(...),
    deviceId: str = Form("")
):
    key = tracker.get_key(request, deviceId)
    allowed, count = tracker.check_and_record(key, deviceId)
    if not allowed:
        raise HTTPException(status_code=402, detail="Daily limit reached. Upgrade to Pro for unlimited use!")
    try:
        ext = os.path.splitext(file.filename)[1] or ".pdf"
        with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp:
            shutil.copyfileobj(file.file, tmp)
            tmp_path = tmp.name
            
        output_path = await run_in_threadpool(repair_pdf, tmp_path)
        
        return FileResponse(
            output_path, 
            media_type="application/pdf", 
            filename=file.filename.replace(".pdf", "") + "_repaired.pdf"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
