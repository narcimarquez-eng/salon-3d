import { useEffect, useMemo, useState } from 'react';
import { Skull, Loader2 } from 'lucide-react';
import type { GlbSource } from './GlbZonesPanel';
import { MONSTER_TIERS, MonsterInfo, MonsterTier, generateMonsterGlb, getEnemigoVersion, listMonsters } from '../enemigos/enemyGenerator';
import { SURFACE_LABELS, monsterSurface, recommendMonsterPlans } from '../enemigos/monsterTextures';

interface MonsterLoaderPanelProps {
  /** Entrega el GLB generado: se muestra en el visor y pasa al panel "Optimizar GLB por zonas" */
  onLoad: (source: GlbSource) => void;
}

const STORAGE_KEY = 'salon3d.monstruo.v1';

function readSaved(): { key?: string; tier?: MonsterTier; textures?: boolean } {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

export default function MonsterLoaderPanel({ onLoad }: MonsterLoaderPanelProps) {
  const saved = useMemo(readSaved, []);
  const [open, setOpen] = useState(false);
  const [monsters, setMonsters] = useState<MonsterInfo[]>([]);
  const [version, setVersion] = useState<string>('');
  const [filter, setFilter] = useState('');
  const [key, setKey] = useState(saved.key || 'elder_dragon');
  const [tier, setTier] = useState<MonsterTier>(saved.tier || 'medium');
  const [withTextures, setWithTextures] = useState(saved.textures ?? true);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // El código de los monstruos solo se descarga al abrir el panel
  useEffect(() => {
    if (!open || monsters.length) return;
    listMonsters().then(setMonsters).catch((e) => setError(String(e)));
    getEnemigoVersion().then((v) => setVersion(`${v.commit.slice(0, 7)} · ${v.date.slice(0, 10)}`)).catch(() => {});
  }, [open, monsters.length]);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ key, tier, textures: withTextures })); } catch { /* sin almacenamiento */ }
  }, [key, tier, withTextures]);

  const groups = useMemo(() => {
    const f = filter.trim().toLowerCase();
    const out = new Map<string, MonsterInfo[]>();
    for (const m of monsters) {
      if (f && !`${m.name} ${m.title} ${m.key}`.toLowerCase().includes(f)) continue;
      const list = out.get(m.categoryLabel) || [];
      list.push(m);
      out.set(m.categoryLabel, list);
    }
    return out;
  }, [monsters, filter]);

  const selected = monsters.find((m) => m.key === key);

  const load = async () => {
    if (!selected) return;
    setBusy(true); setError(null); setStatus('Generando el monstruo…');
    try {
      const g = await generateMonsterGlb(selected.key, tier);
      const file = new File([g.bytes], g.filename, { type: 'model/gltf-binary' });
      const surface = SURFACE_LABELS[monsterSurface(g.info)];
      setStatus(`${g.info.name} · ${tier} · ${g.triangles.toLocaleString()} triángulos · ${(g.bytes.byteLength / 1e6).toFixed(2)} MB · ${surface}`);
      onLoad(
        withTextures
          ? { name: g.filename, file, recommend: (zones) => recommendMonsterPlans(g.info, tier, zones), autoRun: true }
          : { name: g.filename, file }
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStatus(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-3 rounded-lg bg-slate-900/75 border border-slate-800/90 space-y-2.5" data-testid="panel-monstruos">
      <button type="button" onClick={() => setOpen((o) => !o)} className="w-full flex items-center justify-between cursor-pointer">
        <span className="font-semibold text-rose-300 flex items-center gap-1.5">
          <Skull className="w-3.5 h-3.5 text-rose-400" />
          <span>Monstruos de Enemigo-rpg</span>
        </span>
        <span className="text-[10px] text-slate-400">{open ? 'ocultar' : monsters.length ? `${monsters.length}` : 'abrir'}</span>
      </button>
      {open && (
        <>
          <p className="text-[11px] text-slate-400 leading-snug">
            Genera cualquier monstruo del repositorio Enemigo-rpg en la calidad que elijas y le pone las texturas recomendadas de salon-3d
            (pelaje, plumas, quitina, hueso…) conservando huesos y animaciones.
          </p>
          <input
            type="search"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder={monsters.length ? `Buscar entre ${monsters.length} monstruos…` : 'Cargando lista…'}
            className="w-full py-1 px-2 rounded bg-slate-900 border border-slate-700 text-[11px] text-slate-100"
            aria-label="Buscar monstruo"
          />
          <select
            value={key}
            onChange={(e) => setKey(e.target.value)}
            className="w-full py-1 px-1 rounded bg-slate-900 border border-slate-700 text-[11px] text-slate-100"
            aria-label="Monstruo"
          >
            {!selected && <option value={key}>{monsters.length ? 'Elige un monstruo' : 'Cargando…'}</option>}
            {[...groups.entries()].map(([label, list]) => (
              <optgroup key={label} label={label}>
                {list.map((m) => (
                  <option key={m.key} value={m.key}>{m.name} — {m.title}</option>
                ))}
              </optgroup>
            ))}
          </select>
          <div className="flex items-center gap-2">
            <select
              value={tier}
              onChange={(e) => setTier(e.target.value as MonsterTier)}
              className="flex-1 py-1 px-1 rounded bg-slate-900 border border-slate-700 text-[11px] text-slate-100"
              aria-label="Calidad"
            >
              {MONSTER_TIERS.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
            <label className="flex items-center gap-1.5 text-[11px] text-slate-300" title="Pelaje, plumas, quitina, hueso, roca o corteza según el monstruo">
              <input type="checkbox" checked={withTextures} onChange={(e) => setWithTextures(e.target.checked)} />
              <span>Texturas salon-3d</span>
            </label>
          </div>
          {selected && (
            <div className="text-[10px] text-slate-500">
              {selected.rpgTier} · {selected.element} · superficie: {SURFACE_LABELS[monsterSurface(selected)]}
            </div>
          )}
          <button
            type="button"
            onClick={load}
            disabled={busy || !selected}
            className="w-full py-2 px-2 rounded-lg bg-rose-400 hover:bg-rose-300 text-slate-950 font-semibold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Skull className="w-3.5 h-3.5" />}
            <span>{busy ? 'Generando…' : 'Cargar monstruo'}</span>
          </button>
          {status && <div className="text-[11px] text-slate-300" data-testid="monstruo-estado">{status}</div>}
          {error && <div className="text-[11px] px-2 py-1 rounded border text-rose-300 bg-rose-500/10 border-rose-400/30">{error}</div>}
          {version && <div className="text-[10px] text-slate-600">Enemigo-rpg {version}</div>}
        </>
      )}
    </div>
  );
}
