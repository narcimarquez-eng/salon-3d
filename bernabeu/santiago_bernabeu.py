import bpy
import math

# COORD_MODE: Z_UP
# ==============================================================================
# ESTADIO SANTIAGO BERNABÉU (Madrid), tal como queda tras la remodelación 2019-2024
# ==============================================================================
# Partes: campo con franjas y líneas reglamentarias, porterías, banquillos, vallas LED,
# tres anfiteatros escalonados de butacas azul oscuro con escaleras y vomitorios, palcos
# acristalados, frentes LED, videomarcador 360° colgado de la cubierta, cubierta fija con
# sus cerchas (2 este-oeste y 4 norte-sur), cubierta retráctil abierta (dos paneles con
# 6 cerchas y 5 cojines cada uno, aparcados sobre los fondos), fachada de lamas de acero
# inoxidable con la "grieta" ondulada entre la piel superior y la intermedia, costillas,
# planta baja acristalada, plaza de la Castellana, calles y arbolado.
#
# Fuentes: Wikipedia (es) "Estadio Santiago Bernabéu"; ficha del proyecto en Construsoft BIM
# Awards 2021 (cubierta, fachada, Edificio Este); Colegio de Ingenieros de Caminos (fachada de
# 46.500 m² y 17.000 lamas de acero inoxidable); realmadrid.com (cubierta retráctil a 55 m).
# - De las fuentes: campo 105 x 68 m; cubierta fija 28.000 m² y retráctil 8.000 m² (aquí
#   72 x 108 m de hueco); 2 cerchas este-oeste de 177 m y 4 norte-sur de 144 m; paneles
#   retráctiles con 6 cerchas de 72,5 m y 5 cojines de 72 x 7 m; videomarcador de 6,5 m en
#   laterales y esquinas y 11 m en los fondos, inclinado 8°; Castellana al oeste, Padre Damián
#   al este; cubierta a ~55 m; butacas nuevas azul oscuro (prensa, 2023).
# - Aproximado: planta exterior (~206 x 245 m), número y altura de filas de cada anfiteatro,
#   forma exacta de la grieta y de las lamas (aquí 32 lamas en vez de 17.000), largo de los
#   carriles de la cubierta retráctil (se alargan para aparcar los paneles), calles y árboles.
# - Sin modelar: el Hipogeo bajo el campo, el interior (vestuarios, museo, skywalk) y los
#   escudos y rótulos.
#
# Texturas de internet (CC0), preparadas con bernabeu/preparar_texturas.py:
#   ambientCG Grass005 (césped, con franjas y líneas dibujadas), Metal009 (acero cepillado),
#   Metal049A (chapa blanca), Concrete034 y Concrete031 (hormigón);
#   Poly Haven Asphalt 02 (asfalto) y Large Grey Tiles (losas de las plazas).
#
# Ejes: X = oeste (-) a este (+), Y = sur (-) a norte (+), Z = altura. Medidas en metros.
# El campo va a lo largo de Y. La Castellana queda en X negativo.
# Los colores van en valores lineales, como en Blender (el visor los pasa a sRGB).
# ==============================================================================

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)

bpy.ops.render.set_engine(engine='BLENDER_EEVEE_NEXT', env_intensity=0.7, bloom=0.06)
bpy.ops.render.set_lighting(intensity=1.35, angle=40)
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

def material_imagen(nombre, mapa, metros, rugosidad=0.7, metalico=0.0):
    mat = material(nombre, (1.0, 1.0, 1.0, 1.0), rugosidad, metalico)
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

def cilindro(nombre, centro, radio, alto, mat, vertices=12, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radio, depth=alto, location=centro, rotation=rot)
    obj = bpy.context.active_object
    obj.name = nombre
    return asignar_mat(obj, mat)

def esfera(nombre, centro, radio, mat, escala=(1.0, 1.0, 1.0), segmentos=8, anillos=6):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segmentos, ring_count=anillos, radius=radio, location=centro)
    obj = bpy.context.active_object
    obj.name = nombre
    obj.scale = escala
    return asignar_mat(obj, mat)

def viga(nombre, a, b, grosor, mat):
    dx = b[0] - a[0]
    dy = b[1] - a[1]
    dz = b[2] - a[2]
    horiz = math.sqrt(dx * dx + dy * dy)
    largo = math.sqrt(horiz * horiz + dz * dz)
    centro = ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2)
    return caja(nombre, centro, (largo, grosor, grosor), mat, rot=(0, -math.atan2(dz, horiz), math.atan2(dy, dx)))

