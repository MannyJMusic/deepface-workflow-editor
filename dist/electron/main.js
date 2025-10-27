"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const node_child_process_1 = require("node:child_process");
const node_path_1 = __importDefault(require("node:path"));
const promises_1 = __importDefault(require("node:fs/promises"));
let mainWindow = null;
let pythonProcess = null;
const isDev = process.env.NODE_ENV === 'development' || (electron_1.app !== undefined && !electron_1.app.isPackaged);
function createWindow() {
    mainWindow = new electron_1.BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 1200,
        minHeight: 800,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: node_path_1.default.join(__dirname, 'preload.js'),
            webSecurity: true,
        },
        titleBarStyle: 'default',
        show: true,
    });
    // Set Content Security Policy
    mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
        callback({
            responseHeaders: {
                ...details.responseHeaders,
                'Content-Security-Policy': [
                    "default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob: ws: wss: http: https:; " +
                        "script-src 'self' 'unsafe-inline' 'unsafe-eval' http: https: ws: wss:; " +
                        "style-src 'self' 'unsafe-inline' http: https:; " +
                        "img-src 'self' data: blob: http: https:; " +
                        "connect-src 'self' ws: wss: http: https:; " +
                        "font-src 'self' data: http: https:; " +
                        "object-src 'none'; " +
                        "media-src 'self' data: blob: http: https:;"
                ]
            }
        });
    });
    // Load the app
    if (isDev) {
        mainWindow.loadURL('http://localhost:5173');
        mainWindow.webContents.openDevTools();
    }
    else {
        mainWindow.loadFile(node_path_1.default.join(__dirname, '../dist/index.html'));
    }
    mainWindow.once('ready-to-show', () => {
        mainWindow?.show();
    });
    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}
