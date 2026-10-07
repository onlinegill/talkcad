import { useEffect, useState } from 'react';
import { useEditorStore, useRenderStore } from '../store';

type SlicerInfo = {
  path: string | null;
  available: boolean;
  version?: string;
};

type OrcaProfile = {
  name: string;
  path: string;
  kind: 'printer' | 'process' | 'filament' | 'other';
};

export function PrintPanel() {
  const code = useEditorStore((s) => s.code);
  const stlData = useRenderStore((s) => s.stlData);
  const setRendering = useRenderStore((s) => s.setRendering);

  const [info, setInfo] = useState<SlicerInfo | null>(null);
  const [profiles, setProfiles] = useState<OrcaProfile[]>([]);
  const [printerProfile, setPrinterProfile] = useState('');
  const [processProfile, setProcessProfile] = useState('');
  const [filamentProfile, setFilamentProfile] = useState('');
  const [autoOrient, setAutoOrient] = useState(true);
  const [arrange, setArrange] = useState(true);
  const [export3mf, setExport3mf] = useState(true);
  const [source, setSource] = useState<'code' | 'preview'>('code');
  const [status, setStatus] = useState('');
  const [estimate, setEstimate] = useState<{ time?: number; grams?: number; mm?: number } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    window.api.slicer.detect()
      .then(setInfo)
      .catch(() => setInfo({ path: null, available: false }));

    window.api.slicer.profiles()
      .then(setProfiles)
      .catch(() => setProfiles([]));
  }, []);

  async function sliceCurrentModel() {
    if (source === 'code' && !code.trim()) {
      setStatus('There is no OpenSCAD model to slice.');
      return;
    }
    if (source === 'preview' && !stlData) {
      setStatus('There is no STL loaded in the current preview.');
      return;
    }

    setBusy(true);
    setRendering(true);

    try {
      let modelStl = stlData || '';

      if (source === 'code') {
        setStatus('Rendering final STL...');
        const rendered = await window.api.openscad.render(code, 'stl', { mode: 'final' });
        if (!rendered.success || !rendered.output) {
          setStatus(rendered.errors?.join('\n') || 'OpenSCAD failed to create the STL.');
          return;
        }
        modelStl = rendered.output;
      }

      setStatus('Slicing with OrcaSlicer...');
      const result = await window.api.slicer.sliceStl({
        stlBase64: modelStl,
        options: {
          printerProfile: printerProfile.trim() || undefined,
          processProfile: processProfile.trim() || undefined,
          filamentProfiles: filamentProfile.trim() ? [filamentProfile.trim()] : undefined,
          autoOrient,
          arrange,
          ensureOnBed: true,
          export3mf,
          outputName: 'talkcad-model',
        },
      });

      if (!result.success || !result.gcodeBase64) {
        setStatus(result.error || result.stderr || 'Slicing failed.');
        return;
      }

      setEstimate({ time: result.estimatedTimeSeconds, grams: result.filamentUsedGrams, mm: result.filamentUsedMm });

      const gcodePath = await window.api.dialog.saveFile({
        title: 'Save sliced G-code',
        defaultPath: result.gcodeName || 'talkcad-model.gcode',
        filters: [{ name: 'G-code', extensions: ['gcode'] }],
      });

      if (gcodePath) {
        await window.api.fsBinary.writeFile(gcodePath, result.gcodeBase64);
      }

      if (export3mf && result.project3mfBase64) {
        const projectPath = await window.api.dialog.saveFile({
          title: 'Save OrcaSlicer project',
          defaultPath: result.project3mfName || 'talkcad-model.3mf',
          filters: [{ name: '3MF Project', extensions: ['3mf'] }],
        });
        if (projectPath) {
          await window.api.fsBinary.writeFile(projectPath, result.project3mfBase64);
        }
      }

      setStatus(gcodePath ? `Done. G-code saved to ${gcodePath}` : 'Slicing completed.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
      setRendering(false);
    }
  }

  return (
    <div className="h-full overflow-auto p-5 bg-zinc-900">
      <div className="max-w-3xl mx-auto space-y-5">
        <div>
          <h2 className="text-xl font-semibold">Print & Slice</h2>
          <p className="text-sm text-zinc-400 mt-1">
            Turn the current TalkCAD model into printer-ready G-code using OrcaSlicer.
          </p>
        </div>

        <div className="rounded-lg border border-zinc-700 bg-zinc-800/50 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="font-medium">OrcaSlicer</div>
              <div className="text-xs text-zinc-400 break-all">
                {info?.available ? info.path : 'Not detected'}
              </div>
            </div>
            <span className={info?.available ? 'text-emerald-400 text-sm' : 'text-amber-400 text-sm'}>
              {info?.available ? 'Ready' : 'Install/configure OrcaSlicer'}
            </span>
          </div>
        </div>

        {stlData && (
          <label className="grid gap-1">
            <span className="text-sm">Model source</span>
            <select
              value={source}
              onChange={(e) => setSource(e.target.value as 'code' | 'preview')}
              className="bg-zinc-950 border border-zinc-700 rounded px-3 py-2 text-sm"
            >
              <option value="code">Current OpenSCAD code</option>
              <option value="preview">Current preview STL / imported STL</option>
            </select>
          </label>
        )}

        <div className="grid gap-4">
          <label className="grid gap-1">
            <span className="text-sm">Printer profile</span>
            <select
              value={printerProfile}
              onChange={(e) => setPrinterProfile(e.target.value)}
              className="bg-zinc-950 border border-zinc-700 rounded px-3 py-2 text-sm"
            >
              <option value="">Choose printer profile…</option>
              {profiles.filter((p) => p.kind === 'printer').map((p) => (
                <option key={p.path} value={p.path}>{p.name}</option>
              ))}
            </select>
          </label>

          <label className="grid gap-1">
            <span className="text-sm">Process profile</span>
            <select
              value={processProfile}
              onChange={(e) => setProcessProfile(e.target.value)}
              className="bg-zinc-950 border border-zinc-700 rounded px-3 py-2 text-sm"
            >
              <option value="">Choose process profile…</option>
              {profiles.filter((p) => p.kind === 'process').map((p) => (
                <option key={p.path} value={p.path}>{p.name}</option>
              ))}
            </select>
          </label>

          <label className="grid gap-1">
            <span className="text-sm">Filament profile</span>
            <select
              value={filamentProfile}
              onChange={(e) => setFilamentProfile(e.target.value)}
              className="bg-zinc-950 border border-zinc-700 rounded px-3 py-2 text-sm"
            >
              <option value="">Choose filament profile…</option>
              {profiles.filter((p) => p.kind === 'filament').map((p) => (
                <option key={p.path} value={p.path}>{p.name}</option>
              ))}
            </select>
          </label>

          {profiles.length === 0 && (
            <div className="text-xs text-amber-400">
              No bundled OrcaSlicer profiles were discovered. You can still slice with Orca defaults, or configure profile paths manually later.
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-5 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={autoOrient} onChange={(e) => setAutoOrient(e.target.checked)} />
            Auto-orient
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={arrange} onChange={(e) => setArrange(e.target.checked)} />
            Auto-arrange
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={export3mf} onChange={(e) => setExport3mf(e.target.checked)} />
            Also save 3MF project
          </label>
        </div>

        <button
          onClick={sliceCurrentModel}
          disabled={busy || !info?.available}
          className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-700 disabled:text-zinc-400"
        >
          {busy ? 'Working…' : 'Slice current model'}
        </button>

        {estimate && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded border border-zinc-700 bg-zinc-800/50 p-3">
              <div className="text-xs text-zinc-400">Estimated time</div>
              <div className="font-medium">{estimate.time ? Math.round(estimate.time / 60) + ' min' : '—'}</div>
            </div>
            <div className="rounded border border-zinc-700 bg-zinc-800/50 p-3">
              <div className="text-xs text-zinc-400">Filament</div>
              <div className="font-medium">{estimate.grams ? estimate.grams.toFixed(1) + ' g' : '—'}</div>
            </div>
            <div className="rounded border border-zinc-700 bg-zinc-800/50 p-3">
              <div className="text-xs text-zinc-400">Filament length</div>
              <div className="font-medium">{estimate.mm ? Math.round(estimate.mm) + ' mm' : '—'}</div>
            </div>
          </div>
        )}

        {status && (
          <pre className="whitespace-pre-wrap text-sm rounded border border-zinc-700 bg-zinc-950 p-3 text-zinc-300">
            {status}
          </pre>
        )}
      </div>
    </div>
  );
}
