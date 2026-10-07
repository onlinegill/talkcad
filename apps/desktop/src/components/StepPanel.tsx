import { useEffect, useMemo, useState } from 'react';
import { useRenderStore } from '../store';

type Primitive = 'box' | 'cylinder' | 'sphere';
type EdgeFeature = 'none' | 'fillet' | 'chamfer';

export function StepPanel({ onPreview }: { onPreview?: () => void }) {
  const setRenderResult = useRenderStore((s) => s.setRenderResult);
  const [available, setAvailable] = useState(false);
  const [version, setVersion] = useState<string | null>(null);
  const [primitive, setPrimitive] = useState<Primitive>('box');
  const [width, setWidth] = useState(60);
  const [depth, setDepth] = useState(40);
  const [height, setHeight] = useState(20);
  const [diameter, setDiameter] = useState(40);
  const [holeDiameter, setHoleDiameter] = useState(0);
  const [edgeFeature, setEdgeFeature] = useState<EdgeFeature>('none');
  const [edgeAmount, setEdgeAmount] = useState(1);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');

  useEffect(() => {
    window.api.cadquery.detect()
      .then((result) => {
        setAvailable(result.available);
        setVersion(result.version);
      })
      .catch(() => setAvailable(false));
  }, []);

  const spec = useMemo(() => {
    const features: Array<Record<string, unknown>> = [];
    if (holeDiameter > 0 && primitive !== 'sphere') {
      features.push({ kind: 'hole', diameter: holeDiameter });
    }
    if (edgeFeature === 'fillet') {
      features.push({ kind: 'fillet', radius: edgeAmount, selector: '|Z' });
    } else if (edgeFeature === 'chamfer') {
      features.push({ kind: 'chamfer', length: edgeAmount, selector: '|Z' });
    }
    return {
      primitive,
      width,
      depth,
      height,
      diameter,
      features,
    };
  }, [primitive, width, depth, height, diameter, holeDiameter, edgeFeature, edgeAmount]);

  async function preview() {
    setBusy(true);
    setStatus('Generating CadQuery STL preview...');
    try {
      const result = await window.api.cadquery.export({ spec, format: 'stl' });
      if (!result.success || !result.output) {
        setStatus(result.error || 'CadQuery preview failed.');
        return;
      }
      const stats = await window.api.openscad.parseStlStats(result.output);
      setRenderResult(result.output, stats);
      setStatus('CadQuery preview generated.');
      onPreview?.();
    } finally {
      setBusy(false);
    }
  }

  async function exportStep() {
    setBusy(true);
    setStatus('Generating STEP...');
    try {
      const result = await window.api.cadquery.export({ spec, format: 'step' });
      if (!result.success || !result.output) {
        setStatus(result.error || 'STEP export failed.');
        return;
      }
      const path = await window.api.dialog.saveFile({
        title: 'Export STEP',
        defaultPath: result.fileName || 'talkcad-model.step',
        filters: [{ name: 'STEP CAD', extensions: ['step', 'stp'] }],
      });
      if (path) {
        await window.api.fsBinary.writeFile(path, result.output);
        setStatus(`STEP exported to ${path}`);
      } else {
        setStatus('STEP generated; save was cancelled.');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="h-full overflow-auto p-5 bg-zinc-900">
      <div className="max-w-3xl mx-auto space-y-5">
        <div>
          <h2 className="text-xl font-semibold">Native CAD / STEP</h2>
          <p className="text-sm text-zinc-400 mt-1">
            Build simple OpenCascade solids through CadQuery and export native STEP instead of a mesh.
          </p>
        </div>

        <div className="rounded border border-zinc-700 bg-zinc-800/50 p-3 text-sm">
          <span className={available ? 'text-emerald-400' : 'text-amber-400'}>
            {available ? `CadQuery ready${version ? ` · ${version}` : ''}` : 'CadQuery not detected'}
          </span>
          {!available && <div className="text-xs text-zinc-400 mt-1">Install CadQuery in Python to enable STEP export.</div>}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="grid gap-1">
            <span className="text-sm">Primitive</span>
            <select value={primitive} onChange={(e) => setPrimitive(e.target.value as Primitive)} className="bg-zinc-950 border border-zinc-700 rounded px-3 py-2">
              <option value="box">Box</option>
              <option value="cylinder">Cylinder</option>
              <option value="sphere">Sphere</option>
            </select>
          </label>

          {primitive === 'box' ? (
            <>
              <NumberField label="Width" value={width} onChange={setWidth} />
              <NumberField label="Depth" value={depth} onChange={setDepth} />
              <NumberField label="Height" value={height} onChange={setHeight} />
            </>
          ) : (
            <>
              <NumberField label="Diameter" value={diameter} onChange={setDiameter} />
              {primitive === 'cylinder' && <NumberField label="Height" value={height} onChange={setHeight} />}
            </>
          )}

          {primitive !== 'sphere' && <NumberField label="Center hole diameter (0 = none)" value={holeDiameter} onChange={setHoleDiameter} step={0.1} />}

          <label className="grid gap-1">
            <span className="text-sm">Vertical edge treatment</span>
            <select value={edgeFeature} onChange={(e) => setEdgeFeature(e.target.value as EdgeFeature)} className="bg-zinc-950 border border-zinc-700 rounded px-3 py-2">
              <option value="none">None</option>
              <option value="fillet">Fillet</option>
              <option value="chamfer">Chamfer</option>
            </select>
          </label>
          {edgeFeature !== 'none' && <NumberField label={edgeFeature === 'fillet' ? 'Fillet radius' : 'Chamfer length'} value={edgeAmount} onChange={setEdgeAmount} step={0.1} />}
        </div>

        <div className="flex flex-wrap gap-2">
          <button onClick={preview} disabled={!available || busy} className="px-4 py-2 rounded bg-zinc-700 hover:bg-zinc-600 disabled:text-zinc-500">Preview STL</button>
          <button onClick={exportStep} disabled={!available || busy} className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-700 disabled:text-zinc-500">Export STEP</button>
        </div>

        {status && <div className="text-sm rounded border border-zinc-700 bg-zinc-950 p-3">{status}</div>}
      </div>
    </div>
  );
}

function NumberField({ label, value, onChange, step = 1 }: { label: string; value: number; onChange: (value: number) => void; step?: number }) {
  return (
    <label className="grid gap-1">
      <span className="text-sm">{label} (mm)</span>
      <input type="number" min={0} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="bg-zinc-950 border border-zinc-700 rounded px-3 py-2" />
    </label>
  );
}