def celosia(prefijo, a, b, canto, paneles, mat, grosor=0.7):
    # Cercha Warren: cordón inferior a-b, cordón superior a +canto, montantes y diagonales
    viga(prefijo + "_Inf", a, b, grosor, mat)
    viga(prefijo + "_Sup", (a[0], a[1], a[2] + canto), (b[0], b[1], b[2] + canto), grosor, mat)
    for i in range(paneles + 1):
        f = i / paneles
        p = (a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2])
        viga(prefijo + "_M" + str(i), p, (p[0], p[1], p[2] + canto), grosor * 0.7, mat)
        if i < paneles:
            g = (i + 1) / paneles
            q = (a[0] + (b[0] - a[0]) * g, a[1] + (b[1] - a[1]) * g, a[2])
            if i % 2 == 0:
                viga(prefijo + "_D" + str(i), p, (q[0], q[1], q[2] + canto), grosor * 0.6, mat)
            else:
                viga(prefijo + "_D" + str(i), (p[0], p[1], p[2] + canto), q, grosor * 0.6, mat)

# ------------------------------------------------------------------------------
# Mallas propias (from_pydata): cada buffer es [vertices, caras]
# ------------------------------------------------------------------------------
def buffer():
    return [[], []]

def quad(buf, a, b, c, d):
    # Cara visible desde el lado en que a-b-c-d giran en sentido antihorario
    n = len(buf[0])
    buf[0].append(a)
    buf[0].append(b)
    buf[0].append(c)
    buf[0].append(d)
    buf[1].append((n, n + 1, n + 2, n + 3))

def malla(nombre, buf, mat):
    me = bpy.data.meshes.new(nombre)
    me.from_pydata(buf[0], [], buf[1])
    ob = bpy.data.objects.new(nombre, me)
    bpy.context.collection.objects.link(ob)
    ob.data.materials.append(mat)
    return ob

# ------------------------------------------------------------------------------
# Contorno del estadio: rectángulo de esquinas redondeadas desplazado R metros
# (lados rectos + esquinas circulares con los mismos centros: todas las curvas son paralelas)
# ------------------------------------------------------------------------------
HX = 28.0
HY = 46.0
S = []

def tramo_recto(x0, y0, x1, y1, nx, ny, n, lado):
    for j in range(n):
        f = j / n
        S.append([x0 + (x1 - x0) * f, y0 + (y1 - y0) * f, nx, ny, lado])

def tramo_esquina(cx, cy, a0, n):
    for j in range(n):
        a = math.radians(a0 + 90.0 * j / n)
        S.append([cx, cy, math.cos(a), math.sin(a), "C"])

tramo_recto(HX, -HY, HX, HY, 1.0, 0.0, 12, "E")
tramo_esquina(HX, HY, 0.0, 10)
tramo_recto(HX, HY, -HX, HY, 0.0, 1.0, 8, "N")
tramo_esquina(-HX, HY, 90.0, 10)
tramo_recto(-HX, HY, -HX, -HY, -1.0, 0.0, 12, "W")
tramo_esquina(-HX, -HY, 180.0, 10)
tramo_recto(-HX, -HY, HX, -HY, 0.0, -1.0, 8, "S")
tramo_esquina(HX, -HY, 270.0, 10)
N = len(S)

def P(k, R, z):
    s = S[k % N]
    return (s[0] + R * s[2], s[1] + R * s[3], z)

def rumbo(k):
    s = S[k % N]
    return math.atan2(s[3], s[2])

def anillo_arriba(buf, R0, R1, z0, z1):
    # Superficie que mira hacia arriba entre R0 (dentro, altura z0) y R1 (fuera, z1)
    for k in range(N):
        quad(buf, P(k, R0, z0), P(k, R1, z1), P(k + 1, R1, z1), P(k + 1, R0, z0))

def anillo_abajo(buf, R0, R1, z0, z1):
    for k in range(N):
        quad(buf, P(k, R0, z0), P(k + 1, R0, z0), P(k + 1, R1, z1), P(k, R1, z1))

def pared_dentro(buf, R, z0, z1):
    # Pared vertical que mira hacia el campo
    for k in range(N):
        quad(buf, P(k, R, z0), P(k, R, z1), P(k + 1, R, z1), P(k + 1, R, z0))

def pared_fuera(buf, R, z0, z1):
    for k in range(N):
        quad(buf, P(k, R, z0), P(k + 1, R, z0), P(k + 1, R, z1), P(k, R, z1))

