# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

DeepFaceLab Workflow Editor is a modern node-based workflow editor for DeepFaceLab, built as a cross-platform Electron desktop application. The application uses a ComfyUI-style visual workflow editor where users can create, connect, and execute face-swapping workflows.

## Architecture

### Dual View Modes
The application supports two distinct view modes:
- **Workflow Mode**: Traditional node-based graph editor where users connect multiple nodes to create complex workflows
- **Single-Node Mode**: Focused view for working with standalone nodes (e.g., XSeg Editor, Advanced Face Editor) that don't require workflow connections

### Frontend (React + Electron)
- **React 18** with TypeScript for UI components
- **@xyflow/react** for the node-based workflow canvas
- **Zustand** for state management with persistence
- **Vite** as build tool and dev server
- **TailwindCSS** for styling
- Path aliases configured in `tsconfig.json`: `@/*` maps to `src/*`

Key stores:
- `workflowStore.ts`: Manages workflow state, nodes, edges, execution status, and view modes
- `notificationStore.ts`: UI notifications
- `themeStore.ts`: Theme preferences

### Backend (Python + FastAPI)
- **FastAPI** backend running on port 8001
- **WebSocket** support for real-time progress updates
- **Node execution system** with base class pattern
- Integration with **DeepFaceLab** modules in `backend/deepfacelab/`

Key components:
- `backend/api/main.py`: FastAPI application entry point
- `backend/api/routes/`: API endpoints (workflow, execution, nodes, gpu, errors, presets)
- `backend/api/websocket.py`: WebSocket manager for real-time updates
- `backend/nodes/`: Node implementations (all inherit from `BaseNode`)
- `backend/schemas/schemas.py`: Pydantic models for data validation

### Node System
All nodes inherit from `BaseNode` (in `backend/nodes/base_node.py`) which provides:
- Progress updates via WebSocket (`update_progress()`, `update_status()`)
- Parameter validation
- Input/output path management
- Logging to WebSocket clients

Node types include:
- Video input/output nodes
- Face extraction nodes (`extract_node.py`)
- Training nodes (`train_node.py`)
- Merge nodes (`merge_node.py`)
- XSeg editor node (`xseg_node.py`)
- Advanced face editor node (`advanced_face_editor_node.py`)
- Utility nodes (batch rename, image resize, face filter)

## Development Commands

### Quick Start
```bash
# Start both backend and frontend together
npm run start
# or
node start.js start

# Stop services
npm run stop

# Check status
npm run status

# Restart services
npm run restart
```

### Individual Services
```bash
# Backend only (FastAPI on port 8001)
cd backend && python api/main.py

# Frontend only (Vite dev server on port 5173)
npm run dev:react
# or npm run dev:frontend
```

### Development
```bash
# Install dependencies
npm install
cd backend && pip install -r requirements.txt

# Type checking
npm run type-check

# Linting
npm run lint

# Testing
npm run test
```

### Building
```bash
# Build frontend and electron
npm run build

# Build everything including Python bundle
npm run build:all

# Clean build artifacts
npm run build:clean

# Package for distribution
npm run package           # Current platform
npm run package:mac       # macOS
npm run package:win       # Windows
npm run package:linux     # Linux
npm run package:all       # All platforms
```

## Python Environment

The project supports conda environments. The service manager (`start.js`) auto-detects conda:
- Default conda env name: `deepface-editor`
- Can be configured in `start.config.local.js` or environment variables
- Fallback to system Python if conda not available

Setup conda environment:
```bash
node start.js setup-conda
```

## API Endpoints

### REST API (port 8001)
- `GET /api/workflow/` - List workflows
- `POST /api/execution/start/{id}` - Start workflow execution
- `GET /api/gpu/status` - GPU status
- `GET /api/nodes/definitions` - Get available node types
- `GET /api/presets/` - List presets for nodes

### WebSocket (port 8001)
- `WS /ws` - Real-time updates for:
  - Node status and progress
  - Execution updates
  - Log messages
  - Console output

WebSocket message types:
- `node_update`: Status/progress updates for specific nodes
- `execution_update`: Workflow execution state changes
- `log_message`: Node-specific log messages
- `console_log`: Console output from face editor operations

## WebSocket Flow

The backend sends updates to frontend via WebSocket:
1. Node starts: `send_node_update()` with status "running"
2. Progress updates: `send_node_update()` with progress percentage
3. Completion: `send_node_update()` with status "completed"
4. Errors: `send_node_update()` with status "error"

Frontend subscribes to node updates in the workflow store and components.

## Key Files to Understand

### Frontend
- `src/stores/workflowStore.ts`: Central state management for workflows, nodes, and execution
- `src/types/index.ts`: TypeScript type definitions for nodes, workflows, execution
- `src/components/SingleNodeView.tsx`: Single-node mode view
- `src/components/AdvancedFaceEditor/`: Face editor components with detection and grid views

### Backend
- `backend/api/main.py`: FastAPI app setup and route registration
- `backend/api/websocket.py`: WebSocket manager with subscription system
- `backend/nodes/base_node.py`: Base class for all node implementations
- `backend/api/routes/nodes.py`: Node-related API endpoints
- `backend/api/routes/execution.py`: Workflow execution endpoints

## Important Implementation Details

### Node Status Flow
1. Nodes start with status `idle`
2. During execution: `running` → progress updates → `completed` or `error`
3. Status is tracked in both frontend (Zustand store) and backend (BaseNode)

### DeepFaceLab Integration
- DeepFaceLab modules are in `backend/deepfacelab/`
- Nodes call DeepFaceLab functions for face extraction, training, and merging
- The `DeepFaceLab_Linux` directory should contain the full DFL installation

### Electron Integration
- Electron main process in `electron/` directory
- File dialogs for saving/loading workflows use `electronAPI` (exposed via context bridge)
- Fallback to browser APIs when running in web mode

### Service Management
The `start.js` script provides unified service management:
- Auto-detects and activates conda environments
- Health checking on ports before starting
- PID file tracking (`.backend.pid`, `.frontend.pid`)
- Log file management (`.backend.log`, `.frontend.log`)
- Graceful shutdown handling

## Docker Deployment

Per user configuration in `~/.claude/CLAUDE.md`, use Docker for deploying and running this application when containerization is needed.
