import bpy
import math

# COORD_MODE: Z_UP
# ==============================================================================
# PASARELA PEATONAL DE MOGUER (junto al Pol. Ind. "Los Arroyos", C/ Castaño)
# ==============================================================================
# Pasarela de celosía tubular blanca sobre la carretera en trinchera, con el rótulo MOGUER en
# letras rojas. Partes: viga en cajón de tubos (cordones, diagonales en X, arriostramiento
# superior, vigas de suelo), suelo de rejilla, malla y pasamanos, focos en los nudos; torre
# de acceso con cuatro pilares altos y pórtico; escalera de dos tramos y rampa en zigzag en el
# lado del aparcamiento; apoyos en V, pasarela en rampa y escalera recta en el otro lado;
# trinchera con muros, calzada y biondas; valla, farolas, cartel, coches, casas y árboles.
#
# Fuente: tres fotos nocturnas del usuario (no hay datos publicados de esta pasarela).
# Todo es aproximado a ojo, tomando como escala los coches (4,5 m) y la barandilla (1,1 m):
# luz de la celosía ~45 m, canto ~3 m, ancho ~2,9 m, suelo a ~5 m sobre el aparcamiento.
# El rótulo solo se ve en una cara en las fotos; aquí se pone en las dos.
# Ejes: X = a lo largo de la pasarela (el aparcamiento en X negativo), Y = transversal
# (las fotos están tomadas desde Y negativo), Z = altura. Medidas en metros.
# Los colores van en valores lineales, como en Blender (el visor los pasa a sRGB).
# ==============================================================================

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)

bpy.ops.render.set_engine(engine='BLENDER_EEVEE_NEXT', env_intensity=0.65, bloom=0.08)
bpy.ops.render.set_lighting(intensity=1.3, angle=35)
bpy.ops.render.set_ssao(intensity=1.2)

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

def material_imagen(nombre, mapa, metros, rugosidad=0.8):
    mat = material(nombre, (1.0, 1.0, 1.0, 1.0), rugosidad)
    mat.color_map = mapa
    mat.color_map_scale = metros
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

def esfera(nombre, centro, radio, mat, escala=(1.0, 1.0, 1.0), segmentos=10, anillos=7):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segmentos, ring_count=anillos, radius=radio, location=centro)
    obj = bpy.context.active_object
    obj.name = nombre
    obj.scale = escala
    return asignar_mat(obj, mat)

def tubo(nombre, a, b, radio, mat, vertices=8):
    # Tubo redondo de a a b: el eje Z del cilindro se inclina (giro Y) y se orienta (giro Z)
    dx = b[0] - a[0]
    dy = b[1] - a[1]
    dz = b[2] - a[2]
    largo = math.sqrt(dx * dx + dy * dy + dz * dz)
    centro = ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2)
    return cilindro(nombre, centro, radio, largo, mat, vertices, rot=(0, math.acos(dz / largo), math.atan2(dy, dx)))

def barra(nombre, a, b, ancho, alto, mat):
    # Caja de a a b (largo), con "ancho" en horizontal y "alto" perpendicular a la pendiente
    dx = b[0] - a[0]
    dy = b[1] - a[1]
    dz = b[2] - a[2]
    horiz = math.sqrt(dx * dx + dy * dy)
    largo = math.sqrt(horiz * horiz + dz * dz)
    centro = ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2)
    return caja(nombre, centro, (largo, ancho, alto), mat, rot=(0, -math.atan2(dz, horiz), math.atan2(dy, dx)))

