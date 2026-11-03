// Optimizador de GLB por zonas.
//
// Trabaja directamente sobre el archivo GLB (JSON + buffer binario) y solo cambia lo que se pide:
//   1. Texturas por zona (una zona = un material): mantener, quitar, patrón procedural o imagen de "Mis texturas".
//   2. Recompresión de imágenes: tamaño máximo por zona y JPEG para las opacas que no son mapas normales.
//   3. Datos de huesos compactos: índices JOINTS de 16 a 8 bits (sin pérdida si hay < 256 huesos) y
//      pesos WEIGHTS de float a 16 bits normalizados (error < 0,00002).
// Todo lo demás (esqueletos, animaciones, extensiones desconocidas, nodos, luces) se conserva tal cual.

import {
  TexturePatternType,
  generateProceduralBumpTexture,
  generateProceduralTexture,
  getTexturePresetInfo,
} from './proceduralTextures';
import { getColorMapSet, preloadColorMapImages } from './textureLibrary';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Json = any;

// ---------------------------------------------------------------------------
// Tipos públicos
// ---------------------------------------------------------------------------
export interface GlbZone {
  /** Índice del material en el GLB (o -1 para primitivas sin material) */
  index: number;
  name: string;
  primitives: number;
  vertices: number;
  triangles: number;
  skinned: boolean;
  /** Material de efecto (emisivo, transparente o sin iluminación): se sugiere no tocarlo */
  effect: boolean;
  /** Tamaño en píxeles de la textura de color actual, si tiene */
  baseTextureSize: [number, number] | null;
  hasBaseTexture: boolean;
}

export type ZoneTextureChoice =
  | { kind: 'keep' }
  | { kind: 'none' }
  | { kind: 'pattern'; pattern: TexturePatternType; repeat: number; natural: boolean }
  | { kind: 'user'; id: string; repeat: number };

export interface ZonePlan {
  choice: ZoneTextureChoice;
  /** Lado máximo de las texturas de la zona en píxeles; 0 = sin cambio */
  maxSize: number;
}

export interface OptimizeOptions {
  jpegQuality: number;
  compactSkin: boolean;
}

export interface SizeBreakdown {
  total: number;
  images: number;
  geometry: number;
  animation: number;
  other: number;
}

export interface GlbSummary {
  size: SizeBreakdown;
  meshes: number;
  materials: number;
  images: number;
  skins: number;
  animations: string[];
  triangles: number;
}

export interface OptimizeResult {
  bytes: Uint8Array;
  before: GlbSummary;
  after: GlbSummary;
  notes: string[];
}

// ---------------------------------------------------------------------------
// Lectura y escritura del contenedor GLB
// ---------------------------------------------------------------------------
const GLB_MAGIC = 0x46546c67; // 'glTF'
const CHUNK_JSON = 0x4e4f534a;
const CHUNK_BIN = 0x004e4942;

export function parseGlb(buffer: ArrayBuffer): { json: Json; bin: Uint8Array } {
  const view = new DataView(buffer);
  if (view.getUint32(0, true) !== GLB_MAGIC) throw new Error('El archivo no es un GLB (binario glTF 2.0)');
  if (view.getUint32(4, true) !== 2) throw new Error('Solo se admite glTF 2.0');
  let offset = 12;
  let json: Json = null;
  let bin = new Uint8Array(0);
  while (offset + 8 <= buffer.byteLength) {
    const len = view.getUint32(offset, true);
    const type = view.getUint32(offset + 4, true);
    const data = new Uint8Array(buffer, offset + 8, len);
    if (type === CHUNK_JSON) json = JSON.parse(new TextDecoder().decode(data));
    else if (type === CHUNK_BIN) bin = new Uint8Array(data);
    offset += 8 + len;
  }
  if (!json) throw new Error('El GLB no tiene bloque JSON');
  return { json, bin };
}

function pad4(n: number): number {
  return (n + 3) & ~3;
}

