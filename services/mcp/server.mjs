#!/usr/bin/env node
import { createInterface } from 'node:readline';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const rl = createInterface({ input: process.stdin, crlfDelay: Infinity });
const __dirname = dirname(fileURLToPath(import.meta.url));

function send(message) {
  process.stdout.write(JSON.stringify(message) + '\n');
}

function result(id, value) {
  send({ jsonrpc: '2.0', id, result: value });
}

function error(id, code, message) {
  send({ jsonrpc: '2.0', id, error: { code, message } });
}

function findExecutable(envName, fallbacks) {
  if (process.env[envName]) return process.env[envName];
  return fallbacks[process.platform]?.[0] || fallbacks.default?.[0];
}

const openScad = () => findExecutable('OPENSCAD_PATH', {
  darwin: ['/Applications/OpenSCAD.app/Contents/MacOS/OpenSCAD'],
  win32: ['C:\\Program Files\\OpenSCAD\\openscad.exe'],
  linux: ['/usr/bin/openscad'],
  default: ['openscad'],
});

const orcaSlicer = () => findExecutable('ORCASLICER_PATH', {
  darwin: ['/Applications/OrcaSlicer.app/Contents/MacOS/OrcaSlicer'],
  win32: ['C:\\Program Files\\OrcaSlicer\\orca-slicer.exe'],
  linux: ['/usr/bin/orca-slicer'],
  default: ['orca-slicer'],
});

