import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { SimplifyModifier } from 'three/addons/modifiers/SimplifyModifier.js';
import { TessellateModifier } from 'three/addons/modifiers/TessellateModifier.js';
import { prepareGeometryNormals, applyNormalSmoothingToModel } from './geometrySmoothing';

export type SculptToolMode =
  | 'none'
  | 'smooth'
  | 'inflate'
  | 'deflate'
  | 'crease'
  | 'pinch'
  | 'flatten'
  | 'paint';

export interface SculptBrushSettings {
  mode: SculptToolMode;
  radius: number;      // Radio de la esfera de influencia en unidades de mundo (0.1 a 1.5)
  strength: number;    // Intensidad del pincel (0.05 a 1.0)
  paintColor: string;  // Color hex para pintar vértices (#ef4444)
  symmetryX: boolean;  // Simetría en espejo eje X activada por defecto
}

const _hitPointLocal = new THREE.Vector3();
const _hitNormalLocal = new THREE.Vector3();
const _symPointLocal = new THREE.Vector3();
const _symNormalLocal = new THREE.Vector3();
const _vertexPos = new THREE.Vector3();
const _avgPos = new THREE.Vector3();
const _symAvgPos = new THREE.Vector3();
const _invMatrix = new THREE.Matrix4();
const _tempVec = new THREE.Vector3();

interface MeshGeometrySnapshot {
  geometryClone: THREE.BufferGeometry;
  position: THREE.Vector3;
  rotation: THREE.Euler;
  scale: THREE.Vector3;
}

/**
 * Guarda una copia maestra intacta de todo el dibujo 3D (todas las mallas y geometrías originales)
 * para poder rehacer/restaurar el dibujo completo en cualquier momento aunque se reduzca o deforme.
 */
export function saveMasterDrawingCheckpoint(root: THREE.Object3D): void {
  const snapshots: Array<{
    meshUuid: string;
    geometryClone: THREE.BufferGeometry;
    position: THREE.Vector3;
    rotation: THREE.Euler;
    scale: THREE.Vector3;
  }> = [];

  root.traverse((child) => {
    if ((child as THREE.Mesh).isMesh && !child.userData.isOutlineMesh) {
      const mesh = child as THREE.Mesh;
      if (mesh.geometry) {
        snapshots.push({
          meshUuid: mesh.uuid,
          geometryClone: mesh.geometry.clone(),
          position: mesh.position.clone(),
          rotation: mesh.rotation.clone(),
          scale: mesh.scale.clone(),
        });
      }
    }
  });

  if (snapshots.length > 0) {
    // Liberar geometrías previas si existían
    const oldList = root.userData.masterDrawingCheckpoint as typeof snapshots | undefined;
    if (oldList) {
      oldList.forEach((item) => item.geometryClone.dispose());
    }
    root.userData.masterDrawingCheckpoint = snapshots;
  }
}

export function ensureMasterDrawingCheckpoint(root: THREE.Object3D): void {
  if (!root.userData.masterDrawingCheckpoint) {
    saveMasterDrawingCheckpoint(root);
  }
}

/**
 * Restaura el dibujo 3D a su estado maestro intacto (antes de reducciones poligonales o deformaciones destructivas).
 */
export function restoreMasterDrawingCheckpoint(
  root: THREE.Object3D,
  currentSmoothing: number
): boolean {
  const snapshots = root.userData.masterDrawingCheckpoint as
    | Array<{
        meshUuid: string;
        geometryClone: THREE.BufferGeometry;
        position: THREE.Vector3;
        rotation: THREE.Euler;
        scale: THREE.Vector3;
      }>
    | undefined;

  if (!snapshots || snapshots.length === 0) return false;

  // Guardar estado actual en Undo por si quiere volver adelante con Rehacer (Redo)
  pushUndoSnapshot(root, false);

  const snapshotMap = new Map(snapshots.map((s) => [s.meshUuid, s]));
  let restoredCount = 0;

  root.traverse((child) => {
    if ((child as THREE.Mesh).isMesh && !child.userData.isOutlineMesh) {
      const mesh = child as THREE.Mesh;
      const snap = snapshotMap.get(mesh.uuid);
      if (snap) {
        mesh.geometry.dispose();
        mesh.geometry = snap.geometryClone.clone();
        mesh.position.copy(snap.position);
        mesh.rotation.copy(snap.rotation);
        mesh.scale.copy(snap.scale);
        prepareGeometryNormals(mesh);
        if (mesh.userData.outlineMesh) {
          (mesh.userData.outlineMesh as THREE.Mesh).geometry = mesh.geometry;
        }
        restoredCount++;
      }
    }
  });

  if (restoredCount > 0) {
    applyNormalSmoothingToModel(root, currentSmoothing);
    return true;
  }
  return false;
}

/**
 * Guarda una instantánea completa de la geometría (incluyendo cambios en número de vértices/triángulos
 * por Decimate o Subdivide) en la pila de Deshacer (Undo).
 */
