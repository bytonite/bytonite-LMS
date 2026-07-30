import { useState, useEffect, useRef } from 'react';
import { getBasename } from './utils/path';
import FileExplorer from './components/FileExplorer';
import Editor from './components/Editor';
import CommandPalette from './components/CommandPalette';
import TabBar from './components/TabBar';
import SearchPanel from './components/SearchPanel';
import StatusBar from './components/StatusBar';
import Preview from './components/Preview';
import PinModal from './components/PinModal';
import TemplateSidebar from './components/TemplateSidebar';
import PropertiesPanel from './components/PropertiesPanel';
import MediaViewer from './components/MediaViewer';
import { Sun, Moon, FileText, Eye, PenLine, FolderOpen, ExternalLink, Lock, Layout, Columns, PanelLeft } from 'lucide-react';



interface OpenFile {
  path: string;
  content: string;
}

function App() {
  const [rootPath, setRootPath] = useState<string>('');
  const [openFiles, setOpenFiles] = useState<OpenFile[]>([]);
  const [activeFilePath, setActiveFilePath] = useState<string>('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [allFiles, setAllFiles] = useState<string[]>([]);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [editorStats, setEditorStats] = useState({ words: 0, chars: 0, line: 1, col: 1 });
  const [pinnedFiles, setPinnedFiles] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [templatePaletteOpen, setTemplatePaletteOpen] = useState(false);
  const [templates, setTemplates] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<'edit' | 'preview' | 'split'>('preview');
  const [pinModalOpen, setPinModalOpen] = useState(false);
  const [pinModalPurpose, setPinModalPurpose] = useState<'edit' | 'fileOps'>('edit');
  const [isUnlocked, setIsUnlocked] = useState(true); // PIN disabled by default
  const [pendingFileOperation, setPendingFileOperation] = useState<(() => void) | null>(null);
  const [openLinksInNewTab, setOpenLinksInNewTab] = useState(true);
  const [mediaFile, setMediaFile] = useState<{ path: string; name: string } | null>(null);
  const [contentWidth, setContentWidth] = useState<number>(() => {
    const saved = localStorage.getItem('contentWidth');
    return saved ? Number(saved) : 800; // Default 800px
  });

  const handleWidthChange = (width: number) => {
    setContentWidth(width);
    localStorage.setItem('contentWidth', String(width));
  };

  const handleTogglePin = (path: string) => {
    setPinnedFiles(prev => 
      prev.includes(path) ? prev.filter(p => p !== path) : [...prev, path]
    );
  };

  const activeFile = openFiles.find(f => f.path === activeFilePath);

  const [designMode, setDesignMode] = useState(false);
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(250);
  const [isResizingSidebar, setIsResizingSidebar] = useState(false);
  const [selectedBlocks, setSelectedBlocks] = useState<HTMLElement[]>([]);
  const [activeSourcePos, setActiveSourcePos] = useState<string | null>(null);
  const previewSaveRef = useRef<(() => string) | null>(null);

  const handleSidebarMouseDown = (e: React.MouseEvent) => {
    setIsResizingSidebar(true);
    e.preventDefault();
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizingSidebar) return;
      const newWidth = Math.max(150, Math.min(e.clientX, 800));
      setSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizingSidebar(false);
    };

    if (isResizingSidebar) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    } else {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizingSidebar]);

  // Clear selection when exiting design mode
  useEffect(() => {
      if (!designMode) setSelectedBlocks([]);
  }, [designMode]);

  const saveAndExitDesignMode = () => {
      // Save content if coming from Design Mode
      if (designMode) {
          const content = previewSaveRef.current?.();
          if (content && activeFile) {
              handleContentChange(content);
          }
      }
      setDesignMode(false);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        // Ctrl+E or Cmd+E to toggle Design Mode
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'e') {
            e.preventDefault();
            
            if (designMode) {
                saveAndExitDesignMode();
            } else {
                // Enter Design Mode
                setViewMode('preview');
                setDesignMode(true);
            }
        }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [designMode, activeFile]); // Dependencies ensure fresh activeFile

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    // Global keyboard shortcuts
    const handleKeyDown = (e: KeyboardEvent) => {
      // Command Palette
      if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
        e.preventDefault();
        setPaletteOpen(true);
      }
      
      // Close current tab
      if ((e.ctrlKey || e.metaKey) && e.key === 'w') {
        e.preventDefault();
        if (activeFilePath) {
          handleTabClose(activeFilePath);
        }
      }
      
      // Switch tabs with Ctrl+Tab / Ctrl+Shift+Tab
      if ((e.ctrlKey || e.metaKey) && e.key === 'Tab') {
        e.preventDefault();
        const currentIndex = openFiles.findIndex(f => f.path === activeFilePath);
        if (currentIndex !== -1) {
          const nextIndex = e.shiftKey 
            ? (currentIndex - 1 + openFiles.length) % openFiles.length
            : (currentIndex + 1) % openFiles.length;
          setActiveFilePath(openFiles[nextIndex].path);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeFilePath, openFiles]);

  useEffect(() => {
    if (!rootPath || !window.electronAPI) return;
    
    const collectFiles = async (dir: string): Promise<string[]> => {
      const entries = await window.electronAPI.readDir(dir);
      const files: string[] = [];
      for (const entry of entries) {
        if (entry.isDirectory) {
          files.push(...await collectFiles(entry.path));
        } else if (entry.name.match(/\.(md|png|jpg|jpeg|gif|bmp|webp|svg|mp4|webm|ogv|mkv)$/i)) {
          files.push(entry.path);
        }
      }
      return files;
    };
    collectFiles(rootPath).then(setAllFiles);
  }, [rootPath, refreshKey]);

  // Initialize rootPath on app startup
  useEffect(() => {
    if (!rootPath) {
      if (!window.electronAPI) {
        console.warn('Running without Electron, file system is disabled');
        return;
      }
      // Set default vault path to the current directory where the app is running
      window.electronAPI.getAppPath().then(path => {
        setRootPath(path);
      });
    }
  }, []);

  const handleOpenVault = async () => {
    const path = await window.electronAPI.selectDirectory();
    if (path) {
      setRootPath(path);
      setOpenFiles([]);
      setActiveFilePath('');
    }
  };

  const handleFileSelect = async (path: string) => {
    // Check if it's a media file (image or video)
    const mediaExtensions = /\.(png|jpg|jpeg|gif|bmp|webp|svg|mp4|webm|ogv|mkv|mov|avi)$/i;
    if (mediaExtensions.test(path)) {
      // Display media files in the built-in viewer
      const name = getBasename(path) || path;
      setMediaFile({ path, name });
      setActiveFilePath(''); // Clear active text file
      return;
    }
    
    // Clear media file when opening text file
    setMediaFile(null);

    // Check if file is already open
    const existingFile = openFiles.find(f => f.path === path);
    
    if (existingFile) {
      // Just switch to that tab
      setActiveFilePath(path);
    } else {
      // Load and open new file
      try {
        const content = await window.electronAPI.readFile(path);
        
        if (openLinksInNewTab) {
             setOpenFiles(prev => [...prev, { path, content }]);
        } else {
             // Replace current tab if exists, or append if empty
             setOpenFiles(prev => {
                 if (prev.length === 0) return [{ path, content }];
                 return prev.map(f => f.path === activeFilePath ? { path, content } : f);
             });
        }
        
        setActiveFilePath(path);
      } catch (e) {
        console.error("Failed to load file:", path, e);
        alert(`Не удалось открыть файл: ${path}`);
      }
    }
  };

  const handleLinkNavigation = async (linkText: string) => {
    // Find file matching the link text
    // Find file matching the link text
    const matchingFile = allFiles.find(file => {
      const fileName = getBasename(file).replace('.md', '');
      return fileName?.toLowerCase() === linkText.toLowerCase();
    });
    
    if (matchingFile) {
      handleFileSelect(matchingFile);
    } else {
      alert(`Файл "${linkText}" не найден`);
    }
  };

  const handleTagClick = (tag: string) => {
      setSearchQuery(tag);
  };

  const handlePinSubmit = (pin: string) => {
      if (pin === "1566015") {
          setIsUnlocked(true);
          // Выполнить отложенную операцию
          if (pendingFileOperation) {
              pendingFileOperation();
              setPendingFileOperation(null);
          }
          setPinModalOpen(false);
          return true;
      } else {
          return false;
      }
  };
  
  const requestFileOperation = (operation: () => void) => {
      if (isUnlocked) {
          // Уже авторизован - выполняем сразу
          operation();
      } else {
          // Нужна авторизация - показываем PIN
          setPinModalPurpose('fileOps');
          setPendingFileOperation(() => operation);
          setPinModalOpen(true);
      }
  };

  const loadTemplates = async () => {
      if (!rootPath) return;
      const templatesPath = `${rootPath}/Templates`;
      try {
          // Check if folder exists, if not create it (handled by logic or user?)
          // For now, try to read it. If error, maybe create?
          // Let's just try to read dir.
          // Note: window.electronAPI.createFolder might be needed if it fails.
          // For simplicity, let's assume if read fails we try to create ONE time.
          try {
              const entries = await window.electronAPI.readDir(templatesPath);
              setTemplates(entries.filter(e => e.name.endsWith('.md')).map(e => e.path));
          } catch (e) {
              // Create folder
              await window.electronAPI.createFolder(templatesPath);
              // Create a default template?
              await window.electronAPI.createFile(`${templatesPath}/Daily Note.md`, '# Daily Note\n\n- [ ] ');
              setTemplates([`${templatesPath}/Daily Note.md`]);
          }
      } catch (err) {
          console.error('Error loading templates:', err);
      }
  };

  const handleTemplateSelect = async (path: string) => {
      if (!activeFilePath) return;
      try {
          const templateContent = await window.electronAPI.readFile(path);
          // Append to current file
          const currentContent = activeFile?.content || '';
          const newContent = currentContent + '\n' + templateContent;
          handleContentChange(newContent);
      } catch (err) {
          console.error('Failed to insert template:', err);
      }
  };

  const handleTabClose = (path: string) => {
    setOpenFiles(prev => {
      const filtered = prev.filter(f => f.path !== path);
      // If closing active tab, switch to another
      if (path === activeFilePath && filtered.length > 0) {
        setActiveFilePath(filtered[filtered.length - 1].path);
      } else if (filtered.length === 0) {
        setActiveFilePath('');
      }
      return filtered;
    });
  };

  const saveTimeouts = useRef<Record<string, NodeJS.Timeout>>({});

  const handleContentChange = (newContent: string) => {
    // Update content in openFiles array
    setOpenFiles(prev => prev.map(f => 
      f.path === activeFilePath ? { ...f, content: newContent } : f
    ));
    
    if (activeFilePath) {
        if (saveTimeouts.current[activeFilePath]) {
            clearTimeout(saveTimeouts.current[activeFilePath]);
        }
        saveTimeouts.current[activeFilePath] = setTimeout(() => {
            window.electronAPI.writeFile(activeFilePath, newContent);
            delete saveTimeouts.current[activeFilePath];
        }, 1000);
    }
  };

  return (
    <>
      <div className="title-bar">
        <div className="header-left" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button 
            onClick={() => setSidebarVisible(!sidebarVisible)} 
            title="Переключить боковую панель" 
            className={`header-button ${sidebarVisible ? 'active' : ''}`}
          >
            <PanelLeft size={22} />
          </button>
          <div className="header-title">Obsidian Clone - {activeFile ? getBasename(activeFile.path) : 'Untitled'}</div>
        </div>
        <div className="header-actions" style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: '8px', alignItems: 'center' }}>
          {/* File Operations Group */}
          <div className="button-group">
            <button onClick={handleOpenVault} title="Открыть папку (Vault)" className="header-button">
              <FolderOpen size={22} />
            </button>
            <button onClick={() => { loadTemplates(); setTemplatePaletteOpen(true); }} title="Вставить шаблон" className="header-button">
              <FileText size={22} />
            </button>
          </div>

          <div className="header-separator" />
          
          {/* View Mode Group */}
          {!isUnlocked ? (
               <button onClick={() => { setPinModalPurpose('edit'); setPinModalOpen(true); }} title="Разблокировать редактирование" className="header-button">
                  <Lock size={22} />
               </button>
          ) : (
             <div className="button-group">
                <button 
                    onClick={() => { 
                        if (designMode) saveAndExitDesignMode();
                        else setDesignMode(false);
                        setViewMode('preview'); 
                    }} 
                    title="Режим чтения" 
                    className={`header-button ${viewMode === 'preview' && !designMode ? 'active' : ''}`}
                >
                    <Eye size={22} />
                </button>
                <button 
                    onClick={() => { 
                        if (!designMode) {
                            setViewMode('preview');
                            setDesignMode(true);
                        }
                    }} 
                    title="Визуальный редактор (Design Mode)" 
                    className={`header-button ${designMode ? 'active' : ''}`}
                >
                    <Layout size={22} />
                </button>
                <button 
                    onClick={() => { 
                        if (designMode) saveAndExitDesignMode();
                        setViewMode('edit'); 
                    }} 
                    title="Редактор кода (Source)" 
                    className={`header-button ${viewMode === 'edit' ? 'active' : ''}`}
                >
                    <PenLine size={22} />
                </button>
                <button 
                    onClick={() => { 
                        if (designMode) saveAndExitDesignMode();
                        setViewMode('split'); 
                    }} 
                    title="Разделенный экран (Live Preview)" 
                    className={`header-button ${viewMode === 'split' ? 'active' : ''}`}
                >
                    <Columns size={22} />
                </button>
             </div>
          )}

          <div className="header-separator" />

          {/* Settings Group */}
          <div className="button-group">
            {theme === 'dark' ? (
              <button onClick={() => setTheme('light')} title="Светлая тема" className="header-button">
                  <Sun size={22} />
              </button>
            ) : (
              <button onClick={() => setTheme('dark')} title="Темная тема" className="header-button">
                  <Moon size={22} />
              </button>
            )}
            <button 
              onClick={() => setOpenLinksInNewTab(!openLinksInNewTab)} 
              title={openLinksInNewTab ? "Ссылки открываются в новой вкладке" : "Ссылки открываются в текущей вкладке"}
              className={`header-button ${openLinksInNewTab ? 'active' : ''}`}
            >
              <ExternalLink size={22} />
            </button>
          </div>
        </div>
      </div>
      <div className="split-layout">
        {sidebarVisible && (
          <>
            <aside className="sidebar" style={{ width: `${sidebarWidth}px` }}>
              {rootPath && <FileExplorer 
            key={refreshKey} 
            rootPath={rootPath} 
            onFileSelect={handleFileSelect} 
            pinnedFiles={pinnedFiles}
            onTogglePin={handleTogglePin}
            onRequestFileOp={requestFileOperation}
            activeFilePath={activeFilePath}
          />}
          {rootPath && <SearchPanel 
            rootPath={rootPath} 
            onFileSelect={handleFileSelect}
            externalQuery={searchQuery}
            onQueryChange={setSearchQuery}
          />}
            </aside>
            <div 
              className="sidebar-resizer" 
              onMouseDown={handleSidebarMouseDown}
            />
          </>
        )}
        <TemplateSidebar visible={viewMode === 'preview' && designMode} rootPath={rootPath} />
        <main className="editor-container">
          {openFiles.length > 0 && (
            <TabBar
              tabs={openFiles.map(f => ({ path: f.path, name: getBasename(f.path) || f.path }))}
              activeTab={activeFilePath}
              onTabSelect={setActiveFilePath}
              onTabClose={handleTabClose}
            />
          )}
          {mediaFile ? (
            <div style={{ 
                flex: 1, 
                overflow: 'hidden', 
                width: '100%',
                display: 'flex',
                justifyContent: 'center',
                backgroundColor: 'var(--background-primary)'
            }}>
                <MediaViewer filePath={mediaFile.path} fileName={mediaFile.name} />
            </div>
          ) : activeFile ? (
            <div style={{ 
                flex: 1, 
                overflow: 'hidden', 
                width: '100%',
                display: 'flex',
                justifyContent: 'center',
                backgroundColor: 'var(--background-primary)'
            }}>
                <div style={{ 
                    width: '100%', 
                    maxWidth: viewMode === 'split' ? '100%' : (contentWidth >= 1600 ? '100%' : `${contentWidth}px`), 
                    height: '100%',
                    display: 'flex',
                    flexDirection: viewMode === 'split' ? 'row' : 'column',
                    transition: 'max-width 0.2s ease',
                    boxShadow: (viewMode !== 'split' && contentWidth < 1600) ? '0 0 20px rgba(0,0,0,0.1)' : 'none'
                }}>
                  {(viewMode === 'edit' || viewMode === 'split') && (
                    <div style={{ flex: 1, borderRight: viewMode === 'split' ? '1px solid var(--border-color)' : 'none', overflow: 'hidden' }}>
                        <Editor 
                            content={activeFile.content} 
                            onChange={handleContentChange} 
                            onNavigateLink={handleLinkNavigation}
                            onStatsUpdate={setEditorStats}
                            onTagClick={handleTagClick}
                            theme={theme}
                            activeSourcePos={activeSourcePos}
                            onSelectSourcePos={setActiveSourcePos}
                        />
                    </div>
                  )}
                  {(viewMode === 'preview' || viewMode === 'split') && (
                    <div style={{ flex: 1, overflow: 'hidden' }}>
                        <Preview 
                            content={activeFile.content} 
                            filePath={activeFile.path} 
                            allFiles={allFiles}
                            onFileSelect={handleFileSelect}
                            designMode={designMode}
                            onRegisterSave={(saveFn) => {
                                previewSaveRef.current = saveFn;
                            }}
                            onAutoSave={handleContentChange}
                            selectedBlocks={selectedBlocks}
                            onSelectBlocks={setSelectedBlocks}
                            rootPath={rootPath}
                            onRefresh={() => setRefreshKey(k => k + 1)}
                            activeSourcePos={activeSourcePos}
                            onSelectSourcePos={setActiveSourcePos}
                        />
                    </div>
                  )}
                </div>
            </div>
          ) : (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                gap: '16px',
                color: 'var(--text-muted)',
                padding: '40px'
              }}>
                <FileText size={48} style={{ opacity: 0.3 }} />
                <div style={{ fontSize: '18px', fontWeight: 500 }}>Выберите файл для просмотра</div>
                <div style={{ fontSize: '14px', textAlign: 'center', maxWidth: '400px', lineHeight: '1.6' }}>
                  Откройте файл из проводника слева или используйте <kbd style={{
                    background: 'var(--background-secondary)',
                    padding: '2px 6px',
                    borderRadius: '3px',
                    border: '1px solid var(--border-subtle)',
                    fontFamily: 'monospace',
                    fontSize: '12px'
                  }}>Ctrl+P</kbd> для быстрого поиска
                </div>
              </div>
          )}
        </main>
      {/* Properties Panel (Right Sidebar) */}
      {designMode && selectedBlocks.length > 0 && (
           <PropertiesPanel 
               blocks={selectedBlocks} 
               onUpdate={() => setSelectedBlocks(prev => [...prev])} // Force re-render if needed
               onBlockDelete={() => setSelectedBlocks([])}
           />
      )}
      </div>
      <StatusBar 
        wordCount={editorStats.words} 
        charCount={editorStats.chars} 
        line={editorStats.line} 
        column={editorStats.col}
        contentWidth={contentWidth}
        onWidthChange={handleWidthChange}
      />
      <CommandPalette 
        isOpen={paletteOpen} 
        onClose={() => setPaletteOpen(false)} 
        files={allFiles}
        onFileSelect={handleFileSelect}
      />
      <CommandPalette 
        isOpen={templatePaletteOpen} 
        onClose={() => setTemplatePaletteOpen(false)} 
        files={templates}
        onFileSelect={handleTemplateSelect}
        title="Выберите шаблон для вставки"
      />
      <PinModal 
        isOpen={pinModalOpen}
        onClose={() => setPinModalOpen(false)}
        onSubmit={handlePinSubmit}
        purpose={pinModalPurpose}
      />

    </>
  );
}

export default App;
