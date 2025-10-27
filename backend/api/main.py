from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import socketio
import uvicorn
import os
import sys
from pathlib import Path

# Add the backend directory to Python path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from api.routes import workflow, execution, nodes, gpu, errors, presets, face_editor
from api.websocket import websocket_manager

app = FastAPI(
    title="DeepFaceLab Workflow Editor API",
    description="Backend API for the DeepFaceLab Workflow Editor",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routes
app.include_router(workflow.router, prefix="/api/workflow", tags=["workflow"])
app.include_router(execution.router, prefix="/api/execution", tags=["execution"])
app.include_router(nodes.router, prefix="/api/nodes", tags=["nodes"])
app.include_router(gpu.router, prefix="/api/gpu", tags=["gpu"])
app.include_router(errors.router, prefix="/api/errors", tags=["errors"])
app.include_router(presets.router, prefix="/api/presets", tags=["presets"])
app.include_router(face_editor.router, prefix="/api/face-editor", tags=["face-editor"])

# WebSocket endpoint
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket_manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            # Handle incoming WebSocket messages if needed
    except WebSocketDisconnect:
        websocket_manager.disconnect(websocket)

@app.get("/")
async def root():
    return {"message": "DeepFaceLab Workflow Editor API"}

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

if __name__ == "__main__":
    uvicorn.run(
        "api.main:app",
        host="127.0.0.1",
        port=8001,
        reload=True,
        log_level="info"
    )
