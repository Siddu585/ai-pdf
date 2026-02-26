from fastapi import FastAPI, UploadFile, File, Form, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
import tempfile
import os
import shutil

from app.image_agent import run_iterative_image_compression
from app.pdf_agent import run_iterative_pdf_compression, organize_pdf, extract_pdf_thumbnails, images_to_pdf, split_pdf, pdf_to_word, office_to_pdf, unlock_pdf, repair_pdf
from app.ocr_agent import extract_text_from_image
from app.chat_agent import chat_with_pdf

app = FastAPI(title="PDF Ninja Intelligent Backend")

# Fully open CORS since this is a public stateless tool
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

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

    async def send_message(self, message: dict, room_id: str, to_client: str):
        if room_id in self.rooms and to_client in self.rooms[room_id]:
            ws = self.rooms[room_id][to_client]
            try:
                await ws.send_json(message)
            except Exception:
                pass

manager = ConnectionManager()

@app.websocket("/ws/drop/{room_id}/{client_type}")
async def drop_websocket(websocket: WebSocket, room_id: str, client_type: str):
    await manager.connect(websocket, room_id, client_type)
    
    # Notify the other peer
    other = "receiver" if client_type == "sender" else "sender"
    await manager.send_message({"type": "peer-connected", "client_type": client_type}, room_id, other)
    
    try:
        while True:
            # Native receive to handle both JSON text signaling and raw binary fallback chunks
            message = await websocket.receive()
            
            # Relay messages to the other client verbatim
            if room_id in manager.rooms and other in manager.rooms[room_id]:
                other_ws = manager.rooms[room_id][other]
                if "text" in message and message["text"]:
                    await other_ws.send_text(message["text"])
                elif "bytes" in message and message["bytes"]:
                    await other_ws.send_bytes(message["bytes"])
    except WebSocketDisconnect:
        manager.disconnect(websocket, room_id, client_type)
        await manager.send_message({"type": "peer-disconnected", "client_type": client_type}, room_id, other)

@app.post("/api/compress-image")
async def compress_image(
    file: UploadFile = File(...), 
    target_kb: int = Form(50)
):
    try:
        # Save uploaded file to a temporary location with the CORRECT extension
        await file.seek(0)
        content = await file.read()
        ext = os.path.splitext(file.filename)[1] or ".png"
        with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp:
            tmp.write(content)
            tmp_path = tmp.name

        # Agentic iterative compression loop
        optimized_path = run_iterative_image_compression(tmp_path, target_kb)
        
        return FileResponse(
            optimized_path, 
            media_type="image/jpeg", 
            filename=f"compressed-{file.filename}"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/compress-pdf")
async def compress_pdf(
    file: UploadFile = File(...), 
    quality: int = Form(50)
):
    try:
        await file.seek(0)
        content = await file.read()
        ext = os.path.splitext(file.filename)[1] or ".pdf"
        with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp:
            tmp.write(content)
            tmp_path = tmp.name

        optimized_path = run_iterative_pdf_compression(tmp_path, quality)
        
        return FileResponse(
            optimized_path, 
            media_type="application/pdf", 
            filename=f"compressed-{file.filename}"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/ocr")
async def ocr_scan(file: UploadFile = File(...)):
    try:
        await file.seek(0)
        content = await file.read()
        ext = os.path.splitext(file.filename)[1] or ".png"
        with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp:
            tmp.write(content)
            tmp_path = tmp.name

        text = extract_text_from_image(tmp_path)
        return {"filename": file.filename, "extracted_text": text}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/chat-pdf")
async def chat_pdf(file: UploadFile = File(...), query: str = Form(...)):
    try:
        await file.seek(0)
        content = await file.read()
        print(f"[DEBUG] Organize PDF ingested {len(content)} bytes")
        ext = os.path.splitext(file.filename)[1] or ".pdf"
        with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp:
            tmp.write(content)
            tmp_path = tmp.name

        response = chat_with_pdf(tmp_path, query)
        return {"filename": file.filename, "query": query, "response": response}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/organize-pdf")
async def organize_pdf_endpoint(file: UploadFile = File(...), order: str = Form(...)):
    try:
        await file.seek(0)
        content = await file.read()
        ext = os.path.splitext(file.filename)[1] or ".pdf"
        with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp:
            tmp.write(content)
            tmp_path = tmp.name

        optimized_path = organize_pdf(tmp_path, order)
        
        return FileResponse(
            optimized_path, 
            media_type="application/pdf", 
            filename=f"organized-{file.filename}"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/extract-thumbnails")
async def extract_thumbnails_endpoint(file: UploadFile = File(...)):
    try:
        await file.seek(0)
        content = await file.read()
        ext = os.path.splitext(file.filename)[1] or ".pdf"
        with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp:
            tmp.write(content)
            tmp_path = tmp.name

        thumbnails = extract_pdf_thumbnails(tmp_path)
        return {"thumbnails": thumbnails}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/image-to-pdf")
async def image_to_pdf_endpoint(files: list[UploadFile] = File(...)):
    try:
        temp_paths = []
        for file in files:
            await file.seek(0)
            content = await file.read()
            ext = os.path.splitext(file.filename)[1] or ".png"
            with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp:
                tmp.write(content)
                temp_paths.append(tmp.name)
                
        compiled_pdf_path = images_to_pdf(temp_paths)
        
        return FileResponse(
            compiled_pdf_path, 
            media_type="application/pdf", 
            filename="combined-images.pdf"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/split-pdf")
async def split_pdf_endpoint(file: UploadFile = File(...), ranges: str = Form(...)):
    try:
        await file.seek(0)
        content = await file.read()
        ext = os.path.splitext(file.filename)[1] or ".pdf"
        with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp:
            tmp.write(content)
            tmp_path = tmp.name
            
        output_path = split_pdf(tmp_path, ranges)
        
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
async def pdf_to_word_endpoint(file: UploadFile = File(...)):
    try:
        await file.seek(0)
        content = await file.read()
        ext = os.path.splitext(file.filename)[1] or ".pdf"
        with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp:
            tmp.write(content)
            tmp_path = tmp.name
            
        output_path = pdf_to_word(tmp_path)
        
        return FileResponse(
            output_path, 
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document", 
            filename=file.filename.replace(".pdf", "") + ".docx"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/office-to-pdf")
async def office_to_pdf_endpoint(file: UploadFile = File(...)):
    try:
        await file.seek(0)
        content = await file.read()
        ext = os.path.splitext(file.filename)[1].lower() or ".docx"
        with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp:
            tmp.write(content)
            tmp_path = tmp.name
            
        output_path = office_to_pdf(tmp_path)
        
        return FileResponse(
            output_path, 
            media_type="application/pdf", 
            filename=file.filename.replace(ext, ".pdf")
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/unlock-pdf")
async def unlock_pdf_endpoint(file: UploadFile = File(...), password: str = Form("")):
    try:
        await file.seek(0)
        content = await file.read()
        ext = os.path.splitext(file.filename)[1] or ".pdf"
        with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp:
            tmp.write(content)
            tmp_path = tmp.name
            
        output_path = unlock_pdf(tmp_path, password)
        
        return FileResponse(
            output_path, 
            media_type="application/pdf", 
            filename=file.filename.replace(".pdf", "") + "_unlocked.pdf"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/repair-pdf")
async def repair_pdf_endpoint(file: UploadFile = File(...)):
    try:
        await file.seek(0)
        content = await file.read()
        ext = os.path.splitext(file.filename)[1] or ".pdf"
        with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp:
            tmp.write(content)
            tmp_path = tmp.name
            
        output_path = repair_pdf(tmp_path)
        
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
