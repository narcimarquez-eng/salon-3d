import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';
import { getProceduralMatcapTexture, MatcapPresetId } from './matcapGenerator';

/**
 * Interfaz de metadatos almacenados en cada malla (Mesh) para permitir
 * interpolación en tiempo real de normales, sombreados y siluetas de contorno (Outline).
 */
export interface ProcessedMeshData {
  flatNormals: Float32Array;
  weldedSmoothNormals: Float32Array;
  sphericalNormals: Float32Array;
  originalMaterial: THREE.Material | THREE.Material[];
  toonMaterial: THREE.MeshToonMaterial;
  matcapMaterial: THREE.MeshMatcapMaterial;
  normalDebugMaterial: THREE.MeshNormalMaterial;
  outlineMesh: THREE.Mesh;
}

const _tempVecA = new THREE.Vector3();
const _tempVecB = new THREE.Vector3();
const _tempVecC = new THREE.Vector3();
const _center = new THREE.Vector3();

/**
 * Crea una textura 1D (DataTexture) de 3 escalones bien luminosos para Cel-Shading (Toon).
 * Evita sombras demasiado oscuras para que todos los detalles del enemigo se vean con claridad.
 */
export function createThreeToneGradientTexture(): THREE.DataTexture {
  // 3 tonos discretos luminosos: Sombra clara (118), Medio tono (192), Luz directa (255)
  const data = new Uint8Array([
    118, 122, 138, 255,
    192, 196, 206, 255,
    255, 255, 255, 255,
  ]);
  const texture = new THREE.DataTexture(data, 3, 1, THREE.RGBAFormat);
  texture.minFilter = THREE.NearestFilter;
  texture.magFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}

/**
 * Calcula normales soldados (Welded Vertex Normals) y normales esféricas radiales
 * para cualquier BufferGeometry, aunque tenga aristas divididas (hard edges / UV seams).
 * Guarda los buffers en `mesh.userData.normalsData` para interpolarlos en tiempo real.
 */
export function prepareGeometryNormals(mesh: THREE.Mesh): void {
  const geometry = mesh.geometry as THREE.BufferGeometry;

  const nonIndexedGeo = geometry.index ? geometry.toNonIndexed() : geometry.clone();
  nonIndexedGeo.computeVertexNormals(); // Normales planas por cara (muestran los polígonos)

  const posAttr = nonIndexedGeo.attributes.position as THREE.BufferAttribute;
  const flatNormAttr = nonIndexedGeo.attributes.normal as THREE.BufferAttribute;
  const vertexCount = posAttr.count;

  const flatNormals = new Float32Array(flatNormAttr.array);
  const weldedSmoothNormals = new Float32Array(vertexCount * 3);
  const sphericalNormals = new Float32Array(vertexCount * 3);

  // Calcular centro geométrico de la malla para proyección esférica orgánica
  nonIndexedGeo.computeBoundingBox();
  if (nonIndexedGeo.boundingBox) {
    nonIndexedGeo.boundingBox.getCenter(_center);
  } else {
    _center.set(0, 0, 0);
  }

  // Agrupar vértices por posición espacial cuantizada (tolerancia 1e-3) para soldar aristas duras
  const spatialMap = new Map<string, THREE.Vector3>();
  const precision = 1000;

  for (let i = 0; i < vertexCount; i++) {
    const vx = posAttr.getX(i);
    const vy = posAttr.getY(i);
    const vz = posAttr.getZ(i);
    const key = `${Math.round(vx * precision)}_${Math.round(vy * precision)}_${Math.round(vz * precision)}`;

    const nx = flatNormals[i * 3];
    const ny = flatNormals[i * 3 + 1];
    const nz = flatNormals[i * 3 + 2];

    let acc = spatialMap.get(key);
    if (!acc) {
      acc = new THREE.Vector3(nx, ny, nz);
      spatialMap.set(key, acc);
    } else {
      acc.x += nx;
      acc.y += ny;
      acc.z += nz;
    }
  }

  spatialMap.forEach((vec) => vec.normalize());

  // Segunda pasada: rellenar weldedSmoothNormals y sphericalNormals
  for (let i = 0; i < vertexCount; i++) {
    const vx = posAttr.getX(i);
    const vy = posAttr.getY(i);
    const vz = posAttr.getZ(i);
    const key = `${Math.round(vx * precision)}_${Math.round(vy * precision)}_${Math.round(vz * precision)}`;

    const welded = spatialMap.get(key)!;
    weldedSmoothNormals[i * 3] = welded.x;
    weldedSmoothNormals[i * 3 + 1] = welded.y;
    weldedSmoothNormals[i * 3 + 2] = welded.z;

    // Normal esférica: mezcla entre la normal soldada (62%) y el vector radial desde el centro (38%)
    _tempVecA.set(vx - _center.x, vy - _center.y, vz - _center.z).normalize();
    _tempVecB.copy(welded).lerp(_tempVecA, 0.38).normalize();

    sphericalNormals[i * 3] = _tempVecB.x;
    sphericalNormals[i * 3 + 1] = _tempVecB.y;
    sphericalNormals[i * 3 + 2] = _tempVecB.z;
  }

  // Atributo personalizado `aSmoothNormal` para el Inverted Hull Outline Shader
  nonIndexedGeo.setAttribute(
    'aSmoothNormal',
    new THREE.BufferAttribute(new Float32Array(weldedSmoothNormals), 3)
  );

  mesh.geometry.dispose();
  mesh.geometry = nonIndexedGeo;

  mesh.userData.normalsData = {
    flatNormals,
    weldedSmoothNormals,
    sphericalNormals,
  };
}

