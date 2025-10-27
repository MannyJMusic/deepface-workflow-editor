module.exports = {
    // Use system Python instead of conda
    condaEnv: null,
    condaPath: null,
    pythonExecutable: 'python3',
    
    // Backend configuration
    backendPort: 8001,
    frontendPort: 5173,
    
    // Development settings
    logLevel: 'info',
    autoRestart: true
};
