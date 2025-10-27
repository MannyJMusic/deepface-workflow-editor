/**
 * Configuration for start.js
 * Copy this file to start.config.local.js and customize for your environment
 * Or set environment variables: CONDA_PATH, CONDA_ENV, PYTHON_EXECUTABLE
 */

module.exports = {
    // Conda environment name
    condaEnv: process.env.CONDA_ENV || 'deepface-editor',
    
    // Path to conda's initialization script
    // Examples:
    //   Linux/Mac: ~/miniconda3/etc/profile.d/conda.sh
    //   Or find with: which conda -> then use: <conda_dir>/etc/profile.d/conda.sh
    condaPath: process.env.CONDA_PATH || null,
    
    // Python executable to use (if not using conda)
    pythonExecutable: process.env.PYTHON_EXECUTABLE || 'python3',
    
    // Service ports
    backendPort: process.env.BACKEND_PORT || 8001,
    frontendPort: process.env.FRONTEND_PORT || 5173,
};
