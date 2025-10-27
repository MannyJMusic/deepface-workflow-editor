# Starting the DeepFaceLab Workflow Editor

This project uses a unified startup script to manage both the backend and frontend services.

## Quick Start

### Start Services

```bash
npm start
```

or

```bash
node start.js start
```

This will:
1. Start the FastAPI backend on port 8001
2. Start the Vite frontend dev server on port 5173

### Stop Services

```bash
npm run stop
```

or

```bash
node start.js stop
```

### Check Status

```bash
npm run status
```

or

```bash
node start.js status
```

### Restart Services

```bash
npm run restart
```

or

```bash
node start.js restart
```

## How It Works

The `start.js` script:

- **Backend**: Runs `python3 api/main.py` in the `backend` directory
  - Listens on port 8001
  - Logs to `.backend.log`
  - PID stored in `.backend.pid`

- **Frontend**: Runs `npm run dev:react`
  - Listens on port 5173
  - Logs to `.frontend.log`
  - PID stored in `.frontend.pid`

## Troubleshooting

### Services fail to start

Check the log files:
- Backend logs: `.backend.log`
- Frontend logs: `.frontend.log`

### Ports already in use

If a service is already running, the script will detect it and reuse it.

To force stop all services:
```bash
npm run stop
```

### Backend won't start

#### Option 1: Using Conda Environment (Recommended)

1. Find your conda installation path:
   ```bash
   which conda
   # or
   conda info --base
   ```

2. Set the conda path in your environment:
   ```bash
   export CONDA_PATH="~/miniconda3/etc/profile.d/conda.sh"  # Adjust path as needed
   export CONDA_ENV="deepface-editor"
   ```

3. Or create a local config file:
   ```bash
   cp start.config.js start.config.local.js
   # Edit start.config.local.js and set your conda path
   ```

#### Option 2: Using System Python

Install dependencies in your system Python:
```bash
cd backend
pip3 install -r ../requirements.txt
```

### Frontend won't start

Make sure you have installed npm dependencies:

```bash
npm install
```

## Service URLs

Once started, access the services at:

- **Backend API**: http://localhost:8001
- **Frontend**: http://localhost:5173

## Stopping Services

You can stop services by:

1. Using the stop command: `npm run stop`
2. Pressing `Ctrl+C` in the terminal where you started the services
3. Killing processes manually (not recommended)

The script will automatically clean up all processes when stopped.
