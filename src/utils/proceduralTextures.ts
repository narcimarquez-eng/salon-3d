import * as THREE from 'three';

export type TexturePatternType =
  | 'none'
  | 'dragon_scales'
  | 'biomech_plates'
  | 'magma_cracks'
  | 'halftone_manga'
  | 'cyber_circuits'
  | 'smooth_skin';

export interface TexturePresetInfo {
  id: TexturePatternType;
  name: string;
  description: string;
  thumbnailColor: string;
  isEmissive?: boolean;
}

export const TEXTURE_PRESETS: TexturePresetInfo[] = [
  {
    id: 'none',
    name: 'Original GLB',
    description: 'Textura o color base original del archivo importado',
    thumbnailColor: '#64748b',
  },
  {
    id: 'dragon_scales',
    name: 'Escamas de Dragón',
    description: 'Piel reptiliana escamada con relieve orgánico',
    thumbnailColor: '#10b981',
  },
  {
    id: 'biomech_plates',
    name: 'Exoesqueleto Biomec',
    description: 'Placas quitinosas alienígenas con hendiduras profundas',
    thumbnailColor: '#8b5cf6',
  },
  {
    id: 'magma_cracks',
    name: 'Grietas de Magma',
    description: 'Roca volcánica con fisuras incandescentes luminosas',
    thumbnailColor: '#ef4444',
    isEmissive: true,
  },
  {
    id: 'halftone_manga',
    name: 'Trama Manga Anime',
    description: 'Patrón de puntos Ben-Day de cómic e imprenta japonesa',
    thumbnailColor: '#f59e0b',
  },
  {
    id: 'cyber_circuits',
    name: 'Circuitos Cyber',
    description: 'Líneas de pistas digitales y microchips de androide',
    thumbnailColor: '#06b6d4',
  },
  {
    id: 'smooth_skin',
    name: 'Piel Orgánica Lisa',
    description: 'Dermis suave difuminada para acentuar el redondeo',
    thumbnailColor: '#f43f5e',
  },
];

const textureCache = new Map<string, THREE.CanvasTexture>();

/**
 * Genera texturas procedurales 2D en memoria con repetición perfecta
 * para mapear sobre las mallas del modelo.
 */
