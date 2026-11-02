import * as THREE from 'three';

/**
 * Animaciones creadas desde scripts de Python:
 * - bucles de posición (gotas, chorros): una función f(t) con t en [0, 1) da el desplazamiento
 *   de la malla respecto a su posición inicial. Se reproducen en el visor y se exportan
 *   como AnimationClip en bucle dentro del .glb.
 * - agua: material con ondas animadas en el visor; en el .glb se exporta con un material
 *   estándar del mismo color.
 */

export type Vec3 = [number, number, number];

export interface LoopEntry {
  object: THREE.Object3D;
  base: THREE.Vector3;
  baseRot?: THREE.Euler;
  baseScale?: THREE.Vector3;
  scale: number;
  duration: number;
  sample: (t: number) => Vec3;
  toThree: (v: Vec3) => Vec3;
  presetType?: 'CALLBACK' | 'TURNTABLE' | 'HOVER' | 'PULSE' | 'PENDULUM' | 'ORBIT';
  speed?: number;
  amplitude?: number;
  axis?: 'X' | 'Y' | 'Z';
}

interface WaterEntry {
  material: THREE.ShaderMaterial;
  speed: number;
}

const SAMPLES_PER_LOOP = 24;

const loops: LoopEntry[] = [];
// Bucles creados por la ejecución en curso (se cierran al terminar el script)
const pending: LoopEntry[] = [];
const waters: WaterEntry[] = [];
const exportMaterials = new Map<string, THREE.Material>();

const WATER_VERTEX = /* glsl */ `
  uniform float uTime;
  uniform float uAmplitude;
  uniform float uFrequency;
  varying vec3 vWorld;
  varying float vWaveHeight;
  void main() {
    vec3 pos = position;
    vec4 worldBase = modelMatrix * vec4(pos, 1.0);
    float w1 = sin(worldBase.x * uFrequency + uTime * 1.8) * cos(worldBase.z * uFrequency * 0.85 - uTime * 1.4);
    float w2 = sin((worldBase.x * 0.7 + worldBase.z * 0.9) * (uFrequency * 1.6) + uTime * 2.4) * 0.45;
    float wave = (w1 + w2) * uAmplitude;
    pos.y += wave;
    vWaveHeight = w1 + w2;
    vec4 w = modelMatrix * vec4(pos, 1.0);
    vWorld = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;

const WATER_FRAGMENT = /* glsl */ `
  uniform float uTime;
  uniform vec3 uColor;
  uniform float uFrequency;
  varying vec3 vWorld;
  varying float vWaveHeight;
  void main() {
    float freq = max(1.0, uFrequency * 4.5);
    float onda1 = sin(vWorld.x * freq + uTime * 1.7) * sin(vWorld.z * (freq * 0.85) - uTime * 1.3);
    float onda2 = sin((vWorld.x + vWorld.z) * (freq * 0.55) + uTime * 2.3);
    float brillo = 0.52 + 0.25 * onda1 + 0.16 * onda2 + 0.12 * vWaveHeight;
    vec3 deepColor = uColor * 0.68;
    vec3 crestColor = mix(uColor * 1.25, vec3(0.88, 0.97, 1.0), 0.38);
    vec3 color = mix(deepColor, crestColor, clamp(brillo, 0.0, 1.0));
    // Espuma y cáusticas brillantes en las crestas
    color += vec3(0.32, 0.38, 0.42) * smoothstep(0.76, 0.98, brillo);
    gl_FragColor = vec4(color, 0.92);
  }
