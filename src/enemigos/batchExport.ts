// Descarga en lote de monstruos de Enemigo-rpg con las texturas recomendadas de salon-3d.
//
// Cada monstruo se genera, se texturiza y se optimiza igual que en el panel (sin pasar por el visor)
// y se guarda en  <calidad>/<categoría>/<id>_<calidad>.glb , con un índice indice.csv / indice.json.
// Destino: una carpeta elegida por el usuario (Chrome/Edge) o archivos ZIP por calidad y categoría.

import { analyzeGlbZones, optimizeGlb } from '../utils/glbZoneOptimizer';
import { MonsterInfo, MonsterTier, generateMonsterGlb } from './enemyGenerator';
import { SURFACE_LABELS, recommendMonsterPlans } from './monsterTextures';

export interface BatchEntry {
  archivo: string;
  clave: string;
  nombre: string;
  titulo: string;
  categoria: string;
  calidad: MonsterTier;
  nivel: string;
  elemento: string;
  superficie: string;
  triangulos: number;
  mb: number;
  esqueletos: number;
  animaciones: number;
  error?: string;
}

export interface BatchProgress {
  done: number;
  total: number;
  current: string;
  errors: number;
  etaSeconds: number | null;
}

/** Dónde se guardan los archivos. */
export interface BatchSink {
  write(path: string, bytes: Uint8Array): Promise<void>;
  /** Se llama al terminar un grupo (calidad + categoría): el ZIP lo usa para descargar. */
  flushGroup?(group: string): Promise<void>;
  finish(): Promise<void>;
}

