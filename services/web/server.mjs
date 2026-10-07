#!/usr/bin/env node
import http from 'node:http';
import { spawn } from 'node:child_process';
import { createReadStream } from 'node:fs';
import { access, mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..');
const DIST = resolve(ROOT, 'apps/desktop/dist');
const SKILLS = resolve(ROOT, 'resources/skills');
const CQ_RUNNER = resolve(ROOT, 'apps/desktop/assets/cadquery/runner.py');
const MCP_STDIO = resolve(ROOT, 'services/mcp/server.mjs');
const PORT = Number(process.env.TALKCAD_WEB_PORT || 8787);
const HOST = process.env.TALKCAD_WEB_HOST || '127.0.0.1';

function run(command, args, timeoutMs = 600000) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => { stdout += d.toString(); });
    child.stderr.on('data', (d) => { stderr += d.toString(); });
    child.on('error', reject);
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error('Command timed out'));
    }, timeoutMs);
    child.on('close', (code) => {
      clearTimeout(timer);
      resolvePromise({ code, stdout, stderr });
    });
  });
}

async function executable(path) {
  try { await access(path, constants.X_OK); return true; } catch { return false; }
}

const openScadCandidates = process.platform === 'darwin'
  ? ['/Applications/OpenSCAD.app/Contents/MacOS/OpenSCAD', '/opt/homebrew/bin/openscad', '/usr/local/bin/openscad']
  : process.platform === 'win32'
    ? ['C:\\Program Files\\OpenSCAD\\openscad.exe']
    : ['/usr/bin/openscad', '/usr/local/bin/openscad'];

const orcaCandidates = process.platform === 'darwin'
  ? ['/Applications/OrcaSlicer.app/Contents/MacOS/OrcaSlicer', '/Applications/OrcaSlicer.app/Contents/MacOS/orca-slicer', '/opt/homebrew/bin/orca-slicer']
  : process.platform === 'win32'
    ? ['C:\\Program Files\\OrcaSlicer\\orca-slicer.exe', 'C:\\Program Files\\OrcaSlicer\\OrcaSlicer.exe']
    : ['/usr/bin/orca-slicer', '/usr/local/bin/orca-slicer', '/opt/orca-slicer/orca-slicer'];

async function findExecutable(envName, candidates) {
  const configured = process.env[envName];
  if (configured && await executable(configured)) return configured;
  for (const candidate of candidates) if (await executable(candidate)) return candidate;
  return null;
}

async function readJson(req) {
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > 100 * 1024 * 1024) throw new Error('Request body too large');
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function json(res, statusCode, value) {
  const body = JSON.stringify(value);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

async function withTemp(prefix, fn) {
  const dir = await mkdtemp(join(tmpdir(), prefix));
  try { return await fn(dir); }
  finally { await rm(dir, { recursive: true, force: true }).catch(() => {}); }
}

async function openscadRender(code, image = false) {
  const openscad = await findExecutable('OPENSCAD_PATH', openScadCandidates);
  if (!openscad) throw new Error('OpenSCAD was not found on the web backend.');

  return withTemp('talkcad-web-scad-', async (dir) => {
    const source = join(dir, 'model.scad');
    const output = join(dir, image ? 'model.png' : 'model.stl');
    await writeFile(source, code, 'utf8');
    const args = image
      ? ['-o', output, '--imgsize=900,700', '--autocenter', '--viewall', source]
      : ['-o', output, source];
    const result = await run(openscad, args);
    if (result.code !== 0) {
      return { success: false, errors: [result.stderr || result.stdout || 'OpenSCAD failed'], warnings: [] };
    }
    const data = await readFile(output);
    if (image) return { success: true, image: data.toString('base64') };
    return { success: true, format: 'stl', output: data.toString('base64'), errors: [], warnings: [] };
  });
}

function parseStl(base64) {
  const buffer = Buffer.from(base64, 'base64');
  const isBinary = buffer.length >= 84 && 84 + buffer.readUInt32LE(80) * 50 <= buffer.length;
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  let triangles = 0;
  let signedVolume = 0;

  const take = (x, y, z) => {
    minX = Math.min(minX, x); minY = Math.min(minY, y); minZ = Math.min(minZ, z);
    maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); maxZ = Math.max(maxZ, z);
  };

  if (isBinary) {
    triangles = buffer.readUInt32LE(80);
    for (let i = 0; i < triangles; i++) {
      const base = 84 + i * 50 + 12;
      const pts = [];
      for (let v = 0; v < 3; v++) {
        const o = base + v * 12;
        const p = [buffer.readFloatLE(o), buffer.readFloatLE(o + 4), buffer.readFloatLE(o + 8)];
        pts.push(p); take(...p);
      }
      const [a,b,c] = pts;
      signedVolume += (
        a[0] * (b[1]*c[2] - b[2]*c[1])
        - a[1] * (b[0]*c[2] - b[2]*c[0])
        + a[2] * (b[0]*c[1] - b[1]*c[0])
      ) / 6;
    }
  } else {
    const text = buffer.toString('utf8');
    const matches = [...text.matchAll(/vertex\s+([-+0-9.eE]+)\s+([-+0-9.eE]+)\s+([-+0-9.eE]+)/g)];
    for (const m of matches) take(Number(m[1]), Number(m[2]), Number(m[3]));
    triangles = Math.floor(matches.length / 3);
  }

  const valid = Number.isFinite(minX);
  return valid ? {
    dimensions: { x: maxX-minX, y: maxY-minY, z: maxZ-minZ },
    volume: Math.abs(signedVolume),
    surfaceArea: 0,
    manifold: true,
    triangles,
    renderTime: 0,
  } : null;
}

