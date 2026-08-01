import { useState, useEffect } from 'react';
import { getBasename } from '../utils/path';
import { FileText, ChevronRight, ChevronDown, FilePlus, FolderPlus, Pin } from 'lucide-react';
import ContextMenu from './ContextMenu';

interface FileEntry {
    name: string;
    isDirectory: boolean;
    path: string;
}

interface FileExplorerProps {
    rootPath: string;
    onFileSelect: (path: string) => void;
    onRefresh?: () => void;
    pinnedFiles: string[];
    onTogglePin: (path: string) => void;
    onRequestFileOp: (operation: () => void) => void;
    activeFilePath?: string;
}

// Filter configuration
const HIDDEN_DIRS = new Set([
    'node_modules', '.git', 'dist', 'build', 'coverage', '.obsidian', '.idea', '.vscode',
    'src', 'electron', 'dist-electron', 'public' // Hide source folders as requested
]);

const ALLOWED_EXTS = new Set([
    '.md',
    // Images
    '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp', '.svg',
    // Videos
    '.mp4', '.webm', '.ogv', '.mkv', '.avi', '.mov'
]);

const shouldShowEntry = (entry: FileEntry) => {
    if (entry.name.startsWith('.')) return false; // Hide dotfiles
    
    if (entry.isDirectory) {
        return !HIDDEN_DIRS.has(entry.name);
    }
    
    const extIndex = entry.name.lastIndexOf('.');
    if (extIndex === -1) return false; // Hide files without extensions
    
    const ext = entry.name.slice(extIndex).toLowerCase();
    return ALLOWED_EXTS.has(ext);
};

const FileNode = ({ entry, onSelect, level, onContextMenu, pinned, activeFilePath, expandedFolders, onToggleExpand, childrenCache, onUpdateChildren }: { 
    entry: FileEntry, 
    onSelect: (p: string) => void, 
    level: number,
    onContextMenu: (e: React.MouseEvent, entry: FileEntry) => void,
    pinned?: boolean,
    activeFilePath?: string,
    expandedFolders: Set<string>,
    onToggleExpand: (path: string) => void,
    childrenCache: Map<string, FileEntry[]>,
    onUpdateChildren: (path: string, children: FileEntry[]) => void
}) => {
    // Normalize paths for consistent cache lookup
    const normalizedPath = entry.path.replace(/\\/g, '/');
    const isOpen = expandedFolders.has(normalizedPath);
    const children = childrenCache.get(normalizedPath) || [];
    
    const handleToggle = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (entry.isDirectory) {
            if (!isOpen) {
                const files = await window.electronAPI.readDir(entry.path);
                const filtered = files.filter(shouldShowEntry);
                onUpdateChildren(normalizedPath, filtered);
            }
            onToggleExpand(normalizedPath);
        } else {
            onSelect(entry.path);
        }
    };

    // Load children if folder is expanded but not cached yet
    useEffect(() => {
        if (entry.isDirectory && isOpen && children.length === 0) {
            window.electronAPI.readDir(entry.path).then(files => {
                const filtered = files.filter(shouldShowEntry);
                onUpdateChildren(normalizedPath, filtered);
            });
        }
    }, [isOpen, entry.path, entry.isDirectory]);

    const handleRightClick = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        onContextMenu(e, entry);
    };

    const isActive = !entry.isDirectory && entry.path === activeFilePath;
    
    // Check if file is a media file (image or video)
    const isMediaFile = !entry.isDirectory && /\.(png|jpg|jpeg|gif|bmp|webp|svg|mp4|webm|ogv|mkv|mov|avi)$/i.test(entry.name);

    const handleDragStart = (e: React.DragEvent) => {
        if (isMediaFile) {
            e.dataTransfer.setData('text/plain', entry.path);
            e.dataTransfer.setData('application/x-media-path', entry.path);
            e.dataTransfer.effectAllowed = 'copy';
        }
    };

    return (
        <div style={{ paddingLeft: level * 15 }}>
            <div 
                className="file-item" 
                onClick={handleToggle}
                onContextMenu={handleRightClick}
                draggable={isMediaFile}
                onDragStart={handleDragStart}
                style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    padding: '6px 8px', 
                    cursor: isMediaFile ? 'grab' : 'pointer',
                    color: isActive ? 'var(--interactive-accent)' : 'var(--text-normal)',
                    backgroundColor: isActive ? 'rgba(124, 58, 237, 0.15)' : 'transparent',
                    borderRadius: '4px',
                    transition: 'all 0.15s ease',
                    fontWeight: isActive ? 500 : 400
                }}
            >
                {entry.isDirectory && (
                   isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />
                )}
                {!entry.isDirectory && <FileText size={14} style={{ marginLeft: 14 }} />}
                <span style={{ marginLeft: 6, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {entry.name}
                </span>
                {pinned && <Pin size={12} style={{ transform: 'rotate(45deg)', opacity: 0.7 }} />}
            </div>
            {isOpen && children.map(child => (
                <FileNode 
                    key={child.path} 
                    entry={child} 
                    onSelect={onSelect} 
                    level={level + 1} 
                    onContextMenu={onContextMenu} 
                    activeFilePath={activeFilePath}
                    expandedFolders={expandedFolders}
                    onToggleExpand={onToggleExpand}
                    childrenCache={childrenCache}
                    onUpdateChildren={onUpdateChildren}
                />
            ))}
        </div>
    );
};



