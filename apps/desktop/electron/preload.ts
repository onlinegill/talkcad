import { contextBridge, ipcRenderer } from 'electron';

// Expose APIs to renderer process
contextBridge.exposeInMainWorld('api', {
  // File System
  fs: {
    openFolder: () => ipcRenderer.invoke('fs:openFolder'),
    readDirectory: (path: string) => ipcRenderer.invoke('fs:readDirectory', path),
    readFile: (path: string) => ipcRenderer.invoke('fs:readFile', path),
    openBinaryFile: (filters?: { name: string; extensions: string[] }[]) => ipcRenderer.invoke('fs:openBinaryFile', filters),
    writeFile: (path: string, content: string) =>
      ipcRenderer.invoke('fs:writeFile', path, content),
    createFile: (path: string) => ipcRenderer.invoke('fs:createFile', path),
    deleteFile: (path: string) => ipcRenderer.invoke('fs:deleteFile', path),
    renameFile: (oldPath: string, newPath: string) =>
      ipcRenderer.invoke('fs:renameFile', oldPath, newPath),
    onFileChange: (callback: (event: unknown) => void) => {
      ipcRenderer.on('fs:fileChange', (_, event) => callback(event));
      return () => ipcRenderer.removeAllListeners('fs:fileChange');
    },
  },

  // OpenSCAD
  openscad: {
    detectPath: () => ipcRenderer.invoke('openscad:detectPath'),
    setPath: (path: string) => ipcRenderer.invoke('openscad:setPath', path),
    getVersion: () => ipcRenderer.invoke('openscad:getVersion'),
    getLibrariesDir: () => ipcRenderer.invoke('openscad:getLibrariesDir'),
    validate: (code: string, options?: { mode?: 'preview' | 'final'; geometry?: boolean }) =>
      ipcRenderer.invoke('openscad:validate', code, options),
    render: (code: string, format: 'stl', options?: { mode?: 'preview' | 'final' }) =>
      ipcRenderer.invoke('openscad:render', code, format, options),
    parseStlStats: (base64Data: string) => ipcRenderer.invoke('openscad:parseStlStats', base64Data),
    renderImage: (code: string, angle: string, options?: { width?: number; height?: number }) =>
      ipcRenderer.invoke('openscad:renderImage', code, angle, options),
  },

  // OrcaSlicer / 3D printing
  slicer: {
    detect: () => ipcRenderer.invoke('slicer:detect'),
    profiles: () => ipcRenderer.invoke('slicer:profiles'),
    setPath: (path: string) => ipcRenderer.invoke('slicer:setPath', path),
    sliceStl: (args: {
      stlBase64: string;
      options?: {
        printerProfile?: string;
        processProfile?: string;
        filamentProfiles?: string[];
        autoOrient?: boolean;
        arrange?: boolean;
        ensureOnBed?: boolean;
        export3mf?: boolean;
        outputName?: string;
        inputFormat?: 'stl' | '3mf';
        layerHeight?: number;
        infillDensity?: number;
        infillPattern?: string;
        wallLoops?: number;
        enableSupport?: boolean;
        supportType?: string;
        sparseInfillSpeed?: number;
        initialLayerSpeed?: number;
        exportGcode3mf?: boolean;
        brimType?: string;
        brimWidth?: number;
        raftLayers?: number;
        skirtLoops?: number;
      };
    }) => ipcRenderer.invoke('slicer:sliceStl', args),
  },

  // Settings
  settings: {
    load: () => ipcRenderer.invoke('settings:load'),
    save: (settings: unknown) => ipcRenderer.invoke('settings:save', settings),
  },

  // LLM (proxied through main process)
  llm: {
    openrouterChat: (args: { apiKey: string; body: Record<string, unknown> }) =>
      ipcRenderer.invoke('llm:openrouterChat', args),
    openrouterModels: (apiKey: string) => ipcRenderer.invoke('llm:openrouterModels', apiKey),
    openaiCompatChat: (args: { kind: string; apiKey?: string; baseUrl: string; body: Record<string, unknown> }) =>
      ipcRenderer.invoke('llm:openaiCompatChat', args),
    openaiCompatModels: (args: { kind: string; apiKey?: string; baseUrl: string }) =>
      ipcRenderer.invoke('llm:openaiCompatModels', args),
  },

  // Menu events
  menu: {
    onExportSTL: (callback: () => void) => {
      const handler = () => callback();
      ipcRenderer.on('menu:exportSTL', handler);
      return () => ipcRenderer.removeListener('menu:exportSTL', handler);
    },
  },

  // Dialogs
  dialog: {
    saveFile: (options: { title?: string; defaultPath?: string; filters?: { name: string; extensions: string[] }[] }) =>
      ipcRenderer.invoke('dialog:saveFile', options),
  },

  // Extended fs for binary files
  fsBinary: {
    writeFile: (path: string, base64Data: string) => ipcRenderer.invoke('fs:writeBinaryFile', path, base64Data),
  },

  // Session management
  session: {
    getProjectsDir: () => ipcRenderer.invoke('session:getProjectsDir'),
    list: () => ipcRenderer.invoke('session:list'),
    create: (name?: string) => ipcRenderer.invoke('session:create', name),
    load: (sessionId: string) => ipcRenderer.invoke('session:load', sessionId),
    save: (sessionId: string, data: {
      chat?: unknown[];
      specs?: Record<string, unknown>;
      code?: string;
      stlData?: string;
      name?: string;
    }) => ipcRenderer.invoke('session:save', sessionId, data),
    delete: (sessionId: string) => ipcRenderer.invoke('session:delete', sessionId),
    rename: (sessionId: string, newName: string) => ipcRenderer.invoke('session:rename', sessionId, newName),
    // Asset management
    storeUserAsset: (args: { sessionId: string; base64: string; name?: string; mimeType?: string }) =>
      ipcRenderer.invoke('session:storeUserAsset', args),
    readAsset: (args: { sessionId: string; assetPath: string }) =>
      ipcRenderer.invoke('session:readAsset', args),
    listAssets: (sessionId: string) =>
      ipcRenderer.invoke('session:listAssets', sessionId),
  },

  // Skills database (built-in knowledge)
  skills: {
    search: (query: string, category?: string) => ipcRenderer.invoke('skills:search', { query, category }),
    getFull: (path: string, sessionId?: string) => ipcRenderer.invoke('skills:getFull', { path, sessionId }),
    create: (args: { title: string; tags: string[]; content: string; category?: string; schematicBase64?: string }) =>
      ipcRenderer.invoke('skills:create', args),
  },

  // Image vectorization
  vectorize: {
    image: (args: { base64?: string; imagePath?: string; sessionId: string; name?: string; threshold?: number }) =>
      ipcRenderer.invoke('vectorize:image', args),
  },

  // PDF parsing
  pdf: {
    extractImages: (args: { url?: string; base64?: string; sessionId?: string; name?: string }) =>
      ipcRenderer.invoke('pdf:extractImages', args),
  },

  // HTTP fetch (for images, bypasses CORS)
  fetch: {
    image: (url: string, options?: { sessionId?: string; name?: string }) =>
      ipcRenderer.invoke('fetch:image', url, options),
    html: (url: string) => ipcRenderer.invoke('fetch:html', url),
  },
});

