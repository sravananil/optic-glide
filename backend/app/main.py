# backend/app/main.py

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path
from app.brain import OpticGlideBrain

app = FastAPI(title="OpticGlide AI Backend")

# CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve images - absolute path from workspace root
import os
import sys

# Get workspace root (two levels up from this file)
workspace_root = Path(__file__).parent.parent.parent
images_dir = workspace_root / "images"

if not images_dir.exists():
    print(f"⚠️  Images directory not found at {images_dir}")
    print(f"   Looking in current working directory...")
    cwd_images = Path.cwd() / "images"
    if cwd_images.exists():
        images_dir = cwd_images
        print(f"   Found at: {images_dir}")

images_dir.mkdir(parents=True, exist_ok=True)
app.mount("/images", StaticFiles(directory=str(images_dir)), name="images")
print(f"📂 Serving images from: {images_dir}")
print(f"   - Anatomy folder: {images_dir / 'doctor' / 'anatomy'}")

# Debug: List available images
anatomy_dir = images_dir / "doctor" / "anatomy"
if anatomy_dir.exists():
    images_files = list(anatomy_dir.glob("*.*"))
    print(f"   - Found {len(images_files)} anatomy images:")
    for img in images_files:
        print(f"     • {img.name}")

# Initialize brain
brain = OpticGlideBrain()

# Active sessions
sessions = {}

@app.get("/")
def root():
    return {
        "status": "OpticGlide Backend Running",
        "model": brain.ai.model
    }

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    session_id = str(id(websocket))
    sessions[session_id] = {"room": "general"}
    
    print(f"✅ WebSocket connected: {session_id}")
    
    try:
        await websocket.send_json({
            "type": "connection",
            "message": "Connected to OpticGlide AI"
        })
        
        while True:
            data = await websocket.receive_json()
            
            # Room selection
            if data.get("type") == "room_select":
                sessions[session_id]["room"] = data.get("room_type", "general")
                print(f"🏠 Room: {sessions[session_id]['room']}")
            
            # Text from browser speech recognition
            elif data.get("type") == "text":
                text = data.get("text", "").strip()
                if not text:
                    continue
                
                print(f"\n📝 User: '{text}'")
                
                room = sessions[session_id]["room"]
                result = brain.process(text, room)
                
                # Send if confident enough
                if result.get("confidence", 0) >= 50:
                    await websocket.send_json(result)
                else:
                    print(f"⚠️ Low confidence, skipped")
            
            # Label cycling (when user clicks arrow)
            elif data.get("type") == "cycle_label":
                # Frontend handles this locally
                pass
            
            # Ping
            elif data.get("type") == "ping":
                await websocket.send_json({"type": "pong"})
    
    except WebSocketDisconnect:
        print(f"🔌 Disconnected: {session_id}")
    except Exception as e:
        print(f"❌ Error: {e}")
    finally:
        sessions.pop(session_id, None)