export function writeGlb(json: Json, bin: Uint8Array): Uint8Array {
  const jsonBytes = new TextEncoder().encode(JSON.stringify(json));
  const jsonLen = pad4(jsonBytes.length);
  const binLen = pad4(bin.length);
  const total = 12 + 8 + jsonLen + (bin.length ? 8 + binLen : 0);
  const out = new Uint8Array(total);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, GLB_MAGIC, true);
  dv.setUint32(4, 2, true);
  dv.setUint32(8, total, true);
  dv.setUint32(12, jsonLen, true);
  dv.setUint32(16, CHUNK_JSON, true);
  out.set(jsonBytes, 20);
  for (let i = 20 + jsonBytes.length; i < 20 + jsonLen; i++) out[i] = 0x20; // relleno con espacios
  if (bin.length) {
    const o = 20 + jsonLen;
    dv.setUint32(o, binLen, true);
    dv.setUint32(o + 4, CHUNK_BIN, true);
    out.set(bin, o + 8);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Utilidades de accesores
// ---------------------------------------------------------------------------
const COMPONENT_SIZE: Record<number, number> = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 };
const TYPE_COUNT: Record<string, number> = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT2: 4, MAT3: 9, MAT4: 16 };

function accessorByteLength(acc: Json): number {
  return acc.count * TYPE_COUNT[acc.type] * COMPONENT_SIZE[acc.componentType];
}

/** Lee un accesor como array de números (respeta byteStride y normalización). */
function readAccessor(json: Json, views: Uint8Array[], accIndex: number): { data: Float64Array; comps: number } {
  const acc = json.accessors[accIndex];
  const comps = TYPE_COUNT[acc.type];
  const out = new Float64Array(acc.count * comps);
  if (acc.bufferView === undefined) return { data: out, comps };
  const bv = json.bufferViews[acc.bufferView];
  const bytes = views[acc.bufferView];
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const csize = COMPONENT_SIZE[acc.componentType];
  const stride = bv.byteStride || comps * csize;
  const base = acc.byteOffset || 0;
  for (let i = 0; i < acc.count; i++) {
    for (let c = 0; c < comps; c++) {
      const o = base + i * stride + c * csize;
      let v: number;
      switch (acc.componentType) {
        case 5126: v = dv.getFloat32(o, true); break;
        case 5125: v = dv.getUint32(o, true); break;
        case 5123: v = dv.getUint16(o, true); if (acc.normalized) v /= 65535; break;
        case 5122: v = dv.getInt16(o, true); if (acc.normalized) v = Math.max(v / 32767, -1); break;
        case 5121: v = dv.getUint8(o); if (acc.normalized) v /= 255; break;
        default: v = dv.getInt8(o); if (acc.normalized) v = Math.max(v / 127, -1); break;
      }
      out[i * comps + c] = v;
    }
  }
  return { data: out, comps };
}

/** Recorre el JSON y devuelve todas las referencias a texturas (objetos textureInfo: claves que acaban en "Texture"). */
function collectTextureRefs(node: Json, out: Json[] = []): Json[] {
  if (!node || typeof node !== 'object') return out;
  for (const [k, v] of Object.entries(node)) {
    if (v && typeof v === 'object') {
      if (/Texture$/.test(k) && typeof (v as Json).index === 'number') out.push(v);
      collectTextureRefs(v, out);
    }
  }
  return out;
}

