import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron';
import * as path from 'path';
import * as fs from 'fs/promises';
import { existsSync } from 'fs';

const createWindow = () => {
    const win = new BrowserWindow({
        width: 1200,
        height: 800,
        backgroundColor: '#1e1e1e',
        frame: false, // Custom title bar
        titleBarStyle: 'hidden',
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: false,
            webSecurity: false // Allow loading local resources (file://) in dev mode
        }
    });

    // Log when preload script is loaded
    win.webContents.on('did-finish-load', () => {
        console.log('Preload script loaded successfully');
    });

    // Log webContents errors
    win.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
        console.error('Failed to load:', errorDescription);
    });

    // Log console messages from renderer
    win.webContents.on('console-message', (event, level, message, line, sourceId) => {
        console.log(`[Renderer] ${message} (${sourceId}:${line})`);
    });

    // Suppress Permissions-Policy warnings by overriding the header
    win.webContents.session.webRequest.onHeadersReceived((details, callback) => {
        callback({
            responseHeaders: {
                ...details.responseHeaders,
                'Permissions-Policy': ['interest-cohort=()']
            }
        });
    });

    // Use app.isPackaged to determine if we are in development mode
    if (app.isPackaged) {
        const distPath = path.join(__dirname, '../dist/index.html');
        win.loadFile(distPath);
    } else {
        win.loadURL('http://localhost:5173');
        win.webContents.openDevTools();
    }
};

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

// --- IPC Handlers ---

ipcMain.handle('read-dir', async (_event, dirPath) => {
    try {
        const entries = await fs.readdir(dirPath, { withFileTypes: true });
        return entries.map(entry => ({
            name: entry.name,
            isDirectory: entry.isDirectory(),
            path: path.join(dirPath, entry.name)
        }));
    } catch (error) {
        console.error('Error reading directory:', error);
        throw error;
    }
});

ipcMain.handle('read-file', async (_event, filePath) => {
    try {
        return await fs.readFile(filePath, 'utf-8');
    } catch (error: any) {
        if (error.code === 'ENOENT') return null;
        throw error;
    }
});

ipcMain.handle('write-file', async (_event, filePath, content) => {
    try {
        await fs.writeFile(filePath, content, 'utf-8');
        return true;
    } catch (error) {
        throw error;
    }
});

ipcMain.handle('get-documents-path', () => {
    return app.getPath('documents');
});

ipcMain.handle('get-app-path', () => {
    return process.cwd();
});

ipcMain.handle('create-file', async (_event, filePath, content = '') => {
    try {
        await fs.writeFile(filePath, content, 'utf-8');
        return true;
    } catch (error) {
        throw error;
    }
});

ipcMain.handle('create-folder', async (_event, folderPath) => {
    try {
        await fs.mkdir(folderPath, { recursive: true });
        return true;
    } catch (error) {
        throw error;
    }
});

ipcMain.handle('delete-path', async (_event, targetPath) => {
    try {
        const stats = await fs.stat(targetPath);
        if (stats.isDirectory()) {
            await fs.rm(targetPath, { recursive: true });
        } else {
            await fs.unlink(targetPath);
        }
        return true;
    } catch (error) {
        throw error;
    }
});

ipcMain.handle('search-files', async (_event, rootPath, query) => {
    console.log('Search IPC called with:', { rootPath, query });
    const results: { path: string; matches: string[] }[] = [];
    
    const searchInFile = async (filePath: string) => {
        try {
            const content = await fs.readFile(filePath, 'utf-8');
            const lines = content.split('\n');
            const matches: string[] = [];
            
            // Check filename matches
            const fileName = path.basename(filePath);
            if (fileName.toLowerCase().includes(query.toLowerCase())) {
                matches.push(`FILENAME MATCH: ${fileName}`);
            }

            lines.forEach((line, index) => {
                if (line.toLowerCase().includes(query.toLowerCase())) {
                    matches.push(`${index + 1}: ${line.trim()}`);
                }
            });
            
            if (matches.length > 0) {
                results.push({ path: filePath, matches: matches.slice(0, 3) }); // Max 3 matches per file
            }
        } catch (error) {
            // Skip files that can't be read
        }
    };
    
    const searchDir = async (dirPath: string) => {
        try {
            const entries = await fs.readdir(dirPath, { withFileTypes: true });
            for (const entry of entries) {
                // Skip ignored directories to avoid finding 100s of module CHANGELOGs/READMEs
                if (['node_modules', '.git', 'dist', 'build', 'out', '.vscode'].includes(entry.name)) {
                    continue;
                }
                
                const fullPath = path.join(dirPath, entry.name);
                if (entry.isDirectory()) {
                    await searchDir(fullPath);
                } else if (entry.name.endsWith('.md')) {
                    await searchInFile(fullPath);
                }
            }
        } catch (error) {
            console.error('Error searching directory:', dirPath, error);
        }
    };
    
    await searchDir(rootPath);
    console.log('Search completed, found:', results.length, 'results');
    return results;
});