export function pushUndoSnapshot(root: THREE.Object3D, clearRedo: boolean = true): void {
  ensureMasterDrawingCheckpoint(root);

  root.traverse((child) => {
    if ((child as THREE.Mesh).isMesh && !child.userData.isOutlineMesh) {
      const mesh = child as THREE.Mesh;
      if (!mesh.geometry || !mesh.geometry.attributes.position) return;

      if (!mesh.userData.undoStack) {
        mesh.userData.undoStack = [];
      }
      const stack = mesh.userData.undoStack as MeshGeometrySnapshot[];
      if (stack.length >= 10) {
        const oldest = stack.shift();
        oldest?.geometryClone.dispose();
      }
      stack.push({
        geometryClone: mesh.geometry.clone(),
        position: mesh.position.clone(),
        rotation: mesh.rotation.clone(),
        scale: mesh.scale.clone(),
      });

      if (clearRedo && mesh.userData.redoStack) {
        const redoStack = mesh.userData.redoStack as MeshGeometrySnapshot[];
        redoStack.forEach((s) => s.geometryClone.dispose());
        mesh.userData.redoStack = [];
      }
    }
  });
}

/**
 * Deshace la última modificación geométrica (incluso si cambió el conteo de polígonos con Decimate o Subdivide)
 * y guarda el estado actual en la pila de Rehacer (Redo).
 */
export function popUndoSnapshot(root: THREE.Object3D, currentSmoothing: number): boolean {
  let didUndo = false;
  root.traverse((child) => {
    if ((child as THREE.Mesh).isMesh && !child.userData.isOutlineMesh) {
      const mesh = child as THREE.Mesh;
      const stack = mesh.userData.undoStack as MeshGeometrySnapshot[] | undefined;
      if (stack && stack.length > 0) {
        if (!mesh.userData.redoStack) {
          mesh.userData.redoStack = [];
        }
        const redoStack = mesh.userData.redoStack as MeshGeometrySnapshot[];
        redoStack.push({
          geometryClone: mesh.geometry.clone(),
          position: mesh.position.clone(),
          rotation: mesh.rotation.clone(),
          scale: mesh.scale.clone(),
        });

        const prevSnap = stack.pop()!;
        mesh.geometry.dispose();
        mesh.geometry = prevSnap.geometryClone;
        mesh.position.copy(prevSnap.position);
        mesh.rotation.copy(prevSnap.rotation);
        mesh.scale.copy(prevSnap.scale);

        prepareGeometryNormals(mesh);
        if (mesh.userData.outlineMesh) {
          (mesh.userData.outlineMesh as THREE.Mesh).geometry = mesh.geometry;
        }
        didUndo = true;
      }
    }
  });

  if (didUndo) {
    applyNormalSmoothingToModel(root, currentSmoothing);
  }
  return didUndo;
}

/**
 * Rehace (Redo) la última modificación geométrica deshecha.
 */
export function popRedoSnapshot(root: THREE.Object3D, currentSmoothing: number): boolean {
  let didRedo = false;
  root.traverse((child) => {
    if ((child as THREE.Mesh).isMesh && !child.userData.isOutlineMesh) {
      const mesh = child as THREE.Mesh;
      const redoStack = mesh.userData.redoStack as MeshGeometrySnapshot[] | undefined;
      if (redoStack && redoStack.length > 0) {
        if (!mesh.userData.undoStack) {
          mesh.userData.undoStack = [];
        }
        const undoStack = mesh.userData.undoStack as MeshGeometrySnapshot[];
        undoStack.push({
          geometryClone: mesh.geometry.clone(),
          position: mesh.position.clone(),
          rotation: mesh.rotation.clone(),
          scale: mesh.scale.clone(),
        });

        const nextSnap = redoStack.pop()!;
        mesh.geometry.dispose();
        mesh.geometry = nextSnap.geometryClone;
        mesh.position.copy(nextSnap.position);
        mesh.rotation.copy(nextSnap.rotation);
        mesh.scale.copy(nextSnap.scale);

        prepareGeometryNormals(mesh);
        if (mesh.userData.outlineMesh) {
          (mesh.userData.outlineMesh as THREE.Mesh).geometry = mesh.geometry;
        }
        didRedo = true;
      }
    }
  });

  if (didRedo) {
    applyNormalSmoothingToModel(root, currentSmoothing);
  }
  return didRedo;
}

export function hasUndoHistory(root: THREE.Object3D | null): boolean {
  if (!root) return false;
  let found = false;
  root.traverse((child) => {
    if ((child as THREE.Mesh).isMesh && !child.userData.isOutlineMesh) {
      const stack = child.userData.undoStack as MeshGeometrySnapshot[] | undefined;
      if (stack && stack.length > 0) found = true;
    }
  });
  return found;
}

export function hasRedoHistory(root: THREE.Object3D | null): boolean {
  if (!root) return false;
  let found = false;
  root.traverse((child) => {
    if ((child as THREE.Mesh).isMesh && !child.userData.isOutlineMesh) {
      const stack = child.userData.redoStack as MeshGeometrySnapshot[] | undefined;
      if (stack && stack.length > 0) found = true;
    }
  });
  return found;
}