/**
 * Actualiza en tiempo real el atributo `normal` de todas las mallas del modelo
 * interpolando entre:
 * - 0.0: Normales facetadas originales (se aprecian los triángulos del low-poly)
 * - 0.65: Normales soldadas suaves (Phong / Vertex Normal Welding)
 * - 1.0: Normales esféricas orgánicas (rebote de luz redondeado que oculta las aristas)
 */
export function applyNormalSmoothingToModel(
  root: THREE.Object3D,
  smoothingFactor: number
): void {
  const t = THREE.MathUtils.clamp(smoothingFactor, 0, 1);

  root.traverse((child) => {
    if ((child as THREE.Mesh).isMesh && !child.userData.isOutlineMesh) {
      const mesh = child as THREE.Mesh;
      const data = mesh.userData.normalsData as {
        flatNormals: Float32Array;
        weldedSmoothNormals: Float32Array;
        sphericalNormals: Float32Array;
      } | undefined;

      if (!data) return;

      const normalAttr = mesh.geometry.attributes.normal as THREE.BufferAttribute;
      const arr = normalAttr.array as Float32Array;
      const count = normalAttr.count;

      for (let i = 0; i < count; i++) {
        const idx = i * 3;
        if (t <= 0.65) {
          const localT = t / 0.65;
          _tempVecA.set(data.flatNormals[idx], data.flatNormals[idx + 1], data.flatNormals[idx + 2]);
          _tempVecB.set(
            data.weldedSmoothNormals[idx],
            data.weldedSmoothNormals[idx + 1],
            data.weldedSmoothNormals[idx + 2]
          );
          _tempVecC.lerpVectors(_tempVecA, _tempVecB, localT).normalize();
        } else {
          const localT = (t - 0.65) / 0.35;
          _tempVecA.set(
            data.weldedSmoothNormals[idx],
            data.weldedSmoothNormals[idx + 1],
            data.weldedSmoothNormals[idx + 2]
          );
          _tempVecB.set(
            data.sphericalNormals[idx],
            data.sphericalNormals[idx + 1],
            data.sphericalNormals[idx + 2]
          );
          _tempVecC.lerpVectors(_tempVecA, _tempVecB, localT).normalize();
        }

        arr[idx] = _tempVecC.x;
        arr[idx + 1] = _tempVecC.y;
        arr[idx + 2] = _tempVecC.z;
      }

      normalAttr.needsUpdate = true;
    }
  });
}

/**
 * Crea un ShaderMaterial de contorno (Inverted Hull Outline) que extruye los vértices
 * a lo largo de sus normales soldadas (`aSmoothNormal`) con renderizado BackSide.
 */
export function createComicOutlineMaterial(
  thickness: number,
  opacity: number,
  outlineColor: string = '#090a0f'
): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uThickness: { value: thickness * 0.013 },
      uOpacity: { value: opacity },
      uColor: { value: new THREE.Color(outlineColor) },
    },
    vertexShader: /* glsl */ `
      attribute vec3 aSmoothNormal;
      uniform float uThickness;

      void main() {
        vec3 n = length(aSmoothNormal) > 0.01 ? normalize(aSmoothNormal) : normalize(normal);
        vec3 displacedPosition = position + n * uThickness;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(displacedPosition, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uOpacity;

      void main() {
        if (uOpacity <= 0.01) discard;
        gl_FragColor = vec4(uColor, uOpacity);
      }
    `,
    side: THREE.BackSide,
    transparent: true,
    depthWrite: true,
  });
}

