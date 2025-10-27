import { app, BrowserWindow, Menu, ipcMain, dialog } from 'electron'
import { spawn, ChildProcess } from 'node:child_process'
import path from 'node:path'
import fs from 'node:fs/promises'

let mainWindow: BrowserWindow | null = null
let pythonProcess: ChildProcess | null = null

const isDev = process.env.NODE_ENV === 'development' || (app !== undefined && !app.isPackaged)

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      webSecurity: true,
    },
    titleBarStyle: 'default',
    show: true,
  })

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
    })
  })

  // Load the app
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

function startPythonBackend() {
  const pythonPath = path.join(__dirname, '../backend')
  const mainPyPath = path.join(pythonPath, 'api/main.py')

  console.log('Starting Python backend...')
  console.log('Python path:', pythonPath)
  console.log('Main script:', mainPyPath)

  pythonProcess = spawn('python', [mainPyPath], {
    cwd: pythonPath,
    stdio: ['pipe', 'pipe', 'pipe'],
  })

  pythonProcess.stdout?.on('data', (data) => {
    console.log('Python stdout:', data.toString())
  })

  pythonProcess.stderr?.on('data', (data) => {
    console.error('Python stderr:', data.toString())
  })

  pythonProcess.on('close', (code) => {
    console.log(`Python process exited with code ${code}`)
    pythonProcess = null
  })

  pythonProcess.on('error', (error) => {
    console.error('Failed to start Python process:', error)
    pythonProcess = null
  })
}

function stopPythonBackend() {
  if (pythonProcess) {
    console.log('Stopping Python backend...')
    pythonProcess.kill()
    pythonProcess = null
  }
}

function createMenu() {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'File',
      submenu: [
        {
          label: 'New Workflow',
          accelerator: 'CmdOrCtrl+N',
          click: () => {
            mainWindow?.webContents.send('menu-new-workflow')
          },
        },
        {
          label: 'Open Workflow',
          accelerator: 'CmdOrCtrl+O',
          click: () => {
            mainWindow?.webContents.send('menu-open-workflow')
          },
        },
        {
          label: 'Save Workflow',
          accelerator: 'CmdOrCtrl+S',
          click: () => {
            mainWindow?.webContents.send('menu-save-workflow')
          },
        },
        { type: 'separator' },
        {
          label: 'Exit',
          accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
          click: () => {
            app.quit()
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
            mainWindow?.webContents.send('menu-run-workflow')
          },
        },
        {
          label: 'Stop Workflow',
          accelerator: 'Escape',
          click: () => {
            mainWindow?.webContents.send('menu-stop-workflow')
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
            mainWindow?.webContents.send('menu-about')
          },
        },
      ],
    },
  ]

  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
}

// App event handlers
app.whenReady().then(async () => {
  createWindow()
  createMenu()
  // Don't start Python backend automatically - it's already running
  // startPythonBackend()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  stopPythonBackend()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  stopPythonBackend()
})

// IPC handlers
ipcMain.handle('get-app-version', () => {
  return app.getVersion()
})

ipcMain.handle('get-platform', () => {
  return process.platform
})

ipcMain.handle('show-message-box', async (event, options) => {
  const result = await dialog.showMessageBox(mainWindow!, options)
  return { response: result.response }
})

// File operations
ipcMain.handle('show-save-dialog', async (event, options) => {
  const result = await dialog.showSaveDialog(mainWindow!, options)
  return { canceled: result.canceled, filePath: result.filePath }
})

ipcMain.handle('show-open-dialog', async (event, options) => {
  const result = await dialog.showOpenDialog(mainWindow!, options)
  return { canceled: result.canceled, filePaths: result.filePaths }
})

ipcMain.handle('write-file', async (event, filePath, data) => {
  await fs.writeFile(filePath, data, 'utf8')
})

ipcMain.handle('read-file', async (event, filePath) => {
  return await fs.readFile(filePath, 'utf8')
})

// Path validation and file stats
ipcMain.handle('path-exists', async (event, filePath) => {
  try {
    await fs.access(filePath)
    return { exists: true }
  } catch {
    return { exists: false }
  }
})

ipcMain.handle('get-file-stats', async (event, filePath) => {
  try {
    const stats = await fs.stat(filePath)
    return {
      size: stats.size,
      isFile: stats.isFile(),
      isDirectory: stats.isDirectory(),
      mtime: stats.mtime.toISOString()
    }
  } catch (error) {
    throw new Error(`Failed to get file stats: ${error}`)
  }
})

ipcMain.handle('get-directory-stats', async (event, dirPath) => {
  try {
    const files = await fs.readdir(dirPath)
    const fileCount = files.length
    const stats = await fs.stat(dirPath)
    return {
      fileCount,
      isDirectory: stats.isDirectory(),
      mtime: stats.mtime.toISOString()
    }
  } catch (error) {
    throw new Error(`Failed to get directory stats: ${error}`)
  }
})