/**
 * Aplica un desplazamiento o deformación puntual sobre un vértice dado un centro de pincel local.
 */
function deformSingleStrokePass(
  posAttr: THREE.BufferAttribute,
  normAttr: THREE.BufferAttribute | undefined,
  colorAttr: THREE.BufferAttribute | undefined,
  centerLocal: THREE.Vector3,
  normalLocal: THREE.Vector3,
  avgPosLocal: THREE.Vector3,
  localRadius: number,
  effectiveMode: SculptToolMode,
  strength: number,
  brushColor: THREE.Color
): number {
  const radiusSq = localRadius * localRadius;
  const count = posAttr.count;
  let modified = 0;

  for (let i = 0; i < count; i++) {
    _vertexPos.fromBufferAttribute(posAttr, i);
    const distSq = _vertexPos.distanceToSquared(centerLocal);

    if (distSq < radiusSq) {
      const dist = Math.sqrt(distSq);
      const t = 1 - dist / localRadius;
      const falloff = t * t * (3 - 2 * t);
      const intensity = falloff * strength;

      if (effectiveMode === 'smooth') {
        _vertexPos.lerp(avgPosLocal, intensity * 0.48);
        posAttr.setXYZ(i, _vertexPos.x, _vertexPos.y, _vertexPos.z);
        modified++;
      } else if (effectiveMode === 'inflate') {
        let nx = normalLocal.x;
        let ny = normalLocal.y;
        let nz = normalLocal.z;
        if (normAttr) {
          nx = normAttr.getX(i);
          ny = normAttr.getY(i);
          nz = normAttr.getZ(i);
        }
        _vertexPos.x += nx * intensity * 0.085;
        _vertexPos.y += ny * intensity * 0.085;
        _vertexPos.z += nz * intensity * 0.085;
        posAttr.setXYZ(i, _vertexPos.x, _vertexPos.y, _vertexPos.z);
        modified++;
      } else if (effectiveMode === 'deflate') {
        let nx = normalLocal.x;
        let ny = normalLocal.y;
        let nz = normalLocal.z;
        if (normAttr) {
          nx = normAttr.getX(i);
          ny = normAttr.getY(i);
          nz = normAttr.getZ(i);
        }
        _vertexPos.x -= nx * intensity * 0.085;
        _vertexPos.y -= ny * intensity * 0.085;
        _vertexPos.z -= nz * intensity * 0.085;
        posAttr.setXYZ(i, _vertexPos.x, _vertexPos.y, _vertexPos.z);
        modified++;
      } else if (effectiveMode === 'crease') {
        // Pincel Crease / Hendidura: hunde con perfil agudo en el centro y pellizca ligeramente los bordes
        const sharpFalloff = Math.pow(t, 3);
        _vertexPos.addScaledVector(normalLocal, -sharpFalloff * strength * 0.11);
        _vertexPos.lerp(centerLocal, sharpFalloff * strength * 0.18);
        posAttr.setXYZ(i, _vertexPos.x, _vertexPos.y, _vertexPos.z);
        modified++;
      } else if (effectiveMode === 'pinch') {
        // Pincel Pinch / Pellizcar: atrae los vértices hacia el centro del impacto para afilar bordes
        _vertexPos.lerp(centerLocal, intensity * 0.35);
        posAttr.setXYZ(i, _vertexPos.x, _vertexPos.y, _vertexPos.z);
        modified++;
      } else if (effectiveMode === 'flatten') {
        const toVertex = _tempVec.subVectors(_vertexPos, centerLocal);
        const dotDist = toVertex.dot(normalLocal);
        _vertexPos.addScaledVector(normalLocal, -dotDist * intensity * 0.72);
        posAttr.setXYZ(i, _vertexPos.x, _vertexPos.y, _vertexPos.z);
        modified++;
      } else if (effectiveMode === 'paint' && colorAttr) {
        const r = colorAttr.getX(i);
        const g = colorAttr.getY(i);
        const b = colorAttr.getZ(i);
        colorAttr.setXYZ(
          i,
          THREE.MathUtils.lerp(r, brushColor.r, intensity),
          THREE.MathUtils.lerp(g, brushColor.g, intensity),
          THREE.MathUtils.lerp(b, brushColor.b, intensity)
        );
        modified++;
      }
    }
  }

  return modified;
}

/**
 * Aplica una pincelada de escultura / deformación con el ratón sobre una malla,
 * incluyendo soporte opcional para Simetría en Espejo X (Mirror X).
 */
