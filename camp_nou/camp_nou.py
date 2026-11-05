import bpy
import math

# COORD_MODE: Z_UP
# ==============================================================================
# NUEVO CAMP NOU (FC Barcelona, Les Corts) — modelo aproximado del proyecto de reforma
# ==============================================================================
# Qué es: el estadio reformado segun el proyecto ganador del concurso del Espai Barça
# (Nikken Sekkei + Joan Pascual / Ramon Ausio): bol de tres anillos de gradas, fachada
# abierta de lamas verticales con tres anillas de circulacion perimetral y cubierta
# traslucida que cubre todo el aforo.
#
# Fuentes (web del FC Barcelona "Aixi sera el Futur Camp Nou" y prensa del concurso):
#   - Aforo proyectado: unos 105.000 espectadores, todo el aforo cubierto.
#   - Cubierta: unos 45.000-47.000 m2, semitransparente (ETFE en la propuesta de 2016).
#   - Fachada abierta formada por tres anillas de circulacion, con mirador de 360 grados.
#   - Campo: 105 x 68 m (medida reglamentaria).
#   - Altura maxima: unos 48 m (solo aparece en una fuente, sin confirmar).
#
# APROXIMADO (no sale de las fuentes): numero y altura de los escalones, reparto de
# colores de los asientos, numero de lamas y de cerchas, tamaño de las pantallas y
# todo el interior. Sin planos ni fotos oficiales no hay mas detalle fiable.
#
# Ejes: X = eje largo del campo, Y = eje corto, Z = altura. 1 unidad = 1 metro.
# Colores en valores lineales (el visor los pasa a sRGB y los aclara).
# ==============================================================================

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)

bpy.ops.render.set_engine(engine='BLENDER_EEVEE_NEXT', env_intensity=0.45, bloom=0.04)
bpy.ops.render.set_lighting(intensity=1.05, angle=42)
bpy.ops.render.set_ssao(intensity=1.4)

PI = 3.14159265
MEDIO_PI = 1.57079633
TRES_MEDIOS_PI = 4.71238898
DOS_PI = 6.28318531

# ==========================================
# 0. AYUDAS
# ==========================================

def material(nombre, color, rugosidad=0.6, metalico=0.0, alfa=1.0, barniz=0.0, emision=0.0):
    mat = bpy.data.materials.new(name=nombre)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Base Color"].default_value = color
        bsdf.inputs["Roughness"].default_value = rugosidad
        bsdf.inputs["Metallic"].default_value = metalico
        if alfa < 1.0:
            bsdf.inputs["Alpha"].default_value = alfa
        if barniz > 0:
            bsdf.inputs["Coat Weight"].default_value = barniz
        if emision > 0:
            bsdf.inputs["Emission Color"].default_value = color
            bsdf.inputs["Emission Strength"].default_value = emision
    return mat

def asignar_mat(obj, mat):
    if obj.data.materials:
        obj.data.materials[0] = mat
    else:
        obj.data.materials.append(mat)
    return obj

def caja(nombre, centro, tamano, mat, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=centro, rotation=rot)
    obj = bpy.context.active_object
    obj.name = nombre
    obj.scale = tamano
    return asignar_mat(obj, mat)

def cilindro(nombre, centro, radio, alto, mat, vertices=10, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radio, depth=alto, location=centro, rotation=rot)
    obj = bpy.context.active_object
    obj.name = nombre
    return asignar_mat(obj, mat)

def aro(nombre, centro, radio, grosor, mat, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_torus_add(major_radius=radio, minor_radius=grosor, location=centro, rotation=rot)
    obj = bpy.context.active_object
    obj.name = nombre
    return asignar_mat(obj, mat)

def viga(nombre, a, b, grosor, mat):
    dx = b[0] - a[0]
    dy = b[1] - a[1]
    dz = b[2] - a[2]
    horiz = math.sqrt(dx * dx + dy * dy)
    largo = math.sqrt(horiz * horiz + dz * dz)
    centro = ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2)
    return caja(nombre, centro, (largo, grosor, grosor), mat, rot=(0, -math.atan2(dz, horiz), math.atan2(dy, dx)))