# ==========================================
# 1. MATERIALES
# ==========================================
m_acero = material("PM_AceroBlanco", (0.78, 0.77, 0.72, 1.0), 0.38, 0.15, barniz=0.3)
m_rejilla = material("PM_Rejilla", (0.22, 0.22, 0.21, 1.0), 0.55, 0.4)
m_rejilla.texture = "carbon_weave"
m_malla = material("PM_Malla", (0.85, 0.85, 0.82, 1.0), 0.5, 0.3, alfa=0.32)
m_luz = material("PM_Foco", (1.0, 0.86, 0.62, 1.0), 0.3, emision=3.5)
m_rotulo = material("PM_Rotulo", (0.30, 0.010, 0.008, 1.0), 0.5, barniz=0.2)
m_horm = material_imagen("PM_Hormigon", "bb_hormigon", 4.0, 0.85)
m_muro = material("PM_Muro", (0.62, 0.52, 0.34, 1.0), 0.85)
m_muro.texture = "concrete_brutalist"
m_asfalto = material_imagen("PM_Asfalto", "bb_asfalto", 8.0, 0.9)
m_suelo = material_imagen("PM_Explanada", "bb_hormigon_gris", 6.0, 0.95)
m_tierra = material("PM_TierraRoja", (0.15, 0.05, 0.018, 1.0), 0.95)
m_tierra.texture = "desert_sand"
m_linea = material("PM_Linea", (0.85, 0.85, 0.82, 1.0), 0.5)
m_valla = material("PM_Valla", (0.06, 0.065, 0.07, 1.0), 0.45, 0.5)
m_valla_panel = material("PM_VallaBarrotes", (0.05, 0.055, 0.06, 1.0), 0.5, 0.5, alfa=0.45)
m_bionda = material("PM_Bionda", (0.45, 0.46, 0.47, 1.0), 0.35, 0.8)
m_cal = material_imagen("PM_Cal", "cal_blanca", 2.0, 0.85)
m_teja = material_imagen("PM_Teja", "teja_arcilla", 2.5, 0.8)
m_ventana = material("PM_Ventana", (0.02, 0.022, 0.025, 1.0), 0.15, barniz=1.0)
m_madera = material("PM_Puerta", (0.12, 0.06, 0.025, 1.0), 0.6)
m_hoja = material("PM_Hoja", (0.035, 0.06, 0.02, 1.0), 0.85)
m_tronco = material("PM_Tronco", (0.07, 0.045, 0.025, 1.0), 0.9)
m_coche_gris = material("PM_CocheGris", (0.35, 0.36, 0.38, 1.0), 0.25, 0.7, barniz=1.0)
m_coche_azul = material("PM_CocheAzul", (0.012, 0.04, 0.13, 1.0), 0.25, 0.6, barniz=1.0)
m_negro = material("PM_Negro", (0.012, 0.012, 0.014, 1.0), 0.6)
m_cartel = material("PM_Cartel", (0.80, 0.80, 0.78, 1.0), 0.5)

# ==========================================
# 2. CELOSÍA PRINCIPAL (cajón de tubos)
# ==========================================
L = 45.0          # luz de la celosía
PANEL = 3.0       # paso de los nudos
NP = 15
YC = 1.45         # cordones a cada lado del eje
ZB = 5.15         # cordón inferior (nivel del suelo de la pasarela)
ZT = 8.10         # cordón superior
R_CORDON = 0.16
R_DIAG = 0.085

for s in [-1, 1]:
    y = s * YC
    tubo("PM_CordonInf_" + str(s), (0, y, ZB), (L, y, ZB), R_CORDON, m_acero, 12)
    tubo("PM_CordonSup_" + str(s), (0, y, ZT), (L, y, ZT), R_CORDON, m_acero, 12)
    # Montantes solo en los extremos (en las fotos no hay montantes intermedios)
    tubo("PM_MontanteIni_" + str(s), (0, y, ZB), (0, y, ZT), R_CORDON, m_acero, 12)
    tubo("PM_MontanteFin_" + str(s), (L, y, ZB), (L, y, ZT), R_CORDON, m_acero, 12)
    for i in range(NP):
        x0 = i * PANEL
        x1 = x0 + PANEL
        # Diagonales en X en cada panel: forman triángulos arriba y abajo y rombos en el centro
        tubo("PM_DiagA_" + str(s) + "_" + str(i), (x0, y, ZB), (x1, y, ZT), R_DIAG, m_acero)
        tubo("PM_DiagB_" + str(s) + "_" + str(i), (x0, y, ZT), (x1, y, ZB), R_DIAG, m_acero)

for i in range(NP + 1):
    x = i * PANEL
    # Travesaños superiores y vigas de suelo en cada nudo
    tubo("PM_TravSup_" + str(i), (x, -YC, ZT), (x, YC, ZT), 0.09, m_acero)
    barra("PM_VigaSuelo_" + str(i), (x, -YC, ZB - 0.12), (x, YC, ZB - 0.12), 0.14, 0.24, m_acero)
    if i < NP:
        # Arriostramiento del plano superior: una diagonal por panel, alternando
        if i % 2 == 0:
            tubo("PM_ArriosSup_" + str(i), (x, -YC, ZT), (x + PANEL, YC, ZT), 0.06, m_acero)
        else:
            tubo("PM_ArriosSup_" + str(i), (x, YC, ZT), (x + PANEL, -YC, ZT), 0.06, m_acero)
        # Focos en los nudos del cordón superior, mirando hacia dentro
        for s in [-1, 1]:
            cilindro("PM_FocoSup_" + str(s) + "_" + str(i), (x + PANEL / 2, s * (YC - 0.2), ZT - 0.12), 0.07, 0.08, m_luz, 10)
            esfera("PM_FocoBaranda_" + str(s) + "_" + str(i), (x + PANEL / 2, s * (YC - 0.25), ZB + 1.25), 0.05, m_luz, segmentos=8, anillos=5)

