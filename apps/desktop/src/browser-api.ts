const SESSION_KEY = 'talkcad-web-sessions';
const SETTINGS_KEY = 'talkcad-web-settings';

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function apiPost(path: string, body: unknown) {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  let data: any;
  try { data = JSON.parse(text); } catch { data = { error: text }; }
  if (!response.ok) throw new Error(data?.error || `Request failed (${response.status})`);
  return data;
}

function downloadBase64(path: string, base64: string) {
  const fileName = path.replace(/^download:\/\//, '') || 'download.bin';
  const bytes = base64ToBytes(base64);
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  const blob = new Blob([buffer], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function openBinaryFile(filters?: { name: string; extensions: string[] }[]) {
  return new Promise<{ path: string; name: string; base64: string } | null>((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    const extensions = (filters || []).flatMap((filter) => filter.extensions || []);
    if (extensions.length) input.accept = extensions.map((ext) => `.${ext}`).join(',');
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      const bytes = new Uint8Array(await file.arrayBuffer());
      resolve({ path: file.name, name: file.name, base64: bytesToBase64(bytes) });
    };
    input.oncancel = () => resolve(null);
    input.click();
  });
}

type WebSession = {
  id: string;
  path: string;
  meta: { name: string; created: string; modified: string };
  chat: unknown[];
  specs: Record<string, unknown>;
  code: string;
  stlData: string | null;
  history?: unknown;
};

function loadSessions(): WebSession[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(SESSION_KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveSessions(sessions: WebSession[]) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(sessions));
}

export function installBrowserApi() {
  if (typeof window === 'undefined' || (window as any).api) return;

  const api = {
    fs: {
      openFolder: async () => null,
      readDirectory: async () => [],
      readFile: async () => '',
      openBinaryFile,
      writeFile: async () => {},
      createFile: async () => {},
      deleteFile: async () => {},
      renameFile: async () => {},
      onFileChange: () => () => {},
    },

    openscad: {
      detectPath: async () => 'web-backend',
      setPath: async () => {},
      getVersion: async () => (await fetch('/api/status').then((r) => r.json())).openscadVersion || null,
      getLibrariesDir: async () => '',
      validate: async (code: string, options?: unknown) => apiPost('/api/openscad/validate', { code, options }),
      render: async (code: string, format: 'stl', options?: unknown) => apiPost('/api/openscad/render', { code, format, options }),
      parseStlStats: async (base64Data: string) => apiPost('/api/stl/stats', { base64Data }),
      renderImage: async (code: string, angle: string, options?: unknown) => apiPost('/api/openscad/image', { code, angle, options }),
    },

    slicer: {
      detect: async () => fetch('/api/status').then((r) => r.json()).then((s) => ({
        path: s.orcaAvailable ? 'web-backend' : null,
        available: Boolean(s.orcaAvailable),
        version: s.orcaVersion,
      })),
      profiles: async () => fetch('/api/slicer/profiles').then((r) => r.json()),
      setPath: async () => ({ success: false }),
      sliceStl: async (args: unknown) => apiPost('/api/slicer/slice', args),
    },

    cadquery: {
      detect: async () => fetch('/api/status').then((r) => r.json()).then((s) => ({
        available: Boolean(s.cadqueryAvailable),
        python: s.cadqueryAvailable ? 'web-backend' : null,
        version: s.cadqueryVersion || null,
      })),
      export: async (args: unknown) => apiPost('/api/cadquery/export', args),
    },

    printer: {
      test: async (args: unknown) => apiPost('/api/printer/test', args),
      upload: async (args: unknown) => apiPost('/api/printer/upload', args),
    },

    settings: {
      load: async () => {
        try { return JSON.parse(localStorage.getItem(SETTINGS_KEY) || 'null'); } catch { return null; }
      },
      save: async (settings: unknown) => localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)),
    },

    llm: {
      openrouterChat: async (args: unknown) => apiPost('/api/llm/openrouter-chat', args),
      openrouterModels: async (apiKey: string) => apiPost('/api/llm/openrouter-models', { apiKey }),
      openaiCompatChat: async (args: unknown) => apiPost('/api/llm/openai-chat', args),
      openaiCompatModels: async (args: unknown) => apiPost('/api/llm/openai-models', args),
    },

    menu: { onExportSTL: () => () => {} },

    dialog: {
      saveFile: async (options: { defaultPath?: string }) => `download://${options.defaultPath || 'download.bin'}`,
    },

    fsBinary: {
      writeFile: async (path: string, base64Data: string) => downloadBase64(path, base64Data),
    },

    session: {
      getProjectsDir: async () => 'browser-localStorage',
      list: async () => loadSessions()
        .map((session) => ({
          id: session.id,
          path: session.path,
          name: session.meta.name,
          created: session.meta.created,
          modified: session.meta.modified,
        }))
        .sort((a, b) => b.modified.localeCompare(a.modified)),
      create: async (name?: string) => {
        const now = new Date().toISOString();
        const id = `web-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const session: WebSession = {
          id,
          path: id,
          meta: { name: name || 'Untitled Design', created: now, modified: now },
          chat: [],
          specs: {},
          code: '',
          stlData: null,
        };
        const sessions = loadSessions();
        sessions.push(session);
        saveSessions(sessions);
        return { id, path: id, name: session.meta.name, created: now, modified: now };
      },
      load: async (sessionId: string) => loadSessions().find((session) => session.id === sessionId) || null,
      save: async (sessionId: string, data: Record<string, unknown>) => {
        const sessions = loadSessions();
        const index = sessions.findIndex((session) => session.id === sessionId);
        if (index < 0) throw new Error('Session not found');
        const current = sessions[index];
        const now = new Date().toISOString();
        sessions[index] = {
          ...current,
          chat: (data.chat as unknown[]) ?? current.chat,
          specs: (data.specs as Record<string, unknown>) ?? current.specs,
          code: (data.code as string) ?? current.code,
          stlData: (data.stlData as string) ?? current.stlData,
          history: data.history ?? current.history,
          meta: {
            ...current.meta,
            name: (data.name as string) ?? current.meta.name,
            modified: now,
          },
        };
        saveSessions(sessions);
        return sessions[index].meta;
      },
      delete: async (sessionId: string) => saveSessions(loadSessions().filter((session) => session.id !== sessionId)),
      rename: async (sessionId: string, newName: string) => {
        const sessions = loadSessions();
        const session = sessions.find((item) => item.id === sessionId);
        if (!session) throw new Error('Session not found');
        session.meta.name = newName;
        session.meta.modified = new Date().toISOString();
        saveSessions(sessions);
        return session.meta;
      },
      storeUserAsset: async () => ({ success: false, error: 'Browser assets are not persisted yet.' }),
      readAsset: async () => ({ success: false, error: 'Browser assets are not persisted yet.' }),
      listAssets: async () => ({ success: true, assets: [] }),
    },

    skills: {
      search: async (query: string, category?: string) => apiPost('/api/skills/search', { query, category }),
      getFull: async (path: string) => apiPost('/api/skills/get', { path }),
      create: async () => ({ success: false, error: 'Creating browser skills is not supported yet.' }),
    },

    vectorize: {
      image: async () => ({ success: false, error: 'Browser vectorization is not available yet.' }),
    },

    pdf: {
      extractImages: async () => ({ success: false, error: 'Browser PDF extraction is not available yet.' }),
    },

    fetch: {
      image: async (url: string) => {
        try {
          const response = await fetch(url);
          const bytes = new Uint8Array(await response.arrayBuffer());
          return { success: response.ok, base64: bytesToBase64(bytes), contentType: response.headers.get('content-type') || 'application/octet-stream' };
        } catch (error) {
          return { success: false, error: error instanceof Error ? error.message : String(error) };
        }
      },
      html: async (url: string) => {
        try {
          const response = await fetch(url);
          return { success: response.ok, html: await response.text() };
        } catch (error) {
          return { success: false, error: error instanceof Error ? error.message : String(error) };
        }
      },
    },
  };

  (window as any).api = api;
}
