"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var electron_1 = require("electron");
electron_1.contextBridge.exposeInMainWorld('electronAPI', {
    readDir: function (path) { return electron_1.ipcRenderer.invoke('read-dir', path); },
    readFile: function (path) { return electron_1.ipcRenderer.invoke('read-file', path); },
    readFileAsArrayBuffer: function (path) { return electron_1.ipcRenderer.invoke('read-file-as-array-buffer', path); },
    writeFile: function (path, content) { return electron_1.ipcRenderer.invoke('write-file', path, content); },
    getDocumentsPath: function () { return electron_1.ipcRenderer.invoke('get-documents-path'); },
    getAppPath: function () { return electron_1.ipcRenderer.invoke('get-app-path'); },
    createFile: function (path, content) { return electron_1.ipcRenderer.invoke('create-file', path, content); },
    createFolder: function (path) { return electron_1.ipcRenderer.invoke('create-folder', path); },
    deletePath: function (path) { return electron_1.ipcRenderer.invoke('delete-path', path); },
    searchFiles: function (rootPath, query) { return electron_1.ipcRenderer.invoke('search-files', rootPath, query); },
    selectDirectory: function () { return electron_1.ipcRenderer.invoke('select-directory'); },
    copyFile: function (src, dest) { return electron_1.ipcRenderer.invoke('copy-file', src, dest); },
    saveBlob: function (dest, buffer) { return electron_1.ipcRenderer.invoke('save-blob', dest, buffer); },
    openExternal: function (path) { return electron_1.ipcRenderer.invoke('open-external', path); },
    renamePath: function (oldPath, newPath) { return electron_1.ipcRenderer.invoke('rename-path', oldPath, newPath); }
});
//# sourceMappingURL=preload.js.map