export default function FileExplorer({ rootPath, onFileSelect, pinnedFiles, onTogglePin, onRequestFileOp, activeFilePath }: Omit<FileExplorerProps, 'onRefresh'>) {
    const [files, setFiles] = useState<FileEntry[]>([]);
    const [contextMenu, setContextMenu] = useState<{ x: number, y: number, entry: FileEntry } | null>(null);
    const [modalConfig, setModalConfig] = useState<{
        isOpen: boolean;
        type: 'file' | 'folder';
        parentPath: string;
        defaultValue: string;
    } | null>(null);
    const [inputValue, setInputValue] = useState('');
    const [renameModal, setRenameModal] = useState<{ path: string; currentName: string } | null>(null);
    const [renameValue, setRenameValue] = useState('');
    const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
    const [childrenCache, setChildrenCache] = useState<Map<string, FileEntry[]>>(new Map());

    const handleToggleExpand = (path: string) => {
        setExpandedFolders(prev => {
            const next = new Set(prev);
            if (next.has(path)) {
                next.delete(path);
            } else {
                next.add(path);
            }
            return next;
        });
    };

    const handleUpdateChildren = (path: string, children: FileEntry[]) => {
        setChildrenCache(prev => {
            const next = new Map(prev);
            next.set(path, children);
            return next;
        });
    };

    const loadFiles = () => {
        window.electronAPI.readDir(rootPath).then(allFiles => {
            setFiles(allFiles.filter(shouldShowEntry));
        });
    };

    useEffect(() => {
        loadFiles();
    }, [rootPath]);

    const handleContextMenu = (e: React.MouseEvent, entry: FileEntry) => {
        setContextMenu({ x: e.clientX, y: e.clientY, entry });
    };

    const openModal = (type: 'file' | 'folder', parentPath: string) => {
        const defaultValue = type === 'file' ? 'Новая заметка.md' : 'Новая папка';
        setModalConfig({ isOpen: true, type, parentPath, defaultValue });
        setInputValue(defaultValue);
    };

    const handleNewFile = (parentPath: string) => openModal('file', parentPath);
    const handleNewFolder = (parentPath: string) => openModal('folder', parentPath);

    const handleModalSubmit = async () => {
        if (!modalConfig || !inputValue) return;

        const { type, parentPath } = modalConfig;
        const fullPath = `${parentPath}/${inputValue}`;

        // Обернуть в проверку авторизации
        onRequestFileOp(async () => {
            try {
                if (type === 'file') {
                     // Ensure extension
                    let finalPath = fullPath;
                    if (!finalPath.endsWith('.md')) finalPath += '.md';
                    
                    await window.electronAPI.createFile(finalPath, '# ' + inputValue.replace('.md', ''));
                } else {
                    await window.electronAPI.createFolder(fullPath);
                }
                
                // Update parent folder's cache instead of full tree reload
                const normalizedParent = parentPath.replace(/\\/g, '/');
                const parentFiles = await window.electronAPI.readDir(parentPath);
                const filtered = parentFiles.filter(shouldShowEntry);
                handleUpdateChildren(normalizedParent, filtered);
                
                // Check if created item is at root level
                if (normalizedParent === rootPath.replace(/\\/g, '/')) {
                    setFiles(filtered);
                }
                
                // Note: Don't call onRefresh() as it remounts the entire FileExplorer component
            } catch (e) {
                console.error(e);
                alert('Ошибка создания: ' + e);
            }
        });
        
        setModalConfig(null);
    };

    const handleDelete = async (path: string) => {
        if (confirm('Вы уверены, что хотите удалить этот элемент?')) {
            onRequestFileOp(async () => {
                await window.electronAPI.deletePath(path);
                
                // Update parent folder's cache instead of full tree reload
                const normalizedPath = path.replace(/\\/g, '/');
                const parentDir = normalizedPath.substring(0, normalizedPath.lastIndexOf('/'));
                const parentFiles = await window.electronAPI.readDir(parentDir);
                const filtered = parentFiles.filter(shouldShowEntry);
                handleUpdateChildren(parentDir, filtered);
                
                // Check if deleted item was at root level
                if (parentDir === rootPath.replace(/\\/g, '/')) {
                    setFiles(filtered);
                }
                
                // Note: Don't call onRefresh() as it remounts the entire FileExplorer component
            });
        }
    };

    const openRenameModal = (entry: FileEntry) => {
        setRenameModal({ path: entry.path, currentName: entry.name });
        setRenameValue(entry.name);
    };

    const handleRenameSubmit = async () => {
        if (!renameModal || !renameValue || renameValue === renameModal.currentName) {
            setRenameModal(null);
            return;
        }

        // Normalize path separators for cross-platform compatibility
        const normalizedPath = renameModal.path.replace(/\\/g, '/');
        const parentDir = normalizedPath.substring(0, normalizedPath.lastIndexOf('/'));
        const newPath = `${parentDir}/${renameValue}`;

        onRequestFileOp(async () => {
            try {
                await window.electronAPI.renamePath(renameModal.path, newPath);
                
                // Refresh parent folder's children cache instead of full tree reload
                const parentFiles = await window.electronAPI.readDir(parentDir);
                const filtered = parentFiles.filter(shouldShowEntry);
                handleUpdateChildren(parentDir, filtered);
                
                // Check if renamed item is at root level
                if (parentDir === rootPath.replace(/\\/g, '/')) {
                    setFiles(filtered);
                }
                
                // Note: Don't call onRefresh() here as it remounts the entire FileExplorer component
            } catch (e) {
                console.error(e);
                alert('Ошибка переименования: ' + e);
            }
        });

        setRenameModal(null);
    };

    return (
        <div style={{ padding: '10px' }}>
            {/* Input Modal */}
            {modalConfig && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.5)', zIndex: 1000,
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                }} onClick={() => setModalConfig(null)}>
                    <div style={{
                        background: 'var(--background-secondary)', padding: '20px', borderRadius: '8px',
                        border: '1px solid var(--border-subtle)', width: '300px'
                    }} onClick={e => e.stopPropagation()}>
                        <div style={{ marginBottom: '10px', color: 'var(--text-normal)' }}>
                            {modalConfig.type === 'file' ? 'Создать заметку' : 'Создать папку'}
                        </div>
                        <input
                            autoFocus
                            type="text"
                            value={inputValue}
                            onChange={e => setInputValue(e.target.value)}
                            onMouseDown={e => e.stopPropagation()}
                            onClick={e => e.stopPropagation()}
                            onKeyDown={e => {
                                if (e.key === 'Enter') handleModalSubmit();
                                if (e.key === 'Escape') setModalConfig(null);
                            }}
                            style={{
                                width: '100%', padding: '8px', marginBottom: '15px',
                                background: 'var(--background-primary)',
                                color: 'var(--text-normal)',
                                border: '1px solid var(--border-subtle)',
                                borderRadius: '4px',
                                outline: 'none'
                            }}
                        />
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                            <button onClick={() => setModalConfig(null)} style={{
                                padding: '6px 12px', background: 'transparent',
                                border: '1px solid var(--border-subtle)', color: 'var(--text-muted)',
                                borderRadius: '4px', cursor: 'pointer'
                            }}>
                                Отмена
                            </button>
                            <button onClick={handleModalSubmit} style={{
                                padding: '6px 12px', background: 'var(--interactive-accent)',
                                border: 'none', color: 'white',
                                borderRadius: '4px', cursor: 'pointer'
                            }}>
                                Создать
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Rename Modal */}
            {renameModal && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.5)', zIndex: 1000,
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                }} onClick={() => setRenameModal(null)}>
                    <div style={{
                        background: 'var(--background-secondary)', padding: '20px', borderRadius: '8px',
                        border: '1px solid var(--border-subtle)', width: '300px'
                    }} onClick={e => e.stopPropagation()}>
                        <div style={{ marginBottom: '10px', color: 'var(--text-normal)' }}>
                            Переименовать
                        </div>
                        <input
                            autoFocus
                            type="text"
                            value={renameValue}
                            onChange={e => setRenameValue(e.target.value)}
                            onKeyDown={e => {
                                if (e.key === 'Enter') handleRenameSubmit();
                                if (e.key === 'Escape') setRenameModal(null);
                            }}
                            style={{
                                width: '100%', padding: '8px', marginBottom: '15px',
                                background: 'var(--background-primary)',
                                color: 'var(--text-normal)',
                                border: '1px solid var(--border-subtle)',
                                borderRadius: '4px',
                                outline: 'none'
                            }}
                        />
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                            <button onClick={() => setRenameModal(null)} style={{
                                padding: '6px 12px', background: 'transparent',
                                border: '1px solid var(--border-subtle)', color: 'var(--text-muted)',
                                borderRadius: '4px', cursor: 'pointer'
                            }}>
                                Отмена
                            </button>
                            <button onClick={handleRenameSubmit} style={{
                                padding: '6px 12px', background: 'var(--interactive-accent)',
                                border: 'none', color: 'white',
                                borderRadius: '4px', cursor: 'pointer'
                            }}>
                                Переименовать
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {pinnedFiles.length > 0 && (
                <div style={{ marginBottom: '16px' }}>
                    <div style={{ 
                        marginBottom: '8px', 
                        fontSize: '12px', 
                        color: 'var(--text-muted)',
                        textTransform: 'uppercase' 
                    }}>
                        Закрепленные
                    </div>
                    {pinnedFiles.map(path => {
                        const name = getBasename(path) || path;
                        return (
                            <FileNode 
                                key={path} 
                                entry={{ name, path, isDirectory: false }} 
                                onSelect={onFileSelect} 
                                level={0} 
                                onContextMenu={handleContextMenu}
                                pinned={true}
                                activeFilePath={activeFilePath}
                                expandedFolders={expandedFolders}
                                onToggleExpand={handleToggleExpand}
                                childrenCache={childrenCache}
                                onUpdateChildren={handleUpdateChildren}
                            />
                        );
                    })}
                    <div style={{ height: '1px', background: 'var(--border-subtle)', margin: '8px 0' }} />
                </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div style={{ fontWeight: 'bold', fontSize: '13px' }}>FILES</div>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <div 
                        onClick={() => handleNewFile(rootPath)}
                        title="Новый файл"
                        style={{ cursor: 'pointer', opacity: 0.7, display: 'flex' }}
                    >
                        <FilePlus size={20} />
                    </div>
                    <div 
                        onClick={() => handleNewFolder(rootPath)}
                        title="Новая папка"
                        style={{ cursor: 'pointer', opacity: 0.7, display: 'flex' }}
                    >
                        <FolderPlus size={20} />
                    </div>
                </div>
            </div>
            {files.map(file => (
                <FileNode 
                    key={file.path} 
                    entry={file} 
                    onSelect={onFileSelect} 
                    level={0} 
                    onContextMenu={handleContextMenu} 
                    activeFilePath={activeFilePath}
                    expandedFolders={expandedFolders}
                    onToggleExpand={handleToggleExpand}
                    childrenCache={childrenCache}
                    onUpdateChildren={handleUpdateChildren}
                />
            ))}
            {contextMenu && (
                <ContextMenu
                    x={contextMenu.x}
                    y={contextMenu.y}
                    onClose={() => setContextMenu(null)}
                    onNewFile={() => handleNewFile(contextMenu.entry.path)}
                    onNewFolder={() => handleNewFolder(contextMenu.entry.path)}
                    onDelete={() => handleDelete(contextMenu.entry.path)}
                    onRename={() => openRenameModal(contextMenu.entry)}
                    isDirectory={contextMenu.entry.isDirectory}
                    onTogglePin={() => onTogglePin(contextMenu.entry.path)}
                    isPinned={pinnedFiles.includes(contextMenu.entry.path)}
                />
            )}
        </div>
    );
}
