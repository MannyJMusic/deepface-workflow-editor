# Unified Startup Script Implementation

## Summary

Replaced multiple service management scripts with a single unified script (`start.js`) that manages both backend and frontend services.

## Changes Made

### 1. Created New Unified Script (`start.js`)
- Single Node.js script to manage all services
- Simpler than the previous implementations
- Better error handling and logging
- Cross-platform compatible

### 2. Updated `package.json` Scripts
Updated npm scripts to use the new unified script:
- `npm start` → Starts backend and frontend
- `npm run stop` → Stops all services
- `npm run restart` → Restarts all services
- `npm run status` → Shows status of all services

### 3. Removed Old Scripts
- `manage-services.js` (474 lines)
- `manage-services.sh` (353 lines)
- `dev-services.js` (265 lines)

**Total:** Removed 1,092 lines of redundant code

### 4. Created Documentation
- `STARTUP.md` - User guide for the startup script
- `UNIFIED_STARTUP.md` - This document

## How the New Script Works

### Backend Startup
```javascript
spawn('python3', ['api/main.py'], {
    cwd: backendDir,
    stdio: 'pipe'  // Logs to .backend.log
})
```

### Frontend Startup
```javascript
spawn('npm', ['run', 'dev:react'], {
    cwd: projectDir,
    stdio: 'pipe'  // Logs to .frontend.log
})
```

### Features
1. **Health Checks**: Uses HTTP requests to verify services are running
2. **PID Tracking**: Stores process IDs for graceful shutdown
3. **Auto-cleanup**: Removes PID files when services stop
4. **Port Detection**: Checks if ports are already in use
5. **Graceful Shutdown**: Sends SIGTERM before SIGKILL

## Usage Examples

```bash
# Start everything
npm start

# Check status
npm run status

# Stop everything
npm run stop

# Restart everything
npm run restart
```

## Service Ports

- **Backend**: http://localhost:8001
- **Frontend**: http://localhost:5173

## Log Files

- **Backend logs**: `.backend.log`
- **Frontend logs**: `.frontend.log`
- **PID files**: `.backend.pid`, `.frontend.pid`

## Advantages

1. **Simpler**: One script instead of three
2. **Maintainable**: Less code to maintain
3. **Reliable**: Better error handling
4. **Cross-platform**: Works on macOS, Linux, and Windows
5. **Cleaner**: Automatic cleanup of processes and files

## Migration Notes

If you had custom configurations in the old scripts:
- Backend port configuration is now in `start.js` (line 16)
- Frontend port configuration is now in `start.js` (line 17)
- Log file paths are in `start.js` (lines 22-25)

## Testing

To test the new script:

```bash
# Start services
npm start

# In another terminal, check status
npm run status

# Stop services
npm run stop
```

## Troubleshooting

If services don't start:
1. Check log files in the project root
2. Verify Python 3 and npm are installed
3. Check if ports 8001 and 5173 are available
4. Review the error messages in the log files
