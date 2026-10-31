import React, { useState, useEffect, useRef } from 'react';
import {
  Code2,
  Play,
  RotateCcw,
  Terminal,
  BookOpen,
  CheckCircle2,
  AlertCircle,
  X,
  FileCode,
  Copy,
  Sparkles,
  Wrench,
  Wand2,
  Loader2,
  ImagePlus,
  Eye,
  SlidersHorizontal,
  Cpu,
  Brain,
  ExternalLink,
  BarChart3,
} from 'lucide-react';
import {
  BLENDER_SCRIPT_PRESETS,
  BlenderCoordinateMode,
  BlenderScriptPreset,
  ScriptExecutionResult,
  isLikelyBlenderPythonCode,
  stripMarkdownCodeFences,
} from '../utils/blenderPythonEngine';

export type ThinkingLevelChoice = 'LOW' | 'MEDIUM' | 'HIGH';

export interface SceneBoundsData {
  minY: number;
  maxY: number;
  widthX: number;
  depthZ: number;
  meshCount: number;
}

export interface GeminiDrawingHelpersState {
  archetype: string;
  symmetry: string;
  complexity: 'standard' | 'high' | 'ultra';
  palette: string;
  autoSmooth: boolean;
  autoTexture: string;
  sendViewportSnapshot: boolean;
  aiTools: string[];
  autoCritique: boolean;
}

export const AI_TOOLKIT_OPTIONS = [
  {
    id: 'use_world_props',
    label: '🏰 Props, Vehículos, Árboles y Edificios',
    description: 'Cofres, ruedas de vehículos, follaje de árboles y arcos arquitectónicos (primitive_prop_chest_add / wheel_pair / tree_foliage / arch)',
  },
  {
    id: 'use_limbs',
    label: '🦾 Extremidades Articuladas',
    description: 'Brazos y piernas simétricos con hombro, codo/rodilla y cápsulas (primitive_limb_pair_add)',
  },
  {
    id: 'use_armor_plates',
    label: '🛡️ Placas / Chasis Curvos',
    description: 'Placas blindadas, escudos, carrocerías y tejados curvos (primitive_armor_plate_add)',
  },
  {
    id: 'use_horns_blades',
    label: '⚔️ Hojas, Cuernos & Espinas',
    description: 'Hojas biseladas, alerones, cuernos, ramas y púas (primitive_horn_add / blade_add)',
  },
  {
    id: 'use_wings',
    label: '🪽 Alas / Velas en Abanico',
    description: 'Par de alas simétricas desplegadas, paneles solares o velas (primitive_wing_pair_add)',
  },
  {
    id: 'auto_mirror',
    label: '⚖️ Auto-Simetría Espejo X',
    description: 'Duplica automáticamente piezas laterales en el eje X (mirror_x)',
  },
  {
    id: 'auto_ground',
    label: '⚓ Auto-Apoyar en Suelo',
    description: 'Ajusta la altura exacta del modelo sobre el pedestal Y=0.02 (auto_ground)',
  },
];

export interface GeminiWeeklyUsageStats {
  weekStartIso: string;
  totalGenerations: number;
  argonGenerations: number;
  totalTokens: number;
  thoughtTokens: number;
  lastModelUsed: string;
}

const WEEKLY_USAGE_STORAGE_KEY = 'celshade_gemini_weekly_usage_v1';

export const GEMINI_QUOTA_LINKS = {
  aiStudioPlan: 'https://aistudio.google.com/app/plan_information',
  geminiAccountUsage: 'https://myactivity.google.com/product/gemini',
  cloudQuotas: 'https://console.cloud.google.com/apis/api/generativelanguage.googleapis.com/quotas',
};

function getStartOfCurrentWeekIso(): string {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Lunes como inicio de semana
  const monday = new Date(now.setDate(diff));
  monday.setHours(0, 0, 0, 0);
  return monday.toISOString().slice(0, 10);
}

export function getGeminiWeeklyUsage(): GeminiWeeklyUsageStats {
  const currentWeek = getStartOfCurrentWeekIso();
  try {
    const raw = localStorage.getItem(WEEKLY_USAGE_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as GeminiWeeklyUsageStats;
      if (parsed.weekStartIso === currentWeek) {
        return parsed;
      }
    }
  } catch {
    // ignore storage errors
  }
  return {
    weekStartIso: currentWeek,
    totalGenerations: 0,
    argonGenerations: 0,
    totalTokens: 0,
    thoughtTokens: 0,
    lastModelUsed: 'gemini-3.8-flash',
  };
}