export function applySculptBrushToMesh(
  mesh: THREE.Mesh,
  worldHitPoint: THREE.Vector3,
  worldHitNormal: THREE.Vector3,
  brush: SculptBrushSettings,
  isAltOrShift: boolean = false
): boolean {
  if (brush.mode === 'none') return false;

  const geometry = mesh.geometry as THREE.BufferGeometry;
  const posAttr = geometry.attributes.position as THREE.BufferAttribute;
  if (!posAttr) return false;

  // Convertir el punto de impacto y normal al espacio local de la malla
  _invMatrix.copy(mesh.matrixWorld).invert();
  _hitPointLocal.copy(worldHitPoint).applyMatrix4(_invMatrix);
  _hitNormalLocal.copy(worldHitNormal).transformDirection(_invMatrix).normalize();

  // Escalar el radio al espacio local
  const scale = mesh.getWorldScale(_tempVec);
  const maxScale = Math.max(scale.x, scale.y, scale.z, 0.001);
  const localRadius = brush.radius / maxScale;
  const radiusSq = localRadius * localRadius;

  const count = posAttr.count;

  let effectiveMode = brush.mode;
  if (brush.mode === 'inflate' && isAltOrShift) effectiveMode = 'deflate';
  else if (brush.mode === 'deflate' && isAltOrShift) effectiveMode = 'inflate';

  // Calcular promedio para modo Smooth
  if (effectiveMode === 'smooth') {
    _avgPos.set(0, 0, 0);
    let closeCount = 0;
    for (let i = 0; i < count; i++) {
      _vertexPos.fromBufferAttribute(posAttr, i);
      if (_vertexPos.distanceToSquared(_hitPointLocal) < radiusSq) {
        _avgPos.add(_vertexPos);
        closeCount++;
      }
    }
    if (closeCount > 1) _avgPos.divideScalar(closeCount);
    else _avgPos.copy(_hitPointLocal);
  }

  // Atributo de color por vértice si estamos en modo Paint
  let colorAttr = geometry.attributes.color as THREE.BufferAttribute | undefined;
  if (effectiveMode === 'paint' && !colorAttr) {
    const colors = new Float32Array(count * 3);
    colors.fill(1.0);
    colorAttr = new THREE.BufferAttribute(colors, 3);
    geometry.setAttribute('color', colorAttr);
    const enableVC = (m: THREE.Material | undefined) => {
      if (m && 'vertexColors' in m) {
        (m as THREE.MeshStandardMaterial).vertexColors = true;
        m.needsUpdate = true;
      }
    };
    enableVC(mesh.userData.toonMaterial);
    enableVC(mesh.userData.matcapMaterial);
    if (!Array.isArray(mesh.userData.originalMaterial)) {
      enableVC(mesh.userData.originalMaterial);
    }
  }

  const brushColor = new THREE.Color(brush.paintColor);
  const normAttr = geometry.attributes.normal as THREE.BufferAttribute | undefined;

  let totalModified = deformSingleStrokePass(
    posAttr,
    normAttr,
    colorAttr,
    _hitPointLocal,
    _hitNormalLocal,
    _avgPos,
    localRadius,
    effectiveMode,
    brush.strength,
    brushColor
  );

  // Si Simetría X está activa y el impacto no está justo en el centro X=0, aplicar en el lado opuesto
  if (brush.symmetryX && Math.abs(worldHitPoint.x) > 0.03) {
    const worldSymPoint = new THREE.Vector3(-worldHitPoint.x, worldHitPoint.y, worldHitPoint.z);
    const worldSymNormal = new THREE.Vector3(-worldHitNormal.x, worldHitNormal.y, worldHitNormal.z);

    _symPointLocal.copy(worldSymPoint).applyMatrix4(_invMatrix);
    _symNormalLocal.copy(worldSymNormal).transformDirection(_invMatrix).normalize();

    if (effectiveMode === 'smooth') {
      _symAvgPos.set(0, 0, 0);
      let symClose = 0;
      for (let i = 0; i < count; i++) {
        _vertexPos.fromBufferAttribute(posAttr, i);
        if (_vertexPos.distanceToSquared(_symPointLocal) < radiusSq) {
          _symAvgPos.add(_vertexPos);
          symClose++;
        }
      }
      if (symClose > 1) _symAvgPos.divideScalar(symClose);
      else _symAvgPos.copy(_symPointLocal);
    }

    totalModified += deformSingleStrokePass(
      posAttr,
      normAttr,
      colorAttr,
      _symPointLocal,
      _symNormalLocal,
      _symAvgPos,
      localRadius,
      effectiveMode,
      brush.strength,
      brushColor
    );
  }

  if (totalModified > 0) {
    posAttr.needsUpdate = true;
    geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();

    if (mesh.userData.outlineMesh) {
      const outlineMesh = mesh.userData.outlineMesh as THREE.Mesh;
      outlineMesh.geometry = mesh.geometry;
    }

    if (colorAttr) {
      colorAttr.needsUpdate = true;
    }
    return true;
  }

  return false;
}

/**
 * Suavizado Laplaciano Global (Redondeo Global):
 * Promedia cada vértice con sus vecinos adyacentes en toda la malla (soldando espacialmente costuras).
 */
