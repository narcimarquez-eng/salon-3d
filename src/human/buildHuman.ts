// ============================================================================
// HUMANO DESDE IMÁGENES
// ----------------------------------------------------------------------------
// Junta las piezas portadas de Vortex3D (repo 3d-con-imagenes) y devuelve algo
// que salon-3d pueda montar en su escena: una malla (o SkinnedMesh con sus
// animaciones) con la textura sacada de las propias fotos.
//
//   fotos -> imagePrep (recorte, silueta, relieve, atlas)
//         -> humanBodyTemplate (cuerpo cerrado ajustado a la silueta)
//         -> humanRig (19 huesos, pesos de piel y 4 animaciones)
// ============================================================================

import * as THREE from 'three';
import {
  buildHumanBodyTemplateGeometry,
  maskFromCutoutAndPaint,
  type HumanBodyLandmarks,
} from './humanBodyTemplate';
import {
  createHumanAnimationClips,
  createSkeletonBones,
  type HumanRig,
} from './humanRig';
import { LAYER_CLASSES } from './layerMap';
import {
  ATLAS,
  DEFAULT_CUTOUT,
  TENSOR,
  TENSOR_LEN,
  buildAtlas,
  fitImageToTensor,
  loadLayerMap,
  prepareView,
  type CutoutSettings,
  type LayerMapBuffers,
  type TensorCrop,
} from './imagePrep';

/** Tope de vértices, el mismo que usa Vortex3D. */
export const MAX_HUMAN_VERTICES = 196608;

export interface HumanImageSet {
  front: HTMLImageElement;
  back?: HTMLImageElement | null;
  /** Vista de perfil: de ahí sale el grosor real del cuerpo a cada altura. */
  side?: HTMLImageElement | null;
  frontLayer?: HTMLImageElement | null;
  backLayer?: HTMLImageElement | null;
  sideLayer?: HTMLImageElement | null;
}

export interface HumanBuildOptions {
  /** Profundidad general del cuerpo (1 = proporciones humanas naturales). */
  depthScale: number;
  /** Cuánto relieve de la foto se añade encima (0..1). */
  reliefAmount: number;
  /** Filas de malla sobre la altura de la figura. */
  rows: number;
  /** Fuerza de los rasgos de la cara (0 = ninguno, 1 = sutil). */
  faceDetail: number;
  /** Multiplicador de altura del mapa de capas pintado. */
  layerStrength: number;
  /** Crear esqueleto, pesos de piel y animaciones. */
  rig: boolean;
  /** Añadir botas. */
  shoes: boolean;
  /** Cuánto manda el perfil sobre el grosor del cuerpo (0 = nada, 1 = del todo). */
  sideStrength: number;
  /** Escala la metalicidad del atlas (1 = igual que Vortex3D). */
  metalMix: number;
  /** Fuerza del mapa de normales. */
  normalStrength: number;
  cutout?: CutoutSettings;
}

export const DEFAULT_HUMAN_OPTIONS: HumanBuildOptions = {
  depthScale: 1.0,
  reliefAmount: 0.5,
  rows: 246, // 112 * 2.2, la rejilla por defecto de Vortex3D
  faceDetail: 1.0,
  layerStrength: 1.0,
  rig: true,
  shoes: true,
  sideStrength: 1.0,
  // Vortex3D usa 1.0 y 1.5, pero su visor tiene mapa de entorno; con las luces
  // de salon-3d esos valores sacan brillo de plástico y un relieve de textura
  // demasiado marcado. Se bajan por defecto y los deslizadores llegan al valor
  // original por si se quiere el aspecto exacto de allí.
  metalMix: 0.45,
  normalStrength: 0.6,
};

export interface HumanBuildResult {
  /** Raíz lista para montar: contiene la malla (o SkinnedMesh) del personaje. */
  root: THREE.Group;
  mesh: THREE.Mesh | THREE.SkinnedMesh;
  clips: THREE.AnimationClip[];
  vertexCount: number;
  triangleCount: number;
  landmarks: HumanBodyLandmarks;
  rig?: HumanRig;
  /** Avisos para el usuario (sin espalda, sin mapa de capas...). */
  notes: string[];
}

