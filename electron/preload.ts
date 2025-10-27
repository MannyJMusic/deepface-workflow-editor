import { contextBridge, ipcRenderer } from 'electron'

// Define the Electron API interface
interface ElectronAPI {
  showSaveDialog: (options: {
    title: string
    defaultPath: string
    filters: Array<{ name: string; extensions: string[] }>
  }) => Promise<{ canceled: boolean; filePath?: string }>
  
  showOpenDialog: (options: {
    title: string
    filters: Array<{ name: string; extensions: string[] }>
    properties: string[]
  }) => Promise<{ canceled: boolean; filePaths: string[] }>
  
  writeFile: (filePath: string, data: string) => Promise<void>
  readFile: (filePath: string) => Promise<string>
  
  showMessageBox: (options: {
    type: 'info' | 'warning' | 'error'
    title: string
    message: string
    buttons?: string[]
  }) => Promise<{ response: number }>
  
  pathExists: (filePath: string) => Promise<{ exists: boolean }>
  getFileStats: (filePath: string) => Promise<{
    size: number
    isFile: boolean
    isDirectory: boolean
    mtime: string
  }>
  getDirectoryStats: (dirPath: string) => Promise<{
    fileCount: number
    isDirectory: boolean
    mtime: string
  }>
}

const electronAPI: ElectronAPI = {
  showSaveDialog: (options) => ipcRenderer.invoke('show-save-dialog', options),
  showOpenDialog: (options) => ipcRenderer.invoke('show-open-dialog', options),
  writeFile: (filePath, data) => ipcRenderer.invoke('write-file', filePath, data),
  readFile: (filePath) => ipcRenderer.invoke('read-file', filePath),
  showMessageBox: (options) => ipcRenderer.invoke('show-message-box', options),
  pathExists: (filePath) => ipcRenderer.invoke('path-exists', filePath),
  getFileStats: (filePath) => ipcRenderer.invoke('get-file-stats', filePath),
  getDirectoryStats: (dirPath) => ipcRenderer.invoke('get-directory-stats', dirPath)
}

// Expose the API to the renderer process
contextBridge.exposeInMainWorld('electronAPI', electronAPI)