# ==========================================
# 1. MATERIALES
# ==========================================
m_campo = material_imagen("BB_Campo", "bb_campo", 130.0, 0.9)
m_butaca = material("BB_Butaca", (0.006, 0.014, 0.058, 1.0), 0.4, barniz=0.3)
m_respaldo = material_imagen("BB_Respaldo", "bb_butacas", 0.5, 0.45)
m_horm = material_imagen("BB_Hormigon", "bb_hormigon", 4.0, 0.85)
m_horm_gris = material_imagen("BB_HormigonGris", "bb_hormigon_gris", 5.0, 0.9)
m_acero = material_imagen("BB_AceroInox", "bb_acero", 3.0, 0.32, 0.85)
m_cubierta = material_imagen("BB_Cubierta", "bb_cubierta", 6.0, 0.5, 0.2)
m_estruct = material("BB_EstructuraBlanca", (0.62, 0.64, 0.66, 1.0), 0.45, 0.35)
m_vidrio = material("BB_VidrioOscuro", (0.010, 0.016, 0.024, 1.0), 0.08, 0.5, barniz=1.0)
m_interior = material("BB_Interior", (0.018, 0.018, 0.02, 1.0), 0.9)
# Videomarcador: imagen de paneles de vídeo con un brillo azul suave (con brillo alto se ve blanco)
m_pantalla = material_imagen("BB_Videomarcador", "bb_pantalla", 24.0, 0.35)
bsdf_vm = m_pantalla.node_tree.nodes.get("Principled BSDF")
bsdf_vm.inputs["Emission Color"].default_value = (0.05, 0.10, 0.35, 1.0)
bsdf_vm.inputs["Emission Strength"].default_value = 0.6
m_pantalla2 = material("BB_VideomarcadorBlanco", (0.75, 0.80, 0.95, 1.0), 0.3, emision=0.7)
m_led = material("BB_LED", (0.04, 0.10, 0.55, 1.0), 0.3, emision=2.2)
m_red = material("BB_Red", (0.95, 0.95, 0.95, 1.0), 0.6, alfa=0.35)
m_blanco = material("BB_Blanco", (0.85, 0.85, 0.85, 1.0), 0.35)
m_asfalto = material_imagen("BB_Asfalto", "bb_asfalto", 8.0, 0.9)
m_losa = material_imagen("BB_Losa", "bb_losa", 3.0, 0.8)
m_hoja = material("BB_Hoja", (0.025, 0.065, 0.018, 1.0), 0.8)
m_tronco = material("BB_Tronco", (0.05, 0.03, 0.016, 1.0), 0.9)
m_seto = material("BB_Cesped", (0.035, 0.085, 0.02, 1.0), 0.9)
m_seto.texture = "grass_meadow"
m_cojin = material("BB_CojinETFE", (0.72, 0.75, 0.78, 1.0), 0.2, 0.1, barniz=0.8)

# ==========================================
# 2. CAMPO
# ==========================================
caja("BB_Campo", (0, 0, 0.0), (80.0, 117.0, 0.12), m_campo)

# Porterías (7,32 x 2,44 m) en los fondos norte y sur
for s in [-1, 1]:
    yl = s * 52.5
    for t in [-1, 1]:
        cilindro("BB_Poste_" + str(s) + "_" + str(t), (t * 3.66, yl, 1.22), 0.06, 2.44, m_blanco, 10)
    cilindro("BB_Larguero_" + str(s), (0, yl, 2.44), 0.06, 7.44, m_blanco, 10, rot=(0, math.pi / 2, 0))
    caja("BB_RedFondo_" + str(s), (0, yl + s * 2.0, 1.2), (7.32, 0.04, 2.4), m_red)
    caja("BB_RedTecho_" + str(s), (0, yl + s * 1.0, 2.42), (7.32, 2.0, 0.04), m_red)
    for t in [-1, 1]:
        caja("BB_RedLado_" + str(s) + "_" + str(t), (t * 3.66, yl + s * 1.0, 1.2), (0.04, 2.0, 2.4), m_red)
    # Banderines de córner
    for t in [-1, 1]:
        cilindro("BB_Banderin_" + str(s) + "_" + str(t), (t * 34.0, yl, 0.75), 0.025, 1.5, m_blanco, 6)
        caja("BB_Bandera_" + str(s) + "_" + str(t), (t * 34.0 + t * 0.2, yl, 1.35), (0.4, 0.02, 0.3), m_pantalla2)

# Vallas LED alrededor del campo
caja("BB_VallaE", (37.6, 0, 0.45), (0.25, 104.0, 0.9), m_led)
caja("BB_VallaW1", (-37.6, -32, 0.45), (0.25, 40.0, 0.9), m_led)
caja("BB_VallaW2", (-37.6, 32, 0.45), (0.25, 40.0, 0.9), m_led)
for s in [-1, 1]:
    caja("BB_VallaFondo_" + str(s), (0, s * 56.8, 0.45), (66.0, 0.25, 0.9), m_led)

