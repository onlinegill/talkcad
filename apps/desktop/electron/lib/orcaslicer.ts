import { access, mkdtemp, readFile, readdir, rm, writeFile } from 'fs/promises';
import { constants } from 'fs';
import { tmpdir } from 'os';
import { basename, extname, join } from 'path';
import { spawn } from 'child_process';

export interface OrcaSliceOptions {
  printerProfile?: string;
  processProfile?: string;
  filamentProfiles?: string[];
  autoOrient?: boolean;
  arrange?: boolean;
  ensureOnBed?: boolean;
  export3mf?: boolean;
  outputName?: string;
}

export interface OrcaSliceResult {
  success: boolean;
  gcodeBase64?: string;
  gcodeName?: string;
  project3mfBase64?: string;
  project3mfName?: string;
  stdout: string;
  stderr: string;
  error?: string;
}

let configuredPath: string | null = null;

const CANDIDATES = process.platform === 'darwin'
  ? [
      '/Applications/OrcaSlicer.app/Contents/MacOS/OrcaSlicer',
      '/Applications/OrcaSlicer.app/Contents/MacOS/orca-slicer',
      '/opt/homebrew/bin/orca-slicer',
      '/usr/local/bin/orca-slicer',
    ]
  : process.platform === 'win32'
    ? [
        'C:\\Program Files\\OrcaSlicer\\orca-slicer.exe',
        'C:\\Program Files\\OrcaSlicer\\OrcaSlicer.exe',
      ]
    : [
        '/usr/bin/orca-slicer',
        '/usr/local/bin/orca-slicer',
        '/opt/orca-slicer/orca-slicer',
      ];

async function executable(path: string): Promise<boolean> {
  try {
    await access(path, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

export async function detectOrcaSlicer(): Promise<string | null> {
  if (configuredPath && await executable(configuredPath)) return configuredPath;

  for (const candidate of CANDIDATES) {
    if (await executable(candidate)) {
      configuredPath = candidate;
      return candidate;
    }
  }
  return null;
}

export async function setOrcaSlicerPath(path: string): Promise<boolean> {
  if (!path || !await executable(path)) return false;
  configuredPath = path;
  return true;
}

async function run(command: string, args: string[], timeoutMs = 10 * 60_000) {
  return new Promise<{ code: number | null; stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
    child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    child.on('error', reject);

    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error('OrcaSlicer timed out'));
    }, timeoutMs);

    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr });
    });
  });
}

export async function getOrcaSlicerInfo(): Promise<{ path: string | null; available: boolean; version?: string }> {
  const path = await detectOrcaSlicer();
  if (!path) return { path: null, available: false };

  try {
    const result = await run(path, ['--help'], 15_000);
    const firstLine = (result.stdout || result.stderr).split(/\r?\n/).find(Boolean);
    return { path, available: true, version: firstLine?.trim() };
  } catch {
    return { path, available: true };
  }
}

export async function sliceStlBase64(
  base64Data: string,
  options: OrcaSliceOptions = {},
): Promise<OrcaSliceResult> {
  const slicerPath = await detectOrcaSlicer();
  if (!slicerPath) {
    return { success: false, stdout: '', stderr: '', error: 'OrcaSlicer was not found. Install OrcaSlicer or configure its executable path.' };
  }

  const workDir = await mkdtemp(join(tmpdir(), 'talkcad-orca-'));
  const inputPath = join(workDir, 'model.stl');
  const outputDir = join(workDir, 'output');
  const outputName = (options.outputName || 'model').replace(/[^a-zA-Z0-9._-]+/g, '-');

  try {
    const { mkdir } = await import('fs/promises');
    await mkdir(outputDir, { recursive: true });
    await writeFile(inputPath, Buffer.from(base64Data, 'base64'));

    const args: string[] = [inputPath];

    const settings = [options.processProfile, options.printerProfile].filter(Boolean) as string[];
    if (settings.length) args.push('--load-settings', settings.join(';'));
    if (options.filamentProfiles?.length) args.push('--load-filaments', options.filamentProfiles.join(';'));

    if (options.autoOrient !== false) args.push('--orient', '1');
    if (options.arrange !== false) args.push('--arrange', '1');
    if (options.ensureOnBed !== false) args.push('--ensure-on-bed');

    args.push('--outputdir', outputDir, '--slice', '0');

    const projectPath = join(outputDir, `${outputName}.3mf`);
    if (options.export3mf) args.push('--export-3mf', projectPath);

    const result = await run(slicerPath, args);
    const names = await readdir(outputDir);

    const gcodeFile = names.find((name) => /\.gcode$/i.test(name));
    const projectFile = options.export3mf
      ? names.find((name) => /\.3mf$/i.test(name))
      : undefined;

    if (result.code !== 0 || !gcodeFile) {
      return {
        success: false,
        stdout: result.stdout,
        stderr: result.stderr,
        error: !gcodeFile
          ? 'OrcaSlicer finished without producing a G-code file. Check that valid printer/process profiles are loaded.'
          : `OrcaSlicer exited with code ${result.code}`,
      };
    }

    const gcode = await readFile(join(outputDir, gcodeFile));
    const project = projectFile ? await readFile(join(outputDir, projectFile)) : null;

    return {
      success: true,
      gcodeBase64: gcode.toString('base64'),
      gcodeName: basename(gcodeFile, extname(gcodeFile)) + '.gcode',
      project3mfBase64: project?.toString('base64'),
      project3mfName: projectFile,
      stdout: result.stdout,
      stderr: result.stderr,
    };
  } catch (error) {
    return {
      success: false,
      stdout: '',
      stderr: '',
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}
