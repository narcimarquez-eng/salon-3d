import { useRef, useState } from 'react';
import { ImagePlus, Trash2, UserRound, Download, Play } from 'lucide-react';
import { LAYER_CLASSES } from '../human/layerMap';
import {
  DEFAULT_HUMAN_OPTIONS,
  type HumanBuildOptions,
  type HumanImageSet,
} from '../human/buildHuman';

export interface HumanPanelResult {
  vertexCount: number;
  triangleCount: number;
  notes: string[];
  hasRig: boolean;
  animations: { id: string; label: string }[];
}

interface Props {
  busy: boolean;
  result: HumanPanelResult | null;
  error: string | null;
  exporting: boolean;
  lastExportSize: string | null;
  activeAnimation: string;
  onBuild: (images: HumanImageSet, options: HumanBuildOptions) => void;
  onAnimationChange: (id: string) => void;
  onExport: () => void;
}

type SlotId = 'front' | 'back' | 'frontLayer' | 'backLayer';

interface Slot {
  id: SlotId;
  label: string;
  hint: string;
}

const SLOTS: Slot[] = [
  { id: 'front', label: 'Foto de frente', hint: 'Obligatoria. Cuerpo entero, pose A, fondo liso.' },
  { id: 'back', label: 'Foto de espalda', hint: 'Opcional. Mismo encuadre que la de frente.' },
  { id: 'frontLayer', label: 'Mapa de capas (frente)', hint: 'Opcional. Copia de la foto pintada con colores planos.' },
  { id: 'backLayer', label: 'Mapa de capas (espalda)', hint: 'Opcional. Igual, sobre la foto de espalda.' },
];

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('No se ha podido leer la imagen.'));
      if (typeof reader.result === 'string') img.src = reader.result;
      else reject(new Error('No se ha podido leer la imagen.'));
    };
    reader.onerror = () => reject(new Error('No se ha podido leer el archivo.'));
    reader.readAsDataURL(file);
  });
}