export function applyGlobalLaplacianSmoothing(
  root: THREE.Object3D,
  iterations: number = 3,
  factor: number = 0.5,
  recordUndo: boolean = true
): number {
  if (recordUndo) {
    pushUndoSnapshot(root);
  }
  let totalAffectedVertices = 0;

  root.traverse((child) => {
    if ((child as THREE.Mesh).isMesh && !child.userData.isOutlineMesh) {
      const mesh = child as THREE.Mesh;
      const geometry = mesh.geometry as THREE.BufferGeometry;
      const posAttr = geometry.attributes.position as THREE.BufferAttribute;
      if (!posAttr) return;

      const vertexCount = posAttr.count;
      totalAffectedVertices += vertexCount;

      const tempPositions = new Float32Array(posAttr.array);
      const precision = 600;

      for (let iter = 0; iter < iterations; iter++) {
        // Agrupar vértices que comparten la misma posición física para que las costuras no se separen
        const weldGroup = new Map<string, number[]>();
        for (let i = 0; i < vertexCount; i++) {
          const kx = Math.round(tempPositions[i * 3] * precision);
          const ky = Math.round(tempPositions[i * 3 + 1] * precision);
          const kz = Math.round(tempPositions[i * 3 + 2] * precision);
          const key = `${kx}_${ky}_${kz}`;
          let arr = weldGroup.get(key);
          if (!arr) {
            arr = [];
            weldGroup.set(key, arr);
          }
          arr.push(i);
        }

        const neighborSums = new Float32Array(vertexCount * 3);
        const neighborCounts = new Uint16Array(vertexCount);

        const addEdge = (v1: number, v2: number) => {
          neighborSums[v1 * 3] += tempPositions[v2 * 3];
          neighborSums[v1 * 3 + 1] += tempPositions[v2 * 3 + 1];
          neighborSums[v1 * 3 + 2] += tempPositions[v2 * 3 + 2];
          neighborCounts[v1]++;
        };

        for (let i = 0; i < vertexCount; i += 3) {
          const a = i;
          const b = i + 1;
          const c = i + 2;
          if (c < vertexCount) {
            addEdge(a, b);
            addEdge(b, a);
            addEdge(b, c);
            addEdge(c, b);
            addEdge(c, a);
            addEdge(a, c);
          }
        }

        // Promediar acumuladores entre vértices soldados espacialmente
        weldGroup.forEach((indices) => {
          let sumX = 0;
          let sumY = 0;
          let sumZ = 0;
          let totalCount = 0;
          for (const idx of indices) {
            sumX += neighborSums[idx * 3];
            sumY += neighborSums[idx * 3 + 1];
            sumZ += neighborSums[idx * 3 + 2];
            totalCount += neighborCounts[idx];
          }
          if (totalCount > 0) {
            const avgX = sumX / totalCount;
            const avgY = sumY / totalCount;
            const avgZ = sumZ / totalCount;
            for (const idx of indices) {
              const cx = tempPositions[idx * 3];
              const cy = tempPositions[idx * 3 + 1];
              const cz = tempPositions[idx * 3 + 2];
              tempPositions[idx * 3] = cx + (avgX - cx) * factor;
              tempPositions[idx * 3 + 1] = cy + (avgY - cy) * factor;
              tempPositions[idx * 3 + 2] = cz + (avgZ - cz) * factor;
            }
          }
        });
      }

      posAttr.array.set(tempPositions);
      posAttr.needsUpdate = true;

      prepareGeometryNormals(mesh);
      geometry.computeBoundingBox();
      geometry.computeBoundingSphere();
      if (mesh.userData.outlineMesh) {
        (mesh.userData.outlineMesh as THREE.Mesh).geometry = mesh.geometry;
      }
    }
  });

  return totalAffectedVertices;
}

/**
 * Subdivisión y Redondeo Orgánico (Tessellate + Laplacian Smooth):
 * Divide los triángulos grandes para añadir densidad de malla y aplica relajación suave,
 * ideal para convertir geometrías muy low-poly en esculturas de alta definición.
 */
export function subdivideAndSmoothModel(root: THREE.Object3D): number {
  pushUndoSnapshot(root);
  const tessellator = new TessellateModifier(0.42, 2);
  let newTotalTriangles = 0;

  root.traverse((child) => {
    if ((child as THREE.Mesh).isMesh && !child.userData.isOutlineMesh) {
      const mesh = child as THREE.Mesh;
      const geo = mesh.geometry as THREE.BufferGeometry;
      if (geo.attributes.position.count < 45000) {
        const subdivided = tessellator.modify(geo);
        mesh.geometry.dispose();
        mesh.geometry = subdivided;
        prepareGeometryNormals(mesh);
        if (mesh.userData.outlineMesh) {
          (mesh.userData.outlineMesh as THREE.Mesh).geometry = mesh.geometry;
        }
      }
      newTotalTriangles += Math.floor(mesh.geometry.attributes.position.count / 3);
    }
  });

  // Aplicar 2 pasadas suaves sin empujar un segundo snapshot redundante
  applyGlobalLaplacianSmoothing(root, 2, 0.42, false);
  return newTotalTriangles;
}

/**
 * Cuenta cuántos vértices únicos soldados espacialmente tiene una geometría.
 * Esto evita el fallo clásico de SimplifyModifier donde se le pide eliminar más vértices
 * que los vértices únicos reales que posee la malla.
 */
