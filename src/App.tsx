import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { SSAOPass } from 'three/addons/postprocessing/SSAOPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import {
  Upload,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Eye,
  Layers,
  RefreshCw,
  Code2,
  Paintbrush,
  Download,
  Scissors,
  Grid3X3,
  MousePointer,
  CircleDot,
  Wand2,
  Sun,
  Camera,
  Undo2,
  Redo2,
  ShieldCheck,
  FlipHorizontal,
  PlusCircle,
  Minimize2,
  Flame,
  ImagePlus,
  SlidersHorizontal,
  X,
  User as UserIcon,
  LogIn,
  LogOut,
  Cloud,
  CloudUpload,
  Trash2,
  CheckCircle2,
  Cpu,
  Brain,
  ExternalLink,
  BarChart3,
  Loader2,
  ZoomIn,
  ZoomOut,
  Focus,
  Triangle,
  Box,
  PaintBucket,
  Pipette,
  Move,
  GitCommitHorizontal,
  Zap,
  Gem,
  PanelRightClose,
  PanelRightOpen,
  EyeOff,
} from 'lucide-react';

import {
  createThreeToneGradientTexture,
  setupStylizedEnemyModel,
  applyNormalSmoothingToModel,
} from './utils/geometrySmoothing';
import { createLowPolyEnemyFallback } from './utils/proceduralEnemy';
import { ComicEdgePostShader } from './utils/comicPostShader';
import {
  TEXTURE_PRESETS,
  TexturePatternType,
  TextureCategoryType,
  generateProceduralTexture,
  generateProceduralBumpTexture,
  getTexturePresetInfo,
} from './utils/proceduralTextures';
import {
  MATCAP_PRESETS,
  MatcapPresetId,
  getProceduralMatcapTexture,
} from './utils/matcapGenerator';
import {
  SculptBrushSettings,
  TriangleSubdivideMode,
  VertexMovePlaneMode,
  VertexLineSnapMode,
  isTriangleToolMode,
  isVertexToolMode,
  applySculptBrushToMesh,
  applyTriangleToolToMesh,
  floodFillMeshTriangles,
  segmentAllModelTriangles,
  applyGlobalLaplacianSmoothing,
  subdivideAndSmoothModel,
  decimateModelGeometry,
  exportModifiedGlb,
  GlbExportPresetMode,
  GlbExportStats,
  createBrushIndicatorMesh,
  createTriangleHighlightMesh,
  updateTriangleHighlightMesh,
  findMirrorTriangleIndex,
  createVertexHighlightMesh,
  createVertexLineIndicatorMesh,
  updateVertexLineIndicatorMesh,
  findNearestVertexOnHit,
  captureModelPositionsSnapshot,
  applyVertexMoveFromSnapshot,
  applyVertexLineAlignmentFromSnapshot,
  pushUndoSnapshot,
  popUndoSnapshot,
  popRedoSnapshot,
  saveMasterDrawingCheckpoint,
  restoreMasterDrawingCheckpoint,
} from './utils/meshDeformer';
import { tickBlenderAnimations } from './utils/blenderAnimation';
import {
  BLENDER_SCRIPT_PRESETS,
  BlenderCoordinateMode,
  executeBlenderPythonScript,
  ScriptExecutionResult,
  isLikelyBlenderPythonCode,
  stripMarkdownCodeFences,
} from './utils/blenderPythonEngine';
import PythonScriptModal, {
  ARCHETYPE_OPTIONS,
  SYMMETRY_OPTIONS,
  PALETTE_OPTIONS,
  GEMINI_MODEL_OPTIONS,
  THINKING_LEVEL_OPTIONS,
  ThinkingLevelChoice,
  LIVE_THOUGHT_PHASES,
  GEMINI_QUOTA_LINKS,
  AI_TOOLKIT_OPTIONS,
  getGeminiWeeklyUsage,
  recordGeminiUsage,
  GeminiWeeklyUsageStats,
  SceneBoundsData,
} from './components/PythonScriptModal';
import MyTexturesPanel from './components/MyTexturesPanel';
import {
  ColorMapTextureInfo,
  applyBoxProjectedUv,
  getColorMapThreeTexture,
  preloadColorMapImages,
} from './utils/textureLibrary';
import {
  signInWithGoogle,
  signOutUser,
  onAuthUserChanged,
  saveModelToCloud,
  getUserSavedModels,
  deleteSavedModel,
  CloudSavedModel,
} from './utils/firebase';
import type { User } from 'firebase/auth';

export type ShadingModeType = 'cel' | 'eevee' | 'cycles' | 'matcap' | 'normals' | 'original';
export type CameraPresetType = 'hero' | 'front' | 'closeup' | 'macro' | 'side' | 'top';

interface PipelineSettings {
  normalSmoothing: number;   // 0.0 (Facetado Low-Poly) -> 1.0 (Suavizado Esférico Total)
  outlineThickness: number;  // Grosor de la línea de contorno (0.0 -> 3.0)
  outlineOpacity: number;    // Opacidad de la línea de contorno (0.0 -> 1.0)
  ssaoIntensity: number;     // Intensidad de sombras de contacto SSAO (0.0 -> 2.5)
  bgColor: string;           // Color de fondo de la escena
  autoRotate: boolean;       // Rotación automática del enemigo
  autoRotateSpeed: number;   // Velocidad de rotación
  aaMode: 'SMAA' | 'FXAA';   // Algoritmo Anti-Aliasing activo
  shadingMode: ShadingModeType; // Modo de sombreado: Cel-Shading, EEVEE, Cycles, MatCap Escultura, Normales RGB, Original
  matcapPreset: MatcapPresetId; // Tipo de MatCap activo
  wireframe: boolean;        // Mostrar estructura poligonal
  showPedestalGrid: boolean; // Mostrar plataforma/anillo de referencia en la base
  lightIntensity: number;    // Intensidad de la luz principal (0.5 -> 4.0)
  lightAngle: number;        // Ángulo horizontal de la luz principal en grados (0 -> 360)
  followCameraLight: boolean;// Luz frontal acoplada a la cámara para inspección clara sin zonas oscuras
  eeveeBloomIntensity: number; // Intensidad de Bloom en tiempo real EEVEE (0.0 -> 1.8)
  eeveeEnvIntensity: number;   // Intensidad de reflejos HDRI IBL en EEVEE (0.2 -> 3.0)
  cyclesSamples: number;       // Muestras de convergencia Path-Tracing en Cycles (16 -> 256)
  cyclesClearcoat: number;     // Barniz físico Clearcoat en Cycles (0.0 -> 1.0)
  cyclesRoughnessFactor: number; // Multiplicador de rugosidad micro-superficie en Cycles (0.15 -> 1.4)
  cyclesIor: number;           // Índice de refracción física IOR en Cycles (1.0 -> 2.4)
  cyclesGiBounceBoost: number; // Intensidad de rebotes de iluminación global (GI) en Cycles (0.6 -> 2.4)
  cyclesProgressiveAccum: boolean; // Acumulación progresiva real multi-paso (jitter de sub-píxel + disco solar) cuando la cámara está quieta
}

interface ModelStats {
  name: string;
  triangles: number;
  vertices: number;
  meshes: number;
  isCustomGlb: boolean;
}

const DEFAULT_SETTINGS: PipelineSettings = {
  normalSmoothing: 0.92,
  outlineThickness: 1.25,
  outlineOpacity: 0.9,
  ssaoIntensity: 1.15,
  bgColor: '#1e2536', // Gris Pizarra Luminoso de Estudio (resalta contornos negros y colores vivos)
  autoRotate: false,  // Estático por defecto para poder esculpir y observar detalles cómodamente
  autoRotateSpeed: 1.2,
  aaMode: 'SMAA',
  shadingMode: 'cel',
  matcapPreset: 'clay',
  wireframe: false,
  showPedestalGrid: true,
  lightIntensity: 2.8,
  lightAngle: 42,
  followCameraLight: true,
  eeveeBloomIntensity: 0.42,
  eeveeEnvIntensity: 1.45,
  cyclesSamples: 64,
  cyclesClearcoat: 0.58,
  cyclesRoughnessFactor: 0.75,
  cyclesIor: 1.5,
  cyclesGiBounceBoost: 1.35,
  cyclesProgressiveAccum: true,
};

const BG_PRESETS = [
  { label: 'Estudio Pizarra (Óptimo)', hex: '#1e2536' },
  { label: 'Gris Escultura ZBrush', hex: '#333b4d' },
  { label: 'Pergamino Manga Claro', hex: '#e5e0d8' },
  { label: 'Obsidiana Profunda', hex: '#0f141d' },
  { label: 'Laboratorio Cian', hex: '#132a38' },
];