ipcMain.handle('select-directory', async () => {
    const result = await dialog.showOpenDialog({
        properties: ['openDirectory']
    });
    if (result.canceled) {
        return null;
    } else {
        return result.filePaths[0];
    }
});

// Copy file from source to destination
ipcMain.handle('copy-file', async (_event, sourcePath: string, destPath: string) => {
    try {
        // Ensure destination directory exists
        const destDir = path.dirname(destPath);
        await fs.mkdir(destDir, { recursive: true });
        await fs.copyFile(sourcePath, destPath);
        return destPath;
    } catch (error) {
        console.error('Error copying file:', error);
        throw error;
    }
});

// Save binary blob (from clipboard) to file
ipcMain.handle('save-blob', async (_event, destPath: string, buffer: number[]) => {
    try {
        // Ensure destination directory exists
        const destDir = path.dirname(destPath);
        await fs.mkdir(destDir, { recursive: true });
        await fs.writeFile(destPath, Buffer.from(buffer));
        return destPath;
    } catch (error) {
        console.error('Error saving blob:', error);
        throw error;
    }
});

// Open file in default external application
ipcMain.handle('open-external', async (_event, filePath: string) => {
    try {
        await shell.openPath(filePath);
    } catch (error) {
        console.error('Error opening file externally:', error);
        throw error;
    }
});

// Rename file or folder
ipcMain.handle('rename-path', async (_event, oldPath: string, newPath: string) => {
    try {
        await fs.rename(oldPath, newPath);
        return newPath;
    } catch (error) {
        console.error('Error renaming:', error);
        throw error;
    }
});

// Read file as ArrayBuffer
ipcMain.handle('read-file-as-array-buffer', async (_event, filePath: string) => {
    try {
        const buffer = await fs.readFile(filePath);
        // Convert Buffer to ArrayBuffer
        const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
        return arrayBuffer;
    } catch (error) {
        console.error('Error reading file as ArrayBuffer:', error);
        throw error;
    }
});

// Execute code locally
ipcMain.handle('execute-code', async (_event, language: string, code: string) => {
    try {
        const os = require('os');
        const { exec } = require('child_process');
        const util = require('util');
        const execAsync = util.promisify(exec);
        
        const tmpDir = os.tmpdir();
        const lang = language.toLowerCase();
        
        const runCmd = async (cmd: string) => {
            try {
                const { stdout, stderr } = await execAsync(cmd);
                return stdout || stderr || '';
            } catch (e: any) {
                return e.stdout || e.stderr || e.message;
            }
        };
        
        let output = '';
        const sessionId = Date.now() + '_' + Math.floor(Math.random() * 1000);

        if (lang === 'python' || lang === 'py') {
            const tmpFile = path.join(tmpDir, `temp_${sessionId}.py`);
            await fs.writeFile(tmpFile, code);
            output = await runCmd(`python "${tmpFile}"`);
            await fs.unlink(tmpFile).catch(()=>{});
        } else if (lang === 'javascript' || lang === 'js' || lang === 'node') {
            const tmpFile = path.join(tmpDir, `temp_${sessionId}.js`);
            await fs.writeFile(tmpFile, code);
            output = await runCmd(`node "${tmpFile}"`);
            await fs.unlink(tmpFile).catch(()=>{});
        } else if (lang === 'cpp' || lang === 'c++') {
            const tmpFile = path.join(tmpDir, `temp_${sessionId}.cpp`);
            const outFile = path.join(tmpDir, process.platform === 'win32' ? `temp_${sessionId}.exe` : `temp_${sessionId}.out`);
            await fs.writeFile(tmpFile, code);
            const compileOutput = await runCmd(`g++ "${tmpFile}" -o "${outFile}"`);
            
            const exeExists = await fs.access(outFile).then(() => true).catch(() => false);
            if (!exeExists) {
                output = compileOutput;
            } else {
                output = await runCmd(`"${outFile}"`);
                await fs.unlink(outFile).catch(()=>{});
            }
            await fs.unlink(tmpFile).catch(()=>{});
        } else if (lang === 'c') {
            const tmpFile = path.join(tmpDir, `temp_${sessionId}.c`);
            const outFile = path.join(tmpDir, process.platform === 'win32' ? `temp_${sessionId}.exe` : `temp_${sessionId}.out`);
            await fs.writeFile(tmpFile, code);
            const compileOutput = await runCmd(`gcc "${tmpFile}" -o "${outFile}"`);
            
            const exeExists = await fs.access(outFile).then(() => true).catch(() => false);
            if (!exeExists) {
                output = compileOutput;
            } else {
                output = await runCmd(`"${outFile}"`);
                await fs.unlink(outFile).catch(()=>{});
            }
            await fs.unlink(tmpFile).catch(()=>{});
        } else {
            return { success: false, output: `Language "${language}" is not supported for local execution. Supported: Python, JS, C, C++` };
        }
        
        return { success: true, output: output };
    } catch (error: any) {
        return { success: false, output: error.message };
    }
});