# Largueros bajo el suelo, suelo de rejilla, malla lateral y pasamanos
for s in [-1, 1]:
    barra("PM_Larguero_" + str(s), (0, s * 0.75, ZB - 0.2), (L, s * 0.75, ZB - 0.2), 0.12, 0.22, m_acero)
caja("PM_SueloRejilla", (L / 2, 0, ZB + 0.04), (L, 2.75, 0.08), m_rejilla)
for s in [-1, 1]:
    y = s * (YC - 0.18)
    caja("PM_Malla_" + str(s), (L / 2, y, ZB + 0.68), (L, 0.02, 1.15), m_malla)
    tubo("PM_Pasamanos_" + str(s), (0, y, ZB + 1.25), (L, y, ZB + 1.25), 0.045, m_acero)
    tubo("PM_RielBajo_" + str(s), (0, y, ZB + 0.12), (L, y, ZB + 0.12), 0.035, m_acero)
    tubo("PM_RielMedio_" + str(s), (0, s * YC, ZB + 1.45), (L, s * YC, ZB + 1.45), 0.06, m_acero)
    for i in range(NP + 1):
        tubo("PM_PosteMalla_" + str(s) + "_" + str(i), (i * PANEL, y, ZB), (i * PANEL, y, ZB + 1.25), 0.035, m_acero, 6)

# ==========================================
# 3. RÓTULO "MOGUER" (letras rojas por trazos, en las dos caras)
# ==========================================
H_L = 1.75
W_L = 1.0
TRAZO = 0.26
FONDO = 0.10

def trazos_letra(c):
    a = TRAZO / 2
    izq = a
    der = W_L - a
    aba = a
    arr = H_L - a
    med = H_L / 2
    r = 0.30
    t = []
    if c == "M":
        t.append([izq, aba, izq, arr])
        t.append([izq, arr, W_L / 2, H_L * 0.40])
        t.append([W_L / 2, H_L * 0.40, der, arr])
        t.append([der, arr, der, aba])
    if c == "O":
        t.append([izq, aba + r, izq, arr - r])
        t.append([der, aba + r, der, arr - r])
        t.append([izq + r, arr, der - r, arr])
        t.append([izq + r, aba, der - r, aba])
        t.append([izq, arr - r, izq + r, arr])
        t.append([der - r, arr, der, arr - r])
        t.append([izq, aba + r, izq + r, aba])
        t.append([der - r, aba, der, aba + r])
    if c == "G":
        t.append([izq, aba + r, izq, arr - r])
        t.append([izq + r, arr, der - r, arr])
        t.append([izq + r, aba, der - r, aba])
        t.append([izq, arr - r, izq + r, arr])
        t.append([der - r, arr, der, arr - r * 0.6])
        t.append([izq, aba + r, izq + r, aba])
        t.append([der - r, aba, der, aba + r])
        t.append([der, aba + r, der, med * 0.95])
        t.append([W_L * 0.52, med * 0.95, der, med * 0.95])
    if c == "U":
        t.append([izq, arr, izq, aba + r])
        t.append([izq, aba + r, izq + r, aba])
        t.append([izq + r, aba, der - r, aba])
        t.append([der - r, aba, der, aba + r])
        t.append([der, aba + r, der, arr])
    if c == "E":
        t.append([izq, aba, izq, arr])
        t.append([izq, arr, der, arr])
        t.append([izq, med, der - 0.1, med])
        t.append([izq, aba, der, aba])
    if c == "R":
        t.append([izq, aba, izq, arr])
        t.append([izq, arr, der - r, arr])
        t.append([der - r, arr, der, arr - r])
        t.append([der, arr - r, der, med + r * 0.7])
        t.append([der, med + r * 0.7, der - r, med])
        t.append([der - r, med, izq, med])
        t.append([W_L * 0.45, med, der, aba])
    return t