async function walkJson(root, depth = 0) {
  if (depth > 6) return [];
  try {
    const entries = await readdir(root, { withFileTypes: true });
    const nested = await Promise.all(entries.map(async (entry) => {
      const full = join(root, entry.name);
      if (entry.isDirectory()) return walkJson(full, depth + 1);
      return entry.isFile() && entry.name.toLowerCase().endsWith('.json') ? [full] : [];
    }));
    return nested.flat();
  } catch { return []; }
}

async function orcaProfiles() {
  const orca = await findExecutable('ORCASLICER_PATH', orcaCandidates);
  if (!orca) return [];
  const roots = [];
  const binDir = dirname(orca);
  if (process.platform === 'darwin' && orca.includes('.app/Contents/MacOS/')) {
    roots.push(join(dirname(dirname(binDir)), 'Resources', 'profiles'));
  } else {
    roots.push(join(binDir, 'resources', 'profiles'), join(dirname(binDir), 'resources', 'profiles'), join(binDir, 'profiles'));
  }
  const files = (await Promise.all(roots.map((root) => walkJson(root)))).flat();
  return files.map((path) => {
    const p = path.toLowerCase();
    const kind = p.includes('filament') ? 'filament' : p.includes('process') || p.includes('print') ? 'process' : p.includes('machine') || p.includes('printer') ? 'printer' : 'other';
    return { name: basename(path, '.json'), path, kind };
  }).sort((a,b) => a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name));
}

function gcodeEstimates(text) {
  const timeMatch = text.match(/;\s*(?:estimated printing time|total estimated time)\s*[:=]\s*([^\r\n]+)/i);
  const filamentMm = text.match(/;\s*filament used \[mm\]\s*=\s*([0-9.]+)/i);
  const filamentG = text.match(/;\s*filament used \[g\]\s*=\s*([0-9.]+)/i);
  let estimatedTimeSeconds;
  if (timeMatch) {
    const t = timeMatch[1];
    estimatedTimeSeconds = Number(t.match(/(\d+)h/i)?.[1] || 0) * 3600 + Number(t.match(/(\d+)m/i)?.[1] || 0) * 60 + Number(t.match(/(\d+)s/i)?.[1] || 0);
  }
  return {
    estimatedTimeSeconds,
    filamentUsedMm: filamentMm ? Number(filamentMm[1]) : undefined,
    filamentUsedGrams: filamentG ? Number(filamentG[1]) : undefined,
  };
}