export function slug(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\(\d+\)/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Genera un monstruo con las texturas recomendadas y lo devuelve optimizado. */
export async function buildTexturedMonster(info: MonsterInfo, tier: MonsterTier) {
  const g = await generateMonsterGlb(info.key, tier);
  const { zones } = analyzeGlbZones(g.bytes);
  const rec = recommendMonsterPlans(g.info, tier, zones);
  const r = await optimizeGlb(g.bytes, rec.plans, { jpegQuality: 0.88, compactSkin: true });
  return { gen: g, rec, result: r };
}

export async function exportMonstersBatch(
  monsters: MonsterInfo[],
  tiers: MonsterTier[],
  sink: BatchSink,
  onProgress: (p: BatchProgress) => void,
  shouldCancel: () => boolean
): Promise<{ entries: BatchEntry[]; cancelled: boolean }> {
  const entries: BatchEntry[] = [];
  const total = monsters.length * tiers.length;
  const t0 = performance.now();
  let done = 0;
  let errors = 0;
  let cancelled = false;

  outer: for (const tier of tiers) {
    // Agrupar por categoría para que cada ZIP (o subcarpeta) quede completo antes de pasar al siguiente
    const byCat = new Map<string, MonsterInfo[]>();
    for (const m of monsters) {
      const list = byCat.get(m.categoryLabel) || [];
      list.push(m);
      byCat.set(m.categoryLabel, list);
    }
    for (const [catLabel, list] of byCat) {
      const folder = `${tier}/${slug(catLabel)}`;
      for (const m of list) {
        if (shouldCancel()) { cancelled = true; break outer; }
        const elapsed = (performance.now() - t0) / 1000;
        onProgress({ done, total, current: `${m.name} (${tier})`, errors, etaSeconds: done ? (elapsed / done) * (total - done) : null });
        // Dejar respirar a la interfaz entre monstruos
        await new Promise((r) => setTimeout(r, 0));
        const base: Omit<BatchEntry, 'archivo' | 'triangulos' | 'mb' | 'esqueletos' | 'animaciones'> = {
          clave: m.key, nombre: m.name, titulo: m.title, categoria: catLabel, calidad: tier,
          nivel: m.rpgTier, elemento: m.element, superficie: '',
        };
        try {
          const { gen, rec, result } = await buildTexturedMonster(m, tier);
          const file = `${folder}/${gen.filename}`;
          await sink.write(file, result.bytes);
          entries.push({
            ...base,
            archivo: file,
            superficie: SURFACE_LABELS[rec.surface],
            triangulos: result.after.triangles,
            mb: +(result.bytes.byteLength / 1e6).toFixed(3),
            esqueletos: result.after.skins,
            animaciones: result.after.animations.length,
          });
        } catch (e) {
          errors++;
          entries.push({ ...base, archivo: '', triangulos: 0, mb: 0, esqueletos: 0, animaciones: 0, error: e instanceof Error ? e.message : String(e) });
        }
        done++;
      }
      await sink.flushGroup?.(folder);
    }
  }

  // Índice para el juego: qué hay, cuánto pesa y cuántos triángulos tiene cada archivo
  const cols: (keyof BatchEntry)[] = ['archivo', 'clave', 'nombre', 'titulo', 'categoria', 'calidad', 'nivel', 'elemento', 'superficie', 'triangulos', 'mb', 'esqueletos', 'animaciones', 'error'];
  const csvCell = (v: unknown) => {
    const s = v === undefined ? '' : String(v);
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [cols.join(','), ...entries.map((e) => cols.map((c) => csvCell(e[c])).join(','))].join('\n');
  const enc = new TextEncoder();
  await sink.write('indice.csv', enc.encode('﻿' + csv));
  await sink.write('indice.json', enc.encode(JSON.stringify(entries, null, 2)));
  await sink.flushGroup?.('indice');
  await sink.finish();
  onProgress({ done, total, current: '', errors, etaSeconds: 0 });
  return { entries, cancelled };
}

// ---------------------------------------------------------------------------
// Destino 1: carpeta elegida por el usuario (File System Access API, Chrome y Edge)
// ---------------------------------------------------------------------------
/* eslint-disable @typescript-eslint/no-explicit-any */
export function canPickFolder(): boolean {
  if (typeof (window as any).showDirectoryPicker !== 'function') return false;
  // Dentro de un marco de otra web (vista previa, editor...) Chrome no deja abrir el selector
  try {
    return window.top === window.self;
  } catch {
    return false;
  }
}

export async function folderSink(rootName = 'monstruos_salon3d'): Promise<BatchSink> {
  const picked = await (window as any).showDirectoryPicker({ id: 'salon3d-monstruos', mode: 'readwrite' });
  const root = await picked.getDirectoryHandle(rootName, { create: true });
  const dirs = new Map<string, any>([['', root]]);
  const dirFor = async (path: string) => {
    if (dirs.has(path)) return dirs.get(path);
    const parts = path.split('/');
    let cur = root;
    let acc = '';
    for (const p of parts) {
      acc = acc ? `${acc}/${p}` : p;
      if (!dirs.has(acc)) dirs.set(acc, await cur.getDirectoryHandle(p, { create: true }));
      cur = dirs.get(acc);
    }
    return cur;
  };
  return {
    async write(path, bytes) {
      const i = path.lastIndexOf('/');
      const dir = await dirFor(i < 0 ? '' : path.slice(0, i));
      const fh = await dir.getFileHandle(path.slice(i + 1), { create: true });
      const w = await fh.createWritable();
      await w.write(bytes);
      await w.close();
    },
    async finish() { /* nada que cerrar */ },
  };
}

// ---------------------------------------------------------------------------
// Destino 2: ZIP (sin compresión: los GLB ya vienen optimizados) por calidad y categoría
// ---------------------------------------------------------------------------
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

export function buildZip(files: { name: string; bytes: Uint8Array }[]): Blob {
  const enc = new TextEncoder();
  const now = new Date();
  const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | Math.floor(now.getSeconds() / 2);
  const dosDate = ((Math.max(1980, now.getFullYear()) - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
  const parts: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const f of files) {
    const name = enc.encode(f.name);
    const crc = crc32(f.bytes);
    const local = new Uint8Array(30 + name.length);
    const dv = new DataView(local.buffer);
    dv.setUint32(0, 0x04034b50, true);
    dv.setUint16(4, 20, true);
    dv.setUint16(6, 0x0800, true); // nombres en UTF-8
    dv.setUint16(8, 0, true); // sin compresión
    dv.setUint16(10, dosTime, true);
    dv.setUint16(12, dosDate, true);
    dv.setUint32(14, crc, true);
    dv.setUint32(18, f.bytes.length, true);
    dv.setUint32(22, f.bytes.length, true);
    dv.setUint16(26, name.length, true);
    local.set(name, 30);
    const cen = new Uint8Array(46 + name.length);
    const cv = new DataView(cen.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0x0800, true);
    cv.setUint16(12, dosTime, true);
    cv.setUint16(14, dosDate, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, f.bytes.length, true);
    cv.setUint32(24, f.bytes.length, true);
    cv.setUint16(28, name.length, true);
    cv.setUint32(42, offset, true);
    cen.set(name, 46);
    parts.push(local, f.bytes);
    central.push(cen);
    offset += local.length + f.bytes.length;
  }
  const cenSize = central.reduce((s, c) => s + c.length, 0);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, files.length, true);
  ev.setUint16(10, files.length, true);
  ev.setUint32(12, cenSize, true);
  ev.setUint32(16, offset, true);
  return new Blob([...parts, ...central, end].map((p) => p.slice().buffer as ArrayBuffer), { type: 'application/zip' });
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

/** Un ZIP por grupo (calidad + categoría): así nunca se acumulan cientos de MB en memoria. */
export function zipSink(prefix = 'monstruos_salon3d'): BatchSink {
  let pending: { name: string; bytes: Uint8Array }[] = [];
  return {
    async write(path, bytes) {
      pending.push({ name: `${prefix}/${path}`, bytes });
    },
    async flushGroup(group) {
      if (!pending.length) return;
      triggerDownload(buildZip(pending), `${prefix}_${group.replace(/\//g, '_')}.zip`);
      pending = [];
      await new Promise((r) => setTimeout(r, 400)); // el navegador encola mejor las descargas seguidas
    },
    async finish() {
      if (pending.length) triggerDownload(buildZip(pending), `${prefix}_resto.zip`);
      pending = [];
    },
  };
}
