import { ipcMain } from 'electron';

export type RemotePrinterKind = 'octoprint' | 'moonraker';

interface RemotePrinterUploadArgs {
  kind: RemotePrinterKind;
  baseUrl: string;
  apiKey?: string;
  fileName: string;
  gcodeBase64: string;
  startPrint?: boolean;
}

function cleanBaseUrl(url: string): string {
  return url.trim().replace(/\/+$/, '');
}

function authHeaders(kind: RemotePrinterKind, apiKey?: string): HeadersInit {
  if (!apiKey?.trim()) return {};
  if (kind === 'octoprint') return { 'X-Api-Key': apiKey.trim() };
  return { 'X-Api-Key': apiKey.trim() };
}

async function uploadOctoPrint(args: RemotePrinterUploadArgs) {
  const url = `${cleanBaseUrl(args.baseUrl)}/api/files/local`;
  const form = new FormData();
  form.append('file', new Blob([Buffer.from(args.gcodeBase64, 'base64')], { type: 'application/octet-stream' }), args.fileName);
  form.append('select', 'true');
  form.append('print', args.startPrint ? 'true' : 'false');

  const response = await fetch(url, {
    method: 'POST',
    headers: authHeaders('octoprint', args.apiKey),
    body: form,
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`OctoPrint upload failed (${response.status}): ${text.slice(0, 1000)}`);
  return { success: true, status: response.status, response: text };
}

async function uploadMoonraker(args: RemotePrinterUploadArgs) {
  const url = `${cleanBaseUrl(args.baseUrl)}/server/files/upload`;
  const form = new FormData();
  form.append('file', new Blob([Buffer.from(args.gcodeBase64, 'base64')], { type: 'application/octet-stream' }), args.fileName);
  form.append('root', 'gcodes');
  if (args.startPrint) form.append('print', 'true');

  const response = await fetch(url, {
    method: 'POST',
    headers: authHeaders('moonraker', args.apiKey),
    body: form,
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Moonraker upload failed (${response.status}): ${text.slice(0, 1000)}`);
  return { success: true, status: response.status, response: text };
}

export function registerPrinterHandlers() {
  ipcMain.handle('printer:test', async (_, args: { kind: RemotePrinterKind; baseUrl: string; apiKey?: string }) => {
    try {
      const base = cleanBaseUrl(args.baseUrl);
      const url = args.kind === 'octoprint'
        ? `${base}/api/version`
        : `${base}/printer/info`;
      const response = await fetch(url, { headers: authHeaders(args.kind, args.apiKey) });
      const text = await response.text();
      return response.ok
        ? { success: true, status: response.status, response: text }
        : { success: false, status: response.status, error: text };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  ipcMain.handle('printer:upload', async (_, args: RemotePrinterUploadArgs) => {
    try {
      if (!args?.baseUrl || !args?.gcodeBase64 || !args?.fileName) {
        return { success: false, error: 'Printer URL, file name, and G-code are required.' };
      }
      return args.kind === 'octoprint'
        ? await uploadOctoPrint(args)
        : await uploadMoonraker(args);
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });
}
