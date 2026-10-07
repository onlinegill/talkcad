import { useMemo, useState } from 'react';
import { useEditorStore } from '../store';

type Shape = 'box' | 'cylinder' | 'plate' | 'tray' | 'mounting-plate';

export function CreatePanel({ onCreated }: { onCreated?: () => void }) {
  const setCode = useEditorStore((s) => s.setCode);
  const [shape, setShape] = useState<Shape>('box');
  const [width, setWidth] = useState(60);
  const [depth, setDepth] = useState(40);
  const [height, setHeight] = useState(20);
  const [wall, setWall] = useState(2.4);
  const [radius, setRadius] = useState(4);
  const [holeDiameter, setHoleDiameter] = useState(4);
  const [edgeOffset, setEdgeOffset] = useState(6);

  const preview = useMemo(() => {
    const w = Math.max(1, width);
    const d = Math.max(1, depth);
    const h = Math.max(0.1, height);
    const t = Math.max(0.1, wall);
    const r = Math.max(0, Math.min(radius, Math.min(w, d) / 2));

    if (shape === 'cylinder') {
      return `// Parametric cylinder
diameter = ${w};
height = ${h};
$fn = 96;

cylinder(d = diameter, h = height);
`;
    }

    if (shape === 'plate') {
      return `// Rounded parametric plate
width = ${w};
depth = ${d};
thickness = ${t};
corner_radius = ${r};
$fn = 64;

module rounded_rect_2d(w, d, r) {
  hull() {
    for (x = [r, w-r])
      for (y = [r, d-r])
        translate([x, y]) circle(r = r);
  }
}

linear_extrude(height = thickness)
  rounded_rect_2d(width, depth, corner_radius);
`;
    }

    if (shape === 'tray') {
      return `// Parametric open tray
width = ${w};
depth = ${d};
height = ${h};
wall = ${t};
corner_radius = ${r};
$fn = 64;

module rounded_box(w, d, h, r) {
  linear_extrude(height = h)
    hull() {
      for (x = [r, w-r])
        for (y = [r, d-r])
          translate([x, y]) circle(r = r);
    }
}

difference() {
  rounded_box(width, depth, height, corner_radius);
  translate([wall, wall, wall])
    rounded_box(
      width - wall*2,
      depth - wall*2,
      height,
      max(0.1, corner_radius - wall)
    );
}
`;
    }

    if (shape === 'mounting-plate') {
      return `// Four-hole mounting plate
width = ${w};
depth = ${d};
thickness = ${t};
hole_diameter = ${Math.max(0.1, holeDiameter)};
edge_offset = ${Math.max(0, edgeOffset)};
corner_radius = ${r};
$fn = 64;

module rounded_rect_2d(w, d, r) {
  hull() {
    for (x = [r, w-r])
      for (y = [r, d-r])
        translate([x, y]) circle(r = r);
  }
}

difference() {
  linear_extrude(height = thickness)
    rounded_rect_2d(width, depth, corner_radius);

  for (x = [edge_offset, width-edge_offset])
    for (y = [edge_offset, depth-edge_offset])
      translate([x, y, -0.5])
        cylinder(d = hole_diameter, h = thickness + 1);
}
`;
    }

    return `// Parametric box
width = ${w};
depth = ${d};
height = ${h};

cube([width, depth, height]);
`;
  }, [shape, width, depth, height, wall, radius, holeDiameter, edgeOffset]);

  const apply = () => {
    setCode(preview);
    onCreated?.();
  };

  return (
    <div className="h-full overflow-auto p-5 bg-zinc-900">
      <div className="max-w-4xl mx-auto space-y-5">
        <div>
          <h2 className="text-xl font-semibold">Create shape</h2>
          <p className="text-sm text-zinc-400 mt-1">
            Start from a parametric part, then continue editing it with code or the AI chat.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <label className="grid gap-1">
            <span className="text-sm">Shape</span>
            <select
              value={shape}
              onChange={(e) => setShape(e.target.value as Shape)}
              className="bg-zinc-950 border border-zinc-700 rounded px-3 py-2"
            >
              <option value="box">Box</option>
              <option value="cylinder">Cylinder</option>
              <option value="plate">Rounded plate</option>
              <option value="tray">Tray</option>
              <option value="mounting-plate">Mounting plate</option>
            </select>
          </label>

          <NumberField label={shape === 'cylinder' ? 'Diameter (mm)' : 'Width (mm)'} value={width} onChange={setWidth} />
          {shape !== 'cylinder' && <NumberField label="Depth (mm)" value={depth} onChange={setDepth} />}
          {(shape === 'box' || shape === 'cylinder' || shape === 'tray') && (
            <NumberField label="Height (mm)" value={height} onChange={setHeight} />
          )}
          {(shape === 'plate' || shape === 'tray' || shape === 'mounting-plate') && (
            <NumberField label={shape === 'tray' ? 'Wall / floor (mm)' : 'Thickness (mm)'} value={wall} onChange={setWall} step={0.1} />
          )}
          {(shape === 'plate' || shape === 'tray' || shape === 'mounting-plate') && (
            <NumberField label="Corner radius (mm)" value={radius} onChange={setRadius} step={0.5} />
          )}
          {shape === 'mounting-plate' && (
            <>
              <NumberField label="Hole diameter (mm)" value={holeDiameter} onChange={setHoleDiameter} step={0.1} />
              <NumberField label="Hole edge offset (mm)" value={edgeOffset} onChange={setEdgeOffset} step={0.5} />
            </>
          )}
        </div>

        <div className="rounded-lg border border-zinc-700 bg-zinc-950 overflow-hidden">
          <div className="px-3 py-2 border-b border-zinc-700 text-xs text-zinc-400">Generated OpenSCAD</div>
          <pre className="p-3 text-xs overflow-auto whitespace-pre-wrap">{preview}</pre>
        </div>

        <button
          onClick={apply}
          className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-500"
        >
          Create model
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
        min={0}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="bg-zinc-950 border border-zinc-700 rounded px-3 py-2"
      />
    </label>
  );
}