def rotulo(prefijo, x_centro, y_cara, z_base, sentido):
    # sentido = +1: se lee de izquierda a derecha mirando desde Y negativo; -1 desde Y positivo
    texto = ["M", "O", "G", "U", "E", "R"]
    hueco = 0.24
    total = len(texto) * W_L + (len(texto) - 1) * hueco
    for n in range(len(texto)):
        c = texto[n]
        u0 = -total / 2 + n * (W_L + hueco)
        segs = trazos_letra(c)
        for j in range(len(segs)):
            g = segs[j]
            # Cada trazo se alarga medio grueso por cada lado para que las esquinas queden macizas
            du = g[2] - g[0]
            dv = g[3] - g[1]
            lt = math.sqrt(du * du + dv * dv)
            eu = du / lt * TRAZO / 2
            ev = dv / lt * TRAZO / 2
            a = (x_centro + sentido * (u0 + g[0] - eu), y_cara, z_base + g[1] - ev)
            b = (x_centro + sentido * (u0 + g[2] + eu), y_cara, z_base + g[3] + ev)
            barra(prefijo + "_" + c + str(n) + "_" + str(j), a, b, FONDO, TRAZO, m_rotulo)
    # Dos pletinas blancas detrás de las letras (las fijan a la celosía)
    for k in range(2):
        zz = z_base + 0.45 + k * 0.85
        caja(prefijo + "_Pletina_" + str(k), (x_centro, y_cara + sentido * 0.08, zz), (total + 0.6, 0.05, 0.08), m_acero)

rotulo("PM_RotuloS", 29.0, -(YC + 0.26), ZB + 0.25, 1)
rotulo("PM_RotuloN", 29.0, YC + 0.26, ZB + 0.25, -1)

# ==========================================
# 4. BARANDILLAS, ESCALERAS Y RAMPAS
# ==========================================
def baranda(prefijo, a, b, paso=2.0):
    # a, b: puntos del borde a la altura del suelo. Postes, pasamanos, rieles y malla
    dx = b[0] - a[0]
    dy = b[1] - a[1]
    dz = b[2] - a[2]
    largo = math.sqrt(dx * dx + dy * dy)
    n = math.floor(largo / paso) + 1
    for i in range(n + 1):
        f = i / n
        p = (a[0] + dx * f, a[1] + dy * f, a[2] + dz * f)
        tubo(prefijo + "_P" + str(i), p, (p[0], p[1], p[2] + 1.1), 0.035, m_acero, 6)
    tubo(prefijo + "_Pasa", (a[0], a[1], a[2] + 1.1), (b[0], b[1], b[2] + 1.1), 0.04, m_acero, 8)
    tubo(prefijo + "_Riel", (a[0], a[1], a[2] + 0.1), (b[0], b[1], b[2] + 0.1), 0.03, m_acero, 6)
    barra(prefijo + "_Malla", (a[0], a[1], a[2] + 0.58), (b[0], b[1], b[2] + 0.58), 0.02, 0.92, m_malla)

def losa(nombre, a, b, ancho):
    # Tablero de rampa o rellano entre los puntos del eje a y b (cota de pisada)
    barra(nombre, (a[0], a[1], a[2] - 0.09), (b[0], b[1], b[2] - 0.09), ancho, 0.18, m_rejilla)
    barra(nombre + "_Zanca", (a[0], a[1], a[2] - 0.32), (b[0], b[1], b[2] - 0.32), ancho * 0.6, 0.28, m_acero)

def rampa(prefijo, x0, x1, y, z0, z1, ancho, suelo, baranda_izq=True, baranda_der=True):
    losa(prefijo, (x0, y, z0), (x1, y, z1), ancho)
    w = ancho / 2
    if baranda_izq:
        baranda(prefijo + "_BI", (x0, y + w, z0), (x1, y + w, z1))
    if baranda_der:
        baranda(prefijo + "_BD", (x0, y - w, z0), (x1, y - w, z1))
    # Pilares cada ~6 m
    largo = abs(x1 - x0)
    n = math.floor(largo / 6.0)
    for i in range(1, n + 1):
        f = i / (n + 1)
        x = x0 + (x1 - x0) * f
        z = z0 + (z1 - z0) * f
        if z - 0.5 > suelo:
            tubo(prefijo + "_Pilar" + str(i), (x, y, suelo), (x, y, z - 0.45), 0.14, m_acero, 10)

