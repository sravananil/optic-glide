# backend/app/main_rag.py
# OpticGlide RAG Backend — CodeLlama + Apify
# AI: CodeLlama via Ollama. NO Gemini, NO GPT.

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path
import os

from app.brain_rag import RagBrain
from app.local_image_db import get_local_image_url

app = FastAPI(title="OpticGlide RAG — CodeLlama + Apify")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

images_dir = Path(os.path.join(os.path.dirname(__file__), "../images")).resolve()
images_dir.mkdir(parents=True, exist_ok=True)
app.mount("/images", StaticFiles(directory=str(images_dir)), name="images")
print(f"📂 Serving images from: {images_dir}")

sessions = {}


@app.get("/")
def root():
    return {"status": "OpticGlide RAG Running", "ai": "CodeLlama (Ollama)"}


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    session_id = str(id(websocket))
    brain = RagBrain()
    sessions[session_id] = {"room": "general", "brain": brain}
    print(f"✅ Connected: {session_id}")

    try:
        await websocket.send_json({
            "type": "connection",
            "message": "Connected — CodeLlama + Apify RAG ready",
        })

        while True:
            data = await websocket.receive_json()

            if data.get("type") == "room_select":
                room = data.get("room_type", "general")
                sessions[session_id]["room"] = room
                brain.set_room(room)
                await websocket.send_json({"type": "room_confirmed", "room": room})

            elif data.get("type") == "text":
                text = data.get("text", "").strip()
                if not text:
                    continue
                print(f"\n📝 '{text}'")
                room = sessions[session_id]["room"]
                result = brain.process(text, room)
                if result.get("confidence", 0) >= 50:
                    await websocket.send_json(result)
                else:
                    await websocket.send_json({"type": "low_confidence"})

            elif data.get("type") == "prefetch":
                topics = data.get("topics", [])
                if not topics:
                    await websocket.send_json({"type": "prefetch_result", "success": False})
                    continue
                # Local-only: no Apify fetch needed, just acknowledge
                brain.reload_content_db()
                await websocket.send_json({
                    "type": "prefetch_result", "success": True,
                    "topics": topics, "count": len(topics),
                })

            elif data.get("type") == "pause":
                brain.paused = data.get("paused", False)

            elif data.get("type") == "ping":
                await websocket.send_json({"type": "pong"})

            elif data.get("type") == "get_models":
                # NEW: Return available Ollama models and active model info
                models_info = brain.get_models()
                await websocket.send_json({
                    "type": "models_info",
                    **models_info
                })

    except WebSocketDisconnect:
        print(f"🔌 Disconnected: {session_id}")
    except Exception as e:
        print(f"❌ {e}")
        import traceback; traceback.print_exc()
    finally:
        sessions.pop(session_id, None)