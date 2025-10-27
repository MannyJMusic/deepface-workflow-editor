#!/usr/bin/env node

/**
 * Unified Service Manager for DeepFaceLab Workflow Editor
 * Simple script to start and stop backend and frontend services
 */

const { spawn, exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');
const os = require('os');

// Load configuration
let userConfig = {};
try {
    if (fs.existsSync(path.join(__dirname, 'start.config.local.js'))) {
        userConfig = require('./start.config.local.js');
    } else if (fs.existsSync(path.join(__dirname, 'start.config.js'))) {
        userConfig = require('./start.config.js');
    }
} catch (err) {
    // Config file not available or has errors, use defaults
}

// Configuration
const CONFIG = {
    projectDir: __dirname,
    backendPort: userConfig.backendPort || 8001,
    frontendPort: userConfig.frontendPort || 5173,
    backendDir: path.join(__dirname, 'backend'),
    // Python configuration
    pythonExecutable: process.env.PYTHON_EXECUTABLE || userConfig.pythonExecutable || 'python3',
    condaEnv: process.env.CONDA_ENV || userConfig.condaEnv || 'deepface-editor',
    condaPath: process.env.CONDA_PATH || userConfig.condaPath || null,
    pidFiles: {
        backend: path.join(__dirname, '.backend.pid'),
        frontend: path.join(__dirname, '.frontend.pid')
    },
    logFiles: {
        backend: path.join(__dirname, '.backend.log'),
        frontend: path.join(__dirname, '.frontend.log')
    }
};

// Colors for console output
const colors = {
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    reset: '\x1b[0m'
};

// Utility functions
function log(message, color = 'blue') {
    console.log(`${colors[color]}[INFO]${colors.reset} ${message}`);
}

function success(message) {
    console.log(`${colors.green}[SUCCESS]${colors.reset} ${message}`);
}

function warning(message) {
    console.log(`${colors.yellow}[WARNING]${colors.reset} ${message}`);
}

function error(message) {
    console.log(`${colors.red}[ERROR]${colors.reset} ${message}`);
}

// Check if port is in use
function checkPort(port) {
    return new Promise((resolve) => {
        const command = os.platform() === 'win32' 
            ? `netstat -an | findstr :${port}`
            : `lsof -Pi :${port} -sTCP:LISTEN -t`;
        
        exec(command, (err, stdout) => {
            resolve(!err && stdout.trim().length > 0);
        });
    });
}

// Auto-detect conda environment
async function detectCondaEnvironment() {
    return new Promise((resolve) => {
        // First, check if we're already in a conda environment
        if (process.env.CONDA_DEFAULT_ENV) {
            log(`Already in conda environment: ${process.env.CONDA_DEFAULT_ENV}`);
            resolve({
                condaPath: process.env.CONDA_PREFIX ? path.join(process.env.CONDA_PREFIX, '..', '..', 'bin', 'conda') : null,
                condaEnv: process.env.CONDA_DEFAULT_ENV,
                isActive: true
            });
            return;
        }

        // Try to find conda in common locations
        const condaPaths = [
            '/opt/homebrew/bin/conda',
            '/usr/local/bin/conda',
            '/usr/bin/conda',
            path.join(os.homedir(), 'miniconda3', 'bin', 'conda'),
            path.join(os.homedir(), 'anaconda3', 'bin', 'conda'),
            path.join(os.homedir(), 'conda', 'bin', 'conda')
        ];

        // Check if conda command exists
        exec('which conda', (err, stdout) => {
            if (!err && stdout.trim()) {
                const condaPath = stdout.trim();
                log(`Found conda at: ${condaPath}`);
                
                // Check if the target environment exists
                exec(`conda env list --json`, (envErr, envStdout) => {
                    if (!envErr) {
                        try {
                            const envList = JSON.parse(envStdout);
                            const targetEnv = CONFIG.condaEnv;
                            
                            if (envList.envs && envList.envs.some(env => env.includes(targetEnv))) {
                                log(`Found conda environment: ${targetEnv}`);
                                resolve({
                                    condaPath: condaPath,
                                    condaEnv: targetEnv,
                                    isActive: false
                                });
                            } else {
                                warning(`Conda environment '${targetEnv}' not found. Available environments:`);
                                envList.envs.forEach(env => warning(`  - ${env}`));
                                
                                // Offer to create the environment
                                log(`Would you like to create the '${targetEnv}' environment?`);
                                log(`Run: conda create -n ${targetEnv} python=3.9 -y`);
                                log(`Then: conda activate ${targetEnv} && pip install -r requirements.txt`);
                                
                                resolve(null);
                            }
                        } catch (parseErr) {
                            warning('Could not parse conda environment list');
                            resolve(null);
                        }
                    } else {
                        warning('Could not list conda environments');
                        resolve(null);
                    }
                });
            } else {
                // Try to find conda in common paths
                let foundConda = false;
                for (const condaPath of condaPaths) {
                    if (fs.existsSync(condaPath)) {
                        log(`Found conda at: ${condaPath}`);
                        resolve({
                            condaPath: condaPath,
                            condaEnv: CONFIG.condaEnv,
                            isActive: false
                        });
                        foundConda = true;
                        break;
                    }
                }
                
                if (!foundConda) {
                    warning('Conda not found. Will use system Python.');
                    resolve(null);
                }
            }
        });
    });
}

// Create conda environment if it doesn't exist
async function createCondaEnvironment(condaPath, envName) {
    return new Promise((resolve) => {
        log(`Creating conda environment: ${envName}`);
        const createCmd = `source ${condaPath} && conda create -n ${envName} python=3.9 -y`;
        
        exec(createCmd, (err, stdout, stderr) => {
            if (err) {
                error(`Failed to create conda environment: ${err.message}`);
                resolve(false);
            } else {
                success(`Conda environment '${envName}' created successfully`);
                resolve(true);
            }
        });
    });
}

// Install dependencies in conda environment
async function installCondaDependencies(condaPath, envName) {
    return new Promise((resolve) => {
        log(`Installing dependencies in conda environment: ${envName}`);
        const installCmd = `source ${condaPath} && conda activate ${envName} && pip install -r requirements.txt`;
        
        exec(installCmd, { cwd: CONFIG.projectDir }, (err, stdout, stderr) => {
            if (err) {
                error(`Failed to install dependencies: ${err.message}`);
                resolve(false);
            } else {
                success(`Dependencies installed successfully in '${envName}'`);
                resolve(true);
            }
        });
    });
}

// Check if service is healthy
function checkHealth(port) {
    return new Promise((resolve) => {
        const req = http.get(`http://localhost:${port}/health`, (res) => {
            resolve(res.statusCode === 200);
        });
        req.on('error', () => resolve(false));
        req.setTimeout(2000, () => {
            req.destroy();
            resolve(false);
        });
    });
}

// Kill process by PID file
function killByPidFile(pidFile, serviceName) {
    return new Promise((resolve) => {
        if (!fs.existsSync(pidFile)) {
            resolve();
            return;
        }

        const pid = fs.readFileSync(pidFile, 'utf8').trim();
        
        exec(`kill -0 ${pid} 2>/dev/null`, (err) => {
            if (err) {
                fs.unlinkSync(pidFile);
                resolve();
                return;
            }

            log(`Stopping ${serviceName} (PID: ${pid})...`);
            
            exec(`kill ${pid}`, () => {
                setTimeout(() => {
                    exec(`kill -0 ${pid} 2>/dev/null`, (checkErr) => {
                        if (!checkErr) {
                            exec(`kill -9 ${pid}`);
                        }
                        success(`${serviceName} stopped`);
                        fs.unlinkSync(pidFile);
                        resolve();
                    });
                }, 2000);
            });
        });
    });
}

// Start backend service
async function startBackend() {
    log('Starting Backend (FastAPI)...');
    
    // Check if backend is already running and healthy
    if (await checkPort(CONFIG.backendPort)) {
        if (await checkHealth(CONFIG.backendPort)) {
            success(`Backend is already running on port ${CONFIG.backendPort}`);
            return true;
        }
    }

    const logStream = fs.createWriteStream(CONFIG.logFiles.backend, { flags: 'a' });
    logStream.write(`\n=== Starting at ${new Date().toISOString()} ===\n`);
    
    // Auto-detect conda environment
    log('Detecting conda environment...');
    const condaInfo = await detectCondaEnvironment();
    
    // Prepare command and environment
    let pythonProcess;
    let pythonCmd = CONFIG.pythonExecutable;
    
    if (condaInfo) {
        if (condaInfo.isActive) {
            log(`Using active conda environment: ${condaInfo.condaEnv}`);
            pythonProcess = spawn(pythonCmd, ['api/main.py'], {
                cwd: CONFIG.backendDir,
                stdio: ['ignore', 'pipe', 'pipe'],
                detached: false,
                env: { ...process.env }
            });
        } else {
            log(`Activating conda environment: ${condaInfo.condaEnv}`);
            const condaCmd = `source ${condaInfo.condaPath} && conda activate ${condaInfo.condaEnv} && cd ${CONFIG.backendDir} && ${pythonCmd} api/main.py`;
            pythonProcess = spawn('bash', ['-c', condaCmd], {
                cwd: CONFIG.backendDir,
                stdio: ['ignore', 'pipe', 'pipe'],
                detached: false,
                env: { ...process.env }
            });
        }
    } else {
        // Use system Python
        warning('Conda not found or environment not available. Using system Python.');
        warning('For full functionality, please set up conda environment as described in SETUP_CONDA.md');
        pythonProcess = spawn(pythonCmd, ['api/main.py'], {
            cwd: CONFIG.backendDir,
            stdio: ['ignore', 'pipe', 'pipe'],
            detached: false,
            env: { ...process.env }
        });
    }

    pythonProcess.stdout.pipe(logStream);
    pythonProcess.stderr.pipe(logStream);

    // Save PID
    fs.writeFileSync(CONFIG.pidFiles.backend, pythonProcess.pid.toString());

    // Wait for backend to start
    log('Waiting for backend to start...');
    for (let i = 0; i < 30; i++) {
        if (await checkHealth(CONFIG.backendPort)) {
            success(`Backend started successfully on port ${CONFIG.backendPort}`);
            return true;
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    error('Backend failed to start within 30 seconds');
    error('Check logs at: ' + CONFIG.logFiles.backend);
    return false;
}

// Start frontend service
async function startFrontend() {
    log('Starting Frontend (Vite)...');
    
    if (await checkPort(CONFIG.frontendPort)) {
        success(`Frontend already running on port ${CONFIG.frontendPort}`);
        return true;
    }

    const logStream = fs.createWriteStream(CONFIG.logFiles.frontend, { flags: 'a' });
    logStream.write(`\n=== Starting at ${new Date().toISOString()} ===\n`);
    
    const npmProcess = spawn('npm', ['run', 'dev:react'], {
        cwd: CONFIG.projectDir,
        stdio: ['ignore', 'pipe', 'pipe'],
        detached: false
    });

    npmProcess.stdout.pipe(logStream);
    npmProcess.stderr.pipe(logStream);

    // Save PID
    fs.writeFileSync(CONFIG.pidFiles.frontend, npmProcess.pid.toString());

    // Wait for frontend to start
    log('Waiting for frontend to start...');
    for (let i = 0; i < 30; i++) {
        if (await checkPort(CONFIG.frontendPort)) {
            success(`Frontend started successfully on port ${CONFIG.frontendPort}`);
            return true;
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    error('Frontend failed to start within 30 seconds');
    error('Check logs at: ' + CONFIG.logFiles.frontend);
    return false;
}

// Start all services
async function start() {
    log('Starting DeepFaceLab Workflow Editor...');
    console.log('='.repeat(50));

    try {
        // Start backend first
        if (!(await startBackend())) {
            error('Failed to start backend');
            process.exit(1);
        }

        // Start frontend
        if (!(await startFrontend())) {
            error('Failed to start frontend');
            process.exit(1);
        }

        console.log('='.repeat(50));
        success('All services started successfully!');
        console.log('');
        console.log('Services running:');
        console.log(`  • Backend API: http://localhost:${CONFIG.backendPort}`);
        console.log(`  • Frontend: http://localhost:${CONFIG.frontendPort}`);
        console.log('');
        console.log('Logs:');
        console.log(`  • Backend: ${CONFIG.logFiles.backend}`);
        console.log(`  • Frontend: ${CONFIG.logFiles.frontend}`);
        console.log('');
        console.log('To stop services: npm run stop');
        console.log('Press Ctrl+C to stop all services');

    } catch (err) {
        error(`Failed to start services: ${err.message}`);
        process.exit(1);
    }
}

// Stop all services
async function stop() {
    log('Stopping DeepFaceLab Workflow Editor...');
    console.log('='.repeat(50));

    // Stop frontend
    await killByPidFile(CONFIG.pidFiles.frontend, 'Frontend');

    // Stop backend
    await killByPidFile(CONFIG.pidFiles.backend, 'Backend');

    // Clean up any remaining processes
    log('Cleaning up any remaining processes...');
    exec('pkill -f "python.*main.py" || true', () => {});
    exec('pkill -f "vite" || true', () => {});

    console.log('='.repeat(50));
    success('All services stopped!');
}

// Restart all services
async function restart() {
    log('Restarting DeepFaceLab Workflow Editor...');
    await stop();
    await new Promise(resolve => setTimeout(resolve, 2000));
    await start();
}

// Show status
async function status() {
    log('DeepFaceLab Workflow Editor Status');
    console.log('='.repeat(50));

    const backendRunning = await checkPort(CONFIG.backendPort);
    const frontendRunning = await checkPort(CONFIG.frontendPort);

    if (backendRunning) {
        success(`Backend: Running on port ${CONFIG.backendPort}`);
    } else {
        error('Backend: Not running');
    }

    if (frontendRunning) {
        success(`Frontend: Running on port ${CONFIG.frontendPort}`);
    } else {
        error('Frontend: Not running');
    }

    console.log('='.repeat(50));
}

// Setup conda environment
async function setupCondaEnvironment() {
    log('Setting up conda environment...');
    
    // Detect conda
    const condaInfo = await detectCondaEnvironment();
    
    if (!condaInfo) {
        error('Conda not found. Please install conda first.');
        error('Visit: https://docs.conda.io/en/latest/miniconda.html');
        process.exit(1);
    }
    
    // Check if environment exists
    const envExists = await new Promise((resolve) => {
        exec(`conda env list --json`, (err, stdout) => {
            if (!err) {
                try {
                    const envList = JSON.parse(stdout);
                    resolve(envList.envs && envList.envs.some(env => env.includes(CONFIG.condaEnv)));
                } catch (parseErr) {
                    resolve(false);
                }
            } else {
                resolve(false);
            }
        });
    });
    
    if (!envExists) {
        log(`Creating conda environment: ${CONFIG.condaEnv}`);
        const created = await createCondaEnvironment(condaInfo.condaPath, CONFIG.condaEnv);
        if (!created) {
            error('Failed to create conda environment');
            process.exit(1);
        }
    } else {
        log(`Conda environment '${CONFIG.condaEnv}' already exists`);
    }
    
    // Install dependencies
    log('Installing dependencies...');
    const installed = await installCondaDependencies(condaInfo.condaPath, CONFIG.condaEnv);
    if (!installed) {
        error('Failed to install dependencies');
        process.exit(1);
    }
    
    success('Conda environment setup complete!');
    log(`To activate the environment manually, run: conda activate ${CONFIG.condaEnv}`);
    log('To start the application, run: node start.js start');
}

// Main execution
async function main() {
    const command = process.argv[2];

    switch (command) {
        case 'start':
            await start();
            break;
        case 'stop':
            await stop();
            break;
        case 'restart':
            await restart();
            break;
        case 'status':
            await status();
            break;
        case 'setup-conda':
            await setupCondaEnvironment();
            break;
        default:
            console.log('Usage: node start.js [start|stop|restart|status|setup-conda]');
            console.log('');
            console.log('Commands:');
            console.log('  start        Start backend and frontend services');
            console.log('  stop         Stop backend and frontend services');
            console.log('  restart      Restart all services');
            console.log('  status       Show status of all services');
            console.log('  setup-conda  Set up conda environment and install dependencies');
            process.exit(1);
    }
}

// Handle process termination
process.on('SIGINT', async () => {
    console.log('\n');
    log('Received SIGINT, stopping services...');
    await stop();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('\n');
    log('Received SIGTERM, stopping services...');
    await stop();
    process.exit(0);
});

// Run main function
main().catch(err => {
    error(`Unexpected error: ${err.message}`);
    process.exit(1);
});