def escalera(prefijo, x0, x1, y, z0, z1, ancho):
    # Escalera recta a lo largo de X entre (x0, z0) y (x1, z1), con zancas y peldaños de rejilla
    n = math.floor(abs(z1 - z0) / 0.18 + 0.5)
    w = ancho / 2
    for s in [-1, 1]:
        barra(prefijo + "_Zanca" + str(s), (x0, y + s * w, z0 - 0.15), (x1, y + s * w, z1 - 0.15), 0.1, 0.32, m_acero)
    for i in range(n):
        f = (i + 0.5) / n
        x = x0 + (x1 - x0) * f
        # Cada peldaño a la altura de su borde de subida
        z = z0 + (z1 - z0) * (i + 1) / n
        if z1 < z0:
            z = z0 + (z1 - z0) * i / n
        caja(prefijo + "_Peldano" + str(i), (x, y, z - 0.03), (abs(x1 - x0) / n + 0.02, ancho - 0.1, 0.05), m_rejilla)
    baranda(prefijo + "_BI", (x0, y + w, z0), (x1, y + w, z1), 1.5)
    baranda(prefijo + "_BD", (x0, y - w, z0), (x1, y - w, z1), 1.5)

# ------------------------------------------------------------------
# Lado del aparcamiento (X negativo): torre de acceso, escalera y rampa
# ------------------------------------------------------------------
XT0 = -3.6
XT1 = 0.0
for xx in [XT0, XT1]:
    for s in [-1, 1]:
        tubo("PM_TorrePilar_" + str(xx) + "_" + str(s), (xx, s * 1.9, 0.0), (xx, s * 1.9, 9.6), 0.3, m_acero, 14)
        caja("PM_TorreZapata_" + str(xx) + "_" + str(s), (xx, s * 1.9, 0.1), (0.9, 0.9, 0.2), m_horm)
    # Pórtico: dintel transversal arriba
    tubo("PM_TorreDintel_" + str(xx), (xx, -1.9, 9.45), (xx, 1.9, 9.45), 0.22, m_acero, 12)
for s in [-1, 1]:
    tubo("PM_TorreViga_" + str(s), (XT0, s * 1.9, 9.45), (XT1, s * 1.9, 9.45), 0.22, m_acero, 12)
    # Tornapuntas (la "Y" de las fotos) entre pilar y cordón superior
    tubo("PM_Tornapunta_" + str(s), (XT1, s * 1.9, 6.9), (XT1 + 1.4, s * YC, ZT), 0.1, m_acero)
    tubo("PM_TornapuntaB_" + str(s), (XT0, s * 1.9, 6.9), (XT0 - 0.2, s * 1.9, 9.2), 0.1, m_acero)
# Rellano de la torre (también da paso a la escalera al sur y a la rampa al norte)
caja("PM_RellanoTorre", ((XT0 + XT1) / 2, 0, ZB - 0.09), (XT1 - XT0 + 0.4, 6.8, 0.18), m_rejilla)
barra("PM_RellanoViga1", (XT0, -3.4, ZB - 0.3), (XT0, 3.4, ZB - 0.3), 0.18, 0.3, m_acero)
barra("PM_RellanoViga2", (XT1, -3.4, ZB - 0.3), (XT1, 3.4, ZB - 0.3), 0.18, 0.3, m_acero)
baranda("PM_RellanoBS", (XT0, -3.4, ZB), (XT1, -3.4, ZB))
baranda("PM_RellanoBN", (XT0, 3.4, ZB), (XT1, 3.4, ZB))
baranda("PM_RellanoBO", (XT0, -1.8, ZB), (XT0, 1.8, ZB))
baranda("PM_RellanoBES", (XT1, -3.4, ZB), (XT1, -1.6, ZB))
baranda("PM_RellanoBEN", (XT1, 1.6, ZB), (XT1, 3.4, ZB))

# Escalera de dos tramos hacia el aparcamiento (sur)
escalera("PM_EscIzq1", XT0, XT0 - 4.4, -2.6, ZB, 2.6, 1.6)
caja("PM_EscIzqRellano", (XT0 - 5.3, -2.6, 2.6 - 0.09), (1.8, 1.7, 0.18), m_rejilla)
for s in [-1, 1]:
    tubo("PM_EscIzqPilar" + str(s), (XT0 - 5.3, -2.6 + s * 0.7, 0), (XT0 - 5.3, -2.6 + s * 0.7, 2.4), 0.12, m_acero)
baranda("PM_EscIzqRellanoB", (XT0 - 4.4, -3.45, 2.6), (XT0 - 6.2, -3.45, 2.6))
escalera("PM_EscIzq2", XT0 - 6.2, XT0 - 10.4, -2.6, 2.6, 0.0, 1.6)