# Banquillos y túnel de vestuarios en la banda oeste (tribuna de la Castellana)
for s in [-1, 1]:
    caja("BB_BanquilloBase_" + str(s), (-38.2, s * 8.0, 0.25), (2.2, 14.0, 0.5), m_horm_gris)
    caja("BB_BanquilloAsientos_" + str(s), (-38.6, s * 8.0, 0.8), (1.2, 13.6, 0.6), m_butaca)
    caja("BB_BanquilloCubierta_" + str(s), (-37.9, s * 8.0, 2.1), (2.8, 14.2, 0.08), m_red)
    caja("BB_BanquilloTrasera_" + str(s), (-39.3, s * 8.0, 1.2), (0.08, 14.2, 1.8), m_red)
caja("BB_TunelSuelo", (-37.5, 0, 0.03), (5.0, 4.0, 0.06), m_horm_gris)
caja("BB_TunelBoca", (-39.9, 0, 1.4), (0.3, 4.0, 2.8), m_interior)
caja("BB_TunelMarco", (-39.75, 0, 2.95), (0.4, 4.6, 0.35), m_acero)

# ==========================================
# 3. GRADAS (tres anfiteatros escalonados)
# ==========================================
# Huellas: asientos azul oscuro. Contrahuellas: franja baja de hormigón y respaldos de butaca.
b_butacas = buffer()
b_contra = buffer()
b_respaldo = buffer()
b_frente = buffer()
b_led = buffer()
b_bajo = buffer()
b_vidrio = buffer()
b_escalera = buffer()

def grada(R0, z0, filas, d, h, z_frente):
    for k in range(N):
        for r in range(filas):
            Ra = R0 + r * d
            Rb = Ra + d
            za = z0 + r * h
            zb = za + h
            zm = za + h * 0.3
            quad(b_contra, P(k, Ra, za), P(k, Ra, zm), P(k + 1, Ra, zm), P(k + 1, Ra, za))
            quad(b_respaldo, P(k, Ra, zm), P(k, Ra, zb), P(k + 1, Ra, zb), P(k + 1, Ra, zm))
            quad(b_butacas, P(k, Ra, zb), P(k, Rb, zb), P(k + 1, Rb, zb), P(k + 1, Ra, zb))
    # Frente del anfiteatro (canto de la losa y antepecho)
    pared_dentro(b_frente, R0, z_frente, z0)
    # Escaleras: franjas claras desde el frente hasta la última fila, cada 4 tramos
    Rf = R0 + filas * d
    zf = z0 + filas * h
    for k in range(N):
        if k % 4 == 2:
            s = S[k]
            # vector tangente (perpendicular a la normal)
            tx = -s[3]
            ty = s[2]
            w = 0.6
            a = P(k, R0, z0 + h + 0.06)
            b = P(k, Rf, zf + 0.06)
            quad(b_escalera, (a[0] - tx * w, a[1] - ty * w, a[2]), (b[0] - tx * w, b[1] - ty * w, b[2]), (b[0] + tx * w, b[1] + ty * w, b[2]), (a[0] + tx * w, a[1] + ty * w, a[2]))
    return [Rf, zf]

# Primer anfiteatro (grada baja)
g1 = grada(12.0, 1.1, 26, 0.8, 0.36, 0.0)
# Palcos acristalados detrás de la grada baja
pared_dentro(b_vidrio, 33.4, g1[1], 12.6)
anillo_arriba(b_frente, g1[0], 33.4, g1[1], g1[1])

# Segundo anfiteatro
g2 = grada(31.0, 14.4, 18, 0.82, 0.5, 12.6)
pared_dentro(b_led, 30.95, 12.9, 14.0)
anillo_abajo(b_bajo, 31.0, g2[0], 12.6, g2[1] - 2.2)
pared_dentro(b_vidrio, 46.3, g2[1], 25.2)
anillo_arriba(b_frente, g2[0], 46.3, g2[1], g2[1])

# Tercer anfiteatro (la grada alta)
g3 = grada(44.0, 27.0, 28, 0.85, 0.6, 25.2)
pared_dentro(b_led, 43.95, 25.5, 26.6)
anillo_abajo(b_bajo, 44.0, g3[0], 25.2, g3[1] - 2.4)
# Pared del fondo: corredor superior acristalado (skywalk) bajo la cubierta
anillo_arriba(b_frente, g3[0], 68.4, g3[1], g3[1])
pared_dentro(b_frente, 68.4, g3[1], 46.6)
pared_dentro(b_vidrio, 68.4, 46.6, 50.2)
pared_dentro(b_frente, 68.4, 50.2, 56.0)

