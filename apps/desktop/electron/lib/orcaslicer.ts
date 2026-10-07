import { access, mkdtemp, readFile, readdir, rm, stat, writeFile } from 'fs/promises';
import { constants } from 'fs';
import { tmpdir } from 'os';
import { basename, dirname, extname, join } from 'path';
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
}

export interface OrcaProfile {
  name: string;
  path: string;
  kind: 'printer' | 'process' | 'filament' | 'other';
}

export interface OrcaSliceResult {
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

async function walkJson(root: string, depth = 0): Promise<string[]> {
  if (depth > 6) return [];
  try {
    const entries = await readdir(root, { withFileTypes: true });
    const nested = await Promise.all(entries.map(async (entry) => {
      const full = join(root, entry.name);
      if (entry.isDirectory()) return walkJson(full, depth + 1);
      return entry.isFile() && entry.name.toLowerCase().endsWith('.json') ? [full] : [];
    }));
    return nested.flat();
  } catch {
    return [];
  }
}

function profileKind(path: string): OrcaProfile['kind'] {
  const p = path.toLowerCase();
  if (p.includes('filament')) return 'filament';
  if (p.includes('process') || p.includes('print')) return 'process';
  if (p.includes('machine') || p.includes('printer')) return 'printer';
  return 'other';
}

export async function discoverOrcaProfiles(): Promise<OrcaProfile[]> {
  const slicerPath = await detectOrcaSlicer();
  if (!slicerPath) return [];

  const roots = new Set<string>();
  const binDir = dirname(slicerPath);

  if (process.platform === 'darwin' && slicerPath.includes('.app/Contents/MacOS/')) {
    roots.add(join(dirname(dirname(binDir)), 'Resources', 'profiles'));
    roots.add(join(dirname(dirname(binDir)), 'Resources', 'profiles', 'BBL'));
  } else {
    roots.add(join(binDir, 'resources', 'profiles'));
    roots.add(join(dirname(binDir), 'resources', 'profiles'));
    roots.add(join(binDir, 'profiles'));
  }

  const existingRoots: string[] = [];
  for (const root of roots) {
    try {
      if ((await stat(root)).isDirectory()) existingRoots.push(root);
    } catch {
      // ignore missing profile roots
    }
  }

  const files = (await Promise.all(existingRoots.map((root) => walkJson(root)))).flat();
  const profiles = files.map((path) => ({
    name: basename(path, '.json'),
    path,
    kind: profileKind(path),
  }));

  return profiles.sort((a, b) => a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name));
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

function parseGcodeEstimates(gcodeText: string): {
  estimatedTimeSeconds?: number;
  filamentUsedMm?: number;
  filamentUsedGrams?: number;
} {
  const timeMatch = gcodeText.match(/;\s*(?:estimated printing time|total estimated time)\s*[:=]\s*([^\r\n]+)/i);
  const filamentMm = gcodeText.match(/;\s*filament used \[mm\]\s*=\s*([0-9.]+)/i);
  const filamentG = gcodeText.match(/;\s*filament used \[g\]\s*=\s*([0-9.]+)/i);

  let estimatedTimeSeconds: number | undefined;
  if (timeMatch) {
    const text = timeMatch[1];
    const h = Number(text.match(/(\d+)h/i)?.[1] || 0);
    const m = Number(text.match(/(\d+)m/i)?.[1] || 0);
    const sec = Number(text.match(/(\d+)s/i)?.[1] || 0);
    estimatedTimeSeconds = h * 3600 + m * 60 + sec;
  }

  return {
    estimatedTimeSeconds,
    filamentUsedMm: filamentMm ? Number(filamentMm[1]) : undefined,
    filamentUsedGrams: filamentG ? Number(filamentG[1]) : undefined,
  };
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
  const inputPath = join(workDir, `model.${options.inputFormat || 'stl'}`);
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

    if (options.layerHeight && options.layerHeight > 0) {
      args.push(`--layer-height=${options.layerHeight}`);
    }
    if (options.infillDensity !== undefined) {
      const density = Math.max(0, Math.min(100, options.infillDensity));
      args.push(`--sparse-infill-density=${density}%`);
    }
    if (options.infillPattern) {
      args.push(`--sparse-infill-pattern=${options.infillPattern}`);
    }
    if (options.wallLoops !== undefined) {
      args.push(`--wall-loops=${Math.max(0, Math.floor(options.wallLoops))}`);
    }
    if (options.enableSupport !== undefined) {
      args.push(`--enable-support=${options.enableSupport ? 1 : 0}`);
    }
    if (options.enableSupport && options.supportType) {
      args.push(`--support-type=${options.supportType}`);
    }
    if (options.sparseInfillSpeed && options.sparseInfillSpeed > 0) {
      args.push(`--sparse-infill-speed=${options.sparseInfillSpeed}`);
    }
    if (options.initialLayerSpeed && options.initialLayerSpeed > 0) {
      args.push(`--initial-layer-speed=${options.initialLayerSpeed}`);
    }

    args.push('--outputdir', outputDir, '--slice', '0');

    const projectPath = join(outputDir, `${outputName}.3mf`);
    const gcode3mfPath = join(outputDir, `${outputName}.gcode.3mf`);
    if (options.exportGcode3mf) args.push('--export-3mf', gcode3mfPath);
    else if (options.export3mf) args.push('--export-3mf', projectPath);

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
    const gcode3mf = gcode3mfFile ? await readFile(join(outputDir, gcode3mfFile)) : null;
    const estimates = parseGcodeEstimates(gcode.toString('utf8'));

    return {
      success: true,
      gcodeBase64: gcode.toString('base64'),
      gcodeName: basename(gcodeFile, extname(gcodeFile)) + '.gcode',
      project3mfBase64: project?.toString('base64'),
      project3mfName: projectFile,
      gcode3mfBase64: gcode3mf?.toString('base64'),
      gcode3mfName: gcode3mfFile,
      ...estimates,
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