# Rampa accesible en zigzag (norte): tres tramos al 8 % con mesetas de giro
Y1 = 2.6
Y2 = 5.0
Y3 = 7.4
XR = XT0 - 18.0
rampa("PM_Rampa1", XT0, XR, Y1, ZB, 3.65, 1.6, 0.0)
losa("PM_Meseta1", (XR, (Y1 + Y2) / 2, 3.65), (XR - 2.4, (Y1 + Y2) / 2, 3.65), 4.0)
baranda("PM_Meseta1B", (XR - 2.4, Y1 - 0.8, 3.65), (XR - 2.4, Y2 + 0.8, 3.65))
baranda("PM_Meseta1BS", (XR, Y1 - 0.8, 3.65), (XR - 2.4, Y1 - 0.8, 3.65))
tubo("PM_Meseta1Pilar", (XR - 1.2, (Y1 + Y2) / 2, 0), (XR - 1.2, (Y1 + Y2) / 2, 3.2), 0.16, m_acero)
rampa("PM_Rampa2", XR, XT0, Y2, 3.65, 2.15, 1.6, 0.0)
losa("PM_Meseta2", (XT0, (Y2 + Y3) / 2, 2.15), (XT0 + 2.4, (Y2 + Y3) / 2, 2.15), 4.0)
baranda("PM_Meseta2B", (XT0 + 2.4, Y2 - 0.8, 2.15), (XT0 + 2.4, Y3 + 0.8, 2.15))
tubo("PM_Meseta2Pilar", (XT0 + 1.2, (Y2 + Y3) / 2, 0), (XT0 + 1.2, (Y2 + Y3) / 2, 1.7), 0.16, m_acero)
rampa("PM_Rampa3", XT0, XR, Y3, 2.15, 0.65, 1.6, 0.0)
rampa("PM_Rampa4", XR, XR - 8.0, Y3, 0.65, 0.02, 1.6, 0.0, True, True)

# ------------------------------------------------------------------
# Otro lado (X positivo): apoyos en V, rampa de salida y escalera recta
# ------------------------------------------------------------------
for s in [-1, 1]:
    y = s * YC
    tubo("PM_ApoyoV1_" + str(s), (L - 0.8, y, 1.5), (L - 2.6, y, ZB - 0.15), 0.18, m_acero, 12)
    tubo("PM_ApoyoV2_" + str(s), (L - 0.8, y, 1.5), (L + 1.0, y, ZB - 0.15), 0.18, m_acero, 12)
    caja("PM_ApoyoZapata_" + str(s), (L - 0.8, y, 1.55), (0.9, 0.9, 0.2), m_horm)
    # Pórtico del extremo (montantes más altos, como en las fotos)
    tubo("PM_PorticoFin_" + str(s), (L, y, ZT), (L, y, ZT + 0.6), R_CORDON, m_acero, 12)
tubo("PM_PorticoFinDintel", (L, -YC, ZT + 0.6), (L, YC, ZT + 0.6), 0.14, m_acero, 12)
# Rellano a la salida y pasarela en rampa suave hasta el terraplén
caja("PM_RellanoFin", (L + 2.0, 1.0, ZB - 0.09), (4.0, 5.0, 0.18), m_rejilla)
baranda("PM_RellanoFinBS", (L, -1.5, ZB), (L + 4.0, -1.5, ZB))
rampa("PM_RampaFin", L + 4.0, L + 48.0, 0.0, ZB, 1.52, 2.4, 1.5, True, True)
# Escalera recta que baja junto a la celosía (cara norte) hasta el terraplén
baranda("PM_RellanoFinBN", (L + 4.0, 3.5, ZB), (L, 3.5, ZB))
baranda("PM_RellanoFinBE", (L + 4.0, 1.2, ZB), (L + 4.0, 3.5, ZB))
escalera("PM_EscDer", L, L - 6.1, 2.65, ZB, 1.5, 1.4)
tubo("PM_EscDerPilar", (L + 2.0, 3.0, 1.5), (L + 2.0, 3.0, ZB - 0.2), 0.14, m_acero)
tubo("PM_EscDerPilar2", (L - 3.0, 2.65, 1.5), (L - 3.0, 2.65, 3.3), 0.12, m_acero)