export function recordGeminiUsage(
  modelUsed: string,
  totalTokens: number = 0,
  thoughtTokens: number = 0
): GeminiWeeklyUsageStats {
  const current = getGeminiWeeklyUsage();
  const updated: GeminiWeeklyUsageStats = {
    ...current,
    totalGenerations: current.totalGenerations + 1,
    argonGenerations:
      current.argonGenerations + (modelUsed === 'gemini-4-argon' ? 1 : 0),
    totalTokens: current.totalTokens + (totalTokens || 1450),
    thoughtTokens: current.thoughtTokens + (thoughtTokens || 420),
    lastModelUsed: modelUsed,
  };
  try {
    localStorage.setItem(WEEKLY_USAGE_STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // ignore storage errors
  }
  return updated;
}

export const THINKING_LEVEL_OPTIONS: Array<{
  id: ThinkingLevelChoice;
  label: string;
  shortLabel: string;
  description: string;
}> = [
  {
    id: 'LOW',
    label: 'Low (Rápido)',
    shortLabel: 'Low',
    description: 'Mínima latencia y menor consumo de cuota semanal',
  },
  {
    id: 'MEDIUM',
    label: 'Medium (Balanceado)',
    shortLabel: 'Medium',
    description: 'Equilibrio óptimo entre profundidad geométrica y velocidad',
  },
  {
    id: 'HIGH',
    label: 'High (Profundo)',
    shortLabel: 'High',
    description: 'Máxima evolución de razonamiento espacial 3D y trigonometría compleja',
  },
];

export const LIVE_THOUGHT_PHASES: Record<ThinkingLevelChoice, string[]> = {
  LOW: [
    '1/3 • Analizando silueta 3D y dimensiones del pedestal (Y=0.0)...',
    '2/3 • Sintetizando primitivas bpy y coordenadas de simetría...',
    '3/3 • Aplicando paleta Cel-Shading de 3 tonos y compilando script...',
  ],
  MEDIUM: [
    '1/4 • Interpretando estructura morfológica y proporciones anatómicas...',
    '2/4 • Calculando matrices espaciales (X, Y, Z) y ejes de simetría...',
    '3/4 • Programando bucles trigonométricos (math.sin/cos) y sub-piezas...',
    '4/4 • Ajustando contraste de materiales Toon y verificando código bpy...',
  ],
  HIGH: [
    '1/5 • Deconstruyendo arquitectura 3D en volúmenes primarios, secundarios y micro-detalles...',
    '2/5 • Resolviendo cinemática y alineación espacial precisa con BoundingBox de escena...',
    '3/5 • Generando topología procedural avanzada con bucles iterativos y simetría axial...',
    '4/5 • Optimizando densidad poligonal, suavizado esférico de normales y capas de armadura...',
    '5/5 • Calibrando sombreado Cel-Shading de 3 tonos, contornos de tinta y validando sintaxis Python...',
  ],
};

export const ARCHETYPE_OPTIONS = [
  { id: 'auto', label: '✨ Libre / Cualquier Elemento de Juego' },
  { id: 'game_prop_item', label: '📦 Prop / Cofre / Poción / Barril / Loot' },
  { id: 'vehicle_spaceship', label: '🚀 Vehículo / Coche / Nave / Tanque / Barco' },
  { id: 'building_architecture', label: '🏰 Edificio / Casa / Torre / Puente / Portal' },
  { id: 'nature_vegetation', label: '🌲 Naturaleza / Árbol / Roca / Seta / Isla' },
  { id: 'furniture_interior', label: '🪑 Mobiliario / Mesa / Trono / Farola / Altar' },
  { id: 'weapon_relic', label: '⚔️ Arma / Escudo / Herramienta / Reliquia' },
  { id: 'biped_boss', label: '🤖 Personaje / Héroe / NPC / Robot / Guerrero' },
  { id: 'serpentine_dragon', label: '🐉 Criatura / Dragón / Monstruo / Mascota' },
  { id: 'arachnid_mecha', label: '🕷️ Arácnido / Bestia Multi-Pata / Dron' },
  { id: 'winged_entity', label: '🪽 Ser Alado / Ave / Fénix / Ángel' },
];

export const SYMMETRY_OPTIONS = [
  { id: 'bilateral_x', label: 'Simetría Bilateral X (Izq/Der)' },
  { id: 'radial_circle', label: 'Simetría Radial 360° (Anillo)' },
  { id: 'spiral_helix', label: 'Hélice / Espiral Ascendente' },
  { id: 'organic_asym', label: 'Asimétrico / Escenario Natural' },
];

export const PALETTE_OPTIONS = [
  { id: 'crimson_gold', label: 'Carmesí & Oro', colors: ['#e11d48', '#fbbf24', '#1e293b'] },
  { id: 'cyber_neon', label: 'Ciberneón Sci-Fi', colors: ['#06b6d4', '#ec4899', '#1e293b'] },
  { id: 'forest_nature', label: 'Bosque & Madera Natural', colors: ['#22c55e', '#854d0e', '#facc15'] },
  { id: 'medieval_stone', label: 'Piedra Medieval & Oro', colors: ['#64748b', '#92400e', '#fbbf24'] },
  { id: 'abyssal_void', label: 'Abisal & Esmeralda', colors: ['#10b981', '#7c3aed', '#0f172a'] },
  { id: 'celestial_ice', label: 'Cristal Ártico', colors: ['#38bdf8', '#e2e8f0', '#fbbf24'] },
  { id: 'toxic_bio', label: 'Biomecánico Ácido', colors: ['#84cc16', '#a855f7', '#1e1b4b'] },
];

const REFINEMENT_CHIPS = [
  {
    label: '🔍 Auto-Analizar y Mejorar Todo',
    prompt:
      'Analiza visualmente el objeto 3D actual y su código, enriquece su geometría con más sub-piezas detalladas (herrajes, ruedas, arcos, follaje, placas o articulaciones según el tipo de objeto) y apoya la base con bpy.ops.mesh.auto_ground().',
  },
  {
    label: '💎 + Detalles de Juego (Gemas / Luces / Herrajes)',
    prompt:
      'Añade detalles de videojuego al objeto actual: remaches metálicos, cristales brillantes (primitive_octahedron_add), marcos reforzados (primitive_armor_plate_add) y ornamentos simétricos.',
  },
  {
    label: '🌿 + Base / Pedestal de Escenario',
    prompt:
      'Añade debajo del objeto una base de escenario de videojuego con rocas facetadas (primitive_dodecahedron_add), escalones o losas y cristales ambientales.',
  },
  {
    label: '⚡ + Efectos de Energía / Ruedas / Alas',
    prompt:
      'Si es un vehículo añade turbinas/ruedas (primitive_wheel_pair_add), si es un prop/edificio añade un portal o halo de energía (primitive_torus_add), y si es criatura/personaje añade alas o armadura.',
  },
];

export const GEMINI_MODEL_OPTIONS = [
  {
    id: 'gemini-4-argon',
    label: 'Google Argon (Gemini 4)',
    sublabel: 'Modelo insignia de razonamiento espacial y código 3D avanzado (Cuenta Google)',
    badge: 'Argon 4',
  },
  {
    id: 'gemini-3.8-flash',
    label: 'Gemini 3.8 Flash',
    sublabel: 'Rápido, multimodal & thinking balanceado',
    badge: 'Recomendado',
  },
  {
    id: 'gemini-3.8-pro',
    label: 'Gemini 3.8 Pro',
    sublabel: 'Máxima precisión matemática y código 3D complejo',
    badge: 'Pro',
  },
  {
    id: 'gemini-3.8-thinking',
    label: 'Gemini 3.8 Thinking',
    sublabel: 'Razonamiento profundo paso a paso en geometría',
    badge: 'Deep',
  },
  {
    id: 'gemini-2.5-flash',
    label: 'Gemini 2.5 Flash',
    sublabel: 'Ligero y optimizado para iteraciones ultrarrápidas',
    badge: 'Flash',
  },
];

interface PythonScriptModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRunScript: (
    code: string,
    customLabel?: string,
    coordinateMode?: BlenderCoordinateMode
  ) => Promise<ScriptExecutionResult>;
  externalCode?: string | null;
  getViewportSnapshot?: () => string | null;
  getSceneBounds?: () => SceneBoundsData | undefined;
  selectedModel?: string;
  onModelChange?: (model: string) => void;
  thinkingLevel?: ThinkingLevelChoice;
  onThinkingLevelChange?: (level: ThinkingLevelChoice) => void;
  userEmail?: string | null;
  onUsageUpdated?: (stats: GeminiWeeklyUsageStats) => void;
}

