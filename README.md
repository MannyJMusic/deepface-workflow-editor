# DeepFaceLab Workflow Editor

## Development Setup

### Prerequisites
- Node.js 18+
- Python 3.10+
- NVIDIA GPU with CUDA (recommended)

### Quick Start

1. Install dependencies:
   ```bash
   npm install
   cd backend && pip install -r requirements.txt
   ```

2. Start development servers:
   ```bash
   # Terminal 1: Backend
   cd backend && python api/main.py
   
   # Terminal 2: Frontend
   npm run dev
   ```

3. Open http://localhost:5173

### Building

```bash
npm run build
npm run package
```

## Project Structure

- `frontend/` - React + Electron frontend
- `backend/` - Python + FastAPI backend
- `backend/deepfacelab/` - DeepFaceLab modules (copy from DeepFaceLab_Linux)

## Key Features

- Node-based workflow editor (ComfyUI-style)
- Real-time progress updates
- GPU management and monitoring
- DeepFaceLab integration (extract, train, merge)
- Cross-platform desktop app

## API Endpoints

- `GET /api/workflow/` - List workflows
- `POST /api/execution/start/{id}` - Start execution
- `GET /api/gpu/status` - GPU status
- `WS /ws` - WebSocket for real-time updates
