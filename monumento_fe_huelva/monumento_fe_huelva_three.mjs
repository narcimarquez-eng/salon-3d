// MONUMENTO A LA FE DESCUBRIDORA (Huelva) - versión three.js
// ==============================================================================
// Mismo diseño que monumento_fe_huelva.py (versión 6), escrito directamente con three.js
// y exportado a GLB con GLTFExporter. No pasa por el intérprete de Python de la app.
//
// Uso (desde la raíz del repo):
//   node monumento_fe_huelva/monumento_fe_huelva_three.mjs [salida.glb]
//
// Fuentes y aproximaciones: ver la cabecera de monumento_fe_huelva.py.
// Convención: el diseño usa Z hacia arriba y la cara frontal a -Y. Three y glTF usan Y arriba,
// así que cada punto (x, y, z) del diseño se convierte en (x, z, -y).
// ==============================================================================

import * as THREE from 'three';
import { writeFileSync } from 'node:fs';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// GLTFExporter pide FileReader para leer los Blob de salida; Node no lo trae, así que se añade
// una versión mínima (solo lectura de Blob) antes de cargar el exportador.
if (typeof globalThis.FileReader === 'undefined') {
  globalThis.FileReader = class {
    readAsArrayBuffer(blob) {
      blob.arrayBuffer().then((buf) => {
        this.result = buf;
        if (this.onloadend) this.onloadend();
        if (this.onload) this.onload();
      });
    }
    readAsDataURL(blob) {
      blob.arrayBuffer().then((buf) => {
        this.result = 'data:' + (blob.type || 'application/octet-stream') + ';base64,' + Buffer.from(buf).toString('base64');
        if (this.onloadend) this.onloadend();
        if (this.onload) this.onload();
      });
    }
  };
}

const { GLTFExporter } = await import('three/examples/jsm/exporters/GLTFExporter.js');

const SALIDA = process.argv[2] || 'monumento_fe_huelva/monumento_fe_huelva_three.glb';
const UP = new THREE.Vector3(0, 1, 0);

// ------------------------------------------------------------------
// Conversión de coordenadas del diseño a three.js
// ------------------------------------------------------------------
function V(x, y, z) {
  return new THREE.Vector3(x, z, -y);
}

// ------------------------------------------------------------------
// Materiales (colores lineales, como en Blender)
// ------------------------------------------------------------------
function material(nombre, r, g, b, rugosidad) {
  const m = new THREE.MeshStandardMaterial({ name: nombre, roughness: rugosidad, metalness: 0 });
  m.color.setRGB(r, g, b);
  return m;
}

const mHormigon = material('MFD_Hormigon', 0.33, 0.33, 0.31, 0.9);
const mSillar = material('MFD_Sillar', 0.58, 0.52, 0.40, 0.8);
const mCaliza = material('MFD_Caliza', 0.64, 0.60, 0.50, 0.7);
const mSombra = material('MFD_Sombra', 0.03, 0.03, 0.03, 0.9);

// ------------------------------------------------------------------
// Escena
// ------------------------------------------------------------------
const raiz = new THREE.Group();
raiz.name = 'Monumento_Fe_Descubridora';

function añadir(nombre, geo, mat, pos) {
  const malla = new THREE.Mesh(geo, mat);
  malla.name = nombre;
  malla.position.copy(pos);
  raiz.add(malla);
  return malla;
}

// Caja con medidas del diseño (ancho X, fondo Y, alto Z)
function caja(nombre, centro, t, mat) {
  return añadir(nombre, new THREE.BoxGeometry(t[0], t[2], t[1]), mat, V(centro[0], centro[1], centro[2]));
}

// Esfera elipsoidal (escala en medidas del diseño)
function esfera(nombre, centro, radio, mat, escala, segmentos, anillos) {
  const malla = añadir(nombre, new THREE.SphereGeometry(radio, segmentos, anillos), mat, V(centro[0], centro[1], centro[2]));
  malla.scale.set(escala[0], escala[2], escala[1]);
  return malla;
}

// Cilindro recto entre dos puntos (brazos, cordones, pliegues)
function tubo(nombre, a, b, radio, mat, vertices) {
  const pa = V(a[0], a[1], a[2]);
  const pb = V(b[0], b[1], b[2]);
  const dir = new THREE.Vector3().subVectors(pb, pa);
  const largo = dir.length();
  const malla = añadir(nombre, new THREE.CylinderGeometry(radio, radio, largo, vertices), mat, pa.clone().add(pb).multiplyScalar(0.5));
  malla.quaternion.setFromUnitVectors(UP, dir.normalize());
  return malla;
}

// Cuerpo de revolución elíptico hecho de n anillos (como "capas" en el script de Python)
function capas(prefijo, z0, z1, rx0, ry0, rx1, ry1, cx, cy, n, vertices, mat) {
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    const z = z0 + (z1 - z0) * t;
    const rx = rx0 + (rx1 - rx0) * t;
    const ry = ry0 + (ry1 - ry0) * t;
    const h = (z1 - z0) / n + 0.02;
    const malla = añadir(prefijo + '_' + i, new THREE.CylinderGeometry(1, 1, h, vertices), mat, V(cx, cy, z));
    malla.scale.set(rx, 1, ry);
  }
}