malla("BB_Butacas", b_butacas, m_butaca)
malla("BB_Contrahuellas", b_contra, m_horm)
malla("BB_Respaldos", b_respaldo, m_respaldo)
malla("BB_FrentesGrada", b_frente, m_horm_gris)
malla("BB_FrentesLED", b_led, m_led)
malla("BB_BajoGradas", b_bajo, m_horm_gris)
malla("BB_Palcos", b_vidrio, m_vidrio)
malla("BB_Escaleras", b_escalera, m_horm)

# Vomitorios (bocas de acceso) en la grada baja y en la alta
for k in range(N):
    if k % 4 == 0:
        rz = rumbo(k)
        p = P(k, 12.0 + 14 * 0.8, 1.1 + 14 * 0.36 + 0.9)
        caja("BB_Vomitorio1_" + str(k), p, (3.2, 2.6, 1.8), m_interior, rot=(0, 0, rz))
        q = P(k, 44.0 + 12 * 0.85, 27.0 + 12 * 0.6 + 1.1)
        caja("BB_Vomitorio3_" + str(k), q, (3.4, 2.6, 2.2), m_interior, rot=(0, 0, rz))

# Palco de honor en el centro de la tribuna oeste (frente acristalado más alto)
caja("BB_PalcoHonor", (-HX - 33.0, 0, 12.0), (0.6, 22.0, 2.6), m_vidrio)
caja("BB_PalcoHonorMarco", (-HX - 32.8, 0, 13.45), (0.9, 22.6, 0.3), m_acero)

# ==========================================
# 4. CUBIERTA FIJA Y SUS CERCHAS
# ==========================================
R_HUECO = 8.0
R_TEJADO = 76.5

def z_tejado(R):
    return 55.8 + 1.7 * (R - R_HUECO) / (R_TEJADO - R_HUECO)

b_tejado = buffer()
anillos = [R_HUECO, 20.0, 34.0, 48.0, 62.0, R_TEJADO]
for i in range(len(anillos) - 1):
    Ra = anillos[i]
    Rb = anillos[i + 1]
    anillo_arriba(b_tejado, Ra, Rb, z_tejado(Ra), z_tejado(Rb))
    anillo_abajo(b_tejado, Ra, Rb, z_tejado(Ra) - 0.45, z_tejado(Rb) - 0.45)
pared_dentro(b_tejado, R_HUECO, z_tejado(R_HUECO) - 0.45, z_tejado(R_HUECO))
malla("BB_CubiertaFija", b_tejado, m_cubierta)

# Anillo de focos bajo el borde interior de la cubierta (iluminación del campo)
b_focos = buffer()
anillo_abajo(b_focos, 11.0, 12.6, z_tejado(11.0) - 0.6, z_tejado(12.6) - 0.6)
malla("BB_Focos", b_focos, m_pantalla2)
for k in range(N):
    p = P(k, 11.8, z_tejado(11.8) - 0.5)
    caja("BB_FocoCaja_" + str(k), p, (1.8, 1.4, 0.3), m_acero, rot=(0, 0, rumbo(k)))

# Nervios radiales de la cubierta (líneas que se ven desde el aire)
for k in range(N):
    if k % 2 == 0:
        a = P(k, R_HUECO + 0.5, z_tejado(R_HUECO + 0.5) + 0.15)
        b = P(k, R_TEJADO - 0.5, z_tejado(R_TEJADO - 0.5) + 0.15)
        viga("BB_Nervio_" + str(k), a, b, 0.35, m_estruct)

# Dos grandes cerchas este-oeste (177 m) en los extremos del hueco
for s in [-1, 1]:
    celosia("BB_CerchaEO_" + str(s), (-88.5, s * 60.0, 49.5), (88.5, s * 60.0, 49.5), 5.6, 30, m_estruct, 0.9)
# Cuatro cerchas norte-sur (144 m): las interiores son los carriles de la cubierta retráctil,
# sobresalen por encima del tejado y se alargan para aparcar los paneles sobre los fondos
for t in [-1, 1]:
    celosia("BB_CerchaNSext_" + str(t), (t * 64.0, -72.0, 50.5), (t * 64.0, 72.0, 50.5), 5.2, 24, m_estruct, 0.8)
    celosia("BB_Carril_" + str(t), (t * 36.6, -100.0, 53.0), (t * 36.6, 100.0, 53.0), 6.0, 32, m_estruct, 0.8)
    viga("BB_CarrilRail_" + str(t), (t * 36.6, -100.0, 59.3), (t * 36.6, 100.0, 59.3), 0.6, m_acero)

