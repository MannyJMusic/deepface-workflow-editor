"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const electronAPI = {
    showSaveDialog: (options) => electron_1.ipcRenderer.invoke('show-save-dialog', options),
    showOpenDialog: (options) => electron_1.ipcRenderer.invoke('show-open-dialog', options),
    writeFile: (filePath, data) => electron_1.ipcRenderer.invoke('write-file', filePath, data),
    readFile: (filePath) => electron_1.ipcRenderer.invoke('read-file', filePath),
    showMessageBox: (options) => electron_1.ipcRenderer.invoke('show-message-box', options),
    pathExists: (filePath) => electron_1.ipcRenderer.invoke('path-exists', filePath),
    getFileStats: (filePath) => electron_1.ipcRenderer.invoke('get-file-stats', filePath),
    getDirectoryStats: (dirPath) => electron_1.ipcRenderer.invoke('get-directory-stats', dirPath)
};
// Expose the API to the renderer process
electron_1.contextBridge.exposeInMainWorld('electronAPI', electronAPI);
//# sourceMappingURL=preload.js.map