# ==========================================
# 5. TERRENO: aparcamiento, trinchera con la carretera y terraplén
# ==========================================
X_MURO_O = 8.5
X_MURO_E = 25.5
Z_CALZADA = -3.5
caja("PM_Explanada", (-17.0, 0, -0.5), (51.0, 60.0, 1.0), m_suelo)
caja("PM_MuroOeste", (X_MURO_O + 0.25, 0, (Z_CALZADA + 0.0) / 2), (0.5, 60.0, 3.5), m_muro)
caja("PM_Calzada", ((X_MURO_O + X_MURO_E) / 2 + 0.25, 0, Z_CALZADA - 0.25), (X_MURO_E - X_MURO_O - 0.5, 60.0, 0.5), m_asfalto)
caja("PM_MuroEste", (X_MURO_E + 0.25, 0, (Z_CALZADA - 1.0) / 2), (0.5, 60.0, 2.5), m_muro)
# Talud de tierra roja entre el muro este y el terraplén
barra("PM_Talud", (X_MURO_E + 0.5, 0, -1.4), (40.0, 0, 1.1), 60.0, 0.8, m_tierra)
caja("PM_Terraplen", (68.0, 0, 0.5), (56.0, 60.0, 2.0), m_tierra)
caja("PM_Acera", (68.0, 0, 1.52), (56.0, 4.0, 0.06), m_horm)
# Marcas viales: bordes y eje discontinuo
for s in [-1, 1]:
    caja("PM_LineaBorde_" + str(s), (17.0 + s * 6.2, 0, Z_CALZADA + 0.01), (0.15, 60.0, 0.02), m_linea)
    # Biondas a los lados de la calzada
    caja("PM_Bionda_" + str(s), (17.0 + s * 7.3, 0, Z_CALZADA + 0.6), (0.06, 60.0, 0.32), m_bionda)
for i in range(7):
    caja("PM_LineaEje_" + str(i), (17.0, -27.0 + i * 9.0, Z_CALZADA + 0.01), (0.15, 4.5, 0.02), m_linea)
for i in range(16):
    y = -30.0 + i * 4.0
    for s in [-1, 1]:
        caja("PM_BiondaPoste_" + str(s) + "_" + str(i), (17.0 + s * 7.4, y, Z_CALZADA + 0.4), (0.1, 0.1, 0.8), m_bionda)

# Valla de barrotes al borde de la trinchera (lado del aparcamiento)
caja("PM_VallaPanel", (X_MURO_O - 0.1, 0, 0.6), (0.03, 60.0, 1.1), m_valla_panel)
tubo("PM_VallaPasa", (X_MURO_O - 0.1, -30, 1.15), (X_MURO_O - 0.1, 30, 1.15), 0.04, m_valla)
tubo("PM_VallaRiel", (X_MURO_O - 0.1, -30, 0.12), (X_MURO_O - 0.1, 30, 0.12), 0.03, m_valla)
for i in range(25):
    y = -30.0 + i * 2.5
    caja("PM_VallaPoste_" + str(i), (X_MURO_O - 0.1, y, 0.6), (0.06, 0.06, 1.2), m_valla)

# Cartel "Pol. Ind. Los Arroyos / C/ Castaño" junto a la valla
caja("PM_Cartel", (X_MURO_O - 0.3, -14.0, 1.55), (0.05, 2.2, 0.7), m_cartel)
caja("PM_CartelMarco", (X_MURO_O - 0.33, -14.0, 1.55), (0.03, 2.3, 0.78), m_negro)
for s in [-1, 1]:
    cilindro("PM_CartelPoste_" + str(s), (X_MURO_O - 0.35, -14.0 + s * 0.9, 0.8), 0.04, 1.6, m_bionda, 8)

# Farolas a lo largo de la carretera (ambos bordes) y del aparcamiento
def farola(nombre, x, y, z, hacia):
    tubo(nombre + "_Fuste", (x, y, z), (x, y, z + 9.0), 0.11, m_bionda, 8)
    tubo(nombre + "_Brazo", (x, y, z + 9.0), (x + hacia * 1.6, y, z + 9.3), 0.06, m_bionda, 6)
    caja(nombre + "_Luz", (x + hacia * 1.9, y, z + 9.25), (0.7, 0.3, 0.12), m_luz)

for i in range(4):
    y = -26.0 + i * 16.0
    farola("PM_FarolaO_" + str(i), X_MURO_O - 0.6, y + 4.0, 0.0, 1)
    farola("PM_FarolaE_" + str(i), 41.0, y, 1.5, -1)
farola("PM_FarolaParking", -14.0, -18.0, 0.0, 1)

