import { useMemo, useState } from 'react';
import { useEditorStore } from '../store';

type Operation = 'translate' | 'rotate' | 'scale' | 'hole' | 'array' | 'mirror';

export function ModifyPanel({ onApplied }: { onApplied?: () => void }) {
  const code = useEditorStore((s) => s.code);
  const setCode = useEditorStore((s) => s.setCode);
  const [operation, setOperation] = useState<Operation>('translate');

  const [x, setX] = useState(0);
  const [y, setY] = useState(0);
  const [z, setZ] = useState(0);
  const [sx, setSx] = useState(1);
  const [sy, setSy] = useState(1);
  const [sz, setSz] = useState(1);
  const [diameter, setDiameter] = useState(5);
  const [depth, setDepth] = useState(50);
  const [count, setCount] = useState(2);
  const [spacing, setSpacing] = useState(20);
  const [axis, setAxis] = useState<'x' | 'y' | 'z'>('x');

  const wrapped = useMemo(() => {
    if (!code.trim()) return '';

    const base = `module talkcad_base_model() {
${code}
}

`;

    if (operation === 'translate') {
      return base + `translate([${x}, ${y}, ${z}]) talkcad_base_model();\n`;
    }

    if (operation === 'rotate') {
      return base + `rotate([${x}, ${y}, ${z}]) talkcad_base_model();\n`;
    }

    if (operation === 'scale') {
      return base + `scale([${sx}, ${sy}, ${sz}]) talkcad_base_model();\n`;
    }

    if (operation === 'mirror') {
      const vector = axis === 'x' ? '[1,0,0]' : axis === 'y' ? '[0,1,0]' : '[0,0,1]';
      return base + `mirror(${vector}) talkcad_base_model();\n`;
    }

    if (operation === 'array') {
      const vector = axis === 'x'
        ? `[i * ${spacing}, 0, 0]`
        : axis === 'y'
          ? `[0, i * ${spacing}, 0]`
          : `[0, 0, i * ${spacing}]`;
      return base + `for (i = [0:${Math.max(1, Math.floor(count)) - 1}])
  translate(${vector})
    talkcad_base_model();
`;
    }

    return base + `difference() {
  talkcad_base_model();
  translate([${x}, ${y}, ${z}])
    cylinder(d = ${Math.max(0.1, diameter)}, h = ${Math.max(0.1, depth)}, center = true, $fn = 64);
}
`;
  }, [axis, code, count, depth, diameter, operation, spacing, sx, sy, sz, x, y, z]);

  const apply = () => {
    if (!wrapped) return;
    setCode(wrapped);
    onApplied?.();
  };

  return (
    <div className="h-full overflow-auto p-5 bg-zinc-900">
      <div className="max-w-4xl mx-auto space-y-5">
        <div>
          <h2 className="text-xl font-semibold">Modify model</h2>
          <p className="text-sm text-zinc-400 mt-1">
            Apply common CAD operations without manually rewriting the OpenSCAD.
          </p>
        </div>

        <label className="grid gap-1">
          <span className="text-sm">Operation</span>
          <select
            value={operation}
            onChange={(e) => setOperation(e.target.value as Operation)}
            className="bg-zinc-950 border border-zinc-700 rounded px-3 py-2"
          >
            <option value="translate">Move / translate</option>
            <option value="rotate">Rotate</option>
            <option value="scale">Scale</option>
            <option value="hole">Cut cylindrical hole</option>
            <option value="array">Linear array</option>
            <option value="mirror">Mirror</option>
          </select>
        </label>

        {(operation === 'translate' || operation === 'rotate' || operation === 'hole') && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <NumberField label={operation === 'rotate' ? 'X angle' : 'X'} value={x} onChange={setX} />
            <NumberField label={operation === 'rotate' ? 'Y angle' : 'Y'} value={y} onChange={setY} />
            <NumberField label={operation === 'rotate' ? 'Z angle' : 'Z'} value={z} onChange={setZ} />
          </div>
        )}

        {operation === 'scale' && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <NumberField label="Scale X" value={sx} onChange={setSx} step={0.1} />
            <NumberField label="Scale Y" value={sy} onChange={setSy} step={0.1} />
            <NumberField label="Scale Z" value={sz} onChange={setSz} step={0.1} />
          </div>
        )}

        {operation === 'hole' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <NumberField label="Hole diameter (mm)" value={diameter} onChange={setDiameter} step={0.1} />
            <NumberField label="Hole depth (mm)" value={depth} onChange={setDepth} step={0.5} />
          </div>
        )}

        {(operation === 'array' || operation === 'mirror') && (
          <label className="grid gap-1">
            <span className="text-sm">Axis</span>
            <select
              value={axis}
              onChange={(e) => setAxis(e.target.value as 'x' | 'y' | 'z')}
              className="bg-zinc-950 border border-zinc-700 rounded px-3 py-2"
            >
              <option value="x">X</option>
              <option value="y">Y</option>
              <option value="z">Z</option>
            </select>
          </label>
        )}

        {operation === 'array' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <NumberField label="Count" value={count} onChange={setCount} />
            <NumberField label="Spacing (mm)" value={spacing} onChange={setSpacing} step={0.5} />
          </div>
        )}

        <div className="rounded-lg border border-zinc-700 bg-zinc-950 overflow-hidden">
          <div className="px-3 py-2 border-b border-zinc-700 text-xs text-zinc-400">Resulting OpenSCAD</div>
          <pre className="p-3 text-xs max-h-72 overflow-auto whitespace-pre-wrap">
            {wrapped || 'Create or load an OpenSCAD model first.'}
          </pre>
        </div>

        <button
          disabled={!wrapped}
          onClick={apply}
          className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-700 disabled:text-zinc-400"
        >
          Apply operation
        </button>
      </div>
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
  step = 1,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  step?: number;
}) {
  return (
    <label className="grid gap-1">
      <span className="text-sm">{label}</span>
      <input
        type="number"
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="bg-zinc-950 border border-zinc-700 rounded px-3 py-2"
      />
    </label>
  );
}