# Cubierta retráctil abierta: dos paneles aparcados sobre los fondos norte y sur
for s in [-1, 1]:
    for i in range(6):
        y = s * (56.0 + i * 8.6)
        caja("BB_RetCercha_" + str(s) + "_" + str(i), (0, y, 61.0), (73.6, 1.3, 2.8), m_estruct)
        caja("BB_RetBogie_" + str(s) + "_" + str(i) + "a", (36.6, y, 59.9), (1.6, 2.4, 1.0), m_acero)
        caja("BB_RetBogie_" + str(s) + "_" + str(i) + "b", (-36.6, y, 59.9), (1.6, 2.4, 1.0), m_acero)
        if i < 5:
            caja("BB_RetCojin_" + str(s) + "_" + str(i), (0, y + s * 4.3, 61.9), (72.0, 7.2, 0.9), m_cojin)

# ==========================================
# 5. VIDEOMARCADOR 360° (tronco de cono colgado del borde de la cubierta)
# ==========================================
b_pant = buffer()
b_pant2 = buffer()
b_pant_atras = buffer()
R_VM = 9.5
Z_VM = 51.2
inclin = math.tan(math.radians(8.0))

def alto_vm(k):
    lado = S[k % N][4]
    if lado == "N":
        return 11.0
    if lado == "S":
        return 11.0
    return 6.5

for k in range(N):
    h0 = alto_vm(k)
    h1 = alto_vm(k + 1)
    # Al pasar de fondo (11 m) a esquina (6,5 m) se toma el menor para no dejar picos
    if h0 != h1:
        h0 = 6.5
        h1 = 6.5
    ta = P(k, R_VM, Z_VM)
    tb = P(k + 1, R_VM, Z_VM)
    ma = P(k, R_VM - 1.2 * inclin, Z_VM - 1.2)
    mb = P(k + 1, R_VM - 1.2 * inclin, Z_VM - 1.2)
    ba = P(k, R_VM - h0 * inclin, Z_VM - h0)
    bb = P(k + 1, R_VM - h1 * inclin, Z_VM - h1)
    # Pantalla que mira a las gradas: franja superior blanca y cuerpo azul
    quad(b_pant2, ma, mb, tb, ta)
    quad(b_pant, ba, bb, mb, ma)
    # Trasera (mira al centro) y canto inferior
    ia = P(k, R_VM - 1.0, Z_VM)
    ib = P(k + 1, R_VM - 1.0, Z_VM)
    ja = P(k, R_VM - 1.0 - h0 * inclin, Z_VM - h0)
    jb = P(k + 1, R_VM - 1.0 - h1 * inclin, Z_VM - h1)
    quad(b_pant_atras, ia, ib, jb, ja)
    quad(b_pant_atras, ja, jb, bb, ba)
    quad(b_pant_atras, ta, tb, ib, ia)
malla("BB_Videomarcador", b_pant, m_pantalla)
malla("BB_VideomarcadorFranja", b_pant2, m_pantalla2)
malla("BB_VideomarcadorTrasera", b_pant_atras, m_interior)
for k in range(N):
    if k % 5 == 0:
        a = P(k, R_VM - 0.5, Z_VM)
        viga("BB_Tirante_" + str(k), a, (a[0], a[1], z_tejado(R_VM) - 0.45), 0.3, m_estruct)

# ==========================================
# 6. FACHADA: lamas de acero inoxidable, grieta ondulada y planta baja acristalada
# ==========================================
def R_fachada(z):
    # La piel se abre hacia fuera al subir, hasta el borde de la cubierta
    return 73.0 + 3.5 * math.sin(math.pi * 0.5 * (z - 10.0) / 47.5)

def z_grieta(k):
    p = P(k, 75.0, 0)
    th = math.atan2(p[1], p[0])
    return 40.0 + 5.0 * math.sin(2.0 * th + 0.8) + 1.5 * math.sin(3.0 * th)

b_lamas = buffer()
b_muro = buffer()
N_MEDIA = 28
N_ALTA = 13

def lamas(k, z_lo_k, z_lo_k1, z_hi_k, z_hi_k1, n):
    for i in range(n):
        f0 = i / n
        f1 = (i + 0.58) / n
        za0 = z_lo_k + (z_hi_k - z_lo_k) * f0
        za1 = z_lo_k + (z_hi_k - z_lo_k) * f1
        zb0 = z_lo_k1 + (z_hi_k1 - z_lo_k1) * f0
        zb1 = z_lo_k1 + (z_hi_k1 - z_lo_k1) * f1
        quad(b_lamas, P(k, R_fachada(za0) + 0.7, za0), P(k + 1, R_fachada(zb0) + 0.7, zb0), P(k + 1, R_fachada(zb1), zb1), P(k, R_fachada(za1), za1))