export default function HumanFromImagesPanel({
  busy,
  result,
  error,
  exporting,
  lastExportSize,
  activeAnimation,
  onBuild,
  onAnimationChange,
  onExport,
}: Props) {
  const [images, setImages] = useState<Record<SlotId, HTMLImageElement | null>>({
    front: null,
    back: null,
    frontLayer: null,
    backLayer: null,
  });
  const [names, setNames] = useState<Record<SlotId, string | null>>({
    front: null,
    back: null,
    frontLayer: null,
    backLayer: null,
  });
  const [options, setOptions] = useState<HumanBuildOptions>({ ...DEFAULT_HUMAN_OPTIONS });
  const [showLayerLegend, setShowLayerLegend] = useState(false);
  const inputs = useRef<Record<SlotId, HTMLInputElement | null>>({
    front: null,
    back: null,
    frontLayer: null,
    backLayer: null,
  });

  const pick = async (slot: SlotId, file: File | undefined) => {
    if (!file) return;
    try {
      const img = await loadImage(file);
      setImages((prev) => ({ ...prev, [slot]: img }));
      setNames((prev) => ({ ...prev, [slot]: file.name }));
    } catch {
      setImages((prev) => ({ ...prev, [slot]: null }));
      setNames((prev) => ({ ...prev, [slot]: null }));
    }
  };

  const clear = (slot: SlotId) => {
    setImages((prev) => ({ ...prev, [slot]: null }));
    setNames((prev) => ({ ...prev, [slot]: null }));
    const input = inputs.current[slot];
    if (input) input.value = '';
  };

  const slider = (
    label: string,
    key: keyof HumanBuildOptions,
    min: number,
    max: number,
    step: number,
    format: (v: number) => string,
    title: string
  ) => (
    <div title={title}>
      <div className="flex items-center justify-between text-[10px]">
        <span className="text-slate-400">{label}</span>
        <span className="font-mono text-amber-300">{format(options[key] as number)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={options[key] as number}
        onChange={(e) =>
          setOptions((prev) => ({ ...prev, [key]: parseFloat(e.target.value) }))
        }
        className="w-full accent-amber-400 cursor-pointer"
      />
    </div>
  );

  const canBuild = !!images.front && !busy;

  return (
    <div
      data-testid="human-panel"
      className="p-3 rounded-lg bg-slate-900/75 border border-slate-800/90 space-y-2.5 text-[11px]"
    >
      <div className="flex items-center justify-between">
        <span className="font-semibold text-sky-300 flex items-center gap-1.5">
          <UserRound className="w-3.5 h-3.5 text-sky-400" />
          <span>Humano desde imágenes</span>
        </span>
        {result && (
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-400/30">
            {result.triangleCount.toLocaleString()} tri
          </span>
        )}
      </div>

      <p className="text-[10px] text-slate-400 leading-snug">
        Saca un cuerpo humano cerrado de una foto de frente (y otra de espalda si
        la tienes): ajusta la silueta, le busca la cara, le pone botas, esqueleto
        y animaciones, y la textura sale de la propia foto.
      </p>

      {/* Las cuatro imágenes */}
      <div className="space-y-1">
        {SLOTS.map((slot) => (
          <div key={slot.id} className="flex items-center gap-1.5" title={slot.hint}>
            <input
              ref={(el) => {
                inputs.current[slot.id] = el;
              }}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => pick(slot.id, e.target.files?.[0])}
            />
            {!images[slot.id] ? (
              <button
                type="button"
                onClick={() => inputs.current[slot.id]?.click()}
                className="flex-1 px-2 py-1 rounded bg-slate-950 hover:bg-slate-800 border border-slate-700 text-slate-300 flex items-center gap-1.5 cursor-pointer"
              >
                <ImagePlus className="w-3 h-3 text-sky-400" />
                <span className="truncate">{slot.label}</span>
                {slot.id === 'front' && (
                  <span className="ml-auto text-[9px] text-amber-400">necesaria</span>
                )}
              </button>
            ) : (
              <div className="flex-1 flex items-center gap-1.5 px-1.5 py-0.5 rounded bg-sky-400/15 border border-sky-400/40">
                <img
                  src={images[slot.id]!.src}
                  alt={slot.label}
                  className="w-6 h-6 object-cover rounded"
                />
                <span className="truncate text-sky-200">{names[slot.id]}</span>
                <button
                  type="button"
                  onClick={() => clear(slot.id)}
                  className="ml-auto text-slate-400 hover:text-rose-400 cursor-pointer"
                  title="Quitar"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => setShowLayerLegend((v) => !v)}
        className="text-[10px] text-slate-400 hover:text-sky-300 underline cursor-pointer"
      >
        {showLayerLegend ? 'Ocultar' : 'Ver'} los colores del mapa de capas
      </button>
      {showLayerLegend && (
        <div className="space-y-0.5 p-1.5 rounded bg-slate-950/80 border border-slate-800">
          <p className="text-[10px] text-slate-400 leading-snug mb-1">
            Píntalo encima de una copia de la foto, con colores planos. Dice qué
            sobresale; la textura sigue saliendo de la foto.
          </p>
          {LAYER_CLASSES.map((c) => (
            <div key={c.id} className="flex items-center gap-1.5 text-[10px]">
              <span
                className="w-3 h-3 rounded border border-slate-700"
                style={{ background: `rgb(${c.rgb[0]},${c.rgb[1]},${c.rgb[2]})` }}
              />
              <span className="text-slate-300 flex-1 truncate">{c.label}</span>
              <span className="font-mono text-slate-500">
                {c.offset > 0 ? '+' : ''}
                {c.offset}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Ajustes */}
      <div className="grid grid-cols-2 gap-x-2 gap-y-1">
        {slider('Profundidad', 'depthScale', 0.2, 1.8, 0.05, (v) => `${Math.round(v * 100)}%`,
          'Grosor del cuerpo. 100% son proporciones humanas naturales.')}
        {slider('Relieve de la foto', 'reliefAmount', 0, 1, 0.05, (v) => `${Math.round(v * 100)}%`,
          'Cuánto detalle de brillo de la foto se añade encima del cuerpo.')}
        {slider('Detalle de la cara', 'faceDetail', 0, 2, 0.1, (v) => v.toFixed(1),
          'Cejas, cuencas, nariz, pómulos y boca, colocados según los ojos detectados.')}
        {slider('Altura de capas', 'layerStrength', 0, 2, 0.05, (v) => v.toFixed(2),
          'Escala el relieve del mapa de capas pintado.')}
        {slider('Filas de malla', 'rows', 80, 400, 2, (v) => `${Math.round(v)}`,
          'Más filas = más detalle y más triángulos.')}
        {slider('Metalizado', 'metalMix', 0, 1, 0.05, (v) => `${Math.round(v * 100)}%`,
          '100% = igual que Vortex3D. Bájalo si la piel sale con brillo de metal.')}
        {slider('Relieve de textura', 'normalStrength', 0, 2, 0.05, (v) => v.toFixed(2),
          'Fuerza del mapa de normales sacado de la foto. 1,5 es el valor de Vortex3D.')}
      </div>

      <div className="flex items-center gap-3">
        <label className="flex items-center gap-1 cursor-pointer" title="19 huesos, pesos de piel y 4 animaciones.">
          <input
            type="checkbox"
            checked={options.rig}
            onChange={(e) => setOptions((p) => ({ ...p, rig: e.target.checked }))}
            className="accent-amber-400 cursor-pointer"
          />
          <span className="text-slate-300">Esqueleto y animaciones</span>
        </label>
        <label className="flex items-center gap-1 cursor-pointer" title="Botas con el ancho de la pierna, unidas al hueso del pie.">
          <input
            type="checkbox"
            checked={options.shoes}
            onChange={(e) => setOptions((p) => ({ ...p, shoes: e.target.checked }))}
            className="accent-amber-400 cursor-pointer"
          />
          <span className="text-slate-300">Botas</span>
        </label>
      </div>

      <button
        type="button"
        disabled={!canBuild}
        onClick={() => {
          if (!images.front) return;
          onBuild(
            {
              front: images.front,
              back: images.back,
              frontLayer: images.frontLayer,
              backLayer: images.backLayer,
            },
            options
          );
        }}
        className={`w-full py-1.5 px-3 rounded-md font-semibold flex items-center justify-center gap-1.5 transition-colors ${
          canBuild
            ? 'bg-sky-400 hover:bg-sky-300 text-slate-950 cursor-pointer'
            : 'bg-slate-800 text-slate-500 cursor-not-allowed'
        }`}
      >
        <UserRound className="w-3.5 h-3.5" />
        <span>{busy ? 'Construyendo el cuerpo...' : 'Crear personaje 3D'}</span>
      </button>

      {error && (
        <p className="text-[10px] text-rose-300 bg-rose-500/10 border border-rose-400/30 rounded p-1.5 leading-snug">
          {error}
        </p>
      )}

      {result && (
        <div className="space-y-1.5 pt-0.5 border-t border-slate-800">
          <div className="flex items-center justify-between text-[10px] text-slate-400">
            <span>
              {result.vertexCount.toLocaleString()} vértices ·{' '}
              {result.triangleCount.toLocaleString()} triángulos
            </span>
            {result.hasRig && <span className="text-emerald-300">19 huesos</span>}
          </div>

          {result.notes.map((n) => (
            <p key={n} className="text-[10px] text-amber-200/80 leading-snug">
              · {n}
            </p>
          ))}

          {result.hasRig && result.animations.length > 0 && (
            <div>
              <div className="flex items-center gap-1 text-[10px] text-slate-400 mb-0.5">
                <Play className="w-3 h-3 text-emerald-400" />
                <span>Animación</span>
              </div>
              <div className="grid grid-cols-5 gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
                <button
                  type="button"
                  onClick={() => onAnimationChange('rest')}
                  className={`py-1 rounded font-semibold transition-colors cursor-pointer ${
                    activeAnimation === 'rest'
                      ? 'bg-emerald-400 text-slate-950'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  Quieto
                </button>
                {result.animations.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => onAnimationChange(a.id)}
                    className={`py-1 rounded font-semibold transition-colors cursor-pointer ${
                      activeAnimation === a.id
                        ? 'bg-emerald-400 text-slate-950'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    {a.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <button
            type="button"
            disabled={exporting}
            onClick={onExport}
            className="w-full py-1.5 px-3 rounded-md bg-emerald-500/90 hover:bg-emerald-400 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:cursor-not-allowed"
            title="Exporta el personaje con su esqueleto, sus animaciones y las texturas de la foto."
          >
            <Download className="w-3.5 h-3.5" />
            <span>
              {exporting ? 'Exportando...' : 'Descargar .glb del personaje'}
            </span>
          </button>
          {lastExportSize && (
            <p className="text-[10px] text-emerald-300 text-center">
              Último .glb: {lastExportSize}
            </p>
          )}
          {result.hasRig && (
            <p className="text-[10px] text-slate-500 leading-snug">
              Usa este botón y no el de «Exportación .GLB Optimizada»: ese otro
              reconstruye las mallas y dejaría al personaje sin esqueleto ni
              animaciones.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