async function sliceModel(args) {
  const orca = await findExecutable('ORCASLICER_PATH', orcaCandidates);
  if (!orca) throw new Error('OrcaSlicer was not found on the web backend.');
  const options = args.options || {};
  return withTemp('talkcad-web-orca-', async (dir) => {
    const input = join(dir, `model.${options.inputFormat || 'stl'}`);
    const outputDir = join(dir, 'out');
    await mkdir(outputDir, { recursive: true });
    await writeFile(input, Buffer.from(args.stlBase64, 'base64'));
    const cli = [input];
    const settings = [options.processProfile, options.printerProfile].filter(Boolean);
    if (settings.length) cli.push('--load-settings', settings.join(';'));
    if (options.filamentProfiles?.length) cli.push('--load-filaments', options.filamentProfiles.join(';'));
    if (options.autoOrient !== false) cli.push('--orient', '1');
    if (options.arrange !== false) cli.push('--arrange', '1');
    if (options.ensureOnBed !== false) cli.push('--ensure-on-bed');
    const add = (key, value) => { if (value !== undefined && value !== null && value !== '') cli.push(`--${key}=${value}`); };
    add('layer-height', options.layerHeight);
    if (options.infillDensity !== undefined) add('sparse-infill-density', `${Math.max(0,Math.min(100,options.infillDensity))}%`);
    add('sparse-infill-pattern', options.infillPattern);
    if (options.wallLoops !== undefined) add('wall-loops', Math.max(0,Math.floor(options.wallLoops)));
    if (options.enableSupport !== undefined) add('enable-support', options.enableSupport ? 1 : 0);
    if (options.enableSupport) add('support-type', options.supportType);
    add('sparse-infill-speed', options.sparseInfillSpeed);
    add('initial-layer-speed', options.initialLayerSpeed);
    add('brim-type', options.brimType);
    add('brim-width', options.brimWidth);
    add('raft-layers', options.raftLayers);
    add('skirt-loops', options.skirtLoops);
    cli.push('--outputdir', outputDir, '--slice', '0');
    const outputName = (options.outputName || 'talkcad-model').replace(/[^a-zA-Z0-9._-]+/g, '-');
    if (options.exportGcode3mf) cli.push('--export-3mf', join(outputDir, `${outputName}.gcode.3mf`));
    else if (options.export3mf) cli.push('--export-3mf', join(outputDir, `${outputName}.3mf`));
    const result = await run(orca, cli);
    const names = await readdir(outputDir);
    const gcodeFile = names.find((name) => /\.gcode$/i.test(name));
    if (result.code !== 0 || !gcodeFile) throw new Error(result.stderr || 'OrcaSlicer did not produce G-code.');
    const gcode = await readFile(join(outputDir, gcodeFile));
    const project = names.find((name) => /\.3mf$/i.test(name) && !/\.gcode\.3mf$/i.test(name));
    const gcode3mf = names.find((name) => /\.gcode\.3mf$/i.test(name));
    return {
      success: true,
      gcodeBase64: gcode.toString('base64'),
      gcodeName: gcodeFile,
      project3mfBase64: project ? (await readFile(join(outputDir, project))).toString('base64') : undefined,
      project3mfName: project,
      gcode3mfBase64: gcode3mf ? (await readFile(join(outputDir, gcode3mf))).toString('base64') : undefined,
      gcode3mfName: gcode3mf,
      ...gcodeEstimates(gcode.toString('utf8')),
      stdout: result.stdout,
      stderr: result.stderr,
    };
  });
}

async function pythonCadQuery() {
  const candidates = process.env.CADQUERY_PYTHON ? [process.env.CADQUERY_PYTHON] : process.platform === 'win32' ? ['python', 'py'] : ['python3', 'python'];
  for (const python of candidates) {
    try {
      const r = await run(python, ['-c', 'import cadquery as cq; print(cq.__version__)'], 15000);
      if (r.code === 0) return { python, version: r.stdout.trim() };
    } catch {}
  }
  return null;
}

async function cadqueryExport(args) {
  const detected = await pythonCadQuery();
  if (!detected) throw new Error('CadQuery is not installed.');
  return withTemp('talkcad-web-cq-', async (dir) => {
    const specPath = join(dir, 'spec.json');
    const format = args.format === 'step' ? 'step' : 'stl';
    const output = join(dir, `model.${format}`);
    await writeFile(specPath, JSON.stringify(args.spec || {}), 'utf8');
    const r = await run(detected.python, [CQ_RUNNER, '--spec', specPath, '--output', output, '--format', format], 120000);
    if (r.code !== 0) throw new Error(r.stderr || r.stdout || 'CadQuery failed');
    return { success: true, format, output: (await readFile(output)).toString('base64'), fileName: `talkcad-model.${format}` };
  });
}

function remoteHeaders(kind, apiKey) {
  return apiKey?.trim() ? { 'X-Api-Key': apiKey.trim() } : {};
}

async function printerTest(args) {
  const base = args.baseUrl.trim().replace(/\/+$/, '');
  const url = args.kind === 'octoprint' ? `${base}/api/version` : `${base}/printer/info`;
  const response = await fetch(url, { headers: remoteHeaders(args.kind, args.apiKey) });
  const text = await response.text();
  return response.ok ? { success: true, status: response.status, response: text } : { success: false, status: response.status, error: text };
}

