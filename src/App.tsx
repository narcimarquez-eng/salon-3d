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
  generateProceduralTexture,
} from './utils/proceduralTextures';
import {
  MATCAP_PRESETS,
  MatcapPresetId,
  getProceduralMatcapTexture,
} from './utils/matcapGenerator';
import {
  SculptBrushSettings,
  applySculptBrushToMesh,
  applyGlobalLaplacianSmoothing,
  subdivideAndSmoothModel,
  decimateModelGeometry,
  exportModifiedGlb,
  createBrushIndicatorMesh,
  pushUndoSnapshot,
  popUndoSnapshot,
  popRedoSnapshot,
  saveMasterDrawingCheckpoint,
  restoreMasterDrawingCheckpoint,
} from './utils/meshDeformer';
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

export type ShadingModeType = 'cel' | 'matcap' | 'normals' | 'original';
export type CameraPresetType = 'hero' | 'front' | 'closeup' | 'side' | 'top';

interface PipelineSettings {
  normalSmoothing: number;   // 0.0 (Facetado Low-Poly) -> 1.0 (Suavizado Esférico Total)
  outlineThickness: number;  // Grosor de la línea de contorno (0.0 -> 3.0)
  outlineOpacity: number;    // Opacidad de la línea de contorno (0.0 -> 1.0)
  ssaoIntensity: number;     // Intensidad de sombras de contacto SSAO (0.0 -> 2.5)
  bgColor: string;           // Color de fondo de la escena
  autoRotate: boolean;       // Rotación automática del enemigo
  autoRotateSpeed: number;   // Velocidad de rotación
  aaMode: 'SMAA' | 'FXAA';   // Algoritmo Anti-Aliasing activo
  shadingMode: ShadingModeType; // Modo de sombreado: Cel-Shading, MatCap Escultura, Normales RGB, Original
  matcapPreset: MatcapPresetId; // Tipo de MatCap activo
  wireframe: boolean;        // Mostrar estructura poligonal
  showPedestalGrid: boolean; // Mostrar plataforma/anillo de referencia en la base
  lightIntensity: number;    // Intensidad de la luz principal (0.5 -> 4.0)
  lightAngle: number;        // Ángulo horizontal de la luz principal en grados (0 -> 360)
  followCameraLight: boolean;// Luz frontal acoplada a la cámara para inspección clara sin zonas oscuras
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

