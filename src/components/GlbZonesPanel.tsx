import { useEffect, useMemo, useState } from 'react';
import { Layers3, Wand2, Download, Play } from 'lucide-react';
import { TEXTURE_PRESETS, TexturePatternType } from '../utils/proceduralTextures';
import { ColorMapTextureInfo, listAllColorMapTextures } from '../utils/textureLibrary';
import {
  GlbSummary,
  GlbZone,
  OptimizeResult,
  ZonePlan,
  ZoneTextureChoice,
  analyzeGlbZones,
  optimizeGlb,
  suggestZoneChoice,
} from '../utils/glbZoneOptimizer';

interface GlbZonesPanelProps {
  /** GLB original subido por el usuario (no cambia al previsualizar el resultado) */
  source: { name: string; file: File } | null;
  /** Carga un GLB en el visor sin sustituir el original */
  onPreview: (file: File) => void;
}

const SIZES = [0, 2048, 1024, 512, 256, 128];

function mb(n: number): string {
  return `${(n / 1e6).toFixed(2)} MB`;
}

function choiceToValue(c: ZoneTextureChoice): string {
  if (c.kind === 'pattern') return `p:${c.pattern}`;
  if (c.kind === 'user') return `u:${c.id}`;
  return c.kind;
}

function valueToChoice(v: string, prev: ZoneTextureChoice): ZoneTextureChoice {
  const repeat = prev.kind === 'pattern' || prev.kind === 'user' ? prev.repeat : 2;
  if (v.startsWith('p:')) return { kind: 'pattern', pattern: v.slice(2) as TexturePatternType, repeat, natural: false };
  if (v.startsWith('u:')) return { kind: 'user', id: v.slice(2), repeat };
  return v === 'none' ? { kind: 'none' } : { kind: 'keep' };
}

function prettyZoneName(name: string): string {
  return name.replace(/^(Mat|Material|Skinned_Unified_Mat)_/i, '').replace(/_/g, ' ');
}