function countUniqueWeldedVertices(posAttr: THREE.BufferAttribute): number {
  const uniqueSet = new Set<string>();
  const precision = 1000;
  for (let i = 0; i < posAttr.count; i++) {
    const kx = Math.round(posAttr.getX(i) * precision);
    const ky = Math.round(posAttr.getY(i) * precision);
    const kz = Math.round(posAttr.getZ(i) * precision);
    uniqueSet.add(`${kx}_${ky}_${kz}`);
  }
  return uniqueSet.size;
}

/**
 * Restaura la caja delimitadora (BoundingBox) original tras la simplificación para evitar
 * que las piezas esféricas o cilíndricas se encojan o se separen de sus articulaciones.
 */
function restoreBoundingVolume(
  geo: THREE.BufferGeometry,
  origBox: THREE.Box3
): void {
  geo.computeBoundingBox();
  const newBox = geo.boundingBox;
  if (!newBox || newBox.isEmpty() || origBox.isEmpty()) return;

  const origSize = new THREE.Vector3();
  const newSize = new THREE.Vector3();
  const origCenter = new THREE.Vector3();
  const newCenter = new THREE.Vector3();
  origBox.getSize(origSize);
  newBox.getSize(newSize);
  origBox.getCenter(origCenter);
  newBox.getCenter(newCenter);

  const sx = newSize.x > 1e-4 ? origSize.x / newSize.x : 1.0;
  const sy = newSize.y > 1e-4 ? origSize.y / newSize.y : 1.0;
  const sz = newSize.z > 1e-4 ? origSize.z / newSize.z : 1.0;

  // Limitar factor de corrección a un rango seguro para no distorsionar formas planas
  const clampScale = (s: number) => THREE.MathUtils.clamp(s, 0.85, 1.25);
  const fx = clampScale(sx);
  const fy = clampScale(sy);
  const fz = clampScale(sz);

  const posAttr = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < posAttr.count; i++) {
    const x = (posAttr.getX(i) - newCenter.x) * fx + origCenter.x;
    const y = (posAttr.getY(i) - newCenter.y) * fy + origCenter.y;
    const z = (posAttr.getZ(i) - newCenter.z) * fz + origCenter.z;
    posAttr.setXYZ(i, x, y, z);
  }
  posAttr.needsUpdate = true;
  geo.computeBoundingBox();
  geo.computeBoundingSphere();
}

/**
 * Re-proyecta los colores por vértice (si el usuario pintó el modelo) desde la geometría
 * anterior hacia los vértices simplificados más cercanos.
 */
function transferVertexColors(
  sourcePos: THREE.BufferAttribute,
  sourceColor: THREE.BufferAttribute,
  targetGeo: THREE.BufferGeometry
): void {
  const targetPos = targetGeo.attributes.position as THREE.BufferAttribute;
  if (!targetPos) return;

  // Muestrear puntos fuente con un paso máximo para mantener velocidad instantánea
  const srcCount = sourcePos.count;
  const step = Math.max(1, Math.floor(srcCount / 600));
  const outColors = new Float32Array(targetPos.count * 3);

  for (let i = 0; i < targetPos.count; i++) {
    const tx = targetPos.getX(i);
    const ty = targetPos.getY(i);
    const tz = targetPos.getZ(i);
    let bestDistSq = Infinity;
    let bestIdx = 0;

    for (let j = 0; j < srcCount; j += step) {
      const dx = sourcePos.getX(j) - tx;
      const dy = sourcePos.getY(j) - ty;
      const dz = sourcePos.getZ(j) - tz;
      const dSq = dx * dx + dy * dy + dz * dz;
      if (dSq < bestDistSq) {
        bestDistSq = dSq;
        bestIdx = j;
        if (dSq < 1e-5) break;
      }
    }

    outColors[i * 3] = sourceColor.getX(bestIdx);
    outColors[i * 3 + 1] = sourceColor.getY(bestIdx);
    outColors[i * 3 + 2] = sourceColor.getZ(bestIdx);
  }

  targetGeo.setAttribute('color', new THREE.BufferAttribute(outColors, 3));
}

export interface SmartDecimateOptions {
  preserveFeatures?: boolean; // Protege ojos, cuernos pequeños, articulaciones y restaura volumen
  currentSmoothing?: number;
}

/**
 * Reducción de Polígonos Inteligente con Preservación de Silueta y Detalles (Smart Decimate).
 * - Calcula el conteo real de vértices soldados (`uniqueVertexCount`) en vez de `posAttr.count`
 *   para que SimplifyModifier NUNCA colapse ni destruya las mallas.
 * - Protege sub-mallas pequeñas de detalle (ojos, garras, articulaciones, gemas) cuando `preserveFeatures` está activo.
 * - Restaura el volumen BoundingBox original para evitar encogimiento o huecos entre piezas.
 * - Conserva la pintura por vértices y guarda una instantánea completa en Undo / Copia Maestra.
 */
