# DeepFaceLab Workflow Editor - Service Management

This directory contains scripts to easily start, stop, and manage all services for the DeepFaceLab Workflow Editor.

## 🚀 Quick Start

### Using npm scripts (Recommended)
```bash
# Start all services
npm start

# Stop all services
npm stop

# Restart all services
npm restart

# Check service status
npm run status

# View logs
npm run logs backend    # Backend logs
npm run logs frontend   # Frontend logs
npm run logs electron   # Electron logs
```

### Using the shell script (macOS/Linux)
```bash
# Make executable (first time only)
chmod +x manage-services.sh

# Start all services
./manage-services.sh start

# Stop all services
./manage-services.sh stop

# Restart all services
./manage-services.sh restart

# Check status
./manage-services.sh status

# View logs
./manage-services.sh logs backend
./manage-services.sh logs frontend
./manage-services.sh logs electron
./manage-services.sh logs all
```

### Using the Node.js script (Cross-platform)
```bash
# Start all services
node manage-services.js start

# Stop all services
node manage-services.js stop

# Restart all services
node manage-services.js restart

# Check status
node manage-services.js status

# View logs
node manage-services.js logs backend
node manage-services.js logs frontend
node manage-services.js logs electron
```

## 📋 Services Managed

The scripts manage three main services:

1. **Backend (FastAPI)** - Port 8000
   - Python FastAPI server with WebSocket support
   - Handles workflow execution and API requests
   - Logs: `.backend.log`

2. **Frontend (Vite)** - Port 5173
   - React development server with hot reload
   - Serves the web interface
   - Logs: `.frontend.log`

3. **Electron App**
   - Desktop application wrapper
   - Connects to frontend development server
   - Logs: `.electron.log`

## 🔧 Configuration

### Shell Script Configuration
Edit `manage-services.sh` to modify:
- `PROJECT_DIR`: Path to the project directory
- `CONDA_ENV`: Conda environment name
- `CONDA_PATH`: Path to conda activation script
- `BACKEND_PORT`: Backend API port (default: 8000)
- `FRONTEND_PORT`: Frontend dev server port (default: 5173)

### Node.js Script Configuration
Edit `manage-services.js` to modify the `CONFIG` object:
- `projectDir`: Path to the project directory
- `condaEnv`: Conda environment name
- `condaPath`: Path to conda activation script
- `backendPort`: Backend API port (default: 8000)
- `frontendPort`: Frontend dev server port (default: 5173)

## 📁 Files Created

The scripts create several temporary files for process management:

- `.backend.pid` - Backend process ID
- `.frontend.pid` - Frontend process ID
- `.electron.pid` - Electron process ID
- `.backend.log` - Backend service logs
- `.frontend.log` - Frontend service logs
- `.electron.log` - Electron service logs

These files are automatically cleaned up when services are stopped.

## 🛠️ Troubleshooting

### Port Already in Use
If you get "port already in use" errors:
```bash
# Check what's using the port
lsof -i :8000  # Backend port
lsof -i :5173  # Frontend port

# Kill processes using the ports
pkill -f "python.*main.py"  # Kill backend
pkill -f "vite"             # Kill frontend
pkill -f "electron"         # Kill electron
```

### Services Won't Start
1. Check if conda environment exists:
   ```bash
   conda env list
   ```

2. Verify conda activation path:
   ```bash
   ls -la /Volumes/FileVault/MacApps/miniconda3/bin/activate
   ```

3. Check project directory path in the script

### Services Won't Stop
If services don't stop gracefully:
```bash
# Force kill all related processes
pkill -f "python.*main.py"
pkill -f "vite"
pkill -f "electron"

# Remove PID files
rm -f .backend.pid .frontend.pid .electron.pid
```

## 🔍 Monitoring

### Check Service Status
```bash
# Using npm
npm run status

# Using shell script
./manage-services.sh status

# Using Node.js script
node manage-services.js status
```

### View Live Logs
```bash
# Backend logs
npm run logs backend
# or
./manage-services.sh logs backend

# All logs (follow mode)
./manage-services.sh logs all
```

### Manual Service Checks
```bash
# Check if ports are listening
lsof -i :8000  # Backend
lsof -i :5173  # Frontend

# Check processes
ps aux | grep -E "(python|vite|electron)"
```

## 🚀 Development Workflow

### Typical Development Session
1. **Start all services:**
   ```bash
   npm start
   ```

2. **Make changes** to code (hot reload will handle frontend updates)

3. **Restart backend** if needed:
   ```bash
   npm restart
   ```

4. **Stop all services** when done:
   ```bash
   npm stop
   ```

### Debugging
- **Backend issues**: Check `.backend.log`
- **Frontend issues**: Check `.frontend.log` and browser console
- **Electron issues**: Check `.electron.log`

## 📝 Notes

- The scripts automatically handle conda environment activation
- All services start in the correct order (backend → frontend → electron)
- Process IDs are tracked for clean shutdown
- Logs are automatically rotated and cleaned up
- Cross-platform support via Node.js script
- Graceful shutdown handling (SIGINT/SIGTERM)

## 🤝 Contributing

To modify the service management scripts:

1. **Shell Script**: Edit `manage-services.sh`
2. **Node.js Script**: Edit `manage-services.js`
3. **npm Scripts**: Edit `package.json` scripts section

Test changes thoroughly before committing!