`;

// Objetos estáticos preasignados (Object Pooling) para eliminar asignaciones y pausas de Garbage Collector en el bucle 60 FPS
const _tempEuler = new THREE.Euler();
const _defaultRot = new THREE.Euler();
const _defaultScale = new THREE.Vector3(1, 1, 1);
const _cachedSampleResult: Vec3 = [0, 0, 0];

export function addBlenderLoop(entry: LoopEntry): void {
  if (!entry.baseRot) entry.baseRot = entry.object.rotation.clone();
  if (!entry.baseScale) entry.baseScale = entry.object.scale.clone();
  loops.push(entry);
  pending.push(entry);
}

/** Empieza una ejecución de script: los bucles nuevos se registran como pendientes. */
export function startBlenderRun(): void {
  pending.length = 0;
}

/**
 * Cierra la ejecución: toma la posición final de cada malla (después del auto-escalado del
 * modelo) y aplica el mismo factor a los desplazamientos.
 */
export function finalizeBlenderRun(scale: number): void {
  for (const entry of pending) {
    entry.base = entry.object.position.clone();
    entry.baseRot = entry.object.rotation.clone();
    entry.baseScale = entry.object.scale.clone();
    entry.scale = scale;
  }
  pending.length = 0;
}

/** Desplazamiento de la malla en unidades de la escena reutilizando búfer preasignado */
function sampleOffsetInto(entry: LoopEntry, t: number, out: Vec3): void {
  const sampled = entry.sample(t);
  const d = entry.toThree(sampled);
  out[0] = (d[0] || 0) * entry.scale;
  out[1] = (d[1] || 0) * entry.scale;
  out[2] = (d[2] || 0) * entry.scale;
}

/** Convierte la superficie de una malla en agua animada con olas 3D y cáusticas. */
export function setBlenderWater(
  mesh: THREE.Mesh,
  color: THREE.Color,
  speed: number = 1.8,
  amplitude: number = 0.04,
  frequency: number = 3.2
): void {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: color.clone() },
      uAmplitude: { value: Math.max(0.0, Math.min(0.45, Number(amplitude) || 0.04)) },
      uFrequency: { value: Math.max(0.4, Math.min(18.0, Number(frequency) || 3.2)) },
    },
    vertexShader: WATER_VERTEX,
    fragmentShader: WATER_FRAGMENT,
    transparent: true,
    side: THREE.DoubleSide,
  });
  waters.push({ material, speed: Number(speed) || 1.8 });
  mesh.material = material;
  mesh.userData.toonMaterial = material;
  mesh.userData.eeveeMaterial = material;
  mesh.userData.cyclesMaterial = material;
  exportMaterials.set(
    mesh.name,
    new THREE.MeshStandardMaterial({
      color: color.clone(),
      roughness: 0.08,
      metalness: 0.0,
      emissive: color.clone(),
      emissiveIntensity: 0.25,
    })
  );
}

/** Avanza las animaciones del visor sin asignaciones de memoria (Zero GC Stutters). */
export function tickBlenderAnimations(elapsed: number): void {
  for (let i = loops.length - 1; i >= 0; i--) {
    const entry = loops[i];
    if (!entry.object.parent) {
      loops.splice(i, 1);
      continue;
    }
    const mode = entry.presetType || 'CALLBACK';
    const spd = entry.speed ?? 1.0;
    const amp = entry.amplitude ?? 0.12;
    const ax = entry.axis || 'Y';

    if (mode === 'TURNTABLE') {
      const baseR = entry.baseRot || _defaultRot;
      const angle = elapsed * spd * 1.4;
      if (ax === 'X') entry.object.rotation.x = baseR.x + angle;
      else if (ax === 'Z') entry.object.rotation.z = baseR.z + angle;
      else entry.object.rotation.y = baseR.y + angle;
    } else if (mode === 'HOVER') {
      const wave = Math.sin(elapsed * spd * 2.2) * amp * entry.scale;
      entry.object.position.set(entry.base.x, entry.base.y + wave, entry.base.z);
    } else if (mode === 'PULSE') {
      const baseS = entry.baseScale || _defaultScale;
      const factor = 1.0 + Math.sin(elapsed * spd * 2.6) * Math.min(0.45, amp);
      entry.object.scale.set(baseS.x * factor, baseS.y * factor, baseS.z * factor);
    } else if (mode === 'PENDULUM') {
      const baseR = entry.baseRot || _defaultRot;
      const swing = Math.sin(elapsed * spd * 2.2) * amp;
      if (ax === 'X') entry.object.rotation.x = baseR.x + swing;
      else if (ax === 'Y') entry.object.rotation.y = baseR.y + swing;
      else entry.object.rotation.z = baseR.z + swing;
    } else if (mode === 'ORBIT') {
      const radius = Math.max(0.05, amp) * entry.scale;
      const ang = elapsed * spd * 1.6;
      entry.object.position.set(
        entry.base.x + Math.cos(ang) * radius,
        entry.base.y,
        entry.base.z + Math.sin(ang) * radius
      );
    } else {
      const dur = Math.max(0.05, entry.duration);
      const t = (elapsed / dur) % 1;
      sampleOffsetInto(entry, t, _cachedSampleResult);
      entry.object.position.set(
        entry.base.x + _cachedSampleResult[0],
        entry.base.y + _cachedSampleResult[1],
        entry.base.z + _cachedSampleResult[2]
      );
    }
  }
  for (let w = 0; w < waters.length; w++) {
    waters[w].material.uniforms.uTime.value = elapsed * waters[w].speed;
  }
}

/** Nombres de las mallas que tienen animación de posición activa. */
export function animatedMeshNames(): Set<string> {
  const names = new Set<string>();
  for (const entry of loops) {
    if (entry.object.parent && entry.object.name) {
      names.add(entry.object.name);
    }
  }
  return names;
}

/** Material de exportación (estándar) para una malla de agua, o undefined si no es agua. */
export function exportMaterialFor(meshName: string): THREE.Material | undefined {
  return exportMaterials.get(meshName);
}

/**
 * Construye pistas de animación seguras y validadas para el archivo .GLB.
 * Filtra únicamente mallas presentes en la escena exportada y descarta pistas vacías o inválidas.
 */
export function buildBlenderClips(validNodeNames?: Set<string>): THREE.AnimationClip[] {
  const active = loops.filter((e) => {
    if (!e.object.parent) return false;
    const name = e.object.name?.trim();
    if (!name) return false;
    if (validNodeNames && !validNodeNames.has(name)) return false;
    return true;
  });
  if (active.length === 0) return [];

  const durations = active.map((e) => Math.max(0.1, Number(e.duration) || 1.0));
  const total = Math.max(...durations);
  if (!Number.isFinite(total) || total <= 0) return [];

  const frames = Math.max(SAMPLES_PER_LOOP, Math.round(total * SAMPLES_PER_LOOP));
  const times: number[] = [];
  for (let k = 0; k <= frames; k++) {
    times.push((k / frames) * total);
  }

  const tracks: THREE.VectorKeyframeTrack[] = [];
  const sampleBuf: Vec3 = [0, 0, 0];

  for (const entry of active) {
    const objName = entry.object.name.trim();
    const dur = Math.max(0.05, Number(entry.duration) || 1.0);
    const values: number[] = [];
    let hasValidValues = true;

    for (const time of times) {
      const t = (time / dur) % 1;
      sampleOffsetInto(entry, t, sampleBuf);
      const vx = entry.base.x + sampleBuf[0];
      const vy = entry.base.y + sampleBuf[1];
      const vz = entry.base.z + sampleBuf[2];
      if (!Number.isFinite(vx) || !Number.isFinite(vy) || !Number.isFinite(vz)) {
        hasValidValues = false;
        break;
      }
      values.push(vx, vy, vz);
    }

    if (hasValidValues && values.length === times.length * 3) {
      tracks.push(new THREE.VectorKeyframeTrack(`${objName}.position`, times.slice(), values));
    }
  }

  if (tracks.length === 0) return [];
  return [new THREE.AnimationClip('animaciones_blender', total, tracks)];
}