export function generateProceduralTexture(type: TexturePatternType, baseHex: string = '#d9534f'): THREE.CanvasTexture | null {
  if (type === 'none') return null;

  const cacheKey = `${type}_${baseHex}`;
  if (textureCache.has(cacheKey)) {
    return textureCache.get(cacheKey)!;
  }

  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const baseCol = new THREE.Color(baseHex);
  const r255 = Math.round(baseCol.r * 255);
  const g255 = Math.round(baseCol.g * 255);
  const b255 = Math.round(baseCol.b * 255);

  ctx.fillStyle = `rgb(${r255}, ${g255}, ${b255})`;
  ctx.fillRect(0, 0, size, size);

  if (type === 'dragon_scales') {
    // Escamas imbricadas hexagonales / curvas
    const scaleW = 32;
    const scaleH = 24;
    for (let y = -scaleH; y < size + scaleH; y += scaleH * 0.75) {
      const rowOffset = Math.floor(y / scaleH) % 2 === 0 ? 0 : scaleW / 2;
      for (let x = -scaleW; x < size + scaleW; x += scaleW) {
        const cx = x + rowOffset;
        const cy = y;

        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, scaleW * 0.6, 0, Math.PI);
        ctx.closePath();

        const grad = ctx.createRadialGradient(cx, cy - 4, 2, cx, cy, scaleW * 0.6);
        grad.addColorStop(0, `rgba(255, 255, 255, 0.35)`);
        grad.addColorStop(0.7, `rgba(${Math.max(0, r255 - 40)}, ${Math.max(0, g255 - 40)}, ${Math.max(0, b255 - 40)}, 0.9)`);
        grad.addColorStop(1, `rgba(15, 23, 42, 0.95)`);

        ctx.fillStyle = grad;
        ctx.fill();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.75)';
        ctx.stroke();
        ctx.restore();
      }
    }
  } else if (type === 'biomech_plates') {
    // Placas con biseles y tornillos
    const step = 64;
    for (let x = 0; x < size; x += step) {
      for (let y = 0; y < size; y += step) {
        ctx.strokeStyle = 'rgba(15, 23, 42, 0.85)';
        ctx.lineWidth = 3;
        ctx.strokeRect(x + 2, y + 2, step - 4, step - 4);

        ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
        ctx.fillRect(x + 4, y + 4, step - 8, step - 8);

        // Remache en las esquinas
        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.arc(x + 8, y + 8, 2.5, 0, Math.PI * 2);
        ctx.arc(x + step - 8, y + 8, 2.5, 0, Math.PI * 2);
        ctx.arc(x + 8, y + step - 8, 2.5, 0, Math.PI * 2);
        ctx.arc(x + step - 8, y + step - 8, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  } else if (type === 'magma_cracks') {
    // Fondo de basalto volcánico oscuro
    ctx.fillStyle = '#141419';
    ctx.fillRect(0, 0, size, size);

    // Fisuras de magma con fulgor
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#ff3700';
    ctx.shadowColor = '#ff9900';
    ctx.shadowBlur = 12;

    const drawCrack = (x1: number, y1: number, length: number, angle: number, depth: number) => {
      if (depth <= 0) return;
      const x2 = x1 + Math.cos(angle) * length;
      const y2 = y1 + Math.sin(angle) * length;

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();

      const branchAngle1 = angle + (Math.random() * 0.8 - 0.4);
      const branchAngle2 = angle + (Math.random() * 0.8 + 0.3);
      drawCrack(x2, y2, length * 0.75, branchAngle1, depth - 1);
      if (Math.random() > 0.4) {
        drawCrack(x2, y2, length * 0.6, branchAngle2, depth - 1);
      }
    };

    for (let i = 0; i < 8; i++) {
      const sx = (i * size) / 8 + 30;
      const sy = Math.random() * size;
      drawCrack(sx, sy, 55, Math.random() * Math.PI * 2, 4);
    }
    ctx.shadowBlur = 0;
  } else if (type === 'halftone_manga') {
    // Puntos semitono Manga con ángulo de 45°
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, size, size);

    const dotSpacing = 16;
    for (let x = 0; x < size; x += dotSpacing) {
      for (let y = 0; y < size; y += dotSpacing) {
        const distFromCenter = Math.hypot(x - size / 2, y - size / 2) / (size / 2);
        const radius = Math.max(1.5, Math.min(6.5, (1.0 - distFromCenter * 0.5) * 5.0));

        ctx.fillStyle = '#1e293b';
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  } else if (type === 'cyber_circuits') {
    ctx.fillStyle = '#0a0f1d';
    ctx.fillRect(0, 0, size, size);

    ctx.strokeStyle = '#06b6d4';
    ctx.lineWidth = 2.5;

    for (let i = 0; i < 18; i++) {
      let cx = (i * 32) % size;
      let cy = (i * 48) % size;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      cx += 40;
      ctx.lineTo(cx, cy);
      cy += 30;
      ctx.lineTo(cx, cy);
      cx += 60;
      ctx.lineTo(cx, cy);
      ctx.stroke();

      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.arc(cx, cy, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (type === 'smooth_skin') {
    // Gradiente orgánico con sub-surface scattering falso
    const grad = ctx.createLinearGradient(0, 0, size, size);
    grad.addColorStop(0, `rgb(${r255}, ${g255}, ${b255})`);
    grad.addColorStop(0.5, `rgb(${Math.min(255, r255 + 25)}, ${Math.min(255, g255 + 15)}, ${Math.min(255, b255 + 15)})`);
    grad.addColorStop(1, `rgb(${Math.max(0, r255 - 20)}, ${Math.max(0, g255 - 20)}, ${Math.max(0, b255 - 20)})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2, 2);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;

  textureCache.set(cacheKey, texture);
  return texture;
}
