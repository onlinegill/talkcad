import { app, ipcMain } from 'electron';
import { spawn } from 'child_process';
import { mkdtemp, readFile, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

export interface CadQuerySpec {
  primitive: 'box' | 'cylinder' | 'sphere';
  width?: number;
  depth?: number;
  height?: number;
  diameter?: number;
  features?: Array<Record<string, unknown>>;
}

function runnerPath(): string {
  return app.isPackaged
    ? join(process.resourcesPath, 'cadquery', 'runner.py')
    : join(app.getAppPath(), 'assets', 'cadquery', 'runner.py');
}

function run(command: string, args: string[], timeoutMs = 120_000) {
  return new Promise<{ code: number | null; stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
    child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    child.on('error', reject);
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error('CadQuery timed out'));
    }, timeoutMs);
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr });
    });
  });
}

async function detectPythonWithCadQuery() {
  const candidates = process.platform === 'win32' ? ['python', 'py'] : ['python3', 'python'];
  for (const candidate of candidates) {
    try {
      const result = await run(candidate, ['-c', 'import cadquery as cq; print(cq.__version__)'], 15_000);
      if (result.code === 0) {
        return { available: true, python: candidate, version: result.stdout.trim() };
      }
    } catch {
      // try next executable
    }
  }
  return { available: false, python: null, version: null };
}

async function exportCadQuery(spec: CadQuerySpec, format: 'step' | 'stl') {
  const detected = await detectPythonWithCadQuery();
  if (!detected.available || !detected.python) {
    return {
      success: false,
      error: 'CadQuery is not installed. Install it in Python, then restart TalkCAD.',
    };
  }

  const dir = await mkdtemp(join(tmpdir(), 'talkcad-cq-'));
  const specPath = join(dir, 'spec.json');
  const outputPath = join(dir, format === 'step' ? 'model.step' : 'model.stl');

  try {
    await writeFile(specPath, JSON.stringify(spec), 'utf8');
    const result = await run(detected.python, [
      runnerPath(),
      '--spec', specPath,
      '--output', outputPath,
      '--format', format,
    ]);

    if (result.code !== 0) {
      let error = result.stderr.trim() || result.stdout.trim() || 'CadQuery export failed';
      try {
        const parsed = JSON.parse(result.stdout.trim());
        if (parsed?.error) error = parsed.error;
      } catch {
        // keep raw error
      }
      return { success: false, error };
    }

    const data = await readFile(outputPath);
    return {
      success: true,
      format,
      output: data.toString('base64'),
      fileName: format === 'step' ? 'talkcad-model.step' : 'talkcad-model.stl',
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

export function registerCadQueryHandlers() {
  ipcMain.handle('cadquery:detect', async () => detectPythonWithCadQuery());
  ipcMain.handle('cadquery:export', async (_, args: { spec: CadQuerySpec; format: 'step' | 'stl' }) =>
    exportCadQuery(args.spec, args.format)
  );
}