# ==========================================
# 6. COCHES APARCADOS (como en las fotos) Y ENTORNO
# ==========================================
def coche(nombre, x, y, rumbo, mat):
    c = math.cos(rumbo)
    s = math.sin(rumbo)
    caja(nombre + "_Carroceria", (x, y, 0.62), (4.4, 1.85, 0.75), mat, rot=(0, 0, rumbo))
    caja(nombre + "_Cabina", (x - 0.25 * c, y - 0.25 * s, 1.25), (2.5, 1.65, 0.55), m_ventana, rot=(0, 0, rumbo))
    caja(nombre + "_Techo", (x - 0.25 * c, y - 0.25 * s, 1.54), (2.2, 1.55, 0.06), mat, rot=(0, 0, rumbo))
    ruedas = [[1.4, 0.88], [1.4, -0.88], [-1.35, 0.88], [-1.35, -0.88]]
    for i in range(4):
        r = ruedas[i]
        px = x + r[0] * c - r[1] * s
        py = y + r[0] * s + r[1] * c
        cilindro(nombre + "_Rueda" + str(i), (px, py, 0.36), 0.36, 0.26, m_negro, 12, rot=(math.pi / 2, 0, rumbo))

coche("PM_CocheGris", 0.5, -8.2, 0.12, m_coche_gris)
coche("PM_CocheAzul", 2.2, -10.6, 0.12, m_coche_azul)

def arbol(nombre, x, y, z, alto):
    cilindro(nombre + "_T", (x, y, z + alto * 0.25), 0.22, alto * 0.5, m_tronco, 7)
    esfera(nombre + "_C1", (x, y, z + alto * 0.65), alto * 0.32, m_hoja, (1.2, 1.0, 0.8))
    esfera(nombre + "_C2", (x + alto * 0.2, y + alto * 0.1, z + alto * 0.8), alto * 0.22, m_hoja)

arbol("PM_Olivo1", 36.0, 6.0, 1.5, 5.0)
arbol("PM_Olivo2", 52.0, -9.0, 1.5, 4.5)
arbol("PM_Arbol3", -20.0, -16.0, 0.0, 7.0)

def casa(nombre, x, y, ancho, fondo, alto, mira_sur):
    caja(nombre, (x, y, 1.5 + alto / 2), (ancho, fondo, alto), m_cal)
    caja(nombre + "_Pretil", (x, y, 1.5 + alto + 0.3), (ancho + 0.1, fondo + 0.1, 0.6), m_cal)
    caja(nombre + "_Alero", (x, y - mira_sur * (fondo / 2 - 0.6), 1.5 + alto + 0.05), (ancho + 0.2, 1.4, 0.15), m_teja)
    cara = y - mira_sur * (fondo / 2 + 0.03)
    caja(nombre + "_Puerta", (x - ancho * 0.25, cara, 1.5 + 1.1), (1.1, 0.08, 2.2), m_madera)
    caja(nombre + "_Ventana1", (x + ancho * 0.2, cara, 1.5 + 1.4), (1.2, 0.08, 1.3), m_ventana)
    caja(nombre + "_Ventana2", (x - ancho * 0.25, cara, 1.5 + alto - 1.4), (1.1, 0.08, 1.2), m_ventana)
    caja(nombre + "_Ventana3", (x + ancho * 0.2, cara, 1.5 + alto - 1.4), (1.1, 0.08, 1.2), m_ventana)

for i in range(7):
    casa("PM_Casa_" + str(i), 46.0 + i * 7.5, 24.5, 7.3, 9.0, 6.4, 1)
# Edificio de dos plantas con ventanas de arco, detrás de la escalera del extremo
caja("PM_Edificio", (66.0, 14.0, 1.5 + 4.2), (10.0, 18.0, 8.4), m_cal)
caja("PM_EdificioCornisa", (66.0, 14.0, 1.5 + 8.6), (10.4, 18.4, 0.4), m_cal)
for i in range(4):
    yy = 7.0 + i * 4.6
    caja("PM_EdificioVentanaB_" + str(i), (60.95, yy, 1.5 + 1.6), (0.08, 1.4, 2.4), m_ventana)
    caja("PM_EdificioVentanaA_" + str(i), (60.95, yy, 1.5 + 5.6), (0.08, 1.4, 2.2), m_ventana)
    cilindro("PM_EdificioArco_" + str(i), (60.95, yy, 1.5 + 6.7), 0.7, 0.08, m_ventana, 16, rot=(0, math.pi / 2, 0))