/**
 * Procesa un modelo 3D importado (o procedural):
 * 1. Centra y escala automáticamente a 3.1 unidades en el origen para que se vea grande y claro.
 * 2. Calcula las normales promediadas y esféricas para ocultar facetas low-poly.
 * 3. Genera materiales Cel-Shading, MatCap de Escultura y Mapa de Normales.
 * 4. Adjunta mallas de contorno (Outline Shader) sincronizadas y guarda copia de respaldo para Undo.
 */
export function setupStylizedEnemyModel(
  modelRoot: THREE.Object3D,
  gradientTexture: THREE.DataTexture,
  initialSmoothing: number,
  outlineThickness: number,
  outlineOpacity: number,
  matcapPreset: MatcapPresetId = 'clay'
): {
  wrapper: THREE.Group;
  triangleCount: number;
  vertexCount: number;
  meshCount: number;
} {
  const wrapper = new THREE.Group();
  wrapper.add(modelRoot);

  // 1. Calcular Bounding Box para centrar y escalar automáticamente al origen con mayor presencia (3.1 unidades)
  const box = new THREE.Box3().setFromObject(modelRoot);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());

  const maxDim = Math.max(size.x, size.y, size.z, 0.001);
  const targetScale = 3.1 / maxDim;

  modelRoot.scale.setScalar(targetScale);
  modelRoot.position.set(
    -center.x * targetScale,
    -box.min.y * targetScale - 1.35, // Apoyado firmemente sobre el pedestal iluminado
    -center.z * targetScale
  );

  let triangleCount = 0;
  let vertexCount = 0;
  let meshCount = 0;

  const meshesToProcess: THREE.Mesh[] = [];
  modelRoot.traverse((child) => {
    if ((child as THREE.Mesh).isMesh && !child.userData.isOutlineMesh) {
      meshesToProcess.push(child as THREE.Mesh);
    }
  });

  const defaultMatcapTex = getProceduralMatcapTexture(matcapPreset);

  for (const mesh of meshesToProcess) {
    meshCount++;
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    // 2. Preparar suavizado de normales (Vertex Normal Blending)
    prepareGeometryNormals(mesh);

    const posAttr = mesh.geometry.attributes.position as THREE.BufferAttribute;
    // Guardar copia pristina de las posiciones iniciales para poder Restaurar / Deshacer
    mesh.userData.initialPositions = new Float32Array(posAttr.array);
    mesh.userData.undoStack = [] as Float32Array[];

    vertexCount += posAttr.count;
    triangleCount += Math.floor(posAttr.count / 3);

    // 3. Crear materiales (Cel-Shading 3 tonos, MatCap Escultura, Normal Debug y Original PBR)
    const origMat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
    const stdMat = origMat as THREE.MeshStandardMaterial;

    const baseColor = stdMat?.color ? stdMat.color.clone() : new THREE.Color('#e11d48');
    const baseMap = stdMat?.map || null;
    const emissiveColor = stdMat?.emissive ? stdMat.emissive.clone() : new THREE.Color(0x000000);
    const emissiveMap = stdMat?.emissiveMap || null;
    const emissiveIntensity = stdMat?.emissiveIntensity ?? 1.0;

    mesh.userData.originalMap = baseMap;
    mesh.userData.originalColorHex = `#${baseColor.getHexString()}`;

    const toonMaterial = new THREE.MeshToonMaterial({
      color: baseColor,
      map: baseMap,
      gradientMap: gradientTexture,
      emissive: emissiveColor,
      emissiveMap: emissiveMap,
      emissiveIntensity: emissiveIntensity,
    });

    const matcapMaterial = new THREE.MeshMatcapMaterial({
      matcap: defaultMatcapTex,
      color: new THREE.Color(0xffffff),
    });

    const normalDebugMaterial = new THREE.MeshNormalMaterial({
      flatShading: false,
    });

    mesh.userData.originalMaterial = mesh.material;
    mesh.userData.toonMaterial = toonMaterial;
    mesh.userData.matcapMaterial = matcapMaterial;
    mesh.userData.normalDebugMaterial = normalDebugMaterial;
    mesh.material = toonMaterial;

    // 4. Crear malla secundaria para el contorno de tinta (Inverted Hull Outline Shader)
    const outlineMat = createComicOutlineMaterial(outlineThickness, outlineOpacity);
    const outlineMesh = new THREE.Mesh(mesh.geometry, outlineMat);
    outlineMesh.name = `${mesh.name}_outline`;
    outlineMesh.userData.isOutlineMesh = true;
    outlineMesh.castShadow = false;
    outlineMesh.receiveShadow = false;
    mesh.add(outlineMesh);
    mesh.userData.outlineMesh = outlineMesh;
  }

  applyNormalSmoothingToModel(wrapper, initialSmoothing);
  void BufferGeometryUtils;

  return {
    wrapper,
    triangleCount,
    vertexCount,
    meshCount,
  };
}