export async function decimateModelGeometry(
  root: THREE.Object3D,
  reductionRatio: number,
  options: SmartDecimateOptions = {}
): Promise<{ originalTriangles: number; newTriangles: number; protectedMeshes: number }> {
  const { preserveFeatures = true, currentSmoothing = 0.92 } = options;

  // Guardar en la pila de Deshacer (Undo) y asegurar Copia Maestra intacta
  pushUndoSnapshot(root);

  const modifier = new SimplifyModifier();
  let originalTriangles = 0;
  let newTriangles = 0;
  let protectedMeshes = 0;

  const meshes: THREE.Mesh[] = [];
  root.traverse((child) => {
    if ((child as THREE.Mesh).isMesh && !child.userData.isOutlineMesh) {
      meshes.push(child as THREE.Mesh);
    }
  });

  // Límite seguro del ratio de reducción sobre vértices soldados
  const safeRatio = preserveFeatures
    ? Math.min(reductionRatio, 0.62)
    : Math.min(reductionRatio, 0.78);

  for (const mesh of meshes) {
    const geo = mesh.geometry as THREE.BufferGeometry;
    const posAttr = geo.attributes.position as THREE.BufferAttribute;
    if (!posAttr) continue;

    const currentTriCount = geo.index ? geo.index.count / 3 : posAttr.count / 3;
    originalTriangles += Math.floor(currentTriCount);

    const uniqueVertices = countUniqueWeldedVertices(posAttr);

    // 1. Proteger piezas pequeñas de detalle (ojos, cuernos finos, garras, gemas, articulaciones)
    // Si una pieza tiene <= 42 vértices únicos (o <= 64 triángulos) y preserveFeatures está activo,
    // no la diezmamos para que no pierda su forma geométrica reconocible.
    if (preserveFeatures && (uniqueVertices <= 42 || currentTriCount <= 64)) {
      protectedMeshes++;
      newTriangles += Math.floor(currentTriCount);
      continue;
    }

    // 2. Calcular cuántos vértices ÚNICOS soldados se pueden quitar sin destruir la pieza
    const minSafeVertices = preserveFeatures
      ? Math.max(24, Math.ceil(uniqueVertices * 0.42))
      : Math.max(14, Math.ceil(uniqueVertices * 0.25));

    const maxAllowedToRemove = Math.max(0, uniqueVertices - minSafeVertices);
    const desiredToRemove = Math.floor(uniqueVertices * safeRatio);
    const countToRemove = Math.min(desiredToRemove, maxAllowedToRemove);

    if (countToRemove >= 4) {
      try {
        geo.computeBoundingBox();
        const origBox = geo.boundingBox ? geo.boundingBox.clone() : new THREE.Box3();
        const prevColorAttr = geo.attributes.color as THREE.BufferAttribute | undefined;

        // Preparar clon limpio solo con 'position' para que SimplifyModifier suelde vértices sin errores de normales/atributos custom
        const cleanInputGeo = new THREE.BufferGeometry();
        cleanInputGeo.setAttribute('position', posAttr.clone());
        if (geo.index) {
          cleanInputGeo.setIndex(geo.index.clone());
        }

        const simplifiedIndexed = (modifier.modify(cleanInputGeo, countToRemove) as unknown) as THREE.BufferGeometry;
        cleanInputGeo.dispose();

        // Convertir de vuelta a no-indexado para nuestro pipeline de Cel-Shading y suavizado de normales
        const finalGeo = simplifiedIndexed.index
          ? simplifiedIndexed.toNonIndexed()
          : simplifiedIndexed;

        const simplifiedTriCount = Math.floor(finalGeo.attributes.position.count / 3);

        // Verificar que la malla simplificada sea válida y conserve volumen; si degeneró, conservar original
        if (simplifiedTriCount < 8) {
          finalGeo.dispose();
          protectedMeshes++;
          newTriangles += Math.floor(currentTriCount);
          continue;
        }

        // 3. Restaurar el volumen BoundingBox original para evitar que las piezas se encojan o separen
        if (preserveFeatures && !origBox.isEmpty()) {
          restoreBoundingVolume(finalGeo, origBox);
        }

        // 4. Re-proyectar colores pintados por vértice si existían
        if (prevColorAttr) {
          transferVertexColors(posAttr, prevColorAttr, finalGeo);
        }

        mesh.geometry.dispose();
        mesh.geometry = finalGeo;

        prepareGeometryNormals(mesh);
        mesh.geometry.computeVertexNormals();

        if (mesh.userData.outlineMesh) {
          (mesh.userData.outlineMesh as THREE.Mesh).geometry = mesh.geometry;
        }

        newTriangles += simplifiedTriCount;
      } catch (err) {
        console.warn('Pieza conservada intacta tras aviso del simplificador:', err);
        protectedMeshes++;
        newTriangles += Math.floor(currentTriCount);
      }
    } else {
      protectedMeshes++;
      newTriangles += Math.floor(currentTriCount);
    }
  }

  applyNormalSmoothingToModel(root, currentSmoothing);
  return { originalTriangles, newTriangles, protectedMeshes };
}

