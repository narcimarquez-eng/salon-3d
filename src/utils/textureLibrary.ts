// Biblioteca de texturas para usar como mapa de color (con normal y rugosidad cuando existan).
// - Incluye texturas CC0 empaquetadas en /public/textures (ver public/textures/CREDITS.md).
// - Permite subir imágenes propias ("Mis texturas"), guardadas en IndexedDB de este navegador.
// - Desde Python (motor bpy) se usan por nombre: mat.color_map = "cal_blanca"

import * as THREE from 'three';

export interface ColorMapTextureInfo {
  /** Identificador estable usado en Python: mat.color_map = "<id>" */
  id: string;
  /** Nombre visible en la interfaz */
  name: string;
  source: 'builtin' | 'user';
  /** URL de la imagen de color (ruta pública para las incluidas, blob: para las subidas) */
  url: string;
  /** Mapas PBR opcionales (solo en las incluidas) */
  normalUrl?: string;
  roughnessUrl?: string;
  /** Licencia/origen mostrado en la interfaz */
  license?: string;
}

/** Conjunto de texturas three.js listo para asignar a un material */
export interface ColorMapSet {
  color: THREE.Texture;
  normal: THREE.Texture | null;
  roughness: THREE.Texture | null;
}

const BASE_URL = (import.meta as unknown as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? '/';

const BUILTIN_TEXTURES: ColorMapTextureInfo[] = [
  {
    id: 'cal_blanca',
    name: 'Cal blanca',
    source: 'builtin',
    url: `${BASE_URL}textures/cal_blanca_diff_1k.jpg`,
    normalUrl: `${BASE_URL}textures/cal_blanca_nor_gl_1k.jpg`,
    roughnessUrl: `${BASE_URL}textures/cal_blanca_rough_1k.jpg`,
    license: 'CC0 · Poly Haven (White Rough Plaster) · color + normal + rugosidad',
  },
  {
    id: 'teja_arcilla',
    name: 'Teja de arcilla',
    source: 'builtin',
    url: `${BASE_URL}textures/teja_arcilla_diff_1k.jpg`,
    normalUrl: `${BASE_URL}textures/teja_arcilla_nor_gl_1k.jpg`,
    roughnessUrl: `${BASE_URL}textures/teja_arcilla_rough_1k.jpg`,
    license: 'CC0 · Poly Haven (Clay Roof Tiles 02) · color + normal + rugosidad',
  },
];

// ---------------------------------------------------------------------------
// Almacenamiento de imágenes subidas por el usuario (IndexedDB)
// ---------------------------------------------------------------------------
const DB_NAME = 'salon3d-textures';
const STORE = 'textures';
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

interface StoredUserTexture {
  id: string;
  name: string;
  blob: Blob;
  createdAt: number;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB no disponible en este navegador'));
      return;
    }
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE, { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const req = run(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(req.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

/** Convierte un nombre libre en un id seguro para Python: "Cal de Moguer" -> "cal_de_moguer" */
export function slugifyTextureId(raw: string): string {
  const base = raw
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
  return base || 'textura';
}

const userObjectUrls = new Map<string, string>();

function userUrlFor(record: StoredUserTexture): string {
  const cached = userObjectUrls.get(record.id);
  if (cached) return cached;
  const url = URL.createObjectURL(record.blob);
  userObjectUrls.set(record.id, url);
  return url;
}

/** Lista las texturas subidas por el usuario. Devuelve [] si IndexedDB no está disponible. */
export async function listUserTextures(): Promise<ColorMapTextureInfo[]> {
  try {
    const records = await withStore<StoredUserTexture[]>('readonly', (s) => s.getAll());
    return records
      .sort((a, b) => a.createdAt - b.createdAt)
      .map((r) => ({
        id: r.id,
        name: r.name,
        source: 'user' as const,
        url: userUrlFor(r),
        license: 'Imagen propia (solo color)',
      }));
  } catch (err) {
    console.warn('No se pudieron leer las texturas del usuario:', err);
    return [];
  }
}

async function uniqueUserId(baseId: string): Promise<string> {
  const existing = new Set(BUILTIN_TEXTURES.map((t) => t.id));
  const records = await withStore<StoredUserTexture[]>('readonly', (s) => s.getAll());
  records.forEach((r) => existing.add(r.id));
  if (!existing.has(baseId)) return baseId;
  let n = 2;
  while (existing.has(`${baseId}_${n}`)) n++;
  return `${baseId}_${n}`;
}

/** Guarda una imagen subida. Lanza error si el archivo no es imagen o pesa demasiado. */
export async function addUserTexture(file: File): Promise<ColorMapTextureInfo> {
  if (!file.type.startsWith('image/')) {
    throw new Error(`"${file.name}" no es una imagen`);
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error(`"${file.name}" supera 8 MB`);
  }
  const displayName = file.name.replace(/\.[^/.]+$/, '') || 'Textura';
  const id = await uniqueUserId(slugifyTextureId(displayName));
  const record: StoredUserTexture = {
    id,
    name: displayName,
    blob: file,
    createdAt: Date.now(),
  };
  await withStore<IDBValidKey>('readwrite', (s) => s.put(record));
  return {
    id,
    name: displayName,
    source: 'user',
    url: userUrlFor(record),
    license: 'Imagen propia (solo color)',
  };
}

/** Borra una textura subida por el usuario (las incluidas no se pueden borrar). */
export async function removeUserTexture(id: string): Promise<void> {
  if (BUILTIN_TEXTURES.some((t) => t.id === id)) return;
  await withStore<undefined>('readwrite', (s) => s.delete(id));
  forgetColorMapTexture(id);
  const url = userObjectUrls.get(id);
  if (url) {
    URL.revokeObjectURL(url);
    userObjectUrls.delete(id);
  }
}

/** Todas las texturas disponibles: incluidas + subidas por el usuario. */
export async function listAllColorMapTextures(): Promise<ColorMapTextureInfo[]> {
  const user = await listUserTextures();
  return [...BUILTIN_TEXTURES, ...user];
}

// ---------------------------------------------------------------------------
// Caché de imágenes y texturas de three.js
// ---------------------------------------------------------------------------
interface LoadedImageSet {
  color: HTMLImageElement;
  normal: HTMLImageElement | null;
  roughness: HTMLImageElement | null;
}

const loadedImages = new Map<string, LoadedImageSet>();
const threeSetCache = new Map<string, ColorMapSet>();

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`No se pudo cargar la textura ${url}`));
    img.src = url;
  });
}