export default function PythonScriptModal({
  isOpen,
  onClose,
  onRunScript,
  externalCode,
  getViewportSnapshot,
  getSceneBounds,
  selectedModel = 'gemini-3.8-flash',
  onModelChange,
  thinkingLevel = 'MEDIUM',
  onThinkingLevelChange,
  userEmail,
  onUsageUpdated,
}: PythonScriptModalProps) {
  const [internalModel, setInternalModel] = useState<string>(selectedModel);
  const [internalThinking, setInternalThinking] = useState<ThinkingLevelChoice>(thinkingLevel);

  const activeModel = onModelChange ? selectedModel : internalModel;
  const handleModelSelect = (m: string) => {
    setInternalModel(m);
    if (onModelChange) onModelChange(m);
  };

  const activeThinking = onThinkingLevelChange ? thinkingLevel : internalThinking;
  const handleThinkingSelect = (lvl: ThinkingLevelChoice) => {
    setInternalThinking(lvl);
    if (onThinkingLevelChange) onThinkingLevelChange(lvl);
  };

  const [selectedPresetId, setSelectedPresetId] = useState<string>('gen_blender52_mecha_paladin');
  const [scriptCode, setScriptCode] = useState<string>(
    BLENDER_SCRIPT_PRESETS[0].code
  );
  const [coordinateMode, setCoordinateMode] = useState<BlenderCoordinateMode>('auto');
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'editor' | 'docs'>('editor');
  const [terminalLogs, setTerminalLogs] = useState<string[]>([
    'Python 3.11 [Motor Blender 5.2 bpy — Compatible con scripts de Gemini Web, Principled BSDF, Modifiers, bmesh y Z-Up]',
    'Puedes pegar directamente cualquier script Python de Blender 5.2 creado en la web o usar el asistente de arriba.',
    'Pulsa "Ejecutar y Ver en 3D" (o Ctrl + Enter) para construir en la escena (0 llamadas API al ejecutar código).',
  ]);
  const [lastResult, setLastResult] = useState<ScriptExecutionResult | null>(null);
  const [copiedSuccess, setCopiedSuccess] = useState<boolean>(false);
  const [copiedWebPrompt, setCopiedWebPrompt] = useState<boolean>(false);

  // Estado del Complemento Gemini AI -> Python (bpy) + Evolución del Pensamiento
  const [geminiPrompt, setGeminiPrompt] = useState<string>('');
  const [geminiMode, setGeminiMode] = useState<'replace' | 'append' | 'refine'>('replace');
  const [isGeneratingGemini, setIsGeneratingGemini] = useState<boolean>(false);
  const [geminiSummary, setGeminiSummary] = useState<string | null>(null);
  const [thoughtSteps, setThoughtSteps] = useState<string[]>([]);
  const [livePhaseIndex, setLivePhaseIndex] = useState<number>(0);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [lastTokenUsage, setLastTokenUsage] = useState<{
    thoughtsTokens: number;
    totalTokens: number;
  } | null>(null);
  const [weeklyStats, setWeeklyStats] = useState<GeminiWeeklyUsageStats>(() =>
    getGeminiWeeklyUsage()
  );

  const [showHelpersPanel, setShowHelpersPanel] = useState<boolean>(true);
  const [helpers, setHelpers] = useState<GeminiDrawingHelpersState>({
    archetype: 'auto',
    symmetry: 'bilateral_x',
    complexity: 'high',
    palette: 'crimson_gold',
    autoSmooth: false,
    autoTexture: 'none',
    sendViewportSnapshot: true,
    aiTools: ['use_world_props', 'use_limbs', 'use_armor_plates', 'use_horns_blades', 'auto_ground'],
    autoCritique: true,
  });
  const [referenceImageBase64, setReferenceImageBase64] = useState<string | null>(null);
  const [referenceImageName, setReferenceImageName] = useState<string | null>(null);
  const [pasteHintMessage, setPasteHintMessage] = useState<string | null>(null);
  const refImgInputRef = useRef<HTMLInputElement>(null);
  const codeTextareaRef = useRef<HTMLTextAreaElement>(null);

  const safeCopyToClipboard = async (text: string): Promise<boolean> => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch {
      // Fallback para iframes con política de permisos restringida
    }
    try {
      const tempArea = document.createElement('textarea');
      tempArea.value = text;
      tempArea.style.position = 'fixed';
      tempArea.style.left = '-9999px';
      tempArea.style.top = '0';
      document.body.appendChild(tempArea);
      tempArea.focus();
      tempArea.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(tempArea);
      return ok;
    } catch {
      return false;
    }
  };

  useEffect(() => {
    if (externalCode && externalCode.trim()) {
      setScriptCode(externalCode);
      setSelectedPresetId('gemini_custom');
    }
  }, [externalCode]);

  // Temporizador de evolución del pensamiento en vivo mientras Gemini procesa
  useEffect(() => {
    if (!isGeneratingGemini) {
      setLivePhaseIndex(0);
      setElapsedSeconds(0);
      return;
    }
    const phases = LIVE_THOUGHT_PHASES[activeThinking] || LIVE_THOUGHT_PHASES.MEDIUM;
    const timer = window.setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
      setLivePhaseIndex((prev) => (prev < phases.length - 1 ? prev + 1 : prev));
    }, 1600);
    return () => clearInterval(timer);
  }, [isGeneratingGemini, activeThinking]);

  if (!isOpen) return null;

  const generatePresets = BLENDER_SCRIPT_PRESETS.filter((p) => p.category === 'generate');
  const modifyPresets = BLENDER_SCRIPT_PRESETS.filter((p) => p.category === 'modify');

  const handlePresetSelect = (preset: BlenderScriptPreset) => {
    setSelectedPresetId(preset.id);
    setScriptCode(preset.code);
    setGeminiSummary(null);
  };

  const handleReferenceImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setReferenceImageBase64(reader.result);
        setReferenceImageName(file.name);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleExecute = async (
    closeOnSuccess: boolean = false,
    codeOverride?: string,
    labelOverride?: string,
    coordOverride?: BlenderCoordinateMode
  ) => {
    const codeToRun = codeOverride ?? scriptCode;
    const modeToUse = coordOverride ?? coordinateMode;
    setIsRunning(true);
    try {
      const res = await onRunScript(codeToRun, labelOverride, modeToUse);
      setLastResult(res);
      setTerminalLogs(res.logs);
      if (closeOnSuccess && res.success) {
        onClose();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setTerminalLogs((prev) => [...prev, `Excepción: ${msg}`]);
    } finally {
      setIsRunning(false);
    }
  };

  const handleCopyPromptForGeminiWeb = async () => {
    const idea =
      geminiPrompt.trim() ||
      'Un asset 3D para videojuego (ej. cofre del tesoro, vehículo sci-fi, árbol mágico, edificio medieval, arma o personaje) rico en detalles';
    const webPromptText = `Escribe un script completo en Python para Blender 5.2 (usando import bpy, math y mathutils) que construya en 3D este elemento de videojuego: "${idea}".
Requisitos técnicos para Blender 5.2:
1. Limpia la escena al inicio con bpy.ops.object.select_all(action='SELECT') y bpy.ops.object.delete().
2. Crea una función crear_material(nombre, color_rgba, metalico=0.3, rugosidad=0.35, emision=0.0) usando bpy.data.materials.new, mat.use_nodes = True y el nodo "Principled BSDF" (inputs["Base Color"], inputs["Metallic"], inputs["Roughness"], inputs["Emission Color"]).
3. Construye el objeto de juego con entre 20 y 45 primitivas (primitive_cube_add, primitive_uv_sphere_add, primitive_ico_sphere_add, primitive_cylinder_add, primitive_cone_add, primitive_torus_add) posicionadas con precisión en el sistema de coordenadas de Blender 5.2 (eje Z arriba, apoyado desde Z=0).
4. Usa modificadores de Blender 5.2 como obj.modifiers.new(name="Mirror", type='MIRROR') para partes simétricas en X y obj.modifiers.new(name="Subsurf", type='SUBSURF').
5. Devuelve únicamente el bloque de código Python ejecutable.`;
    await safeCopyToClipboard(webPromptText);
    setCopiedWebPrompt(true);
    setTimeout(() => setCopiedWebPrompt(false), 3000);
  };

  const handlePasteAndRunWebScript = async () => {
    setPasteHintMessage(null);
    try {
      if (navigator.clipboard && navigator.clipboard.readText) {
        const clipText = await navigator.clipboard.readText();
        if (clipText && clipText.trim()) {
          const cleaned = stripMarkdownCodeFences(clipText);
          setScriptCode(cleaned);
          setSelectedPresetId('web_blender52_custom');
          await handleExecute(false, cleaned, 'Script Blender 5.2 Web');
          return;
        }
      }
    } catch {
      // El navegador bloquea navigator.clipboard.readText() dentro de iframes por seguridad
    }

    const currentPreset = BLENDER_SCRIPT_PRESETS.find((p) => p.id === selectedPresetId);
    if (currentPreset && scriptCode.trim() === currentPreset.code.trim()) {
      if (codeTextareaRef.current) {
        codeTextareaRef.current.focus();
        codeTextareaRef.current.select();
      }
      setPasteHintMessage(
        'Tu navegador protege el portapapeles: pulsa ahora Ctrl + V (o Clic derecho → Pegar) y el código se pegará y ejecutará en 3D automáticamente.'
      );
      setTerminalLogs((prev) => [
        ...prev,
        '>>> [Portapapeles Protegido por Navegador]: Pulsa Ctrl + V (o Cmd + V) ahora mismo para pegar tu código Python y construir el objeto 3D al instante.',
      ]);
      return;
    }

    const cleanedCurrent = stripMarkdownCodeFences(scriptCode);
    setScriptCode(cleanedCurrent);
    await handleExecute(false, cleanedCurrent, 'Script Blender 5.2 Web');
  };

  const handleCodeEditorPaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const pastedText = e.clipboardData?.getData('text/plain') || '';
    if (!pastedText.trim()) return;

    if (isLikelyBlenderPythonCode(pastedText) || pasteHintMessage) {
      e.preventDefault();
      const cleaned = stripMarkdownCodeFences(pastedText);
      setScriptCode(cleaned);
      setSelectedPresetId('web_blender52_custom');
      setPasteHintMessage(null);
      setGeminiSummary(
        'Código Python de Blender 5.2 pegado y ejecutado localmente (0 llamadas API).'
      );
      void handleExecute(false, cleaned, 'Script Blender 5.2 Pegado');
    }
  };

  const handlePromptInputPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pastedText = e.clipboardData?.getData('text/plain') || '';
    if (isLikelyBlenderPythonCode(pastedText)) {
      e.preventDefault();
      const cleaned = stripMarkdownCodeFences(pastedText);
      setScriptCode(cleaned);
      setSelectedPresetId('web_blender52_custom');
      setGeminiPrompt('');
      setPasteHintMessage(null);
      setGeminiSummary(
        'Detectado código Python (bpy) al pegar: ejecutado directamente en el motor Blender 5.2 (0 llamadas API).'
      );
      void handleExecute(false, cleaned, 'Script Blender 5.2 Pegado');
    }
  };

  const handleGenerateWithGemini = async (
    customPrompt?: string,
    customMode?: 'replace' | 'append' | 'refine'
  ) => {
    const promptToUse = (customPrompt ?? geminiPrompt).trim();
    const modeToUse = customMode ?? geminiMode;
    if (!promptToUse || isGeneratingGemini) return;

    // Si el usuario pegó directamente un script Python de Blender en la caja de prompt, ejecutarlo localmente sin gastar cuota API
    if (isLikelyBlenderPythonCode(promptToUse)) {
      const cleaned = stripMarkdownCodeFences(promptToUse);
      setScriptCode(cleaned);
      setSelectedPresetId('web_blender52_custom');
      setGeminiPrompt('');
      setGeminiSummary(
        'Código Python de Blender 5.2 detectado y ejecutado localmente (0 llamadas API).'
      );
      await handleExecute(false, cleaned, 'Script Blender 5.2 Directo');
      return;
    }

    setIsGeneratingGemini(true);
    setGeminiSummary(null);
    setThoughtSteps([]);
    setLastTokenUsage(null);

    const viewportSnap =
      helpers.sendViewportSnapshot && getViewportSnapshot ? getViewportSnapshot() : null;
    const sceneBounds = getSceneBounds ? getSceneBounds() : undefined;

    setTerminalLogs([
      `>>> [Asistente Gemini 3D] Modelo: ${activeModel} | Pensamiento: ${activeThinking}`,
      `>>> Analizando petición: "${promptToUse}"`,
      `>>> Guías activas: Arquetipo=${helpers.archetype}, Simetría=${helpers.symmetry}, Detalle=${helpers.complexity}, Paleta=${helpers.palette}`,
      referenceImageBase64
        ? `>>> Boceto / Imagen de referencia adjunta: ${referenceImageName}`
        : `>>> Contexto visual del visor 3D: ${viewportSnap ? 'Activo (+ Medidas BoundingBox)' : 'Desactivado'}`,
    ]);

    try {
      const response = await fetch('/api/gemini/bpy-generator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: promptToUse,
          mode: modeToUse,
          currentCode: scriptCode,
          helpers: {
            archetype: helpers.archetype,
            symmetry: helpers.symmetry,
            complexity: helpers.complexity,
            palette: helpers.palette,
            autoSmooth: helpers.autoSmooth,
            autoTexture: helpers.autoTexture,
            aiTools: helpers.aiTools,
            autoCritique: helpers.autoCritique || modeToUse === 'refine',
            sceneBounds,
          },
          referenceImageBase64: referenceImageBase64 || undefined,
          viewportImageBase64: viewportSnap || undefined,
          selectedModel: activeModel,
          thinkingLevel: activeThinking,
          userEmail: userEmail || undefined,
        }),
      });

      const data = (await response.json()) as {
        title?: string;
        summary?: string;
        thoughtEvolution?: string[];
        pythonCode?: string;
        modelUsed?: string;
        fallbackNotice?: string;
        thinkingLevelUsed?: string;
        usage?: {
          promptTokens: number;
          OutputTokens: number;
          thoughtsTokens: number;
          totalTokens: number;
        };
        error?: string;
      };

      if (!response.ok || !data.pythonCode) {
        throw new Error(data.error || 'No se pudo generar el script con Gemini.');
      }

      setScriptCode(data.pythonCode);
      setSelectedPresetId('gemini_custom');
      setGeminiSummary(
        `${data.title}: ${data.summary}${data.fallbackNotice ? ` (${data.fallbackNotice})` : ''}`
      );
      if (data.thoughtEvolution && data.thoughtEvolution.length > 0) {
        setThoughtSteps(data.thoughtEvolution);
      }
      if (data.usage) {
        setLastTokenUsage({
          thoughtsTokens: data.usage.thoughtsTokens,
          totalTokens: data.usage.totalTokens,
        });
      }

      const updatedStats = recordGeminiUsage(
        data.modelUsed || activeModel,
        data.usage?.totalTokens || 0,
        data.usage?.thoughtsTokens || 0
      );
      setWeeklyStats(updatedStats);
      if (onUsageUpdated) onUsageUpdated(updatedStats);

      const execRes = await onRunScript(data.pythonCode, data.title);
      setLastResult(execRes);
      setTerminalLogs([
        `>>> [${data.modelUsed || activeModel} • Thinking ${data.thinkingLevelUsed || activeThinking}] ${data.title}`,
        ...(data.fallbackNotice ? [`>>> [Auto-Respaldo]: ${data.fallbackNotice}`] : []),
        `>>> ${data.summary}`,
        ...(data.thoughtEvolution || []).map((step, idx) => `>>> [Pensamiento ${idx + 1}] ${step}`),
        ...execRes.logs,
      ]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setTerminalLogs((prev) => [...prev, `Error Gemini API: ${msg}`]);
    } finally {
      setIsGeneratingGemini(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleExecute(false);
    }
  };

  const handleCopyCode = async () => {
    await safeCopyToClipboard(scriptCode);
    setCopiedSuccess(true);
    setTimeout(() => setCopiedSuccess(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80">
      <div className="relative w-full max-w-5xl h-[92vh] bg-[#0f141c] border border-slate-800 rounded-xl shadow-2xl flex flex-col overflow-hidden text-slate-200">
        {/* Cabecera del Editor Estilo Blender */}
        <div className="flex items-center justify-between px-5 py-3 bg-slate-900/95 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Code2 className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white tracking-tight flex items-center gap-2">
                <span>Consola Python de Blender (bpy)</span>
                <span className="px-2 py-0.5 rounded bg-amber-400/15 border border-amber-400/40 text-amber-300 text-[10px] font-mono">
                  + Asistente Guiado Gemini 3D
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Usa las opciones de estructura, simetría, paleta o sube una imagen de referencia para guiar a Gemini al dibujar con Python
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 bg-slate-800 p-1 rounded-lg text-xs">
              <button
                type="button"
                onClick={() => setActiveTab('editor')}
                className={`px-3 py-1 rounded-md transition-colors cursor-pointer ${
                  activeTab === 'editor'
                    ? 'bg-amber-400 text-slate-950 font-semibold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Editor Python + Gemini
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('docs')}
                className={`px-3 py-1 rounded-md transition-colors cursor-pointer ${
                  activeTab === 'docs'
                    ? 'bg-amber-400 text-slate-950 font-semibold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Referencia API bpy
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {activeTab === 'editor' ? (
          <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
            {/* Barra lateral de Plantillas dividida en "Generar Objetos" y "Modificar Malla" */}
            <div className="w-full md:w-64 border-b md:border-b-0 md:border-r border-slate-800 bg-slate-950/60 p-3 flex flex-col overflow-y-auto">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-400 mb-2">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Generar Nuevos Objetos 3D</span>
              </div>
              <div className="space-y-1.5 mb-4">
                {generatePresets.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handlePresetSelect(preset)}
                    className={`w-full text-left p-2 rounded-lg text-xs transition-colors cursor-pointer flex flex-col gap-0.5 ${
                      selectedPresetId === preset.id
                        ? 'bg-amber-400/15 border border-amber-400/50 text-amber-300'
                        : 'bg-slate-900/70 hover:bg-slate-800/80 text-slate-200 border border-slate-800/60'
                    }`}
                  >
                    <div className="font-semibold flex items-center gap-1.5">
                      <FileCode className="w-3.5 h-3.5 shrink-0 text-amber-400" />
                      <span className="truncate">{preset.name}</span>
                    </div>
                    <span className="text-[10px] text-slate-400 line-clamp-2">
                      {preset.description}
                    </span>
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-sky-400 mb-2 pt-2 border-t border-slate-800/80">
                <Wrench className="w-3.5 h-3.5" />
                <span>Deformar Objeto Actual</span>
              </div>
              <div className="space-y-1.5 flex-1">
                {modifyPresets.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handlePresetSelect(preset)}
                    className={`w-full text-left p-2 rounded-lg text-xs transition-colors cursor-pointer flex flex-col gap-0.5 ${
                      selectedPresetId === preset.id
                        ? 'bg-sky-400/15 border border-sky-400/50 text-sky-300'
                        : 'bg-slate-900/50 hover:bg-slate-800/80 text-slate-300 border border-transparent'
                    }`}
                  >
                    <div className="font-medium flex items-center gap-1.5">
                      <FileCode className="w-3.5 h-3.5 shrink-0 text-sky-400" />
                      <span className="truncate">{preset.name}</span>
                    </div>
                    <span className="text-[10px] text-slate-400 line-clamp-1">
                      {preset.description}
                    </span>
                  </button>
                ))}
              </div>

              <div className="mt-3 pt-3 border-t border-slate-800/80 text-[11px] text-slate-400 flex items-center justify-between">
                <span>Atajo: Ctrl + Enter</span>
                <button
                  type="button"
                  onClick={handleCopyCode}
                  className="flex items-center gap-1 text-slate-300 hover:text-white cursor-pointer"
                >
                  <Copy className="w-3 h-3" />
                  {copiedSuccess ? '¡Copiado!' : 'Copiar'}
                </button>
              </div>
            </div>

            {/* Zona Principal: Complemento Gemini AI + Opciones de Ayuda + Editor de Código + Consola */}
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* PANEL DE ASISTENCIA DE DIBUJO 3D PARA GEMINI */}
              <div className="p-3 bg-slate-900/95 border-b border-slate-800 space-y-2.5 max-h-[55vh] overflow-y-auto">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs font-semibold text-amber-300">
                    <Wand2 className="w-4 h-4 text-amber-400" />
                    <span>Asistente Gemini 3D → Python (`bpy`)</span>
                    <button
                      type="button"
                      onClick={() => setShowHelpersPanel((prev) => !prev)}
                      className={`ml-1 px-2 py-0.5 rounded text-[11px] font-medium border flex items-center gap-1 transition-colors cursor-pointer ${
                        showHelpersPanel
                          ? 'bg-amber-400/15 border-amber-400/50 text-amber-300'
                          : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white'
                      }`}
                    >
                      <SlidersHorizontal className="w-3 h-3" />
                      <span>{showHelpersPanel ? 'Ocultar Guías 3D' : 'Mostrar Guías 3D'}</span>
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {/* Selector de Modelo Gemini (Incluye Google Argon) */}
                    <div className="flex items-center gap-1.5 bg-slate-950 px-2 py-1 rounded-lg border border-slate-800 text-[11px]">
                      <Cpu className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span className="text-slate-400 hidden sm:inline">Modelo:</span>
                      <select
                        value={activeModel}
                        onChange={(e) => handleModelSelect(e.target.value)}
                        className="bg-transparent text-amber-300 font-semibold outline-none cursor-pointer text-xs"
                      >
                        {GEMINI_MODEL_OPTIONS.map((opt) => (
                          <option key={opt.id} value={opt.id} className="bg-slate-900 text-slate-100">
                            {opt.label} • {opt.badge}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Selector de Nivel de Pensamiento: LOW / MEDIUM / HIGH */}
                    <div
                      className="flex items-center gap-1 bg-slate-950 p-0.5 rounded-lg border border-slate-800 text-[11px]"
                      title="Nivel de razonamiento (Thinking Level): Low, Medium o High"
                    >
                      <Brain className="w-3.5 h-3.5 text-sky-400 ml-1.5 mr-0.5 shrink-0" />
                      {THINKING_LEVEL_OPTIONS.map((lvl) => (
                        <button
                          key={lvl.id}
                          type="button"
                          onClick={() => handleThinkingSelect(lvl.id)}
                          title={lvl.description}
                          className={`px-2 py-0.5 rounded-md font-semibold transition-colors cursor-pointer ${
                            activeThinking === lvl.id
                              ? 'bg-sky-400 text-slate-950'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          {lvl.shortLabel}
                        </button>
                      ))}
                    </div>

                    {/* Selector de Modo: Nuevo Objeto / + Añadir al Actual / Refinar Código */}
                    <div className="flex items-center gap-1 bg-slate-950 p-0.5 rounded-lg border border-slate-800 text-[11px]">
                      <button
                        type="button"
                        onClick={() => setGeminiMode('replace')}
                        className={`px-2 py-1 rounded-md transition-colors cursor-pointer ${
                          geminiMode === 'replace'
                            ? 'bg-amber-400 text-slate-950 font-semibold'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        Nuevo Objeto
                      </button>
                      <button
                        type="button"
                        onClick={() => setGeminiMode('append')}
                        className={`px-2 py-1 rounded-md transition-colors cursor-pointer ${
                          geminiMode === 'append'
                            ? 'bg-amber-400 text-slate-950 font-semibold'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        + Añadir al Actual
                      </button>
                      <button
                        type="button"
                        onClick={() => setGeminiMode('refine')}
                        className={`px-2 py-1 rounded-md transition-colors cursor-pointer ${
                          geminiMode === 'refine'
                            ? 'bg-amber-400 text-slate-950 font-semibold'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        Refinar Script Actual
                      </button>
                    </div>
                  </div>
                </div>

                {/* BARRA DE USO SEMANAL DE GEMINI Y ENLACE OFICIAL A CUOTA RESTANTE */}
                <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 rounded-lg bg-slate-950/90 border border-slate-800/90 text-[11px]">
                  <div className="flex flex-wrap items-center gap-3 text-slate-300">
                    <span className="flex items-center gap-1.5 font-semibold text-white">
                      <BarChart3 className="w-3.5 h-3.5 text-amber-400" />
                      Uso Semanal en Estudio:
                    </span>
                    <span className="font-mono text-amber-300">
                      {weeklyStats.totalGenerations} generaciones
                    </span>
                    {weeklyStats.argonGenerations > 0 && (
                      <span className="font-mono text-sky-300">
                        ({weeklyStats.argonGenerations} con Argon 4)
                      </span>
                    )}
                    <span className="text-slate-500">·</span>
                    <span className="font-mono text-slate-400">
                      {(weeklyStats.totalTokens / 1000).toFixed(1)}k tokens ({(weeklyStats.thoughtTokens / 1000).toFixed(1)}k thinking)
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <a
                      href={GEMINI_QUOTA_LINKS.aiStudioPlan}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-amber-300 hover:text-amber-200 underline underline-offset-2 font-semibold"
                      title="Consulta tu plan y límite de uso en Google AI Studio"
                    >
                      <span>Ver cuánto queda de tu uso en AI Studio</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                    <span className="text-slate-700">|</span>
                    <a
                      href={GEMINI_QUOTA_LINKS.geminiAccountUsage}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-sky-300 hover:text-sky-200 underline underline-offset-2 font-medium"
                      title="Revisa tu historial y actividad semanal de Gemini en tu cuenta de Google"
                    >
                      <span>Mi Uso Semanal Google Gemini</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>

                {/* CONTROLES DE AYUDA PARA GUIAR A GEMINI AL DIBUJAR */}
                {showHelpersPanel && (
                  <div className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800/90 space-y-2.5 text-[11px]">
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
                      {/* 1. Arquetipo Estructural */}
                      <div className="space-y-1">
                        <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                          1. Estructura / Arquetipo
                        </label>
                        <select
                          value={helpers.archetype}
                          onChange={(e) =>
                            setHelpers((prev) => ({ ...prev, archetype: e.target.value }))
                          }
                          className="w-full px-2 py-1.5 rounded bg-slate-900 border border-slate-700 text-slate-200 outline-none focus:border-amber-400 text-[11px]"
                        >
                          {ARCHETYPE_OPTIONS.map((opt) => (
                            <option key={opt.id} value={opt.id}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* 2. Simetría y Patrón Matemático */}
                      <div className="space-y-1">
                        <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                          2. Simetría Geométrica
                        </label>
                        <select
                          value={helpers.symmetry}
                          onChange={(e) =>
                            setHelpers((prev) => ({ ...prev, symmetry: e.target.value }))
                          }
                          className="w-full px-2 py-1.5 rounded bg-slate-900 border border-slate-700 text-slate-200 outline-none focus:border-amber-400 text-[11px]"
                        >
                          {SYMMETRY_OPTIONS.map((opt) => (
                            <option key={opt.id} value={opt.id}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* 3. Nivel de Complejidad / Piezas */}
                      <div className="space-y-1">
                        <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                          3. Densidad de Piezas
                        </label>
                        <div className="grid grid-cols-3 gap-1 bg-slate-900 p-0.5 rounded border border-slate-700">
                          {(
                            [
                              { id: 'standard', label: 'Media' },
                              { id: 'high', label: 'Alta' },
                              { id: 'ultra', label: 'Ultra+' },
                            ] as const
                          ).map((c) => (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() =>
                                setHelpers((prev) => ({ ...prev, complexity: c.id }))
                              }
                              className={`py-1 rounded text-[10px] font-medium transition-colors cursor-pointer ${
                                helpers.complexity === c.id
                                  ? 'bg-amber-400 text-slate-950 font-semibold'
                                  : 'text-slate-400 hover:text-white'
                              }`}
                            >
                              {c.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* 4. Paleta de Color Cel-Shading */}
                      <div className="space-y-1">
                        <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                          4. Paleta de Color
                        </label>
                        <select
                          value={helpers.palette}
                          onChange={(e) =>
                            setHelpers((prev) => ({ ...prev, palette: e.target.value }))
                          }
                          className="w-full px-2 py-1.5 rounded bg-slate-900 border border-slate-700 text-slate-200 outline-none focus:border-amber-400 text-[11px]"
                        >
                          {PALETTE_OPTIONS.map((pal) => (
                            <option key={pal.id} value={pal.id}>
                              {pal.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Fila 2 de Ayudas: Referencia Visual (Boceto + Captura del Visor 3D + Auto-Suavizado) */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1.5 border-t border-slate-800/80">
                      <div className="flex flex-wrap items-center gap-2">
                        {/* Subir Boceto / Imagen de Referencia para Gemini */}
                        <input
                          ref={refImgInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handleReferenceImageUpload}
                          className="hidden"
                        />
                        <button
                          type="button"
                          onClick={() => refImgInputRef.current?.click()}
                          className={`px-2.5 py-1 rounded border flex items-center gap-1.5 transition-colors cursor-pointer ${
                            referenceImageBase64
                              ? 'bg-amber-400/15 border-amber-400 text-amber-300 font-semibold'
                              : 'bg-slate-900 hover:bg-slate-800 border-slate-700 text-slate-300'
                          }`}
                          title="Sube un dibujo o imagen para que Gemini copie su forma y colores en 3D"
                        >
                          <ImagePlus className="w-3.5 h-3.5 text-amber-400" />
                          <span>
                            {referenceImageName
                              ? `Boceto: ${referenceImageName.slice(0, 16)}`
                              : 'Subir Imagen / Boceto Guía'}
                          </span>
                        </button>
                        {referenceImageBase64 && (
                          <button
                            type="button"
                            onClick={() => {
                              setReferenceImageBase64(null);
                              setReferenceImageName(null);
                            }}
                            className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 hover:text-red-400 text-[10px] cursor-pointer"
                          >
                            Quitar
                          </button>
                        )}

                        {/* Enviar Captura de la Escena 3D Actual + Coordenadas BoundingBox */}
                        <button
                          type="button"
                          onClick={() =>
                            setHelpers((prev) => ({
                              ...prev,
                              sendViewportSnapshot: !prev.sendViewportSnapshot,
                            }))
                          }
                          className={`px-2.5 py-1 rounded border flex items-center gap-1.5 transition-colors cursor-pointer ${
                            helpers.sendViewportSnapshot
                              ? 'bg-sky-500/15 border-sky-400/50 text-sky-300 font-medium'
                              : 'bg-slate-900 border-slate-700 text-slate-400'
                          }`}
                          title="Envía una foto del visor 3D actual y las medidas de la malla para que Gemini dibuje a escala"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>
                            Visión Escena 3D: {helpers.sendViewportSnapshot ? 'Activa' : 'Off'}
                          </span>
                        </button>

                        {/* Auto-Redondear Aristas */}
                        <button
                          type="button"
                          onClick={() =>
                            setHelpers((prev) => ({ ...prev, autoSmooth: !prev.autoSmooth }))
                          }
                          className={`px-2.5 py-1 rounded border flex items-center gap-1 transition-colors cursor-pointer ${
                            helpers.autoSmooth
                              ? 'bg-emerald-500/15 border-emerald-400/50 text-emerald-300 font-medium'
                              : 'bg-slate-900 border-slate-700 text-slate-400'
                          }`}
                        >
                          <Sparkles className="w-3 h-3" />
                          <span>Auto-Smooth: {helpers.autoSmooth ? 'Sí' : 'No'}</span>
                        </button>
                      </div>

                      {/* Textura automática opcional */}
                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-400 text-[10px]">Textura:</span>
                        <select
                          value={helpers.autoTexture}
                          onChange={(e) =>
                            setHelpers((prev) => ({ ...prev, autoTexture: e.target.value }))
                          }
                          className="px-2 py-1 rounded bg-slate-900 border border-slate-700 text-slate-200 text-[10px] outline-none"
                        >
                          <option value="none">Color Puro Cel-Shade</option>
                          <option value="dragon_scales">Escamas de Dragón</option>
                          <option value="biomech_plates">Placas Biomecánicas</option>
                          <option value="magma_cracks">Grietas de Magma</option>
                          <option value="halftone_manga">Trama Manga Halftone</option>
                          <option value="cyber_circuits">Circuitos Ciberneón</option>
                        </select>
                      </div>
                    </div>

                    {/* Fila 3: Kit de Herramientas IA para Mejorar el Resultado 3D */}
                    <div className="pt-2 border-t border-slate-800/80 space-y-1.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-[10px] font-semibold text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                          <Wrench className="w-3 h-3 text-amber-400" />
                          <span>Kit de Herramientas IA Activas para Mejorar el Resultado:</span>
                        </span>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() =>
                              setHelpers((prev) => ({
                                ...prev,
                                autoCritique: !prev.autoCritique,
                              }))
                            }
                            className={`px-2 py-0.5 rounded border text-[10px] font-semibold cursor-pointer transition-colors ${
                              helpers.autoCritique
                                ? 'bg-sky-500/20 border-sky-400 text-sky-300'
                                : 'bg-slate-900 border-slate-700 text-slate-400'
                            }`}
                            title="La IA audita las proporciones del visor 3D y reemplaza partes básicas por geometría articulada"
                          >
                            Auditoría Visual IA: {helpers.autoCritique ? 'ON' : 'OFF'}
                          </button>
                          <button
                            type="button"
                            disabled={isRunning}
                            onClick={() =>
                              handleExecute(
                                false,
                                `import bpy\nbpy.ops.mesh.mirror_x()\nbpy.ops.mesh.auto_ground()\nprint("Simetría Espejo X y Auto-Apoyo en pedestal aplicados.")`,
                                'Simetría X + Apoyar'
                              )
                            }
                            className="px-2 py-0.5 rounded bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 text-emerald-300 text-[10px] font-semibold cursor-pointer"
                            title="Ejecuta al instante mirror_x() y auto_ground() sobre el objeto actual en escena"
                          >
                            ⚡ Aplicar Mirror X + Apoyar Ahora
                          </button>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-1.5">
                        {AI_TOOLKIT_OPTIONS.map((tool) => {
                          const isSelected = helpers.aiTools.includes(tool.id);
                          return (
                            <button
                              key={tool.id}
                              type="button"
                              title={tool.description}
                              onClick={() =>
                                setHelpers((prev) => ({
                                  ...prev,
                                  aiTools: isSelected
                                    ? prev.aiTools.filter((id) => id !== tool.id)
                                    : [...prev.aiTools, tool.id],
                                }))
                              }
                              className={`px-2 py-1 rounded border text-[10px] font-medium transition-colors cursor-pointer ${
                                isSelected
                                  ? 'bg-amber-400/20 border-amber-400/60 text-amber-200 font-semibold'
                                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                              }`}
                            >
                              {tool.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {/* Input de Prompt + Botón Generar con Gemini + Copiar Prompt para Gemini Pro Web */}
                <div className="flex flex-wrap gap-2">
                  <input
                    type="text"
                    value={geminiPrompt}
                    onChange={(e) => setGeminiPrompt(e.target.value)}
                    onPaste={handlePromptInputPaste}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleGenerateWithGemini();
                      }
                    }}
                    placeholder="Escribe cualquier elemento de juego (o pega aquí directamente tu código Python de Blender 5.2 con Ctrl+V)..."
                    className="flex-1 min-w-[220px] px-3 py-2 rounded-lg bg-slate-950 border border-slate-700/80 focus:border-amber-400 outline-none text-xs text-white placeholder:text-slate-500"
                  />
                  <button
                    type="button"
                    onClick={handleCopyPromptForGeminiWeb}
                    title="Copia un prompt optimizado para Blender 5.2 para que lo pegues en tu cuenta de Gemini Pro en la web (gemini.google.com) sin gastar cuota API"
                    className="px-3 py-2 rounded-lg bg-sky-500/15 hover:bg-sky-500/25 border border-sky-400/50 text-sky-200 font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
                  >
                    <Copy className="w-3.5 h-3.5 text-sky-400" />
                    <span>
                      {copiedWebPrompt
                        ? '¡Prompt Blender 5.2 Copiado!'
                        : 'Prompt para Gemini Web (5.2)'}
                    </span>
                  </button>
                  <button
                    type="button"
                    disabled={isGeneratingGemini || !geminiPrompt.trim()}
                    onClick={() => handleGenerateWithGemini()}
                    className="px-4 py-2 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 shrink-0"
                  >
                    {isGeneratingGemini ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Razonando ({activeThinking})...</span>
                      </>
                    ) : (
                      <>
                        <Wand2 className="w-3.5 h-3.5" />
                        <span>Dibujar con Gemini</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Botones de Refinamiento Iterativo en 1 Clic */}
                <div className="flex items-center gap-1.5 flex-wrap text-[11px]">
                  <span className="text-slate-400">Ayudar a mejorar el dibujo actual:</span>
                  {REFINEMENT_CHIPS.map((chip) => (
                    <button
                      key={chip.label}
                      type="button"
                      disabled={isGeneratingGemini}
                      onClick={() => {
                        setGeminiPrompt(chip.prompt);
                        setGeminiMode('refine');
                        handleGenerateWithGemini(chip.prompt, 'refine');
                      }}
                      className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-amber-300 transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>

                {/* PANEL DE EVOLUCIÓN DEL PENSAMIENTO (EN PROCESO Y COMPLETADO) */}
                {(isGeneratingGemini || thoughtSteps.length > 0) && (
                  <div className="p-2.5 rounded-lg bg-slate-950/95 border border-sky-500/35 space-y-2 text-[11px]">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 font-semibold text-sky-300">
                        <Brain className={`w-3.5 h-3.5 text-sky-400 ${isGeneratingGemini ? 'animate-pulse' : ''}`} />
                        <span>
                          {isGeneratingGemini
                            ? `Evolución del Pensamiento en Proceso (${activeModel} • Nivel ${activeThinking})`
                            : `Evolución del Pensamiento Completada (${activeModel} • Nivel ${activeThinking})`}
                        </span>
                      </div>
                      <span className="font-mono text-[10px] text-slate-400">
                        {isGeneratingGemini
                          ? `${elapsedSeconds}s transcurridos`
                          : lastTokenUsage
                          ? `${lastTokenUsage.thoughtsTokens} tokens de pensamiento • ${lastTokenUsage.totalTokens} totales`
                          : 'Razonamiento finalizado'}
                      </span>
                    </div>

                    {isGeneratingGemini ? (
                      <div className="space-y-1.5">
                        {(LIVE_THOUGHT_PHASES[activeThinking] || LIVE_THOUGHT_PHASES.MEDIUM).map(
                          (phaseText, idx) => {
                            const isDone = idx < livePhaseIndex;
                            const isCurrent = idx === livePhaseIndex;
                            return (
                              <div
                                key={idx}
                                className={`flex items-center gap-2 px-2 py-1 rounded ${
                                  isCurrent
                                    ? 'bg-sky-500/15 border border-sky-400/40 text-sky-200 font-medium'
                                    : isDone
                                    ? 'text-emerald-300/80'
                                    : 'text-slate-500'
                                }`}
                              >
                                {isDone ? (
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                ) : isCurrent ? (
                                  <Loader2 className="w-3.5 h-3.5 text-sky-400 animate-spin shrink-0" />
                                ) : (
                                  <span className="w-3.5 h-3.5 rounded-full border border-slate-700 inline-block shrink-0" />
                                )}
                                <span>{phaseText}</span>
                              </div>
                            );
                          }
                        )}
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                        {thoughtSteps.map((step, idx) => (
                          <div
                            key={idx}
                            className="flex items-start gap-1.5 p-1.5 rounded bg-slate-900/90 border border-slate-800 text-slate-300"
                          >
                            <span className="font-mono text-sky-400 font-bold shrink-0">
                              #{idx + 1}
                            </span>
                            <span className="leading-snug">{step}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {geminiSummary && (
                  <div className="px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-[11px] flex items-center justify-between gap-2">
                    <span className="truncate">{geminiSummary}</span>
                    <button
                      type="button"
                      onClick={onClose}
                      className="px-2.5 py-0.5 rounded bg-emerald-400 text-slate-950 font-semibold shrink-0 cursor-pointer hover:bg-emerald-300"
                    >
                      Ver Resultado en 3D →
                    </button>
                  </div>
                )}
              </div>

              <div className="flex-1 relative flex flex-col bg-[#0b0e14]">
                <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 bg-slate-900/70 border-b border-slate-800/60 text-xs text-slate-400">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-slate-300 font-semibold">blender_5_2_script.py</span>
                    <div
                      className="flex items-center gap-1 bg-slate-950 px-2 py-0.5 rounded border border-slate-800 text-[11px]"
                      title="Modo de compatibilidad de ejes para scripts creados en la web (Blender 5.2 usa Eje Z Arriba)"
                    >
                      <span className="text-slate-400">Ejes:</span>
                      <select
                        value={coordinateMode}
                        onChange={(e) => setCoordinateMode(e.target.value as BlenderCoordinateMode)}
                        className="bg-transparent text-amber-300 font-semibold outline-none cursor-pointer"
                      >
                        <option value="auto" className="bg-slate-900 text-slate-100">
                          Auto (Blender 5.2 Z-Up / Estudio)
                        </option>
                        <option value="blender_z_up" className="bg-slate-900 text-slate-100">
                          Blender 5.2 Web (Eje Z Arriba)
                        </option>
                        <option value="studio_y_up" className="bg-slate-900 text-slate-100">
                          Estudio Nativo (Eje Y Arriba)
                        </option>
                      </select>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={isRunning || isGeneratingGemini}
                      onClick={handlePasteAndRunWebScript}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-sky-500/15 hover:bg-sky-500/25 text-sky-300 border border-sky-400/40 font-semibold transition-colors cursor-pointer disabled:opacity-50"
                      title="Pega y ejecuta directamente un código Python creado en Gemini Web / Blender 5.2 (0 llamadas API)"
                    >
                      <FileCode className="w-3.5 h-3.5" />
                      <span>Pegar y Ejecutar Código Web</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const currentPreset = BLENDER_SCRIPT_PRESETS.find(
                          (p) => p.id === selectedPresetId
                        );
                        if (currentPreset) setScriptCode(currentPreset.code);
                      }}
                      className="flex items-center gap-1 text-xs text-slate-400 hover:text-white cursor-pointer"
                    >
                      <RotateCcw className="w-3 h-3" />
                      Restaurar
                    </button>
                    <button
                      type="button"
                      disabled={isRunning || isGeneratingGemini}
                      onClick={() => handleExecute(false)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-400/30 font-semibold transition-colors cursor-pointer disabled:opacity-50"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      {isRunning ? 'Ejecutando...' : 'Ejecutar en Consola'}
                    </button>
                    <button
                      type="button"
                      disabled={isRunning || isGeneratingGemini}
                      onClick={() => handleExecute(true)}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-md bg-amber-400 hover:bg-amber-300 text-slate-950 font-semibold transition-colors cursor-pointer disabled:opacity-50"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      {isRunning ? 'Generando...' : 'Ejecutar y Ver en 3D'}
                    </button>
                  </div>
                </div>

                {pasteHintMessage && (
                  <div className="px-4 py-2 bg-sky-500/20 border-b border-sky-400/50 text-sky-200 text-xs flex items-center justify-between gap-2">
                    <span>{pasteHintMessage}</span>
                    <button
                      type="button"
                      onClick={() => setPasteHintMessage(null)}
                      className="text-sky-300 hover:text-white font-semibold cursor-pointer"
                    >
                      Entendido
                    </button>
                  </div>
                )}

                <div className="flex-1 relative overflow-auto p-4 font-mono text-xs text-slate-200">
                  <textarea
                    ref={codeTextareaRef}
                    value={scriptCode}
                    onChange={(e) => {
                      setScriptCode(e.target.value);
                      if (pasteHintMessage) setPasteHintMessage(null);
                    }}
                    onPaste={handleCodeEditorPaste}
                    onKeyDown={handleKeyDown}
                    spellCheck={false}
                    className="w-full h-full bg-transparent resize-none outline-none font-mono text-xs leading-relaxed text-amber-100/95 selection:bg-amber-400/30"
                    placeholder="# Pega aquí con Ctrl + V cualquier código Python de Blender 5.2 (se limpiará y ejecutará automáticamente)..."
                  />
                </div>
              </div>

              {/* Terminal de Salida Python */}
              <div className="h-38 border-t border-slate-800 bg-[#080b10] flex flex-col">
                <div className="flex items-center justify-between px-4 py-1.5 bg-slate-900/80 border-b border-slate-800/80 text-[11px] text-slate-400">
                  <div className="flex items-center gap-1.5">
                    <Terminal className="w-3.5 h-3.5 text-amber-400" />
                    <span className="font-semibold text-slate-300">
                      Consola de Salida Python (stdout)
                    </span>
                  </div>
                  {lastResult && (
                    <div className="flex items-center gap-3">
                      {lastResult.success ? (
                        <>
                          <span className="text-emerald-400 flex items-center gap-1 text-[11px]">
                            <CheckCircle2 className="w-3 h-3" /> Ejecutado ({lastResult.executionTimeMs} ms)
                          </span>
                          <button
                            type="button"
                            onClick={onClose}
                            className="px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/30 font-semibold cursor-pointer"
                          >
                            Ver Objeto en 3D →
                          </button>
                        </>
                      ) : (
                        <span className="text-red-400 flex items-center gap-1 text-[11px]">
                          <AlertCircle className="w-3 h-3" /> Error de ejecución
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex-1 p-3 overflow-y-auto font-mono text-[11px] text-slate-300 space-y-1">
                  {terminalLogs.map((log, i) => (
                    <div
                      key={i}
                      className={
                        log.startsWith('Error') || log.startsWith('Excepción')
                          ? 'text-red-400'
                          : log.startsWith('>>>')
                          ? 'text-amber-400'
                          : log.startsWith('+') || log.includes('completado') || log.includes('exito')
                          ? 'text-emerald-300'
                          : 'text-slate-300'
                      }
                    >
                      {log}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Pestaña de Documentación Completa / README de Funciones Admitidas (Blender 5.2 API) */
          <div className="flex-1 p-6 overflow-y-auto space-y-5 text-xs text-slate-300 bg-[#0b0e14]">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 pb-3 border-b border-slate-800">
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-amber-400" />
                  README — Todas las Funciones Admitidas (Motor Blender 5.2 Python API)
                </h3>
                <p className="text-slate-400">
                  Documentación completa de módulos, operadores, modificadores, nodos y sintaxis Python compatibles con scripts de la web (Gemini, ChatGPT, Claude) y el generador integrado.
                </p>
              </div>
              <span className="px-2.5 py-1 rounded-md bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 font-mono text-[11px] shrink-0">
                README.md Incluido en el Proyecto
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-3.5 rounded-lg bg-slate-900/70 border border-slate-800 space-y-2">
                <span className="font-mono text-amber-300 font-semibold">
                  1. Primitivas 3D (`bpy.ops.mesh.*` y `bpy.ops.curve.*`)
                </span>
                <p className="text-slate-400">
                  Soportan argumentos posicionales y keyword (`size`, `radius`, `depth`, `location`, `rotation`, `scale`, `vertices`, `subdivisions`, `color`):
                </p>
                <code className="block p-2.5 rounded bg-slate-950 font-mono text-[11px] text-slate-200 leading-relaxed">
                  • bpy.ops.mesh.primitive_cube_add(size=2.0, location=(x,y,z), scale=(sx,sy,sz))
                  <br />
                  • bpy.ops.mesh.primitive_uv_sphere_add(radius=1.0, segments=32, ring_count=16)
                  <br />
                  • bpy.ops.mesh.primitive_ico_sphere_add(radius=1.0, subdivisions=2)
                  <br />
                  • bpy.ops.mesh.primitive_cylinder_add(radius=1.0, depth=2.0, vertices=32)
                  <br />
                  • bpy.ops.mesh.primitive_cone_add(radius1=1.0, radius2=0.0, depth=2.0)
                  <br />
                  • bpy.ops.mesh.primitive_torus_add(major_radius=1.0, minor_radius=0.25)
                  <br />
                  • bpy.ops.mesh.primitive_plane_add(size=2.0) / primitive_grid_add(size=2.0)
                  <br />
                  • bpy.ops.mesh.primitive_circle_add(radius=1.0) / primitive_monkey_add(size=2.0)
                  <br />
                  • bpy.ops.curve.primitive_bezier_curve_add() / primitive_bezier_circle_add()
                </code>
              </div>

              <div className="p-3.5 rounded-lg bg-slate-900/70 border border-slate-800 space-y-2">
                <span className="font-mono text-amber-300 font-semibold">
                  2. Mallas Personalizadas (`bpy.data.meshes` & `from_pydata`)
                </span>
                <p className="text-slate-400">
                  Construye cualquier polígono desde cero con listas de vértices `(x, y, z)` y caras (triángulos, quads o n-gons):
                </p>
                <code className="block p-2.5 rounded bg-slate-950 font-mono text-[11px] text-slate-200 leading-relaxed">
                  mesh = bpy.data.meshes.new(name=&quot;MiMalla&quot;)
                  <br />
                  mesh.from_pydata(verts, edges, faces) # o vertices=..., faces=...
                  <br />
                  mesh.update()
                  <br />
                  obj = bpy.data.objects.new(&quot;MiObjeto&quot;, mesh)
                  <br />
                  bpy.context.collection.objects.link(obj)
                  <br />
                  # Acceso directo a vértices y polígonos:
                  <br />
                  for v in obj.data.vertices: v.co.z += 0.2 # o v.co[2] += 0.2
                  <br />
                  for p in obj.data.polygons: p.use_smooth = True
                </code>
              </div>

              <div className="p-3.5 rounded-lg bg-slate-900/70 border border-slate-800 space-y-2">
                <span className="font-mono text-amber-300 font-semibold">
                  3. Modelado Topológico con `bmesh` y `bmesh.ops`
                </span>
                <p className="text-slate-400">
                  Soporte completo para `bmesh.new()`, creación de vértices/caras manuales y múltiples operadores acumulativos sobre el mismo `bm`:
                </p>
                <code className="block p-2.5 rounded bg-slate-950 font-mono text-[11px] text-slate-200 leading-relaxed">
                  bm = bmesh.new() # o bm.from_mesh(mesh)
                  <br />
                  v1 = bm.verts.new((0, 0, 0)); bm.verts.ensure_lookup_table()
                  <br />
                  f = bm.faces.new([v1, v2, v3]); f.smooth = True
                  <br />
                  bmesh.ops.create_cube(bm, size=1.0, matrix=...)
                  <br />
                  bmesh.ops.create_uvsphere(bm, u_segments=24, v_segments=16, radius=0.5)
                  <br />
                  bmesh.ops.create_icosphere(bm, subdivisions=2, radius=0.5)
                  <br />
                  bmesh.ops.create_cone(bm, radius1=0.5, radius2=0.0, depth=1.0)
                  <br />
                  bmesh.ops.create_cylinder(bm, radius=0.5, depth=1.0, segments=16)
                  <br />
                  bmesh.ops.translate / scale / rotate / extrude_face_region / bevel
                  <br />
                  bm.to_mesh(mesh); bm.free()
                </code>
              </div>

              <div className="p-3.5 rounded-lg bg-slate-900/70 border border-slate-800 space-y-2">
                <span className="font-mono text-amber-300 font-semibold">
                  4. Materiales PBR y Nodos `Principled BSDF` (Blender 5.2)
                </span>
                <p className="text-slate-400">
                  Compatible con `use_nodes = True`, sockets `Principled BSDF` y asignación por `obj.data.materials.append(mat)` o `obj.active_material`:
                </p>
                <code className="block p-2.5 rounded bg-slate-950 font-mono text-[11px] text-slate-200 leading-relaxed">
                  mat = bpy.data.materials.new(name=&quot;Material&quot;)
                  <br />
                  mat.use_nodes = True
                  <br />
                  bsdf = mat.node_tree.nodes[&quot;Principled BSDF&quot;]
                  <br />
                  bsdf.inputs[&quot;Base Color&quot;].default_value = (0.2, 0.6, 1.0, 1.0)
                  <br />
                  bsdf.inputs[&quot;Metallic&quot;].default_value = 0.85
                  <br />
                  bsdf.inputs[&quot;Roughness&quot;].default_value = 0.25
                  <br />
                  bsdf.inputs[&quot;Emission Color&quot;].default_value = (0.0, 0.9, 1.0, 1.0)
                  <br />
                  bsdf.inputs[&quot;Emission Strength&quot;].default_value = 2.5
                  <br />
                  obj.data.materials.append(mat)
                </code>
              </div>

              <div className="p-3.5 rounded-lg bg-slate-900/70 border border-slate-800 space-y-2">
                <span className="font-mono text-amber-300 font-semibold">
                  5. Modificadores (`obj.modifiers`) y `mathutils`
                </span>
                <p className="text-slate-400">
                  Modificadores no destructivos y álgebra vectorial/matricial completa:
                </p>
                <code className="block p-2.5 rounded bg-slate-950 font-mono text-[11px] text-slate-200 leading-relaxed">
                  • obj.modifiers.new(name=&quot;Mirror&quot;, type=&apos;MIRROR&apos;) # use_axis, mirror_object
                  <br />
                  • obj.modifiers.new(name=&quot;Array&quot;, type=&apos;ARRAY&apos;) # count, relative_offset_displace
                  <br />
                  • obj.modifiers.new(name=&quot;Subsurf&quot;, type=&apos;SUBSURF&apos;) # levels=2
                  <br />
                  • obj.modifiers.new(name=&quot;Solidify&quot;, type=&apos;SOLIDIFY&apos;) # thickness=0.05
                  <br />
                  • mathutils.Vector((x, y, z)) # .x/.y/.z, .length, .normalized(), .dot(), .cross()
                  <br />
                  • mathutils.Euler((rx, ry, rz), &apos;XYZ&apos;)
                  <br />
                  • mathutils.Matrix.Translation / Rotation / Scale y operador @ (Matrix @ Vector)
                </code>
              </div>

              <div className="p-3.5 rounded-lg bg-slate-900/70 border border-slate-800 space-y-2">
                <span className="font-mono text-amber-300 font-semibold">
                  6. Módulos Estándar y Sintaxis Python Admitida
                </span>
                <p className="text-slate-400">
                  Transpilador Python a JS con soporte nativo para expresiones avanzadas:
                </p>
                <code className="block p-2.5 rounded bg-slate-950 font-mono text-[11px] text-slate-200 leading-relaxed">
                  • Módulos: bpy, bmesh, mathutils, math, random, numpy as np
                  <br />
                  • Comprensiones: [expr for x in iter if cond], {`{k: v for k, v in items}`}
                  <br />
                  • Slicing y listas: arr[::-1], arr[1:5], [True] * 3, a // b, -x ** 2
                  <br />
                  • Desempaquetado: x, y, z = pos | for i, (a, b) in enumerate(lista):
                  <br />
                  • Strings: f&quot;Parte_{`{i:02d}`}_{`{val:.2f}`}&quot;, r&quot;raw_string&quot;, docstrings &quot;&quot;&quot;...&quot;&quot;&quot;
                  <br />
                  • Funciones def con defaults/kwargs y clases bpy.types.Operator
                </code>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
