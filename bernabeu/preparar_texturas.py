#!/usr/bin/env python3
"""Prepara las texturas del Santiago Bernabéu a partir de texturas CC0 descargadas de internet.

Uso: python3 bernabeu/preparar_texturas.py <carpeta_descargas>

En <carpeta_descargas> deben estar los ZIP ya descomprimidos de ambientCG
(Grass005, Metal009, Metal049A, Concrete034, Concrete031) y las imágenes de Poly Haven
(ph_asphalt_02, ph_large_grey_tiles con Diffuse.jpg / nor_gl.jpg / Rough.jpg).
Escribe los JPG en public/textures/ con el prefijo bb_.

- bb_butacas: respaldos de butaca azul oscuro dibujados aquí (con el grano del hormigón
  Concrete034 como ruido), para las contrahuellas de las gradas.
- bb_pantalla: contenido abstracto del videomarcador (dibujado aquí).

- bb_campo: el campo entero (105 x 68 m) en una imagen de 130 m de lado que se repite.
  El centro del campo queda en la esquina de la imagen (coordenada 0 del mundo), porque la app
  proyecta las UV desde el origen: mat.color_map_scale = 130 deja el campo centrado en (0, 0).
  El ancho (68 m) va en horizontal y el largo (105 m) en vertical.
"""
import os
import sys

import numpy as np
from PIL import Image, ImageDraw

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SALIDA = os.path.join(RAIZ, 'public', 'textures')


def guardar(img, nombre, calidad=86):
    ruta = os.path.join(SALIDA, nombre)
    img.convert('RGB').save(ruta, 'JPEG', quality=calidad, optimize=True)
    print(nombre, os.path.getsize(ruta) // 1024, 'KB')


def copia(origen, nombre, tam=1024, calidad=86, tinte=None):
    img = Image.open(origen).convert('RGB')
    if img.size[0] != tam:
        img = img.resize((tam, tam), Image.LANCZOS)
    if tinte is not None:
        a = np.asarray(img).astype(np.float32) * np.array(tinte, dtype=np.float32)
        img = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))
    guardar(img, nombre, calidad)


