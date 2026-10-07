import { useMemo, useState } from 'react';
import { useEditorStore, usePartsStore, type ProjectPart } from '../store';

export function PartsPanel({ onAssemble }: { onAssemble?: () => void }) {
  const code = useEditorStore((s) => s.code);
  const setCode = useEditorStore((s) => s.setCode);
  const parts = usePartsStore((s) => s.parts);
  const addPart = usePartsStore((s) => s.addPart);
  const updatePart = usePartsStore((s) => s.updatePart);
  const removePart = usePartsStore((s) => s.removePart);
  const clearParts = usePartsStore((s) => s.clearParts);
  const [name, setName] = useState('Part');

  const assembly = useMemo(() => {
    const enabled = parts.filter((p) => p.enabled);
    if (!enabled.length) return '';

    const modules = enabled.map((part, index) => `module talkcad_part_${index}() {
${part.code}
}
`).join('\n');

    const instances = enabled.map((part, index) => `translate([${part.translate.join(', ')}])
  rotate([${part.rotate.join(', ')}])
    talkcad_part_${index}(); // ${part.name}`).join('\n\n');

    return modules + '\n' + instances + '\n';
  }, [parts]);

  const captureCurrent = () => {
    if (!code.trim()) return;
    const part: ProjectPart = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: name.trim() || `Part ${parts.length + 1}`,
      code,
      enabled: true,
      translate: [0, 0, 0],
      rotate: [0, 0, 0],
    };
    addPart(part);
    setName(`Part ${parts.length + 2}`);
  };

  const assemble = () => {
    if (!assembly) return;
    setCode(assembly);
    onAssemble?.();
  };

  return (
    <div className="h-full overflow-auto p-5 bg-zinc-900">
      <div className="max-w-5xl mx-auto space-y-5">
        <div>
          <h2 className="text-xl font-semibold">Parts & assembly</h2>
          <p className="text-sm text-zinc-400 mt-1">
            Capture multiple parametric parts, position them independently, and generate one assembly model.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Part name"
            className="flex-1 bg-zinc-950 border border-zinc-700 rounded px-3 py-2"
          />
          <button
            onClick={captureCurrent}
            disabled={!code.trim()}
            className="px-4 py-2 rounded bg-zinc-700 hover:bg-zinc-600 disabled:text-zinc-500"
          >
            Capture current model
          </button>
        </div>

        <div className="space-y-3">
          {parts.map((part) => (
            <div key={part.id} className="rounded-lg border border-zinc-700 bg-zinc-800/50 p-3 space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <input
                  type="checkbox"
                  checked={part.enabled}
                  onChange={(e) => updatePart(part.id, { enabled: e.target.checked })}
                />
                <input
                  value={part.name}
                  onChange={(e) => updatePart(part.id, { name: e.target.value })}
                  className="flex-1 min-w-40 bg-zinc-950 border border-zinc-700 rounded px-2 py-1"
                />
                <button onClick={() => removePart(part.id)} className="text-sm text-red-400 hover:text-red-300">Remove</button>
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                <VectorEditor
                  label="Move X / Y / Z"
                  value={part.translate}
                  onChange={(value) => updatePart(part.id, { translate: value })}
                />
                <VectorEditor
                  label="Rotate X / Y / Z"
                  value={part.rotate}
                  onChange={(value) => updatePart(part.id, { rotate: value })}
                />
              </div>
            </div>
          ))}

          {parts.length === 0 && (
            <div className="text-sm text-zinc-500 border border-dashed border-zinc-700 rounded p-6 text-center">
              No captured parts yet.
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={assemble}
            disabled={!assembly}
            className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-700 disabled:text-zinc-500"
          >
            Build assembly
          </button>
          <button
            onClick={clearParts}
            disabled={!parts.length}
            className="px-4 py-2 rounded bg-zinc-700 hover:bg-zinc-600 disabled:text-zinc-500"
          >
            Clear parts
          </button>
        </div>
      </div>
    </div>
  );
}

function VectorEditor({
  label,
  value,
  onChange,
}: {
  label: string;
  value: [number, number, number];
  onChange: (value: [number, number, number]) => void;
}) {
  return (
    <div>
      <div className="text-xs text-zinc-400 mb-1">{label}</div>
      <div className="grid grid-cols-3 gap-2">
        {value.map((v, index) => (
          <input
            key={index}
            type="number"
            value={v}
            onChange={(e) => {
              const next = [...value] as [number, number, number];
              next[index] = Number(e.target.value);
              onChange(next);
            }}
            className="min-w-0 bg-zinc-950 border border-zinc-700 rounded px-2 py-1"
          />
        ))}
      </div>
    </div>
  );
}
