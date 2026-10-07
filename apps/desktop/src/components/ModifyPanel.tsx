import { useMemo, useState } from 'react';
import { useEditorStore, useRenderStore } from '../store';

type Operation =
  | 'translate'
  | 'rotate'
  | 'scale'
  | 'hole'
  | 'rect-cut'
  | 'slot-cut'
  | 'tab'
  | 'text'
  | 'round-all'
  | 'array'
  | 'grid-array'
  | 'circle-array'
  | 'mirror';

const SCREW_CLEARANCE: Record<string, number> = {
  custom: 5,
  M2: 2.4,
  M2_5: 2.9,
  M3: 3.4,
  M4: 4.5,
  M5: 5.5,
  M6: 6.6,
  M8: 9.0,
};

export function ModifyPanel({ onApplied }: { onApplied?: () => void }) {
  const code = useEditorStore((s) => s.code);
  const setCode = useEditorStore((s) => s.setCode);
  const stats = useRenderStore((s) => s.stats);
  const [operation, setOperation] = useState<Operation>('translate');

  const [x, setX] = useState(0);
  const [y, setY] = useState(0);
  const [z, setZ] = useState(0);
  const [sx, setSx] = useState(1);
  const [sy, setSy] = useState(1);
  const [sz, setSz] = useState(1);

  const [diameter, setDiameter] = useState(5);
  const [depth, setDepth] = useState(50);
  const [axis, setAxis] = useState<'x' | 'y' | 'z'>('z');
  const [screwPreset, setScrewPreset] = useState('custom');
  const [holeStyle, setHoleStyle] = useState<'straight' | 'countersink' | 'counterbore'>('straight');
  const [headDiameter, setHeadDiameter] = useState(8);
  const [headDepth, setHeadDepth] = useState(3);

  const [cutWidth, setCutWidth] = useState(10);
  const [cutHeight, setCutHeight] = useState(10);
  const [slotLength, setSlotLength] = useState(20);
  const [tabWidth, setTabWidth] = useState(15);
  const [tabDepth, setTabDepth] = useState(8);
  const [tabHeight, setTabHeight] = useState(4);

  const [textValue, setTextValue] = useState('TEXT');
  const [textSize, setTextSize] = useState(8);
  const [textDepth, setTextDepth] = useState(1);
  const [textMode, setTextMode] = useState<'raised' | 'engraved'>('raised');

  const [roundRadius, setRoundRadius] = useState(1);

  const [count, setCount] = useState(2);
  const [spacing, setSpacing] = useState(20);
  const [gridX, setGridX] = useState(2);
  const [gridY, setGridY] = useState(2);
  const [circleRadius, setCircleRadius] = useState(30);

  const effectiveDiameter = screwPreset === 'custom'
    ? Math.max(0.1, diameter)
    : SCREW_CLEARANCE[screwPreset] ?? diameter;

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

    if (operation === 'grid-array') {
      return base + `for (ix = [0:${Math.max(1, Math.floor(gridX)) - 1}])
  for (iy = [0:${Math.max(1, Math.floor(gridY)) - 1}])
    translate([ix * ${spacing}, iy * ${spacing}, 0])
      talkcad_base_model();
`;
    }

    if (operation === 'circle-array') {
      return base + `for (i = [0:${Math.max(1, Math.floor(count)) - 1}]) {
  a = 360 * i / ${Math.max(1, Math.floor(count))};
  rotate([0, 0, a])
    translate([${circleRadius}, 0, 0])
      talkcad_base_model();
}
`;
    }

    if (operation === 'rect-cut') {
      return base + `difference() {
  talkcad_base_model();
  translate([${x}, ${y}, ${z}])
    cube([${Math.max(0.1, cutWidth)}, ${Math.max(0.1, cutHeight)}, ${Math.max(0.1, depth)}], center = true);
}
`;
    }

    if (operation === 'slot-cut') {
      const half = Math.max(0, slotLength / 2 - cutWidth / 2);
      return base + `difference() {
  talkcad_base_model();
  translate([${x}, ${y}, ${z}])
    hull() {
      translate([-${half}, 0, 0]) cylinder(d = ${Math.max(0.1, cutWidth)}, h = ${Math.max(0.1, depth)}, center = true, $fn = 64);
      translate([${half}, 0, 0]) cylinder(d = ${Math.max(0.1, cutWidth)}, h = ${Math.max(0.1, depth)}, center = true, $fn = 64);
    }
}
`;
    }

    if (operation === 'tab') {
      return base + `union() {
  talkcad_base_model();
  translate([${x}, ${y}, ${z}])
    cube([${Math.max(0.1, tabWidth)}, ${Math.max(0.1, tabDepth)}, ${Math.max(0.1, tabHeight)}], center = true);
}
`;
    }

    if (operation === 'text') {
      const escaped = textValue.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
      const textSolid = `translate([${x}, ${y}, ${z}])
  linear_extrude(height = ${Math.max(0.1, textDepth)})
    text("${escaped}", size = ${Math.max(0.1, textSize)}, halign = "center", valign = "center");`;
      return textMode === 'raised'
        ? base + `union() {
  talkcad_base_model();
  ${textSolid}
}
`
        : base + `difference() {
  talkcad_base_model();
  ${textSolid}
}
`;
    }

    if (operation === 'round-all') {
      return base + `minkowski() {
  talkcad_base_model();
  sphere(r = ${Math.max(0.01, roundRadius)}, $fn = 32);
}
`;
    }

    if (operation === 'hole') {
      const rotation = axis === 'x' ? '[0,90,0]' : axis === 'y' ? '[90,0,0]' : '[0,0,0]';
      const mainHole = `rotate(${rotation}) cylinder(d = ${effectiveDiameter}, h = ${Math.max(0.1, depth)}, center = true, $fn = 64);`;

      let cutter = mainHole;
      if (holeStyle === 'counterbore') {
        cutter = `union() {
      ${mainHole}
      translate([0,0,${Math.max(0, depth / 2 - headDepth / 2)}])
        rotate(${rotation}) cylinder(d = ${Math.max(effectiveDiameter, headDiameter)}, h = ${Math.max(0.1, headDepth)}, center = true, $fn = 64);
    }`;
      } else if (holeStyle === 'countersink') {
        cutter = `union() {
      ${mainHole}
      translate([0,0,${Math.max(0, depth / 2 - headDepth / 2)}])
        rotate(${rotation}) cylinder(d1 = ${effectiveDiameter}, d2 = ${Math.max(effectiveDiameter, headDiameter)}, h = ${Math.max(0.1, headDepth)}, center = true, $fn = 64);
    }`;
      }

      return base + `difference() {
  talkcad_base_model();
  translate([${x}, ${y}, ${z}])
    ${cutter}
}
`;
    }

    return base + 'talkcad_base_model();\n';
  }, [
    axis, circleRadius, code, count, cutHeight, cutWidth, depth, effectiveDiameter,
    gridX, gridY, headDepth, headDiameter, holeStyle, operation, roundRadius,
    slotLength, spacing, sx, sy, sz, tabDepth, tabHeight, tabWidth, textDepth,
    textMode, textSize, textValue, x, y, z,
  ]);

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
            Apply common parametric CAD operations without manually rewriting the OpenSCAD.
          </p>
        </div>

        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
            <Measure label="Width" value={stats.dimensions.x} unit="mm" />
            <Measure label="Depth" value={stats.dimensions.y} unit="mm" />
            <Measure label="Height" value={stats.dimensions.z} unit="mm" />
            <Measure label="Volume" value={stats.volume} unit="mm³" />
          </div>
        )}

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
            <option value="hole">Hole / countersink / counterbore</option>
            <option value="rect-cut">Rectangular cut</option>
            <option value="slot-cut">Slot cut</option>
            <option value="tab">Add tab / boss</option>
            <option value="text">Raised / engraved text</option>
            <option value="round-all">Round whole part</option>
            <option value="array">Linear array</option>
            <option value="grid-array">Grid array</option>
            <option value="circle-array">Circular array</option>
            <option value="mirror">Mirror</option>
          </select>
        </label>

        {['translate', 'rotate', 'hole', 'rect-cut', 'slot-cut', 'tab', 'text'].includes(operation) && (
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
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <label className="grid gap-1">
                <span className="text-sm">Screw clearance</span>
                <select value={screwPreset} onChange={(e) => setScrewPreset(e.target.value)} className="bg-zinc-950 border border-zinc-700 rounded px-3 py-2">
                  <option value="custom">Custom</option>
                  <option value="M2">M2</option>
                  <option value="M2_5">M2.5</option>
                  <option value="M3">M3</option>
                  <option value="M4">M4</option>
                  <option value="M5">M5</option>
                  <option value="M6">M6</option>
                  <option value="M8">M8</option>
                </select>
              </label>
              <NumberField label="Hole diameter (mm)" value={effectiveDiameter} onChange={setDiameter} step={0.1} disabled={screwPreset !== 'custom'} />
              <NumberField label="Hole depth (mm)" value={depth} onChange={setDepth} step={0.5} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <label className="grid gap-1">
                <span className="text-sm">Hole style</span>
                <select value={holeStyle} onChange={(e) => setHoleStyle(e.target.value as typeof holeStyle)} className="bg-zinc-950 border border-zinc-700 rounded px-3 py-2">
                  <option value="straight">Straight</option>
                  <option value="countersink">Countersink</option>
                  <option value="counterbore">Counterbore</option>
                </select>
              </label>
              <label className="grid gap-1">
                <span className="text-sm">Axis</span>
                <select value={axis} onChange={(e) => setAxis(e.target.value as 'x' | 'y' | 'z')} className="bg-zinc-950 border border-zinc-700 rounded px-3 py-2">
                  <option value="x">X</option><option value="y">Y</option><option value="z">Z</option>
                </select>
              </label>
              {holeStyle !== 'straight' && <NumberField label="Head diameter (mm)" value={headDiameter} onChange={setHeadDiameter} step={0.1} />}
              {holeStyle !== 'straight' && <NumberField label="Head depth (mm)" value={headDepth} onChange={setHeadDepth} step={0.1} />}
            </div>
          </div>
        )}

        {operation === 'rect-cut' && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <NumberField label="Cut width" value={cutWidth} onChange={setCutWidth} />
            <NumberField label="Cut height" value={cutHeight} onChange={setCutHeight} />
            <NumberField label="Cut depth" value={depth} onChange={setDepth} />
          </div>
        )}

        {operation === 'slot-cut' && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <NumberField label="Slot length" value={slotLength} onChange={setSlotLength} />
            <NumberField label="Slot width" value={cutWidth} onChange={setCutWidth} />
            <NumberField label="Cut depth" value={depth} onChange={setDepth} />
          </div>
        )}

        {operation === 'tab' && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <NumberField label="Tab width" value={tabWidth} onChange={setTabWidth} />
            <NumberField label="Tab depth" value={tabDepth} onChange={setTabDepth} />
            <NumberField label="Tab height" value={tabHeight} onChange={setTabHeight} />
          </div>
        )}

        {operation === 'text' && (
          <div className="grid gap-3">
            <input value={textValue} onChange={(e) => setTextValue(e.target.value)} className="bg-zinc-950 border border-zinc-700 rounded px-3 py-2" placeholder="Text" />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <NumberField label="Text size" value={textSize} onChange={setTextSize} step={0.5} />
              <NumberField label="Text depth" value={textDepth} onChange={setTextDepth} step={0.1} />
              <label className="grid gap-1">
                <span className="text-sm">Mode</span>
                <select value={textMode} onChange={(e) => setTextMode(e.target.value as 'raised' | 'engraved')} className="bg-zinc-950 border border-zinc-700 rounded px-3 py-2">
                  <option value="raised">Raised</option>
                  <option value="engraved">Engraved</option>
                </select>
              </label>
            </div>
          </div>
        )}

        {operation === 'round-all' && <NumberField label="Round radius (mm)" value={roundRadius} onChange={setRoundRadius} step={0.1} />}

        {(operation === 'array' || operation === 'grid-array' || operation === 'circle-array' || operation === 'mirror') && (
          <label className="grid gap-1 max-w-xs">
            <span className="text-sm">Axis</span>
            <select value={axis} onChange={(e) => setAxis(e.target.value as 'x' | 'y' | 'z')} className="bg-zinc-950 border border-zinc-700 rounded px-3 py-2">
              <option value="x">X</option><option value="y">Y</option><option value="z">Z</option>
            </select>
          </label>
        )}

        {operation === 'array' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <NumberField label="Count" value={count} onChange={setCount} />
            <NumberField label="Spacing (mm)" value={spacing} onChange={setSpacing} step={0.5} />
          </div>
        )}

        {operation === 'grid-array' && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <NumberField label="X count" value={gridX} onChange={setGridX} />
            <NumberField label="Y count" value={gridY} onChange={setGridY} />
            <NumberField label="Spacing (mm)" value={spacing} onChange={setSpacing} step={0.5} />
          </div>
        )}

        {operation === 'circle-array' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <NumberField label="Count" value={count} onChange={setCount} />
            <NumberField label="Circle radius (mm)" value={circleRadius} onChange={setCircleRadius} step={0.5} />
          </div>
        )}

        <div className="rounded-lg border border-zinc-700 bg-zinc-950 overflow-hidden">
          <div className="px-3 py-2 border-b border-zinc-700 text-xs text-zinc-400">Resulting OpenSCAD</div>
          <pre className="p-3 text-xs max-h-72 overflow-auto whitespace-pre-wrap">
            {wrapped || 'Create or load an OpenSCAD model first.'}
          </pre>
        </div>

        <button disabled={!wrapped} onClick={apply} className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-700 disabled:text-zinc-400">
          Apply operation
        </button>
      </div>
    </div>
  );
}

function Measure({ label, value, unit }: { label: string; value: number; unit: string }) {
  return (
    <div className="rounded border border-zinc-700 bg-zinc-800/50 p-2">
      <div className="text-xs text-zinc-400">{label}</div>
      <div>{Number.isFinite(value) ? value.toFixed(2) : '—'} {unit}</div>
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
  step = 1,
  disabled = false,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  step?: number;
  disabled?: boolean;
}) {
  return (
    <label className="grid gap-1">
      <span className="text-sm">{label}</span>
      <input
        type="number"
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="bg-zinc-950 border border-zinc-700 rounded px-3 py-2 disabled:text-zinc-500"
      />
    </label>
  );
}