// Sillares en las cuatro caras de un prisma (nf hiladas, nx por cara frontal/trasera, ny por lateral)
function muroSillares(prefijo, x0, x1, y0, y1, z0, z1, nf, nx, ny, mat) {
  const bh = (z1 - z0) / nf;
  const bw = (x1 - x0) / nx;
  const bd = (y1 - y0) / ny;
  for (let f = 0; f < nf; f++) {
    const zc = z0 + (f + 0.5) * bh;
    for (let k = 0; k < nx; k++) {
      const xc = x0 + (k + 0.5) * bw;
      caja(prefijo + '_Fr_' + f + '_' + k, [xc, y0 - 0.05, zc], [bw - 0.07, 0.12, bh - 0.07], mat);
      caja(prefijo + '_Tr_' + f + '_' + k, [xc, y1 + 0.05, zc], [bw - 0.07, 0.12, bh - 0.07], mat);
    }
    for (let k = 0; k < ny; k++) {
      const yc = y0 + (k + 0.5) * bd;
      caja(prefijo + '_Iz_' + f + '_' + k, [x0 - 0.05, yc, zc], [0.12, bd - 0.07, bh - 0.07], mat);
      caja(prefijo + '_De_' + f + '_' + k, [x1 + 0.05, yc, zc], [0.12, bd - 0.07, bh - 0.07], mat);
    }
  }
}

// ------------------------------------------------------------------
// 1. Base y pedestal
// ------------------------------------------------------------------
caja('MFD_Plataforma', [0, 0, 0.3], [28, 20, 0.6], mHormigon);
caja('MFD_Escalon', [0, 0, 0.9], [22, 14, 0.6], mHormigon);

caja('MFD_Nucleo_Bajo', [0, 0, 3.6], [15.9, 11.9, 4.8], mSillar);
muroSillares('MFD_Sillar_Bajo', -8, 8, -6, 6, 1.2, 6.0, 12, 16, 12, mSillar);
caja('MFD_Cornisa', [0, 0, 6.0], [14, 11, 0.4], mCaliza);

caja('MFD_Nucleo_Alto', [0, 0, 8.0], [11.9, 8.9, 4.0], mSillar);
muroSillares('MFD_Sillar_Alto', -6, 6, -4.5, 4.5, 6.0, 10.0, 10, 12, 6, mSillar);

// Dos relieves en la parte baja de la cara frontal, con una figura en relieve
for (const lado of [-1, 1]) {
  const x = 4.0 * lado;
  const nombre = lado < 0 ? 'Izq' : 'Der';
  caja('MFD_Relieve_' + nombre, [x, -6.25, 3.6], [3.4, 0.3, 3.6], mCaliza);
  esfera('MFD_Relieve_Cab_' + nombre, [x, -6.55, 4.4], 0.32, mCaliza, [1.0, 0.7, 1.1], 24, 16);
  capas('MFD_Relieve_Tor_' + nombre, 2.0, 3.8, 0.55, 0.3, 0.4, 0.25, x, -6.5, 6, 24, mCaliza);
}

// ------------------------------------------------------------------
// 2. Cruz de tau: fuste estrecho por delante del fraile y travesaño ancho arriba
// ------------------------------------------------------------------
caja('MFD_Cruz_Nucleo', [0, -0.4, 20.1], [2.8, 1.8, 20.2], mSillar);
muroSillares('MFD_Cruz_Fuste', -1.5, 1.5, -1.4, 0.6, 10.0, 30.2, 40, 4, 4, mSillar);
caja('MFD_Cruz_Travesano_Nucleo', [0, -0.4, 29.0], [11.9, 1.8, 2.4], mSillar);
muroSillares('MFD_Cruz_Travesano', -6, 6, -1.4, 0.6, 27.8, 30.2, 4, 6, 2, mSillar);

// ------------------------------------------------------------------
// 3. Fraile (de pie detrás del fuste, con el brazo izquierdo abierto hasta el travesaño)
// ------------------------------------------------------------------
capas('MFD_Fraile_Falda', 10.0, 18.0, 3.6, 1.5, 3.0, 1.3, 0.0, 0.4, 24, 64, mCaliza);
capas('MFD_Fraile_Torso', 18.0, 27.0, 3.2, 1.3, 3.8, 1.4, 0.0, 0.4, 24, 64, mCaliza);
esfera('MFD_Fraile_Hombros', [0, 0.4, 27.6], 1.0, mCaliza, [4.2, 1.4, 1.2], 64, 48);
capas('MFD_Fraile_Cuello', 28.5, 30.4, 0.9, 0.9, 0.9, 0.9, 0.0, 0.5, 6, 48, mCaliza);