for k in range(N):
    g0 = z_grieta(k)
    g1 = z_grieta(k + 1)
    lamas(k, 10.2, 10.2, g0 - 1.3, g1 - 1.3, N_MEDIA)
    lamas(k, g0 + 1.3, g1 + 1.3, 57.4, 57.4, N_ALTA)
    # Muro interior oscuro detrás de las lamas
    zs = [9.6, 20.0, 30.0, 40.0, 50.0, 57.6]
    for j in range(len(zs) - 1):
        za = zs[j]
        zb = zs[j + 1]
        quad(b_muro, P(k, R_fachada(za) - 1.8, za), P(k + 1, R_fachada(za) - 1.8, za), P(k + 1, R_fachada(zb) - 1.8, zb), P(k, R_fachada(zb) - 1.8, zb))
malla("BB_FachadaLamas", b_lamas, m_acero)
malla("BB_FachadaMuro", b_muro, m_vidrio)

# Remate de la cubierta sobre la fachada (canto de acero)
b_canto = buffer()
pared_fuera(b_canto, R_TEJADO + 0.15, 56.9, z_tejado(R_TEJADO) + 0.25)
anillo_arriba(b_canto, R_TEJADO - 1.0, R_TEJADO + 0.15, z_tejado(R_TEJADO) + 0.25, z_tejado(R_TEJADO) + 0.25)
malla("BB_CantoCubierta", b_canto, m_acero)

# Costillas de acero que sostienen las lamas, en los ejes del estadio
for k in range(N):
    if k % 4 == 1:
        zs = [10.0, 22.0, 34.0, 46.0, 57.4]
        for j in range(len(zs) - 1):
            a = P(k, R_fachada(zs[j]) - 0.5, zs[j])
            b = P(k, R_fachada(zs[j + 1]) - 0.5, zs[j + 1])
            viga("BB_Costilla_" + str(k) + "_" + str(j), a, b, 0.55, m_acero)

# Planta baja: vidrio, alero de acero, pilares y puertas
b_pb = buffer()
pared_fuera(b_pb, 71.0, 0.0, 9.6)
malla("BB_PlantaBajaVidrio", b_pb, m_vidrio)
b_alero = buffer()
anillo_abajo(b_alero, 70.8, R_fachada(10.2) + 0.7, 9.6, 10.2)
pared_fuera(b_alero, R_fachada(10.2) + 0.7, 9.9, 10.4)
malla("BB_Alero", b_alero, m_acero)
for k in range(N):
    if k % 2 == 1:
        p = P(k, 72.4, 4.8)
        cilindro("BB_Pilar_" + str(k), p, 0.45, 9.6, m_horm, 10)
    if k % 10 == 5:
        rz = rumbo(k)
        p = P(k, 71.2, 2.0)
        caja("BB_Puerta_" + str(k), p, (0.5, 9.0, 4.0), m_interior, rot=(0, 0, rz))
        q = P(k, 71.5, 4.25)
        caja("BB_PuertaDintel_" + str(k), q, (0.6, 9.6, 0.5), m_acero, rot=(0, 0, rz))

# ==========================================
# 7. ENTORNO: plazas, Castellana, calles y arbolado
# ==========================================
# Plaza que rodea el estadio (incluye la gran plaza de la Castellana al oeste)
caja("BB_Plaza", (-5.0, 0, -0.15), (254.0, 262.0, 0.3), m_losa)
# Paseo de la Castellana (oeste): lateral, mediana, calzada central, mediana, lateral
caja("BB_CastellanaLateralE", (-137.0, 0, -0.17), (10.0, 300.0, 0.3), m_asfalto)
caja("BB_CastellanaMedianaE", (-144.5, 0, -0.05), (5.0, 300.0, 0.3), m_seto)
caja("BB_CastellanaCentral", (-157.0, 0, -0.17), (20.0, 300.0, 0.3), m_asfalto)
caja("BB_CastellanaMedianaW", (-169.5, 0, -0.05), (5.0, 300.0, 0.3), m_seto)
caja("BB_CastellanaLateralW", (-177.0, 0, -0.17), (10.0, 300.0, 0.3), m_asfalto)
caja("BB_AceraW", (-186.0, 0, -0.1), (8.0, 300.0, 0.3), m_losa)
for i in range(25):
    y = -144.0 + i * 12.0
    for j in range(3):
        caja("BB_RayaCastellana_" + str(i) + "_" + str(j), (-152.0 + j * 5.0, y, 0.0), (0.15, 4.0, 0.04), m_blanco)