export default function App() {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [settings, setSettings] = useState<PipelineSettings>(DEFAULT_SETTINGS);
  const [modelStats, setModelStats] = useState<ModelStats>({
    name: 'Golem_Enemigo_LowPoly.glb (Demo)',
    triangles: 5420,
    vertices: 16260,
    meshes: 16,
    isCustomGlb: false,
  });

  // Herramientas de Edición con Ratón (Vértices y Triángulos, con Simetría X activada por defecto)
  const [brushSettings, setBrushSettings] = useState<SculptBrushSettings>({
    mode: 'smooth',
    radius: 0.28,
    strength: 0.75,
    paintColor: '#38bdf8',
    symmetryX: true,
    triSubdivideSegments: 2,
    triExtrudeHeight: 0.08,
    triExtrudeScale: 0.82,
    triSingleFaceMode: true,
    vertexMoveSoftRadius: true,
    vertexMovePlaneMode: 'camera',
    vertexLineSnapMode: 'snap_to_line',
  });
  const [triangleActionFeedback, setTriangleActionFeedback] = useState<string | null>(null);
  const lastHoveredTriangleRef = useRef<{ mesh: THREE.Mesh | null; faceIndex: number }>({
    mesh: null,
    faceIndex: -1,
  });
  const [activeTexture, setActiveTexture] = useState<TexturePatternType>('none');
  // "Mis texturas": imagen aplicada como mapa de color al modelo actual (tiene prioridad sobre la procedural)
  const [userColorTextureInfo, setUserColorTextureInfo] = useState<ColorMapTextureInfo | null>(null);
  const [userColorTexture, setUserColorTexture] = useState<THREE.Texture | null>(null);
  const [userColorTileMeters, setUserColorTileMeters] = useState<number>(3);
  const [textureCategoryFilter, setTextureCategoryFilter] = useState<'all' | TextureCategoryType>('all');
  const [textureRepeatScale, setTextureRepeatScale] = useState<number>(2);
  const [textureBumpIntensity, setTextureBumpIntensity] = useState<number>(1.0);
  const [textureUseNaturalColor, setTextureUseNaturalColor] = useState<boolean>(true);
  const [decimateRatio, setDecimateRatio] = useState<number>(0.35);
  const [preserveDecimateFeatures, setPreserveDecimateFeatures] = useState<boolean>(true);
  const [decimateFeedback, setDecimateFeedback] = useState<string | null>(null);
  const [isDecimating, setIsDecimating] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [glbExportMode, setGlbExportMode] = useState<GlbExportPresetMode>('light');
  const [lastExportStats, setLastExportStats] = useState<GlbExportStats | null>(null);
  const [canUndo, setCanUndo] = useState<boolean>(false);
  const [canRedo, setCanRedo] = useState<boolean>(false);

  // Modal de Scripting Python estilo Blender y Complemento Gemini AI 3D
  const [isPythonModalOpen, setIsPythonModalOpen] = useState<boolean>(false);
  const [sidebarGeminiPrompt, setSidebarGeminiPrompt] = useState<string>('');
  const [sidebarGeminiMode, setSidebarGeminiMode] = useState<'replace' | 'append' | 'refine'>('replace');
  const [isSidebarGeminiLoading, setIsSidebarGeminiLoading] = useState<boolean>(false);
  const [sidebarGeminiStatus, setSidebarGeminiStatus] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const [lastGeneratedPythonCode, setLastGeneratedPythonCode] = useState<string | null>(null);
  const [coordinateMode, setCoordinateMode] = useState<BlenderCoordinateMode>('auto');
  const [showAxesGizmo, setShowAxesGizmo] = useState<boolean>(true);

  // Autenticación con Google (Firebase), Modelos (incl. Argon 4), Nivel de Pensamiento y Uso Semanal
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(false);
  const [selectedGeminiModel, setSelectedGeminiModel] = useState<string>('gemini-3.8-flash');
  const [selectedThinkingLevel, setSelectedThinkingLevel] = useState<ThinkingLevelChoice>('MEDIUM');
  const [sidebarThoughtSteps, setSidebarThoughtSteps] = useState<string[]>([]);
  const [sidebarLivePhaseIndex, setSidebarLivePhaseIndex] = useState<number>(0);
  const [sidebarElapsedSeconds, setSidebarElapsedSeconds] = useState<number>(0);
  const [weeklyUsageStats, setWeeklyUsageStats] = useState<GeminiWeeklyUsageStats>(() =>
    getGeminiWeeklyUsage()
  );
  const [isCloudModalOpen, setIsCloudModalOpen] = useState<boolean>(false);
  const [cloudModelsList, setCloudModelsList] = useState<CloudSavedModel[]>([]);
  const [isSavingToCloud, setIsSavingToCloud] = useState<boolean>(false);
  const [cloudFeedback, setCloudFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Opciones de Asistencia Guiada y Kit de Herramientas IA para ayudar a Gemini a mejorar el resultado 3D
  const [showSidebarGeminiHelpers, setShowSidebarGeminiHelpers] = useState<boolean>(true);
  const [sidebarArchetype, setSidebarArchetype] = useState<string>('auto');
  const [sidebarSymmetry, setSidebarSymmetry] = useState<string>('bilateral_x');
  const [sidebarComplexity, setSidebarComplexity] = useState<'standard' | 'high' | 'ultra'>('high');
  const [sidebarPalette, setSidebarPalette] = useState<string>('auto');
  const [sidebarAutoSmooth, setSidebarAutoSmooth] = useState<boolean>(false);
  const [sidebarUseViewport, setSidebarUseViewport] = useState<boolean>(true);
  const [sidebarAiTools, setSidebarAiTools] = useState<string[]>([
    'use_limbs',
    'use_armor_plates',
    'use_horns_blades',
    'auto_ground',
  ]);
  const [sidebarAutoCritique, setSidebarAutoCritique] = useState<boolean>(true);
  const [sidebarRefImage, setSidebarRefImage] = useState<{ name: string; dataUrl: string } | null>(
    null
  );
  const sidebarSketchInputRef = useRef<HTMLInputElement | null>(null);

  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [isLoadingGlb, setIsLoadingGlb] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [dockCollapsed, setDockCollapsed] = useState(false);
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState(false);
  const [activeTabPanel, setActiveTabPanel] = useState<'tools' | 'lighting' | 'textures' | 'shaders'>('tools');
  const [activeCameraPreset, setActiveCameraPreset] = useState<CameraPresetType>('hero');
  const [zoomPercent, setZoomPercent] = useState<number>(100);
  const lastZoomPctRef = useRef<number>(100);
  const [cyclesCurrentSample, setCyclesCurrentSample] = useState<number>(64);

  // Referencias mutables para sincronizar con el loop de Three.js
  const settingsRef = useRef<PipelineSettings>(DEFAULT_SETTINGS);
  settingsRef.current = settings;
  const brushSettingsRef = useRef<SculptBrushSettings>(brushSettings);
  brushSettingsRef.current = brushSettings;

  // Objetivo de interpolación suave de cámara (Camera Presets)
  const cameraTransitionRef = useRef<{
    active: boolean;
    targetPos: THREE.Vector3;
    targetLookAt: THREE.Vector3;
  }>({
    active: false,
    targetPos: new THREE.Vector3(0, 0.35, 3.55),
    targetLookAt: new THREE.Vector3(0, 0.12, 0),
  });

  const sceneRefs = useRef<{
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    controls: OrbitControls;
    composer: EffectComposer;
    ssaoPass: SSAOPass;
    comicPass: ShaderPass;
    bloomPass: UnrealBloomPass;
    fxaaPass: ShaderPass;
    smaaPass: SMAAPass;
    keyLight: THREE.DirectionalLight;
    headLight: THREE.DirectionalLight;
    hemiLight: THREE.HemisphereLight;
    backLightLeft: THREE.DirectionalLight;
    backLightRight: THREE.DirectionalLight;
    pedestalGroup: THREE.Group;
    gradientTexture: THREE.DataTexture;
    brushIndicator: THREE.Mesh;
    symmetryIndicator: THREE.Mesh;
    triHighlightIndicator: THREE.Group;
    triSymmetryIndicator: THREE.Group;
    vertexHighlightIndicator: THREE.Group;
    vertexSymHighlightIndicator: THREE.Group;
    vertexLineIndicator: THREE.Group;
    vertexLineSymIndicator: THREE.Group;
    currentModelWrapper: THREE.Group | null;
    loadGlbFromFile: (file: File) => void;
    loadProceduralFallback: () => void;
    setCameraViewPreset: (preset: CameraPresetType) => void;
    recalculateStats: () => void;
    captureScreenshot: () => void;
    captureDataUrl: () => string;
    frameModel: (margen?: number) => void;
    zoomByFactor: (factor: number) => void;
    setZoomLevelPercent: (percent: number) => void;
    resetCyclesAccumulation: () => void;
    axesHelperGroup: THREE.Group;
    rebuildAxesGizmo: (mode: BlenderCoordinateMode) => void;
  } | null>(null);

  // Actualizar suavizado de normales cuando cambia el control deslizante
  useEffect(() => {
    const refs = sceneRefs.current;
    if (!refs || !refs.currentModelWrapper) return;
    applyNormalSmoothingToModel(refs.currentModelWrapper, settings.normalSmoothing);
  }, [settings.normalSmoothing]);

  // Actualizar parámetros de shaders, iluminación, MatCap, SSAO, contornos y fondo en tiempo real
  useEffect(() => {
    const refs = sceneRefs.current;
    if (!refs) return;

    // Color de fondo y niebla atmosférica
    const bgCol = new THREE.Color(settings.bgColor);
    refs.scene.background = bgCol;
    if (refs.scene.fog instanceof THREE.FogExp2) {
      refs.scene.fog.color.copy(bgCol);
    }

    // Visibilidad del pedestal / cuadrícula de estudio
    refs.pedestalGroup.visible = settings.showPedestalGrid;

    // Iluminación de estudio ajustable y rebote GI según motor (Cel / EEVEE / Cycles)
    const rad = THREE.MathUtils.degToRad(settings.lightAngle);
    refs.keyLight.position.set(Math.sin(rad) * 4.8, 4.6, Math.cos(rad) * 4.8);
    const isCycles = settings.shadingMode === 'cycles';
    const isEevee = settings.shadingMode === 'eevee';
    refs.keyLight.intensity = isCycles
      ? settings.lightIntensity * 1.22
      : isEevee
      ? settings.lightIntensity * 1.12
      : settings.lightIntensity;
    // En Cycles las sombras proyectadas simulan una luz de área suave (penumbra amplia); en EEVEE son directas
    refs.keyLight.shadow.radius = isCycles ? 4.2 : isEevee ? 1.5 : 1.0;
    refs.headLight.intensity = settings.followCameraLight
      ? isCycles
        ? 0.78
        : isEevee
        ? 1.05
        : 1.15
      : 0.0;
    refs.hemiLight.intensity = isCycles
      ? 1.45 * settings.cyclesGiBounceBoost
      : isEevee
      ? 1.25 * (0.7 + settings.eeveeEnvIntensity * 0.25)
      : 1.25;
    refs.backLightLeft.intensity = isCycles
      ? 1.95 * settings.cyclesGiBounceBoost
      : isEevee
      ? 1.65
      : 1.55;
    refs.backLightRight.intensity = isCycles
      ? 1.55 * settings.cyclesGiBounceBoost
      : isEevee
      ? 1.25
      : 1.15;
    refs.renderer.toneMappingExposure = isCycles
      ? 1.22 + (settings.cyclesGiBounceBoost - 1.0) * 0.22
      : isEevee
      ? 1.28
      : 1.22;

    // Rotación automática
    refs.controls.autoRotate = settings.autoRotate;
    refs.controls.autoRotateSpeed = settings.autoRotateSpeed;

    const matcapTex = getProceduralMatcapTexture(settings.matcapPreset);

    // Actualizar Outline Shader, modo de material (Cel / EEVEE / Cycles / MatCap / Normals / PBR) y Wireframe
    if (refs.currentModelWrapper) {
      refs.currentModelWrapper.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const mesh = child as THREE.Mesh;
          if (mesh.userData.isOutlineMesh) {
            const showOutline =
              (settings.shadingMode === 'cel' || settings.shadingMode === 'matcap') &&
              !settings.wireframe;
            mesh.visible = showOutline;
            const mat = mesh.material as THREE.ShaderMaterial;
            if (mat && mat.uniforms) {
              mat.uniforms.uThickness.value = showOutline ? settings.outlineThickness * 0.013 : 0;
              mat.uniforms.uOpacity.value = showOutline ? settings.outlineOpacity : 0;
            }
          } else {
            const matcapMat = mesh.userData.matcapMaterial as THREE.MeshMatcapMaterial | undefined;
            if (matcapMat) {
              matcapMat.matcap = matcapTex;
              matcapMat.needsUpdate = true;
            }

            const eeveeMat = mesh.userData.eeveeMaterial as THREE.MeshPhysicalMaterial | undefined;
            if (eeveeMat) {
              const baseRough = mesh.userData.baseRoughness ?? 0.36;
              eeveeMat.roughness = THREE.MathUtils.clamp(baseRough * 0.92, 0.03, 1.0);
              eeveeMat.envMapIntensity = settings.eeveeEnvIntensity;
              eeveeMat.needsUpdate = true;
            }

            const cyclesMat = mesh.userData.cyclesMaterial as THREE.MeshPhysicalMaterial | undefined;
            if (cyclesMat) {
              const baseRough = mesh.userData.baseRoughness ?? 0.36;
              const explicitClearcoat = mesh.userData.baseClearcoat as number | undefined;
              cyclesMat.roughness = THREE.MathUtils.clamp(
                baseRough * settings.cyclesRoughnessFactor,
                0.02,
                1.0
              );
              // Si la malla tenía un Coat Weight explícito en Python, respetarlo escalado; si es rugosa (piedra/arena), atenuar barniz
              if (explicitClearcoat !== undefined && explicitClearcoat > 0.01) {
                cyclesMat.clearcoat = THREE.MathUtils.clamp(
                  Math.max(explicitClearcoat, settings.cyclesClearcoat),
                  0.0,
                  1.0
                );
              } else {
                const smoothnessFactor = Math.max(0.0, 1.0 - baseRough * 0.75);
                cyclesMat.clearcoat = THREE.MathUtils.clamp(
                  settings.cyclesClearcoat * smoothnessFactor,
                  0.0,
                  1.0
                );
              }
              cyclesMat.ior = settings.cyclesIor;
              cyclesMat.envMapIntensity = 1.75 * settings.cyclesGiBounceBoost;
              cyclesMat.needsUpdate = true;
            }

            let targetMat: THREE.Material = mesh.userData.toonMaterial;
            if (settings.shadingMode === 'eevee' && mesh.userData.eeveeMaterial) {
              targetMat = mesh.userData.eeveeMaterial;
            } else if (settings.shadingMode === 'cycles' && mesh.userData.cyclesMaterial) {
              targetMat = mesh.userData.cyclesMaterial;
            } else if (settings.shadingMode === 'matcap' && mesh.userData.matcapMaterial) {
              targetMat = mesh.userData.matcapMaterial;
            } else if (settings.shadingMode === 'normals' && mesh.userData.normalDebugMaterial) {
              targetMat = mesh.userData.normalDebugMaterial;
            } else if (settings.shadingMode === 'original' && mesh.userData.originalMaterial) {
              targetMat = Array.isArray(mesh.userData.originalMaterial)
                ? mesh.userData.originalMaterial[0]
                : mesh.userData.originalMaterial;
            }

            if (targetMat) {
              mesh.material = targetMat;
              if ('wireframe' in targetMat) {
                (targetMat as THREE.MeshStandardMaterial).wireframe = settings.wireframe;
              }
            }
          }
        }
      });
    }

    // Actualizar SSAO Pass: En EEVEE y Cycles mantenemos el buffer HDR directo del RenderPass para no perder
    // reflejos físicos IBL, transmisión de cristal ni brillos especulares del UnrealBloomPass
    const effectiveSsao = isCycles
      ? Math.max(settings.ssaoIntensity, 0.95)
      : isEevee
      ? Math.max(settings.ssaoIntensity, 0.75)
      : settings.ssaoIntensity;
    refs.ssaoPass.enabled =
      settings.ssaoIntensity > 0.05 && !settings.wireframe && !isEevee && !isCycles;
    refs.ssaoPass.kernelRadius = THREE.MathUtils.lerp(4, 24, effectiveSsao / 2.5);
    refs.ssaoPass.maxDistance = THREE.MathUtils.lerp(0.04, 0.15, effectiveSsao / 2.5);

    // Actualizar UnrealBloomPass para EEVEE (Bloom en tiempo real de alto rango dinámico) y Cycles (Glare físico sutil)
    if (isEevee && !settings.wireframe) {
      refs.bloomPass.enabled = settings.eeveeBloomIntensity > 0.01;
      refs.bloomPass.strength = settings.eeveeBloomIntensity;
      refs.bloomPass.radius = 0.52;
      refs.bloomPass.threshold = 0.58;
    } else if (isCycles && !settings.wireframe) {
      refs.bloomPass.enabled = true;
      refs.bloomPass.strength = 0.22 * settings.cyclesGiBounceBoost;
      refs.bloomPass.radius = 0.38;
      refs.bloomPass.threshold = 0.72;
    } else {
      refs.bloomPass.enabled = false;
    }

    // Actualizar Comic Edge Post-Processing ShaderPass
    const usePostOutline =
      (settings.shadingMode === 'cel' || settings.shadingMode === 'matcap') &&
      !settings.wireframe;
    refs.comicPass.uniforms.uOutlineThickness.value = usePostOutline
      ? settings.outlineThickness
      : 0.0;
    refs.comicPass.uniforms.uOutlineOpacity.value = usePostOutline
      ? settings.outlineOpacity
      : 0.0;
    refs.comicPass.uniforms.uSsaoBoost.value = effectiveSsao;

    // Alternar filtro Anti-Aliasing (SMAA vs FXAA)
    refs.smaaPass.enabled = settings.aaMode === 'SMAA';
    refs.fxaaPass.enabled = settings.aaMode === 'FXAA';

    // Reiniciar acumulador progresivo de muestras si estamos en Cycles
    refs.resetCyclesAccumulation?.();
  }, [
    settings.outlineThickness,
    settings.outlineOpacity,
    settings.ssaoIntensity,
    settings.bgColor,
    settings.autoRotate,
    settings.autoRotateSpeed,
    settings.aaMode,
    settings.shadingMode,
    settings.matcapPreset,
    settings.wireframe,
    settings.showPedestalGrid,
    settings.lightIntensity,
    settings.lightAngle,
    settings.followCameraLight,
    settings.eeveeBloomIntensity,
    settings.eeveeEnvIntensity,
    settings.cyclesSamples,
    settings.cyclesClearcoat,
    settings.cyclesRoughnessFactor,
    settings.cyclesIor,
    settings.cyclesGiBounceBoost,
    settings.cyclesProgressiveAccum,
  ]);

  // Aplicar textura procedural PBR (Piedra, Madera, Agua, Mármol, Ladrillo, Arena, Metales, etc.) + Mapa de Relieve 3D (Bump)
  useEffect(() => {
    const refs = sceneRefs.current;
    if (!refs || !refs.currentModelWrapper) return;

    const isNone = activeTexture === 'none';
    const presetInfo = getTexturePresetInfo(activeTexture);
    const colorMap = isNone
      ? null
      : generateProceduralTexture(
          activeTexture,
          textureUseNaturalColor ? 'auto' : '#ffffff',
          textureRepeatScale
        );
    const bumpMap = isNone
      ? null
      : generateProceduralBumpTexture(activeTexture, textureRepeatScale);
    const effectiveBumpScale = isNone ? 0 : presetInfo.pbr.bumpScale * textureBumpIntensity;

    refs.currentModelWrapper.traverse((child) => {
      if ((child as THREE.Mesh).isMesh && !child.userData.isOutlineMesh) {
        const mesh = child as THREE.Mesh;
        // Ignorar mallas de agua con ShaderMaterial animado propio
        if ((mesh.material as THREE.Material)?.type === 'ShaderMaterial') return;

        const origHex = (mesh.userData.originalColorHex as string) || '#e11d48';
        const hasPerMeshTex = Boolean(mesh.userData.hasPerMeshTexture && mesh.userData.originalMap);
        const targetColor =
          (!isNone && textureUseNaturalColor) || (isNone && hasPerMeshTex) || Boolean(userColorTexture)
            ? new THREE.Color('#ffffff')
            : new THREE.Color(origHex);
        const mapToUse =
          userColorTexture ?? (isNone ? mesh.userData.originalMap || null : colorMap);
        const bumpMapToUse = isNone ? mesh.userData.originalBumpMap || null : bumpMap;
        const bumpScaleToUse = isNone
          ? (mesh.userData.originalBumpScale as number | undefined) ?? 0
          : effectiveBumpScale;

        const origRough = mesh.userData.baseRoughness ?? 0.36;
        const origMetal = mesh.userData.baseMetalness ?? 0.22;
        const origClearcoat = mesh.userData.baseClearcoat as number | undefined;
        const origIor = mesh.userData.baseIor ?? 1.5;

        const activeRough = isNone ? origRough : presetInfo.pbr.roughness;
        const activeMetal = isNone ? origMetal : presetInfo.pbr.metalness;
        const activeClearcoat = isNone
          ? origClearcoat ?? 0.15
          : presetInfo.pbr.clearcoat;
        const activeIor = isNone ? origIor : presetInfo.pbr.ior;
        const activeTrans = isNone ? 0 : presetInfo.pbr.transmission ?? 0;

        const toonMat = mesh.userData.toonMaterial as THREE.MeshToonMaterial | undefined;
        if (toonMat) {
          toonMat.color.copy(targetColor);
          toonMat.map = mapToUse;
          toonMat.bumpMap = bumpMapToUse;
          toonMat.bumpScale = bumpScaleToUse;
          toonMat.needsUpdate = true;
        }

        const eeveeMat = mesh.userData.eeveeMaterial as THREE.MeshPhysicalMaterial | undefined;
        if (eeveeMat) {
          eeveeMat.color.copy(targetColor);
          eeveeMat.map = mapToUse;
          eeveeMat.bumpMap = bumpMapToUse;
          eeveeMat.bumpScale = bumpScaleToUse;
          eeveeMat.roughness = THREE.MathUtils.clamp(activeRough * 0.92, 0.03, 1.0);
          eeveeMat.metalness = activeMetal;
          eeveeMat.clearcoat = activeClearcoat;
          eeveeMat.ior = activeIor;
          eeveeMat.transmission = activeTrans;
          eeveeMat.transparent = activeTrans > 0.05;
          eeveeMat.opacity = activeTrans > 0.05 ? 1.0 - activeTrans * 0.45 : 1.0;
          eeveeMat.needsUpdate = true;
        }

        const cyclesMat = mesh.userData.cyclesMaterial as THREE.MeshPhysicalMaterial | undefined;
        if (cyclesMat) {
          cyclesMat.color.copy(targetColor);
          cyclesMat.map = mapToUse;
          cyclesMat.bumpMap = bumpMapToUse;
          cyclesMat.bumpScale = bumpScaleToUse * 1.15;
          cyclesMat.roughness = THREE.MathUtils.clamp(
            activeRough * settingsRef.current.cyclesRoughnessFactor,
            0.02,
            1.0
          );
          cyclesMat.metalness = activeMetal;
          cyclesMat.clearcoat = isNone
            ? activeClearcoat
            : Math.max(activeClearcoat, settingsRef.current.cyclesClearcoat * (1.0 - activeRough * 0.7));
          cyclesMat.ior = activeIor;
          cyclesMat.transmission = activeTrans;
          cyclesMat.transparent = activeTrans > 0.05;
          cyclesMat.opacity = activeTrans > 0.05 ? 1.0 - activeTrans * 0.4 : 1.0;
          cyclesMat.needsUpdate = true;
        }

        const stdMat = (
          Array.isArray(mesh.userData.originalMaterial)
            ? mesh.userData.originalMaterial[0]
            : mesh.userData.originalMaterial
        ) as THREE.MeshStandardMaterial | undefined;
        if (stdMat && 'map' in stdMat) {
          stdMat.color.copy(targetColor);
          stdMat.map = mapToUse;
          stdMat.bumpMap = bumpMapToUse;
          stdMat.bumpScale = bumpScaleToUse;
          stdMat.roughness = activeRough;
          stdMat.metalness = activeMetal;
          stdMat.needsUpdate = true;
        }
      }
    });

    refs.resetCyclesAccumulation?.();
  }, [activeTexture, textureRepeatScale, textureBumpIntensity, textureUseNaturalColor, userColorTexture]);

  // Mapa propio de "Mis texturas": proyecta las UV por caja en metros y restaura las originales al quitarlo
  useEffect(() => {
    const refs = sceneRefs.current;
    if (!refs || !refs.currentModelWrapper) return;

    refs.currentModelWrapper.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh || mesh.userData.isOutlineMesh || !mesh.geometry) return;
      if ((mesh.material as THREE.Material)?.type === 'ShaderMaterial') return;
      const geo = mesh.geometry as THREE.BufferGeometry;

      if (userColorTexture) {
        if (!('preMyColorUv' in mesh.userData)) {
          const uvAttr = geo.getAttribute('uv') as THREE.BufferAttribute | undefined;
          mesh.userData.preMyColorUv = uvAttr ? uvAttr.clone() : null;
        }
        mesh.updateMatrix();
        applyBoxProjectedUv(geo, mesh.matrix, userColorTileMeters);
      } else if ('preMyColorUv' in mesh.userData) {
        const prev = mesh.userData.preMyColorUv as THREE.BufferAttribute | null;
        if (prev) geo.setAttribute('uv', prev.clone());
        else geo.deleteAttribute('uv');
        delete mesh.userData.preMyColorUv;
      }
    });

    refs.resetCyclesAccumulation?.();
  }, [userColorTexture, userColorTileMeters]);

  // Actualizar tamaño y color visual de los cursores 3D del pincel (Principal + Espejo X)
  useEffect(() => {
    const refs = sceneRefs.current;
    if (!refs) return;
    const s = brushSettings.radius;
    const col =
      brushSettings.mode === 'paint' || brushSettings.mode === 'tri_paint'
        ? brushSettings.paintColor
        : brushSettings.mode === 'tri_delete'
        ? '#ef4444'
        : brushSettings.mode === 'tri_subdivide'
        ? '#10b981'
        : '#f59e0b';

    refs.brushIndicator.scale.set(s, s, s);
    (refs.brushIndicator.material as THREE.MeshBasicMaterial).color.set(col);

    refs.symmetryIndicator.scale.set(s, s, s);
    (refs.symmetryIndicator.material as THREE.MeshBasicMaterial).color.set('#38bdf8');
  }, [brushSettings.radius, brushSettings.mode, brushSettings.paintColor]);

  // Inicialización principal de Three.js, Iluminación de Estudio, Pinceles y Postprocesado
  useEffect(() => {
    const container = canvasMountRef.current;
    if (!container) return;

    const isSoftwareGl = (() => {
      const probeCanvas = document.createElement('canvas');
      const gl = probeCanvas.getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    // 1. Escena y Cámara (Acercada a Z=3.55 y FOV 38 para que el objeto ocupe el centro con gran claridad)
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(settingsRef.current.bgColor);
    scene.fog = new THREE.FogExp2(settingsRef.current.bgColor, 0.032);

    const camera = new THREE.PerspectiveCamera(38, width / height, 0.015, 160);
    camera.position.set(0, 0.35, 3.55);

    // 2. Renderer WebGL2 con mayor exposición luminosa (1.22)
    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true, // Permite capturar instantáneas PNG limpias
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.22;
    const pixelRatio = isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2);
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.appendChild(renderer.domElement);

    // 3. Iluminación de Estudio de 4 Puntos + Luz de Cámara + RoomEnvironment
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    // Key Light cálida principal
    const keyLight = new THREE.DirectionalLight(0xfffbeb, settingsRef.current.lightIntensity);
    const initRad = THREE.MathUtils.degToRad(settingsRef.current.lightAngle);
    keyLight.position.set(Math.sin(initRad) * 4.8, 4.6, Math.cos(initRad) * 4.8);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.camera.near = 0.5;
    keyLight.shadow.camera.far = 15;
    const d = 2.8;
    keyLight.shadow.camera.left = -d;
    keyLight.shadow.camera.right = d;
    keyLight.shadow.camera.top = d;
    keyLight.shadow.camera.bottom = -d;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    scene.add(keyLight);

    // Luz frontal acoplada a la cámara (Headlight) para iluminar siempre la cara que el usuario está editando
    const headLight = new THREE.DirectionalLight(0xf8fafc, 1.15);
    headLight.position.copy(camera.position);
    scene.add(headLight);

    // Hemisphere Fill más brillante para eliminar sombras empastadas
    const hemiLight = new THREE.HemisphereLight(0xe0f2fe, 0x334155, 1.25);
    scene.add(hemiLight);

    // Contra-luz trasera doble (Rim Lights Cian y Ámbar) para recortar la silueta
    const backLightLeft = new THREE.DirectionalLight(0x38bdf8, 1.55);
    backLightLeft.position.set(-3.5, 2.8, -3.5);
    scene.add(backLightLeft);

    const backLightRight = new THREE.DirectionalLight(0xf59e0b, 1.15);
    backLightRight.position.set(3.5, -1.2, -3.2);
    scene.add(backLightRight);

    // 4. Plataforma / Pedestal de Estudio con Anillo Graduado y Sombra de Contacto
    const pedestalGroup = new THREE.Group();
    scene.add(pedestalGroup);

    const shadowCanvas = document.createElement('canvas');
    shadowCanvas.width = 256;
    shadowCanvas.height = 256;
    const sCtx = shadowCanvas.getContext('2d')!;
    const grad = sCtx.createRadialGradient(128, 128, 12, 128, 128, 122);
    grad.addColorStop(0, 'rgba(0, 0, 0, 0.58)');
    grad.addColorStop(0.55, 'rgba(0, 0, 0, 0.22)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0.0)');
    sCtx.fillStyle = grad;
    sCtx.fillRect(0, 0, 256, 256);

    const contactShadowTex = new THREE.CanvasTexture(shadowCanvas);
    const contactPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(4.2, 4.2),
      new THREE.MeshBasicMaterial({
        map: contactShadowTex,
        transparent: true,
        depthWrite: false,
        opacity: 0.8,
      })
    );
    contactPlane.rotation.x = -Math.PI / 2;
    contactPlane.position.y = -1.35;
    pedestalGroup.add(contactPlane);

    // Anillo técnico de plataforma (Turntable Studio Ring)
    const ringGeo = new THREE.RingGeometry(1.42, 1.46, 64);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x64748b,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
    });
    const turntableRing = new THREE.Mesh(ringGeo, ringMat);
    turntableRing.rotation.x = -Math.PI / 2;
    turntableRing.position.y = -1.345;
    pedestalGroup.add(turntableRing);

    const gridHelper = new THREE.GridHelper(3.6, 12, 0x475569, 0x334155);
    gridHelper.position.y = -1.348;
    (gridHelper.material as THREE.Material).transparent = true;
    (gridHelper.material as THREE.Material).opacity = 0.25;
    pedestalGroup.add(gridHelper);

    // 4b. Gizmo 3D de Ejes de Coordenadas (X / Y / Z) con etiquetas dinámicas para Blender Z-Up vs Estudio Y-Up
    const axesHelperGroup = new THREE.Group();
    axesHelperGroup.position.set(0, -1.34, 0);
    scene.add(axesHelperGroup);

    const makeAxisLabelSprite = (text: string, bgHex: string, borderHex: string) => {
      const c = document.createElement('canvas');
      c.width = 256;
      c.height = 72;
      const ctx = c.getContext('2d')!;
      ctx.fillStyle = bgHex;
      ctx.strokeStyle = borderHex;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.roundRect(6, 6, 244, 60, 14);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 26px ui-monospace, SFMono-Regular, Menlo, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, 128, 36);
      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      const mat = new THREE.SpriteMaterial({
        map: tex,
        transparent: true,
        depthTest: false,
        depthWrite: false,
      });
      const sp = new THREE.Sprite(mat);
      sp.scale.set(0.58, 0.165, 1);
      sp.renderOrder = 999;
      return sp;
    };

    const rebuildAxesGizmo = (mode: BlenderCoordinateMode) => {
      while (axesHelperGroup.children.length > 0) {
        const ch = axesHelperGroup.children[0];
        axesHelperGroup.remove(ch);
      }
      const isZUpVisual = mode === 'blender_z_up' || mode === 'auto';
      const axisLen = 1.65;

      // Eje X (Rojo): siempre Izquierda(-) / Derecha(+)
      const arrowX = new THREE.ArrowHelper(
        new THREE.Vector3(1, 0, 0),
        new THREE.Vector3(0, 0, 0),
        axisLen,
        0xef4444,
        0.16,
        0.09
      );
      axesHelperGroup.add(arrowX);
      const labelX = makeAxisLabelSprite('+X (Ancho)', 'rgba(127,29,29,0.92)', '#ef4444');
      labelX.position.set(axisLen + 0.24, 0.08, 0);
      axesHelperGroup.add(labelX);

      // Eje Vertical (Hacia arriba desde el suelo del pedestal 0.00)
      const upColor = isZUpVisual ? 0x38bdf8 : 0x22c55e;
      const arrowUp = new THREE.ArrowHelper(
        new THREE.Vector3(0, 1, 0),
        new THREE.Vector3(0, 0, 0),
        axisLen + 0.35,
        upColor,
        0.18,
        0.10
      );
      axesHelperGroup.add(arrowUp);
      const labelUp = makeAxisLabelSprite(
        isZUpVisual ? '+Z (Altura Blender)' : '+Y (Altura Estudio)',
        isZUpVisual ? 'rgba(12,74,110,0.92)' : 'rgba(20,83,45,0.92)',
        isZUpVisual ? '#38bdf8' : '#22c55e'
      );
      labelUp.position.set(0, axisLen + 0.52, 0);
      axesHelperGroup.add(labelUp);

      // Eje de Profundidad (Frente / Fondo)
      const depthColor = isZUpVisual ? 0x22c55e : 0x38bdf8;
      const arrowDepth = new THREE.ArrowHelper(
        new THREE.Vector3(0, 0, 1),
        new THREE.Vector3(0, 0, 0),
        axisLen,
        depthColor,
        0.16,
        0.09
      );
      axesHelperGroup.add(arrowDepth);
      const labelDepth = makeAxisLabelSprite(
        isZUpVisual ? '-Y/+Y (Profundidad)' : '+Z (Frente)',
        isZUpVisual ? 'rgba(20,83,45,0.92)' : 'rgba(12,74,110,0.92)',
        isZUpVisual ? '#22c55e' : '#38bdf8'
      );
      labelDepth.position.set(0, 0.08, axisLen + 0.26);
      axesHelperGroup.add(labelDepth);

      // Marcas métricas de altura (0.5, 1.0, 1.5) en el eje vertical para referencia visual exacta
      for (const h of [0.5, 1.0, 1.5]) {
        const tickGeo = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(-0.06, h, 0),
          new THREE.Vector3(0.06, h, 0),
        ]);
        const tickLine = new THREE.Line(
          tickGeo,
          new THREE.LineBasicMaterial({ color: upColor, transparent: true, opacity: 0.75 })
        );
        axesHelperGroup.add(tickLine);
      }
    };

    rebuildAxesGizmo('auto');

    // 5. Anillos indicadores 3D para el Pincel del Ratón y Resaltador 3D de Triángulos (Principal + Simetría X)
    const brushIndicator = createBrushIndicatorMesh();
    scene.add(brushIndicator);

    const symmetryIndicator = createBrushIndicatorMesh();
    (symmetryIndicator.material as THREE.MeshBasicMaterial).color.set('#38bdf8');
    (symmetryIndicator.material as THREE.MeshBasicMaterial).opacity = 0.65;
    scene.add(symmetryIndicator);

    const triHighlightIndicator = createTriangleHighlightMesh(0xf59e0b);
    scene.add(triHighlightIndicator);

    const triSymmetryIndicator = createTriangleHighlightMesh(0x38bdf8);
    scene.add(triSymmetryIndicator);

    const vertexHighlightIndicator = createVertexHighlightMesh(0xa855f7);
    scene.add(vertexHighlightIndicator);

    const vertexSymHighlightIndicator = createVertexHighlightMesh(0x38bdf8);
    scene.add(vertexSymHighlightIndicator);

    const vertexLineIndicator = createVertexLineIndicatorMesh(0x38bdf8);
    scene.add(vertexLineIndicator);

    const vertexLineSymIndicator = createVertexLineIndicatorMesh(0xa855f7);
    scene.add(vertexLineSymIndicator);

    // 6. OrbitControls (con rango de Super-Zoom Macro hasta 0.08u y zoom hacia el cursor)
    const BASE_ZOOM_DISTANCE = 3.55;
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.07;
    controls.autoRotate = settingsRef.current.autoRotate;
    controls.autoRotateSpeed = settingsRef.current.autoRotateSpeed;
    controls.minDistance = 0.08;
    controls.maxDistance = 28.0;
    controls.zoomSpeed = 1.45;
    if ('zoomToCursor' in controls) {
      (controls as OrbitControls & { zoomToCursor: boolean }).zoomToCursor = true;
    }
    controls.target.set(0, 0.12, 0);
    controls.update();

    // Sincronizar porcentaje de Zoom en la interfaz cuando cambia la distancia de cámara
    controls.addEventListener('change', () => {
      const dist = Math.max(0.05, camera.position.distanceTo(controls.target));
      const pct = Math.min(3500, Math.max(12, Math.round((BASE_ZOOM_DISTANCE / dist) * 100)));
      if (Math.abs(pct - lastZoomPctRef.current) >= 2) {
        lastZoomPctRef.current = pct;
        setZoomPercent(pct);
      }
    });

    // Cancelar transición automática de cámara si el usuario orbita manualmente
    let accumSampleCount = 0;
    const resetCyclesAccumulation = () => {
      accumSampleCount = 0;
      setCyclesCurrentSample(1);
    };

    controls.addEventListener('change', () => {
      accumSampleCount = 0;
    });

    controls.addEventListener('start', () => {
      cameraTransitionRef.current.active = false;
      accumSampleCount = 0;
    });

    // 7. Cadena de Postprocesado (EffectComposer) + Acumulador Progresivo Multi-Muestra para Cycles
    const composer = new EffectComposer(renderer);
    const renderPass = new RenderPass(scene, camera);
    composer.addPass(renderPass);

    const ssaoPass = new SSAOPass(scene, camera, width, height);
    ssaoPass.kernelRadius = 14;
    ssaoPass.minDistance = 0.004;
    ssaoPass.maxDistance = 0.11;
    ssaoPass.enabled = !isSoftwareGl && settingsRef.current.ssaoIntensity > 0.02;
    composer.addPass(ssaoPass);

    const comicPass = new ShaderPass(ComicEdgePostShader);
    comicPass.uniforms.uResolution.value.set(width * pixelRatio, height * pixelRatio);
    comicPass.uniforms.uOutlineThickness.value = settingsRef.current.outlineThickness;
    comicPass.uniforms.uOutlineOpacity.value = settingsRef.current.outlineOpacity;
    comicPass.uniforms.uSsaoBoost.value = settingsRef.current.ssaoIntensity;
    composer.addPass(comicPass);

    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(width, height),
      settingsRef.current.eeveeBloomIntensity,
      0.48,
      0.72
    );
    bloomPass.enabled = false;
    composer.addPass(bloomPass);

    const outputPass = new OutputPass();
    composer.addPass(outputPass);

    const fxaaPass = new ShaderPass(FXAAShader);
    fxaaPass.material.uniforms['resolution'].value.set(
      1 / (width * pixelRatio),
      1 / (height * pixelRatio)
    );
    fxaaPass.enabled = settingsRef.current.aaMode === 'FXAA';
    composer.addPass(fxaaPass);

    const smaaPass = new SMAAPass();
    smaaPass.enabled = !isSoftwareGl && settingsRef.current.aaMode === 'SMAA';
    composer.addPass(smaaPass);

    // Textura de Framebuffer y ShaderPass para Acumulación Progresiva (Monte Carlo Jitter) en Cycles
    let accumFramebufferTex = new THREE.FramebufferTexture(
      Math.max(1, Math.floor(width * pixelRatio)),
      Math.max(1, Math.floor(height * pixelRatio))
    );
    accumFramebufferTex.minFilter = THREE.LinearFilter;
    accumFramebufferTex.magFilter = THREE.LinearFilter;

    const cyclesAccumPass = new ShaderPass({
      uniforms: {
        tDiffuse: { value: null },
        tAccum: { value: accumFramebufferTex },
        uWeight: { value: 1.0 },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform sampler2D tDiffuse;
        uniform sampler2D tAccum;
        uniform float uWeight;
        varying vec2 vUv;
        void main() {
          vec4 curr = texture2D(tDiffuse, vUv);
          if (uWeight >= 0.999) {
            gl_FragColor = curr;
          } else if (uWeight <= 0.0001) {
            gl_FragColor = texture2D(tAccum, vUv);
          } else {
            vec4 prev = texture2D(tAccum, vUv);
            gl_FragColor = mix(prev, curr, uWeight);
          }
        }
      `,
    });
    cyclesAccumPass.enabled = false;
    composer.addPass(cyclesAccumPass);

    const gradientTexture = createThreeToneGradientTexture();

    let currentModelWrapper: THREE.Group | null = null;
    let currentMixer: THREE.AnimationMixer | null = null;

    const recalculateStats = () => {
      if (!currentModelWrapper) return;
      let tris = 0;
      let verts = 0;
      let meshCount = 0;
      let hasUndo = false;
      let hasRedo = false;
      currentModelWrapper.traverse((c) => {
        if ((c as THREE.Mesh).isMesh && !c.userData.isOutlineMesh) {
          const m = c as THREE.Mesh;
          meshCount++;
          const g = m.geometry;
          if (g.index) tris += Math.floor(g.index.count / 3);
          else if (g.attributes.position) tris += Math.floor(g.attributes.position.count / 3);
          if (g.attributes.position) verts += g.attributes.position.count;
          if (m.userData.undoStack && m.userData.undoStack.length > 0) {
            hasUndo = true;
          }
          if (m.userData.redoStack && m.userData.redoStack.length > 0) {
            hasRedo = true;
          }
        }
      });
      setCanUndo(hasUndo);
      setCanRedo(hasRedo);
      setModelStats((prev) => ({
        ...prev,
        triangles: tris,
        vertices: verts,
        meshes: meshCount,
      }));
    };

    const clearCurrentModel = () => {
      if (currentMixer) {
        currentMixer.stopAllAction();
        currentMixer = null;
      }
      if (currentModelWrapper) {
        scene.remove(currentModelWrapper);
        currentModelWrapper.traverse((obj) => {
          if ((obj as THREE.Mesh).isMesh) {
            const m = obj as THREE.Mesh;
            m.geometry?.dispose();
            if (Array.isArray(m.material)) {
              m.material.forEach((mat) => mat.dispose());
            } else {
              m.material?.dispose();
            }
          }
        });
        currentModelWrapper = null;
      }
    };

    const setCameraViewPreset = (preset: CameraPresetType) => {
      setActiveCameraPreset(preset);
      const trans = cameraTransitionRef.current;
      trans.active = true;

      if (preset === 'hero') {
        trans.targetPos.set(0.85, 0.45, 3.45);
        trans.targetLookAt.set(0, 0.12, 0);
      } else if (preset === 'front') {
        trans.targetPos.set(0, 0.25, 3.4);
        trans.targetLookAt.set(0, 0.12, 0);
      } else if (preset === 'closeup') {
        // Primer plano al rostro/cabeza y torso superior para esculpir detalles finos
        trans.targetPos.set(0, 0.72, 1.55);
        trans.targetLookAt.set(0, 0.62, 0);
      } else if (preset === 'macro') {
        // Súper Zoom Macro muy cerca del objeto para inspeccionar detalles milimétricos
        trans.targetPos.set(0, 0.52, 0.62);
        trans.targetLookAt.set(0, 0.48, 0);
      } else if (preset === 'side') {
        trans.targetPos.set(3.45, 0.25, 0);
        trans.targetLookAt.set(0, 0.12, 0);
      } else if (preset === 'top') {
        trans.targetPos.set(0, 3.8, 1.1);
        trans.targetLookAt.set(0, 0.0, 0);
      }
    };

    const mountProcessedObject = (
      rawRoot: THREE.Object3D,
      fileName: string,
      isCustom: boolean,
      animations: THREE.AnimationClip[] = []
    ) => {
      clearCurrentModel();

      const { wrapper, triangleCount, vertexCount, meshCount } = setupStylizedEnemyModel(
        rawRoot,
        gradientTexture,
        settingsRef.current.normalSmoothing,
        settingsRef.current.outlineThickness,
        settingsRef.current.outlineOpacity,
        settingsRef.current.matcapPreset
      );

      scene.add(wrapper);
      currentModelWrapper = wrapper;
      if (sceneRefs.current) {
        sceneRefs.current.currentModelWrapper = wrapper;
      }

      if (animations.length > 0) {
        currentMixer = new THREE.AnimationMixer(rawRoot);
        const action = currentMixer.clipAction(animations[0]);
        action.play();
      }

      setCameraViewPreset('hero');
      saveMasterDrawingCheckpoint(wrapper);
      setCanUndo(false);
      setCanRedo(false);
      setDecimateFeedback(null);

      setModelStats({
        name: fileName,
        triangles: triangleCount,
        vertices: vertexCount,
        meshes: meshCount,
        isCustomGlb: isCustom,
      });
    };

    const loadProceduralFallback = () => {
      setLoadError(null);
      const fallbackGroup = createLowPolyEnemyFallback();
      mountProcessedObject(fallbackGroup, 'Golem_Enemigo_LowPoly.glb (Demo)', false);
    };

    const gltfLoader = new GLTFLoader();
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
    gltfLoader.setDRACOLoader(dracoLoader);

    const loadGlbFromFile = (file: File) => {
      setIsLoadingGlb(true);
      setLoadError(null);
      const objectUrl = URL.createObjectURL(file);

      gltfLoader.load(
        objectUrl,
        (gltf) => {
          URL.revokeObjectURL(objectUrl);
          mountProcessedObject(gltf.scene, file.name, true, gltf.animations || []);
          setIsLoadingGlb(false);
        },
        undefined,
        (err) => {
          URL.revokeObjectURL(objectUrl);
          console.error('Error al cargar el archivo GLB:', err);
          setLoadError(
            'No se pudo decodificar el archivo .glb seleccionado. Verifica que sea un glTF 2.0 válido.'
          );
          setIsLoadingGlb(false);
        }
      );
    };

    // Renderiza el frame actual y devuelve la imagen PNG en formato data URL (sin indicadores del pincel)
    const captureDataUrl = (): string => {
      const prevAxesVis = axesHelperGroup.visible;
      axesHelperGroup.visible = false;
      brushIndicator.visible = false;
      symmetryIndicator.visible = false;
      triHighlightIndicator.visible = false;
      triSymmetryIndicator.visible = false;
      vertexHighlightIndicator.visible = false;
      vertexSymHighlightIndicator.visible = false;
      vertexLineIndicator.visible = false;
      vertexLineSymIndicator.visible = false;
      camera.clearViewOffset();
      if (isSoftwareGl) renderer.render(scene, camera);
      else composer.render();
      axesHelperGroup.visible = prevAxesVis;
      return renderer.domElement.toDataURL('image/png');
    };

    const captureScreenshot = () => {
      const dataUrl = captureDataUrl();
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = 'captura_celshade_3d.png';
      link.click();
    };

    // Encuadra todo el modelo: cámara en vista 3/4 a la distancia necesaria para que quepa
    // entero en pantalla (en alto y en ancho). `margen` > 1 aleja la cámara.
    const frameModel = (margen: number = 1.25) => {
      if (!currentModelWrapper) return;
      const box = new THREE.Box3().setFromObject(currentModelWrapper);
      if (box.isEmpty()) return;
      const sphere = box.getBoundingSphere(new THREE.Sphere());
      const vfov = THREE.MathUtils.degToRad(camera.fov);
      const hfov = 2 * Math.atan(Math.tan(vfov / 2) * camera.aspect);
      const distV = sphere.radius / Math.sin(vfov / 2);
      const distH = sphere.radius / Math.sin(hfov / 2);
      const distancia = Math.max(distV, distH) * margen;

      const direccion = new THREE.Vector3(0.85, 0.45, 3.45).normalize();
      const trans = cameraTransitionRef.current;
      trans.active = true;
      trans.targetLookAt.copy(sphere.center);
      trans.targetPos.copy(sphere.center).addScaledVector(direccion, distancia);
    };

    // Acerca (factor < 1) o aleja (factor > 1) suavemente la cámara respecto al punto de enfoque actual
    const zoomByFactor = (factor: number) => {
      const trans = cameraTransitionRef.current;
      const baseTarget = trans.active ? trans.targetLookAt.clone() : controls.target.clone();
      const basePos = trans.active ? trans.targetPos.clone() : camera.position.clone();
      const offset = basePos.clone().sub(baseTarget);
      const currentDist = Math.max(0.05, offset.length());
      const nextDist = THREE.MathUtils.clamp(
        currentDist * factor,
        controls.minDistance,
        controls.maxDistance
      );
      if (offset.lengthSq() < 0.00001) {
        offset.set(0, 0.15, 1);
      }
      offset.normalize().multiplyScalar(nextDist);
      trans.targetLookAt.copy(baseTarget);
      trans.targetPos.copy(baseTarget).add(offset);
      trans.active = true;
      const pct = Math.min(3500, Math.max(12, Math.round((BASE_ZOOM_DISTANCE / nextDist) * 100)));
      lastZoomPctRef.current = pct;
      setZoomPercent(pct);
    };

    // Establece el nivel de zoom exacto en porcentaje (100% = 3.55u, 500% = 0.71u, 1500% = 0.23u, etc.)
    const setZoomLevelPercent = (percent: number) => {
      const clampedPct = THREE.MathUtils.clamp(percent, 15, 2500);
      const targetDist = THREE.MathUtils.clamp(
        BASE_ZOOM_DISTANCE / (clampedPct / 100),
        controls.minDistance,
        controls.maxDistance
      );
      const trans = cameraTransitionRef.current;
      const baseTarget = trans.active ? trans.targetLookAt.clone() : controls.target.clone();
      const basePos = trans.active ? trans.targetPos.clone() : camera.position.clone();
      const dir = basePos.clone().sub(baseTarget);
      if (dir.lengthSq() < 0.00001) {
        dir.set(0, 0.15, 1);
      }
      dir.normalize();
      trans.targetLookAt.copy(baseTarget);
      trans.targetPos.copy(baseTarget).addScaledVector(dir, targetDist);
      trans.active = true;
      lastZoomPctRef.current = Math.round(clampedPct);
      setZoomPercent(Math.round(clampedPct));
    };

    // Raycasting para detección, escultura, edición por triángulos y movimiento/línea de vértices
    const raycaster = new THREE.Raycaster();
    const mouseVec = new THREE.Vector2();
    let isSculptingStroke = false;
    let lastTopologyOpTime = 0;
    let lastTopologyFaceKey = '';

    // Estado activo para Mover Vértice (Pinchar y Mover) y Función Línea de Vértices
    let vertexDragSnapshot: Map<string, Float32Array> | null = null;
    const vertexGrabStartWorld = new THREE.Vector3();
    const vertexGrabPlaneNormal = new THREE.Vector3(0, 0, 1);
    const vertexGrabPlane = new THREE.Plane();
    const vertexDragIntersectPoint = new THREE.Vector3();

    const performSculptAtPointer = (
      e: MouseEvent | PointerEvent,
      isInitialClick: boolean = false
    ) => {
      const currentMode = brushSettingsRef.current.mode;
      if (!currentModelWrapper || currentMode === 'none') {
        brushIndicator.visible = false;
        symmetryIndicator.visible = false;
        triHighlightIndicator.visible = false;
        triSymmetryIndicator.visible = false;
        vertexHighlightIndicator.visible = false;
        vertexSymHighlightIndicator.visible = false;
        vertexLineIndicator.visible = false;
        vertexLineSymIndicator.visible = false;
        return;
      }

      const rect = renderer.domElement.getBoundingClientRect();
      mouseVec.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouseVec.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouseVec, camera);

      const isVertMode = isVertexToolMode(currentMode);

      // Si estamos arrastrando en modo Mover Vértice o Función Línea y ya tenemos una captura inicial:
      if (isVertMode && isSculptingStroke && vertexDragSnapshot) {
        triHighlightIndicator.visible = false;
        triSymmetryIndicator.visible = false;

        if (currentMode === 'vertex_move') {
          // Intersectar el rayo del ratón con el plano que pasa por el vértice seleccionado
          const hitOnPlane = raycaster.ray.intersectPlane(vertexGrabPlane, vertexDragIntersectPoint);
          if (hitOnPlane) {
            applyVertexMoveFromSnapshot(
              currentModelWrapper,
              vertexDragSnapshot,
              vertexGrabStartWorld,
              vertexDragIntersectPoint,
              vertexGrabPlaneNormal,
              brushSettingsRef.current
            );
            applyNormalSmoothingToModel(currentModelWrapper, settingsRef.current.normalSmoothing);

            vertexHighlightIndicator.position.copy(vertexDragIntersectPoint);
            vertexHighlightIndicator.lookAt(camera.position);
            vertexHighlightIndicator.visible = true;

            if (brushSettingsRef.current.vertexMoveSoftRadius) {
              brushIndicator.position.copy(vertexDragIntersectPoint);
              brushIndicator.quaternion.setFromUnitVectors(
                new THREE.Vector3(0, 0, 1),
                vertexGrabPlaneNormal
              );
              brushIndicator.visible = true;
            } else {
              brushIndicator.visible = false;
            }

            if (brushSettingsRef.current.symmetryX && Math.abs(vertexDragIntersectPoint.x) > 0.015) {
              vertexSymHighlightIndicator.position.set(
                -vertexDragIntersectPoint.x,
                vertexDragIntersectPoint.y,
                vertexDragIntersectPoint.z
              );
              vertexSymHighlightIndicator.lookAt(camera.position);
              vertexSymHighlightIndicator.visible = true;
            } else {
              vertexSymHighlightIndicator.visible = false;
            }
          }
          return;
        }

        if (currentMode === 'vertex_line') {
          // Para la Función Línea: buscar el vértice bajo el cursor como extremo B, o proyectar en el plano del vértice A
          const meshes: THREE.Mesh[] = [];
          currentModelWrapper.traverse((c) => {
            if ((c as THREE.Mesh).isMesh && !c.userData.isOutlineMesh) {
              meshes.push(c as THREE.Mesh);
            }
          });
          const intersects = raycaster.intersectObjects(meshes, false);
          const endPointWorld = new THREE.Vector3();
          const combinedPlaneNormal = vertexGrabPlaneNormal.clone();

          if (intersects.length > 0) {
            const hit = intersects[0];
            const nearestV = findNearestVertexOnHit(
              hit.object as THREE.Mesh,
              hit.faceIndex ?? 0,
              hit.point
            );
            if (nearestV) {
              endPointWorld.copy(nearestV.worldPos);
              combinedPlaneNormal.add(nearestV.worldNormal).normalize();
            } else {
              endPointWorld.copy(hit.point);
            }
            // Proyectar el extremo B al mismo plano si el usuario desea coplanaridad estricta con el plano inicial
            if (brushSettingsRef.current.vertexMovePlaneMode === 'surface') {
              const outOfPlane = new THREE.Vector3()
                .subVectors(endPointWorld, vertexGrabStartWorld)
                .dot(vertexGrabPlaneNormal);
              endPointWorld.addScaledVector(vertexGrabPlaneNormal, -outOfPlane * 0.65);
            }
          } else {
            const hitPlane = raycaster.ray.intersectPlane(vertexGrabPlane, vertexDragIntersectPoint);
            if (hitPlane) {
              endPointWorld.copy(vertexDragIntersectPoint);
            } else {
              return;
            }
          }

          updateVertexLineIndicatorMesh(
            vertexLineIndicator,
            vertexGrabStartWorld,
            endPointWorld,
            combinedPlaneNormal,
            brushSettingsRef.current.radius
          );

          if (
            brushSettingsRef.current.symmetryX &&
            (Math.abs(vertexGrabStartWorld.x) > 0.02 || Math.abs(endPointWorld.x) > 0.02)
          ) {
            const symStart = new THREE.Vector3(
              -vertexGrabStartWorld.x,
              vertexGrabStartWorld.y,
              vertexGrabStartWorld.z
            );
            const symEnd = new THREE.Vector3(-endPointWorld.x, endPointWorld.y, endPointWorld.z);
            const symNorm = new THREE.Vector3(
              -combinedPlaneNormal.x,
              combinedPlaneNormal.y,
              combinedPlaneNormal.z
            ).normalize();
            updateVertexLineIndicatorMesh(
              vertexLineSymIndicator,
              symStart,
              symEnd,
              symNorm,
              brushSettingsRef.current.radius
            );
          } else {
            vertexLineSymIndicator.visible = false;
          }

          applyVertexLineAlignmentFromSnapshot(
            currentModelWrapper,
            vertexDragSnapshot,
            vertexGrabStartWorld,
            endPointWorld,
            combinedPlaneNormal,
            brushSettingsRef.current
          );
          applyNormalSmoothingToModel(currentModelWrapper, settingsRef.current.normalSmoothing);
          return;
        }
      }

      const meshes: THREE.Mesh[] = [];
      currentModelWrapper.traverse((c) => {
        if ((c as THREE.Mesh).isMesh && !c.userData.isOutlineMesh) {
          meshes.push(c as THREE.Mesh);
        }
      });

      const intersects = raycaster.intersectObjects(meshes, false);

      if (intersects.length > 0) {
        const hit = intersects[0];
        const hitMesh = hit.object as THREE.Mesh;
        const faceIdx = hit.faceIndex ?? 0;
        lastHoveredTriangleRef.current = { mesh: hitMesh, faceIndex: faceIdx };

        const isTriMode = isTriangleToolMode(currentMode);
        const worldNormal = hit.face
          ? hit.face.normal.clone().transformDirection(hit.object.matrixWorld).normalize()
          : new THREE.Vector3(0, 0, 1);

        if (isVertMode) {
          triHighlightIndicator.visible = false;
          triSymmetryIndicator.visible = false;
          vertexLineIndicator.visible = false;
          vertexLineSymIndicator.visible = false;

          const nearestV = findNearestVertexOnHit(hitMesh, faceIdx, hit.point);
          if (nearestV) {
            vertexHighlightIndicator.position.copy(nearestV.worldPos);
            vertexHighlightIndicator.lookAt(camera.position);
            vertexHighlightIndicator.visible = true;

            if (brushSettingsRef.current.symmetryX && Math.abs(nearestV.worldPos.x) > 0.015) {
              vertexSymHighlightIndicator.position.set(
                -nearestV.worldPos.x,
                nearestV.worldPos.y,
                nearestV.worldPos.z
              );
              vertexSymHighlightIndicator.lookAt(camera.position);
              vertexSymHighlightIndicator.visible = true;
            } else {
              vertexSymHighlightIndicator.visible = false;
            }

            if (
              currentMode === 'vertex_line' ||
              brushSettingsRef.current.vertexMoveSoftRadius === true
            ) {
              brushIndicator.position.copy(nearestV.worldPos);
              brushIndicator.quaternion.setFromUnitVectors(
                new THREE.Vector3(0, 0, 1),
                nearestV.worldNormal
              );
              brushIndicator.visible = true;
              symmetryIndicator.visible = false;
            } else {
              brushIndicator.visible = false;
              symmetryIndicator.visible = false;
            }
          }
          return;
        }

        vertexHighlightIndicator.visible = false;
        vertexSymHighlightIndicator.visible = false;
        vertexLineIndicator.visible = false;
        vertexLineSymIndicator.visible = false;

        if (isTriMode) {
          const triColor =
            currentMode === 'tri_paint'
              ? brushSettingsRef.current.paintColor
              : currentMode === 'tri_delete'
              ? '#ef4444'
              : currentMode === 'tri_subdivide'
              ? '#10b981'
              : '#f59e0b';

          updateTriangleHighlightMesh(triHighlightIndicator, hitMesh, faceIdx, triColor);

          if (brushSettingsRef.current.symmetryX) {
            const mirrorFace = findMirrorTriangleIndex(hitMesh, faceIdx);
            if (mirrorFace !== null) {
              updateTriangleHighlightMesh(triSymmetryIndicator, hitMesh, mirrorFace, '#38bdf8');
            } else {
              triSymmetryIndicator.visible = false;
            }
          } else {
            triSymmetryIndicator.visible = false;
          }

          // Si el usuario activó el modo "Radio Pincel" para triángulos, mostrar también el anillo de radio
          if (brushSettingsRef.current.triSingleFaceMode === false) {
            brushIndicator.position.copy(hit.point);
            brushIndicator.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), worldNormal);
            brushIndicator.visible = true;
            if (brushSettingsRef.current.symmetryX && Math.abs(hit.point.x) > 0.03) {
              symmetryIndicator.position.set(-hit.point.x, hit.point.y, hit.point.z);
              const symNormal = new THREE.Vector3(-worldNormal.x, worldNormal.y, worldNormal.z).normalize();
              symmetryIndicator.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), symNormal);
              symmetryIndicator.visible = true;
            } else {
              symmetryIndicator.visible = false;
            }
          } else {
            brushIndicator.visible = false;
            symmetryIndicator.visible = false;
          }

          if (isSculptingStroke) {
            const isTopologyOp =
              currentMode === 'tri_subdivide' ||
              currentMode === 'tri_extrude' ||
              currentMode === 'tri_delete';

            const now = performance.now();
            const faceKey = `${hitMesh.uuid}_${faceIdx}`;

            // Para operaciones que dividen/extruyen/borran triángulos, ejecutar en el clic inicial
            // o con un pequeño intervalo si se arrastra a otro triángulo distinto
            if (
              !isTopologyOp ||
              isInitialClick ||
              (now - lastTopologyOpTime > 210 && faceKey !== lastTopologyFaceKey)
            ) {
              lastTopologyOpTime = now;
              lastTopologyFaceKey = faceKey;

              const res = applyTriangleToolToMesh(
                hitMesh,
                faceIdx,
                hit.point,
                brushSettingsRef.current,
                e.shiftKey || e.altKey
              );

              if (res.pickedColor) {
                setBrushSettings((prev) => ({ ...prev, paintColor: res.pickedColor! }));
                setTriangleActionFeedback(`Color capturado del triángulo: ${res.pickedColor}`);
              } else if (res.modified) {
                applyNormalSmoothingToModel(currentModelWrapper, settingsRef.current.normalSmoothing);
                if (isTopologyOp) {
                  recalculateStats();
                  updateTriangleHighlightMesh(triHighlightIndicator, hitMesh, 0, triColor);
                }
              }
            }
          }
        } else {
          // Modo Pincel de Vértices clásico
          triHighlightIndicator.visible = false;
          triSymmetryIndicator.visible = false;

          brushIndicator.position.copy(hit.point);
          brushIndicator.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), worldNormal);
          brushIndicator.visible = true;

          // Mostrar indicador espejo si Simetría X está activa
          if (brushSettingsRef.current.symmetryX && Math.abs(hit.point.x) > 0.03) {
            symmetryIndicator.position.set(-hit.point.x, hit.point.y, hit.point.z);
            const symNormal = new THREE.Vector3(-worldNormal.x, worldNormal.y, worldNormal.z).normalize();
            symmetryIndicator.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), symNormal);
            symmetryIndicator.visible = true;
          } else {
            symmetryIndicator.visible = false;
          }

          if (isSculptingStroke) {
            const hitNormal = hit.face ? hit.face.normal : new THREE.Vector3(0, 1, 0);
            const didModify = applySculptBrushToMesh(
              hitMesh,
              hit.point,
              hitNormal,
              brushSettingsRef.current,
              e.shiftKey || e.altKey
            );
            if (didModify) {
              applyNormalSmoothingToModel(currentModelWrapper, settingsRef.current.normalSmoothing);
            }
          }
        }
      } else {
        brushIndicator.visible = false;
        symmetryIndicator.visible = false;
        triHighlightIndicator.visible = false;
        triSymmetryIndicator.visible = false;
        vertexHighlightIndicator.visible = false;
        vertexSymHighlightIndicator.visible = false;
      }
    };

    const handlePointerDown = (e: PointerEvent) => {
      // Solo esculpir/editar con botón izquierdo (e.button === 0) cuando el ratón impacta sobre el modelo.
      // Si el usuario hace clic en el fondo vacío o usa botón derecho/central, OrbitControls rota la cámara con normalidad.
      if (e.button === 0 && brushSettingsRef.current.mode !== 'none' && currentModelWrapper) {
        const rect = renderer.domElement.getBoundingClientRect();
        mouseVec.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        mouseVec.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(mouseVec, camera);

        const meshes: THREE.Mesh[] = [];
        currentModelWrapper.traverse((c) => {
          if ((c as THREE.Mesh).isMesh && !c.userData.isOutlineMesh) {
            meshes.push(c as THREE.Mesh);
          }
        });

        const intersects = raycaster.intersectObjects(meshes, false);
        if (intersects.length > 0) {
          pushUndoSnapshot(currentModelWrapper);
          isSculptingStroke = true;
          controls.enabled = false;

          const currentMode = brushSettingsRef.current.mode;
          if (isVertexToolMode(currentMode)) {
            const hit = intersects[0];
            const nearestV = findNearestVertexOnHit(
              hit.object as THREE.Mesh,
              hit.faceIndex ?? 0,
              hit.point
            );
            vertexDragSnapshot = captureModelPositionsSnapshot(currentModelWrapper);
            if (nearestV) {
              vertexGrabStartWorld.copy(nearestV.worldPos);
              if (brushSettingsRef.current.vertexMovePlaneMode === 'surface') {
                vertexGrabPlaneNormal.copy(nearestV.worldNormal);
              } else {
                camera.getWorldDirection(vertexGrabPlaneNormal).negate().normalize();
              }
            } else {
              vertexGrabStartWorld.copy(hit.point);
              camera.getWorldDirection(vertexGrabPlaneNormal).negate().normalize();
            }
            vertexGrabPlane.setFromNormalAndCoplanarPoint(
              vertexGrabPlaneNormal,
              vertexGrabStartWorld
            );
          }

          performSculptAtPointer(e, true);
        }
      }
    };

    const handlePointerMove = (e: PointerEvent) => {
      performSculptAtPointer(e, false);
    };

    const handlePointerUp = () => {
      if (isSculptingStroke) {
        isSculptingStroke = false;
        lastTopologyFaceKey = '';
        vertexDragSnapshot = null;
        vertexLineIndicator.visible = false;
        vertexLineSymIndicator.visible = false;
        controls.enabled = true;
        recalculateStats();
      }
    };

    // Doble clic sobre cualquier parte del modelo 3D: enfoca ese punto exacto y acerca el zoom automáticamente
    const handleDoubleClick = (e: MouseEvent) => {
      if (!currentModelWrapper) return;
      const rect = renderer.domElement.getBoundingClientRect();
      mouseVec.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouseVec.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouseVec, camera);

      const meshes: THREE.Mesh[] = [];
      currentModelWrapper.traverse((c) => {
        if ((c as THREE.Mesh).isMesh && !c.userData.isOutlineMesh) {
          meshes.push(c as THREE.Mesh);
        }
      });

      const intersects = raycaster.intersectObjects(meshes, false);
      if (intersects.length > 0) {
        const hitPoint = intersects[0].point;
        const currentDist = camera.position.distanceTo(hitPoint);
        const nextDist = THREE.MathUtils.clamp(
           currentDist * 0.48,
          Math.max(controls.minDistance, 0.16),
          controls.maxDistance
        );
        const viewDir = camera.position.clone().sub(hitPoint).normalize();
        const trans = cameraTransitionRef.current;
        trans.targetLookAt.copy(hitPoint);
        trans.targetPos.copy(hitPoint).addScaledVector(viewDir, nextDist);
        trans.active = true;
        const pct = Math.min(3500, Math.max(12, Math.round((BASE_ZOOM_DISTANCE / nextDist) * 100)));
        lastZoomPctRef.current = pct;
        setZoomPercent(pct);
      } else {
        frameModel(1.2);
      }
    };

    renderer.domElement.addEventListener('pointerdown', handlePointerDown);
    renderer.domElement.addEventListener('dblclick', handleDoubleClick);
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    sceneRefs.current = {
      scene,
      camera,
      renderer,
      controls,
      composer,
      ssaoPass,
      comicPass,
      bloomPass,
      fxaaPass,
      smaaPass,
      keyLight,
      headLight,
      hemiLight,
      backLightLeft,
      backLightRight,
      pedestalGroup,
      gradientTexture,
      brushIndicator,
      symmetryIndicator,
      triHighlightIndicator,
      triSymmetryIndicator,
      vertexHighlightIndicator,
      vertexSymHighlightIndicator,
      vertexLineIndicator,
      vertexLineSymIndicator,
      currentModelWrapper,
      loadGlbFromFile,
      loadProceduralFallback,
      setCameraViewPreset,
      recalculateStats,
      captureScreenshot,
      captureDataUrl,
      frameModel,
      zoomByFactor,
      setZoomLevelPercent,
      resetCyclesAccumulation,
      axesHelperGroup,
      rebuildAxesGizmo,
    };

    // API opcional para depurar y capturar el visor desde fuera: solo se activa con ?visor-api=1
    if (new URLSearchParams(window.location.search).has('visor-api')) {
      (window as unknown as { celshadeViewer: unknown }).celshadeViewer = {
        frameModel,
        captureDataUrl,
        setCameraViewPreset,
        // Posición en el mundo de la primera malla cuyo nombre empieza por `prefijo`
        worldPosOf: (prefijo: string): [number, number, number] | null => {
          let found: THREE.Object3D | null = null;
          scene.traverse((o) => {
            if (!found && o.name.startsWith(prefijo)) found = o;
          });
          if (!found) return null;
          const p = new THREE.Vector3();
          (found as THREE.Object3D).getWorldPosition(p);
          return [p.x, p.y, p.z];
        },
        // Coloca la cámara en `pos` mirando a `target` (coordenadas de escena)
        setCameraPose: (pos: [number, number, number], target: [number, number, number]) => {
          const trans = cameraTransitionRef.current;
          trans.active = true;
          trans.targetPos.set(pos[0], pos[1], pos[2]);
          trans.targetLookAt.set(target[0], target[1], target[2]);
        },
      };
    }

    loadProceduralFallback();

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      const pr = renderer.getPixelRatio();

      camera.aspect = w / h;
      camera.updateProjectionMatrix();

      renderer.setSize(w, h);
      composer.setSize(w, h);
      ssaoPass.setSize(w, h);
      bloomPass.setSize(w, h);

      comicPass.uniforms.uResolution.value.set(w * pr, h * pr);
      fxaaPass.material.uniforms['resolution'].value.set(1 / (w * pr), 1 / (h * pr));

      accumFramebufferTex.dispose();
      accumFramebufferTex = new THREE.FramebufferTexture(
        Math.max(1, Math.floor(w * pr)),
        Math.max(1, Math.floor(h * pr))
      );
      accumFramebufferTex.minFilter = THREE.LinearFilter;
      accumFramebufferTex.magFilter = THREE.LinearFilter;
      cyclesAccumPass.uniforms.tAccum.value = accumFramebufferTex;
      accumSampleCount = 0;
    };

    window.addEventListener('resize', handleResize);

    // Secuencia determinista de baja discrepancia Halton (bases 2 y 3) para jitter sub-píxel en Cycles
    const halton = (index: number, base: number): number => {
      let result = 0;
      let f = 1 / base;
      let i = index;
      while (i > 0) {
        result += f * (i % base);
        i = Math.floor(i / base);
        f /= base;
      }
      return result;
    };

    const clock = new THREE.Clock();
    let frameId = 0;

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    function tick() {
      const delta = Math.min(clock.getDelta(), 0.1);
      const curSettings = settingsRef.current;
      const isCyclesAccumActive =
        !isSoftwareGl &&
        curSettings.shadingMode === 'cycles' &&
        curSettings.cyclesProgressiveAccum &&
        !curSettings.wireframe;

      if (currentMixer) {
        currentMixer.update(delta);
      }

      // En modo Cycles con acumulación progresiva estacionaria, pausamos la animación en la muestra > 1
      // para que las gotas de agua o piezas móviles converjan con nitidez fotográfica sin desenfoque de movimiento
      if (!isCyclesAccumActive || accumSampleCount <= 1) {
        tickBlenderAnimations(clock.getElapsedTime());
      }

      // Interpolación suave de presets de cámara (Exponential Damping)
      const camTrans = cameraTransitionRef.current;
      if (camTrans.active) {
        accumSampleCount = 0;
        const step = 1 - Math.exp(-7.5 * delta);
        camera.position.lerp(camTrans.targetPos, step);
        controls.target.lerp(camTrans.targetLookAt, step);
        if (
          camera.position.distanceToSquared(camTrans.targetPos) < 0.0005 &&
          controls.target.distanceToSquared(camTrans.targetLookAt) < 0.0005
        ) {
          camTrans.active = false;
        }
      }

      if (curSettings.autoRotate || isSculptingStroke) {
        accumSampleCount = 0;
      }

      controls.update();

      // Acoplar luz frontal suave a la posición de la cámara para visibilidad total
      headLight.position.copy(camera.position);

      const baseRad = THREE.MathUtils.degToRad(curSettings.lightAngle);
      const baseKeyX = Math.sin(baseRad) * 4.8;
      const baseKeyY = 4.6;
      const baseKeyZ = Math.cos(baseRad) * 4.8;

      if (isSoftwareGl) {
        camera.clearViewOffset();
        keyLight.position.set(baseKeyX, baseKeyY, baseKeyZ);
        renderer.render(scene, camera);
        afterDraw(tick);
      } else if (isCyclesAccumActive) {
        const targetSamples = Math.max(8, curSettings.cyclesSamples);
        cyclesAccumPass.enabled = true;

        // Ocultar cursores 3D mientras acumula muestras para no grabarlos en el buffer de acumulación
        if (accumSampleCount >= 1) {
          brushIndicator.visible = false;
          symmetryIndicator.visible = false;
          triHighlightIndicator.visible = false;
          triSymmetryIndicator.visible = false;
          vertexHighlightIndicator.visible = false;
          vertexSymHighlightIndicator.visible = false;
        }

        if (accumSampleCount < targetSamples) {
          accumSampleCount++;
          const w = renderer.domElement.width || width;
          const h = renderer.domElement.height || height;

          if (accumSampleCount === 1) {
            camera.clearViewOffset();
            keyLight.position.set(baseKeyX, baseKeyY, baseKeyZ);
            cyclesAccumPass.uniforms.uWeight.value = 1.0;
          } else {
            // 1. Sub-píxel Halton camera jitter para Supersampling Anti-Aliasing físico
            const jx = (halton(accumSampleCount, 2) - 0.5) * 0.9;
            const jy = (halton(accumSampleCount, 3) - 0.5) * 0.9;
            camera.setViewOffset(w, h, jx, jy, w, h);

            // 2. Muestreo estocástico del disco solar (Espiral de Vogel) para penumbra de sombra suave real
            const goldenAngle = accumSampleCount * 2.399963229728653;
            const diskRadius = Math.sqrt(accumSampleCount / targetSamples) * 0.62;
            const diskX = Math.cos(goldenAngle) * diskRadius;
            const diskZ = Math.sin(goldenAngle) * diskRadius;
            const diskY = Math.sin(goldenAngle * 0.5) * (diskRadius * 0.35);
            keyLight.position.set(baseKeyX + diskX, baseKeyY + diskY, baseKeyZ + diskZ);

            cyclesAccumPass.uniforms.uWeight.value = 1.0 / accumSampleCount;
          }

          composer.render();
          renderer.copyFramebufferToTexture(accumFramebufferTex);

          if (
            accumSampleCount === 1 ||
            accumSampleCount === targetSamples ||
            accumSampleCount % 4 === 0
          ) {
            setCyclesCurrentSample(accumSampleCount);
          }
        } else {
          // Convergencia alcanzada: mantener la imagen acumulada limpia en pantalla
          camera.clearViewOffset();
          keyLight.position.set(baseKeyX, baseKeyY, baseKeyZ);
          cyclesAccumPass.uniforms.uWeight.value = 0.0;
          composer.render();
        }
        frameId = requestAnimationFrame(tick);
      } else {
        cyclesAccumPass.enabled = false;
        camera.clearViewOffset();
        keyLight.position.set(baseKeyX, baseKeyY, baseKeyZ);
        composer.render();
        frameId = requestAnimationFrame(tick);
      }
    }

    tick();

    return () => {
      renderer.domElement.removeEventListener('pointerdown', handlePointerDown);
      renderer.domElement.removeEventListener('dblclick', handleDoubleClick);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      clearCurrentModel();
      dracoLoader.dispose();
      gradientTexture.dispose();
      contactShadowTex.dispose();
      accumFramebufferTex.dispose();
      renderer.dispose();
      if (renderer.domElement && renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && sceneRefs.current) {
      sceneRefs.current.loadGlbFromFile(file);
    }
    e.target.value = '';
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingFile(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingFile(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingFile(false);

    const file = e.dataTransfer.files?.[0];
    if (file && sceneRefs.current) {
      sceneRefs.current.loadGlbFromFile(file);
    }
  }, []);

  // Deshacer última acción geométrica (Undo - soporta pinceles, Decimate y Subdivide)
  const handleUndo = useCallback(() => {
    const refs = sceneRefs.current;
    if (!refs || !refs.currentModelWrapper) return;
    const undone = popUndoSnapshot(refs.currentModelWrapper, settingsRef.current.normalSmoothing);
    if (undone) {
      setDecimateFeedback('Cambio deshecho: geometría anterior restaurada.');
      refs.recalculateStats();
    }
  }, []);

  // Rehacer última acción geométrica (Redo)
  const handleRedo = useCallback(() => {
    const refs = sceneRefs.current;
    if (!refs || !refs.currentModelWrapper) return;
    const redone = popRedoSnapshot(refs.currentModelWrapper, settingsRef.current.normalSmoothing);
    if (redone) {
      setDecimateFeedback('Cambio rehecho correctamente.');
      refs.recalculateStats();
    }
  }, []);

  // Restaurar / Rehacer el Dibujo Maestro Intacto (recupera el dibujo 100% original antes de Decimate o deformaciones)
  const handleRestoreMasterDrawing = useCallback(async () => {
    const refs = sceneRefs.current;
    if (!refs || !refs.currentModelWrapper) return;

    const restored = restoreMasterDrawingCheckpoint(
      refs.currentModelWrapper,
      settingsRef.current.normalSmoothing
    );
    if (restored) {
      setDecimateFeedback('Dibujo original intacto restaurado al 100%.');
      refs.recalculateStats();
      return;
    }

    // Si además existe código Python generado por Gemini, podemos re-ejecutarlo limpio
    if (lastGeneratedPythonCode) {
      await executeBlenderPythonScript(lastGeneratedPythonCode, refs.currentModelWrapper, {
        onTextureChange: (tex) => setActiveTexture(tex),
        outlineThickness: settingsRef.current.outlineThickness,
        outlineOpacity: settingsRef.current.outlineOpacity,
        normalSmoothing: settingsRef.current.normalSmoothing,
      });
      saveMasterDrawingCheckpoint(refs.currentModelWrapper);
      setDecimateFeedback('Dibujo regenerado desde su código Python original.');
      refs.recalculateStats();
    }
  }, [lastGeneratedPythonCode]);

  // Reducción de polígonos inteligente (Smart Decimate con protección de silueta y detalles)
  const handleApplyDecimate = async () => {
    const refs = sceneRefs.current;
    if (!refs || !refs.currentModelWrapper || isDecimating) return;

    setIsDecimating(true);
    setDecimateFeedback(null);
    try {
      const res = await decimateModelGeometry(refs.currentModelWrapper, decimateRatio, {
        preserveFeatures: preserveDecimateFeatures,
        currentSmoothing: settingsRef.current.normalSmoothing,
      });
      refs.recalculateStats();
      const savedPct =
        res.originalTriangles > 0
          ? Math.round(((res.originalTriangles - res.newTriangles) / res.originalTriangles) * 100)
          : 0;
      setDecimateFeedback(
        `Reducción segura: ${res.originalTriangles.toLocaleString()} → ${res.newTriangles.toLocaleString()} triángulos (-${savedPct}%). ${
          res.protectedMeshes > 0
            ? `${res.protectedMeshes} piezas finas protegidas.`
            : 'Silueta preservada.'
        }`
      );
    } catch (err) {
      console.error('Error al decimar geometría:', err);
    } finally {
      setIsDecimating(false);
    }
  };

  // Suavizado Laplaciano Global (Redondeo Global con 1 Clic)
  const handleGlobalLaplacian = () => {
    const refs = sceneRefs.current;
    if (!refs || !refs.currentModelWrapper) return;
    applyGlobalLaplacianSmoothing(refs.currentModelWrapper, 4, 0.55);
    applyNormalSmoothingToModel(refs.currentModelWrapper, settings.normalSmoothing);
    refs.recalculateStats();
  };

  // Subdividir + Redondear (Aumentar densidad orgánica)
  const handleSubdivideAndSmooth = () => {
    const refs = sceneRefs.current;
    if (!refs || !refs.currentModelWrapper) return;
    subdivideAndSmoothModel(refs.currentModelWrapper);
    applyNormalSmoothingToModel(refs.currentModelWrapper, settings.normalSmoothing);
    refs.recalculateStats();
  };

  // Aumentar segmentos de triángulos globalmente en todo el modelo (1->4, 1->9 o 1->3 Poke)
  const handleGlobalTriangleSegmentation = (mode: TriangleSubdivideMode) => {
    const refs = sceneRefs.current;
    if (!refs || !refs.currentModelWrapper) return;
    const res = segmentAllModelTriangles(
      refs.currentModelWrapper,
      mode,
      settingsRef.current.normalSmoothing
    );
    refs.recalculateStats();
    const label =
      mode === 'poke'
        ? 'Poke 1→3'
        : mode === 2
        ? 'Subdivisión 1→4 (2 seg)'
        : mode === 3
        ? 'Segmentación 1→9 (3 seg)'
        : 'Segmentación 1→16 (4 seg)';
    setTriangleActionFeedback(
      `${label}: ${res.beforeTriangles.toLocaleString()} → ${res.afterTriangles.toLocaleString()} triángulos.`
    );
  };

  // Bote de Pintura por Triángulos (Rellena la pieza apuntada o todos los triángulos del mismo color)
  const handleFloodFillTriangles = (onlySimilarColor: boolean) => {
    const refs = sceneRefs.current;
    if (!refs || !refs.currentModelWrapper) return;

    let targetMesh = lastHoveredTriangleRef.current.mesh;
    let seedFace = Math.max(0, lastHoveredTriangleRef.current.faceIndex);

    if (!targetMesh) {
      refs.currentModelWrapper.traverse((c) => {
        if (!targetMesh && (c as THREE.Mesh).isMesh && !c.userData.isOutlineMesh) {
          targetMesh = c as THREE.Mesh;
        }
      });
    }
    if (!targetMesh) return;

    pushUndoSnapshot(refs.currentModelWrapper);
    const painted = floodFillMeshTriangles(
      targetMesh,
      seedFace,
      brushSettings.paintColor,
      onlySimilarColor
    );
    refs.recalculateStats();
    setTriangleActionFeedback(
      onlySimilarColor
        ? `${painted} triángulos de color similar pintados.`
        : `Pieza rellenada (${painted} triángulos pintados).`
    );
  };

  // Aplica (o quita, con null) una textura de "Mis texturas" como mapa de color del modelo actual
  const handleApplyUserTexture = async (info: ColorMapTextureInfo | null) => {
    if (!info) {
      setUserColorTextureInfo(null);
      setUserColorTexture(null);
      return;
    }
    await preloadColorMapImages();
    const tex = getColorMapThreeTexture(info.id);
    if (!tex) {
      setCloudFeedback({ type: 'error', text: `No se pudo cargar la textura "${info.name}"` });
      setTimeout(() => setCloudFeedback(null), 5000);
      return;
    }
    setUserColorTextureInfo(info);
    setUserColorTexture(tex);
  };

  // Exportar el modelo modificado a archivo .GLB binario (con modo Ligero, Ultra-Ligero o Estándar)
  const handleExportGlb = async (overrideMode?: GlbExportPresetMode) => {
    const refs = sceneRefs.current;
    if (!refs || !refs.currentModelWrapper || isExporting) return;

    const targetMode = overrideMode ?? glbExportMode;
    setIsExporting(true);
    setCloudFeedback(null);
    try {
      const rawName = (modelStats.name || 'Modelo_3D')
        .replace(/\s*\([^)]*\)\s*/g, '')
        .replace(/\.[^/.]+$/, '')
        .replace(/[^a-zA-Z0-9_-]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .trim();
      const cleanName = rawName || 'Modelo_3D';
      const suffix =
        targetMode === 'ultra_light'
          ? 'ultraligero'
          : targetMode === 'light'
          ? 'ligero'
          : 'completo';
      const stats = await exportModifiedGlb(
        refs.currentModelWrapper,
        `${cleanName}_${suffix}.glb`,
        { mode: targetMode }
      );
      setLastExportStats(stats);
      const vertSavedPct =
        stats.verticesBefore > 0
          ? Math.max(
              0,
              Math.round(((stats.verticesBefore - stats.verticesAfter) / stats.verticesBefore) * 100)
            )
          : 0;
      setCloudFeedback({
        type: 'success',
        text: `GLB ${suffix.toUpperCase()} exportado con éxito: ${stats.sizeFormatted} (${stats.verticesAfter.toLocaleString()} vértices indexados, -${vertSavedPct}% peso • ${stats.meshesAfter} grupos)`,
      });
      setTimeout(() => setCloudFeedback(null), 5000);
    } catch (err: unknown) {
      console.error('Error al exportar GLB:', err);
      const errMsg = err instanceof Error ? err.message : String(err);
      setCloudFeedback({
        type: 'error',
        text: `Error al exportar el archivo .GLB: ${errMsg}`,
      });
      setTimeout(() => setCloudFeedback(null), 5000);
    } finally {
      setIsExporting(false);
    }
  };

  // Ejecución de Scripts Python estilo Blender 5.2
  const handleRunPythonScript = async (
    code: string,
    customModelLabel?: string,
    coordOverride?: BlenderCoordinateMode
  ): Promise<ScriptExecutionResult> => {
    const refs = sceneRefs.current;
    if (!refs || !refs.currentModelWrapper) {
      return {
        success: false,
        logs: ['Error: No hay modelo 3D activo para modificar.'],
        executionTimeMs: 0,
        verticesModified: 0,
        error: 'No active model',
      };
    }

    const effectiveCoordMode = coordOverride ?? coordinateMode;
    pushUndoSnapshot(refs.currentModelWrapper);
    let activeShadingMode: ShadingModeType = settingsRef.current.shadingMode;
    const result = await executeBlenderPythonScript(code, refs.currentModelWrapper, {
      onTextureChange: (tex) => setActiveTexture(tex),
      onTextureSettingsChange: (opts) => {
        if (opts.repeatScale !== undefined) setTextureRepeatScale(opts.repeatScale);
        if (opts.bumpIntensity !== undefined) setTextureBumpIntensity(opts.bumpIntensity);
        if (opts.useNaturalColor !== undefined) setTextureUseNaturalColor(opts.useNaturalColor);
      },
      onRenderEngineChange: (eng) => {
        activeShadingMode = eng;
        settingsRef.current = { ...settingsRef.current, shadingMode: eng, wireframe: false };
        setSettings((prev) => ({ ...prev, shadingMode: eng, wireframe: false }));
      },
      onRenderSettingsChange: (partial) => {
        settingsRef.current = { ...settingsRef.current, ...partial };
        setSettings((prev) => ({ ...prev, ...partial }));
      },
      onCameraPresetChange: (preset) => {
        refs.setCameraViewPreset(preset);
      },
      onZoomChange: (percent) => {
        refs.setZoomLevelPercent(percent);
      },
      onFrameModel: (margin) => {
        refs.frameModel(margin);
      },
      outlineThickness: settingsRef.current.outlineThickness,
      outlineOpacity: settingsRef.current.outlineOpacity,
      normalSmoothing: settingsRef.current.normalSmoothing,
      coordinateMode: effectiveCoordMode,
    });

    // Sincronizar el modo de sombreado activo (Cel, EEVEE, Cycles, MatCap, Normales, Original) y Wireframe en las nuevas mallas
    const matcapTex = getProceduralMatcapTexture(settingsRef.current.matcapPreset);
    refs.currentModelWrapper.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        if (mesh.userData.isOutlineMesh) {
          const showOutline =
            (activeShadingMode === 'cel' || activeShadingMode === 'matcap') &&
            !settingsRef.current.wireframe;
          mesh.visible = showOutline;
          const mat = mesh.material as THREE.ShaderMaterial;
          if (mat && mat.uniforms) {
            mat.uniforms.uThickness.value = showOutline
              ? settingsRef.current.outlineThickness * 0.013
              : 0;
            mat.uniforms.uOpacity.value = showOutline ? settingsRef.current.outlineOpacity : 0;
          }
        } else {
          const matcapMat = mesh.userData.matcapMaterial as THREE.MeshMatcapMaterial | undefined;
          if (matcapMat) {
            matcapMat.matcap = matcapTex;
            matcapMat.needsUpdate = true;
          }
          let targetMat: THREE.Material = mesh.userData.toonMaterial || (mesh.material as THREE.Material);
          if (activeShadingMode === 'eevee' && mesh.userData.eeveeMaterial) {
            targetMat = mesh.userData.eeveeMaterial;
          } else if (activeShadingMode === 'cycles' && mesh.userData.cyclesMaterial) {
            targetMat = mesh.userData.cyclesMaterial;
          } else if (activeShadingMode === 'matcap' && mesh.userData.matcapMaterial) {
            targetMat = mesh.userData.matcapMaterial;
          } else if (activeShadingMode === 'normals' && mesh.userData.normalDebugMaterial) {
            targetMat = mesh.userData.normalDebugMaterial;
          } else if (activeShadingMode === 'original' && mesh.userData.originalMaterial) {
            targetMat = Array.isArray(mesh.userData.originalMaterial)
              ? mesh.userData.originalMaterial[0]
              : mesh.userData.originalMaterial;
          }
          if (targetMat) {
            mesh.material = targetMat;
            if ('wireframe' in targetMat) {
              (targetMat as THREE.MeshStandardMaterial).wireframe = settingsRef.current.wireframe;
            }
          }
        }
      }
    });

    let activeMeshCount = 0;
    refs.currentModelWrapper.traverse((child) => {
      if ((child as THREE.Mesh).isMesh && !child.userData.isOutlineMesh) {
        activeMeshCount++;
      }
    });

    if (!result.success) {
      // Si el script falló con error de sintaxis o ejecución, restaurar el checkpoint o undo para no perder el trabajo previo
      const restored = restoreMasterDrawingCheckpoint(
        refs.currentModelWrapper,
        settingsRef.current.normalSmoothing
      );
      if (!restored) {
        popUndoSnapshot(refs.currentModelWrapper, settingsRef.current.normalSmoothing);
      }
    } else if (activeMeshCount === 0) {
      // El usuario ejecutó un script válido que limpió la escena (ej. bpy.ops.object.delete()) para empezar desde 0
      setModelStats({
        triangles: 0,
        vertices: 0,
        meshes: 0,
        name: 'Lienzo_Vacio_Desde_0.py',
        isCustomGlb: false,
      });
      setDecimateFeedback(null);
    } else if (result.objectsCreated && result.objectsCreated > 0) {
      if (customModelLabel) {
        setModelStats((prev) => ({ ...prev, name: `${customModelLabel} (Python bpy)` }));
      } else if (code.includes('bpy.ops.object.delete()')) {
        setModelStats((prev) => ({ ...prev, name: 'Objeto_Procedural_Python.glb' }));
      }
      // Guardar copia maestra intacta del nuevo dibujo generado para poder restaurarlo siempre
      saveMasterDrawingCheckpoint(refs.currentModelWrapper);
      setDecimateFeedback(null);
      refs.setCameraViewPreset('hero');
    }

    refs.recalculateStats();
    return result;
  };

  // Vacía por completo la escena 3D actual para empezar desde 0 (guardando antes en Deshacer por seguridad)
  const handleClearSceneFromZero = useCallback(() => {
    const refs = sceneRefs.current;
    if (!refs?.currentModelWrapper) return;
    pushUndoSnapshot(refs.currentModelWrapper);

    const toRemove: THREE.Object3D[] = [];
    refs.currentModelWrapper.traverse((child) => {
      if (child !== refs.currentModelWrapper && (child as THREE.Mesh).isMesh) {
        toRemove.push(child);
      }
    });
    toRemove.forEach((m) => {
      if (m.parent) m.parent.remove(m);
      const mesh = m as THREE.Mesh;
      mesh.geometry?.dispose?.();
    });
    while (refs.currentModelWrapper.children.length > 0) {
      refs.currentModelWrapper.remove(refs.currentModelWrapper.children[0]);
    }
    const cleanRootGroup = new THREE.Group();
    cleanRootGroup.name = 'Blender_Scene_Root';
    cleanRootGroup.position.set(0, -1.35, 0);
    refs.currentModelWrapper.add(cleanRootGroup);

    setLastGeneratedPythonCode('');
    setDecimateFeedback(null);
    setModelStats({
      triangles: 0,
      vertices: 0,
      meshes: 0,
      name: 'Lienzo_Vacio_Desde_0.py',
      isCustomGlb: false,
    });
    refs.recalculateStats();
  }, [pushUndoSnapshot]);

  // Capturar instantánea del visor 3D actual en base64 para que Gemini vea la pose/forma actual
  const getViewportSnapshot = useCallback((): string | null => {
    const refs = sceneRefs.current;
    if (!refs) return null;
    try {
      return refs.renderer.domElement.toDataURL('image/jpeg', 0.8);
    } catch {
      return null;
    }
  }, []);

  // Calcular dimensiones exactas (Bounding Box) del modelo 3D activo relativas al suelo del pedestal (Y=0.00)
  const getSceneBounds = useCallback((): SceneBoundsData | undefined => {
    const refs = sceneRefs.current;
    if (!refs || !refs.currentModelWrapper) return undefined;
    const box = new THREE.Box3().setFromObject(refs.currentModelWrapper);
    if (box.isEmpty()) return undefined;
    const size = new THREE.Vector3();
    box.getSize(size);
    let meshCount = 0;
    refs.currentModelWrapper.traverse((c) => {
      if ((c as THREE.Mesh).isMesh && !c.userData.isOutlineMesh) meshCount++;
    });
    if (meshCount === 0) return undefined;
    // El suelo del pedestal en world space está en Y = -1.35. Sumamos +1.35 para enviar a Gemini
    // la altura exacta donde 0.00 es el suelo del pedestal.
    const PEDESTAL_WORLD_Y = -1.35;
    return {
      minX: Number(box.min.x.toFixed(2)),
      maxX: Number(box.max.x.toFixed(2)),
      minY: Number((box.min.y - PEDESTAL_WORLD_Y).toFixed(2)),
      maxY: Number((box.max.y - PEDESTAL_WORLD_Y).toFixed(2)),
      minZ: Number(box.min.z.toFixed(2)),
      maxZ: Number(box.max.z.toFixed(2)),
      widthX: Number(size.x.toFixed(2)),
      depthZ: Number(size.z.toFixed(2)),
      meshCount,
    };
  }, []);

  // Cambiar rápidamente la representación de ejes (Z-Up Blender / Y-Up Estudio / Auto) y re-orientar si hay script activo
  const handleQuickCoordinateModeChange = useCallback(
    async (nextMode: BlenderCoordinateMode) => {
      setCoordinateMode(nextMode);
      const refs = sceneRefs.current;
      if (refs) {
        refs.rebuildAxesGizmo(nextMode);
      }
      if (lastGeneratedPythonCode && lastGeneratedPythonCode.trim()) {
        const stripped = lastGeneratedPythonCode.replace(/^#\s*COORD_MODE:\s*(Z_UP|Y_UP)\s*\n?/im, '');
        const updatedCode =
          nextMode === 'blender_z_up'
            ? `# COORD_MODE: Z_UP\n${stripped}`
            : nextMode === 'studio_y_up'
            ? `# COORD_MODE: Y_UP\n${stripped}`
            : stripped;
        setLastGeneratedPythonCode(updatedCode);
        await handleRunPythonScript(updatedCode, undefined, nextMode);
      }
    },
    [lastGeneratedPythonCode]
  );

  // Intercambiar en vivo los ejes Y ↔ Z de todas las piezas del modelo 3D actual y apoyarlo sobre el pedestal
  const handleSwapSceneAxesYZ = useCallback(() => {
    const refs = sceneRefs.current;
    if (!refs || !refs.currentModelWrapper) return;
    pushUndoSnapshot(refs.currentModelWrapper);

    const targetRoot = refs.currentModelWrapper.children[0] || refs.currentModelWrapper;
    targetRoot.traverse((child) => {
      if ((child as THREE.Mesh).isMesh && !child.userData.isOutlineMesh) {
        const mesh = child as THREE.Mesh;
        // 1. Intercambiar posición del objeto (x, y, z) -> (x, z, -y)
        const py = mesh.position.y;
        const pz = mesh.position.z;
        mesh.position.set(mesh.position.x, pz, -py);

        // 2. Intercambiar coordenadas de los vértices en BufferGeometry
        const pos = mesh.geometry?.attributes?.position as THREE.BufferAttribute | undefined;
        if (pos) {
          for (let i = 0; i < pos.count; i++) {
            const vy = pos.getY(i);
            const vz = pos.getZ(i);
            pos.setY(i, vz);
            pos.setZ(i, -vy);
          }
          pos.needsUpdate = true;
          mesh.geometry.computeVertexNormals();
          mesh.geometry.computeBoundingBox();
          mesh.geometry.computeBoundingSphere();
          mesh.userData.basePositions = new Float32Array(pos.array as ArrayLike<number>);
          if (mesh.geometry.attributes.normal) {
            mesh.userData.smoothNormals = new Float32Array(
              mesh.geometry.attributes.normal.array as ArrayLike<number>
            );
          }
        }
      }
    });

    // Asentar automáticamente la base del modelo sobre el suelo del pedestal (world Y = -1.35)
    refs.currentModelWrapper.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(refs.currentModelWrapper);
    if (!box.isEmpty()) {
      const dy = -1.35 - box.min.y;
      targetRoot.position.y += dy;
    }
    setDecimateFeedback('📐 Ejes Y ↔ Z intercambiados en vivo y modelo asentado en el pedestal.');
    refs.resetCyclesAccumulation?.();
    refs.recalculateStats();
  }, [pushUndoSnapshot]);

  // Rotar el modelo 3D completo 90° en X o en Y y re-asentarlo sobre el pedestal
  const handleRotateSceneModel90 = useCallback(
    (axis: 'x' | 'y') => {
      const refs = sceneRefs.current;
      if (!refs || !refs.currentModelWrapper) return;
      pushUndoSnapshot(refs.currentModelWrapper);

      const targetRoot = refs.currentModelWrapper.children[0] || refs.currentModelWrapper;
      const angle = Math.PI / 2;
      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);

      targetRoot.traverse((child) => {
        if ((child as THREE.Mesh).isMesh && !child.userData.isOutlineMesh) {
          const mesh = child as THREE.Mesh;
          if (axis === 'x') {
            const py = mesh.position.y;
            const pz = mesh.position.z;
            mesh.position.set(mesh.position.x, py * cosA - pz * sinA, py * sinA + pz * cosA);
          } else {
            const px = mesh.position.x;
            const pz = mesh.position.z;
            mesh.position.set(px * cosA + pz * sinA, mesh.position.y, -px * sinA + pz * cosA);
          }

          const pos = mesh.geometry?.attributes?.position as THREE.BufferAttribute | undefined;
          if (pos) {
            for (let i = 0; i < pos.count; i++) {
              const vx = pos.getX(i);
              const vy = pos.getY(i);
              const vz = pos.getZ(i);
              if (axis === 'x') {
                pos.setY(i, vy * cosA - vz * sinA);
                pos.setZ(i, vy * sinA + vz * cosA);
              } else {
                pos.setX(i, vx * cosA + vz * sinA);
                pos.setZ(i, -vx * sinA + vz * cosA);
              }
            }
            pos.needsUpdate = true;
            mesh.geometry.computeVertexNormals();
            mesh.geometry.computeBoundingBox();
            mesh.geometry.computeBoundingSphere();
            mesh.userData.basePositions = new Float32Array(pos.array as ArrayLike<number>);
          }
        }
      });

      refs.currentModelWrapper.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(refs.currentModelWrapper);
      if (!box.isEmpty()) {
        const dy = -1.35 - box.min.y;
        targetRoot.position.y += dy;
      }
      setDecimateFeedback(`📐 Modelo rotado 90° en eje ${axis.toUpperCase()} y apoyado sobre el pedestal.`);
      refs.resetCyclesAccumulation?.();
      refs.recalculateStats();
    },
    [pushUndoSnapshot]
  );

  const handleSidebarSketchUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setSidebarRefImage({ name: file.name, dataUrl: reader.result });
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Sincronizar estado de Autenticación con Google y cargar modelos guardados (Nube + Local)
  useEffect(() => {
    const unsubscribe = onAuthUserChanged((user) => {
      setCurrentUser(user);
      getUserSavedModels()
        .then((models) => setCloudModelsList(models || []))
        .catch(() => {});
    });
    return () => unsubscribe();
  }, []);

  const handleGoogleSignIn = async () => {
    setIsAuthLoading(true);
    setCloudFeedback(null);
    try {
      const user = await signInWithGoogle();
      setCurrentUser(user);
      const models = await getUserSavedModels();
      setCloudModelsList(models || []);
      setCloudFeedback({
        type: 'success',
        text: `¡Bienvenido, ${user.displayName || 'Escultor 3D'}! Sesión activa.`,
      });
      setTimeout(() => setCloudFeedback(null), 3500);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setCloudFeedback({
        type: 'error',
        text: `Aviso de sesión: ${msg}`,
      });
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleSignOut = async () => {
    await signOutUser();
    setCurrentUser(null);
    const localModels = await getUserSavedModels();
    setCloudModelsList(localModels || []);
    setCloudFeedback({
      type: 'success',
      text: 'Sesión cerrada correctamente.',
    });
    setTimeout(() => setCloudFeedback(null), 3000);
  };

  const loadCloudModelsList = async () => {
    try {
      const models = await getUserSavedModels();
      setCloudModelsList(models || []);
    } catch {
      // ignorar errores de red
    }
  };

  const handleQuickSaveToCloud = async () => {

    setIsSavingToCloud(true);
    setCloudFeedback(null);
    try {
      const codeToSave =
        lastGeneratedPythonCode ||
        `# Modelo: ${modelStats.name}\n# Vértices: ${modelStats.vertices}\nimport bpy\n# Guardado en Cloud`;

      await saveModelToCloud({
        title: modelStats.name.replace(/\.[^/.]+$/, ''),
        summary: `Modelo con ${modelStats.triangles} triángulos y sombreado ${settings.shadingMode}`,
        pythonCode: codeToSave,
        triangles: modelStats.triangles,
        vertices: modelStats.vertices,
        normalSmoothing: settings.normalSmoothing,
        shadingMode: settings.shadingMode,
      });

      const updated = await getUserSavedModels();
      setCloudModelsList(updated || []);
      setCloudFeedback({
        type: 'success',
        text: '¡Modelo 3D guardado exitosamente en tu nube de Google!',
      });
      setTimeout(() => setCloudFeedback(null), 4000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setCloudFeedback({
        type: 'error',
        text: `Error al guardar en la nube: ${msg}`,
      });
    } finally {
      setIsSavingToCloud(false);
    }
  };

  const handleLoadCloudModel = async (model: CloudSavedModel) => {
    setLastGeneratedPythonCode(model.pythonCode);
    if (model.normalSmoothing !== undefined) {
      setSettings((prev) => ({ ...prev, normalSmoothing: model.normalSmoothing || 0.92 }));
    }
    const res = await handleRunPythonScript(model.pythonCode, model.title);
    if (res.success) {
      setIsCloudModalOpen(false);
      setCloudFeedback({
        type: 'success',
        text: `Modelo "${model.title}" cargado desde la nube.`,
      });
      setTimeout(() => setCloudFeedback(null), 3500);
    }
  };

  const handleDeleteCloudModel = async (modelId: string) => {
    try {
      await deleteSavedModel(modelId);
      setCloudModelsList((prev) => prev.filter((m) => m.id !== modelId));
    } catch (err) {
      console.error('Error al borrar modelo:', err);
    }
  };

  // Evolución del pensamiento en vivo durante la generación desde la barra lateral
  useEffect(() => {
    if (!isSidebarGeminiLoading) {
      setSidebarLivePhaseIndex(0);
      setSidebarElapsedSeconds(0);
      return;
    }
    const phases = LIVE_THOUGHT_PHASES[selectedThinkingLevel] || LIVE_THOUGHT_PHASES.MEDIUM;
    const timer = window.setInterval(() => {
      setSidebarElapsedSeconds((prev) => prev + 1);
      setSidebarLivePhaseIndex((prev) => (prev < phases.length - 1 ? prev + 1 : prev));
    }, 1500);
    return () => clearInterval(timer);
  }, [isSidebarGeminiLoading, selectedThinkingLevel]);

  // Complemento Gemini AI -> Python (bpy) directo desde la barra lateral con Asistente de Dibujo 3D
  const handleSidebarGeminiGenerate = async (overridePrompt?: string, overrideMode?: 'replace' | 'append' | 'refine') => {
    const promptText = (overridePrompt ?? sidebarGeminiPrompt).trim();
    if ((!promptText && !sidebarRefImage) || isSidebarGeminiLoading) return;

    // Si el usuario ha pegado directamente un script Python de Blender 5.2 en la barra lateral, ejecutarlo en local (0 llamadas API)
    if (isLikelyBlenderPythonCode(promptText)) {
      const cleaned = stripMarkdownCodeFences(promptText);
      setLastGeneratedPythonCode(cleaned);
      setSidebarGeminiPrompt('');
      const execResult = await handleRunPythonScript(cleaned, 'Script Blender 5.2 Pegado');
      if (execResult.success) {
        setSidebarGeminiStatus({
          type: 'success',
          text: `Código Python de Blender 5.2 ejecutado directamente (${execResult.objectsCreated || 0} piezas 3D • 0 llamadas API).`,
        });
      } else {
        setSidebarGeminiStatus({
          type: 'error',
          text: `Error en script Python: ${execResult.error}`,
        });
      }
      return;
    }

    const effectiveMode = overrideMode ?? sidebarGeminiMode;
    setIsSidebarGeminiLoading(true);
    setSidebarGeminiStatus(null);
    setSidebarThoughtSteps([]);

    try {
      const viewportSnap =
        (sidebarUseViewport || effectiveMode === 'append' || effectiveMode === 'refine')
          ? getViewportSnapshot()
          : null;
      const bounds = getSceneBounds();

      const response = await fetch('/api/gemini/bpy-generator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt:
            promptText ||
            'Reconstruye en 3D mediante primitivas Python (bpy) la figura mostrada en la imagen de referencia.',
          mode: effectiveMode,
          currentCode: lastGeneratedPythonCode || '',
          referenceImageBase64: sidebarRefImage?.dataUrl || undefined,
          viewportImageBase64: viewportSnap || undefined,
          selectedModel: selectedGeminiModel,
          thinkingLevel: selectedThinkingLevel,
          userEmail: currentUser?.email || undefined,
          helpers: {
            archetype: sidebarArchetype,
            symmetry: sidebarSymmetry,
            complexity: sidebarComplexity,
            palette: sidebarPalette,
            autoSmooth: sidebarAutoSmooth,
            autoTexture: 'none',
            aiTools: sidebarAiTools,
            autoCritique: sidebarAutoCritique || effectiveMode === 'refine',
            coordinateMode,
            sceneBounds: bounds,
          },
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
        throw new Error(data.error || 'Error al generar el script Python con Gemini.');
      }

      setLastGeneratedPythonCode(data.pythonCode);
      if (data.thoughtEvolution && data.thoughtEvolution.length > 0) {
        setSidebarThoughtSteps(data.thoughtEvolution);
      }

      const updatedStats = recordGeminiUsage(
        data.modelUsed || selectedGeminiModel,
        data.usage?.totalTokens || 0,
        data.usage?.thoughtsTokens || 0
      );
      setWeeklyUsageStats(updatedStats);

      const execResult = await handleRunPythonScript(data.pythonCode, data.title);

      if (execResult.success) {
        setSidebarGeminiStatus({
          type: 'success',
          text: `[${data.modelUsed || selectedGeminiModel} • ${data.thinkingLevelUsed || selectedThinkingLevel}] ${data.title}: ${data.summary}${data.fallbackNotice ? ` — (${data.fallbackNotice})` : ''}`,
        });
      } else {
        setSidebarGeminiStatus({
          type: 'error',
          text: `Error al ejecutar script: ${execResult.error}`,
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setSidebarGeminiStatus({
        type: 'error',
        text: msg,
      });
    } finally {
      setIsSidebarGeminiLoading(false);
    }
  };

  // Atajos de teclado: H para Modo Zen, Ctrl+Z para Deshacer, Ctrl+Y / Ctrl+Shift+Z para Rehacer y Ctrl+V global para scripts Python
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') {
        return;
      }
      if (e.key.toLowerCase() === 'h') {
        setDockCollapsed((prev) => !prev);
      } else if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        sceneRefs.current?.zoomByFactor(0.74);
      } else if (e.key === '-' || e.key === '_') {
        e.preventDefault();
        sceneRefs.current?.zoomByFactor(1.35);
      } else if (e.key === '0') {
        e.preventDefault();
        sceneRefs.current?.frameModel(1.2);
      } else if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        handleRedo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        handleUndo();
      }
    };

    const onGlobalPaste = (e: ClipboardEvent) => {
      const activeTag = document.activeElement?.tagName;
      if (activeTag === 'INPUT' || activeTag === 'TEXTAREA') {
        return;
      }
      const pasted = e.clipboardData?.getData('text/plain') || '';
      if (isLikelyBlenderPythonCode(pasted)) {
        e.preventDefault();
        const cleaned = stripMarkdownCodeFences(pasted);
        setLastGeneratedPythonCode(cleaned);
        void handleRunPythonScript(cleaned, 'Script Blender 5.2 (Ctrl+V)').then((res) => {
          if (res.success) {
            setSidebarGeminiStatus({
              type: 'success',
              text: `Script Blender 5.2 pegado con Ctrl+V y construido en 3D (${res.objectsCreated || 0} objetos • 0 llamadas API).`,
            });
          } else {
            setSidebarGeminiStatus({
              type: 'error',
              text: `Error al ejecutar script pegado: ${res.error}`,
            });
          }
        });
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('paste', onGlobalPaste);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('paste', onGlobalPaste);
    };
  }, [handleUndo, handleRedo]);

  return (
    <div
      className="relative flex flex-col w-screen h-screen overflow-hidden select-none bg-[#1e2536] text-slate-100"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Lienzo 3D WebGL (100% Viewport) */}
      <div ref={canvasMountRef} className="absolute inset-0 w-full h-full cursor-crosshair" />

      <input
        ref={fileInputRef}
        type="file"
        accept=".glb,.gltf"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Cabecera Superior Minimalista (3 Zonas limpias según contrato) */}
      <header className="relative z-10 shrink-0 flex items-center justify-between gap-4 px-6 py-2.5 bg-slate-950/90 border-b border-slate-800/90">
        {/* Zona 1: Marca (1 solo elemento de texto) */}
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            sceneRefs.current?.setCameraViewPreset('hero');
          }}
          className="text-base font-bold tracking-tight text-white whitespace-nowrap shrink-0"
        >
          CelShade Studio 3D
        </a>

        {/* Zona 2: Motores de Render (CelShade, EEVEE, Cycles) y Modos de Visualización */}
        <nav className="hidden md:flex items-center gap-4 text-xs font-medium text-slate-300">
          <button
            type="button"
            onClick={() => setSettings((prev) => ({ ...prev, shadingMode: 'cel', wireframe: false }))}
            className={`transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              settings.shadingMode === 'cel'
                ? 'text-amber-400 underline underline-offset-4 font-semibold'
                : 'hover:text-white'
            }`}
          >
            Cel-Shading 3T
          </button>
          <button
            type="button"
            onClick={() => setSettings((prev) => ({ ...prev, shadingMode: 'eevee', wireframe: false }))}
            title="Motor Blender EEVEE Next: PBR en tiempo real con Resplandor Bloom, Sombras Suaves y Reflejos HDRI"
            className={`flex items-center gap-1 px-2 py-1 rounded-md border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              settings.shadingMode === 'eevee'
                ? 'bg-sky-500/20 border-sky-400 text-sky-300 font-semibold'
                : 'bg-slate-900/80 border-slate-800 text-sky-300/90 hover:text-white hover:border-sky-400/50'
            }`}
          >
            <Zap className="w-3.5 h-3.5 text-sky-400" />
            <span>EEVEE</span>
          </button>
          <button
            type="button"
            onClick={() => setSettings((prev) => ({ ...prev, shadingMode: 'cycles', wireframe: false }))}
            title="Motor Blender Cycles: Sombreado físico Raytrace PBR con Clearcoat, IOR, Sheen y Rebotes GI"
            className={`flex items-center gap-1 px-2 py-1 rounded-md border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              settings.shadingMode === 'cycles'
                ? 'bg-amber-400/20 border-amber-400 text-amber-300 font-semibold'
                : 'bg-slate-900/80 border-slate-800 text-amber-300/90 hover:text-white hover:border-amber-400/50'
            }`}
          >
            <Gem className="w-3.5 h-3.5 text-amber-400" />
            <span>Cycles</span>
          </button>
          <button
            type="button"
            onClick={() => setSettings((prev) => ({ ...prev, shadingMode: 'matcap', wireframe: false }))}
            className={`transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              settings.shadingMode === 'matcap'
                ? 'text-amber-400 underline underline-offset-4 font-semibold'
                : 'hover:text-white'
            }`}
          >
            Arcilla (MatCap)
          </button>
          <button
            type="button"
            onClick={() => setSettings((prev) => ({ ...prev, shadingMode: 'normals', wireframe: false }))}
            className={`transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              settings.shadingMode === 'normals'
                ? 'text-amber-400 underline underline-offset-4 font-semibold'
                : 'hover:text-white'
            }`}
          >
            Normales RGB
          </button>
          <button
            type="button"
            onClick={() => setSettings((prev) => ({ ...prev, shadingMode: 'original', normalSmoothing: 0.0 }))}
            className={`transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              settings.shadingMode === 'original'
                ? 'text-amber-400 underline underline-offset-4 font-semibold'
                : 'hover:text-white'
            }`}
          >
            Malla Base
          </button>
          <button
            type="button"
            onClick={() => setIsPythonModalOpen(true)}
            className="text-amber-300 hover:text-amber-200 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Consola Python (bpy)
          </button>
        </nav>

        {/* Zona 3: Acción Primaria & Autenticación Google */}
        <div className="flex items-center gap-2.5 shrink-0">
          {currentUser ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  loadCloudModelsList();
                  setIsCloudModalOpen(true);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-amber-300 bg-slate-900 hover:bg-slate-800 border border-amber-400/40 rounded-lg transition-colors cursor-pointer"
                title="Abrir tus modelos 3D guardados en la nube"
              >
                <Cloud className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden sm:inline">Mis Modelos</span>
                {cloudModelsList.length > 0 && (
                  <span className="px-1.5 py-0.2 text-[10px] bg-amber-400 text-slate-950 font-bold rounded-full">
                    {cloudModelsList.length}
                  </span>
                )}
              </button>

              <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-xs">
                {currentUser.photoURL ? (
                  <img
                    src={currentUser.photoURL}
                    alt={currentUser.displayName || 'Usuario'}
                    className="w-5 h-5 rounded-full object-cover border border-amber-400"
                  />
                ) : (
                  <UserIcon className="w-4 h-4 text-amber-400" />
                )}
                <span className="text-slate-200 font-medium max-w-[110px] truncate hidden md:inline">
                  {currentUser.displayName || currentUser.email?.split('@')[0]}
                </span>
                <button
                  type="button"
                  onClick={handleSignOut}
                  title="Cerrar sesión"
                  className="text-slate-400 hover:text-red-400 transition-colors cursor-pointer ml-1"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={isAuthLoading}
              className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 border border-slate-700 hover:border-amber-400/60 rounded-lg transition-colors cursor-pointer shadow-sm"
              title="Inicia sesión con tu cuenta de Google para guardar tus modelos en la nube"
            >
              <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
              </svg>
              <span>{isAuthLoading ? 'Conectando...' : 'Acceder con Google'}</span>
            </button>
          )}

          <button
            type="button"
            disabled={isExporting}
            onClick={() => void handleExportGlb('light')}
            title="Exporta un archivo .GLB súper ligero (geometría indexada, atributos internos eliminados y mallas unidas por material)"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-300 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-400/50 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5 text-emerald-400" />
            <span>{isExporting ? 'Exportando...' : '⚡ GLB Ligero'}</span>
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-slate-950 bg-amber-400 rounded-lg hover:bg-amber-300 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Cargar Archivo .GLB</span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (rightPanelCollapsed || dockCollapsed) {
                setRightPanelCollapsed(false);
                setDockCollapsed(false);
              } else {
                setRightPanelCollapsed(true);
              }
            }}
            title={
              rightPanelCollapsed || dockCollapsed
                ? 'Mostrar el menú lateral derecho de Render, Luz, Texturas y Herramientas'
                : 'Ocultar el menú lateral derecho para despejar la vista y las opciones superiores'
            }
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              rightPanelCollapsed || dockCollapsed
                ? 'bg-amber-400/20 border-amber-400/60 text-amber-300 hover:bg-amber-400/30'
                : 'bg-slate-900 border-slate-700 text-slate-200 hover:bg-slate-800 hover:text-white'
            }`}
          >
            {rightPanelCollapsed || dockCollapsed ? (
              <>
                <PanelRightOpen className="w-3.5 h-3.5 text-amber-400" />
                <span>Mostrar Menú Render</span>
              </>
            ) : (
              <>
                <PanelRightClose className="w-3.5 h-3.5 text-amber-400" />
                <span>Ocultar Menú Derecha</span>
              </>
            )}
          </button>
        </div>
      </header>

      {/* Barra de Herramientas de Escultura, Simetría y Encuadres de Cámara */}
      <div className="relative z-10 shrink-0 px-6 pt-2.5 flex flex-wrap items-center justify-between gap-2.5 text-xs pointer-events-none">
        {/* Grupo Izquierdo: Pinceles de Ratón + Simetría + Deshacer */}
        <div className="flex flex-wrap items-center gap-1.5 p-1.5 bg-slate-950/90 border border-slate-800 rounded-xl pointer-events-auto shadow-xl">
          <button
            type="button"
            onClick={() => setBrushSettings((prev) => ({ ...prev, mode: 'none' }))}
            title="Rotar y hacer zoom libremente con el ratón"
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              brushSettings.mode === 'none'
                ? 'bg-amber-400 text-slate-950 font-semibold'
                : 'text-slate-300 hover:text-white hover:bg-slate-900'
            }`}
          >
            <MousePointer className="w-3.5 h-3.5" />
            <span>Orbitar</span>
          </button>

          <button
            type="button"
            onClick={() => setBrushSettings((prev) => ({ ...prev, mode: 'smooth' }))}
            title="Redondea y suaviza aristas poligonales al arrastrar sobre el objeto"
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              brushSettings.mode === 'smooth'
                ? 'bg-amber-400 text-slate-950 font-semibold'
                : 'text-slate-300 hover:text-white hover:bg-slate-900'
            }`}
          >
            <CircleDot className="w-3.5 h-3.5" />
            <span>Redondear</span>
          </button>

          <button
            type="button"
            onClick={() => setBrushSettings((prev) => ({ ...prev, mode: 'inflate' }))}
            title="Infla volumen hacia afuera (Mantén Shift para hundir)"
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              brushSettings.mode === 'inflate'
                ? 'bg-amber-400 text-slate-950 font-semibold'
                : 'text-slate-300 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Wand2 className="w-3.5 h-3.5" />
            <span>Inflar</span>
          </button>

          <button
            type="button"
            onClick={() => setBrushSettings((prev) => ({ ...prev, mode: 'crease' }))}
            title="Talla hendiduras, cicatrices y pliegues marcados"
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              brushSettings.mode === 'crease'
                ? 'bg-amber-400 text-slate-950 font-semibold'
                : 'text-slate-300 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Flame className="w-3.5 h-3.5" />
            <span>Hendidura</span>
          </button>

          <button
            type="button"
            onClick={() => setBrushSettings((prev) => ({ ...prev, mode: 'pinch' }))}
            title="Pellizca y afila crestas o cuernos"
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              brushSettings.mode === 'pinch'
                ? 'bg-amber-400 text-slate-950 font-semibold'
                : 'text-slate-300 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Minimize2 className="w-3.5 h-3.5" />
            <span>Afilar</span>
          </button>

          <button
            type="button"
            onClick={() => setBrushSettings((prev) => ({ ...prev, mode: 'flatten' }))}
            title="Aplana superficies para crear placas de armadura"
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              brushSettings.mode === 'flatten'
                ? 'bg-amber-400 text-slate-950 font-semibold'
                : 'text-slate-300 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Grid3X3 className="w-3.5 h-3.5" />
            <span>Aplanar</span>
          </button>

          <button
            type="button"
            onClick={() => setBrushSettings((prev) => ({ ...prev, mode: 'paint' }))}
            title="Pinta colores suaves por vértice sobre el modelo"
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              brushSettings.mode === 'paint'
                ? 'bg-amber-400 text-slate-950 font-semibold'
                : 'text-slate-300 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Paintbrush className="w-3.5 h-3.5" />
            <span>Pintar Vértices</span>
          </button>

          {/* Separador: Herramientas de Edición y Pintura por Triángulos */}
          <div className="flex flex-wrap items-center gap-1 pl-2 border-l border-slate-800">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-400/90 px-1 hidden xl:inline">
              Triángulos:
            </span>
            <button
              type="button"
              onClick={() => setBrushSettings((prev) => ({ ...prev, mode: 'tri_paint' }))}
              title="Pintar por Triángulos con bordes nítidos (Shift + Clic para capturar color)"
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                brushSettings.mode === 'tri_paint'
                  ? 'bg-amber-400 text-slate-950 font-semibold'
                  : 'bg-slate-900/90 text-amber-300 hover:text-white hover:bg-slate-800 border border-amber-400/30'
              }`}
            >
              <Triangle className="w-3.5 h-3.5" />
              <span>Pintar Triángulo</span>
            </button>

            <button
              type="button"
              onClick={() => setBrushSettings((prev) => ({ ...prev, mode: 'tri_subdivide' }))}
              title="Aumentar Triángulos / Segmentar: haz clic sobre un triángulo para dividirlo en 4, 9, 16 o 3 segmentos"
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                brushSettings.mode === 'tri_subdivide'
                  ? 'bg-emerald-400 text-slate-950 font-semibold'
                  : 'bg-slate-900/90 text-emerald-300 hover:text-white hover:bg-slate-800 border border-emerald-400/30'
              }`}
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>+ Segmentar Tri</span>
            </button>

            <button
              type="button"
              onClick={() => setBrushSettings((prev) => ({ ...prev, mode: 'tri_extrude' }))}
              title="Extruir Triángulo en 3D hacia afuera (Shift + Clic para extruir hacia adentro)"
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                brushSettings.mode === 'tri_extrude'
                  ? 'bg-sky-400 text-slate-950 font-semibold'
                  : 'bg-slate-900/90 text-sky-300 hover:text-white hover:bg-slate-800 border border-sky-400/30'
              }`}
            >
              <Box className="w-3.5 h-3.5" />
              <span>Extruir Tri</span>
            </button>

            <button
              type="button"
              onClick={() => setBrushSettings((prev) => ({ ...prev, mode: 'tri_push' }))}
              title="Empujar o tirar de un triángulo a lo largo de su normal (Shift para hundir)"
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                brushSettings.mode === 'tri_push'
                  ? 'bg-amber-400 text-slate-950 font-semibold'
                  : 'text-slate-300 hover:text-white hover:bg-slate-900'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Empujar Cara</span>
            </button>

            <button
              type="button"
              onClick={() => setBrushSettings((prev) => ({ ...prev, mode: 'tri_delete' }))}
              title="Eliminar el triángulo seleccionado al hacer clic"
              className={`flex items-center gap-1 px-2 py-1.5 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                brushSettings.mode === 'tri_delete'
                  ? 'bg-red-500 text-white font-semibold'
                  : 'text-red-300 hover:text-white hover:bg-red-950/60'
              }`}
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="hidden 2xl:inline">Borrar Tri</span>
            </button>

            <button
              type="button"
              onClick={() => setBrushSettings((prev) => ({ ...prev, mode: 'vertex_move' }))}
              title="Mover Vértices: pincha un vértice y arrástralo para moverlo junto a los vértices cercanos en el mismo plano"
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                brushSettings.mode === 'vertex_move'
                  ? 'bg-purple-500 text-white font-semibold'
                  : 'bg-slate-900/90 text-purple-300 hover:text-white hover:bg-slate-800 border border-purple-400/35'
              }`}
            >
              <Move className="w-3.5 h-3.5" />
              <span>Mover Vértice</span>
            </button>

            <button
              type="button"
              onClick={() => setBrushSettings((prev) => ({ ...prev, mode: 'vertex_line' }))}
              title="Función Línea: traza una línea entre dos vértices y los vértices más cercanos se mueven hacia la línea en el mismo plano"
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                brushSettings.mode === 'vertex_line'
                  ? 'bg-cyan-400 text-slate-950 font-semibold'
                  : 'bg-slate-900/90 text-cyan-300 hover:text-white hover:bg-slate-800 border border-cyan-400/35'
              }`}
            >
              <GitCommitHorizontal className="w-3.5 h-3.5" />
              <span>Línea Vértices</span>
            </button>
          </div>

          {/* Separador: Simetría X y Deshacer */}
          <div className="flex items-center gap-1.5 pl-2 border-l border-slate-800">
            <button
              type="button"
              onClick={() =>
                setBrushSettings((prev) => ({ ...prev, symmetryX: !prev.symmetryX }))
              }
              title="Simetría en Espejo X: esculpe ambos lados del enemigo simultáneamente"
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                brushSettings.symmetryX
                  ? 'bg-sky-500/20 border border-sky-400/50 text-sky-300 font-semibold'
                  : 'bg-slate-900 text-slate-400 hover:text-white'
              }`}
            >
              <FlipHorizontal className="w-3.5 h-3.5" />
              <span>Simetría X</span>
            </button>

            <button
              type="button"
              disabled={!canUndo}
              onClick={handleUndo}
              title="Deshacer última pincelada, Decimate o deformación (Ctrl + Z)"
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 disabled:opacity-40 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Undo2 className="w-3.5 h-3.5" />
              <span>Deshacer</span>
            </button>

            <button
              type="button"
              disabled={!canRedo}
              onClick={handleRedo}
              title="Rehacer último cambio deshecho (Ctrl + Y)"
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 disabled:opacity-40 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Redo2 className="w-3.5 h-3.5" />
              <span>Rehacer</span>
            </button>

            <button
              type="button"
              onClick={handleRestoreMasterDrawing}
              title="Restaurar el dibujo 3D completo a su estado original intacto antes de reducciones o deformaciones"
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-400/15 hover:bg-amber-400/25 border border-amber-400/40 text-amber-300 font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden xl:inline">Restaurar Dibujo</span>
            </button>

            <button
              type="button"
              onClick={handleClearSceneFromZero}
              title="Borrar todo el objeto 3D actual y dejar el lienzo vacío para empezar desde 0 (puedes deshacer con Ctrl+Z)"
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/40 text-rose-300 font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="hidden xl:inline">Desde 0</span>
            </button>
          </div>

          {/* Separador: MENÚ RÁPIDO DE EJES 3D (Z-Up Blender vs Y-Up Estudio + Invertir Y↔Z + Gizmo) */}
          <div className="flex flex-wrap items-center gap-1 pl-2 border-l border-slate-800">
            <span
              className="text-[10px] font-semibold uppercase tracking-wider text-amber-400 px-1"
              title="Sistema de representación de ejes para Gemini y Python (Z-Up de Blender vs Y-Up de Estudio WebGL)"
            >
              📐 Ejes:
            </span>
            <div className="flex items-center bg-slate-900 p-0.5 rounded-lg border border-slate-700/80">
              <button
                type="button"
                onClick={() => void handleQuickCoordinateModeChange('blender_z_up')}
                title="Eje Z Arriba (Blender 5.2 Estándar): X=Ancho, Y=Profundidad, Z=Altura Vertical"
                className={`px-2 py-1 rounded-md text-[11px] font-semibold transition-colors cursor-pointer ${
                  coordinateMode === 'blender_z_up'
                    ? 'bg-amber-400 text-slate-950'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                Z-Up
              </button>
              <button
                type="button"
                onClick={() => void handleQuickCoordinateModeChange('studio_y_up')}
                title="Eje Y Arriba (Estudio WebGL): X=Ancho, Y=Altura Vertical, Z=Profundidad"
                className={`px-2 py-1 rounded-md text-[11px] font-semibold transition-colors cursor-pointer ${
                  coordinateMode === 'studio_y_up'
                    ? 'bg-sky-400 text-slate-950'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                Y-Up
              </button>
              <button
                type="button"
                onClick={() => void handleQuickCoordinateModeChange('auto')}
                title="Detección automática de ejes Z-Up / Y-Up"
                className={`px-2 py-1 rounded-md text-[11px] font-semibold transition-colors cursor-pointer ${
                  coordinateMode === 'auto'
                    ? 'bg-emerald-400 text-slate-950'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                Auto
              </button>
            </div>

            <button
              type="button"
              onClick={handleSwapSceneAxesYZ}
              title="Intercambiar inmediatamente los ejes Y ↔ Z de todos los puntos del modelo 3D actual y apoyarlo sobre el pedestal"
              className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-400/40 text-indigo-300 font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <span>🔄 Y↔Z</span>
            </button>

            <button
              type="button"
              onClick={() => handleRotateSceneModel90('x')}
              title="Rotar el modelo 90° en el eje X (enderezar modelo tumbado) y asentar en pedestal"
              className="px-2 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              ↻ X 90°
            </button>

            <button
              type="button"
              onClick={() => handleRotateSceneModel90('y')}
              title="Rotar el modelo 90° horizontalmente alrededor de la vertical"
              className="px-2 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              ↻ Y 90°
            </button>

            <button
              type="button"
              onClick={() => {
                setShowAxesGizmo((prev) => {
                  const next = !prev;
                  if (sceneRefs.current?.axesHelperGroup) {
                    sceneRefs.current.axesHelperGroup.visible = next;
                  }
                  return next;
                });
              }}
              title="Mostrar u ocultar las flechas y etiquetas de los ejes X, Y, Z sobre el pedestal 3D"
              className={`px-2 py-1.5 rounded-lg border text-[11px] font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                showAxesGizmo
                  ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-300'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              {showAxesGizmo ? 'Ejes Visibles' : 'Ver Ejes'}
            </button>
          </div>
        </div>

        {/* Grupo Derecho: Controles de Zoom Progresivo + Vistas Rápidas de Cámara */}
        <div className="flex flex-wrap items-center gap-2 p-1.5 bg-slate-950/90 border border-slate-800 rounded-xl pointer-events-auto shadow-xl">
          {/* Control de Zoom Directo (Botones +/-, Barra Deslizante y Porcentaje) */}
          <div className="flex items-center gap-1 pr-2 border-r border-slate-800">
            <button
              type="button"
              onClick={() => sceneRefs.current?.zoomByFactor(1.35)}
              title="Alejar cámara (Tecla - o rueda del ratón)"
              className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white transition-colors cursor-pointer"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>

            <input
              type="range"
              min={30}
              max={1500}
              step={10}
              value={Math.min(1500, Math.max(30, zoomPercent))}
              onChange={(e) => sceneRefs.current?.setZoomLevelPercent(parseFloat(e.target.value))}
              title="Desliza hacia la derecha para acercarte al máximo al objeto (Súper Zoom Macro)"
              className="w-20 sm:w-24 accent-amber-400 cursor-pointer"
            />

            <button
              type="button"
              onClick={() => sceneRefs.current?.zoomByFactor(0.72)}
              title="Acercar cámara al objeto (Tecla + o doble clic sobre una pieza del modelo)"
              className="p-1.5 rounded-lg bg-amber-400/20 hover:bg-amber-400/35 border border-amber-400/40 text-amber-300 transition-colors cursor-pointer"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={() => sceneRefs.current?.setZoomLevelPercent(100)}
              title="Clic para restablecer el zoom al 100% (Doble clic sobre el modelo 3D para enfocar una zona concreta)"
              className="px-1.5 py-1 rounded bg-slate-900 hover:bg-slate-800 font-mono tabular-nums text-[11px] text-amber-400 min-w-[46px] text-center cursor-pointer"
            >
              {zoomPercent}%
            </button>
          </div>

          <span className="px-1 text-[11px] font-medium text-slate-400 whitespace-nowrap hidden sm:inline">
            Encuadre:
          </span>
          {(
            [
              { id: 'hero', label: '3/4 Estudio' },
              { id: 'front', label: 'Frontal' },
              { id: 'closeup', label: 'Rostro' },
              { id: 'macro', label: '🔍 Súper Zoom' },
              { id: 'side', label: 'Perfil' },
            ] as const
          ).map((cam) => (
            <button
              key={cam.id}
              type="button"
              onClick={() => sceneRefs.current?.setCameraViewPreset(cam.id)}
              className={`px-2 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeCameraPreset === cam.id
                  ? 'bg-slate-800 text-amber-400 font-semibold border border-slate-700'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              {cam.label}
            </button>
          ))}
        </div>
      </div>

      {/* Sub-barra de Parámetros del Pincel / Edición por Triángulos Activa + Estadísticas Limpias */}
      <div className="relative z-10 shrink-0 px-6 pt-2 flex flex-wrap items-center justify-between gap-2.5 text-xs pointer-events-none">
        {brushSettings.mode !== 'none' ? (
          <div className="flex flex-wrap items-center gap-3 px-3.5 py-1.5 bg-slate-950/90 border border-slate-800/90 rounded-lg pointer-events-auto shadow-lg">
            {/* Si está en modo Triángulo, selector de alcance: 1 Triángulo Exacto vs Radio Pincel */}
            {isTriangleToolMode(brushSettings.mode) && (
              <div className="flex items-center gap-1 pr-2 border-r border-slate-800">
                <span className="text-slate-400 text-[11px] mr-1">Alcance:</span>
                <button
                  type="button"
                  onClick={() =>
                    setBrushSettings((prev) => ({ ...prev, triSingleFaceMode: true }))
                  }
                  className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                    brushSettings.triSingleFaceMode !== false
                      ? 'bg-amber-400 text-slate-950 font-semibold'
                      : 'bg-slate-900 text-slate-300 hover:text-white'
                  }`}
                  title="Edita o pinta exactamente el triángulo individual resaltado bajo el cursor"
                >
                  1 Triángulo
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setBrushSettings((prev) => ({ ...prev, triSingleFaceMode: false }))
                  }
                  className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                    brushSettings.triSingleFaceMode === false
                      ? 'bg-amber-400 text-slate-950 font-semibold'
                      : 'bg-slate-900 text-slate-300 hover:text-white'
                  }`}
                  title="Afecta a todos los triángulos dentro del anillo del pincel"
                >
                  Radio Pincel
                </button>
              </div>
            )}

            {/* Mostrar control de Radio cuando es un pincel de vértices o cuando el modo Triángulo usa Radio Pincel */}
            {(!isTriangleToolMode(brushSettings.mode) ||
              brushSettings.triSingleFaceMode === false) && (
              <div className="flex items-center gap-2">
                <span className="text-slate-300 font-medium">Radio:</span>
                <input
                  type="range"
                  min={0.02}
                  max={1.2}
                  step={0.01}
                  value={brushSettings.radius}
                  onChange={(e) =>
                    setBrushSettings((prev) => ({ ...prev, radius: parseFloat(e.target.value) }))
                  }
                  className="w-20 accent-amber-400"
                />
                <span className="font-mono tabular-nums text-amber-400 w-8">
                  {brushSettings.radius.toFixed(2)}
                </span>
              </div>
            )}

            {/* Control de Fuerza / Opacidad */}
            {brushSettings.mode !== 'tri_delete' && brushSettings.mode !== 'tri_extrude' && (
              <div className="flex items-center gap-2">
                <span className="text-slate-300 font-medium">
                  {brushSettings.mode === 'tri_paint' ? 'Opacidad:' : 'Fuerza:'}
                </span>
                <input
                  type="range"
                  min={0.05}
                  max={1.0}
                  step={0.05}
                  value={brushSettings.strength}
                  onChange={(e) =>
                    setBrushSettings((prev) => ({ ...prev, strength: parseFloat(e.target.value) }))
                  }
                  className="w-20 accent-amber-400"
                />
                <span className="font-mono tabular-nums text-amber-400 w-9">
                  {Math.round(brushSettings.strength * 100)}%
                </span>
              </div>
            )}

            {/* Opciones específicas de SUBDIVIDIR / SEGMENTAR TRIÁNGULO */}
            {brushSettings.mode === 'tri_subdivide' && (
              <div className="flex items-center gap-1.5 pl-2 border-l border-slate-800">
                <span className="text-emerald-300 font-medium">Segmentos al dividir:</span>
                {(
                  [
                    { id: 2 as TriangleSubdivideMode, label: '2 seg (1→4 tris)' },
                    { id: 3 as TriangleSubdivideMode, label: '3 seg (1→9 tris)' },
                    { id: 4 as TriangleSubdivideMode, label: '4 seg (1→16 tris)' },
                    { id: 'poke' as TriangleSubdivideMode, label: 'Centro Poke (1→3)' },
                  ]
                ).map((opt) => (
                  <button
                    key={String(opt.id)}
                    type="button"
                    onClick={() =>
                      setBrushSettings((prev) => ({ ...prev, triSubdivideSegments: opt.id }))
                    }
                    className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                      (brushSettings.triSubdivideSegments ?? 2) === opt.id
                        ? 'bg-emerald-400 text-slate-950 font-semibold'
                        : 'bg-slate-900 text-slate-300 hover:text-white border border-slate-800'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}

            {/* Opciones específicas de EXTRUIR TRIÁNGULO */}
            {brushSettings.mode === 'tri_extrude' && (
              <div className="flex flex-wrap items-center gap-3 pl-2 border-l border-slate-800">
                <div className="flex items-center gap-1.5">
                  <span className="text-sky-300 font-medium">Altura Extrusión:</span>
                  <input
                    type="range"
                    min={0.01}
                    max={0.35}
                    step={0.01}
                    value={brushSettings.triExtrudeHeight ?? 0.08}
                    onChange={(e) =>
                      setBrushSettings((prev) => ({
                        ...prev,
                        triExtrudeHeight: parseFloat(e.target.value),
                      }))
                    }
                    className="w-20 accent-sky-400"
                  />
                  <span className="font-mono tabular-nums text-sky-300 w-9">
                    {(brushSettings.triExtrudeHeight ?? 0.08).toFixed(2)}
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="text-slate-300 font-medium">Bisel Tapa:</span>
                  <input
                    type="range"
                    min={0.25}
                    max={1.25}
                    step={0.05}
                    value={brushSettings.triExtrudeScale ?? 0.82}
                    onChange={(e) =>
                      setBrushSettings((prev) => ({
                        ...prev,
                        triExtrudeScale: parseFloat(e.target.value),
                      }))
                    }
                    className="w-16 accent-sky-400"
                  />
                  <span className="font-mono tabular-nums text-sky-300 w-9">
                    {Math.round((brushSettings.triExtrudeScale ?? 0.82) * 100)}%
                  </span>
                </div>
                <span className="text-[11px] text-slate-400">(Shift+Clic = Hundir)</span>
              </div>
            )}

            {/* Opciones específicas de MOVER VÉRTICE (Pinchar y Mover en el mismo plano) */}
            {brushSettings.mode === 'vertex_move' && (
              <div className="flex flex-wrap items-center gap-2.5 pl-2 border-l border-slate-800">
                <div className="flex items-center gap-1">
                  <span className="text-purple-300 font-medium">Arrastre:</span>
                  <button
                    type="button"
                    onClick={() =>
                      setBrushSettings((prev) => ({ ...prev, vertexMoveSoftRadius: false }))
                    }
                    className={`px-2 py-0.5 rounded text-[11px] font-medium cursor-pointer ${
                      !brushSettings.vertexMoveSoftRadius
                        ? 'bg-purple-500 text-white font-semibold'
                        : 'bg-slate-900 text-slate-300 hover:text-white'
                    }`}
                    title="Mueve únicamente el vértice pinchado (y sus vértices soldados)"
                  >
                    1 Vértice Exacto
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setBrushSettings((prev) => ({ ...prev, vertexMoveSoftRadius: true }))
                    }
                    className={`px-2 py-0.5 rounded text-[11px] font-medium cursor-pointer ${
                      brushSettings.vertexMoveSoftRadius
                        ? 'bg-purple-500 text-white font-semibold'
                        : 'bg-slate-900 text-slate-300 hover:text-white'
                    }`}
                    title="Mueve el vértice pinchado y arrastra suavemente los vértices más cercanos en el mismo plano"
                  >
                    + Vecinos Cercanos
                  </button>
                </div>

                <div className="flex items-center gap-1">
                  <span className="text-slate-400 text-[11px]">Plano:</span>
                  {(
                    [
                      { id: 'camera' as VertexMovePlaneMode, label: 'Plano Vista' },
                      { id: 'surface' as VertexMovePlaneMode, label: 'Plano Superficie' },
                    ]
                  ).map((pm) => (
                    <button
                      key={pm.id}
                      type="button"
                      onClick={() =>
                        setBrushSettings((prev) => ({ ...prev, vertexMovePlaneMode: pm.id }))
                      }
                      className={`px-2 py-0.5 rounded text-[11px] cursor-pointer ${
                        (brushSettings.vertexMovePlaneMode ?? 'camera') === pm.id
                          ? 'bg-amber-400 text-slate-950 font-semibold'
                          : 'bg-slate-900 text-slate-300 hover:text-white'
                      }`}
                    >
                      {pm.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Opciones específicas de FUNCIÓN LÍNEA DE VÉRTICES (Alinear a la línea en el mismo plano) */}
            {brushSettings.mode === 'vertex_line' && (
              <div className="flex flex-wrap items-center gap-2.5 pl-2 border-l border-slate-800">
                <span className="text-cyan-300 font-medium">Modo Línea:</span>
                {(
                  [
                    {
                      id: 'snap_to_line' as VertexLineSnapMode,
                      label: 'Atraer a la Línea + Mismo Plano',
                    },
                    {
                      id: 'coplanar_line' as VertexLineSnapMode,
                      label: 'Nivelar al Plano de la Línea',
                    },
                  ]
                ).map((lm) => (
                  <button
                    key={lm.id}
                    type="button"
                    onClick={() =>
                      setBrushSettings((prev) => ({ ...prev, vertexLineSnapMode: lm.id }))
                    }
                    className={`px-2 py-0.5 rounded text-[11px] font-medium cursor-pointer ${
                      (brushSettings.vertexLineSnapMode ?? 'snap_to_line') === lm.id
                        ? 'bg-cyan-400 text-slate-950 font-semibold'
                        : 'bg-slate-900 text-slate-300 hover:text-white border border-slate-800'
                    }`}
                  >
                    {lm.label}
                  </button>
                ))}
                <span className="text-[10px] text-slate-400 hidden xl:inline">
                  (Pincha en un vértice A y arrastra hasta B para alinear los vértices cercanos)
                </span>
              </div>
            )}

            {/* Opciones de PINTURA (por Vértice o por Triángulo) */}
            {(brushSettings.mode === 'paint' || brushSettings.mode === 'tri_paint') && (
              <div className="flex flex-wrap items-center gap-2 pl-2 border-l border-slate-800">
                <span className="text-slate-300 font-medium">Color:</span>
                <input
                  type="color"
                  value={brushSettings.paintColor}
                  onChange={(e) =>
                    setBrushSettings((prev) => ({ ...prev, paintColor: e.target.value }))
                  }
                  className="w-5 h-5 rounded cursor-pointer border-0 bg-transparent"
                />
                {/* Muestras rápidas de paleta */}
                <div className="flex items-center gap-1">
                  {[
                    '#38bdf8',
                    '#f59e0b',
                    '#ef4444',
                    '#10b981',
                    '#a855f7',
                    '#f8fafc',
                    '#1e293b',
                  ].map((hex) => (
                    <button
                      key={hex}
                      type="button"
                      onClick={() => setBrushSettings((prev) => ({ ...prev, paintColor: hex }))}
                      style={{ backgroundColor: hex }}
                      className={`w-4 h-4 rounded-full border cursor-pointer ${
                        brushSettings.paintColor.toLowerCase() === hex
                          ? 'border-white scale-110'
                          : 'border-slate-700'
                      }`}
                      title={`Color ${hex}`}
                    />
                  ))}
                </div>

                {brushSettings.mode === 'tri_paint' && (
                  <>
                    <button
                      type="button"
                      onClick={() => handleFloodFillTriangles(false)}
                      title="Pinta todos los triángulos de la pieza apuntada con este color"
                      className="flex items-center gap-1 px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-amber-300 text-[11px] cursor-pointer"
                    >
                      <PaintBucket className="w-3 h-3" />
                      <span>Rellenar Pieza</span>
                    </button>
                    <span className="text-[10px] text-slate-400 hidden lg:inline">
                      <Pipette className="w-3 h-3 inline mr-0.5 text-amber-400" />
                      Shift+Clic = Capturar color
                    </span>
                  </>
                )}
              </div>
            )}
          </div>
        ) : (
          <div />
        )}

        {/* Metadatos Limpios sin Píldoras Estáticas */}
        <div className="flex items-center gap-2 bg-slate-950/85 px-3 py-1.5 rounded-lg border border-slate-800/90 pointer-events-auto text-slate-300">
          <span className="font-medium text-white">{modelStats.name}</span>
          <span aria-hidden="true">·</span>
          <span className="font-mono tabular-nums text-amber-400">
            {modelStats.triangles.toLocaleString()} triángulos
          </span>
          <span aria-hidden="true">·</span>
          <span className="font-mono tabular-nums">
            {modelStats.vertices.toLocaleString()} vértices
          </span>
          <span aria-hidden="true">·</span>
          <button
            type="button"
            onClick={() => setSettings((prev) => ({ ...prev, wireframe: !prev.wireframe }))}
            className="text-amber-400 hover:underline font-medium cursor-pointer"
          >
            {settings.wireframe ? 'Ocultar Malla' : 'Ver Malla (Wireframe)'}
          </button>
        </div>
      </div>

      {loadError && (
        <div className="relative z-20 shrink-0 mx-6 mt-2 max-w-md bg-red-950/90 border border-red-700 text-red-100 px-4 py-2 rounded-lg text-xs flex items-center justify-between gap-3">
          <span>{loadError}</span>
          <button
            type="button"
            onClick={() => setLoadError(null)}
            className="text-red-300 hover:text-white font-semibold cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      )}

      {/* Contenedor Flex Inferior a las Barras Superiores: evita que el menú derecho se mezcle o pise las opciones de arriba */}
      <div className="relative z-20 flex-1 min-h-0 flex justify-end items-start px-5 pt-2.5 pb-20 overflow-hidden pointer-events-none">
        {rightPanelCollapsed || dockCollapsed ? (
          <button
            type="button"
            onClick={() => {
              setRightPanelCollapsed(false);
              setDockCollapsed(false);
            }}
            title="Volver a enseñar el menú de Render, Luz, Texturas, Shaders y Modelado"
            className="pointer-events-auto flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-950/95 hover:bg-slate-900 border border-amber-400/50 text-amber-300 hover:text-amber-200 text-xs font-semibold shadow-2xl transition-all cursor-pointer"
          >
            <PanelRightOpen className="w-4 h-4 text-amber-400" />
            <span>Mostrar Menú Render y Herramientas</span>
          </button>
        ) : (
          <aside className="pointer-events-auto w-84 max-h-full overflow-y-auto bg-slate-950/92 border border-slate-800 rounded-xl p-4 shadow-2xl text-slate-200">
            {/* Cabecera del panel derecho con botón para ocultarlo al instante */}
            <div className="flex items-center justify-between gap-2 pb-2 mb-2 border-b border-slate-800/80">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <SlidersHorizontal className="w-3.5 h-3.5 text-amber-400" />
                <span>Menú Render & Inspector</span>
              </span>
              <button
                type="button"
                onClick={() => setRightPanelCollapsed(true)}
                title="Ocultar este menú lateral para que no estorbe con las opciones superiores ni con el visor 3D"
                className="flex items-center gap-1 px-2 py-1 rounded-md bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-[11px] font-medium text-slate-300 hover:text-amber-300 transition-colors cursor-pointer"
              >
                <EyeOff className="w-3 h-3 text-amber-400" />
                <span>Ocultar menú</span>
              </button>
            </div>

            <div className="flex items-center justify-between pb-2.5 mb-3 border-b border-slate-800">
              <div className="grid grid-cols-4 gap-1 bg-slate-900 p-1 rounded-lg text-[11px] font-medium w-full">
                <button
                  type="button"
                  onClick={() => setActiveTabPanel('tools')}
                  className={`py-1 rounded transition-colors cursor-pointer text-center whitespace-nowrap ${
                    activeTabPanel === 'tools'
                      ? 'bg-amber-400 text-slate-950 font-semibold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Modelado
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTabPanel('lighting')}
                  className={`py-1 rounded transition-colors cursor-pointer text-center whitespace-nowrap ${
                    activeTabPanel === 'lighting'
                      ? 'bg-amber-400 text-slate-950 font-semibold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Luz & Vista
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTabPanel('textures')}
                  className={`py-1 rounded transition-colors cursor-pointer text-center whitespace-nowrap ${
                    activeTabPanel === 'textures'
                      ? 'bg-amber-400 text-slate-950 font-semibold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Texturas
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTabPanel('shaders')}
                  className={`py-1 rounded transition-colors cursor-pointer text-center whitespace-nowrap ${
                    activeTabPanel === 'shaders'
                      ? 'bg-amber-400 text-slate-950 font-semibold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Shaders
                </button>
              </div>
            </div>

          {/* PESTAÑA 1: OPERACIONES DE MODELADO Y TOPOLOGÍA */}
          {activeTabPanel === 'tools' && (
            <div className="space-y-3.5 text-xs">
              {/* EDICIÓN Y PINTURA POR TRIÁNGULOS / AUMENTAR SEGMENTOS */}
              <div className="p-3 bg-slate-900/85 border border-amber-400/40 rounded-lg space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-amber-300 flex items-center gap-1.5">
                    <Triangle className="w-3.5 h-3.5 text-amber-400" />
                    Edición y Pintura por Triángulos
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setSettings((prev) => ({ ...prev, wireframe: !prev.wireframe }))
                    }
                    className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-colors cursor-pointer ${
                      settings.wireframe
                        ? 'bg-amber-400 text-slate-950'
                        : 'bg-slate-950 text-amber-300 border border-amber-400/30 hover:bg-slate-800'
                    }`}
                    title="Muestra las aristas exactas de cada triángulo sobre el modelo"
                  >
                    {settings.wireframe ? 'Aristas ON' : 'Ver Aristas'}
                  </button>
                </div>

                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Pinta caras triangulares nítidas, subdivide un triángulo en más segmentos o extruye caras 3D haciendo clic sobre el modelo.
                </p>

                {/* Botones de Herramienta Interactiva por Triángulo */}
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setBrushSettings((prev) => ({ ...prev, mode: 'tri_paint' }))}
                    className={`py-1.5 px-2 rounded-md font-medium flex items-center justify-center gap-1.5 border transition-colors cursor-pointer ${
                      brushSettings.mode === 'tri_paint'
                        ? 'bg-amber-400 text-slate-950 font-semibold border-amber-300'
                        : 'bg-slate-950 hover:bg-slate-800 text-slate-200 border-slate-800'
                    }`}
                  >
                    <Triangle className="w-3.5 h-3.5 text-amber-400" />
                    <span>Pintar Triángulo</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setBrushSettings((prev) => ({ ...prev, mode: 'tri_subdivide' }))}
                    className={`py-1.5 px-2 rounded-md font-medium flex items-center justify-center gap-1.5 border transition-colors cursor-pointer ${
                      brushSettings.mode === 'tri_subdivide'
                        ? 'bg-emerald-400 text-slate-950 font-semibold border-emerald-300'
                        : 'bg-slate-950 hover:bg-slate-800 text-slate-200 border-slate-800'
                    }`}
                  >
                    <PlusCircle className="w-3.5 h-3.5 text-emerald-400" />
                    <span>+ Subdividir Tri</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setBrushSettings((prev) => ({ ...prev, mode: 'tri_extrude' }))}
                    className={`py-1.5 px-2 rounded-md font-medium flex items-center justify-center gap-1.5 border transition-colors cursor-pointer ${
                      brushSettings.mode === 'tri_extrude'
                        ? 'bg-sky-400 text-slate-950 font-semibold border-sky-300'
                        : 'bg-slate-950 hover:bg-slate-800 text-slate-200 border-slate-800'
                    }`}
                  >
                    <Box className="w-3.5 h-3.5 text-sky-400" />
                    <span>Extruir Triángulo</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setBrushSettings((prev) => ({ ...prev, mode: 'tri_push' }))}
                    className={`py-1.5 px-2 rounded-md font-medium flex items-center justify-center gap-1.5 border transition-colors cursor-pointer ${
                      brushSettings.mode === 'tri_push'
                        ? 'bg-amber-400 text-slate-950 font-semibold border-amber-300'
                        : 'bg-slate-950 hover:bg-slate-800 text-slate-200 border-slate-800'
                    }`}
                  >
                    <Layers className="w-3.5 h-3.5 text-amber-400" />
                    <span>Empujar Cara</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setBrushSettings((prev) => ({ ...prev, mode: 'vertex_move' }))}
                    className={`py-1.5 px-2 rounded-md font-medium flex items-center justify-center gap-1.5 border transition-colors cursor-pointer ${
                      brushSettings.mode === 'vertex_move'
                        ? 'bg-purple-500 text-white font-semibold border-purple-300'
                        : 'bg-slate-950 hover:bg-slate-800 text-purple-200 border-purple-500/40'
                    }`}
                    title="Pincha un vértice y muévelo junto a sus vecinos en el mismo plano"
                  >
                    <Move className="w-3.5 h-3.5 text-purple-300" />
                    <span>Mover Vértices</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setBrushSettings((prev) => ({ ...prev, mode: 'vertex_line' }))}
                    className={`py-1.5 px-2 rounded-md font-medium flex items-center justify-center gap-1.5 border transition-colors cursor-pointer ${
                      brushSettings.mode === 'vertex_line'
                        ? 'bg-cyan-400 text-slate-950 font-semibold border-cyan-300'
                        : 'bg-slate-950 hover:bg-slate-800 text-cyan-200 border-cyan-500/40'
                    }`}
                    title="Traza una línea entre dos vértices para llevar los vértices cercanos a la línea en el mismo plano"
                  >
                    <GitCommitHorizontal className="w-3.5 h-3.5 text-cyan-300" />
                    <span>Función Línea</span>
                  </button>
                </div>

                {/* Selector de Segmentos al subdividir un triángulo con el ratón */}
                <div className="pt-1 border-t border-slate-800/80 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-300 font-medium">Segmentos por Triángulo:</span>
                    <span className="font-mono text-emerald-400">
                      {brushSettings.triSubdivideSegments === 'poke'
                        ? 'Centro (1→3)'
                        : `${brushSettings.triSubdivideSegments ?? 2} seg (1→${Math.pow(
                            Number(brushSettings.triSubdivideSegments ?? 2),
                            2
                          )})`}
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-1 text-[10px]">
                    {(
                      [
                        { id: 2 as TriangleSubdivideMode, label: '1→4' },
                        { id: 3 as TriangleSubdivideMode, label: '1→9' },
                        { id: 4 as TriangleSubdivideMode, label: '1→16' },
                        { id: 'poke' as TriangleSubdivideMode, label: 'Poke 1→3' },
                      ]
                    ).map((seg) => (
                      <button
                        key={String(seg.id)}
                        type="button"
                        onClick={() =>
                          setBrushSettings((prev) => ({
                            ...prev,
                            mode: 'tri_subdivide',
                            triSubdivideSegments: seg.id,
                          }))
                        }
                        className={`py-1 rounded font-semibold transition-colors cursor-pointer ${
                          (brushSettings.triSubdivideSegments ?? 2) === seg.id &&
                          brushSettings.mode === 'tri_subdivide'
                            ? 'bg-emerald-400 text-slate-950'
                            : 'bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800'
                        }`}
                      >
                        {seg.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Aumentar Triángulos / Segmentos en Todo el Modelo (1 Clic) */}
                <div className="pt-1 border-t border-slate-800/80 space-y-1.5">
                  <span className="text-[10px] font-semibold text-slate-300 block">
                    Multiplicar Triángulos de Todo el Objeto:
                  </span>
                  <div className="grid grid-cols-3 gap-1.5 text-[10px]">
                    <button
                      type="button"
                      onClick={() => handleGlobalTriangleSegmentation(2)}
                      title="Divide cada triángulo del modelo en 4 triángulos (2 segmentos por arista)"
                      className="py-1.5 px-1.5 rounded bg-slate-950 hover:bg-emerald-500/20 border border-slate-800 hover:border-emerald-400/50 text-emerald-300 font-semibold cursor-pointer"
                    >
                      + Subdividir ×4
                    </button>
                    <button
                      type="button"
                      onClick={() => handleGlobalTriangleSegmentation(3)}
                      title="Divide cada triángulo del modelo en 9 triángulos (3 segmentos por arista)"
                      className="py-1.5 px-1.5 rounded bg-slate-950 hover:bg-emerald-500/20 border border-slate-800 hover:border-emerald-400/50 text-emerald-300 font-semibold cursor-pointer"
                    >
                      + Segmentar ×9
                    </button>
                    <button
                      type="button"
                      onClick={() => handleGlobalTriangleSegmentation('poke')}
                      title="Divide cada triángulo desde su centro en 3 triángulos (Poke)"
                      className="py-1.5 px-1.5 rounded bg-slate-950 hover:bg-sky-500/20 border border-slate-800 hover:border-sky-400/50 text-sky-300 font-semibold cursor-pointer"
                    >
                      + Poke ×3
                    </button>
                  </div>
                </div>

                {triangleActionFeedback && (
                  <div className="p-1.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-[10px] leading-snug">
                    {triangleActionFeedback}
                  </div>
                )}
              </div>

              {/* Redondeo Global Laplaciano */}
              <div className="p-3 bg-slate-900/70 border border-slate-800/90 rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-white">Redondeo Orgánico (Laplacian)</span>
                  <span className="text-[11px] text-amber-400 font-mono">4 pasadas</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Suaviza y suelda todos los vértices para eliminar picos poligonales y redondear la silueta.
                </p>
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleGlobalLaplacian}
                    className="py-1.5 px-2.5 rounded-md bg-amber-400 text-slate-950 font-semibold flex items-center justify-center gap-1.5 hover:bg-amber-300 transition-colors whitespace-nowrap cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    Redondear
                  </button>
                  <button
                    type="button"
                    onClick={handleSubdivideAndSmooth}
                    title="Divide triángulos grandes y suaviza la superficie"
                    className="py-1.5 px-2.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium flex items-center justify-center gap-1.5 border border-slate-700 transition-colors whitespace-nowrap cursor-pointer"
                  >
                    <PlusCircle className="w-3.5 h-3.5 text-amber-400" />
                    Subdividir +
                  </button>
                </div>
              </div>

              {/* Reducción de Polígonos Inteligente (Smart Decimate con Protección de Dibujo) */}
              <div className="p-3 bg-slate-900/70 border border-slate-800/90 rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-white">Reducción Poligonal (Decimate)</span>
                  <span className="font-mono tabular-nums text-amber-400">
                    -{Math.round(decimateRatio * 100)}%
                  </span>
                </div>

                {/* Interruptor de Protección de Silueta y Detalles */}
                <div className="flex items-center justify-between gap-2 py-1 px-2 rounded bg-slate-950/90 border border-slate-800 text-[10px]">
                  <span className="flex items-center gap-1 text-emerald-300 font-medium">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Proteger Silueta, Ojos y Piezas Finas</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setPreserveDecimateFeatures((prev) => !prev)}
                    className={`px-2 py-0.5 rounded font-semibold transition-colors cursor-pointer ${
                      preserveDecimateFeatures
                        ? 'bg-emerald-500/20 border border-emerald-400/50 text-emerald-300'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                    title="Evita que la reducción colapse partes pequeñas (ojos, cuernos, articulaciones) y restaura el volumen original"
                  >
                    {preserveDecimateFeatures ? 'Activo' : 'Off'}
                  </button>
                </div>

                <input
                  type="range"
                  min={0.1}
                  max={0.75}
                  step={0.05}
                  value={decimateRatio}
                  onChange={(e) => setDecimateRatio(parseFloat(e.target.value))}
                  className="w-full"
                />

                <button
                  type="button"
                  disabled={isDecimating}
                  onClick={handleApplyDecimate}
                  className="w-full py-1.5 px-3 rounded-md bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                >
                  <Scissors className="w-3.5 h-3.5 text-amber-400" />
                  {isDecimating ? 'Simplificando con Protección...' : 'Aplicar Reducción Segura'}
                </button>

                {/* Botones de Recuperación Inmediata: Deshacer / Rehacer / Restaurar Dibujo Original */}
                <div className="grid grid-cols-3 gap-1.5 pt-0.5 text-[10px]">
                  <button
                    type="button"
                    disabled={!canUndo}
                    onClick={handleUndo}
                    className="py-1 px-1.5 rounded bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-200 flex items-center justify-center gap-1 disabled:opacity-40 cursor-pointer"
                    title="Deshacer reducción poligonal (Ctrl+Z)"
                  >
                    <Undo2 className="w-3 h-3 text-amber-400" />
                    <span>Deshacer</span>
                  </button>
                  <button
                    type="button"
                    disabled={!canRedo}
                    onClick={handleRedo}
                    className="py-1 px-1.5 rounded bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-200 flex items-center justify-center gap-1 disabled:opacity-40 cursor-pointer"
                    title="Rehacer paso (Ctrl+Y)"
                  >
                    <Redo2 className="w-3 h-3 text-sky-400" />
                    <span>Rehacer</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleRestoreMasterDrawing}
                    className="py-1 px-1.5 rounded bg-amber-400/15 hover:bg-amber-400/25 border border-amber-400/40 text-amber-300 font-semibold flex items-center justify-center gap-1 cursor-pointer"
                    title="Recupera el dibujo original al 100% intacto antes de cualquier reducción"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Original</span>
                  </button>
                </div>

                {decimateFeedback && (
                  <div className="p-1.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-[10px] leading-snug">
                    {decimateFeedback}
                  </div>
                )}
              </div>

              {/* COMPLEMENTO GEMINI AI -> DIBUJAR CON PYTHON (bpy) EN TIEMPO REAL + ASISTENTE GUIADO */}
              <div className="p-3 bg-slate-900/85 border border-amber-400/35 rounded-lg space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-amber-300 flex items-center gap-1.5">
                    <Wand2 className="w-3.5 h-3.5 text-amber-400" />
                    Gemini → Dibujo Python 3D
                  </span>
                  <div className="flex items-center gap-0.5 bg-slate-950 p-0.5 rounded border border-slate-800 text-[10px]">
                    <button
                      type="button"
                      onClick={() => setSidebarGeminiMode('replace')}
                      className={`px-1.5 py-0.5 rounded transition-colors cursor-pointer ${
                        sidebarGeminiMode === 'replace'
                          ? 'bg-amber-400 text-slate-950 font-semibold'
                          : 'text-slate-400 hover:text-white'
                      }`}
                      title="Borra el objeto actual y crea uno nuevo desde cero"
                    >
                      Nuevo
                    </button>
                    <button
                      type="button"
                      onClick={() => setSidebarGeminiMode('append')}
                      className={`px-1.5 py-0.5 rounded transition-colors cursor-pointer ${
                        sidebarGeminiMode === 'append'
                          ? 'bg-amber-400 text-slate-950 font-semibold'
                          : 'text-slate-400 hover:text-white'
                      }`}
                      title="Añade partes/armas/alas al modelo actual sin borrarlo"
                    >
                      + Añadir
                    </button>
                    <button
                      type="button"
                      onClick={() => setSidebarGeminiMode('refine')}
                      className={`px-1.5 py-0.5 rounded transition-colors cursor-pointer ${
                        sidebarGeminiMode === 'refine'
                          ? 'bg-amber-400 text-slate-950 font-semibold'
                          : 'text-slate-400 hover:text-white'
                      }`}
                      title="Refina y mejora el último código Python generado"
                    >
                      Refinar
                    </button>
                  </div>
                </div>

                {/* Botón para mostrar/ocultar Asistente de Ayuda al Dibujo */}
                <button
                  type="button"
                  onClick={() => setShowSidebarGeminiHelpers((prev) => !prev)}
                  className="w-full py-1 px-2 rounded bg-slate-950/90 hover:bg-slate-800 border border-slate-800 flex items-center justify-between text-[10px] text-slate-300 transition-colors cursor-pointer"
                >
                  <span className="flex items-center gap-1.5 font-medium text-amber-300/90">
                    <SlidersHorizontal className="w-3 h-3 text-amber-400" />
                    Opciones para ayudar a Gemini a dibujar
                  </span>
                  <span className="text-slate-400">{showSidebarGeminiHelpers ? '▲' : '▼'}</span>
                </button>

                {showSidebarGeminiHelpers && (
                  <div className="p-2 rounded-md bg-slate-950/90 border border-slate-800/90 space-y-2 text-[10px]">
                    {/* Selector de Modelo Gemini (Incluye Google Argon) y Nivel de Pensamiento */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-slate-400 flex items-center gap-1">
                          <Cpu className="w-3 h-3 text-amber-400" />
                          <span>Modelo Gemini</span>
                        </label>
                        {currentUser && (
                          <span className="text-[9px] text-emerald-400 font-medium">
                            Cuenta Google Activa
                          </span>
                        )}
                      </div>
                      <select
                        value={selectedGeminiModel}
                        onChange={(e) => setSelectedGeminiModel(e.target.value)}
                        className="w-full px-1.5 py-1 rounded bg-slate-900 border border-slate-700 text-amber-300 font-semibold outline-none focus:border-amber-400 text-[11px]"
                      >
                        {GEMINI_MODEL_OPTIONS.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.label} ({m.badge})
                          </option>
                        ))}
                      </select>

                      {/* Nivel de Pensamiento: Low / Medium / High */}
                      <div className="pt-0.5">
                        <label className="text-slate-400 flex items-center justify-between mb-1">
                          <span className="flex items-center gap-1">
                            <Brain className="w-3 h-3 text-sky-400" />
                            <span>Nivel de Pensamiento (Thinking)</span>
                          </span>
                          <span className="font-mono text-sky-300 font-semibold">
                            {selectedThinkingLevel}
                          </span>
                        </label>
                        <div className="grid grid-cols-3 gap-1 bg-slate-900 p-0.5 rounded border border-slate-800">
                          {THINKING_LEVEL_OPTIONS.map((lvl) => (
                            <button
                              key={lvl.id}
                              type="button"
                              onClick={() => setSelectedThinkingLevel(lvl.id)}
                              title={lvl.description}
                              className={`py-1 rounded text-center font-semibold transition-colors cursor-pointer ${
                                selectedThinkingLevel === lvl.id
                                  ? 'bg-sky-400 text-slate-950'
                                  : 'text-slate-400 hover:text-white'
                              }`}
                            >
                              {lvl.shortLabel}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Arquetipo Anatómico y Simetría */}
                    <div className="grid grid-cols-2 gap-1.5">
                      <div>
                        <label className="text-slate-400 block mb-0.5">Arquetipo Base</label>
                        <select
                          value={sidebarArchetype}
                          onChange={(e) => setSidebarArchetype(e.target.value)}
                          className="w-full px-1.5 py-1 rounded bg-slate-900 border border-slate-700 text-slate-200 outline-none focus:border-amber-400"
                        >
                          {ARCHETYPE_OPTIONS.map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-slate-400 block mb-0.5">Simetría</label>
                        <select
                          value={sidebarSymmetry}
                          onChange={(e) => setSidebarSymmetry(e.target.value)}
                          className="w-full px-1.5 py-1 rounded bg-slate-900 border border-slate-700 text-slate-200 outline-none focus:border-amber-400"
                        >
                          {SYMMETRY_OPTIONS.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Complejidad y Paleta de Color */}
                    <div className="grid grid-cols-2 gap-1.5">
                      <div>
                        <label className="text-slate-400 block mb-0.5">Nivel de Detalle</label>
                        <div className="grid grid-cols-3 gap-0.5 bg-slate-900 p-0.5 rounded border border-slate-800">
                          {(
                            [
                              { id: 'standard', label: 'Medio' },
                              { id: 'high', label: 'Alto' },
                              { id: 'ultra', label: 'Ultra' },
                            ] as const
                          ).map((c) => (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => setSidebarComplexity(c.id)}
                              className={`py-0.5 rounded text-center cursor-pointer ${
                                sidebarComplexity === c.id
                                  ? 'bg-amber-400 text-slate-950 font-semibold'
                                  : 'text-slate-400 hover:text-white'
                              }`}
                            >
                              {c.label}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="text-slate-400 block mb-0.5">Paleta de Color</label>
                        <select
                          value={sidebarPalette}
                          onChange={(e) => setSidebarPalette(e.target.value)}
                          className="w-full px-1.5 py-1 rounded bg-slate-900 border border-slate-700 text-slate-200 outline-none focus:border-amber-400"
                        >
                          {PALETTE_OPTIONS.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Boceto de Referencia (Imagen) + Visión del Visor 3D + Auto-Smooth */}
                    <div className="flex flex-wrap items-center gap-1 pt-0.5">
                      <input
                        ref={sidebarSketchInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleSidebarSketchUpload}
                        className="hidden"
                      />
                      {!sidebarRefImage ? (
                        <button
                          type="button"
                          onClick={() => sidebarSketchInputRef.current?.click()}
                          className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 flex items-center gap-1 cursor-pointer"
                          title="Sube un boceto o imagen para que Gemini lo use como guía visual"
                        >
                          <ImagePlus className="w-3 h-3 text-amber-400" />
                          <span>Boceto/Ref</span>
                        </button>
                      ) : (
                        <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-400/15 border border-amber-400/40 text-amber-200">
                          <img
                            src={sidebarRefImage.dataUrl}
                            alt="Ref"
                            className="w-4 h-4 rounded object-cover"
                          />
                          <span className="max-w-[75px] truncate">{sidebarRefImage.name}</span>
                          <button
                            type="button"
                            onClick={() => setSidebarRefImage(null)}
                            className="text-slate-400 hover:text-white cursor-pointer"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={() => setSidebarUseViewport((prev) => !prev)}
                        className={`px-2 py-1 rounded border flex items-center gap-1 cursor-pointer ${
                          sidebarUseViewport
                            ? 'bg-amber-400/20 border-amber-400 text-amber-300 font-semibold'
                            : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-200'
                        }`}
                        title="Envía una captura del visor 3D actual + dimensiones para encajar piezas con precisión"
                      >
                        <Camera className="w-3 h-3" />
                        <span>Ver Escena 3D</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setSidebarAutoSmooth((prev) => !prev)}
                        className={`px-2 py-1 rounded border cursor-pointer ${
                          sidebarAutoSmooth
                            ? 'bg-amber-400/20 border-amber-400 text-amber-300 font-semibold'
                            : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-200'
                        }`}
                        title="Aplica bpy.ops.mesh.smooth automáticamente al terminar"
                      >
                        Auto-Suavizar
                      </button>
                    </div>

                    {/* Kit de Herramientas IA para Mejorar el Resultado 3D */}
                    <div className="pt-1.5 border-t border-slate-800/80 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-semibold text-amber-300">
                          Tags IA ({sidebarAiTools.length}/{AI_TOOLKIT_OPTIONS.length}):
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() =>
                              setSidebarAiTools((prev) =>
                                prev.length === AI_TOOLKIT_OPTIONS.length
                                  ? ['auto_ground']
                                  : AI_TOOLKIT_OPTIONS.map((t) => t.id)
                              )
                            }
                            className="px-1.5 py-0.5 rounded bg-amber-400/20 hover:bg-amber-400/30 border border-amber-400/50 text-amber-200 text-[9px] font-semibold cursor-pointer"
                            title="Activar los 23 módulos de los 7 puntos de la API"
                          >
                            {sidebarAiTools.length === AI_TOOLKIT_OPTIONS.length
                              ? 'Reset'
                              : '✨ Todos (23)'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setSidebarAutoCritique((prev) => !prev)}
                            className={`px-1.5 py-0.5 rounded border text-[9px] font-semibold cursor-pointer ${
                              sidebarAutoCritique
                                ? 'bg-sky-500/20 border-sky-400 text-sky-300'
                                : 'bg-slate-900 border-slate-800 text-slate-400'
                            }`}
                            title="Audita visualmente la escena 3D y reemplaza partes simples por geometría articulada"
                          >
                            Auditoría IA: {sidebarAutoCritique ? 'ON' : 'OFF'}
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-1 max-h-28 overflow-y-auto pr-0.5">
                        {AI_TOOLKIT_OPTIONS.map((tool) => {
                          const isSelected = sidebarAiTools.includes(tool.id);
                          return (
                            <button
                              key={tool.id}
                              type="button"
                              title={tool.description}
                              onClick={() =>
                                setSidebarAiTools((prev) =>
                                  isSelected
                                    ? prev.filter((id) => id !== tool.id)
                                    : [...prev, tool.id]
                                )
                              }
                              className={`px-1.5 py-1 rounded border text-left text-[9px] truncate transition-colors cursor-pointer ${
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

                      {/* Botones de Acción Directa en 1 Clic para Mejorar el Modelo Actual */}
                      <div className="grid grid-cols-2 gap-1 pt-0.5">
                        <button
                          type="button"
                          disabled={isSidebarGeminiLoading}
                          onClick={() => {
                            const critiquePrompt =
                              'Analiza el modelo 3D actual en el visor y mejóralo usando extremidades articuladas (primitive_limb_pair_add), placas de armadura curvas (primitive_armor_plate_add), cuernos/hojas (primitive_horn_add / primitive_blade_add) y bpy.ops.mesh.auto_ground().';
                            setSidebarGeminiMode('refine');
                            setSidebarGeminiPrompt(critiquePrompt);
                            handleSidebarGeminiGenerate(critiquePrompt, 'refine');
                          }}
                          className="py-1 px-1.5 rounded bg-sky-500/15 hover:bg-sky-500/25 border border-sky-400/40 text-sky-200 font-semibold text-[9px] text-center cursor-pointer disabled:opacity-50"
                          title="La IA inspecciona el visor 3D y reconstruye/mejora las partes con las nuevas herramientas"
                        >
                          🔍 Auto-Mejorar Todo (IA)
                        </button>
                        <button
                          type="button"
                          disabled={isSidebarGeminiLoading}
                          onClick={() =>
                            handleRunPythonScript(
                              `import bpy\nbpy.ops.mesh.mirror_x()\nbpy.ops.mesh.auto_ground()\nprint("Simetría Espejo X y Auto-Apoyo aplicados.")`,
                              'Simetría X + Auto-Apoyar'
                            )
                          }
                          className="py-1 px-1.5 rounded bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-400/40 text-emerald-300 font-semibold text-[9px] text-center cursor-pointer disabled:opacity-50"
                          title="Duplica piezas laterales en espejo X y asienta el modelo exactamente sobre el pedestal"
                        >
                          ⚡ Mirror X + Apoyar Base
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                <textarea
                  rows={2}
                  value={sidebarGeminiPrompt}
                  onChange={(e) => setSidebarGeminiPrompt(e.target.value)}
                  onPaste={(e) => {
                    const pasted = e.clipboardData?.getData('text/plain') || '';
                    if (isLikelyBlenderPythonCode(pasted)) {
                      e.preventDefault();
                      const cleaned = stripMarkdownCodeFences(pasted);
                      setLastGeneratedPythonCode(cleaned);
                      setSidebarGeminiPrompt('');
                      void handleRunPythonScript(cleaned, 'Script Blender 5.2 Pegado').then(
                        (execResult) => {
                          if (execResult.success) {
                            setSidebarGeminiStatus({
                              type: 'success',
                              text: `Script Python de Blender 5.2 pegado y ejecutado en 3D (${execResult.objectsCreated || 0} objetos • 0 llamadas API).`,
                            });
                          } else {
                            setSidebarGeminiStatus({
                              type: 'error',
                              text: `Error en script Python pegado: ${execResult.error}`,
                            });
                          }
                        }
                      );
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSidebarGeminiGenerate();
                    }
                  }}
                  placeholder="Describe cualquier elemento de juego o pega aquí directamente (Ctrl+V) un código Python de Blender 5.2..."
                  className="w-full p-2 rounded bg-slate-950 border border-slate-700/80 focus:border-amber-400 outline-none text-[11px] text-white placeholder:text-slate-500 resize-none leading-snug"
                />

                <button
                  type="button"
                  disabled={
                    isSidebarGeminiLoading || (!sidebarGeminiPrompt.trim() && !sidebarRefImage)
                  }
                  onClick={() => handleSidebarGeminiGenerate()}
                  className="w-full py-1.5 px-3 rounded-md bg-amber-400 hover:bg-amber-300 text-slate-950 font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isSidebarGeminiLoading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>
                        Razonando ({selectedThinkingLevel}) • {sidebarElapsedSeconds}s...
                      </span>
                    </>
                  ) : (
                    <>
                      <Wand2 className="w-3.5 h-3.5" />
                      <span>Dibujar con Gemini Python</span>
                    </>
                  )}
                </button>

                {/* EVOLUCIÓN DEL PENSAMIENTO EN TIEMPO REAL (SIDEBAR) */}
                {(isSidebarGeminiLoading || sidebarThoughtSteps.length > 0) && (
                  <div className="p-2 rounded-md bg-slate-950/95 border border-sky-500/35 space-y-1.5 text-[10px]">
                    <div className="flex items-center justify-between text-sky-300 font-semibold">
                      <span className="flex items-center gap-1">
                        <Brain
                          className={`w-3 h-3 text-sky-400 ${
                            isSidebarGeminiLoading ? 'animate-pulse' : ''
                          }`}
                        />
                        <span>
                          {isSidebarGeminiLoading
                            ? `Evolución del pensamiento (${selectedThinkingLevel})...`
                            : `Proceso de pensamiento (${selectedThinkingLevel})`}
                        </span>
                      </span>
                      {!isSidebarGeminiLoading && sidebarThoughtSteps.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setSidebarThoughtSteps([])}
                          className="text-slate-500 hover:text-slate-300 cursor-pointer"
                          title="Ocultar pasos"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>

                    {isSidebarGeminiLoading ? (
                      <div className="space-y-1">
                        {(
                          LIVE_THOUGHT_PHASES[selectedThinkingLevel] ||
                          LIVE_THOUGHT_PHASES.MEDIUM
                        ).map((phase, idx) => {
                          const isDone = idx < sidebarLivePhaseIndex;
                          const isCurrent = idx === sidebarLivePhaseIndex;
                          return (
                            <div
                              key={idx}
                              className={`flex items-center gap-1.5 py-0.5 ${
                                isCurrent
                                  ? 'text-sky-200 font-medium'
                                  : isDone
                                  ? 'text-emerald-300/80'
                                  : 'text-slate-500'
                              }`}
                            >
                              {isDone ? (
                                <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                              ) : isCurrent ? (
                                <Loader2 className="w-3 h-3 text-sky-400 animate-spin shrink-0" />
                              ) : (
                                <span className="w-3 h-3 rounded-full border border-slate-700 inline-block shrink-0" />
                              )}
                              <span className="leading-tight">{phase}</span>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="space-y-1 max-h-28 overflow-y-auto pr-1">
                        {sidebarThoughtSteps.map((step, idx) => (
                          <div
                            key={idx}
                            className="flex items-start gap-1 text-slate-300 leading-tight"
                          >
                            <span className="font-mono text-sky-400 font-bold shrink-0">
                              {idx + 1}.
                            </span>
                            <span>{step}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Botones rápidos de refinamiento iterativo sobre el último dibujo */}
                {lastGeneratedPythonCode && (
                  <div className="flex flex-wrap items-center gap-1 pt-0.5">
                    <span className="text-[10px] text-slate-400 mr-0.5">Mejorar:</span>
                    {[
                      {
                        label: '+ Detalles / Gemas',
                        prompt:
                          'Añade más sub-piezas detalladas, marcos de refuerzo, remaches y gemas brillantes manteniendo la estructura del objeto actual.',
                      },
                      {
                        label: '+ Base Escenario',
                        prompt:
                          'Añade debajo una base de escenario con rocas facetadas (primitive_dodecahedron_add), escalones y cristales ambientales.',
                      },
                      {
                        label: '+ Energía / Ruedas / Alas',
                        prompt:
                          'Enriquece el objeto añadiendo anillos de energía, propulsores/ruedas o alas desplegadas según su diseño.',
                      },
                    ].map((item) => (
                      <button
                        key={item.label}
                        type="button"
                        disabled={isSidebarGeminiLoading}
                        onClick={() => {
                          setSidebarGeminiMode('refine');
                          setSidebarGeminiPrompt(item.prompt);
                          handleSidebarGeminiGenerate(item.prompt, 'refine');
                        }}
                        className="px-1.5 py-0.5 rounded bg-slate-950 hover:bg-amber-400/20 border border-slate-800 hover:border-amber-400/50 text-[10px] text-slate-300 hover:text-amber-300 transition-colors cursor-pointer disabled:opacity-40"
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                )}

                {sidebarGeminiStatus && (
                  <div
                    className={`p-2 rounded text-[10px] leading-snug border ${
                      sidebarGeminiStatus.type === 'success'
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                        : 'bg-red-500/10 border-red-500/30 text-red-300'
                    }`}
                  >
                    {sidebarGeminiStatus.text}
                  </div>
                )}

                {/* USO SEMANAL DE GEMINI Y ENLACE PARA CONSULTAR CUOTA RESTANTE */}
                <div className="p-2 rounded-md bg-slate-950/90 border border-slate-800/90 space-y-1 text-[10px]">
                  <div className="flex items-center justify-between text-slate-300">
                    <span className="flex items-center gap-1 font-medium">
                      <BarChart3 className="w-3 h-3 text-amber-400" />
                      <span>Uso semanal:</span>
                    </span>
                    <span className="font-mono text-amber-300">
                      {weeklyUsageStats.totalGenerations} gen · {(weeklyUsageStats.totalTokens / 1000).toFixed(1)}k tok
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2 pt-0.5">
                    <a
                      href={GEMINI_QUOTA_LINKS.aiStudioPlan}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-amber-300 hover:text-amber-200 underline underline-offset-2 font-medium"
                      title="Abre la página oficial de cuota y límites de uso de Gemini en AI Studio"
                    >
                      <span>Ver cuánto uso semanal te queda</span>
                      <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                    <a
                      href={GEMINI_QUOTA_LINKS.geminiAccountUsage}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-sky-300 hover:text-sky-200 underline underline-offset-2"
                      title="Ver tu actividad de Gemini en tu cuenta de Google"
                    >
                      <span>Actividad Gemini</span>
                      <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  </div>
                </div>

                <div className="pt-1 border-t border-slate-800/80 space-y-1.5">
                  <div className="flex items-center justify-between text-[10px] text-slate-400">
                    <span>Plantillas rápidas de Videojuegos:</span>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {[
                      { id: 'gen_game_treasure_chest', shortLabel: '📦 Cofre Tesoro' },
                      { id: 'gen_game_stylized_tree', shortLabel: '🌲 Árbol & Isla' },
                      { id: 'gen_game_cyber_vehicle', shortLabel: '🚀 Vehículo Sci-Fi' },
                      { id: 'gen_game_medieval_tower', shortLabel: '🏰 Torre / Portal' },
                      { id: 'gen_cyber_sentinel', shortLabel: '🤖 Mecha / NPC' },
                      { id: 'gen_elder_dragon', shortLabel: '🐉 Dragón Wyrm' },
                    ].map((genItem) => {
                      const preset = BLENDER_SCRIPT_PRESETS.find((p) => p.id === genItem.id);
                      if (!preset) return null;
                      return (
                        <button
                          key={genItem.id}
                          type="button"
                          onClick={() => {
                            setLastGeneratedPythonCode(preset.code);
                            handleRunPythonScript(preset.code, genItem.shortLabel);
                          }}
                          className="py-1 px-2 rounded bg-slate-800/90 hover:bg-amber-400/20 border border-slate-700/80 hover:border-amber-400/50 text-slate-200 hover:text-amber-300 text-[11px] font-medium text-left truncate transition-colors cursor-pointer"
                          title={preset.description}
                        >
                          {genItem.shortLabel}
                        </button>
                      );
                    })}
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsPythonModalOpen(true)}
                    className="w-full py-1.5 px-3 rounded-md bg-slate-800 hover:bg-slate-700 border border-slate-700 text-amber-300 font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Code2 className="w-3.5 h-3.5" />
                    <span>Abrir Estudio Completo Python + Gemini</span>
                  </button>
                </div>
              </div>

              {/* Mis texturas: subir imágenes y aplicarlas como mapa de color */}
              <MyTexturesPanel
                activeId={userColorTextureInfo?.id ?? null}
                tileMeters={userColorTileMeters}
                onTileMetersChange={setUserColorTileMeters}
                onApply={handleApplyUserTexture}
              />

              {/* Exportación GLB (Ligero / Ultra-Ligero / Completo), Captura PNG y Guardar en Nube */}
              <div className="p-3 rounded-lg bg-slate-900/75 border border-slate-800/90 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-emerald-300 flex items-center gap-1.5">
                    <Download className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Exportación .GLB Optimizada</span>
                  </span>
                  {lastExportStats && (
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                      Último: {lastExportStats.sizeFormatted}
                    </span>
                  )}
                </div>

                {/* Selector de Modo de Peso GLB */}
                <div className="grid grid-cols-3 gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 text-[11px]">
                  <button
                    type="button"
                    onClick={() => setGlbExportMode('light')}
                    title="GLB Ligero (Recomendado): Suelda vértices en índices, limpia atributos internos y une materiales sin perder detalle geométrico"
                    className={`py-1 px-1.5 rounded font-semibold transition-colors cursor-pointer ${
                      glbExportMode === 'light'
                        ? 'bg-emerald-400 text-slate-950'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    ⚡ Ligero
                  </button>
                  <button
                    type="button"
                    onClick={() => setGlbExportMode('ultra_light')}
                    title="GLB Ultra-Ligero (Low-Poly): Además de indexar y unir materiales, reduce ~48% los triángulos en el archivo exportado para web/móvil"
                    className={`py-1 px-1.5 rounded font-semibold transition-colors cursor-pointer ${
                      glbExportMode === 'ultra_light'
                        ? 'bg-sky-400 text-slate-950'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    🪶 Ultra-Ligero
                  </button>
                  <button
                    type="button"
                    onClick={() => setGlbExportMode('full')}
                    title="GLB Estándar: Conserva texturas procedurales incrustadas y 100% de los polígonos"
                    className={`py-1 px-1.5 rounded font-semibold transition-colors cursor-pointer ${
                      glbExportMode === 'full'
                        ? 'bg-amber-400 text-slate-950'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    💎 Completo
                  </button>
                </div>

                <p className="text-[10px] text-slate-400 leading-snug">
                  {glbExportMode === 'light'
                    ? '⚡ Suelda vértices duplicados (indexado), elimina buffers internos y agrupa piezas por material PBR (~80% menos peso, 100% misma forma).'
                    : glbExportMode === 'ultra_light'
                    ? '🪶 Ideal para videojuegos web/móvil: aplica simplificación Low-Poly automática (-48% tris) solo al archivo exportado.'
                    : '💎 Incluye texturas procedurales embebidas y toda la malla original.'}
                </p>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={isExporting}
                    onClick={() => void handleExportGlb()}
                    className="py-2 px-2.5 rounded-lg bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-semibold flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer disabled:opacity-50 shadow-sm"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>
                      {isExporting
                        ? 'Optimizando...'
                        : glbExportMode === 'ultra_light'
                        ? 'Descargar Ultra-Ligero'
                        : glbExportMode === 'light'
                        ? 'Descargar GLB Ligero'
                        : 'Descargar .GLB'}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => sceneRefs.current?.captureScreenshot()}
                    className="py-2 px-2.5 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-200 font-medium flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer"
                  >
                    <Camera className="w-3.5 h-3.5 text-amber-400" />
                    <span>Captura PNG</span>
                  </button>
                </div>

                {lastExportStats && (
                  <div className="p-2 rounded bg-emerald-950/60 border border-emerald-500/30 text-[10px] text-emerald-200 flex items-center justify-between">
                    <span>
                      ✅ <strong>{lastExportStats.sizeFormatted}</strong> ({lastExportStats.trianglesAfter.toLocaleString()} tris)
                    </span>
                    <span className="font-mono text-emerald-300">
                      {lastExportStats.verticesBefore.toLocaleString()} → {lastExportStats.verticesAfter.toLocaleString()} vérts
                    </span>
                  </div>
                )}

                <button
                  type="button"
                  disabled={isSavingToCloud}
                  onClick={handleQuickSaveToCloud}
                  className="w-full py-1.5 px-3 rounded-lg bg-amber-400/10 hover:bg-amber-400/20 border border-amber-400/40 text-amber-300 font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                  title="Guarda el modelo 3D actual y su código en tu cuenta de Google Firestore"
                >
                  <CloudUpload className="w-3.5 h-3.5 text-amber-400" />
                  <span>
                    {isSavingToCloud
                      ? 'Guardando en la Nube...'
                      : currentUser
                      ? 'Guardar en Mi Nube (Firestore)'
                      : 'Acceder y Guardar en Nube'}
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* PESTAÑA 2: ILUMINACIÓN DE ESTUDIO Y MOTORES DE RENDER (EEVEE / CYCLES / CEL) */}
          {activeTabPanel === 'lighting' && (
            <div className="space-y-4 text-xs">
              {/* Selector de Motor de Render y Sombreado (Cel-Shading, EEVEE, Cycles, MatCap, Normales) */}
              <div className="space-y-2">
                <span className="font-semibold text-slate-200 block">
                  Motor de Render y Sombreado
                </span>
                <div className="grid grid-cols-2 gap-1.5">
                  {(
                    [
                      { id: 'cel', label: '🎨 Cel-Shading 3T' },
                      { id: 'eevee', label: '⚡ EEVEE (Realtime)' },
                      { id: 'cycles', label: '💎 Cycles (Físico)' },
                      { id: 'matcap', label: '🏺 Escultura MatCap' },
                      { id: 'normals', label: '🧭 Normales RGB' },
                      { id: 'original', label: '📐 PBR Base' },
                    ] as const
                  ).map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setSettings((prev) => ({ ...prev, shadingMode: m.id }))}
                      className={`py-1.5 px-2 rounded-md font-medium border text-left transition-colors cursor-pointer ${
                        settings.shadingMode === m.id
                          ? 'bg-amber-400/15 border-amber-400 text-amber-300 font-semibold'
                          : 'bg-slate-900 border-slate-800 text-slate-300 hover:text-white'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Panel específico cuando el motor activo es EEVEE */}
              {settings.shadingMode === 'eevee' && (
                <div className="p-2.5 rounded-lg bg-sky-500/10 border border-sky-400/35 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sky-300 flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5 text-sky-400" />
                      Motor EEVEE Next Activo
                    </span>
                    <span className="text-[10px] font-mono text-sky-200 bg-sky-500/20 px-1.5 py-0.5 rounded">
                      60 FPS IBL + Bloom
                    </span>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-300">Resplandor Bloom (Emisión/Brillos)</span>
                      <span className="font-mono text-sky-300">
                        {Math.round(settings.eeveeBloomIntensity * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={1.5}
                      step={0.05}
                      value={settings.eeveeBloomIntensity}
                      onChange={(e) =>
                        setSettings((prev) => ({
                          ...prev,
                          eeveeBloomIntensity: parseFloat(e.target.value),
                        }))
                      }
                      className="w-full accent-sky-400"
                    />
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-300">Reflejos Entorno HDRI (IBL)</span>
                      <span className="font-mono text-sky-300">
                        {settings.eeveeEnvIntensity.toFixed(2)}x
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0.2}
                      max={3.0}
                      step={0.05}
                      value={settings.eeveeEnvIntensity}
                      onChange={(e) =>
                        setSettings((prev) => ({
                          ...prev,
                          eeveeEnvIntensity: parseFloat(e.target.value),
                        }))
                      }
                      className="w-full accent-sky-400"
                    />
                  </div>
                </div>
              )}

              {/* Panel específico cuando el motor activo es CYCLES */}
              {settings.shadingMode === 'cycles' && (
                <div className="p-2.5 rounded-lg bg-amber-400/10 border border-amber-400/35 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-amber-300 flex items-center gap-1.5">
                      <Gem className="w-3.5 h-3.5 text-amber-400" />
                      Motor Cycles Raytrace PBR
                    </span>
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] font-mono text-amber-200 bg-amber-400/20 px-1.5 py-0.5 rounded">
                        {cyclesCurrentSample >= settings.cyclesSamples
                          ? `✓ ${settings.cyclesSamples} SPP`
                          : `${cyclesCurrentSample}/${settings.cyclesSamples} SPP`}
                      </span>
                      <button
                        type="button"
                        onClick={() => sceneRefs.current?.resetCyclesAccumulation()}
                        title="Reiniciar acumulación progresiva de muestras (F12)"
                        className="px-1.5 py-0.5 rounded bg-slate-900 hover:bg-slate-800 border border-amber-400/40 text-[10px] text-amber-300 cursor-pointer"
                      >
                        F12
                      </button>
                    </div>
                  </div>
                  {/* Barra visual de convergencia progresiva de muestras */}
                  <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                    <div
                      className="h-full bg-amber-400 transition-all duration-100"
                      style={{
                        width: `${Math.min(
                          100,
                          Math.round((cyclesCurrentSample / Math.max(1, settings.cyclesSamples)) * 100)
                        )}%`,
                      }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-300">Acumulación Multi-Muestra (Jitter)</span>
                    <button
                      type="button"
                      onClick={() =>
                        setSettings((prev) => ({
                          ...prev,
                          cyclesProgressiveAccum: !prev.cyclesProgressiveAccum,
                        }))
                      }
                      className={`px-2 py-0.5 rounded text-[10px] font-semibold cursor-pointer ${
                        settings.cyclesProgressiveAccum
                          ? 'bg-amber-400 text-slate-950'
                          : 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      {settings.cyclesProgressiveAccum ? 'Activa (Path-Trace)' : 'Instantánea'}
                    </button>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-300">Muestras Path-Tracing (Samples)</span>
                      <span className="font-mono text-amber-300">{settings.cyclesSamples}</span>
                    </div>
                    <input
                      type="range"
                      min={16}
                      max={256}
                      step={16}
                      value={settings.cyclesSamples}
                      onChange={(e) =>
                        setSettings((prev) => ({
                          ...prev,
                          cyclesSamples: parseInt(e.target.value, 10),
                        }))
                      }
                      className="w-full accent-amber-400"
                    />
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-300">Barniz Físico (Clearcoat)</span>
                      <span className="font-mono text-amber-300">
                        {Math.round(settings.cyclesClearcoat * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      value={settings.cyclesClearcoat}
                      onChange={(e) =>
                        setSettings((prev) => ({
                          ...prev,
                          cyclesClearcoat: parseFloat(e.target.value),
                        }))
                      }
                      className="w-full accent-amber-400"
                    />
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-300">Rugosidad Micro-Superficie</span>
                      <span className="font-mono text-amber-300">
                        {Math.round(settings.cyclesRoughnessFactor * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0.15}
                      max={1.4}
                      step={0.05}
                      value={settings.cyclesRoughnessFactor}
                      onChange={(e) =>
                        setSettings((prev) => ({
                          ...prev,
                          cyclesRoughnessFactor: parseFloat(e.target.value),
                        }))
                      }
                      className="w-full accent-amber-400"
                    />
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-300">Índice de Refracción (IOR)</span>
                      <span className="font-mono text-amber-300">
                        {settings.cyclesIor.toFixed(2)}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={1.0}
                      max={2.4}
                      step={0.05}
                      value={settings.cyclesIor}
                      onChange={(e) =>
                        setSettings((prev) => ({
                          ...prev,
                          cyclesIor: parseFloat(e.target.value),
                        }))
                      }
                      className="w-full accent-amber-400"
                    />
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-300">Rebote Luz Indirecta (GI)</span>
                      <span className="font-mono text-amber-300">
                        {settings.cyclesGiBounceBoost.toFixed(2)}x
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0.6}
                      max={2.4}
                      step={0.05}
                      value={settings.cyclesGiBounceBoost}
                      onChange={(e) =>
                        setSettings((prev) => ({
                          ...prev,
                          cyclesGiBounceBoost: parseFloat(e.target.value),
                        }))
                      }
                      className="w-full accent-amber-400"
                    />
                  </div>
                </div>
              )}

              {/* Si está en modo MatCap, mostrar los 4 acabados de estudio */}
              {settings.shadingMode === 'matcap' && (
                <div className="space-y-2 pt-2 border-t border-slate-800/70">
                  <span className="font-medium text-slate-300 block">Acabado MatCap de Estudio:</span>
                  <div className="grid grid-cols-2 gap-1.5">
                    {MATCAP_PRESETS.map((mc) => (
                      <button
                        key={mc.id}
                        type="button"
                        onClick={() => setSettings((prev) => ({ ...prev, matcapPreset: mc.id }))}
                        className={`p-2 rounded-lg border flex items-center gap-2 transition-colors cursor-pointer ${
                          settings.matcapPreset === mc.id
                            ? 'bg-slate-800 border-amber-400 text-white'
                            : 'bg-slate-900/70 border-slate-800 text-slate-300 hover:bg-slate-800'
                        }`}
                      >
                        <span
                          className="w-4 h-4 rounded-full shrink-0 border border-white/20"
                          style={{ backgroundColor: mc.swatchHex }}
                        />
                        <span className="truncate font-medium">{mc.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Control de Zoom de Precisión e Inspección Macro en Pestaña Luz & Vista */}
              <div className="space-y-2 pt-2 border-t border-slate-800/70">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-200 flex items-center gap-1.5">
                    <Focus className="w-3.5 h-3.5 text-amber-400" />
                    Zoom de Acercamiento (Macro)
                  </span>
                  <span className="font-mono tabular-nums text-amber-400">{zoomPercent}%</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => sceneRefs.current?.zoomByFactor(1.35)}
                    className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 cursor-pointer"
                    title="Alejar (-)"
                  >
                    -
                  </button>
                  <input
                    type="range"
                    min={30}
                    max={1500}
                    step={10}
                    value={Math.min(1500, Math.max(30, zoomPercent))}
                    onChange={(e) =>
                      sceneRefs.current?.setZoomLevelPercent(parseFloat(e.target.value))
                    }
                    className="w-full"
                  />
                  <button
                    type="button"
                    onClick={() => sceneRefs.current?.zoomByFactor(0.72)}
                    className="px-2 py-1 rounded bg-amber-400/20 hover:bg-amber-400/35 border border-amber-400/40 text-amber-300 font-bold cursor-pointer"
                    title="Acercar (+)"
                  >
                    +
                  </button>
                </div>
                <p className="text-[10px] text-slate-400 leading-tight">
                  Haz <strong>doble clic</strong> sobre cualquier punto del objeto 3D para enfocar y acercar la cámara directamente a ese detalle.
                </p>
              </div>

              {/* Dirección e Intensidad de la Luz Principal */}
              <div className="space-y-2.5 pt-2 border-t border-slate-800/70">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                    <Sun className="w-3.5 h-3.5 text-amber-400" />
                    Intensidad de Luz Estudio
                  </span>
                  <span className="font-mono tabular-nums text-amber-400">
                    {settings.lightIntensity.toFixed(1)}x
                  </span>
                </div>
                <input
                  type="range"
                  min={0.8}
                  max={4.2}
                  step={0.1}
                  value={settings.lightIntensity}
                  onChange={(e) =>
                    setSettings((prev) => ({ ...prev, lightIntensity: parseFloat(e.target.value) }))
                  }
                  className="w-full"
                />

                <div className="flex items-center justify-between pt-1">
                  <span className="font-medium text-slate-200">Rotación del Sol (Key Light)</span>
                  <span className="font-mono tabular-nums text-amber-400">
                    {settings.lightAngle}°
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={360}
                  step={5}
                  value={settings.lightAngle}
                  onChange={(e) =>
                    setSettings((prev) => ({ ...prev, lightAngle: parseInt(e.target.value, 10) }))
                  }
                  className="w-full"
                />
              </div>

              {/* Opciones de Visibilidad y Ambiente */}
              <div className="space-y-2 pt-2 border-t border-slate-800/70">
                <div className="flex items-center justify-between">
                  <span className="text-slate-300">Luz Frontal de Cámara</span>
                  <button
                    type="button"
                    onClick={() =>
                      setSettings((prev) => ({
                        ...prev,
                        followCameraLight: !prev.followCameraLight,
                      }))
                    }
                    className={`px-2.5 py-1 rounded text-[11px] font-medium cursor-pointer ${
                      settings.followCameraLight
                        ? 'bg-amber-400 text-slate-950 font-semibold'
                        : 'bg-slate-800 text-slate-300'
                    }`}
                  >
                    {settings.followCameraLight ? 'Activa' : 'Apagada'}
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-300">Plataforma y Cuadrícula</span>
                  <button
                    type="button"
                    onClick={() =>
                      setSettings((prev) => ({
                        ...prev,
                        showPedestalGrid: !prev.showPedestalGrid,
                      }))
                    }
                    className={`px-2.5 py-1 rounded text-[11px] font-medium cursor-pointer ${
                      settings.showPedestalGrid
                        ? 'bg-amber-400 text-slate-950 font-semibold'
                        : 'bg-slate-800 text-slate-300'
                    }`}
                  >
                    {settings.showPedestalGrid ? 'Visible' : 'Oculta'}
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-300">Rotación Automática</span>
                  <button
                    type="button"
                    onClick={() =>
                      setSettings((prev) => ({ ...prev, autoRotate: !prev.autoRotate }))
                    }
                    className={`px-2.5 py-1 rounded text-[11px] font-medium cursor-pointer ${
                      settings.autoRotate
                        ? 'bg-amber-400 text-slate-950 font-semibold'
                        : 'bg-slate-800 text-slate-300'
                    }`}
                  >
                    {settings.autoRotate ? 'Girando' : 'Estático'}
                  </button>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-slate-300">Fondo de Estudio</span>
                  <div className="flex items-center gap-1.5">
                    {BG_PRESETS.map((preset) => (
                      <button
                        key={preset.hex}
                        type="button"
                        title={preset.label}
                        onClick={() => setSettings((prev) => ({ ...prev, bgColor: preset.hex }))}
                        style={{ backgroundColor: preset.hex }}
                        className={`w-5 h-5 rounded-full border transition-transform cursor-pointer ${
                          settings.bgColor.toLowerCase() === preset.hex.toLowerCase()
                            ? 'border-amber-400 scale-115'
                            : 'border-slate-600 hover:scale-105'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* PESTAÑA 3: TEXTURAS PROCEDURALES PBR (PIEDRA, MADERA, AGUA, MÁRMOL, ARENA, METALES, ETC.) */}
          {activeTabPanel === 'textures' && (
            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider">
                  Biblioteca de Texturas PBR 3D
                </span>
                {activeTexture !== 'none' && (
                  <button
                    type="button"
                    onClick={() => setActiveTexture('none')}
                    className="text-[10px] px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-amber-300 font-medium cursor-pointer"
                  >
                    Quitar Textura
                  </button>
                )}
              </div>

              {/* Filtro por categorías de textura */}
              <div className="grid grid-cols-5 gap-1 bg-slate-900 p-1 rounded-lg text-[10px] font-medium">
                {(
                  [
                    { id: 'all', label: 'Todas' },
                    { id: 'natural', label: 'Natura' },
                    { id: 'arquitectura', label: 'Piedra/Arq' },
                    { id: 'tejidos', label: 'Tejidos' },
                    { id: 'fantasia', label: 'Sci-Fi' },
                  ] as const
                ).map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setTextureCategoryFilter(cat.id)}
                    className={`py-1 rounded transition-colors cursor-pointer text-center ${
                      textureCategoryFilter === cat.id
                        ? 'bg-amber-400 text-slate-950 font-semibold'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              {/* Controles de Escala UV (Tiling), Relieve 3D (Bump) y Modo de Color */}
              {activeTexture !== 'none' && (
                <div className="p-2.5 rounded-lg bg-slate-900/90 border border-amber-400/35 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-slate-300 font-medium">Paleta de Color:</span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setTextureUseNaturalColor(true)}
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold cursor-pointer ${
                          textureUseNaturalColor
                            ? 'bg-amber-400 text-slate-950'
                            : 'bg-slate-800 text-slate-300 hover:text-white'
                        }`}
                        title="Aplica el color realista propio del material (piedra, madera, agua, mármol, oro)"
                      >
                        Color Textura
                      </button>
                      <button
                        type="button"
                        onClick={() => setTextureUseNaturalColor(false)}
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold cursor-pointer ${
                          !textureUseNaturalColor
                            ? 'bg-amber-400 text-slate-950'
                            : 'bg-slate-800 text-slate-300 hover:text-white'
                        }`}
                        title="Mantiene los colores originales de cada pieza del modelo aplicando el patrón y relieve encima"
                      >
                        Color Piezas
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-300">Escala / Repetición UV</span>
                      <span className="font-mono text-amber-400">{textureRepeatScale}×{textureRepeatScale}</span>
                    </div>
                    <input
                      type="range"
                      min={1}
                      max={8}
                      step={1}
                      value={textureRepeatScale}
                      onChange={(e) => setTextureRepeatScale(parseInt(e.target.value, 10))}
                      className="w-full accent-amber-400"
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-300">Profundidad de Relieve (Bump)</span>
                      <span className="font-mono text-amber-400">
                        {Math.round(textureBumpIntensity * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={2.5}
                      step={0.1}
                      value={textureBumpIntensity}
                      onChange={(e) => setTextureBumpIntensity(parseFloat(e.target.value))}
                      className="w-full accent-amber-400"
                    />
                  </div>
                </div>
              )}

              {/* Lista de Texturas Procedurales */}
              <div className="space-y-1.5 max-h-[340px] overflow-y-auto pr-1">
                {TEXTURE_PRESETS.filter(
                  (p) =>
                    p.id === 'none' ||
                    textureCategoryFilter === 'all' ||
                    p.category === textureCategoryFilter
                ).map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => setActiveTexture(preset.id)}
                    className={`w-full text-left p-2 rounded-lg transition-colors cursor-pointer flex items-center gap-2.5 ${
                      activeTexture === preset.id
                        ? 'bg-amber-400/15 border border-amber-400 text-white'
                        : 'bg-slate-900/60 hover:bg-slate-800/80 border border-slate-800 text-slate-300'
                    }`}
                  >
                    <div
                      className="w-6 h-6 rounded-md border border-slate-600 shrink-0 shadow-inner"
                      style={{ backgroundColor: preset.thumbnailColor }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-semibold text-xs text-slate-100 truncate">
                          {preset.name}
                        </span>
                        {preset.id !== 'none' && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 shrink-0">
                            {preset.category === 'natural'
                              ? 'Natura'
                              : preset.category === 'arquitectura'
                              ? 'Arquitectura'
                              : 'Fantasía'}
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-400 truncate">
                        {preset.description}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* PESTAÑA 4: SHADERS, EEVEE, CYCLES Y POSTPROCESADO */}
          {activeTabPanel === 'shaders' && (
            <div className="space-y-4 text-xs">
              {/* Selector rápido de Motor de Render en la pestaña Shaders */}
              <div className="space-y-1.5">
                <span className="font-semibold text-slate-200 block">
                  Motor de Render Activo (Blender 5.2)
                </span>
                <div className="grid grid-cols-3 gap-1.5">
                  {(
                    [
                      { id: 'cel', label: 'Cel-Shade' },
                      { id: 'eevee', label: '⚡ EEVEE' },
                      { id: 'cycles', label: '💎 Cycles' },
                    ] as const
                  ).map((eng) => (
                    <button
                      key={eng.id}
                      type="button"
                      onClick={() =>
                        setSettings((prev) => ({ ...prev, shadingMode: eng.id, wireframe: false }))
                      }
                      className={`py-1.5 px-2 rounded-md font-semibold border text-center transition-colors cursor-pointer ${
                        settings.shadingMode === eng.id
                          ? 'bg-amber-400 text-slate-950 border-amber-300'
                          : 'bg-slate-900 border-slate-800 text-slate-300 hover:text-white'
                      }`}
                    >
                      {eng.label}
                    </button>
                  ))}
                </div>
              </div>

              {settings.shadingMode === 'eevee' && (
                <div className="p-2.5 rounded-lg bg-sky-500/10 border border-sky-400/35 space-y-2">
                  <div className="flex items-center justify-between text-sky-300 font-semibold">
                    <span>EEVEE Next (Bloom & IBL)</span>
                    <span className="font-mono text-[10px]">Tiempo Real</span>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-300">Intensidad Bloom</span>
                      <span className="font-mono text-sky-300">
                        {Math.round(settings.eeveeBloomIntensity * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={1.5}
                      step={0.05}
                      value={settings.eeveeBloomIntensity}
                      onChange={(e) =>
                        setSettings((prev) => ({
                          ...prev,
                          eeveeBloomIntensity: parseFloat(e.target.value),
                        }))
                      }
                      className="w-full accent-sky-400"
                    />
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-300">Reflejos HDRI (IBL)</span>
                      <span className="font-mono text-sky-300">
                        {settings.eeveeEnvIntensity.toFixed(2)}x
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0.2}
                      max={3.0}
                      step={0.05}
                      value={settings.eeveeEnvIntensity}
                      onChange={(e) =>
                        setSettings((prev) => ({
                          ...prev,
                          eeveeEnvIntensity: parseFloat(e.target.value),
                        }))
                      }
                      className="w-full accent-sky-400"
                    />
                  </div>
                </div>
              )}

              {settings.shadingMode === 'cycles' && (
                <div className="p-2.5 rounded-lg bg-amber-400/10 border border-amber-400/35 space-y-2">
                  <div className="flex items-center justify-between text-amber-300 font-semibold">
                    <span>Cycles (Physical Raytrace)</span>
                    <span className="font-mono text-[10px]">
                      {cyclesCurrentSample}/{settings.cyclesSamples} samp
                    </span>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-300">Barniz Clearcoat</span>
                      <span className="font-mono text-amber-300">
                        {Math.round(settings.cyclesClearcoat * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      value={settings.cyclesClearcoat}
                      onChange={(e) =>
                        setSettings((prev) => ({
                          ...prev,
                          cyclesClearcoat: parseFloat(e.target.value),
                        }))
                      }
                      className="w-full accent-amber-400"
                    />
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-300">Rebote GI & Reflejos</span>
                      <span className="font-mono text-amber-300">
                        {settings.cyclesGiBounceBoost.toFixed(2)}x
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0.6}
                      max={2.4}
                      step={0.05}
                      value={settings.cyclesGiBounceBoost}
                      onChange={(e) =>
                        setSettings((prev) => ({
                          ...prev,
                          cyclesGiBounceBoost: parseFloat(e.target.value),
                        }))
                      }
                      className="w-full accent-amber-400"
                    />
                  </div>
                </div>
              )}

              <div className="space-y-1.5 pt-2 border-t border-slate-800/60">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-200">Suavizado de Normales</span>
                  <span className="font-mono tabular-nums text-amber-400">
                    {Math.round(settings.normalSmoothing * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={settings.normalSmoothing}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      normalSmoothing: parseFloat(e.target.value),
                    }))
                  }
                  className="w-full"
                />
                <div className="flex justify-between text-[10px] text-slate-400">
                  <span>0% Facetado</span>
                  <span>65% Soldado</span>
                  <span>100% Esférico</span>
                </div>
              </div>

              <div className="space-y-1.5 pt-2 border-t border-slate-800/60">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-200">Grosor de Contorno (Outline)</span>
                  <span className="font-mono tabular-nums text-amber-400">
                    {settings.outlineThickness.toFixed(2)} px
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={3.0}
                  step={0.05}
                  value={settings.outlineThickness}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      outlineThickness: parseFloat(e.target.value),
                    }))
                  }
                  className="w-full"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-200">Opacidad de Contorno</span>
                  <span className="font-mono tabular-nums text-amber-400">
                    {Math.round(settings.outlineOpacity * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1.0}
                  step={0.02}
                  value={settings.outlineOpacity}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      outlineOpacity: parseFloat(e.target.value),
                    }))
                  }
                  className="w-full"
                />
              </div>

              <div className="space-y-1.5 pt-2 border-t border-slate-800/60">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-200">Oclusión Ambiental (SSAO)</span>
                  <span className="font-mono tabular-nums text-amber-400">
                    {Math.round((settings.ssaoIntensity / 2.5) * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={2.5}
                  step={0.05}
                  value={settings.ssaoIntensity}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      ssaoIntensity: parseFloat(e.target.value),
                    }))
                  }
                  className="w-full"
                />
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-800/60">
                <span className="font-medium text-slate-200">Filtro Anti-Aliasing</span>
                <div className="flex items-center gap-1 p-0.5 bg-slate-900 rounded-md border border-slate-800">
                  {(['SMAA', 'FXAA'] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setSettings((prev) => ({ ...prev, aaMode: mode }))}
                      className={`px-2.5 py-1 text-[11px] font-medium rounded transition-colors cursor-pointer ${
                        settings.aaMode === mode
                          ? 'bg-amber-400 text-slate-950 font-semibold'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
          </aside>
        )}
      </div>

      {/* Dock Inferior Colapsable */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center max-w-[min(940px,94vw)] w-full pointer-events-none">
        <button
          type="button"
          onClick={() => setDockCollapsed((prev) => !prev)}
          className="pointer-events-auto flex items-center gap-1.5 px-3.5 py-1 text-xs font-medium text-slate-300 bg-slate-950/90 border border-slate-800 rounded-t-lg hover:text-white transition-colors cursor-pointer"
        >
          {dockCollapsed ? (
            <>
              <ChevronUp className="w-3.5 h-3.5 text-amber-400" />
              <span>Mostrar Controles Rápidos (H)</span>
            </>
          ) : (
            <>
              <ChevronDown className="w-3.5 h-3.5 text-amber-400" />
              <span>Modo Zen / Ocultar Paneles (H)</span>
            </>
          )}
        </button>

        {!dockCollapsed && (
          <div className="pointer-events-auto w-full bg-slate-950/92 border border-slate-800 rounded-xl px-5 py-3 shadow-2xl flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-[180px] flex-1">
              <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
              <div className="w-full">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-300 font-medium">Suavizado Esférico</span>
                  <span className="font-mono tabular-nums text-amber-400">
                    {Math.round(settings.normalSmoothing * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={settings.normalSmoothing}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      normalSmoothing: parseFloat(e.target.value),
                    }))
                  }
                  className="w-full"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 min-w-[160px] flex-1">
              <Layers className="w-4 h-4 text-amber-400 shrink-0" />
              <div className="w-full">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-300 font-medium">Contorno Outline</span>
                  <span className="font-mono tabular-nums text-amber-400">
                    {settings.outlineThickness.toFixed(2)} px
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={3}
                  step={0.05}
                  value={settings.outlineThickness}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      outlineThickness: parseFloat(e.target.value),
                    }))
                  }
                  className="w-full"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 min-w-[160px] flex-1">
              <Eye className="w-4 h-4 text-amber-400 shrink-0" />
              <div className="w-full">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-300 font-medium">Sombras SSAO</span>
                  <span className="font-mono tabular-nums text-amber-400">
                    {Math.round((settings.ssaoIntensity / 2.5) * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={2.5}
                  step={0.05}
                  value={settings.ssaoIntensity}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      ssaoIntensity: parseFloat(e.target.value),
                    }))
                  }
                  className="w-full"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => sceneRefs.current?.frameModel(1.25)}
                title="Encuadrar el modelo completo"
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-200 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Centrar
              </button>

              <button
                type="button"
                onClick={() => {
                  setSettings(DEFAULT_SETTINGS);
                  setActiveTexture('none');
                  sceneRefs.current?.loadProceduralFallback();
                }}
                title="Restaurar geometría y ajustes iniciales"
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-200 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Reiniciar Todo
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Notificación flotante de Feedback (Toast) */}
      {cloudFeedback && (
        <div
          className={`fixed top-16 right-6 z-50 flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-2xl border text-xs font-semibold animate-in fade-in slide-in-from-top-2 ${
            cloudFeedback.type === 'success'
              ? 'bg-emerald-950/95 border-emerald-500/50 text-emerald-200'
              : 'bg-rose-950/95 border-rose-500/50 text-rose-200'
          }`}
        >
          {cloudFeedback.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          ) : (
            <X className="w-4 h-4 text-rose-400" />
          )}
          <span>{cloudFeedback.text}</span>
        </div>
      )}

      {/* Modal de Modelos Guardados en la Nube (Google Cloud / Firestore) */}
      {isCloudModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 bg-slate-950/60">
              <div className="flex items-center gap-2.5">
                <Cloud className="w-5 h-5 text-amber-400" />
                <div>
                  <h3 className="text-sm font-bold text-white">Mis Modelos 3D en la Nube</h3>
                  <p className="text-[11px] text-slate-400">
                    Sincronizados en tu cuenta de Google ({currentUser?.email || 'Conectado'})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCloudModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 flex-1 overflow-y-auto space-y-3">
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                <div>
                  <span className="text-xs font-semibold text-slate-200 block">
                    Guardar Estado Actual de la Escena
                  </span>
                  <span className="text-[11px] text-slate-400">
                    Almacena la geometría activa ({modelStats.triangles} triángulos)
                  </span>
                </div>
                <button
                  type="button"
                  disabled={isSavingToCloud}
                  onClick={handleQuickSaveToCloud}
                  className="px-3.5 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                >
                  <CloudUpload className="w-3.5 h-3.5" />
                  <span>{isSavingToCloud ? 'Guardando...' : 'Guardar Actual'}</span>
                </button>
              </div>

              {cloudModelsList.length === 0 ? (
                <div className="text-center py-12 px-4 rounded-xl border border-dashed border-slate-800">
                  <Cloud className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-slate-300">
                    Aún no tienes modelos guardados en tu cuenta
                  </p>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                    Genera una figura con Gemini Python o esculpe el modelo y pulsa "Guardar Actual" para tenerlo accesible siempre.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {cloudModelsList.map((model) => (
                    <div
                      key={model.id}
                      className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/80 hover:border-amber-400/40 transition-colors flex flex-col justify-between gap-3"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="text-xs font-bold text-white truncate">{model.title}</h4>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 tabular-nums shrink-0">
                            {model.triangles || 0} tris
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 line-clamp-2 mt-1">
                          {model.summary || 'Modelo procedural Python 3D'}
                        </p>
                        <div className="text-[10px] text-slate-500 mt-2">
                          {new Date(model.createdAt).toLocaleDateString(undefined, {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-800/80">
                        <button
                          type="button"
                          onClick={() => handleLoadCloudModel(model)}
                          className="flex-1 py-1 px-2 rounded-md bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-semibold text-center transition-colors cursor-pointer"
                        >
                          Cargar en Escena
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteCloudModel(model.id)}
                          className="p-1 rounded-md text-slate-500 hover:text-red-400 hover:bg-slate-800 transition-colors cursor-pointer"
                          title="Eliminar de la nube"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal de Python Scripting estilo Blender */}
      <PythonScriptModal
        isOpen={isPythonModalOpen}
        onClose={() => setIsPythonModalOpen(false)}
        onRunScript={handleRunPythonScript}
        onClearScene={handleClearSceneFromZero}
        externalCode={lastGeneratedPythonCode}
        getViewportSnapshot={getViewportSnapshot}
        getSceneBounds={getSceneBounds}
        selectedModel={selectedGeminiModel}
        onModelChange={setSelectedGeminiModel}
        thinkingLevel={selectedThinkingLevel}
        onThinkingLevelChange={setSelectedThinkingLevel}
        userEmail={currentUser?.email}
        onUsageUpdated={setWeeklyUsageStats}
        coordinateMode={coordinateMode}
        onCoordinateModeChange={(mode) => void handleQuickCoordinateModeChange(mode)}
        onSwapSceneAxesYZ={handleSwapSceneAxesYZ}
      />

      {/* Drag & Drop Overlay */}
      {isDraggingFile && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 border-4 border-dashed border-amber-400 flex flex-col items-center justify-center pointer-events-none">
          <Upload className="w-12 h-12 text-amber-400 mb-3" />
          <p className="text-lg font-semibold text-white">
            Suelta tu archivo .GLB / .GLTF para cargar y modelar
          </p>
          <p className="text-xs text-slate-400 mt-1">
            Se centrará automáticamente y aplicará la cadena de suavizado, texturas y shaders
          </p>
        </div>
      )}

      {/* Loading Overlay */}
      {isLoadingGlb && (
        <div className="fixed inset-0 z-40 bg-slate-950/75 flex flex-col items-center justify-center">
          <div className="px-6 py-4 bg-slate-900 border border-slate-800 rounded-xl text-center">
            <p className="text-sm font-semibold text-white">
              Cargando y procesando geometría .GLB...
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Soldando normales y preparando pipeline de escultura
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