// Cabeza dentro de una capucha que queda detrás, con el rostro por delante
esfera('MFD_Fraile_Cabeza', [0, 0.5, 33.0], 1.0, mCaliza, [1.2, 1.1, 1.35], 64, 48);
capas('MFD_Fraile_Capucha', 30.6, 35.8, 2.0, 1.7, 1.3, 1.2, 0.0, 0.8, 24, 64, mCaliza);
esfera('MFD_Fraile_Coronilla', [0, 0.8, 35.6], 1.3, mCaliza, [1.0, 0.92, 0.8], 64, 48);

// Rostro: nariz, cejas, ojos y boca
esfera('MFD_Fraile_Rostro', [0, -1.0, 33.2], 0.55, mCaliza, [0.85, 0.9, 1.05], 40, 28);
caja('MFD_Fraile_Nariz', [0, -1.55, 33.0], [0.28, 0.35, 0.8], mCaliza);
caja('MFD_Fraile_Ceja_Izq', [-0.5, -1.42, 33.7], [0.45, 0.25, 0.15], mCaliza);
caja('MFD_Fraile_Ceja_Der', [0.5, -1.42, 33.7], [0.45, 0.25, 0.15], mCaliza);
esfera('MFD_Fraile_Ojo_Izq', [-0.38, -1.5, 33.4], 0.14, mSombra, [1.0, 0.5, 1.0], 16, 12);
esfera('MFD_Fraile_Ojo_Der', [0.38, -1.5, 33.4], 0.14, mSombra, [1.0, 0.5, 1.0], 16, 12);
caja('MFD_Fraile_Boca', [0, -1.52, 32.5], [0.6, 0.1, 0.1], mSombra);

// Pliegues de la capucha: cordones desde la coronilla hasta los hombros, por la mitad frontal
function puntoCapucha(a, z, k) {
  const t = (z - 30.6) / 5.2;
  const rx = (2.0 - 0.7 * t) * k;
  const ry = (1.7 - 0.5 * t) * k;
  return [rx * Math.cos(a), 0.8 + ry * Math.sin(a), z];
}
for (let i = 0; i < 12; i++) {
  const a = 1.2 * Math.PI + i * (0.6 * Math.PI / 11);
  if (Math.abs(a - 1.5 * Math.PI) > 0.45) {
    tubo('MFD_Fraile_Pliegue_' + i, puntoCapucha(a, 31.0, 1.08), puntoCapucha(a, 35.2, 1.04), 0.14, mCaliza, 12);
  }
}

// Cordón franciscano por el frente de la falda
tubo('MFD_Fraile_Cordon', [0, -1.25, 11.0], [0, -1.25, 20.0], 0.13, mCaliza, 12);

// Brazos y manos
tubo('MFD_Fraile_Brazo_Izq', [-3.0, 0.4, 25.8], [-5.6, 0.4, 29.6], 0.55, mCaliza, 32);
esfera('MFD_Fraile_Mano_Izq', [-5.8, 0.4, 29.7], 0.6, mCaliza, [1.0, 0.9, 1.0], 32, 24);
tubo('MFD_Fraile_Brazo_Der', [3.0, 0.4, 26.5], [3.5, 0.4, 19.5], 0.5, mCaliza, 32);
esfera('MFD_Fraile_Mano_Der', [3.6, 0.4, 19.0], 0.5, mCaliza, [1.0, 0.9, 1.0], 32, 24);

// ------------------------------------------------------------------
// Estadísticas y exportación a GLB
// ------------------------------------------------------------------
// Juntar las piezas que comparten material en una sola malla (como la exportación Completo
// de la app): menos nodos y menos llamadas de dibujo en el navegador.
const mallas = [];
raiz.traverse((obj) => {
  if (obj.isMesh) mallas.push(obj);
});
const porMaterial = new Map();
for (const malla of mallas) {
  malla.updateMatrix();
  const g = malla.geometry.clone();
  g.applyMatrix4(malla.matrix);
  if (!porMaterial.has(malla.material)) porMaterial.set(malla.material, []);
  porMaterial.get(malla.material).push(g);
  malla.removeFromParent();
}
for (const [mat, geos] of porMaterial) {
  const malla = new THREE.Mesh(mergeGeometries(geos, false), mat);
  malla.name = 'Fe_' + mat.name;
  raiz.add(malla);
}

let triangulos = 0;
let piezas = 0;
raiz.traverse((obj) => {
  if (obj.isMesh) {
    piezas++;
    const g = obj.geometry;
    triangulos += g.index ? g.index.count / 3 : g.attributes.position.count / 3;
  }
});
console.log(`Malla: ${piezas} piezas, ${triangulos} triángulos`);

const exportador = new GLTFExporter();
exportador.parse(
  raiz,
  (glb) => {
    writeFileSync(SALIDA, Buffer.from(glb));
    console.log(`GLB guardado en ${SALIDA} (${(glb.byteLength / 1048576).toFixed(2)} MB)`);
  },
  (error) => {
    console.error('Error al exportar:', error);
    process.exit(1);
  },
  { binary: true }
);
