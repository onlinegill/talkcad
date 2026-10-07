import { useEffect, useState } from 'react';
import { useEditorStore, useRenderStore } from '../store';
import { SpoolInventory } from './SpoolInventory';

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
  const importedModelData = useRenderStore((s) => s.importedModelData);
  const importedModelFormat = useRenderStore((s) => s.importedModelFormat);
  const setRendering = useRenderStore((s) => s.setRendering);

  const [info, setInfo] = useState<SlicerInfo | null>(null);
  const [profiles, setProfiles] = useState<OrcaProfile[]>([]);
  const [printerProfile, setPrinterProfile] = useState('');
  const [printerSearch, setPrinterSearch] = useState('');
  const [favoritePrinters, setFavoritePrinters] = useState<string[]>([]);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [filamentCostPerKg, setFilamentCostPerKg] = useState(20);
  const [spoolName, setSpoolName] = useState('Current spool');
  const [spoolRemainingGrams, setSpoolRemainingGrams] = useState(1000);
  const [processProfile, setProcessProfile] = useState('');
  const [filamentProfile, setFilamentProfile] = useState('');
  const [autoOrient, setAutoOrient] = useState(true);
  const [arrange, setArrange] = useState(true);
  const [export3mf, setExport3mf] = useState(true);
  const [exportGcode3mf, setExportGcode3mf] = useState(false);
  const [layerHeight, setLayerHeight] = useState(0.2);
  const [infillDensity, setInfillDensity] = useState(15);
  const [infillPattern, setInfillPattern] = useState('gyroid');
  const [wallLoops, setWallLoops] = useState(3);
  const [enableSupport, setEnableSupport] = useState(false);
  const [supportType, setSupportType] = useState('tree(auto)');
  const [sparseInfillSpeed, setSparseInfillSpeed] = useState(0);
  const [initialLayerSpeed, setInitialLayerSpeed] = useState(0);
  const [brimType, setBrimType] = useState('no_brim');
  const [brimWidth, setBrimWidth] = useState(5);
  const [raftLayers, setRaftLayers] = useState(0);
  const [skirtLoops, setSkirtLoops] = useState(0);
  const [source, setSource] = useState<'code' | 'preview' | 'imported'>('code');
  const [status, setStatus] = useState('');
  const [estimate, setEstimate] = useState<{ time?: number; grams?: number; mm?: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [lastGcodeBase64, setLastGcodeBase64] = useState('');
  const [lastGcodeName, setLastGcodeName] = useState('talkcad-model.gcode');
  const [printerKind, setPrinterKind] = useState<'octoprint' | 'moonraker'>('moonraker');
  const [remotePrinterUrl, setRemotePrinterUrl] = useState('');
  const [remotePrinterApiKey, setRemotePrinterApiKey] = useState('');
  const [remoteStartPrint, setRemoteStartPrint] = useState(false);
  const [remoteStatus, setRemoteStatus] = useState('');
  const [remoteBusy, setRemoteBusy] = useState(false);

  useEffect(() => {
    window.api.slicer.detect()
      .then(setInfo)
      .catch(() => setInfo({ path: null, available: false }));

    window.api.slicer.profiles()
      .then(setProfiles)
      .catch(() => setProfiles([]));
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('talkcad-print-settings');
      if (!raw) return;
      const saved = JSON.parse(raw) as Record<string, unknown>;
      if (typeof saved.printerProfile === 'string') setPrinterProfile(saved.printerProfile);
      if (typeof saved.processProfile === 'string') setProcessProfile(saved.processProfile);
      if (typeof saved.filamentProfile === 'string') setFilamentProfile(saved.filamentProfile);
      if (typeof saved.layerHeight === 'number') setLayerHeight(saved.layerHeight);
      if (typeof saved.infillDensity === 'number') setInfillDensity(saved.infillDensity);
      if (typeof saved.infillPattern === 'string') setInfillPattern(saved.infillPattern);
      if (typeof saved.wallLoops === 'number') setWallLoops(saved.wallLoops);
      if (typeof saved.enableSupport === 'boolean') setEnableSupport(saved.enableSupport);
      if (typeof saved.supportType === 'string') setSupportType(saved.supportType);
      if (typeof saved.brimType === 'string') setBrimType(saved.brimType);
      if (typeof saved.brimWidth === 'number') setBrimWidth(saved.brimWidth);
      if (typeof saved.raftLayers === 'number') setRaftLayers(saved.raftLayers);
      if (typeof saved.skirtLoops === 'number') setSkirtLoops(saved.skirtLoops);
      if (typeof saved.filamentCostPerKg === 'number') setFilamentCostPerKg(saved.filamentCostPerKg);
      if (typeof saved.spoolName === 'string') setSpoolName(saved.spoolName);
      if (typeof saved.spoolRemainingGrams === 'number') setSpoolRemainingGrams(saved.spoolRemainingGrams);
      if (Array.isArray(saved.favoritePrinters)) {
        setFavoritePrinters(saved.favoritePrinters.filter((value): value is string => typeof value === 'string'));
      }
    } catch {
      // Ignore stale or malformed saved settings.
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('talkcad-print-settings', JSON.stringify({
      printerProfile,
      processProfile,
      filamentProfile,
      layerHeight,
      infillDensity,
      infillPattern,
      wallLoops,
      enableSupport,
      supportType,
      brimType,
      brimWidth,
      raftLayers,
      skirtLoops,
      filamentCostPerKg,
      spoolName,
      spoolRemainingGrams,
      favoritePrinters,
    }));
  }, [
    printerProfile,
    processProfile,
    filamentProfile,
    layerHeight,
    infillDensity,
    infillPattern,
    wallLoops,
    enableSupport,
    supportType,
    brimType,
    brimWidth,
    raftLayers,
    skirtLoops,
    filamentCostPerKg,
    spoolName,
    spoolRemainingGrams,
    favoritePrinters,
  ]);

  async function testRemotePrinter() {
    if (!remotePrinterUrl.trim()) {
      setRemoteStatus('Enter the printer URL first.');
      return;
    }
    setRemoteBusy(true);
    setRemoteStatus('Testing connection...');
    try {
      const result = await window.api.printer.test({
        kind: printerKind,
        baseUrl: remotePrinterUrl,
        apiKey: remotePrinterApiKey.trim() || undefined,
      });
      setRemoteStatus(result.success ? 'Printer connection successful.' : result.error || 'Printer connection failed.');
    } catch (error) {
      setRemoteStatus(error instanceof Error ? error.message : String(error));
    } finally {
      setRemoteBusy(false);
    }
  }

  async function sendToRemotePrinter() {
    if (!lastGcodeBase64) {
      setRemoteStatus('Slice a model first so there is G-code to upload.');
      return;
    }
    if (!remotePrinterUrl.trim()) {
      setRemoteStatus('Enter the printer URL first.');
      return;
    }
    setRemoteBusy(true);
    setRemoteStatus(remoteStartPrint ? 'Uploading and starting print...' : 'Uploading G-code...');
    try {
      const result = await window.api.printer.upload({
        kind: printerKind,
        baseUrl: remotePrinterUrl,
        apiKey: remotePrinterApiKey.trim() || undefined,
        fileName: lastGcodeName,
        gcodeBase64: lastGcodeBase64,
        startPrint: remoteStartPrint,
      });
      setRemoteStatus(result.success
        ? remoteStartPrint ? 'Uploaded and print start requested.' : 'G-code uploaded successfully.'
        : result.error || 'Upload failed.');
    } catch (error) {
      setRemoteStatus(error instanceof Error ? error.message : String(error));
    } finally {
      setRemoteBusy(false);
    }
  }

  async function sliceCurrentModel() {
    if (source === 'code' && !code.trim()) {
      setStatus('There is no OpenSCAD model to slice.');
      return;
    }
    if (source === 'preview' && !stlData) {
      setStatus('There is no STL loaded in the current preview.');
      return;
    }
    if (source === 'imported' && !importedModelData) {
      setStatus('There is no imported STL/3MF model loaded.');
      return;
    }

    setBusy(true);
    setRendering(true);

    try {
      let modelStl = source === 'imported' ? (importedModelData || '') : (stlData || '');
      let inputFormat: 'stl' | '3mf' = source === 'imported' ? (importedModelFormat || 'stl') : 'stl';

      if (source === 'code') {
        setStatus('Rendering final STL...');
        const rendered = await window.api.openscad.render(code, 'stl', { mode: 'final' });
        if (!rendered.success || !rendered.output) {
          setStatus(rendered.errors?.join('\n') || 'OpenSCAD failed to create the STL.');
          return;
        }
        modelStl = rendered.output;
        inputFormat = 'stl';
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
          export3mf: export3mf && !exportGcode3mf,
          exportGcode3mf,
          outputName: 'talkcad-model',
          inputFormat,
          layerHeight,
          infillDensity,
          infillPattern,
          wallLoops,
          enableSupport,
          supportType,
          sparseInfillSpeed: sparseInfillSpeed || undefined,
          initialLayerSpeed: initialLayerSpeed || undefined,
          brimType,
          brimWidth,
          raftLayers,
          skirtLoops,
        },
      });

      if (!result.success || !result.gcodeBase64) {
        setStatus(result.error || result.stderr || 'Slicing failed.');
        return;
      }

      setEstimate({ time: result.estimatedTimeSeconds, grams: result.filamentUsedGrams, mm: result.filamentUsedMm });
      setLastGcodeBase64(result.gcodeBase64);
      setLastGcodeName(result.gcodeName || 'talkcad-model.gcode');

      const gcodePath = await window.api.dialog.saveFile({
        title: 'Save sliced G-code',
        defaultPath: result.gcodeName || 'talkcad-model.gcode',
        filters: [{ name: 'G-code', extensions: ['gcode'] }],
      });

      if (gcodePath) {
        await window.api.fsBinary.writeFile(gcodePath, result.gcodeBase64);
      }

      if (exportGcode3mf && result.gcode3mfBase64) {
        const bambuPath = await window.api.dialog.saveFile({
          title: 'Save sliced G-code 3MF',
          defaultPath: result.gcode3mfName || 'talkcad-model.gcode.3mf',
          filters: [{ name: 'G-code 3MF', extensions: ['3mf'] }],
        });
        if (bambuPath) {
          await window.api.fsBinary.writeFile(bambuPath, result.gcode3mfBase64);
        }
      }

      if (export3mf && !exportGcode3mf && result.project3mfBase64) {
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

        {(stlData || importedModelData) && (
          <label className="grid gap-1">
            <span className="text-sm">Model source</span>
            <select
              value={source}
              onChange={(e) => setSource(e.target.value as 'code' | 'preview' | 'imported')}
              className="bg-zinc-950 border border-zinc-700 rounded px-3 py-2 text-sm"
            >
              <option value="code">Current OpenSCAD code</option>
              {stlData && <option value="preview">Current preview STL</option>}
              {importedModelData && (
                <option value="imported">Imported {importedModelFormat?.toUpperCase() || 'model'}</option>
              )}
            </select>
          </label>
        )}

        <div className="grid gap-4">
          <label className="grid gap-1">
            <span className="text-sm">Search printer profiles</span>
            <div className="flex gap-2">
            <input
              value={printerSearch}
              onChange={(e) => setPrinterSearch(e.target.value)}
              placeholder="Bambu, Prusa, Creality..."
              className="flex-1 min-w-0 bg-zinc-950 border border-zinc-700 rounded px-3 py-2 text-sm"
            />
            <label className="flex items-center gap-1 text-xs text-zinc-400 whitespace-nowrap">
              <input type="checkbox" checked={favoritesOnly} onChange={(e) => setFavoritesOnly(e.target.checked)} />
              Favorites
            </label>
            </div>
          </label>

          <label className="grid gap-1">
            <span className="text-sm">Printer profile</span>
            <select
              value={printerProfile}
              onChange={(e) => setPrinterProfile(e.target.value)}
              className="bg-zinc-950 border border-zinc-700 rounded px-3 py-2 text-sm"
            >
              <option value="">Choose printer profile…</option>
              {profiles
                .filter((p) => p.kind === 'printer')
                .filter((p) => !favoritesOnly || favoritePrinters.includes(p.path))
                .filter((p) => !printerSearch.trim() || p.name.toLowerCase().includes(printerSearch.toLowerCase()))
                .sort((a, b) => Number(favoritePrinters.includes(b.path)) - Number(favoritePrinters.includes(a.path)) || a.name.localeCompare(b.name))
                .map((p) => (
                  <option key={p.path} value={p.path}>
                    {favoritePrinters.includes(p.path) ? '★ ' : ''}{p.name}
                  </option>
                ))}
            </select>
            {printerProfile && (
              <button
                type="button"
                onClick={() => setFavoritePrinters((current) =>
                  current.includes(printerProfile)
                    ? current.filter((path) => path !== printerProfile)
                    : [...current, printerProfile]
                )}
                className="justify-self-start text-xs text-amber-300 hover:text-amber-200"
              >
                {favoritePrinters.includes(printerProfile) ? '★ Remove favorite' : '☆ Add favorite'}
              </button>
            )}
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

        <div className="rounded-lg border border-zinc-700 bg-zinc-800/30 p-4 space-y-4">
          <div className="font-medium">Print settings</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="grid gap-1">
              <span className="text-sm">Layer height (mm)</span>
              <input
                type="number"
                min={0.04}
                max={1}
                step={0.01}
                value={layerHeight}
                onChange={(e) => setLayerHeight(Number(e.target.value))}
                className="bg-zinc-950 border border-zinc-700 rounded px-3 py-2 text-sm"
              />
            </label>

            <label className="grid gap-1">
              <span className="text-sm">Infill density (%)</span>
              <input
                type="number"
                min={0}
                max={100}
                step={1}
                value={infillDensity}
                onChange={(e) => setInfillDensity(Number(e.target.value))}
                className="bg-zinc-950 border border-zinc-700 rounded px-3 py-2 text-sm"
              />
            </label>

            <label className="grid gap-1">
              <span className="text-sm">Infill pattern</span>
              <select
                value={infillPattern}
                onChange={(e) => setInfillPattern(e.target.value)}
                className="bg-zinc-950 border border-zinc-700 rounded px-3 py-2 text-sm"
              >
                <option value="gyroid">Gyroid</option>
                <option value="grid">Grid</option>
                <option value="cubic">Cubic</option>
                <option value="honeycomb">Honeycomb</option>
                <option value="rectilinear">Rectilinear</option>
                <option value="triangles">Triangles</option>
                <option value="lightning">Lightning</option>
              </select>
            </label>

            <label className="grid gap-1">
              <span className="text-sm">Wall loops</span>
              <input
                type="number"
                min={0}
                max={20}
                step={1}
                value={wallLoops}
                onChange={(e) => setWallLoops(Number(e.target.value))}
                className="bg-zinc-950 border border-zinc-700 rounded px-3 py-2 text-sm"
              />
            </label>

            <label className="grid gap-1">
              <span className="text-sm">Sparse infill speed (mm/s, 0 = profile)</span>
              <input
                type="number"
                min={0}
                step={1}
                value={sparseInfillSpeed}
                onChange={(e) => setSparseInfillSpeed(Number(e.target.value))}
                className="bg-zinc-950 border border-zinc-700 rounded px-3 py-2 text-sm"
              />
            </label>

            <label className="grid gap-1">
              <span className="text-sm">Initial layer speed (mm/s, 0 = profile)</span>
              <input
                type="number"
                min={0}
                step={1}
                value={initialLayerSpeed}
                onChange={(e) => setInitialLayerSpeed(Number(e.target.value))}
                className="bg-zinc-950 border border-zinc-700 rounded px-3 py-2 text-sm"
              />
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <label className="grid gap-1">
              <span className="text-sm">Brim</span>
              <select
                value={brimType}
                onChange={(e) => setBrimType(e.target.value)}
                className="bg-zinc-950 border border-zinc-700 rounded px-3 py-2 text-sm"
              >
                <option value="no_brim">No brim</option>
                <option value="auto_brim">Auto brim</option>
                <option value="outer_only">Outer only</option>
                <option value="inner_only">Inner only</option>
                <option value="outer_and_inner">Outer + inner</option>
                <option value="brim_ears">Mouse ears</option>
              </select>
            </label>

            <label className="grid gap-1">
              <span className="text-sm">Brim width (mm)</span>
              <input
                type="number"
                min={0}
                step={0.5}
                value={brimWidth}
                onChange={(e) => setBrimWidth(Number(e.target.value))}
                className="bg-zinc-950 border border-zinc-700 rounded px-3 py-2 text-sm"
              />
            </label>

            <label className="grid gap-1">
              <span className="text-sm">Raft layers</span>
              <input
                type="number"
                min={0}
                step={1}
                value={raftLayers}
                onChange={(e) => setRaftLayers(Number(e.target.value))}
                className="bg-zinc-950 border border-zinc-700 rounded px-3 py-2 text-sm"
              />
            </label>

            <label className="grid gap-1">
              <span className="text-sm">Skirt loops</span>
              <input
                type="number"
                min={0}
                step={1}
                value={skirtLoops}
                onChange={(e) => setSkirtLoops(Number(e.target.value))}
                className="bg-zinc-950 border border-zinc-700 rounded px-3 py-2 text-sm"
              />
            </label>
          </div>

          <div className="flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={enableSupport}
                onChange={(e) => setEnableSupport(e.target.checked)}
              />
              Enable supports
            </label>
            {enableSupport && (
              <select
                value={supportType}
                onChange={(e) => setSupportType(e.target.value)}
                className="bg-zinc-950 border border-zinc-700 rounded px-3 py-1 text-sm"
              >
                <option value="normal(auto)">Normal auto</option>
                <option value="tree(auto)">Tree auto</option>
                <option value="normal(manual)">Normal manual</option>
                <option value="tree(manual)">Tree manual</option>
              </select>
            )}
          </div>
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
            <input
              type="checkbox"
              checked={export3mf}
              onChange={(e) => {
                setExport3mf(e.target.checked);
                if (e.target.checked) setExportGcode3mf(false);
              }}
            />
            Also save 3MF project
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={exportGcode3mf}
              onChange={(e) => {
                setExportGcode3mf(e.target.checked);
                if (e.target.checked) setExport3mf(false);
              }}
            />
            Save Bambu-style .gcode.3mf
          </label>
        </div>

        <button
          onClick={sliceCurrentModel}
          disabled={busy || !info?.available}
          className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-700 disabled:text-zinc-400"
        >
          {busy ? 'Working…' : 'Slice current model'}
        </button>

        <SpoolInventory estimatedUsageGrams={estimate?.grams} />

        {estimate && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
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
              <div className="rounded border border-zinc-700 bg-zinc-800/50 p-3">
                <div className="text-xs text-zinc-400">Material cost</div>
                <div className="font-medium">
                  {estimate.grams ? '$' + ((estimate.grams / 1000) * filamentCostPerKg).toFixed(2) : '—'}
                </div>
              </div>
            </div>
            <label className="grid gap-1 max-w-xs">
              <span className="text-xs text-zinc-400">Filament cost per kg</span>
              <input
                type="number"
                min={0}
                step={1}
                value={filamentCostPerKg}
                onChange={(e) => setFilamentCostPerKg(Number(e.target.value))}
                className="bg-zinc-950 border border-zinc-700 rounded px-3 py-2 text-sm"
              />
            </label>
          </>
        )}

        <div className="rounded-lg border border-zinc-700 bg-zinc-800/30 p-4 space-y-4">
          <div>
            <div className="font-medium">Send to network printer</div>
            <div className="text-xs text-zinc-400 mt-1">Supports Moonraker/Klipper and OctoPrint. API keys stay only in memory for this app session.</div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="grid gap-1">
              <span className="text-sm">Printer system</span>
              <select
                value={printerKind}
                onChange={(e) => setPrinterKind(e.target.value as 'octoprint' | 'moonraker')}
                className="bg-zinc-950 border border-zinc-700 rounded px-3 py-2 text-sm"
              >
                <option value="moonraker">Moonraker / Klipper</option>
                <option value="octoprint">OctoPrint</option>
              </select>
            </label>
            <label className="grid gap-1">
              <span className="text-sm">Printer URL</span>
              <input
                value={remotePrinterUrl}
                onChange={(e) => setRemotePrinterUrl(e.target.value)}
                placeholder="http://printer.local"
                className="bg-zinc-950 border border-zinc-700 rounded px-3 py-2 text-sm"
              />
            </label>
          </div>

          <label className="grid gap-1">
            <span className="text-sm">API key (optional if your printer does not require one)</span>
            <input
              type="password"
              value={remotePrinterApiKey}
              onChange={(e) => setRemotePrinterApiKey(e.target.value)}
              autoComplete="off"
              className="bg-zinc-950 border border-zinc-700 rounded px-3 py-2 text-sm"
            />
          </label>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={remoteStartPrint}
              onChange={(e) => setRemoteStartPrint(e.target.checked)}
            />
            Start printing immediately after upload
          </label>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={testRemotePrinter}
              disabled={remoteBusy || !remotePrinterUrl.trim()}
              className="px-3 py-2 rounded bg-zinc-700 hover:bg-zinc-600 disabled:text-zinc-500 text-sm"
            >
              Test connection
            </button>
            <button
              type="button"
              onClick={sendToRemotePrinter}
              disabled={remoteBusy || !lastGcodeBase64 || !remotePrinterUrl.trim()}
              className="px-3 py-2 rounded bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-sm"
            >
              {remoteStartPrint ? 'Upload & print' : 'Upload G-code'}
            </button>
          </div>

          {remoteStatus && (
            <div className="text-sm text-zinc-300 bg-zinc-950 border border-zinc-700 rounded p-2">{remoteStatus}</div>
          )}
        </div>

        {status && (
          <pre className="whitespace-pre-wrap text-sm rounded border border-zinc-700 bg-zinc-950 p-3 text-zinc-300">
            {status}
          </pre>
        )}
      </div>
    </div>
  );
}