function startPythonBackend() {
    const pythonPath = node_path_1.default.join(__dirname, '../backend');
    const mainPyPath = node_path_1.default.join(pythonPath, 'api/main.py');
    console.log('Starting Python backend...');
    console.log('Python path:', pythonPath);
    console.log('Main script:', mainPyPath);
    pythonProcess = (0, node_child_process_1.spawn)('python', [mainPyPath], {
        cwd: pythonPath,
        stdio: ['pipe', 'pipe', 'pipe'],
    });
    pythonProcess.stdout?.on('data', (data) => {
        console.log('Python stdout:', data.toString());
    });
    pythonProcess.stderr?.on('data', (data) => {
        console.error('Python stderr:', data.toString());
    });
    pythonProcess.on('close', (code) => {
        console.log(`Python process exited with code ${code}`);
        pythonProcess = null;
    });
    pythonProcess.on('error', (error) => {
        console.error('Failed to start Python process:', error);
        pythonProcess = null;
    });
}
function stopPythonBackend() {
    if (pythonProcess) {
        console.log('Stopping Python backend...');
        pythonProcess.kill();
        pythonProcess = null;
    }
}
function createMenu() {
    const template = [
        {
            label: 'File',
            submenu: [
                {
                    label: 'New Workflow',
                    accelerator: 'CmdOrCtrl+N',
                    click: () => {
                        mainWindow?.webContents.send('menu-new-workflow');
                    },
                },
                {
                    label: 'Open Workflow',
                    accelerator: 'CmdOrCtrl+O',
                    click: () => {
                        mainWindow?.webContents.send('menu-open-workflow');
                    },
                },
                {
                    label: 'Save Workflow',
                    accelerator: 'CmdOrCtrl+S',
                    click: () => {
                        mainWindow?.webContents.send('menu-save-workflow');
                    },
                },
                { type: 'separator' },
                {
                    label: 'Exit',
                    accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
                    click: () => {
                        electron_1.app.quit();
                    },
                },
            ],
        },
        {
            label: 'Edit',
            submenu: [
                { role: 'undo' },
                { role: 'redo' },
                { type: 'separator' },
                { role: 'cut' },
                { role: 'copy' },
                { role: 'paste' },
            ],
        },
        {
            label: 'View',
            submenu: [
                { role: 'reload' },
                { role: 'forceReload' },
                { role: 'toggleDevTools' },
                { type: 'separator' },
                { role: 'resetZoom' },
                { role: 'zoomIn' },
                { role: 'zoomOut' },
                { type: 'separator' },
                { role: 'togglefullscreen' },
            ],
        },
        {
            label: 'Workflow',
            submenu: [
                {
                    label: 'Run Workflow',
                    accelerator: 'F5',
                    click: () => {
                        mainWindow?.webContents.send('menu-run-workflow');
                    },
                },
                {
                    label: 'Stop Workflow',
                    accelerator: 'Escape',
                    click: () => {
                        mainWindow?.webContents.send('menu-stop-workflow');
                    },
                },
            ],
        },
        {
            label: 'Help',
            submenu: [
                {
                    label: 'About DeepFaceLab Workflow Editor',
                    click: () => {
                        mainWindow?.webContents.send('menu-about');
                    },
                },
            ],
        },
    ];
    const menu = electron_1.Menu.buildFromTemplate(template);
    electron_1.Menu.setApplicationMenu(menu);
}
// App event handlers
electron_1.app.whenReady().then(async () => {
    createWindow();
    createMenu();
    // Don't start Python backend automatically - it's already running
    // startPythonBackend()
    electron_1.app.on('activate', () => {
        if (electron_1.BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});
electron_1.app.on('window-all-closed', () => {
    stopPythonBackend();
    if (process.platform !== 'darwin') {
        electron_1.app.quit();
    }
});
electron_1.app.on('before-quit', () => {
    stopPythonBackend();
});
// IPC handlers
electron_1.ipcMain.handle('get-app-version', () => {
    return electron_1.app.getVersion();
});
electron_1.ipcMain.handle('get-platform', () => {
    return process.platform;
});
electron_1.ipcMain.handle('show-message-box', async (event, options) => {
    const result = await electron_1.dialog.showMessageBox(mainWindow, options);
    return { response: result.response };
});
// File operations
electron_1.ipcMain.handle('show-save-dialog', async (event, options) => {
    const result = await electron_1.dialog.showSaveDialog(mainWindow, options);
    return { canceled: result.canceled, filePath: result.filePath };
});
electron_1.ipcMain.handle('show-open-dialog', async (event, options) => {
    const result = await electron_1.dialog.showOpenDialog(mainWindow, options);
    return { canceled: result.canceled, filePaths: result.filePaths };
});
electron_1.ipcMain.handle('write-file', async (event, filePath, data) => {
    await promises_1.default.writeFile(filePath, data, 'utf8');
});
electron_1.ipcMain.handle('read-file', async (event, filePath) => {
    return await promises_1.default.readFile(filePath, 'utf8');
});
// Path validation and file stats
electron_1.ipcMain.handle('path-exists', async (event, filePath) => {
    try {
        await promises_1.default.access(filePath);
        return { exists: true };
    }
    catch {
        return { exists: false };
    }
});
electron_1.ipcMain.handle('get-file-stats', async (event, filePath) => {
    try {
        const stats = await promises_1.default.stat(filePath);
        return {
            size: stats.size,
            isFile: stats.isFile(),
            isDirectory: stats.isDirectory(),
            mtime: stats.mtime.toISOString()
        };
    }
    catch (error) {
        throw new Error(`Failed to get file stats: ${error}`);
    }
});
electron_1.ipcMain.handle('get-directory-stats', async (event, dirPath) => {
    try {
        const files = await promises_1.default.readdir(dirPath);
        const fileCount = files.length;
        const stats = await promises_1.default.stat(dirPath);
        return {
            fileCount,
            isDirectory: stats.isDirectory(),
            mtime: stats.mtime.toISOString()
        };
    }
    catch (error) {
        throw new Error(`Failed to get directory stats: ${error}`);
    }
});
//# sourceMappingURL=main.js.map