# Concha Espina (sur), Padre Damián (este) y Rafael Salgado (norte, peatonal)
caja("BB_ConchaEspina", (-5.0, -140.0, -0.17), (254.0, 16.0, 0.3), m_asfalto)
caja("BB_PadreDamian", (129.0, 0, -0.17), (14.0, 296.0, 0.3), m_asfalto)
caja("BB_RafaelSalgado", (-5.0, 137.0, -0.1), (254.0, 12.0, 0.3), m_losa)
for i in range(20):
    x = -122.0 + i * 12.0
    caja("BB_RayaConcha_" + str(i), (x, -140.0, 0.0), (4.0, 0.15, 0.04), m_blanco)
    y = -138.0 + i * 14.0
    caja("BB_RayaDamian_" + str(i), (129.0, y, 0.0), (0.15, 4.0, 0.04), m_blanco)

def arbol(nombre, x, y, alto):
    cilindro(nombre + "_T", (x, y, alto * 0.3), 0.25, alto * 0.6, m_tronco, 6)
    esfera(nombre + "_C", (x, y, alto * 0.72), alto * 0.32, m_hoja, (1.0, 1.0, 0.85))

for i in range(21):
    y = -150.0 + i * 15.0
    arbol("BB_ArbolCastE_" + str(i), -144.5, y, 11.0)
    arbol("BB_ArbolCastW_" + str(i), -169.5, y + 7.0, 12.0)
# Jardín de la esquina (antiguo centro comercial) y plaza de Sagrados Corazones al este
for i in range(9):
    arbol("BB_ArbolEste_" + str(i), 116.0, -80.0 + i * 20.0, 9.0)
for i in range(6):
    arbol("BB_ArbolJardin_" + str(i), 92.0 + (i % 3) * 9.0, 104.0 + math.floor(i / 3) * 9.0, 8.0)
caja("BB_Jardin", (101.0, 108.0, 0.02), (32.0, 20.0, 0.1), m_seto)

# Tráfico en la Castellana y en Concha Espina (coches sencillos de varios colores)
colores = [(0.6, 0.6, 0.62, 1.0), (0.02, 0.02, 0.025, 1.0), (0.35, 0.02, 0.02, 1.0), (0.02, 0.06, 0.2, 1.0), (0.8, 0.8, 0.78, 1.0)]
m_coches = []
for i in range(len(colores)):
    m_coches.append(material("BB_Coche_" + str(i), colores[i], 0.25, 0.6, barniz=1.0))
carriles = [-138.0, -149.5, -154.5, -159.5, -164.5, -175.0]
for i in range(26):
    c = carriles[i % 6]
    y = -135.0 + ((i * 37) % 270)
    mc = m_coches[(i * 3) % 5]
    caja("BB_Coche_" + str(i), (c, y, 0.65), (1.8, 4.4, 0.9), mc)
    caja("BB_CocheCabina_" + str(i), (c, y - 0.2, 1.35), (1.6, 2.3, 0.6), m_vidrio)
for i in range(10):
    x = -115.0 + ((i * 53) % 230)
    yy = -137.0
    if i % 2 == 1:
        yy = -143.0
    caja("BB_CocheConcha_" + str(i), (x, yy, 0.65), (4.4, 1.8, 0.9), m_coches[i % 5])
    caja("BB_CocheConchaCabina_" + str(i), (x + 0.2, yy, 1.35), (2.3, 1.6, 0.6), m_vidrio)

# Boca de metro en la plaza de la Castellana (escalera bajo marquesina de vidrio)
caja("BB_MetroMuro1", (-120.0, -60.0, 0.5), (12.0, 0.3, 1.0), m_acero)
caja("BB_MetroMuro2", (-120.0, -56.0, 0.5), (12.0, 0.3, 1.0), m_acero)
caja("BB_MetroHueco", (-120.0, -58.0, 0.02), (11.6, 3.7, 0.06), m_interior)
caja("BB_MetroMarquesina", (-122.0, -58.0, 3.0), (6.0, 4.6, 0.1), m_red)
cilindro("BB_MetroPoste", (-125.5, -60.6, 1.6), 0.08, 3.2, m_acero, 6)
caja("BB_MetroCartel", (-125.5, -60.6, 3.4), (0.15, 1.0, 1.0), m_pantalla2)

# Farolas a lo largo de la plaza de la Castellana
for i in range(11):
    y = -100.0 + i * 20.0
    cilindro("BB_Farola_" + str(i), (-126.0, y, 4.5), 0.12, 9.0, m_acero, 6)
    caja("BB_FarolaLuz_" + str(i), (-125.4, y, 9.0), (1.4, 0.4, 0.2), m_pantalla2)