# --- Planta en rectangulo redondeado (la planta real no es una elipse) ---
# A = semieje largo, B = semieje corto, R = radio de las esquinas.
# Al desplazar el contorno d metros hacia fuera basta con sumar d a A, B y R.

def perim(A, B, R):
    return 4 * (A - R) + 4 * (B - R) + DOS_PI * R

def punto_rr(s, A, B, R):
    # Devuelve [x, y, rumbo] a s metros del inicio, recorriendo el contorno
    # desde el centro del lado +X en sentido antihorario.
    ax = A - R
    by = B - R
    q = MEDIO_PI * R
    L1 = by
    L2 = L1 + q
    L3 = L2 + 2 * ax
    L4 = L3 + q
    L5 = L4 + 2 * by
    L6 = L5 + q
    L7 = L6 + 2 * ax
    L8 = L7 + q
    if s < L1:
        return [A, s, MEDIO_PI]
    if s < L2:
        t = (s - L1) / R
        return [ax + R * math.cos(t), by + R * math.sin(t), t + MEDIO_PI]
    if s < L3:
        return [ax - (s - L2), B, PI]
    if s < L4:
        t = (s - L3) / R
        return [-ax + R * math.cos(t + MEDIO_PI), by + R * math.sin(t + MEDIO_PI), t + PI]
    if s < L5:
        return [-A, by - (s - L4), TRES_MEDIOS_PI]
    if s < L6:
        t = (s - L5) / R
        return [-ax + R * math.cos(t + PI), -by + R * math.sin(t + PI), t + TRES_MEDIOS_PI]
    if s < L7:
        return [-ax + (s - L6), -B, 0.0]
    if s < L8:
        t = (s - L7) / R
        return [ax + R * math.cos(t + TRES_MEDIOS_PI), -by + R * math.sin(t + TRES_MEDIOS_PI), t]
    return [A, -by + (s - L8), MEDIO_PI]

SECTORES = 8
POR_SECTOR = 12

def anillo_h(prefijo, z, A, B, R, ancho, grosor, mats):
    # Anillo horizontal (fila de asientos, pasillo, cubierta). A, B, R = borde interior.
    Ac = A + ancho * 0.5
    Bc = B + ancho * 0.5
    Rc = R + ancho * 0.5
    P = perim(Ac, Bc, Rc)
    n = SECTORES * POR_SECTOR
    seg = P / n * 1.12
    for s in range(SECTORES):
        for j in range(POR_SECTOR):
            i = s * POR_SECTOR + j
            p = punto_rr(P * i / n, Ac, Bc, Rc)
            caja(prefijo + "_" + str(i), (p[0], p[1], z), (seg, ancho, grosor), mats[s], rot=(0, 0, p[2]))

def anillo_v(prefijo, z0, z1, A, B, R, grosor, mats):
    # Pared en anillo (contrahuella, peto, fachada) entre z0 y z1.
    P = perim(A, B, R)
    n = SECTORES * POR_SECTOR
    seg = P / n * 1.12
    alto = z1 - z0
    zc = (z0 + z1) * 0.5
    for s in range(SECTORES):
        for j in range(POR_SECTOR):
            i = s * POR_SECTOR + j
            p = punto_rr(P * i / n, A, B, R)
            caja(prefijo + "_" + str(i), (p[0], p[1], zc), (seg, grosor, alto), mats[s], rot=(0, 0, p[2]))

def grada(prefijo, A0, B0, R0, z0, pasos, huella, contra, mats_paso, mats_contra):
    # Bol escalonado: cada paso = contrahuella vertical + fila de asientos horizontal.
    for k in range(pasos):
        d = k * huella
        A = A0 + d
        B = B0 + d
        R = R0 + d
        zb = z0 + k * contra
        zt = zb + contra
        anillo_v(prefijo + "_C" + str(k), zb, zt, A, B, R, 0.7, mats_contra)
        anillo_h(prefijo + "_F" + str(k), zt, A, B, R, huella, 0.45, mats_paso[k])