def campo(cesped_path):
    lado_m = 130.0
    px = 2048
    m = px / lado_m  # píxeles por metro
    # Césped base: la textura de 1K repetida cada 4 m
    base = Image.open(cesped_path).convert('RGB')
    rep = int(round(4.0 * m))
    base = base.resize((rep, rep), Image.LANCZOS)
    lienzo = Image.new('RGB', (px, px))
    for i in range(0, px, rep):
        for j in range(0, px, rep):
            lienzo.paste(base, (i, j))
    a = np.asarray(lienzo).astype(np.float32)
    # Verde de estadio algo más profundo que la textura original
    a = a * np.array([0.60, 0.80, 0.46], dtype=np.float32)
    # Franjas de corte: bandas de 5,25 m a lo largo del campo (20 en 105 m), centradas
    yy = (np.arange(px) - px / 2) / m  # metros desde el centro, eje vertical = largo
    banda = np.floor((yy + 105.0 / 2) / 5.25).astype(int)
    factor = np.where(banda % 2 == 0, 1.10, 0.88).astype(np.float32)
    a = a * factor[:, None, None]
    img = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))

    d = ImageDraw.Draw(img)
    cx = px / 2
    cy = px / 2
    blanco = (236, 240, 232)
    w = max(2, int(round(0.12 * m)))

    def P(x, y):
        return (cx + x * m, cy + y * m)

    def rect(x0, y0, x1, y1):
        d.rectangle([P(min(x0, x1), min(y0, y1)), P(max(x0, x1), max(y0, y1))], outline=blanco, width=w)

    def circulo(x, y, r, a0=0, a1=360):
        caja = [P(x - r, y - r), P(x + r, y + r)]
        d.arc(caja, a0, a1, fill=blanco, width=w)

    def punto(x, y, r=0.2):
        d.ellipse([P(x - r, y - r), P(x + r, y + r)], fill=blanco)

    L = 105.0 / 2
    A = 68.0 / 2
    rect(-A, -L, A, L)  # bandas y líneas de meta
    d.line([P(-A, 0), P(A, 0)], fill=blanco, width=w)  # línea de medio campo
    circulo(0, 0, 9.15)
    punto(0, 0, 0.25)
    for s in [-1, 1]:
        # Área grande 40,32 x 16,5 y área pequeña 18,32 x 5,5
        rect(-20.16, s * L, 20.16, s * (L - 16.5))
        rect(-9.16, s * L, 9.16, s * (L - 5.5))
        punto(0, s * (L - 11.0))
        # Media luna: parte del círculo de 9,15 m fuera del área
        ang = np.degrees(np.arccos(5.5 / 9.15))
        if s == -1:
            # punto de penalti en y negativo (arriba en la imagen): el arco mira hacia +y
            circulo(0, s * (L - 11.0), 9.15, 90 - ang, 90 + ang)
        else:
            circulo(0, s * (L - 11.0), 9.15, 270 - ang, 270 + ang)
        # Arcos de esquina de 1 m (solo el cuarto de dentro del campo; 0° = derecha, horario)
        for t in [-1, 1]:
            if t == -1 and s == -1:
                a0 = 0
            elif t == 1 and s == -1:
                a0 = 90
            elif t == 1 and s == 1:
                a0 = 180
            else:
                a0 = 270
            circulo(t * A, s * L, 1.0, a0, a0 + 90)
    # Centro del campo a la esquina (0,0) de la imagen
    arr = np.roll(np.roll(np.asarray(img), px // 2, axis=0), px // 2, axis=1)
    guardar(Image.fromarray(arr), 'bb_campo_2k.jpg', 88)


def butacas(plastico_path):
    # Respaldos de butaca azul oscuro (una butaca de 0,5 m por repetición, separación oscura).
    # Solo varía en horizontal: así encaja con contrahuellas de cualquier altura.
    tam = 256
    base = Image.open(plastico_path).convert('L').resize((tam, tam), Image.LANCZOS)
    ruido = np.asarray(base).astype(np.float32) / 255.0
    ruido = 0.85 + 0.3 * (ruido - ruido.mean())
    azul = np.array([11, 21, 60], dtype=np.float32)
    a = np.ones((tam, tam, 3), dtype=np.float32) * azul
    x = np.arange(tam) / tam
    # Hueco entre butacas y un brillo suave en el centro del respaldo
    hueco = (x < 0.07) | (x > 0.93)
    brillo = 1.0 + 0.35 * np.exp(-((x - 0.5) / 0.22) ** 2)
    a = a * brillo[None, :, None]
    a[:, hueco, :] = np.array([10, 11, 14], dtype=np.float32)
    a = a * ruido[:, :, None]
    guardar(Image.fromarray(np.clip(a, 0, 255).astype(np.uint8)), 'bb_butacas_256.jpg', 90)


def pantalla():
    # Contenido del videomarcador: paneles de vídeo abstractos (degradados, bloques de marcador y
    # mosaico), sin texto para que no salga del revés en ningún lado. 24 m por repetición.
    tam = 1024
    rng = np.random.default_rng(7)
    img = np.zeros((tam, tam, 3), dtype=np.float32)
    celda_x = tam // 4
    celda_y = tam // 6
    paleta = [
        ((10, 30, 120), (90, 160, 255)),
        ((40, 10, 90), (230, 190, 90)),
        ((5, 60, 90), (120, 240, 255)),
        ((15, 15, 40), (60, 90, 200)),
        ((120, 120, 140), (250, 250, 255)),
    ]
    for i in range(4):
        for j in range(6):
            a, b = paleta[rng.integers(len(paleta))]
            a = np.array(a, dtype=np.float32)
            b = np.array(b, dtype=np.float32)
            t = np.linspace(0, 1, celda_x)[None, :, None]
            if rng.random() < 0.5:
                t = np.linspace(0, 1, celda_y)[:, None, None] * np.ones((1, celda_x, 1))
            bloque = a + (b - a) * t * np.ones((celda_y, celda_x, 1))
            # Elementos blancos: barras de marcador o líneas de estadísticas
            if rng.random() < 0.5:
                for _ in range(rng.integers(2, 5)):
                    y0 = rng.integers(10, celda_y - 30)
                    x0 = rng.integers(10, celda_x // 2)
                    bloque[y0:y0 + 14, x0:x0 + rng.integers(40, celda_x - x0 - 10)] = (235, 240, 255)
            else:
                paso = 16
                for yy in range(0, celda_y, paso):
                    for xx in range(0, celda_x, paso):
                        bloque[yy:yy + paso - 3, xx:xx + paso - 3] *= 0.6 + 0.8 * rng.random()
            img[j * celda_y:(j + 1) * celda_y, i * celda_x:(i + 1) * celda_x] = bloque
            # Marco oscuro entre paneles
            img[j * celda_y:j * celda_y + 4, i * celda_x:(i + 1) * celda_x] = 8
            img[j * celda_y:(j + 1) * celda_y, i * celda_x:i * celda_x + 4] = 8
    img[6 * celda_y:, :] = img[:tam - 6 * celda_y, :]
    # Rejilla de LED muy fina
    img[::4, :, :] *= 0.82
    img[:, ::4, :] *= 0.82
    guardar(Image.fromarray(np.clip(img, 0, 255).astype(np.uint8)), 'bb_pantalla_1k.jpg', 85)


def main():
    if len(sys.argv) < 2:
        raise SystemExit(__doc__)
    dl = sys.argv[1]
    os.makedirs(SALIDA, exist_ok=True)
    g = os.path.join(dl, 'Grass005', 'Grass005_1K-JPG_Color.jpg')
    campo(g)
    butacas(os.path.join(dl, 'Concrete034', 'Concrete034_1K-JPG_Color.jpg'))
    pantalla()
    # Acero inoxidable cepillado de la fachada (un poco más claro y frío)
    copia(os.path.join(dl, 'Metal009', 'Metal009_1K-JPG_Color.jpg'), 'bb_acero_diff_1k.jpg', tinte=(0.86, 0.89, 0.93))
    copia(os.path.join(dl, 'Metal009', 'Metal009_1K-JPG_NormalGL.jpg'), 'bb_acero_nor_gl_1k.jpg', 512)
    copia(os.path.join(dl, 'Metal009', 'Metal009_1K-JPG_Roughness.jpg'), 'bb_acero_rough_1k.jpg', 512)
    # Chapa blanca de la cubierta
    copia(os.path.join(dl, 'Metal049A', 'Metal049A_1K-JPG_Color.jpg'), 'bb_cubierta_diff_1k.jpg', 512, tinte=(0.97, 0.97, 0.97))
    # Hormigón claro (estructura, contrahuellas) y hormigón gris (vomitorios, zócalo)
    copia(os.path.join(dl, 'Concrete034', 'Concrete034_1K-JPG_Color.jpg'), 'bb_hormigon_diff_1k.jpg')
    copia(os.path.join(dl, 'Concrete034', 'Concrete034_1K-JPG_NormalGL.jpg'), 'bb_hormigon_nor_gl_1k.jpg', 512)
    copia(os.path.join(dl, 'Concrete031', 'Concrete031_1K-JPG_Color.jpg'), 'bb_hormigon_gris_diff_1k.jpg', 512)
    # Asfalto (Castellana) y losas de granito (plazas)
    copia(os.path.join(dl, 'ph_asphalt_02', 'Diffuse.jpg'), 'bb_asfalto_diff_1k.jpg', 1024, tinte=(0.5, 0.5, 0.52))
    copia(os.path.join(dl, 'ph_asphalt_02', 'nor_gl.jpg'), 'bb_asfalto_nor_gl_1k.jpg', 512)
    copia(os.path.join(dl, 'ph_large_grey_tiles', 'Diffuse.jpg'), 'bb_losa_diff_1k.jpg', 1024, tinte=(0.9, 0.88, 0.85))
    copia(os.path.join(dl, 'ph_large_grey_tiles', 'nor_gl.jpg'), 'bb_losa_nor_gl_1k.jpg', 512)


if __name__ == '__main__':
    main()