function imageSize(bytes: Uint8Array, mime: string): [number, number] | null {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (mime === 'image/png' && bytes.length > 24) return [dv.getUint32(16), dv.getUint32(20)];
  if (mime === 'image/jpeg') {
    let o = 2;
    while (o + 9 < bytes.length) {
      if (bytes[o] !== 0xff) { o++; continue; }
      const marker = bytes[o + 1];
      const len = dv.getUint16(o + 2);
      if (marker >= 0xc0 && marker <= 0xc3) return [dv.getUint16(o + 7), dv.getUint16(o + 5)];
      o += 2 + len;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Resumen y zonas
// ---------------------------------------------------------------------------
function viewsOf(json: Json, bin: Uint8Array): Uint8Array[] {
  return (json.bufferViews || []).map((bv: Json) => {
    if ((bv.buffer ?? 0) !== 0) throw new Error('GLB con varios buffers: no soportado');
    const start = bv.byteOffset || 0;
    return bin.subarray(start, start + bv.byteLength);
  });
}

export function summarizeGlb(json: Json, totalBytes: number): GlbSummary {
  const imageViews = new Set((json.images || []).map((im: Json) => im.bufferView));
  const animAcc = new Set<number>();
  for (const an of json.animations || []) for (const s of an.samplers || []) { animAcc.add(s.input); animAcc.add(s.output); }
  const meshAcc = new Set<number>();
  let triangles = 0;
  for (const m of json.meshes || []) {
    for (const p of m.primitives || []) {
      Object.values(p.attributes || {}).forEach((a) => meshAcc.add(a as number));
      if (p.indices !== undefined) { meshAcc.add(p.indices); triangles += Math.floor(json.accessors[p.indices].count / 3); }
      else if (p.attributes?.POSITION !== undefined) triangles += Math.floor(json.accessors[p.attributes.POSITION].count / 3);
    }
  }
  let images = 0, geometry = 0, animation = 0;
  (json.bufferViews || []).forEach((bv: Json, i: number) => { if (imageViews.has(i)) images += bv.byteLength; });
  (json.accessors || []).forEach((acc: Json, i: number) => {
    if (acc.bufferView === undefined) return;
    if (meshAcc.has(i)) geometry += accessorByteLength(acc);
    else if (animAcc.has(i)) animation += accessorByteLength(acc);
  });
  return {
    size: { total: totalBytes, images, geometry, animation, other: Math.max(0, totalBytes - images - geometry - animation) },
    meshes: (json.meshes || []).length,
    materials: (json.materials || []).length,
    images: (json.images || []).length,
    skins: (json.skins || []).length,
    animations: (json.animations || []).map((a: Json, i: number) => a.name || `Animación ${i + 1}`),
    triangles,
  };
}

export function analyzeGlbZones(buffer: ArrayBuffer): { zones: GlbZone[]; summary: GlbSummary } {
  const { json, bin } = parseGlb(buffer);
  const views = viewsOf(json, bin);
  const skinnedMeshes = new Set<number>();
  for (const n of json.nodes || []) if (n.skin !== undefined && n.mesh !== undefined) skinnedMeshes.add(n.mesh);
  const zones = new Map<number, GlbZone>();
  (json.meshes || []).forEach((m: Json, mi: number) => {
    for (const p of m.primitives || []) {
      const idx = p.material ?? -1;
      const mat = idx >= 0 ? json.materials[idx] : null;
      if (!zones.has(idx)) {
        const pbr = mat?.pbrMetallicRoughness || {};
        const emissive = (mat?.emissiveFactor || [0, 0, 0]).some((v: number) => v > 0.05);
        const effect = Boolean(mat && (emissive || mat.alphaMode === 'BLEND' || mat.extensions?.KHR_materials_unlit));
        let baseTextureSize: [number, number] | null = null;
        if (pbr.baseColorTexture) {
          const tex = json.textures[pbr.baseColorTexture.index];
          const im = tex?.source !== undefined ? json.images[tex.source] : null;
          if (im?.bufferView !== undefined) baseTextureSize = imageSize(views[im.bufferView], im.mimeType || 'image/png');
        }
        zones.set(idx, {
          index: idx,
          name: mat?.name || (idx >= 0 ? `Material ${idx}` : 'Sin material'),
          primitives: 0, vertices: 0, triangles: 0,
          skinned: false, effect,
          baseTextureSize, hasBaseTexture: Boolean(pbr.baseColorTexture),
        });
      }
      const z = zones.get(idx)!;
      z.primitives++;
      const pos = p.attributes?.POSITION;
      if (pos !== undefined) z.vertices += json.accessors[pos].count;
      z.triangles += p.indices !== undefined ? Math.floor(json.accessors[p.indices].count / 3) : Math.floor((pos !== undefined ? json.accessors[pos].count : 0) / 3);
      if (skinnedMeshes.has(mi)) z.skinned = true;
    }
  });
  return { zones: [...zones.values()].sort((a, b) => b.triangles - a.triangles), summary: summarizeGlb(json, buffer.byteLength) };
}

/**
 * Sugiere textura por el nombre de la zona. Los materiales de efecto (fuego, runas, chispas) se mantienen, y
 * las zonas que ya tienen textura propia también, salvo que se pida sustituirlas: una textura hecha para ese
 * modelo suele verse mejor que un patrón genérico.
 */
export function suggestZoneChoice(zone: GlbZone, replaceExisting = false): ZoneTextureChoice {
  if (zone.effect) return { kind: 'keep' };
  if (zone.hasBaseTexture && !replaceExisting) return { kind: 'keep' };
  const n = zone.name.toLowerCase();
  const pick = (pattern: TexturePatternType, repeat = 2, natural = false): ZoneTextureChoice => ({ kind: 'pattern', pattern, repeat, natural });
  if (/(rune|runic|fire|flame|spark|glow|aura|trail|magic|energy|breath|plasma|lava|emiss)/.test(n)) return { kind: 'keep' };
  if (/(?<![a-z])(eyes?|ojos?|pupil|pupila|iris)(?![a-z])/.test(n)) return { kind: 'keep' };
  if (/(fang|horn|ivory|bone|tooth|teeth|claw|tusk|diente|cuerno|hueso|garra|colmillo|marfil)/.test(n)) return pick('travertine_roman', 2);
  if (/(gold|oro|dorad)/.test(n)) return pick('gold_damascene', 2);
  if (/(bronze|copper|bronce|cobre)/.test(n)) return pick('copper_patina', 2);
  if (/(wood|bow|handle|hilt|grip|shaft|madera|mango|empu|arco|counter|mostrador|table|mesa|platform|plataforma|crate|caja|barrel|barril|shelf|estante)/.test(n)) return pick('wood_oak', 2);
  if (/(metal|iron|steel|armor|armour|plate|blade|sword|helm|hierro|acero|armadura|espada)/.test(n)) return pick('brushed_metal', 2);
  if (/(under|belly|hide|vientre)/.test(n)) return pick('leather_tufted', 3);
  // Cuero de equipo: grano fino en vez de capitoné
  if (/(leather|cuero|boot|bota|belt|cintur|strap|correa|loincloth|taparrabo|glove|guante|brazal)/.test(n)) return pick('beast_hide', 3);
  if (/(scale|escama|dragon|primary|reptil|lizard|serpent)/.test(n)) return pick('dragon_scales', 2);
  if (/(trim|secondary|plates?|biomech)/.test(n)) return pick('biomech_plates', 3);
  if (/(cloth|fabric|robe|cape|tela|lino|capa|tunic|toldo|awning|banner|estandarte|bandera|flag|tent|carpa)/.test(n)) return pick('woven_linen', 3);
  if (/(velvet|terciopelo)/.test(n)) return pick('royal_velvet', 3);
  if (/(stone|rock|roca|piedra|golem)/.test(n)) return pick('stone_ashlar', 2);
  if (/(crystal|ice|hielo|cristal)/.test(n)) return pick('ice_crystal', 2);
  if (/(skin|flesh|carne|body|cuerpo|piel)/.test(n)) return pick('beast_hide', 2);
  // Partes del cuerpo (palabra completa, para no confundir "arm" con "armor")
  if (/(?<![a-z])(arms?|legs?|head|hands?|foot|feet|neck|face|torso|chest|thigh|muslo|pierna|pantorrilla|brazo|antebrazo|cabeza|torso|manos?|pies?|cuello|cara|hombro|pecho|oreja)(?![a-z])/.test(n)) return pick('beast_hide', 2);
  return { kind: 'keep' };
}

// ---------------------------------------------------------------------------
// Codificación de imágenes en el navegador
// ---------------------------------------------------------------------------
function canvasToBytes(canvas: HTMLCanvasElement, mime: string, quality: number): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(async (blob) => {
      if (!blob) { reject(new Error('No se pudo codificar la imagen')); return; }
      resolve(new Uint8Array(await blob.arrayBuffer()));
    }, mime, quality);
  });
}

