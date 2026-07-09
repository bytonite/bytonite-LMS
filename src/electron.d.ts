export {};

declare global {
  interface Window {
    electronAPI: {
      readDir: (path: string) => Promise<any[]>;
      readFile: (path: string) => Promise<string>;
      readFileAsArrayBuffer: (path: string) => Promise<ArrayBuffer>;
      writeFile: (path: string, content: string) => Promise<boolean>;
      getDocumentsPath: () => Promise<string>;
      getAppPath: () => Promise<string>;
      createFile: (path: string, content?: string) => Promise<boolean>;
      createFolder: (path: string) => Promise<boolean>;
      deletePath: (path: string) => Promise<boolean>;
      searchFiles: (rootPath: string, query: string) => Promise<{ path: string; matches: string[] }[]>;
      selectDirectory: () => Promise<string | null>;
      copyFile: (src: string, dest: string) => Promise<string>;
      saveBlob: (dest: string, buffer: number[]) => Promise<string>;
      openExternal: (path: string) => Promise<void>;
      renamePath: (oldPath: string, newPath: string) => Promise<string>;
    }
  }
}

