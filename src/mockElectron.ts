if (!window.electronAPI) {
  console.warn('Initializing mock electronAPI for browser development');
  
  const FAKE_ROOT = '/mock-vault';
  
  const getStorage = () => {
    try {
      const data = localStorage.getItem('mockFileSystem');
      return data ? JSON.parse(data) : {};
    } catch {
      return {};
    }
  };
  
  const saveStorage = (data: any) => {
    localStorage.setItem('mockFileSystem', JSON.stringify(data));
  };
  
  let fs = getStorage();
  if (!fs[FAKE_ROOT]) fs[FAKE_ROOT] = { isDirectory: true, name: 'mock-vault' };
  
  window.electronAPI = {
    getAppPath: async () => FAKE_ROOT,
    getDocumentsPath: async () => FAKE_ROOT,
    executeCode: async (language: string, code: string) => ({ success: true, output: `Mock execution for ${language}\n\n${code}` }),
    readDir: async (path: string) => {
      const currentFs = getStorage();
      const results = [];
      const normalizedPath = path.endsWith('/') ? path : path + '/';
      
      for (const key in currentFs) {
        if (key !== path && key.startsWith(normalizedPath)) {
          const relative = key.slice(normalizedPath.length);
          if (!relative.includes('/')) {
             results.push({
               name: currentFs[key].name || relative,
               path: key,
               isDirectory: currentFs[key].isDirectory
             });
          }
        }
      }
      return results;
    },
    readFile: async (path: string) => {
      const currentFs = getStorage();
      if (currentFs[path] && !currentFs[path].isDirectory) return currentFs[path].content || '';
      throw new Error('File not found: ' + path);
    },
    readFileAsArrayBuffer: async (_path: string) => {
      return new ArrayBuffer(0);
    },
    writeFile: async (path: string, content: string) => {
      const currentFs = getStorage();
      currentFs[path] = { isDirectory: false, content, name: path.split('/').pop() };
      saveStorage(currentFs);
      return true;
    },
    createFile: async (path: string, content = '') => {
      const currentFs = getStorage();
      currentFs[path] = { isDirectory: false, content, name: path.split('/').pop() };
      saveStorage(currentFs);
      return true;
    },
    createFolder: async (path: string) => {
      const currentFs = getStorage();
      currentFs[path] = { isDirectory: true, name: path.split('/').pop() };
      saveStorage(currentFs);
      return true;
    },
    deletePath: async (path: string) => {
      const currentFs = getStorage();
      for (const key in currentFs) {
        if (key === path || key.startsWith(path + '/')) {
          delete currentFs[key];
        }
      }
      saveStorage(currentFs);
      return true;
    },
    renamePath: async (oldPath: string, newPath: string) => {
      const currentFs = getStorage();
      if (currentFs[oldPath]) {
        currentFs[newPath] = { ...currentFs[oldPath], name: newPath.split('/').pop() };
        delete currentFs[oldPath];
        
        // Also rename children if it's a directory
        if (currentFs[newPath].isDirectory) {
          for (const key in currentFs) {
            if (key.startsWith(oldPath + '/')) {
               const childNewPath = key.replace(oldPath, newPath);
               currentFs[childNewPath] = { ...currentFs[key] };
               delete currentFs[key];
            }
          }
        }
        
        saveStorage(currentFs);
      }
      return newPath;
    },
    searchFiles: async (rootPath: string, query: string) => {
      const currentFs = getStorage();
      const results = [];
      const lowerQuery = query.toLowerCase();
      for (const key in currentFs) {
        if (key.startsWith(rootPath) && !currentFs[key].isDirectory && currentFs[key].content?.toLowerCase().includes(lowerQuery)) {
           results.push({ path: key, matches: [] });
        }
      }
      return results;
    },
    selectDirectory: async () => FAKE_ROOT,
    copyFile: async (src: string, dest: string) => {
      const currentFs = getStorage();
      if (currentFs[src]) {
        currentFs[dest] = { ...currentFs[src], name: dest.split('/').pop() };
        saveStorage(currentFs);
      }
      return dest;
    },
    saveBlob: async (dest: string, _buffer: number[]) => {
      return dest;
    },
    openExternal: async (path: string) => {
      window.open(path, '_blank');
    }
  };
  
  // Create an initial file if empty
  fs = getStorage();
  if (Object.keys(fs).length <= 1) {
    window.electronAPI.createFile(`${FAKE_ROOT}/Welcome.md`, '# Welcome to Mock Obsidian\nThis is running in the browser using a mocked file system (localStorage). Changes will be saved to your browser.');
  }
}