async function printerUpload(args) {
  const base = args.baseUrl.trim().replace(/\/+$/, '');
  const url = args.kind === 'octoprint' ? `${base}/api/files/local` : `${base}/server/files/upload`;
  const form = new FormData();
  form.append('file', new Blob([Buffer.from(args.gcodeBase64, 'base64')], { type: 'application/octet-stream' }), args.fileName);
  if (args.kind === 'octoprint') {
    form.append('select', 'true');
    form.append('print', args.startPrint ? 'true' : 'false');
  } else {
    form.append('root', 'gcodes');
    if (args.startPrint) form.append('print', 'true');
  }
  const response = await fetch(url, { method: 'POST', headers: remoteHeaders(args.kind, args.apiKey), body: form });
  const text = await response.text();
  return response.ok ? { success: true, status: response.status, response: text } : { success: false, status: response.status, error: text };
}

async function skillFiles(root = SKILLS) {
  const entries = await readdir(root, { withFileTypes: true }).catch(() => []);
  const results = [];
  for (const entry of entries) {
    const full = join(root, entry.name);
    if (entry.isDirectory()) results.push(...await skillFiles(full));
    else if (entry.isFile() && entry.name.endsWith('.md')) results.push(full);
  }
  return results;
}

async function searchSkills(query, category) {
  const words = String(query || '').toLowerCase().split(/\s+/).filter(Boolean);
  const files = await skillFiles();
  const matches = [];
  for (const file of files) {
    const relative = file.slice(SKILLS.length + 1).replace(/\\/g, '/');
    if (category && !relative.toLowerCase().includes(String(category).toLowerCase())) continue;
    const content = await readFile(file, 'utf8').catch(() => '');
    const hay = `${relative}\n${content}`.toLowerCase();
    const score = words.reduce((n, word) => n + (hay.includes(word) ? 1 : 0), 0);
    if (!words.length || score) matches.push({ score, relative, content });
  }
  return matches.sort((a,b) => b.score-a.score).slice(0, 20).map(({relative,content}) => ({
    title: basename(relative, '.md'),
    tags: [],
    preview: content.slice(0, 500),
    path: relative,
    source: 'builtin',
  }));
}

function safeSkillPath(relative) {
  const full = resolve(SKILLS, normalize(String(relative || '')));
  return full.startsWith(SKILLS + '/') || full === SKILLS ? full : null;
}

async function proxyJson(url, init) {
  const response = await fetch(url, init);
  const text = await response.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }
  return response.ok ? { ok: true, data } : { ok: false, error: text };
}

async function status() {
  const openscad = await findExecutable('OPENSCAD_PATH', openScadCandidates);
  const orca = await findExecutable('ORCASLICER_PATH', orcaCandidates);
  const cq = await pythonCadQuery();
  let openscadVersion = null;
  let orcaVersion = null;
  if (openscad) openscadVersion = (await run(openscad, ['--version'], 10000).catch(()=>({stdout:''}))).stdout?.trim() || null;
  if (orca) orcaVersion = (await run(orca, ['--help'], 10000).catch(()=>({stdout:''}))).stdout?.split(/\r?\n/).find(Boolean) || null;
  return { openscadAvailable: Boolean(openscad), openscadVersion, orcaAvailable: Boolean(orca), orcaVersion, cadqueryAvailable: Boolean(cq), cadqueryVersion: cq?.version || null };
}


function mcpAuthorized(req) {
  const token = process.env.TALKCAD_MCP_TOKEN;
  if (!token) return true;
  const auth = req.headers.authorization || '';
  return auth === `Bearer ${token}`;
}

async function forwardMcp(message) {
  if (message?.method === 'server/discover') {
    return {
      jsonrpc: '2.0',
      id: message.id,
      result: {
        resultType: 'complete',
        supportedVersions: ['2025-11-25'],
        capabilities: { tools: {}, resources: {}, prompts: {} },
        _meta: {
          'io.modelcontextprotocol/serverInfo': { name: 'talkcad-mcp', version: '0.2.0' },
        },
        instructions: 'TalkCAD provides local CAD generation, validation, STL/STEP export, slicing, and print preparation tools.',
        ttlMs: 3600000,
        cacheScope: 'private',
      },
    };
  }

  return new Promise((resolvePromise, reject) => {
    const child = spawn(process.execPath, [MCP_STDIO], { stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error('MCP request timed out'));
    }, 10 * 60_000);

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
      const line = stdout.split(/\r?\n/).find((entry) => entry.trim());
      if (!line) return;
      try {
        const parsed = JSON.parse(line);
        clearTimeout(timer);
        child.kill();
        resolvePromise(parsed);
      } catch {
        // wait for a complete JSON line
      }
    });
    child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    child.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (!stdout.trim() && code !== 0) reject(new Error(stderr || `MCP worker exited with ${code}`));
    });

    child.stdin.end(JSON.stringify(message) + '\n');
  });
}