// Type declaration for renderer
declare global {
  interface Window {
    api: {
      fs: {
        openFolder(): Promise<string | null>;
        readDirectory(path: string): Promise<Array<{
          name: string;
          path: string;
          type: 'file' | 'directory';
        }>>;
        readFile(path: string): Promise<string>;
        openBinaryFile(filters?: { name: string; extensions: string[] }[]): Promise<{ path: string; name: string; base64: string } | null>;
        writeFile(path: string, content: string): Promise<void>;
        createFile(path: string): Promise<void>;
        deleteFile(path: string): Promise<void>;
        renameFile(oldPath: string, newPath: string): Promise<void>;
        onFileChange(callback: (event: unknown) => void): () => void;
      };
      openscad: {
        detectPath(): Promise<string | null>;
        setPath(path: string): Promise<void>;
        getVersion(): Promise<string | null>;
        getLibrariesDir(): Promise<string>;
        validate(
          code: string,
          options?: { mode?: 'preview' | 'final'; geometry?: boolean }
        ): Promise<{ valid: boolean; errors: string[]; warnings: string[] }>;
        render(code: string, format: 'stl', options?: { mode?: 'preview' | 'final' }): Promise<{
          success: boolean;
          format?: 'stl';
          output?: string;
          stats?: {
            dimensions: { x: number; y: number; z: number };
            volume: number;
            surfaceArea: number;
            manifold: boolean;
            triangles: number;
            renderTime: number;
          };
          errors?: string[];
          warnings?: string[];
        }>;
        parseStlStats(base64Data: string): Promise<{
          dimensions: { x: number; y: number; z: number };
          volume: number;
          surfaceArea: number;
          manifold: boolean;
          triangles: number;
          renderTime: number;
        } | null>;
        renderImage(
          code: string,
          angle: string,
          options?: { width?: number; height?: number }
        ): Promise<{ success: boolean; image?: string; error?: string }>;
      };
      slicer: {
        detect(): Promise<{ path: string | null; available: boolean; version?: string }>;
        profiles(): Promise<Array<{ name: string; path: string; kind: 'printer' | 'process' | 'filament' | 'other' }>>;
        setPath(path: string): Promise<{ success: boolean }>;
        sliceStl(args: {
          stlBase64: string;
          options?: {
            printerProfile?: string;
            processProfile?: string;
            filamentProfiles?: string[];
            autoOrient?: boolean;
            arrange?: boolean;
            ensureOnBed?: boolean;
            export3mf?: boolean;
            outputName?: string;
            inputFormat?: 'stl' | '3mf';
            layerHeight?: number;
            infillDensity?: number;
            infillPattern?: string;
            wallLoops?: number;
            enableSupport?: boolean;
            supportType?: string;
            sparseInfillSpeed?: number;
            initialLayerSpeed?: number;
            exportGcode3mf?: boolean;
            brimType?: string;
            brimWidth?: number;
            raftLayers?: number;
            skirtLoops?: number;
          };
        }): Promise<{
          success: boolean;
          gcodeBase64?: string;
          gcodeName?: string;
          project3mfBase64?: string;
          project3mfName?: string;
          gcode3mfBase64?: string;
          gcode3mfName?: string;
          estimatedTimeSeconds?: number;
          filamentUsedMm?: number;
          filamentUsedGrams?: number;
          stdout: string;
          stderr: string;
          error?: string;
        }>;
      };
      settings: {
        load(): Promise<unknown>;
        save(settings: unknown): Promise<void>;
      };
      llm: {
        openrouterChat(args: {
          apiKey: string;
          body: Record<string, unknown>;
        }): Promise<{ ok: true; data: unknown } | { ok: false; error: string }>;
        openrouterModels(apiKey: string): Promise<{ ok: true; data: unknown } | { ok: false; error: string }>;
        openaiCompatChat(args: {
          kind: string;
          apiKey?: string;
          baseUrl: string;
          body: Record<string, unknown>;
        }): Promise<{ ok: true; data: unknown } | { ok: false; error: string }>;
        openaiCompatModels(args: {
          kind: string;
          apiKey?: string;
          baseUrl: string;
        }): Promise<{ ok: true; data: unknown } | { ok: false; error: string }>;
      };
      menu: {
        onExportSTL(callback: () => void): () => void;
      };
      dialog: {
        saveFile(options: { title?: string; defaultPath?: string; filters?: { name: string; extensions: string[] }[] }): Promise<string | null>;
      };
      fsBinary: {
        writeFile(path: string, base64Data: string): Promise<void>;
      };
      session: {
        getProjectsDir(): Promise<string>;
        list(): Promise<Array<{
          id: string;
          path: string;
          name: string;
          created: string;
          modified: string;
        }>>;
        create(name?: string): Promise<{
          id: string;
          path: string;
          name: string;
          created: string;
          modified: string;
        }>;
        load(sessionId: string): Promise<{
          id: string;
          path: string;
          meta: { name: string; created: string; modified: string };
          chat: unknown[];
          specs: Record<string, unknown>;
          code: string;
          stlData: string | null;
          history?: unknown;
        } | null>;
        save(sessionId: string, data: {
          chat?: unknown[];
          specs?: Record<string, unknown>;
          code?: string;
          stlData?: string;
          name?: string;
          history?: unknown;
        }): Promise<{ name: string; created: string; modified: string }>;
        delete(sessionId: string): Promise<void>;
        rename(sessionId: string, newName: string): Promise<{ name: string; created: string; modified: string }>;
        // Asset management
        storeUserAsset(args: { sessionId: string; base64: string; name?: string; mimeType?: string }): Promise<{
          success: boolean;
          path?: string;
          absolutePath?: string;
          filename?: string;
          sizeBytes?: number;
          error?: string;
        }>;
        readAsset(args: { sessionId: string; assetPath: string }): Promise<{
          success: boolean;
          base64?: string;
          contentType?: string;
          sizeBytes?: number;
          error?: string;
        }>;
        listAssets(sessionId: string): Promise<{
          success: boolean;
          assets?: Array<{
            name: string;
            path: string;
            type: 'image' | 'svg' | 'pdf' | 'other';
            size: number;
            created: string;
            modified: string;
          }>;
          error?: string;
        }>;
      };
      skills: {
        search(query: string, category?: string): Promise<Array<{
          title: string;
          tags: string[];
          preview: string;
          path: string;
          source: 'builtin' | 'user';
        }>>;
        getFull(path: string, sessionId?: string): Promise<{
          title: string;
          tags: string[];
          content: string;
          path: string;
          source: 'builtin' | 'user';
          schematic?: { type: 'svg' | 'png'; path: string };
        } | null>;
        create(args: { title: string; tags: string[]; content: string; category?: string; schematicBase64?: string }): Promise<{
          success: boolean;
          path?: string;
          message?: string;
          error?: string;
        }>;
      };
      vectorize: {
        image(args: { base64?: string; imagePath?: string; sessionId: string; name?: string; threshold?: number }): Promise<{
          success: boolean;
          path?: string;
          absolutePath?: string;
          svg?: string;
          error?: string;
          note?: string;
        }>;
      };
      pdf: {
        extractImages(args: { url?: string; base64?: string; sessionId?: string; name?: string }): Promise<{
          success: boolean;
          pageCount?: number;
          text?: string;
          metadata?: unknown;
          images?: { base64?: string; path?: string; index: number; width: number; height: number; sizeBytes: number }[];
          imageCount?: number;
          stored?: boolean;
          error?: string;
        }>;
      };
      fetch: {
        image(url: string, options?: { sessionId?: string; name?: string }): Promise<{
          success: boolean;
          base64?: string;
          contentType?: string;
          error?: string;
          // When sessionId provided, returns path instead of base64
          stored?: boolean;
          path?: string;
          absolutePath?: string;
          sizeBytes?: number;
          message?: string;
        }>;
        html(url: string): Promise<{ success: boolean; html?: string; error?: string }>;
      };
    };
  }
}