# ==========================================
# 1. MATERIALES (pocos y compartidos)
# ==========================================
m_claro = material("CN_Hormigon_Claro", (0.40, 0.40, 0.385, 1.0), 0.85)
m_oscuro = material("CN_Estructura", (0.085, 0.085, 0.082, 1.0), 0.8)
m_azul = material("CN_Asiento_Azul", (0.006, 0.016, 0.082, 1.0), 0.7)
m_grana = material("CN_Asiento_Grana", (0.072, 0.002, 0.012, 1.0), 0.7)
m_blanco = material("CN_Asiento_Blanco", (0.52, 0.52, 0.49, 1.0), 0.6)
m_cesped = material("CN_Cesped", (0.022, 0.110, 0.018, 1.0), 0.92)
m_linea = material("CN_Linea", (0.72, 0.72, 0.70, 1.0), 0.5)
m_cristal = material("CN_Cristal", (0.28, 0.42, 0.52, 1.0), 0.1, alfa=0.22, barniz=1.0)
m_etfe = material("CN_Cubierta_ETFE", (0.44, 0.49, 0.54, 1.0), 0.3, alfa=0.46, barniz=0.5)
m_metal = material("CN_Metal", (0.045, 0.045, 0.050, 1.0), 0.4, 1.0)
m_luz = material("CN_Focos", (1.0, 0.93, 0.76, 1.0), 0.3, emision=3.2)
m_pantalla = material("CN_Pantalla", (0.018, 0.018, 0.024, 1.0), 0.25)

# Listas de 8 sectores (el motor no admite comprensiones: se escriben a mano)
az8 = [m_azul, m_azul, m_azul, m_azul, m_azul, m_azul, m_azul, m_azul]
ho8 = [m_oscuro, m_oscuro, m_oscuro, m_oscuro, m_oscuro, m_oscuro, m_oscuro, m_oscuro]
cl8 = [m_claro, m_claro, m_claro, m_claro, m_claro, m_claro, m_claro, m_claro]
cr8 = [m_cristal, m_cristal, m_cristal, m_cristal, m_cristal, m_cristal, m_cristal, m_cristal]
et8 = [m_etfe, m_etfe, m_etfe, m_etfe, m_etfe, m_etfe, m_etfe, m_etfe]
mt8 = [m_metal, m_metal, m_metal, m_metal, m_metal, m_metal, m_metal, m_metal]
lz8 = [m_luz, m_luz, m_luz, m_luz, m_luz, m_luz, m_luz, m_luz]

# Mosaico azulgrana: bloques de asientos alternos como en el estadio real
mA = [m_azul, m_azul, m_grana, m_azul, m_azul, m_azul, m_grana, m_azul]
mB = [m_azul, m_grana, m_azul, m_azul, m_azul, m_grana, m_azul, m_azul]
mC = [m_grana, m_azul, m_azul, m_grana, m_grana, m_azul, m_azul, m_grana]
# Banda blanca (sugiere la franja de letras del anillo intermedio)
mW = [m_azul, m_blanco, m_blanco, m_azul, m_azul, m_blanco, m_blanco, m_azul]

# ==========================================
# 2. EXPLANADA, CAMPO Y MARCAS
# ==========================================
caja("CN_Explanada", (0, 0, -0.15), (298, 262, 0.3), m_claro)
caja("CN_Foso", (0, 0, 0.1), (136, 100, 0.2), m_oscuro)
caja("CN_Campo", (0, 0, 0.35), (105, 68, 0.3), m_cesped)

caja("CN_Linea_Medio", (0, 0, 0.52), (0.14, 68, 0.04), m_linea)
aro("CN_Circulo_Central", (0, 0, 0.52), 9.15, 0.07, m_linea)
caja("CN_Banda_N", (0, 34, 0.52), (105, 0.14, 0.04), m_linea)
caja("CN_Banda_S", (0, -34, 0.52), (105, 0.14, 0.04), m_linea)
caja("CN_Fondo_O", (-52.5, 0, 0.52), (0.14, 68, 0.04), m_linea)
caja("CN_Fondo_E", (52.5, 0, 0.52), (0.14, 68, 0.04), m_linea)