/** Dibuja una imagen en el tensor de 256 y devuelve sus píxeles y el recorte. */
function toTensorPixels(img: HTMLImageElement): {
  pixels: Uint8ClampedArray;
  crop: TensorCrop | null;
} {
  const canvas = document.createElement('canvas');
  canvas.width = TENSOR;
  canvas.height = TENSOR;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return { pixels: new Uint8ClampedArray(TENSOR_LEN * 4), crop: null };
  const crop = fitImageToTensor(ctx, img);
  return { pixels: ctx.getImageData(0, 0, TENSOR, TENSOR).data, crop };
}

function makeAtlasTexture(
  data: Uint8Array,
  colorSpace: THREE.ColorSpace
): THREE.DataTexture {
  const tex = new THREE.DataTexture(data, ATLAS, ATLAS, THREE.RGBAFormat);
  tex.colorSpace = colorSpace;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Construye el personaje. Devuelve la malla ya con material y, si se pidió
 * esqueleto, una SkinnedMesh con sus cuatro animaciones.
 */
export function buildHumanFromImages(
  images: HumanImageSet,
  optionsIn: Partial<HumanBuildOptions> = {}
): HumanBuildResult {
  const options: HumanBuildOptions = { ...DEFAULT_HUMAN_OPTIONS, ...optionsIn };
  const cut = options.cutout ?? DEFAULT_CUTOUT;
  const notes: string[] = [];

  // 1. Fotos -> tensores
  const front = toTensorPixels(images.front);
  const frontView = prepareView(front.pixels, false, cut);

  let backView: ReturnType<typeof prepareView> | null = null;
  let backCrop: TensorCrop | null = null;
  if (images.back) {
    const back = toTensorPixels(images.back);
    // La espalda se guarda espejada para que quede alineada con el frente.
    backView = prepareView(back.pixels, true, cut);
    backCrop = back.crop;
  } else {
    notes.push(
      'Sin foto de espalda: la parte de atrás reutiliza el frente espejado.'
    );
  }

  // 2. Perfil: solo interesa su silueta, para medir el grosor por altura.
  let sideMask: Uint8Array | null = null;
  if (images.side) {
    const side = toTensorPixels(images.side);
    const sideView = prepareView(side.pixels, false, cut);
    const sidePaint = images.sideLayer
      ? loadLayerMap(images.sideLayer, side.crop)
      : null;
    let offsets = sidePaint?.offset ?? null;
    if (offsets) {
      // De perfil, la melena y los cuernos tapan el cuerpo y lo harían medir
      // mucho más grueso de lo que es (la cabeza salía como una pelota). Con
      // el mapa pintado se puede medir solo el cuerpo: fuera pelo y pinchos.
      const fur = LAYER_CLASSES.find((c) => c.id === 'fur')?.offset;
      const spikes = LAYER_CLASSES.find((c) => c.id === 'spikes')?.offset;
      const body = new Float32Array(offsets.length);
      for (let i = 0; i < offsets.length; i++) {
        const v = offsets[i];
        body[i] = Number.isFinite(v) && v !== fur && v !== spikes ? v : NaN;
      }
      offsets = body;
    } else {
      notes.push(
        'El perfil se mide con su silueta entera: si tiene melena o cuernos, píntale el mapa de capas del perfil para que no cuenten como cuerpo.'
      );
    }
    sideMask = maskFromCutoutAndPaint(sideView.cutout, TENSOR, offsets);
  } else {
    notes.push(
      'Sin vista de perfil: el grosor del cuerpo sale de proporciones humanas, no del dibujo.'
    );
  }

  // 3. Mapas de capas pintados (opcionales)
  let frontLayer: LayerMapBuffers | null = null;
  let backLayer: LayerMapBuffers | null = null;
  if (images.frontLayer) {
    frontLayer = loadLayerMap(images.frontLayer, front.crop);
  }
  if (images.backLayer) {
    backLayer = loadLayerMap(images.backLayer, backCrop ?? front.crop);
  }
  if (!frontLayer && !backLayer) {
    notes.push(
      'Sin mapa de capas: el relieve sale del brillo de la foto, que es menos fiel que un mapa pintado.'
    );
  }

  // 4. Atlas de textura (frente a la izquierda, espalda a la derecha)
  const atlas = buildAtlas(frontView, backView, options.metalMix);

  // 5. Cuerpo humano ajustado a la silueta
  const geometry = new THREE.BufferGeometry();
  const vertexUsedMask = new Uint8Array(MAX_HUMAN_VERTICES);
  const stats = buildHumanBodyTemplateGeometry(
    geometry,
    {
      mask: frontView.cutout,
      w: TENSOR,
      frontRgb: frontView.rgb,
      frontLayer,
      backLayer,
      frontRelief: frontView.relief,
      backRelief: (backView ?? frontView).relief,
      sideMask,
      vertexUsedMask,
      maxVertices: MAX_HUMAN_VERTICES,
      atlas: {
        albedo: atlas.albedo,
        roughMetal: atlas.roughMetal,
        atlasWidth: atlas.atlasWidth,
        background: frontView.bg,
        backBackground: backView ? backView.bg : undefined,
      },
    },
    {
      depthScale: Math.max(0.2, Math.min(1.8, options.depthScale)),
      reliefAmount: Math.max(0, Math.min(1, options.reliefAmount)),
      rows: Math.max(40, Math.min(400, Math.round(options.rows))),
      faceDetail: Math.max(0, Math.min(2, options.faceDetail)),
      layerStrength: Math.max(0, options.layerStrength),
      rig: options.rig,
      shoes: options.shoes,
      sideStrength: Math.max(0, Math.min(1, options.sideStrength)),
    }
  );

  if (stats.vertexCount === 0) {
    throw new Error(
      'No se ha encontrado una silueta de personaje en la imagen. Prueba con una foto de cuerpo entero en pose A, con fondo liso.'
    );
  }

  // 6. Material: el mismo montaje que el visor de Vortex3D
  const albedoTex = makeAtlasTexture(atlas.albedo, THREE.SRGBColorSpace);
  const roughMetalTex = makeAtlasTexture(atlas.roughMetal, THREE.NoColorSpace);
  const normalTex = makeAtlasTexture(atlas.normal, THREE.NoColorSpace);
  const nStrength = Math.max(0, options.normalStrength);
  const material = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    map: albedoTex,
    normalMap: normalTex,
    normalScale: new THREE.Vector2(nStrength, nStrength),
    roughnessMap: roughMetalTex,
    metalnessMap: roughMetalTex,
    roughness: 1.0,
    metalness: 1.0,
    clearcoat: 0.22,
    clearcoatRoughness: 0.18,
    vertexColors: false,
    side: THREE.DoubleSide,
  });
  material.name = 'Humano_Foto_PBR';

  // 7. Malla, con esqueleto si se pidió
  const root = new THREE.Group();
  root.name = 'Humano_Desde_Imagenes';
  let mesh: THREE.Mesh | THREE.SkinnedMesh;
  let clips: THREE.AnimationClip[] = [];

  const hasSkin =
    options.rig &&
    stats.rig &&
    geometry.getAttribute('skinIndex') &&
    geometry.getAttribute('skinWeight');

  if (hasSkin && stats.rig) {
    const { root: boneRoot, bones } = createSkeletonBones(stats.rig);
    const skinned = new THREE.SkinnedMesh(geometry, material);
    skinned.name = 'Personaje';
    skinned.frustumCulled = false;
    skinned.add(boneRoot);
    skinned.updateMatrixWorld(true);
    skinned.bind(new THREE.Skeleton(bones));
    clips = createHumanAnimationClips(stats.rig);
    mesh = skinned;
  } else {
    mesh = new THREE.Mesh(geometry, material);
    mesh.name = 'Personaje';
    if (options.rig) {
      notes.push('No se ha podido crear el esqueleto para esta silueta.');
    }
  }
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  // Marca para que las texturas de procedimiento de la app no le pisen sus
  // mapas sacados de la foto.
  mesh.userData.photoHuman = true;
  root.add(mesh);

  return {
    root,
    mesh,
    clips,
    vertexCount: stats.vertexCount,
    triangleCount: stats.triangleCount,
    landmarks: stats.landmarks,
    rig: stats.rig,
    notes,
  };
}