/**
 * Carga en memoria todas las texturas disponibles (color, normal y rugosidad).
 * Se llama antes de ejecutar un script para que el motor pueda resolver
 * `mat.color_map = "..."` de forma síncrona.
 */
export async function preloadColorMapImages(): Promise<void> {
  const all = await listAllColorMapTextures();
  await Promise.all(
    all.map(async (info) => {
      if (loadedImages.has(info.id)) return;
      try {
        const color = await loadImage(info.url);
        const [normal, roughness] = await Promise.all([
          info.normalUrl ? loadImage(info.normalUrl).catch(() => null) : Promise.resolve(null),
          info.roughnessUrl ? loadImage(info.roughnessUrl).catch(() => null) : Promise.resolve(null),
        ]);
        loadedImages.set(info.id, { color, normal, roughness });
      } catch (err) {
        console.warn(err);
      }
    })
  );
}

/** Conjunto de texturas three.js (color sRGB; normal y rugosidad en lineal) para un id ya cargado. */
export function getColorMapSet(id: string): ColorMapSet | null {
  const cached = threeSetCache.get(id);
  if (cached) return cached;
  const imgs = loadedImages.get(id);
  if (!imgs) return null;

  const make = (img: HTMLImageElement, srgb: boolean): THREE.Texture => {
    const tex = new THREE.Texture(img);
    tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.anisotropy = 8;
    // Las fuentes son JPG: el exportador GLB las codifica como JPEG en vez de PNG (mucho más ligero)
    tex.userData.mimeType = 'image/jpeg';
    tex.needsUpdate = true;
    return tex;
  };

  const set: ColorMapSet = {
    color: make(imgs.color, true),
    normal: imgs.normal ? make(imgs.normal, false) : null,
    roughness: imgs.roughness ? make(imgs.roughness, false) : null,
  };
  threeSetCache.set(id, set);
  return set;
}

/** Textura de color de three.js para un id ya cargado (compatibilidad). */
export function getColorMapThreeTexture(id: string): THREE.Texture | null {
  return getColorMapSet(id)?.color ?? null;
}

/** Olvida una textura (p. ej. tras borrar una subida) para que se recargue la próxima vez. */
export function forgetColorMapTexture(id: string): void {
  loadedImages.delete(id);
  const set = threeSetCache.get(id);
  if (set) {
    set.color.dispose();
    set.normal?.dispose();
    set.roughness?.dispose();
    threeSetCache.delete(id);
  }
}

// ---------------------------------------------------------------------------
// Coordenadas UV de proyección por caja (la textura mantiene escala en metros)
// ---------------------------------------------------------------------------

/**
 * Recalcula las UV de una geometría proyectándolas desde el eje dominante de cada normal.
 * `matrix` es la transformación local de la malla, para que la escala del objeto cuente.
 * `tileMeters` es cuántos metros ocupa una repetición de la textura.
 */
export function applyBoxProjectedUv(
  geometry: THREE.BufferGeometry,
  matrix: THREE.Matrix4,
  tileMeters: number
): void {
  const pos = geometry.getAttribute('position');
  if (!pos) return;
  if (!geometry.getAttribute('normal')) geometry.computeVertexNormals();
  const nrm = geometry.getAttribute('normal');
  const count = pos.count;
  const uv = new Float32Array(count * 2);
  const normalMatrix = new THREE.Matrix3().getNormalMatrix(matrix);
  const p = new THREE.Vector3();
  const n = new THREE.Vector3();
  const tile = Math.max(0.05, tileMeters);

  for (let i = 0; i < count; i++) {
    p.fromBufferAttribute(pos, i).applyMatrix4(matrix);
    n.fromBufferAttribute(nrm, i).applyMatrix3(normalMatrix).normalize();
    const ax = Math.abs(n.x);
    const ay = Math.abs(n.y);
    const az = Math.abs(n.z);
    let u: number;
    let v: number;
    if (az >= ax && az >= ay) {
      u = p.x;
      v = p.y;
    } else if (ax >= ay) {
      u = p.z;
      v = p.y;
    } else {
      u = p.x;
      v = p.z;
    }
    uv[i * 2] = u / tile;
    uv[i * 2 + 1] = v / tile;
  }
  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geometry.attributes.uv.needsUpdate = true;
}