# Areas grandes (40,3 x 16,5) y pequeñas (18,3 x 5,5)
caja("CN_Area_O", (-36.0, 0, 0.52), (0.14, 40.3, 0.04), m_linea)
caja("CN_Area_E", (36.0, 0, 0.52), (0.14, 40.3, 0.04), m_linea)
caja("CN_Area_O_N", (-44.25, 20.15, 0.52), (16.5, 0.14, 0.04), m_linea)
caja("CN_Area_O_S", (-44.25, -20.15, 0.52), (16.5, 0.14, 0.04), m_linea)
caja("CN_Area_E_N", (44.25, 20.15, 0.52), (16.5, 0.14, 0.04), m_linea)
caja("CN_Area_E_S", (44.25, -20.15, 0.52), (16.5, 0.14, 0.04), m_linea)
caja("CN_Chica_O", (-47.0, 0, 0.52), (0.14, 18.3, 0.04), m_linea)
caja("CN_Chica_E", (47.0, 0, 0.52), (0.14, 18.3, 0.04), m_linea)
caja("CN_Chica_O_N", (-49.75, 9.15, 0.52), (5.5, 0.14, 0.04), m_linea)
caja("CN_Chica_O_S", (-49.75, -9.15, 0.52), (5.5, 0.14, 0.04), m_linea)
caja("CN_Chica_E_N", (49.75, 9.15, 0.52), (5.5, 0.14, 0.04), m_linea)
caja("CN_Chica_E_S", (49.75, -9.15, 0.52), (5.5, 0.14, 0.04), m_linea)

# Porterias (7,32 x 2,44) y banderines de corner
for k in range(2):
    sx = -1
    if k == 1:
        sx = 1
    x = sx * 52.5
    caja("CN_Poste_N_" + str(k), (x, 3.66, 1.57), (0.16, 0.16, 2.44), m_linea)
    caja("CN_Poste_S_" + str(k), (x, -3.66, 1.57), (0.16, 0.16, 2.44), m_linea)
    caja("CN_Larguero_" + str(k), (x, 0, 2.79), (0.16, 7.5, 0.16), m_linea)
    caja("CN_Red_" + str(k), (x + sx * 1.0, 0, 1.6), (2.0, 7.4, 2.5), m_cristal)

for k in range(4):
    sx = -1
    sy = -1
    if k == 1:
        sx = 1
    if k == 2:
        sy = 1
    if k == 3:
        sx = 1
        sy = 1
    cilindro("CN_Corner_" + str(k), (sx * 52.5, sy * 34.0, 1.1), 0.06, 1.5, m_linea, vertices=6)

# ==========================================
# 3. BOL DE GRADAS: tres anillos escalonados
# Al desplazar el contorno hacia fuera, los tramos rectos se mantienen y las
# esquinas se van redondeando: por eso R crece igual que A y B.
# ==========================================
A0 = 62.0
B0 = 44.0
R0 = 20.0

# Anillo inferior: 6 escalones, z 1,5 -> 13,5
grada("CN_T1", A0, B0, R0, 1.5, 6, 3.0, 2.0, [mA, mA, mA, mB, mB, mB], ho8)
# Pasillo / primera anilla de circulacion
anillo_v("CN_Peto1", 13.5, 15.0, A0 + 18.0, B0 + 18.0, R0 + 18.0, 0.6, cl8)
anillo_h("CN_Paseo1", 15.0, A0 + 18.0, B0 + 18.0, R0 + 18.0, 4.0, 0.7, cl8)

# Anillo intermedio: 6 escalones, z 16 -> 30 (una fila con banda blanca)
grada("CN_T2", A0 + 22.0, B0 + 22.0, R0 + 22.0, 16.0, 6, 3.0, 2.3333, [mB, mB, mW, mA, mA, mA], ho8)
anillo_v("CN_Peto2", 30.0, 31.5, A0 + 40.0, B0 + 40.0, R0 + 40.0, 0.6, cl8)
anillo_h("CN_Paseo2", 31.5, A0 + 40.0, B0 + 40.0, R0 + 40.0, 4.0, 0.7, cl8)

# Anillo superior: 6 escalones, z 32 -> 46
grada("CN_T3", A0 + 44.0, B0 + 44.0, R0 + 44.0, 32.0, 6, 2.6667, 2.3333, [mA, mA, mB, mC, mC, mC], ho8)
anillo_v("CN_Peto3", 46.0, 47.6, A0 + 60.0, B0 + 60.0, R0 + 60.0, 0.6, cl8)