async function run(command, args, timeoutMs = 600000) {
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

async function withScad(code, fn) {
  const dir = await mkdtemp(join(tmpdir(), 'talkcad-mcp-'));
  const scadPath = join(dir, 'model.scad');
  await writeFile(scadPath, code, 'utf8');
  try {
    return await fn({ dir, scadPath });
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

async function validateScad(args) {
  return withScad(args.code, async ({ dir, scadPath }) => {
    const out = join(dir, 'validate.stl');
    const r = await run(openScad(), ['-o', out, scadPath]);
    return {
      valid: r.code === 0,
      stdout: r.stdout,
      stderr: r.stderr,
    };
  });
}

async function renderStl(args) {
  return withScad(args.code, async ({ dir, scadPath }) => {
    const outputPath = args.outputPath
      ? resolve(args.outputPath)
      : resolve(process.cwd(), args.fileName || 'talkcad-model.stl');
    await mkdir(resolve(outputPath, '..'), { recursive: true }).catch(() => {});
    const r = await run(openScad(), ['-o', outputPath, scadPath]);
    if (r.code !== 0) throw new Error(r.stderr || 'OpenSCAD render failed');
    return { path: outputPath, fileName: basename(outputPath), stdout: r.stdout, stderr: r.stderr };
  });
}

async function sliceScad(args) {
  return withScad(args.code, async ({ dir, scadPath }) => {
    const stlPath = join(dir, 'model.stl');
    const render = await run(openScad(), ['-o', stlPath, scadPath]);
    if (render.code !== 0) throw new Error(render.stderr || 'OpenSCAD render failed');

    const outputDir = resolve(args.outputDir || process.cwd());
    await mkdir(outputDir, { recursive: true });

    const sliceArgs = [stlPath];
    const settings = [args.processProfile, args.printerProfile].filter(Boolean);
    if (settings.length) sliceArgs.push('--load-settings', settings.join(';'));
    if (args.filamentProfile) sliceArgs.push('--load-filaments', args.filamentProfile);
    if (args.autoOrient !== false) sliceArgs.push('--orient', '1');
    if (args.arrange !== false) sliceArgs.push('--arrange', '1');
    sliceArgs.push('--ensure-on-bed', '--outputdir', outputDir, '--slice', '0');

    const sliced = await run(orcaSlicer(), sliceArgs);
    if (sliced.code !== 0) throw new Error(sliced.stderr || 'OrcaSlicer failed');

    return { outputDir, stdout: sliced.stdout, stderr: sliced.stderr };
  });
}



async function exportCadQueryStep(args) {
  const spec = args.spec || {
    primitive: args.primitive || 'box',
    width: args.width,
    depth: args.depth,
    height: args.height,
    diameter: args.diameter,
    features: args.features || [],
  };

  const outputPath = resolve(args.outputPath || 'talkcad-model.step');
  await mkdir(dirname(outputPath), { recursive: true });

  const workDir = await mkdtemp(join(tmpdir(), 'talkcad-mcp-cq-'));
  const specPath = join(workDir, 'spec.json');
  const runner = resolve(__dirname, '../../apps/desktop/assets/cadquery/runner.py');
  await writeFile(specPath, JSON.stringify(spec), 'utf8');

  try {
    const candidates = process.env.CADQUERY_PYTHON
      ? [process.env.CADQUERY_PYTHON]
      : process.platform === 'win32'
        ? ['python', 'py']
        : ['python3', 'python'];

    let lastError = 'CadQuery is not available.';
    for (const python of candidates) {
      try {
        const check = await run(python, ['-c', 'import cadquery as cq; print(cq.__version__)'], 15000);
        if (check.code !== 0) {
          lastError = check.stderr || check.stdout || lastError;
          continue;
        }

        const exported = await run(python, [
          runner,
          '--spec', specPath,
          '--output', outputPath,
          '--format', 'step',
        ], 120000);

        if (exported.code !== 0) {
          lastError = exported.stderr || exported.stdout || 'CadQuery STEP export failed.';
          continue;
        }

        return {
          path: outputPath,
          fileName: basename(outputPath),
          cadqueryVersion: check.stdout.trim(),
        };
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
      }
    }
    throw new Error(lastError);
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}

function primitiveScad(args) {
  const shape = args.shape || 'box';
  const width = Number(args.width ?? 60);
  const depth = Number(args.depth ?? 40);
  const height = Number(args.height ?? 20);
  const diameter = Number(args.diameter ?? width);

  if (shape === 'cylinder') {
    return `$fn = 96;\ncylinder(d = ${diameter}, h = ${height});\n`;
  }
  if (shape === 'sphere') {
    return `$fn = 96;\nsphere(d = ${diameter});\n`;
  }
  return `cube([${width}, ${depth}, ${height}]);\n`;
}

async function sliceFile(args) {
  const inputPath = resolve(args.inputPath);
  const outputDir = resolve(args.outputDir || process.cwd());
  await mkdir(outputDir, { recursive: true });

  const sliceArgs = [inputPath];
  const settings = [args.processProfile, args.printerProfile].filter(Boolean);
  if (settings.length) sliceArgs.push('--load-settings', settings.join(';'));
  if (args.filamentProfile) sliceArgs.push('--load-filaments', args.filamentProfile);
  if (args.autoOrient !== false) sliceArgs.push('--orient', '1');
  if (args.arrange !== false) sliceArgs.push('--arrange', '1');
  sliceArgs.push('--ensure-on-bed', '--outputdir', outputDir, '--slice', '0');

  const sliced = await run(orcaSlicer(), sliceArgs);
  if (sliced.code !== 0) throw new Error(sliced.stderr || 'OrcaSlicer failed');
  return { inputPath, outputDir, stdout: sliced.stdout, stderr: sliced.stderr };
}

const tools = [
  {
    name: 'talkcad_export_step',
    description: 'Create a native STEP file using a constrained CadQuery/OpenCascade primitive and feature specification.',
    inputSchema: {
      type: 'object',
      properties: {
        outputPath: { type: 'string' },
        primitive: { type: 'string', enum: ['box', 'cylinder', 'sphere'] },
        width: { type: 'number' },
        depth: { type: 'number' },
        height: { type: 'number' },
        diameter: { type: 'number' },
        features: {
          type: 'array',
          items: {
            type: 'object',
            description: 'Feature objects: hole, fillet, chamfer, translate, or rotate.'
          }
        }
      }
    },
  },
  {
    name: 'talkcad_create_primitive',
    description: 'Create simple parametric OpenSCAD source for a box, cylinder, or sphere.',
    inputSchema: {
      type: 'object',
      properties: {
        shape: { type: 'string', enum: ['box', 'cylinder', 'sphere'] },
        width: { type: 'number' },
        depth: { type: 'number' },
        height: { type: 'number' },
        diameter: { type: 'number' }
      }
    },
  },
  {
    name: 'talkcad_validate_scad',
    description: 'Validate OpenSCAD by compiling it with the local OpenSCAD executable.',
    inputSchema: {
      type: 'object',
      properties: { code: { type: 'string', description: 'Complete OpenSCAD source code.' } },
      required: ['code'],
    },
  },
  {
    name: 'talkcad_render_stl',
    description: 'Render OpenSCAD source to an STL file on this computer.',
    inputSchema: {
      type: 'object',
      properties: {
        code: { type: 'string' },
        outputPath: { type: 'string' },
        fileName: { type: 'string' },
      },
      required: ['code'],
    },
  },
  {
    name: 'talkcad_slice_file',
    description: 'Slice an existing STL or 3MF file to G-code using OrcaSlicer.',
    inputSchema: {
      type: 'object',
      properties: {
        inputPath: { type: 'string' },
        outputDir: { type: 'string' },
        printerProfile: { type: 'string' },
        processProfile: { type: 'string' },
        filamentProfile: { type: 'string' },
        autoOrient: { type: 'boolean' },
        arrange: { type: 'boolean' }
      },
      required: ['inputPath']
    },
  },
  {
    name: 'talkcad_slice',
    description: 'Render OpenSCAD to STL and slice it to G-code using OrcaSlicer.',
    inputSchema: {
      type: 'object',
      properties: {
        code: { type: 'string' },
        outputDir: { type: 'string' },
        printerProfile: { type: 'string' },
        processProfile: { type: 'string' },
        filamentProfile: { type: 'string' },
        autoOrient: { type: 'boolean' },
        arrange: { type: 'boolean' },
      },
      required: ['code'],
    },
  },
];

async function callTool(name, args) {
  switch (name) {
    case 'talkcad_export_step': return exportCadQueryStep(args);
    case 'talkcad_create_primitive': return { code: primitiveScad(args) };
    case 'talkcad_validate_scad': return validateScad(args);
    case 'talkcad_render_stl': return renderStl(args);
    case 'talkcad_slice_file': return sliceFile(args);
    case 'talkcad_slice': return sliceScad(args);
    default: throw new Error(`Unknown tool: ${name}`);
  }
}

async function handle(message) {
  const { id, method, params } = message;

  if (method === 'notifications/initialized') return;
  if (method === 'ping') return result(id, {});
  if (method === 'initialize') {
    return result(id, {
      protocolVersion: params?.protocolVersion || '2025-06-18',
      capabilities: { tools: {}, resources: {}, prompts: {} },
      serverInfo: { name: 'talkcad-mcp', version: '0.1.0' },
    });
  }
  if (method === 'tools/list') return result(id, { tools });

  if (method === 'resources/list') {
    return result(id, {
      resources: [
        {
          uri: 'talkcad://capabilities',
          name: 'TalkCAD capabilities',
          description: 'Current local CAD, export, and slicing capabilities exposed by the TalkCAD MCP server.',
          mimeType: 'application/json',
        },
        {
          uri: 'talkcad://workflow',
          name: 'TalkCAD workflow',
          description: 'Recommended design-to-print workflow for MCP clients.',
          mimeType: 'text/markdown',
        },
      ],
    });
  }

  if (method === 'resources/read') {
    const uri = params?.uri;
    if (uri === 'talkcad://capabilities') {
      return result(id, {
        contents: [{
          uri,
          mimeType: 'application/json',
          text: JSON.stringify({
            cad: ['OpenSCAD generation', 'OpenSCAD validation', 'STL export'],
            print: ['STL slicing', '3MF slicing', 'OrcaSlicer profiles', 'G-code generation'],
            localExecutables: {
              openscad: openScad(),
              orcaSlicer: orcaSlicer(),
            },
            tools: tools.map((tool) => tool.name),
          }, null, 2),
        }],
      });
    }
    if (uri === 'talkcad://workflow') {
      return result(id, {
        contents: [{
          uri,
          mimeType: 'text/markdown',
          text: [
            '# TalkCAD MCP workflow',
            '',
            '1. Create or draft geometry with talkcad_create_primitive or OpenSCAD source.',
            '2. Validate with talkcad_validate_scad.',
            '3. Render with talkcad_render_stl when an STL artifact is needed.',
            '4. Slice OpenSCAD with talkcad_slice or an existing STL/3MF with talkcad_slice_file.',
            '5. Keep printer/process/filament profile paths explicit for reproducible output.',
          ].join('\n'),
        }],
      });
    }
    return error(id, -32002, `Resource not found: ${uri}`);
  }

  if (method === 'prompts/list') {
    return result(id, {
      prompts: [
        {
          name: 'design_part',
          description: 'Generate a manufacturable parametric OpenSCAD part from a natural-language requirement.',
          arguments: [
            { name: 'requirement', description: 'What the part must do and its dimensions.', required: true },
          ],
        },
        {
          name: 'prepare_print',
          description: 'Plan a reliable slicing workflow for an STL/3MF model.',
          arguments: [
            { name: 'model', description: 'Model path or description.', required: true },
            { name: 'printer', description: 'Printer/profile information.', required: false },
          ],
        },
      ],
    });
  }

  if (method === 'prompts/get') {
    if (params?.name === 'design_part') {
      const requirement = params?.arguments?.requirement || 'the requested part';
      return result(id, {
        description: 'Parametric CAD design prompt',
        messages: [{
          role: 'user',
          content: {
            type: 'text',
            text: `Design ${requirement} as clean parametric OpenSCAD. Use named parameters for important dimensions, design for manifold 3D printing, then validate the code with TalkCAD before rendering.`,
          },
        }],
      });
    }
    if (params?.name === 'prepare_print') {
      const model = params?.arguments?.model || 'the model';
      const printer = params?.arguments?.printer || 'the selected printer profile';
      return result(id, {
        description: 'Print preparation prompt',
        messages: [{
          role: 'user',
          content: {
            type: 'text',
            text: `Prepare ${model} for printing with ${printer}. Prefer explicit printer/process/filament profiles, inspect orientation and supports, then slice through TalkCAD and report estimated time and material usage when available.`,
          },
        }],
      });
    }
    return error(id, -32602, `Unknown prompt: ${params?.name}`);
  }

  if (method === 'tools/call') {
    try {
      const output = await callTool(params?.name, params?.arguments || {});
      return result(id, {
        content: [{ type: 'text', text: JSON.stringify(output, null, 2) }],
        structuredContent: output,
        isError: false,
      });
    } catch (e) {
      return result(id, {
        content: [{ type: 'text', text: e instanceof Error ? e.message : String(e) }],
        isError: true,
      });
    }
  }

  if (id !== undefined) error(id, -32601, `Method not found: ${method}`);
}

rl.on('line', async (line) => {
  if (!line.trim()) return;
  try {
    await handle(JSON.parse(line));
  } catch (e) {
    send({
      jsonrpc: '2.0',
      error: { code: -32700, message: e instanceof Error ? e.message : String(e) },
    });
  }
});
