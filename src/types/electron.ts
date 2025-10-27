// Electron API types for file operations
export interface ElectronAPI {
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
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI
  }
}