async function handleMcp(req, res) {
  if (!mcpAuthorized(req)) {
    res.writeHead(401, { 'WWW-Authenticate': 'Bearer', 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Unauthorized' }));
  }
  if (req.method !== 'POST') {
    res.writeHead(405, { Allow: 'POST', 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Use POST for stateless MCP requests.' }));
  }

  try {
    const message = await readJson(req);
    const response = await forwardMcp(message);
    const body = JSON.stringify(response);
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body),
      'Cache-Control': 'no-store',
      'MCP-Protocol-Version': req.headers['mcp-protocol-version'] || '2025-11-25',
    });
    res.end(body);
  } catch (error) {
    const body = JSON.stringify({
      jsonrpc: '2.0',
      id: null,
      error: { code: -32603, message: error instanceof Error ? error.message : String(error) },
    });
    res.writeHead(500, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) });
    res.end(body);
  }
}

async function handleApi(req, res, pathname) {
  try {
    if (req.method === 'GET' && pathname === '/api/status') return json(res, 200, await status());
    if (req.method === 'GET' && pathname === '/api/slicer/profiles') return json(res, 200, await orcaProfiles());

    const body = await readJson(req);

    if (pathname === '/api/openscad/validate') {
      const r = await openscadRender(body.code || '');
      return json(res, 200, { valid: Boolean(r.success), errors: r.errors || [], warnings: r.warnings || [] });
    }
    if (pathname === '/api/openscad/render') {
      const r = await openscadRender(body.code || '');
      if (r.success && r.output) r.stats = parseStl(r.output);
      return json(res, 200, r);
    }
    if (pathname === '/api/openscad/image') return json(res, 200, await openscadRender(body.code || '', true));
    if (pathname === '/api/stl/stats') return json(res, 200, parseStl(body.base64Data || ''));
    if (pathname === '/api/slicer/slice') return json(res, 200, await sliceModel(body));
    if (pathname === '/api/cadquery/export') return json(res, 200, await cadqueryExport(body));
    if (pathname === '/api/printer/test') return json(res, 200, await printerTest(body));
    if (pathname === '/api/printer/upload') return json(res, 200, await printerUpload(body));
    if (pathname === '/api/skills/search') return json(res, 200, await searchSkills(body.query, body.category));
    if (pathname === '/api/skills/get') {
      const full = safeSkillPath(body.path);
      if (!full) return json(res, 400, { error: 'Invalid skill path' });
      const content = await readFile(full, 'utf8').catch(() => null);
      return json(res, 200, content == null ? null : { title: basename(full, '.md'), tags: [], content, path: body.path, source: 'builtin' });
    }
    if (pathname === '/api/llm/openrouter-chat') {
      return json(res, 200, await proxyJson('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${body.apiKey || ''}` }, body: JSON.stringify(body.body || {}),
      }));
    }
    if (pathname === '/api/llm/openrouter-models') {
      return json(res, 200, await proxyJson('https://openrouter.ai/api/v1/models', { headers: { Authorization: `Bearer ${body.apiKey || ''}` } }));
    }
    if (pathname === '/api/llm/openai-chat') {
      const base = String(body.baseUrl || '').replace(/\/+$/, '');
      return json(res, 200, await proxyJson(`${base}/chat/completions`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...(body.apiKey ? { Authorization: `Bearer ${body.apiKey}` } : {}) }, body: JSON.stringify(body.body || {}),
      }));
    }
    if (pathname === '/api/llm/openai-models') {
      const base = String(body.baseUrl || '').replace(/\/+$/, '');
      return json(res, 200, await proxyJson(`${base}/models`, { headers: body.apiKey ? { Authorization: `Bearer ${body.apiKey}` } : {} }));
    }

    return json(res, 404, { error: 'Unknown API route' });
  } catch (error) {
    return json(res, 500, { error: error instanceof Error ? error.message : String(error) });
  }
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

async function serveStatic(req, res, pathname) {
  const requested = pathname === '/' ? '/index.html' : pathname;
  let file = resolve(DIST, '.' + requested);
  if (!file.startsWith(DIST)) return json(res, 403, { error: 'Forbidden' });
  try {
    if (!(await stat(file)).isFile()) throw new Error('not file');
  } catch {
    file = join(DIST, 'index.html');
  }
  const info = await stat(file);
  res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream', 'Content-Length': info.size });
  createReadStream(file).pipe(res);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  if (url.pathname === '/mcp') return handleMcp(req, res);
  if (url.pathname.startsWith('/api/')) return handleApi(req, res, url.pathname);
  return serveStatic(req, res, url.pathname);
});

server.listen(PORT, HOST, () => {
  process.stdout.write(`TalkCAD web: http://${HOST}:${PORT}\n`);
});