  // Herramientas de Edición con Ratón (con Simetría X activada por defecto)
  const [brushSettings, setBrushSettings] = useState<SculptBrushSettings>({
    mode: 'smooth',
    radius: 0.42,
    strength: 0.45,
    paintColor: '#38bdf8',
    symmetryX: true,
  });
  const [activeTexture, setActiveTexture] = useState<TexturePatternType>('none');
  const [decimateRatio, setDecimateRatio] = useState<number>(0.35);
  const [preserveDecimateFeatures, setPreserveDecimateFeatures] = useState<boolean>(true);
  const [decimateFeedback, setDecimateFeedback] = useState<string | null>(null);
  const [isDecimating, setIsDecimating] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);
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
  const [activeTabPanel, setActiveTabPanel] = useState<'tools' | 'lighting' | 'textures' | 'shaders'>('tools');
  const [activeCameraPreset, setActiveCameraPreset] = useState<CameraPresetType>('hero');

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
    fxaaPass: ShaderPass;
    smaaPass: SMAAPass;
    keyLight: THREE.DirectionalLight;
    headLight: THREE.DirectionalLight;
    pedestalGroup: THREE.Group;
    gradientTexture: THREE.DataTexture;
    brushIndicator: THREE.Mesh;
    symmetryIndicator: THREE.Mesh;
    currentModelWrapper: THREE.Group | null;
    loadGlbFromFile: (file: File) => void;
    loadProceduralFallback: () => void;
    setCameraViewPreset: (preset: CameraPresetType) => void;
    recalculateStats: () => void;
    captureScreenshot: () => void;
    captureDataUrl: () => string;
    frameModel: (margen?: number) => void;
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

    // Iluminación de estudio ajustable
    const rad = THREE.MathUtils.degToRad(settings.lightAngle);
    refs.keyLight.position.set(Math.sin(rad) * 4.8, 4.6, Math.cos(rad) * 4.8);
    refs.keyLight.intensity = settings.lightIntensity;
    refs.headLight.intensity = settings.followCameraLight ? 1.15 : 0.0;

    // Rotación automática
    refs.controls.autoRotate = settings.autoRotate;
    refs.controls.autoRotateSpeed = settings.autoRotateSpeed;

    const matcapTex = getProceduralMatcapTexture(settings.matcapPreset);

    // Actualizar Outline Shader, modo de material (Cel / MatCap / Normals / PBR) y Wireframe
    if (refs.currentModelWrapper) {
      refs.currentModelWrapper.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const mesh = child as THREE.Mesh;
          if (mesh.userData.isOutlineMesh) {
            const mat = mesh.material as THREE.ShaderMaterial;
            if (mat && mat.uniforms) {
              const showOutline =
                (settings.shadingMode === 'cel' || settings.shadingMode === 'matcap') &&
                !settings.wireframe;
              mat.uniforms.uThickness.value = showOutline ? settings.outlineThickness * 0.013 : 0;
              mat.uniforms.uOpacity.value = showOutline ? settings.outlineOpacity : 0;
            }
          } else {
            const matcapMat = mesh.userData.matcapMaterial as THREE.MeshMatcapMaterial | undefined;
            if (matcapMat) {
              matcapMat.matcap = matcapTex;
              matcapMat.needsUpdate = true;
            }

            let targetMat: THREE.Material = mesh.userData.toonMaterial;
            if (settings.shadingMode === 'matcap' && mesh.userData.matcapMaterial) {
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

    // Actualizar SSAO Pass
    refs.ssaoPass.enabled = settings.ssaoIntensity > 0.02 && !settings.wireframe;
    refs.ssaoPass.kernelRadius = THREE.MathUtils.lerp(4, 22, settings.ssaoIntensity / 2.5);
    refs.ssaoPass.maxDistance = THREE.MathUtils.lerp(0.04, 0.15, settings.ssaoIntensity / 2.5);

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
    refs.comicPass.uniforms.uSsaoBoost.value = settings.ssaoIntensity;

    // Alternar filtro Anti-Aliasing (SMAA vs FXAA)
    refs.smaaPass.enabled = settings.aaMode === 'SMAA';
    refs.fxaaPass.enabled = settings.aaMode === 'FXAA';
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
  ]);

  // Aplicar textura procedural seleccionada en tiempo real sobre los materiales
  useEffect(() => {
    const refs = sceneRefs.current;
    if (!refs || !refs.currentModelWrapper) return;

    const proceduralTexture = generateProceduralTexture(activeTexture);
    refs.currentModelWrapper.traverse((child) => {
      if ((child as THREE.Mesh).isMesh && !child.userData.isOutlineMesh) {
        const mesh = child as THREE.Mesh;
        const toonMat = mesh.userData.toonMaterial as THREE.MeshToonMaterial;
        if (toonMat) {
          toonMat.map = proceduralTexture || (mesh.userData.originalMap || null);
          toonMat.needsUpdate = true;
        }
      }
    });
  }, [activeTexture]);

  // Actualizar tamaño y color visual de los cursores 3D del pincel (Principal + Espejo X)
  useEffect(() => {
    const refs = sceneRefs.current;
    if (!refs) return;
    const s = brushSettings.radius;
    const col = brushSettings.mode === 'paint' ? brushSettings.paintColor : '#f59e0b';

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

    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 100);
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

    // 5. Anillos indicadores 3D para el Pincel del Ratón (Principal + Simetría X)
    const brushIndicator = createBrushIndicatorMesh();
    scene.add(brushIndicator);

    const symmetryIndicator = createBrushIndicatorMesh();
    (symmetryIndicator.material as THREE.MeshBasicMaterial).color.set('#38bdf8');
    (symmetryIndicator.material as THREE.MeshBasicMaterial).opacity = 0.65;
    scene.add(symmetryIndicator);

    // 6. OrbitControls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.07;
    controls.autoRotate = settingsRef.current.autoRotate;
    controls.autoRotateSpeed = settingsRef.current.autoRotateSpeed;
    controls.minDistance = 1.1;
    controls.maxDistance = 9.0;
    controls.target.set(0, 0.12, 0);
    controls.update();

    // Cancelar transición automática de cámara si el usuario orbita manualmente
    controls.addEventListener('start', () => {
      cameraTransitionRef.current.active = false;
    });

    // 7. Cadena de Postprocesado (EffectComposer)
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
        trans.targetPos.set(0, 0.72, 2.05);
        trans.targetLookAt.set(0, 0.62, 0);
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
      brushIndicator.visible = false;
      symmetryIndicator.visible = false;
      if (isSoftwareGl) renderer.render(scene, camera);
      else composer.render();
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

    // Raycasting para detección y escultura con el ratón (Soporta Clic Izquierdo para esculpir y Clic Derecho para orbitar)
    const raycaster = new THREE.Raycaster();
    const mouseVec = new THREE.Vector2();
    let isSculptingStroke = false;

    const performSculptAtPointer = (e: MouseEvent | PointerEvent) => {
      if (!currentModelWrapper || brushSettingsRef.current.mode === 'none') {
        brushIndicator.visible = false;
        symmetryIndicator.visible = false;
        return;
      }

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
        const hit = intersects[0];
        brushIndicator.position.copy(hit.point);
        const worldNormal = hit.face
          ? hit.face.normal.clone().transformDirection(hit.object.matrixWorld).normalize()
          : new THREE.Vector3(0, 0, 1);

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
          const hitMesh = hit.object as THREE.Mesh;
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
      } else {
        brushIndicator.visible = false;
        symmetryIndicator.visible = false;
      }
    };

    const handlePointerDown = (e: PointerEvent) => {
      // Solo esculpir con botón izquierdo (e.button === 0) cuando el ratón impacta sobre el modelo.
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
          performSculptAtPointer(e);
        }
      }
    };

    const handlePointerMove = (e: PointerEvent) => {
      performSculptAtPointer(e);
    };

    const handlePointerUp = () => {
      if (isSculptingStroke) {
        isSculptingStroke = false;
        controls.enabled = true;
        recalculateStats();
      }
    };

    renderer.domElement.addEventListener('pointerdown', handlePointerDown);
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
      fxaaPass,
      smaaPass,
      keyLight,
      headLight,
      pedestalGroup,
      gradientTexture,
      brushIndicator,
      symmetryIndicator,
      currentModelWrapper,
      loadGlbFromFile,
      loadProceduralFallback,
      setCameraViewPreset,
      recalculateStats,
      captureScreenshot,
      captureDataUrl,
      frameModel,
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

      comicPass.uniforms.uResolution.value.set(w * pr, h * pr);
      fxaaPass.material.uniforms['resolution'].value.set(1 / (w * pr), 1 / (h * pr));
    };

    window.addEventListener('resize', handleResize);

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

      if (currentMixer) {
        currentMixer.update(delta);
      }

      // Interpolación suave de presets de cámara (Exponential Damping)
      const camTrans = cameraTransitionRef.current;
      if (camTrans.active) {
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

      controls.update();

      // Acoplar luz frontal suave a la posición de la cámara para visibilidad total
      headLight.position.copy(camera.position);

      if (isSoftwareGl) {
        renderer.render(scene, camera);
        afterDraw(tick);
      } else {
        composer.render();
        frameId = requestAnimationFrame(tick);
      }
    }

    tick();

    return () => {
      renderer.domElement.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      clearCurrentModel();
      dracoLoader.dispose();
      gradientTexture.dispose();
      contactShadowTex.dispose();
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

  // Exportar el modelo modificado a archivo .GLB binario
  const handleExportGlb = async () => {
    const refs = sceneRefs.current;
    if (!refs || !refs.currentModelWrapper || isExporting) return;

    setIsExporting(true);
    try {
      const cleanName = modelStats.name.replace(/\.[^/.]+$/, '');
      await exportModifiedGlb(refs.currentModelWrapper, `${cleanName}_modificado.glb`);
    } catch (err) {
      console.error('Error al exportar:', err);
    } finally {
      setIsExporting(false);
    }
  };

  // Ejecución de Scripts Python estilo Blender 5.2
  const handleRunPythonScript = async (
    code: string,
    customModelLabel?: string,
    coordinateMode: BlenderCoordinateMode = 'auto'
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

    pushUndoSnapshot(refs.currentModelWrapper);
    const result = await executeBlenderPythonScript(code, refs.currentModelWrapper, {
      onTextureChange: (tex) => setActiveTexture(tex),
      outlineThickness: settingsRef.current.outlineThickness,
      outlineOpacity: settingsRef.current.outlineOpacity,
      normalSmoothing: settingsRef.current.normalSmoothing,
      coordinateMode,
    });

    // Sincronizar el modo de sombreado activo (Cel, MatCap, Normales, Original) y Wireframe en las nuevas mallas
    const matcapTex = getProceduralMatcapTexture(settingsRef.current.matcapPreset);
    refs.currentModelWrapper.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        if (mesh.userData.isOutlineMesh) {
          const mat = mesh.material as THREE.ShaderMaterial;
          if (mat && mat.uniforms) {
            const showOutline =
              (settingsRef.current.shadingMode === 'cel' ||
                settingsRef.current.shadingMode === 'matcap') &&
              !settingsRef.current.wireframe;
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
          if (settingsRef.current.shadingMode === 'matcap' && mesh.userData.matcapMaterial) {
            targetMat = mesh.userData.matcapMaterial;
          } else if (
            settingsRef.current.shadingMode === 'normals' &&
            mesh.userData.normalDebugMaterial
          ) {
            targetMat = mesh.userData.normalDebugMaterial;
          } else if (
            settingsRef.current.shadingMode === 'original' &&
            mesh.userData.originalMaterial
          ) {
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

    if (!result.success || activeMeshCount === 0) {
      // Si el script falló o borró todo sin dejar mallas válidas, restaurar el checkpoint o undo para no dejar la pantalla vacía/negra
      const restored = restoreMasterDrawingCheckpoint(
        refs.currentModelWrapper,
        settingsRef.current.normalSmoothing
      );
      if (!restored) {
        popUndoSnapshot(refs.currentModelWrapper, settingsRef.current.normalSmoothing);
      }
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

  // Calcular dimensiones exactas (Bounding Box) del modelo 3D activo para calibrar coordenadas
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
    return {
      minY: Number(box.min.y.toFixed(2)),
      maxY: Number(box.max.y.toFixed(2)),
      widthX: Number(size.x.toFixed(2)),
      depthZ: Number(size.z.toFixed(2)),
      meshCount,
    };
  }, []);

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
      className="relative w-screen h-screen overflow-hidden select-none bg-[#1e2536] text-slate-100"
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
      <header className="relative z-10 flex items-center justify-between gap-8 px-6 py-3 bg-slate-950/90 border-b border-slate-800/90">
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

        {/* Zona 2: Modos de Visualización del Objeto (4-5 enlaces de texto limpios) */}
        <nav className="hidden md:flex items-center gap-6 text-xs font-medium text-slate-300">
          <button
            type="button"
            onClick={() => setSettings((prev) => ({ ...prev, shadingMode: 'cel', wireframe: false }))}
            className={`transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              settings.shadingMode === 'cel'
                ? 'text-amber-400 underline underline-offset-4 font-semibold'
                : 'hover:text-white'
            }`}
          >
            Cel-Shading 3 Tonos
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
            Arcilla Escultura (MatCap)
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
            Mapa de Normales
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
            Malla Poligonal Base
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
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-slate-950 bg-amber-400 rounded-lg hover:bg-amber-300 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Cargar Archivo .GLB</span>
          </button>
        </div>
      </header>

      {/* Barra de Herramientas de Escultura, Simetría y Encuadres de Cámara */}
      <div className="relative z-10 px-6 pt-3 flex flex-wrap items-center justify-between gap-3 text-xs pointer-events-none">
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
            title="Pinta colores por vértice directamente sobre el modelo"
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              brushSettings.mode === 'paint'
                ? 'bg-amber-400 text-slate-950 font-semibold'
                : 'text-slate-300 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Paintbrush className="w-3.5 h-3.5" />
            <span>Pintar</span>
          </button>

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
          </div>
        </div>

        {/* Grupo Derecho: Vistas Rápidas de Cámara para Inspección Detallada */}
        <div className="flex items-center gap-1 p-1.5 bg-slate-950/90 border border-slate-800 rounded-xl pointer-events-auto shadow-xl">
          <span className="px-2 text-[11px] font-medium text-slate-400 whitespace-nowrap">
            Encuadre:
          </span>
          {(
            [
              { id: 'hero', label: '3/4 Estudio' },
              { id: 'front', label: 'Frontal' },
              { id: 'closeup', label: 'Zoom Rostro' },
              { id: 'side', label: 'Perfil' },
            ] as const
          ).map((cam) => (
            <button
              key={cam.id}
              type="button"
              onClick={() => sceneRefs.current?.setCameraViewPreset(cam.id)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
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

      {/* Sub-barra de Parámetros del Pincel Activo + Estadísticas Limpias */}
      <div className="relative z-10 px-6 pt-2 flex flex-wrap items-center justify-between gap-3 text-xs pointer-events-none">
        {brushSettings.mode !== 'none' ? (
          <div className="flex items-center gap-4 px-3.5 py-1.5 bg-slate-950/85 border border-slate-800/90 rounded-lg pointer-events-auto">
            <div className="flex items-center gap-2">
              <span className="text-slate-300 font-medium">Radio Pincel:</span>
              <input
                type="range"
                min={0.1}
                max={1.2}
                step={0.02}
                value={brushSettings.radius}
                onChange={(e) =>
                  setBrushSettings((prev) => ({ ...prev, radius: parseFloat(e.target.value) }))
                }
                className="w-24"
              />
              <span className="font-mono tabular-nums text-amber-400 w-9">
                {brushSettings.radius.toFixed(2)}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-slate-300 font-medium">Fuerza:</span>
              <input
                type="range"
                min={0.05}
                max={1.0}
                step={0.05}
                value={brushSettings.strength}
                onChange={(e) =>
                  setBrushSettings((prev) => ({ ...prev, strength: parseFloat(e.target.value) }))
                }
                className="w-20"
              />
              <span className="font-mono tabular-nums text-amber-400 w-9">
                {Math.round(brushSettings.strength * 100)}%
              </span>
            </div>

            {brushSettings.mode === 'paint' && (
              <div className="flex items-center gap-2 pl-2 border-l border-slate-800">
                <span className="text-slate-300 font-medium">Color Pintura:</span>
                <input
                  type="color"
                  value={brushSettings.paintColor}
                  onChange={(e) =>
                    setBrushSettings((prev) => ({ ...prev, paintColor: e.target.value }))
                  }
                  className="w-5 h-5 rounded cursor-pointer border-0 bg-transparent"
                />
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
        <div className="relative z-20 mx-6 mt-3 max-w-md bg-red-950/90 border border-red-700 text-red-100 px-4 py-2.5 rounded-lg text-xs flex items-center justify-between gap-3">
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

      {/* Panel Inspector Lateral con 4 Pestañas: Modelado, Luz & Vista, Texturas y Shaders */}
      {!dockCollapsed && (
        <aside className="fixed top-36 right-5 z-20 w-84 max-h-[calc(100vh-12.5rem)] overflow-y-auto bg-slate-950/92 border border-slate-800 rounded-xl p-4 shadow-2xl text-slate-200">
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
                          Herramientas IA para Mejorar Resultado:
                        </span>
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

                      <div className="grid grid-cols-2 gap-1">
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

              {/* Exportación GLB / PNG y Guardar en Nube */}
              <div className="space-y-2 pt-1">
                <button
                  type="button"
                  disabled={isSavingToCloud}
                  onClick={handleQuickSaveToCloud}
                  className="w-full py-2 px-3 rounded-lg bg-amber-400/10 hover:bg-amber-400/20 border border-amber-400/40 text-amber-300 font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                  title="Guarda el modelo 3D actual y su código en tu cuenta de Google Firestore"
                >
                  <CloudUpload className="w-4 h-4 text-amber-400" />
                  <span>
                    {isSavingToCloud
                      ? 'Guardando en la Nube...'
                      : currentUser
                      ? 'Guardar en Mi Nube (Firestore)'
                      : 'Acceder y Guardar en Nube'}
                  </span>
                </button>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={isExporting}
                    onClick={handleExportGlb}
                    className="py-1.5 px-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 font-medium flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5 text-amber-400" />
                    <span>Exportar .GLB</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => sceneRefs.current?.captureScreenshot()}
                    className="py-1.5 px-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 font-medium flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer"
                  >
                    <Camera className="w-3.5 h-3.5 text-amber-400" />
                    <span>Captura PNG</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* PESTAÑA 2: ILUMINACIÓN DE ESTUDIO Y CLARIDAD DE INSPECCIÓN */}
          {activeTabPanel === 'lighting' && (
            <div className="space-y-4 text-xs">
              {/* Selector de Material de Inspección (Cel-Shading vs MatCap Escultura vs Normales) */}
              <div className="space-y-2">
                <span className="font-semibold text-slate-200 block">
                  Modo de Sombreado e Inspección
                </span>
                <div className="grid grid-cols-2 gap-1.5">
                  {(
                    [
                      { id: 'cel', label: 'Cel-Shading 3T' },
                      { id: 'matcap', label: 'Escultura MatCap' },
                      { id: 'normals', label: 'Normales RGB' },
                      { id: 'original', label: 'PBR Original' },
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

              {/* Dirección e Intensidad de la Luz Principal */}
              <div className="space-y-2.5 pt-2 border-t border-slate-800/70">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-200 flex items-center gap-1.5">
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

          {/* PESTAÑA 3: TEXTURAS PROCEDURALES */}
          {activeTabPanel === 'textures' && (
            <div className="space-y-2.5 text-xs">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                Aplicar Textura Procedural al Modelo
              </span>
              <div className="space-y-1.5">
                {TEXTURE_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => setActiveTexture(preset.id)}
                    className={`w-full text-left p-2.5 rounded-lg transition-colors cursor-pointer flex items-center gap-3 ${
                      activeTexture === preset.id
                        ? 'bg-amber-400/15 border border-amber-400 text-white'
                        : 'bg-slate-900/60 hover:bg-slate-800/80 border border-slate-800 text-slate-300'
                    }`}
                  >
                    <div
                      className="w-5 h-5 rounded-md border border-slate-700 shrink-0"
                      style={{ backgroundColor: preset.thumbnailColor }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-xs text-slate-200 truncate">
                        {preset.name}
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

          {/* PESTAÑA 4: SHADERS Y POSTPROCESADO */}
          {activeTabPanel === 'shaders' && (
            <div className="space-y-4 text-xs">
              <div className="space-y-1.5">
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
        externalCode={lastGeneratedPythonCode}
        getViewportSnapshot={getViewportSnapshot}
        getSceneBounds={getSceneBounds}
        selectedModel={selectedGeminiModel}
        onModelChange={setSelectedGeminiModel}
        thinkingLevel={selectedThinkingLevel}
        onThinkingLevelChange={setSelectedThinkingLevel}
        userEmail={currentUser?.email}
        onUsageUpdated={setWeeklyUsageStats}
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