/**
 * Exporta el modelo 3D actual modificado como un archivo `.glb` binario.
 */
/**
 * Clave de agrupación: mallas con el mismo tipo de material, color, rugosidad, emisión y atributos
 * pueden unirse. Devuelve null si la malla no debe unirse (skinning, morph targets o materiales múltiples).
 */
function mergeKeyFor(mesh: THREE.Mesh): string | null {
  if ((mesh as THREE.SkinnedMesh).isSkinnedMesh) return null;
  if (mesh.morphTargetInfluences && mesh.morphTargetInfluences.length > 0) return null;
  if (Array.isArray(mesh.material)) return null;
  const mat = mesh.material as THREE.MeshStandardMaterial;
  if (!mat || !mat.color) return null;
  const attrs = Object.keys(mesh.geometry.attributes).sort().join(',');
  const emissive = mat.emissive ? mat.emissive.getHex() : 0;
  const emissiveIntensity = mat.emissiveIntensity ?? 0;
  return [mat.type, mat.color.getHex(), mat.roughness, mat.metalness, emissive, emissiveIntensity, attrs].join('|');
}

/**
 * Une las mallas de `root` que comparten material en una malla por grupo.
 * Las geometrías se transforman a la escala local de `root`; el resultado queda sin jerarquía.
 * Si una unión falla, las mallas de ese grupo se dejan como estaban.
 */
function mergeMeshesByMaterial(root: THREE.Object3D): void {
  root.updateMatrixWorld(true);
  const rootInverse = new THREE.Matrix4().copy(root.matrixWorld).invert();

  const meshes: THREE.Mesh[] = [];
  root.traverse((child) => {
    if (child !== root && (child as THREE.Mesh).isMesh) meshes.push(child as THREE.Mesh);
  });

  const groups = new Map<string, THREE.Mesh[]>();
  for (const mesh of meshes) {
    const key = mergeKeyFor(mesh);
    if (key === null) continue;
    const list = groups.get(key) ?? [];
    list.push(mesh);
    groups.set(key, list);
  }

  let index = 0;
  groups.forEach((list) => {
    if (list.length < 2) return;

    const geometries = list.map((mesh) => {
      const geo = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
      const relative = new THREE.Matrix4().multiplyMatrices(rootInverse, mesh.matrixWorld);
      geo.applyMatrix4(relative);
      return geo;
    });

    const merged = mergeGeometries(geometries, false);
    if (!merged) return;

    list.forEach((mesh) => mesh.removeFromParent());
    const material = list[0].material as THREE.Material;
    const combined = new THREE.Mesh(merged, material);
    combined.name = `Grupo_${index}_${list.length}piezas`;
    root.add(combined);
    index++;
  });
}

export function exportModifiedGlb(
  root: THREE.Object3D,
  fileName: string = 'enemigo_modificado.glb'
): Promise<void> {
  return new Promise((resolve, reject) => {
    const exportScene = new THREE.Scene();
    const clonedRoot = root.clone(true);

    const outlinesToRemove: THREE.Object3D[] = [];
    clonedRoot.traverse((child) => {
      if (child.userData.isOutlineMesh || child.name.includes('_outline')) {
        outlinesToRemove.push(child);
      }
    });
    outlinesToRemove.forEach((obj) => obj.removeFromParent());

    // El userData de la app (historial de deshacer, normales, materiales de respaldo y matcaps)
    // no pertenece al modelo: el exportador lo serializaría como extras del JSON y el GLB
    // llegaba a pesar decenas de MB. Se vacía en las copias que se exportan.
    clonedRoot.traverse((child) => {
      child.userData = {};
    });

    // Une las mallas que comparten material en una sola malla por grupo. Así el GLB tiene
    // muchas menos llamadas de dibujado (las piezas de escenas construidas con scripts son
    // cientos de cajas con el mismo aspecto). La geometría no cambia.
    mergeMeshesByMaterial(clonedRoot);

    exportScene.add(clonedRoot);

    const exporter = new GLTFExporter();
    exporter.parse(
      exportScene,
      (result) => {
        const blob = new Blob([result as ArrayBuffer], { type: 'model/gltf-binary' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName.endsWith('.glb') ? fileName : `${fileName}.glb`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        resolve();
      },
      (error) => {
        console.error('Error al exportar GLTF:', error);
        reject(error);
      },
      { binary: true }
    );
  });
}

/**
 * Crea un cursor 3D indicador doble (Anillo principal + punto central)
 * para mostrar con precisión el área del pincel sobre el modelo.
 */
export function createBrushIndicatorMesh(): THREE.Mesh {
  const geo = new THREE.RingGeometry(0.88, 1.0, 40);
  const mat = new THREE.MeshBasicMaterial({
    color: 0xf59e0b,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.9,
    depthTest: false,
  });
  const ring = new THREE.Mesh(geo, mat);
  ring.renderOrder = 999;
  ring.visible = false;
  return ring;
}
