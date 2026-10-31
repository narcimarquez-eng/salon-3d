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

interface LoopEntry {
  object: THREE.Object3D;
  base: THREE.Vector3;
  scale: number;
  duration: number;
  sample: (t: number) => Vec3;
  toThree: (v: Vec3) => Vec3;
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
  varying vec3 vWorld;
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vWorld = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;

const WATER_FRAGMENT = /* glsl */ `
  uniform float uTime;
  uniform vec3 uColor;
  varying vec3 vWorld;
  void main() {
    float onda1 = sin(vWorld.x * 18.0 + uTime * 1.7) * sin(vWorld.z * 15.0 - uTime * 1.3);
    float onda2 = sin((vWorld.x + vWorld.z) * 9.0 + uTime * 2.3);
    float brillo = 0.5 + 0.25 * onda1 + 0.15 * onda2;
    vec3 color = uColor * (0.75 + 0.35 * brillo);
    color += vec3(0.25) * smoothstep(0.85, 1.0, brillo);
    gl_FragColor = vec4(color, 1.0);
  }
`;

export function addBlenderLoop(entry: LoopEntry): void {
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
    entry.scale = scale;
  }
  pending.length = 0;
}

/** Desplazamiento de la malla en unidades de la escena: muestra de la función × escala. */
function offsetOf(entry: LoopEntry, t: number): Vec3 {
  const d = entry.toThree(entry.sample(t));
  return [d[0] * entry.scale, d[1] * entry.scale, d[2] * entry.scale];
}

/** Convierte la superficie de una malla en agua animada. */
export function setBlenderWater(mesh: THREE.Mesh, color: THREE.Color, speed: number): void {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: color.clone() },
    },
    vertexShader: WATER_VERTEX,
    fragmentShader: WATER_FRAGMENT,
  });
  waters.push({ material, speed });
  mesh.material = material;
  mesh.userData.toonMaterial = material;
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

/** Avanza las animaciones del visor. `elapsed` son los segundos desde el inicio. */
export function tickBlenderAnimations(elapsed: number): void {
  for (let i = loops.length - 1; i >= 0; i--) {
    const entry = loops[i];
    if (!entry.object.parent) {
      loops.splice(i, 1);
      continue;
    }
    const t = (elapsed / entry.duration) % 1;
    const d = offsetOf(entry, t);
    entry.object.position.set(entry.base.x + d[0], entry.base.y + d[1], entry.base.z + d[2]);
  }
  for (const water of waters) {
    water.material.uniforms.uTime.value = elapsed * water.speed;
  }
}

/** Nombres de las mallas que tienen animación de posición activa. */
export function animatedMeshNames(): Set<string> {
  const names = new Set<string>();
  for (const entry of loops) {
    if (entry.object.parent) names.add(entry.object.name);
  }
  return names;
}

/** Material de exportación (estándar) para una malla de agua, o undefined si no es agua. */
export function exportMaterialFor(meshName: string): THREE.Material | undefined {
  return exportMaterials.get(meshName);
}

/**
 * Un único clip para exportar al .glb con una pista de posición por malla. Así un reproductor
 * que solo toma el primer clip anima todas las gotas, no solo una.
 * La duración del clip es la mayor de los bucles; cada pista se repite con su propio periodo.
 * Para que el bucle sea continuo, las duraciones deben ser múltiplos unas de otras.
 */
export function buildBlenderClips(): THREE.AnimationClip[] {
  const active = loops.filter((e) => e.object.parent);
  if (active.length === 0) return [];

  const total = Math.max(...active.map((e) => e.duration));
  const frames = Math.max(SAMPLES_PER_LOOP, Math.round(total * SAMPLES_PER_LOOP));
  const times: number[] = [];
  for (let k = 0; k <= frames; k++) {
    times.push((k / frames) * total);
  }

  const tracks = active.map((entry) => {
    const values: number[] = [];
    for (const time of times) {
      const t = (time / entry.duration) % 1;
      const d = offsetOf(entry, t);
      values.push(entry.base.x + d[0], entry.base.y + d[1], entry.base.z + d[2]);
    }
    return new THREE.VectorKeyframeTrack(`${entry.object.name}.position`, times.slice(), values);
  });

  return [new THREE.AnimationClip('ciclo', total, tracks)];
}
