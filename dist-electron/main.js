"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
var electron_1 = require("electron");
var path = __importStar(require("path"));
var fs = __importStar(require("fs/promises"));
var createWindow = function () {
    var win = new electron_1.BrowserWindow({
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
    win.webContents.on('did-finish-load', function () {
        console.log('Preload script loaded successfully');
    });
    // Log webContents errors
    win.webContents.on('did-fail-load', function (event, errorCode, errorDescription) {
        console.error('Failed to load:', errorDescription);
    });
    // Log console messages from renderer
    win.webContents.on('console-message', function (event, level, message, line, sourceId) {
        console.log("[Renderer] ".concat(message, " (").concat(sourceId, ":").concat(line, ")"));
    });
    // Suppress Permissions-Policy warnings by overriding the header
    win.webContents.session.webRequest.onHeadersReceived(function (details, callback) {
        callback({
            responseHeaders: __assign(__assign({}, details.responseHeaders), { 'Permissions-Policy': ['interest-cohort=()'] })
        });
    });
    // Use app.isPackaged to determine if we are in development mode
    if (electron_1.app.isPackaged) {
        var distPath = path.join(__dirname, '../dist/index.html');
        win.loadFile(distPath);
    }
    else {
        win.loadURL('http://localhost:5173');
        win.webContents.openDevTools();
    }
};
electron_1.app.whenReady().then(function () {
    createWindow();
    electron_1.app.on('activate', function () {
        if (electron_1.BrowserWindow.getAllWindows().length === 0)
            createWindow();
    });
});
electron_1.app.on('window-all-closed', function () {
    if (process.platform !== 'darwin')
        electron_1.app.quit();
});
// --- IPC Handlers ---
electron_1.ipcMain.handle('read-dir', function (_event, dirPath) { return __awaiter(void 0, void 0, void 0, function () {
    var entries, error_1;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                return [4 /*yield*/, fs.readdir(dirPath, { withFileTypes: true })];
            case 1:
                entries = _a.sent();
                return [2 /*return*/, entries.map(function (entry) { return ({
                        name: entry.name,
                        isDirectory: entry.isDirectory(),
                        path: path.join(dirPath, entry.name)
                    }); })];
            case 2:
                error_1 = _a.sent();
                console.error('Error reading directory:', error_1);
                throw error_1;
            case 3: return [2 /*return*/];
        }
    });
}); });
electron_1.ipcMain.handle('read-file', function (_event, filePath) { return __awaiter(void 0, void 0, void 0, function () {
    var error_2;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                return [4 /*yield*/, fs.readFile(filePath, 'utf-8')];
            case 1: return [2 /*return*/, _a.sent()];
            case 2:
                error_2 = _a.sent();
                if (error_2.code === 'ENOENT')
                    return [2 /*return*/, null];
                throw error_2;
            case 3: return [2 /*return*/];
        }
    });
}); });
electron_1.ipcMain.handle('write-file', function (_event, filePath, content) { return __awaiter(void 0, void 0, void 0, function () {
    var error_3;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                return [4 /*yield*/, fs.writeFile(filePath, content, 'utf-8')];
            case 1:
                _a.sent();
                return [2 /*return*/, true];
            case 2:
                error_3 = _a.sent();
                throw error_3;
            case 3: return [2 /*return*/];
        }
    });
}); });
electron_1.ipcMain.handle('get-documents-path', function () {
    return electron_1.app.getPath('documents');
});
electron_1.ipcMain.handle('get-app-path', function () {
    return process.cwd();
});
electron_1.ipcMain.handle('create-file', function (_event_1, filePath_1) {
    var args_1 = [];
    for (var _i = 2; _i < arguments.length; _i++) {
        args_1[_i - 2] = arguments[_i];
    }
    return __awaiter(void 0, __spreadArray([_event_1, filePath_1], args_1, true), void 0, function (_event, filePath, content) {
        var error_4;
        if (content === void 0) { content = ''; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, fs.writeFile(filePath, content, 'utf-8')];
                case 1:
                    _a.sent();
                    return [2 /*return*/, true];
                case 2:
                    error_4 = _a.sent();
                    throw error_4;
                case 3: return [2 /*return*/];
            }
        });
    });
});
electron_1.ipcMain.handle('create-folder', function (_event, folderPath) { return __awaiter(void 0, void 0, void 0, function () {
    var error_5;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                return [4 /*yield*/, fs.mkdir(folderPath, { recursive: true })];
            case 1:
                _a.sent();
                return [2 /*return*/, true];
            case 2:
                error_5 = _a.sent();
                throw error_5;
            case 3: return [2 /*return*/];
        }
    });
}); });
electron_1.ipcMain.handle('delete-path', function (_event, targetPath) { return __awaiter(void 0, void 0, void 0, function () {
    var stats, error_6;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 6, , 7]);
                return [4 /*yield*/, fs.stat(targetPath)];
            case 1:
                stats = _a.sent();
                if (!stats.isDirectory()) return [3 /*break*/, 3];
                return [4 /*yield*/, fs.rm(targetPath, { recursive: true })];
            case 2:
                _a.sent();
                return [3 /*break*/, 5];
            case 3: return [4 /*yield*/, fs.unlink(targetPath)];
            case 4:
                _a.sent();
                _a.label = 5;
            case 5: return [2 /*return*/, true];
            case 6:
                error_6 = _a.sent();
                throw error_6;
            case 7: return [2 /*return*/];
        }
    });
}); });
electron_1.ipcMain.handle('search-files', function (_event, rootPath, query) { return __awaiter(void 0, void 0, void 0, function () {
    var results, searchInFile, searchDir;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                console.log('Search IPC called with:', { rootPath: rootPath, query: query });
                results = [];
                searchInFile = function (filePath) { return __awaiter(void 0, void 0, void 0, function () {
                    var content, lines, matches_1, fileName, error_7;
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0:
                                _a.trys.push([0, 2, , 3]);
                                return [4 /*yield*/, fs.readFile(filePath, 'utf-8')];
                            case 1:
                                content = _a.sent();
                                lines = content.split('\n');
                                matches_1 = [];
                                fileName = path.basename(filePath);
                                if (fileName.toLowerCase().includes(query.toLowerCase())) {
                                    matches_1.push("FILENAME MATCH: ".concat(fileName));
                                }
                                lines.forEach(function (line, index) {
                                    if (line.toLowerCase().includes(query.toLowerCase())) {
                                        matches_1.push("".concat(index + 1, ": ").concat(line.trim()));
                                    }
                                });
                                if (matches_1.length > 0) {
                                    results.push({ path: filePath, matches: matches_1.slice(0, 3) }); // Max 3 matches per file
                                }
                                return [3 /*break*/, 3];
                            case 2:
                                error_7 = _a.sent();
                                return [3 /*break*/, 3];
                            case 3: return [2 /*return*/];
                        }
                    });
                }); };
                searchDir = function (dirPath) { return __awaiter(void 0, void 0, void 0, function () {
                    var entries, _i, entries_1, entry, fullPath, error_8;
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0:
                                _a.trys.push([0, 8, , 9]);
                                return [4 /*yield*/, fs.readdir(dirPath, { withFileTypes: true })];
                            case 1:
                                entries = _a.sent();
                                _i = 0, entries_1 = entries;
                                _a.label = 2;
                            case 2:
                                if (!(_i < entries_1.length)) return [3 /*break*/, 7];
                                entry = entries_1[_i];
                                // Skip ignored directories to avoid finding 100s of module CHANGELOGs/READMEs
                                if (['node_modules', '.git', 'dist', 'build', 'out', '.vscode'].includes(entry.name)) {
                                    return [3 /*break*/, 6];
                                }
                                fullPath = path.join(dirPath, entry.name);
                                if (!entry.isDirectory()) return [3 /*break*/, 4];
                                return [4 /*yield*/, searchDir(fullPath)];
                            case 3:
                                _a.sent();
                                return [3 /*break*/, 6];
                            case 4:
                                if (!entry.name.endsWith('.md')) return [3 /*break*/, 6];
                                return [4 /*yield*/, searchInFile(fullPath)];
                            case 5:
                                _a.sent();
                                _a.label = 6;
                            case 6:
                                _i++;
                                return [3 /*break*/, 2];
                            case 7: return [3 /*break*/, 9];
                            case 8:
                                error_8 = _a.sent();
                                console.error('Error searching directory:', dirPath, error_8);
                                return [3 /*break*/, 9];
                            case 9: return [2 /*return*/];
                        }
                    });
                }); };
                return [4 /*yield*/, searchDir(rootPath)];
            case 1:
                _a.sent();
                console.log('Search completed, found:', results.length, 'results');
                return [2 /*return*/, results];
        }
    });
}); });
electron_1.ipcMain.handle('select-directory', function () { return __awaiter(void 0, void 0, void 0, function () {
    var result;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, electron_1.dialog.showOpenDialog({
                    properties: ['openDirectory']
                })];
            case 1:
                result = _a.sent();
                if (result.canceled) {
                    return [2 /*return*/, null];
                }
                else {
                    return [2 /*return*/, result.filePaths[0]];
                }
                return [2 /*return*/];
        }
    });
}); });
// Copy file from source to destination
electron_1.ipcMain.handle('copy-file', function (_event, sourcePath, destPath) { return __awaiter(void 0, void 0, void 0, function () {
    var destDir, error_9;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 3, , 4]);
                destDir = path.dirname(destPath);
                return [4 /*yield*/, fs.mkdir(destDir, { recursive: true })];
            case 1:
                _a.sent();
                return [4 /*yield*/, fs.copyFile(sourcePath, destPath)];
            case 2:
                _a.sent();
                return [2 /*return*/, destPath];
            case 3:
                error_9 = _a.sent();
                console.error('Error copying file:', error_9);
                throw error_9;
            case 4: return [2 /*return*/];
        }
    });
}); });
// Save binary blob (from clipboard) to file
electron_1.ipcMain.handle('save-blob', function (_event, destPath, buffer) { return __awaiter(void 0, void 0, void 0, function () {
    var destDir, error_10;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 3, , 4]);
                destDir = path.dirname(destPath);
                return [4 /*yield*/, fs.mkdir(destDir, { recursive: true })];
            case 1:
                _a.sent();
                return [4 /*yield*/, fs.writeFile(destPath, Buffer.from(buffer))];
            case 2:
                _a.sent();
                return [2 /*return*/, destPath];
            case 3:
                error_10 = _a.sent();
                console.error('Error saving blob:', error_10);
                throw error_10;
            case 4: return [2 /*return*/];
        }
    });
}); });
// Open file in default external application
electron_1.ipcMain.handle('open-external', function (_event, filePath) { return __awaiter(void 0, void 0, void 0, function () {
    var error_11;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                return [4 /*yield*/, electron_1.shell.openPath(filePath)];
            case 1:
                _a.sent();
                return [3 /*break*/, 3];
            case 2:
                error_11 = _a.sent();
                console.error('Error opening file externally:', error_11);
                throw error_11;
            case 3: return [2 /*return*/];
        }
    });
}); });
// Rename file or folder
electron_1.ipcMain.handle('rename-path', function (_event, oldPath, newPath) { return __awaiter(void 0, void 0, void 0, function () {
    var error_12;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                return [4 /*yield*/, fs.rename(oldPath, newPath)];
            case 1:
                _a.sent();
                return [2 /*return*/, newPath];
            case 2:
                error_12 = _a.sent();
                console.error('Error renaming:', error_12);
                throw error_12;
            case 3: return [2 /*return*/];
        }
    });
}); });
// Read file as ArrayBuffer
electron_1.ipcMain.handle('read-file-as-array-buffer', function (_event, filePath) { return __awaiter(void 0, void 0, void 0, function () {
    var buffer, arrayBuffer, error_13;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                return [4 /*yield*/, fs.readFile(filePath)];
            case 1:
                buffer = _a.sent();
                arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
                return [2 /*return*/, arrayBuffer];
            case 2:
                error_13 = _a.sent();
                console.error('Error reading file as ArrayBuffer:', error_13);
                throw error_13;
            case 3: return [2 /*return*/];
        }
    });
}); });
// Execute code locally
electron_1.ipcMain.handle('execute-code', function (_event, language, code) { return __awaiter(void 0, void 0, void 0, function () {
    var os, exec, util, execAsync_1, tmpDir, lang, runCmd, output, sessionId, tmpFile, tmpFile, tmpFile, outFile, compileOutput, exeExists, tmpFile, outFile, compileOutput, exeExists, error_14;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 28, , 29]);
                os = require('os');
                exec = require('child_process').exec;
                util = require('util');
                execAsync_1 = util.promisify(exec);
                tmpDir = os.tmpdir();
                lang = language.toLowerCase();
                runCmd = function (cmd) { return __awaiter(void 0, void 0, void 0, function () {
                    var _a, stdout, stderr, e_1;
                    return __generator(this, function (_b) {
                        switch (_b.label) {
                            case 0:
                                _b.trys.push([0, 2, , 3]);
                                return [4 /*yield*/, execAsync_1(cmd)];
                            case 1:
                                _a = _b.sent(), stdout = _a.stdout, stderr = _a.stderr;
                                return [2 /*return*/, stdout || stderr || ''];
                            case 2:
                                e_1 = _b.sent();
                                return [2 /*return*/, e_1.stdout || e_1.stderr || e_1.message];
                            case 3: return [2 /*return*/];
                        }
                    });
                }); };
                output = '';
                sessionId = Date.now() + '_' + Math.floor(Math.random() * 1000);
                if (!(lang === 'python' || lang === 'py')) return [3 /*break*/, 4];
                tmpFile = path.join(tmpDir, "temp_".concat(sessionId, ".py"));
                return [4 /*yield*/, fs.writeFile(tmpFile, code)];
            case 1:
                _a.sent();
                return [4 /*yield*/, runCmd("python \"".concat(tmpFile, "\""))];
            case 2:
                output = _a.sent();
                return [4 /*yield*/, fs.unlink(tmpFile).catch(function () { })];
            case 3:
                _a.sent();
                return [3 /*break*/, 27];
            case 4:
                if (!(lang === 'javascript' || lang === 'js' || lang === 'node')) return [3 /*break*/, 8];
                tmpFile = path.join(tmpDir, "temp_".concat(sessionId, ".js"));
                return [4 /*yield*/, fs.writeFile(tmpFile, code)];
            case 5:
                _a.sent();
                return [4 /*yield*/, runCmd("node \"".concat(tmpFile, "\""))];
            case 6:
                output = _a.sent();
                return [4 /*yield*/, fs.unlink(tmpFile).catch(function () { })];
            case 7:
                _a.sent();
                return [3 /*break*/, 27];
            case 8:
                if (!(lang === 'cpp' || lang === 'c++')) return [3 /*break*/, 17];
                tmpFile = path.join(tmpDir, "temp_".concat(sessionId, ".cpp"));
                outFile = path.join(tmpDir, process.platform === 'win32' ? "temp_".concat(sessionId, ".exe") : "temp_".concat(sessionId, ".out"));
                return [4 /*yield*/, fs.writeFile(tmpFile, code)];
            case 9:
                _a.sent();
                return [4 /*yield*/, runCmd("g++ \"".concat(tmpFile, "\" -o \"").concat(outFile, "\""))];
            case 10:
                compileOutput = _a.sent();
                return [4 /*yield*/, fs.access(outFile).then(function () { return true; }).catch(function () { return false; })];
            case 11:
                exeExists = _a.sent();
                if (!!exeExists) return [3 /*break*/, 12];
                output = compileOutput;
                return [3 /*break*/, 15];
            case 12: return [4 /*yield*/, runCmd("\"".concat(outFile, "\""))];
            case 13:
                output = _a.sent();
                return [4 /*yield*/, fs.unlink(outFile).catch(function () { })];
            case 14:
                _a.sent();
                _a.label = 15;
            case 15: return [4 /*yield*/, fs.unlink(tmpFile).catch(function () { })];
            case 16:
                _a.sent();
                return [3 /*break*/, 27];
            case 17:
                if (!(lang === 'c')) return [3 /*break*/, 26];
                tmpFile = path.join(tmpDir, "temp_".concat(sessionId, ".c"));
                outFile = path.join(tmpDir, process.platform === 'win32' ? "temp_".concat(sessionId, ".exe") : "temp_".concat(sessionId, ".out"));
                return [4 /*yield*/, fs.writeFile(tmpFile, code)];
            case 18:
                _a.sent();
                return [4 /*yield*/, runCmd("gcc \"".concat(tmpFile, "\" -o \"").concat(outFile, "\""))];
            case 19:
                compileOutput = _a.sent();
                return [4 /*yield*/, fs.access(outFile).then(function () { return true; }).catch(function () { return false; })];
            case 20:
                exeExists = _a.sent();
                if (!!exeExists) return [3 /*break*/, 21];
                output = compileOutput;
                return [3 /*break*/, 24];
            case 21: return [4 /*yield*/, runCmd("\"".concat(outFile, "\""))];
            case 22:
                output = _a.sent();
                return [4 /*yield*/, fs.unlink(outFile).catch(function () { })];
            case 23:
                _a.sent();
                _a.label = 24;
            case 24: return [4 /*yield*/, fs.unlink(tmpFile).catch(function () { })];
            case 25:
                _a.sent();
                return [3 /*break*/, 27];
            case 26: return [2 /*return*/, { success: false, output: "Language \"".concat(language, "\" is not supported for local execution. Supported: Python, JS, C, C++") }];
            case 27: return [2 /*return*/, { success: true, output: output }];
            case 28:
                error_14 = _a.sent();
                return [2 /*return*/, { success: false, output: error_14.message }];
            case 29: return [2 /*return*/];
        }
    });
}); });
//# sourceMappingURL=main.js.map