function sourceToCanvas(src: CanvasImageSource, w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(src, 0, 0, w, h);
  return c;
}

function isOpaque(canvas: HTMLCanvasElement): boolean {
  const data = canvas.getContext('2d', { willReadFrequently: true })!.getImageData(0, 0, canvas.width, canvas.height).data;
  for (let i = 3; i < data.length; i += 4) if (data[i] !== 255) return false;
  return true;
}

// ---------------------------------------------------------------------------
// Optimización
// ---------------------------------------------------------------------------
export async function optimizeGlb(
  buffer: ArrayBuffer,
  plans: Map<number, ZonePlan>,
  options: OptimizeOptions
): Promise<OptimizeResult> {
  const parsed = parseGlb(buffer);
  const json: Json = JSON.parse(JSON.stringify(parsed.json));
  const views: Uint8Array[] = viewsOf(json, parsed.bin).map((v) => new Uint8Array(v));
  const before = summarizeGlb(parsed.json, buffer.byteLength);
  const notes: string[] = [];
  json.images = json.images || [];
  json.textures = json.textures || [];
  json.samplers = json.samplers || [];
  json.extensionsUsed = json.extensionsUsed || [];
  const useExt = (name: string) => { if (!json.extensionsUsed.includes(name)) json.extensionsUsed.push(name); };

  const addView = (bytes: Uint8Array, target?: number): number => {
    json.bufferViews.push({ buffer: 0, byteOffset: 0, byteLength: bytes.length, ...(target ? { target } : {}) });
    views.push(bytes);
    return json.bufferViews.length - 1;
  };
  let repeatSampler = -1;
  const getRepeatSampler = (): number => {
    if (repeatSampler < 0) {
      json.samplers.push({ magFilter: 9729, minFilter: 9987, wrapS: 10497, wrapT: 10497 });
      repeatSampler = json.samplers.length - 1;
    }
    return repeatSampler;
  };
  const addTexture = (bytes: Uint8Array, mime: string, name: string): number => {
    json.images.push({ bufferView: addView(bytes), mimeType: mime, name });
    json.textures.push({ source: json.images.length - 1, sampler: getRepeatSampler() });
    return json.textures.length - 1;
  };

  // 1. Texturas por zona
  const needsUser = [...plans.values()].some((p) => p.choice.kind === 'user');
  const sharedTextures = new Map<string, { color: number; bump?: number }>();
  if (needsUser) await preloadColorMapImages();
  for (const [matIndex, plan] of plans) {
    if (matIndex < 0 || !json.materials?.[matIndex]) continue;
    const mat = json.materials[matIndex];
    const pbr = (mat.pbrMetallicRoughness = mat.pbrMetallicRoughness || {});
    const choice = plan.choice;
    if (choice.kind === 'keep') continue;
    if (choice.kind === 'none') {
      delete pbr.baseColorTexture;
      continue;
    }
    // Zonas con el mismo patrón/imagen comparten una sola copia en el GLB
    const cacheKey = choice.kind === 'pattern' ? `p:${choice.pattern}:${choice.natural ? 1 : 0}` : `u:${choice.id}`;
    const repeat = choice.repeat;
    const cached = sharedTextures.get(cacheKey);
    if (cached) {
      if (choice.kind === 'user' || choice.natural) pbr.baseColorFactor = [1, 1, 1, (pbr.baseColorFactor || [1, 1, 1, 1])[3]];
      pbr.baseColorTexture = { index: cached.color, texCoord: 0, extensions: { KHR_texture_transform: { scale: [repeat, repeat] } } };
      if (cached.bump !== undefined && choice.kind === 'pattern') {
        mat.extensions = mat.extensions || {};
        mat.extensions.EXT_materials_bump = {
          bumpTexture: { index: cached.bump, texCoord: 0, extensions: { KHR_texture_transform: { scale: [repeat, repeat] } } },
          bumpFactor: getTexturePresetInfo(choice.pattern).pbr.bumpScale,
        };
      }
    } else {
      let colorCanvas: HTMLCanvasElement | null = null;
      let bumpCanvas: HTMLCanvasElement | null = null;
      if (choice.kind === 'pattern') {
        const tex = generateProceduralTexture(choice.pattern, choice.natural ? 'auto' : '#ffffff', 1);
        const bump = generateProceduralBumpTexture(choice.pattern, 1);
        if (tex?.image) colorCanvas = sourceToCanvas(tex.image as CanvasImageSource, 512, 512);
        if (bump?.image) bumpCanvas = sourceToCanvas(bump.image as CanvasImageSource, 512, 512);
        if (choice.natural) pbr.baseColorFactor = [1, 1, 1, (pbr.baseColorFactor || [1, 1, 1, 1])[3]];
      } else {
        const img = getColorMapSet(choice.id)?.color.image as HTMLImageElement | undefined;
        if (!img) { notes.push(`No se encontró la imagen "${choice.id}" para ${mat.name || 'una zona'}.`); continue; }
        const side = Math.min(1024, Math.max(img.naturalWidth, img.naturalHeight));
        colorCanvas = sourceToCanvas(img, side, side);
        pbr.baseColorFactor = [1, 1, 1, (pbr.baseColorFactor || [1, 1, 1, 1])[3]];
      }
      if (!colorCanvas) continue;
      const colorBytes = await canvasToBytes(colorCanvas, 'image/jpeg', options.jpegQuality);
      const texLabel = choice.kind === 'pattern' ? choice.pattern : choice.id;
      const colorTex = addTexture(colorBytes, 'image/jpeg', `${texLabel}_color`);
      const entry: { color: number; bump?: number } = { color: colorTex };
      sharedTextures.set(cacheKey, entry);
      pbr.baseColorTexture = { index: colorTex, texCoord: 0, extensions: { KHR_texture_transform: { scale: [repeat, repeat] } } };
      useExt('KHR_texture_transform');
      if (bumpCanvas && choice.kind === 'pattern') {
        const bumpBytes = await canvasToBytes(bumpCanvas, 'image/jpeg', options.jpegQuality);
        const bumpTex = addTexture(bumpBytes, 'image/jpeg', `${texLabel}_relieve`);
        entry.bump = bumpTex;
        mat.extensions = mat.extensions || {};
        mat.extensions.EXT_materials_bump = {
          bumpTexture: { index: bumpTex, texCoord: 0, extensions: { KHR_texture_transform: { scale: [repeat, repeat] } } },
          bumpFactor: getTexturePresetInfo(choice.pattern).pbr.bumpScale,
        };
        useExt('EXT_materials_bump');
      }
    }
    // Primitivas de la zona sin UV: se generan por proyección de caja (1 unidad = 1 repetición)
    for (const m of json.meshes || []) {
      for (const p of m.primitives || []) {
        if ((p.material ?? -1) !== matIndex || p.attributes.TEXCOORD_0 !== undefined || p.attributes.POSITION === undefined) continue;
        const pos = readAccessor(json, views, p.attributes.POSITION).data;
        const nrm = p.attributes.NORMAL !== undefined ? readAccessor(json, views, p.attributes.NORMAL).data : null;
        const n = pos.length / 3;
        const uv = new Float32Array(n * 2);
        for (let i = 0; i < n; i++) {
          const ax = Math.abs(nrm ? nrm[i * 3] : 0), ay = Math.abs(nrm ? nrm[i * 3 + 1] : 1), az = Math.abs(nrm ? nrm[i * 3 + 2] : 0);
          const [u, v] = ay >= ax && ay >= az ? [pos[i * 3], pos[i * 3 + 2]] : ax >= az ? [pos[i * 3 + 2], pos[i * 3 + 1]] : [pos[i * 3], pos[i * 3 + 1]];
          uv[i * 2] = u; uv[i * 2 + 1] = v;
        }
        json.accessors.push({ bufferView: addView(new Uint8Array(uv.buffer), 34962), componentType: 5126, count: n, type: 'VEC2' });
        p.attributes.TEXCOORD_0 = json.accessors.length - 1;
        notes.push(`UV generadas por proyección de caja en ${mat.name || 'una zona'}.`);
      }
    }
  }

  // 2. Quitar texturas e imágenes que ya no usa nadie (reindexando referencias)
  const usedTextures = new Set(collectTextureRefs({ materials: json.materials, extensions: json.extensions, meshes: json.meshes, nodes: json.nodes }).map((r) => r.index));
  const texRemap = new Map<number, number>();
  const keptTextures: Json[] = [];
  json.textures.forEach((t: Json, i: number) => { if (usedTextures.has(i)) { texRemap.set(i, keptTextures.length); keptTextures.push(t); } });
  for (const ref of collectTextureRefs({ materials: json.materials, extensions: json.extensions, meshes: json.meshes, nodes: json.nodes })) ref.index = texRemap.get(ref.index);
  json.textures = keptTextures;
  const imageSources = (t: Json): number[] => {
    const out: number[] = [];
    if (typeof t.source === 'number') out.push(t.source);
    for (const ext of Object.values(t.extensions || {})) if (typeof (ext as Json).source === 'number') out.push((ext as Json).source);
    return out;
  };
  const usedImages = new Set<number>(json.textures.flatMap(imageSources));
  const imgRemap = new Map<number, number>();
  const keptImages: Json[] = [];
  json.images.forEach((im: Json, i: number) => {
    if (usedImages.has(i)) { imgRemap.set(i, keptImages.length); keptImages.push(im); }
    else if (im.bufferView !== undefined) views[im.bufferView] = new Uint8Array(4); // vista sin uso: se deja mínima
  });
  for (const t of json.textures) {
    if (typeof t.source === 'number') t.source = imgRemap.get(t.source);
    for (const ext of Object.values(t.extensions || {})) if (typeof (ext as Json).source === 'number') (ext as Json).source = imgRemap.get((ext as Json).source);
  }
  json.images = keptImages;
  // Samplers que ya no usa ninguna textura
  const usedSamplers = new Set<number>(json.textures.map((t: Json) => t.sampler).filter((v: unknown) => typeof v === 'number'));
  const samplerRemap = new Map<number, number>();
  const keptSamplers: Json[] = [];
  json.samplers.forEach((sm: Json, i: number) => { if (usedSamplers.has(i)) { samplerRemap.set(i, keptSamplers.length); keptSamplers.push(sm); } });
  for (const t of json.textures) if (typeof t.sampler === 'number') t.sampler = samplerRemap.get(t.sampler);
  json.samplers = keptSamplers;
  if (!json.images.length) delete json.images;
  if (!json.textures.length) delete json.textures;
  if (!json.samplers.length) delete json.samplers;

  // 3. Recompresión de imágenes según el tamaño máximo de cada zona
  if (json.images) {
    const imageMax = new Map<number, number>();
    const normalImages = new Set<number>();
    (json.materials || []).forEach((mat: Json, mi: number) => {
      const plan = plans.get(mi);
      const limit = plan && plan.maxSize > 0 ? plan.maxSize : Infinity;
      for (const ref of collectTextureRefs(mat)) {
        const tex = json.textures[ref.index];
        for (const src of tex ? imageSources(tex) : []) imageMax.set(src, Math.max(imageMax.get(src) ?? 0, limit));
      }
      if (mat.normalTexture) for (const src of imageSources(json.textures[mat.normalTexture.index])) normalImages.add(src);
    });
    let converted = 0;
    for (let i = 0; i < json.images.length; i++) {
      const im = json.images[i];
      if (im.bufferView === undefined) continue;
      const bytes = views[im.bufferView];
      const mime = im.mimeType || 'image/png';
      let bitmap: ImageBitmap;
      const copy = new Uint8Array(bytes.length);
      copy.set(bytes);
      try { bitmap = await createImageBitmap(new Blob([copy.buffer], { type: mime })); } catch { continue; }
      const limit = imageMax.get(i) ?? Infinity;
      const scale = Math.min(1, limit / Math.max(bitmap.width, bitmap.height));
      const w = Math.max(1, Math.round(bitmap.width * scale));
      const h = Math.max(1, Math.round(bitmap.height * scale));
      const canvas = sourceToCanvas(bitmap, w, h);
      bitmap.close();
      const opaque = isOpaque(canvas);
      const toJpeg = opaque && !normalImages.has(i);
      const outMime = toJpeg ? 'image/jpeg' : 'image/png';
      if (outMime === mime && scale === 1) continue;
      const out = await canvasToBytes(canvas, outMime, options.jpegQuality);
      if (out.length < bytes.length || scale < 1) {
        views[im.bufferView] = out;
        json.bufferViews[im.bufferView].byteLength = out.length;
        im.mimeType = outMime;
        converted++;
      }
    }
    if (converted) notes.push(`${converted} imágenes recomprimidas (JPEG si son opacas; los mapas normales se quedan en PNG).`);
  }

  // 4. Datos de huesos compactos (sin tocar animaciones ni esqueletos)
  if (options.compactSkin) {
    const viewUse = new Map<number, number>();
    (json.accessors || []).forEach((a: Json) => { if (a.bufferView !== undefined) viewUse.set(a.bufferView, (viewUse.get(a.bufferView) ?? 0) + 1); });
    const done = new Set<number>();
    let joints = 0, weights = 0;
    for (const m of json.meshes || []) {
      for (const p of m.primitives || []) {
        for (const [sem, accIndex] of Object.entries(p.attributes || {}) as [string, number][]) {
          if (done.has(accIndex)) continue;
          const acc = json.accessors[accIndex];
          if (acc.bufferView === undefined || acc.sparse || viewUse.get(acc.bufferView) !== 1) continue;
          // Solo vistas empaquetadas sin huecos (three.js escribe byteStride igual al tamaño del elemento)
          const stride = json.bufferViews[acc.bufferView].byteStride;
          if (stride && stride !== TYPE_COUNT[acc.type] * COMPONENT_SIZE[acc.componentType]) continue;
          if (sem.startsWith('JOINTS_') && acc.componentType === 5123) {
            const { data } = readAccessor(json, views, accIndex);
            if (data.every((v) => v <= 255)) {
              views[acc.bufferView] = Uint8Array.from(data);
              json.bufferViews[acc.bufferView].byteLength = data.length;
              if (stride) json.bufferViews[acc.bufferView].byteStride = 4;
              acc.componentType = 5121; delete acc.byteOffset; delete acc.min; delete acc.max;
              done.add(accIndex); joints++;
            }
          } else if (sem.startsWith('WEIGHTS_') && acc.componentType === 5126 && acc.type === 'VEC4') {
            const { data } = readAccessor(json, views, accIndex);
            const out = new Uint16Array(data.length);
            for (let i = 0; i < data.length; i += 4) {
              const s = data[i] + data[i + 1] + data[i + 2] + data[i + 3] || 1;
              let sum = 0, maxC = 0;
              for (let c = 0; c < 4; c++) {
                out[i + c] = Math.round((data[i + c] / s) * 65535);
                sum += out[i + c];
                if (out[i + c] > out[i + maxC]) maxC = c;
              }
              out[i + maxC] += 65535 - sum; // la suma vuelve a ser exactamente 1
            }
            views[acc.bufferView] = new Uint8Array(out.buffer);
            json.bufferViews[acc.bufferView].byteLength = out.byteLength;
            if (stride) json.bufferViews[acc.bufferView].byteStride = 8;
            acc.componentType = 5123; acc.normalized = true; delete acc.byteOffset; delete acc.min; delete acc.max;
            done.add(accIndex); weights++;
          }
        }
      }
    }
    if (joints || weights) notes.push(`Huesos: ${joints} accesores de índices a 8 bits y ${weights} de pesos a 16 bits.`);
  }

  // 5. Quitar vistas de buffer sin uso (p. ej. imágenes reemplazadas) y reindexar cualquier clave "bufferView"
  const viewRefs: Json[] = [];
  const findViewRefs = (node: Json) => {
    if (!node || typeof node !== 'object') return;
    if (typeof node.bufferView === 'number') viewRefs.push(node);
    for (const v of Object.values(node)) if (v && typeof v === 'object') findViewRefs(v);
  };
  for (const [k, v] of Object.entries(json)) if (k !== 'bufferViews') findViewRefs(v);
  const usedViews = new Set<number>(viewRefs.map((r) => r.bufferView));
  const viewRemap = new Map<number, number>();
  const keptViewJson: Json[] = [];
  const keptViewBytes: Uint8Array[] = [];
  json.bufferViews.forEach((bv: Json, i: number) => {
    if (usedViews.has(i)) { viewRemap.set(i, keptViewJson.length); keptViewJson.push(bv); keptViewBytes.push(views[i]); }
  });
  for (const r of viewRefs) r.bufferView = viewRemap.get(r.bufferView);
  json.bufferViews = keptViewJson;
  views.length = 0;
  views.push(...keptViewBytes);

  // 6. Reconstruir el buffer binario
  let total = 0;
  const offsets: number[] = views.map((v) => { const o = total; total = pad4(total + v.length); return o; });
  const bin = new Uint8Array(total);
  views.forEach((v, i) => { bin.set(v, offsets[i]); json.bufferViews[i].byteOffset = offsets[i]; json.bufferViews[i].byteLength = v.length; });
  json.buffers = [{ byteLength: total }];

  const bytes = writeGlb(json, bin);
  return { bytes, before, after: summarizeGlb(json, bytes.byteLength), notes };
}
