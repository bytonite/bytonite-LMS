import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
    readDir: (path: string) => ipcRenderer.invoke('read-dir', path),
    readFile: (path: string) => ipcRenderer.invoke('read-file', path),
    readFileAsArrayBuffer: (path: string) => ipcRenderer.invoke('read-file-as-array-buffer', path),
    writeFile: (path: string, content: string) => ipcRenderer.invoke('write-file', path, content),
    getDocumentsPath: () => ipcRenderer.invoke('get-documents-path'),
    getAppPath: () => ipcRenderer.invoke('get-app-path'),
    createFile: (path: string, content?: string) => ipcRenderer.invoke('create-file', path, content),
    createFolder: (path: string) => ipcRenderer.invoke('create-folder', path),
    deletePath: (path: string) => ipcRenderer.invoke('delete-path', path),
    searchFiles: (rootPath: string, query: string) => ipcRenderer.invoke('search-files', rootPath, query),
    selectDirectory: () => ipcRenderer.invoke('select-directory'),
    copyFile: (src: string, dest: string) => ipcRenderer.invoke('copy-file', src, dest),
    saveBlob: (dest: string, buffer: number[]) => ipcRenderer.invoke('save-blob', dest, buffer),
    openExternal: (path: string) => ipcRenderer.invoke('open-external', path),
    renamePath: (oldPath: string, newPath: string) => ipcRenderer.invoke('rename-path', oldPath, newPath),
    executeCode: (language: string, code: string) => ipcRenderer.invoke('execute-code', language, code)
});