export default function GlbZonesPanel({ source, onPreview }: GlbZonesPanelProps) {
  const [zones, setZones] = useState<GlbZone[]>([]);
  const [summary, setSummary] = useState<GlbSummary | null>(null);
  const [plans, setPlans] = useState<Map<number, ZonePlan>>(new Map());
  const [userTextures, setUserTextures] = useState<ColorMapTextureInfo[]>([]);
  const [compactSkin, setCompactSkin] = useState(true);
  const [replaceExisting, setReplaceExisting] = useState(false);
  const [triangleRatio, setTriangleRatio] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<OptimizeResult | null>(null);

  // Analizar el GLB al cargarlo
  useEffect(() => {
    setZones([]); setSummary(null); setResult(null); setError(null);
    if (!source) return;
    let cancelled = false;
    source.file.arrayBuffer().then((buf) => {
      if (cancelled) return;
      try {
        const a = analyzeGlbZones(buf);
        setZones(a.zones);
        setSummary(a.summary);
        setPlans(new Map(a.zones.map((z) => [z.index, { choice: { kind: 'keep' }, maxSize: 1024 } as ZonePlan])));
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    });
    listAllColorMapTextures().then((t) => { if (!cancelled) setUserTextures(t); });
    return () => { cancelled = true; };
  }, [source]);

  const setPlan = (index: number, patch: Partial<ZonePlan>) => {
    setPlans((prev) => {
      const next = new Map(prev);
      const cur = next.get(index) || { choice: { kind: 'keep' }, maxSize: 1024 };
      next.set(index, { ...cur, ...patch });
      return next;
    });
  };

  const suggest = () => {
    setPlans(new Map(zones.map((z) => [z.index, { choice: suggestZoneChoice(z, replaceExisting), maxSize: z.effect ? 256 : 1024 } as ZonePlan])));
  };

  const run = async () => {
    if (!source) return;
    setBusy(true); setError(null);
    try {
      const buf = await source.file.arrayBuffer();
      const r = await optimizeGlb(buf, plans, { jpegQuality: 0.88, compactSkin, triangleRatio });
      setResult(r);
      const base = source.name.replace(/\.glb$/i, '');
      const copy = new Uint8Array(r.bytes.length); copy.set(r.bytes);
      onPreview(new File([copy.buffer], `${base}_optimizado.glb`, { type: 'model/gltf-binary' }));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const download = () => {
    if (!result || !source) return;
    const copy = new Uint8Array(result.bytes.length); copy.set(result.bytes);
    const url = URL.createObjectURL(new Blob([copy.buffer], { type: 'model/gltf-binary' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${source.name.replace(/\.glb$/i, '')}_optimizado.glb`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  const presetOptions = useMemo(() => TEXTURE_PRESETS.map((p) => ({ id: p.id, name: p.name })), []);

  if (!source) return null;

  return (
    <div className="p-3 rounded-lg bg-slate-900/75 border border-slate-800/90 space-y-2.5">
      <div className="flex items-center justify-between">
        <span className="font-semibold text-violet-300 flex items-center gap-1.5">
          <Layers3 className="w-3.5 h-3.5 text-violet-400" />
          <span>Optimizar GLB por zonas</span>
        </span>
        {summary && <span className="text-[10px] font-mono text-slate-400">{mb(summary.size.total)}</span>}
      </div>
      <p className="text-[11px] text-slate-400 leading-snug" title={source.name}>
        {source.name}
        {summary && (
          <>
            {' · '}{summary.triangles.toLocaleString()} triángulos{' · '}{summary.skins} esqueletos{' · '}
            {summary.animations.length} animaciones
          </>
        )}
      </p>
      {error && <div className="text-[11px] px-2 py-1 rounded border text-rose-300 bg-rose-500/10 border-rose-400/30">{error}</div>}

      <div className="flex gap-2">
        <button type="button" onClick={suggest} disabled={!zones.length || busy}
          className="flex-1 py-1.5 px-2 rounded-md bg-slate-800 hover:bg-slate-700 border border-slate-700 text-violet-300 font-semibold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50">
          <Wand2 className="w-3.5 h-3.5" /><span>Sugerir texturas</span>
        </button>
        <label className="flex items-center gap-1.5 text-[11px] text-slate-300" title="Índices de huesos a 8 bits y pesos a 16 bits (sin pérdida visible)">
          <input type="checkbox" checked={compactSkin} onChange={(e) => setCompactSkin(e.target.checked)} />
          <span>Huesos compactos</span>
        </label>
      </div>
      <label className="flex items-center justify-between gap-2 text-[11px] text-slate-300"
        title="Simplifica las mallas conservando costuras de UV, huesos y animaciones. Para navegador o móvil, 25–50 %.">
        <span>Triángulos que se conservan</span>
        <select value={triangleRatio} onChange={(e) => setTriangleRatio(Number(e.target.value))} aria-label="Triángulos que se conservan"
          className="py-1 px-1 rounded bg-slate-900 border border-slate-700 text-[11px] text-slate-100">
          {[1, 0.75, 0.5, 0.25, 0.1].map((r) => (
            <option key={r} value={r}>
              {r === 1 ? '100 % (sin cambio)' : `${r * 100} %${summary ? ` (~${Math.round((summary.triangles * r) / 1000)}k)` : ''}`}
            </option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-1.5 text-[11px] text-slate-300" title="Por defecto, las zonas que ya tienen textura propia la conservan al sugerir">
        <input type="checkbox" checked={replaceExisting} onChange={(e) => setReplaceExisting(e.target.checked)} />
        <span>Sugerir también en zonas que ya tienen textura</span>
      </label>

      <ul className="space-y-1.5 max-h-80 overflow-y-auto pr-0.5">
        {zones.map((z) => {
          const plan = plans.get(z.index) || { choice: { kind: 'keep' } as ZoneTextureChoice, maxSize: 1024 };
          const repeat = plan.choice.kind === 'pattern' || plan.choice.kind === 'user' ? plan.choice.repeat : null;
          return (
            <li key={z.index} className="p-1.5 rounded-md border border-slate-800 bg-slate-950/60 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[12px] text-slate-100 font-medium truncate" title={z.name}>{prettyZoneName(z.name)}</span>
                <span className="text-[10px] text-slate-500 whitespace-nowrap">
                  {z.triangles.toLocaleString()} tri
                  {z.skinned ? ' · animado' : ''}
                  {z.effect ? ' · efecto' : ''}
                  {z.baseTextureSize ? ` · ${z.baseTextureSize[0]}px` : ''}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <select
                  value={choiceToValue(plan.choice)}
                  onChange={(e) => setPlan(z.index, { choice: valueToChoice(e.target.value, plan.choice) })}
                  className="flex-1 min-w-0 py-1 px-1 rounded bg-slate-900 border border-slate-700 text-[11px] text-slate-100"
                  aria-label={`Textura de ${prettyZoneName(z.name)}`}
                >
                  <option value="keep">Mantener la actual</option>
                  <option value="none">Sin textura (solo color)</option>
                  <optgroup label="Patrones">
                    {presetOptions.map((p) => <option key={p.id} value={`p:${p.id}`}>{p.name}</option>)}
                  </optgroup>
                  <optgroup label="Mis texturas">
                    {userTextures.map((t) => <option key={t.id} value={`u:${t.id}`}>{t.name}</option>)}
                  </optgroup>
                </select>
                {repeat !== null && (
                  <input type="number" min={1} max={16} step={1} value={repeat}
                    onChange={(e) => {
                      const v = Math.max(1, Math.min(16, Number(e.target.value) || 1));
                      if (plan.choice.kind === 'pattern' || plan.choice.kind === 'user') setPlan(z.index, { choice: { ...plan.choice, repeat: v } });
                    }}
                    title="Repeticiones de la textura"
                    className="w-11 py-1 px-1 rounded bg-slate-900 border border-slate-700 text-[11px] text-slate-100 font-mono" />
                )}
                <select value={plan.maxSize} onChange={(e) => setPlan(z.index, { maxSize: Number(e.target.value) })}
                  title="Lado máximo de las texturas de esta zona"
                  className="w-[4.6rem] py-1 px-1 rounded bg-slate-900 border border-slate-700 text-[11px] text-slate-100">
                  {SIZES.map((s) => <option key={s} value={s}>{s === 0 ? 'Original' : `${s}px`}</option>)}
                </select>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={run} disabled={busy || !zones.length}
          className="py-2 px-2 rounded-lg bg-violet-400 hover:bg-violet-300 text-slate-950 font-semibold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50">
          <Play className="w-3.5 h-3.5" /><span>{busy ? 'Optimizando…' : 'Optimizar y ver'}</span>
        </button>
        <button type="button" onClick={download} disabled={!result}
          className="py-2 px-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-violet-200 font-semibold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50">
          <Download className="w-3.5 h-3.5" /><span>Descargar GLB</span>
        </button>
      </div>

      {result && (
        <div className="text-[11px] text-slate-300 space-y-1" data-testid="zonas-informe">
          <div className="grid grid-cols-3 gap-x-2 font-mono">
            <span className="text-slate-500">Parte</span><span className="text-slate-500">Antes</span><span className="text-slate-500">Después</span>
            <span>Total</span><span>{mb(result.before.size.total)}</span><span className="text-emerald-300">{mb(result.after.size.total)}</span>
            <span>Triángulos</span><span>{result.before.triangles.toLocaleString()}</span><span>{result.after.triangles.toLocaleString()}</span>
            <span>Imágenes</span><span>{mb(result.before.size.images)}</span><span>{mb(result.after.size.images)}</span>
            <span>Geometría</span><span>{mb(result.before.size.geometry)}</span><span>{mb(result.after.size.geometry)}</span>
            <span>Animación</span><span>{mb(result.before.size.animation)}</span><span>{mb(result.after.size.animation)}</span>
          </div>
          <div>
            Esqueletos {result.before.skins} → {result.after.skins} · Animaciones {result.before.animations.length} → {result.after.animations.length}
            {result.after.skins === result.before.skins && result.after.animations.length === result.before.animations.length ? ' (conservados)' : ' (¡revisar!)'}
          </div>
          {result.notes.map((n, i) => <div key={i} className="text-slate-400">• {n}</div>)}
        </div>
      )}
    </div>
  );
}
