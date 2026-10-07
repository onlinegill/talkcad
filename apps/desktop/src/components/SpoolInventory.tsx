import { useEffect, useMemo, useState } from 'react';

export interface SpoolRecord {
  id: string;
  name: string;
  material: string;
  color?: string;
  remainingGrams: number;
  costPerKg: number;
}

const STORAGE_KEY = 'talkcad-spool-inventory';

export function SpoolInventory({ estimatedUsageGrams }: { estimatedUsageGrams?: number }) {
  const [spools, setSpools] = useState<SpoolRecord[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [name, setName] = useState('');
  const [material, setMaterial] = useState('PLA');
  const [remainingGrams, setRemainingGrams] = useState(1000);
  const [costPerKg, setCostPerKg] = useState(20);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed?.spools)) {
        setSpools(parsed.spools.filter((item: unknown): item is SpoolRecord => {
          if (!item || typeof item !== 'object') return false;
          const spool = item as Partial<SpoolRecord>;
          return typeof spool.id === 'string' && typeof spool.name === 'string' && typeof spool.remainingGrams === 'number';
        }));
      }
      if (typeof parsed?.selectedId === 'string') setSelectedId(parsed.selectedId);
    } catch {
      // Ignore invalid old data.
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ spools, selectedId }));
  }, [spools, selectedId]);

  const selected = useMemo(() => spools.find((spool) => spool.id === selectedId) || null, [spools, selectedId]);

  const addSpool = () => {
    const spool: SpoolRecord = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: name.trim() || `${material} spool ${spools.length + 1}`,
      material: material.trim() || 'Unknown',
      remainingGrams: Math.max(0, remainingGrams),
      costPerKg: Math.max(0, costPerKg),
    };
    setSpools((current) => [...current, spool]);
    setSelectedId(spool.id);
    setName('');
  };

  const consumeEstimate = () => {
    if (!selected || !estimatedUsageGrams) return;
    setSpools((current) => current.map((spool) =>
      spool.id === selected.id
        ? { ...spool, remainingGrams: Math.max(0, spool.remainingGrams - estimatedUsageGrams) }
        : spool
    ));
  };

  return (
    <div className="rounded-lg border border-zinc-700 bg-zinc-800/30 p-4 space-y-4">
      <div>
        <div className="font-medium">Spool inventory</div>
        <div className="text-xs text-zinc-400 mt-1">Track multiple filament spools locally on this computer.</div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="grid gap-1">
          <span className="text-sm">Active spool</span>
          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            className="bg-zinc-950 border border-zinc-700 rounded px-3 py-2 text-sm"
          >
            <option value="">No spool selected</option>
            {spools.map((spool) => (
              <option key={spool.id} value={spool.id}>
                {spool.name} — {spool.material} — {spool.remainingGrams.toFixed(0)} g
              </option>
            ))}
          </select>
        </label>

        {selected && (
          <div className="rounded border border-zinc-700 bg-zinc-950 p-3 text-sm">
            <div>{selected.remainingGrams.toFixed(1)} g remaining</div>
            <div className="text-zinc-400">{selected.material} · ${selected.costPerKg.toFixed(2)}/kg</div>
            {estimatedUsageGrams ? (
              <div className={estimatedUsageGrams > selected.remainingGrams ? 'text-red-400 mt-1' : 'text-emerald-400 mt-1'}>
                {estimatedUsageGrams > selected.remainingGrams
                  ? `Short by ${(estimatedUsageGrams - selected.remainingGrams).toFixed(1)} g`
                  : `${(selected.remainingGrams - estimatedUsageGrams).toFixed(1)} g after this print`}
              </div>
            ) : null}
          </div>
        )}
      </div>

      <details className="rounded border border-zinc-700 bg-zinc-900/50 p-3">
        <summary className="cursor-pointer text-sm">Add spool</summary>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Spool name" className="bg-zinc-950 border border-zinc-700 rounded px-3 py-2 text-sm" />
          <input value={material} onChange={(e) => setMaterial(e.target.value)} placeholder="Material (PLA, PETG...)" className="bg-zinc-950 border border-zinc-700 rounded px-3 py-2 text-sm" />
          <label className="grid gap-1">
            <span className="text-xs text-zinc-400">Remaining grams</span>
            <input type="number" min={0} value={remainingGrams} onChange={(e) => setRemainingGrams(Number(e.target.value))} className="bg-zinc-950 border border-zinc-700 rounded px-3 py-2 text-sm" />
          </label>
          <label className="grid gap-1">
            <span className="text-xs text-zinc-400">Cost per kg</span>
            <input type="number" min={0} step={1} value={costPerKg} onChange={(e) => setCostPerKg(Number(e.target.value))} className="bg-zinc-950 border border-zinc-700 rounded px-3 py-2 text-sm" />
          </label>
          <button type="button" onClick={addSpool} className="px-3 py-2 rounded bg-blue-600 hover:bg-blue-500 text-sm">Add spool</button>
        </div>
      </details>

      {selected && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={!estimatedUsageGrams}
            onClick={consumeEstimate}
            className="px-3 py-2 rounded bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-sm"
          >
            Deduct this print
          </button>
          <button
            type="button"
            onClick={() => {
              setSpools((current) => current.filter((spool) => spool.id !== selected.id));
              setSelectedId('');
            }}
            className="px-3 py-2 rounded bg-zinc-700 hover:bg-zinc-600 text-sm"
          >
            Remove spool
          </button>
        </div>
      )}
    </div>
  );
}