# ==========================================
# 4. CUBIERTA TRASLUCIDA SOBRE TODO EL AFORO
# ==========================================
A_INT = 94.0    # borde interior de la cubierta (vuela sobre las gradas)
B_INT = 76.0
R_INT = 52.0
ANCHO_CUB = 40.0
Z_CUB = 49.0

anillo_h("CN_Cubierta", Z_CUB, A_INT, B_INT, R_INT, ANCHO_CUB, 0.5, et8)
anillo_v("CN_Borde_Cubierta", Z_CUB - 1.4, Z_CUB + 0.6, A_INT + ANCHO_CUB, B_INT + ANCHO_CUB, R_INT + ANCHO_CUB, 1.2, cl8)
anillo_v("CN_Morro", Z_CUB - 1.2, Z_CUB + 0.3, A_INT, B_INT, R_INT, 0.9, mt8)
# Franja de focos bajo el borde interior de la cubierta
anillo_h("CN_Focos", Z_CUB - 1.6, A_INT + 0.6, B_INT + 0.6, R_INT + 0.6, 1.8, 0.35, lz8)

# Cerchas radiales y soportes verticales desde el anillo superior
P_INT = perim(A_INT, B_INT, R_INT)
P_EXT = perim(A_INT + ANCHO_CUB, B_INT + ANCHO_CUB, R_INT + ANCHO_CUB)
for i in range(32):
    pi_ = punto_rr(P_INT * i / 32, A_INT, B_INT, R_INT)
    pe = punto_rr(P_EXT * i / 32, A_INT + ANCHO_CUB, B_INT + ANCHO_CUB, R_INT + ANCHO_CUB)
    viga("CN_Cercha_" + str(i), (pi_[0], pi_[1], Z_CUB - 0.9), (pe[0], pe[1], Z_CUB + 1.1), 0.7, m_metal)
    cilindro("CN_Soporte_" + str(i), (pe[0], pe[1], (Z_CUB + 36.0) * 0.5), 0.55, Z_CUB - 36.0, m_claro, vertices=8)

# Pantallas gigantes colgadas en los fondos
caja("CN_Pantalla_O", (-96.0, 0, 38.0), (1.6, 26.0, 13.0), m_pantalla)
caja("CN_Pantalla_E", (96.0, 0, 38.0), (1.6, 26.0, 13.0), m_pantalla)

# ==========================================
# 5. FACHADA ABIERTA: lamas verticales, cristal y tres anillas de circulacion
# ==========================================
A_FACH = 128.0
B_FACH = 110.0
R_FACH = 86.0

anillo_v("CN_Cristal", 0.0, 13.0, A_FACH - 2.0, B_FACH - 2.0, R_FACH - 2.0, 1.0, cr8)
anillo_v("CN_Zocalo", 0.0, 1.2, A_FACH, B_FACH, R_FACH, 2.2, cl8)

# Tres anillas de circulacion perimetral en voladizo
anillo_h("CN_Anilla_1", 13.5, A_FACH - 1.5, B_FACH - 1.5, R_FACH - 1.5, 5.0, 1.1, cl8)
anillo_h("CN_Anilla_2", 31.0, A_FACH - 1.5, B_FACH - 1.5, R_FACH - 1.5, 5.0, 1.1, cl8)
anillo_h("CN_Anilla_3", 47.0, A_FACH - 1.5, B_FACH - 1.5, R_FACH - 1.5, 5.0, 1.1, cl8)
anillo_v("CN_Baranda_1", 14.1, 15.2, A_FACH + 3.5, B_FACH + 3.5, R_FACH + 3.5, 0.3, cr8)
anillo_v("CN_Baranda_2", 31.6, 32.7, A_FACH + 3.5, B_FACH + 3.5, R_FACH + 3.5, 0.3, cr8)
anillo_v("CN_Baranda_3", 47.6, 48.7, A_FACH + 3.5, B_FACH + 3.5, R_FACH + 3.5, 0.3, cr8)

# Lamas verticales blancas, el rasgo mas visible de la fachada
P_FACH = perim(A_FACH, B_FACH, R_FACH)
for i in range(128):
    p = punto_rr(P_FACH * i / 128, A_FACH, B_FACH, R_FACH)
    caja("CN_Lama_" + str(i), (p[0], p[1], 24.5), (1.1, 1.8, 49.0), m_claro, rot=(0, 0, p[2]))
