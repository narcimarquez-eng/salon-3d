import bpy
import math

# COORD_MODE: Z_UP
# ==============================================================================
# NUEVO CAMP NOU (FC Barcelona, Les Corts) — modelo aproximado del proyecto de reforma
# ==============================================================================
# Qué es: el estadio con la reforma del proyecto ganador (Nikken Sekkei + Pascual i Ausió):
# anillos de gradas escalonadas, fachada abierta en tres anillos y cubierta traslúcida
# sobre todo el aforo.
# Fuentes: web del FC Barcelona ("Així serà el Futur Camp Nou") y prensa sobre el concurso.
#   - Aforo proyectado: unos 105.000 espectadores, todo cubierto.
#   - Cubierta: unos 45.000-47.000 m2, semitransparente (ETFE en la propuesta de 2016).
#   - Altura máxima: unos 48 m (solo lo dice una fuente, sin confirmar).
#   - Campo: 105 x 68 m (medidas reglamentarias).
# APROXIMADO: la planta real es más rectangular, con esquinas redondeadas; aquí es una
# elipse. El número de gradas, columnas, cristal de la fachada y el interior son estimaciones.
# Sin fotos o planos oficiales no hay detalle fino.
# Ejes: X = ancho (lado a lado), Y = profundidad, Z = altura. 1 unidad = 1 metro.
# ==============================================================================

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)

# Motor de render del visor
bpy.ops.render.set_engine(engine='BLENDER_EEVEE_NEXT', env_intensity=0.6, bloom=0.05)
bpy.ops.render.set_lighting(intensity=1.3, angle=35)
bpy.ops.render.set_ssao(intensity=1.2)

K = 0.78    # relación entre el radio en Y y en X (planta ovalada)
N = 96      # segmentos por anillo: 8 sectores de 12

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

def cilindro(nombre, centro, radio, alto, mat, vertices=12, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radio, depth=alto, location=centro, rotation=rot)
    obj = bpy.context.active_object
    obj.name = nombre
    return asignar_mat(obj, mat)

def aro(nombre, centro, radio, grosor, mat, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_torus_add(major_radius=radio, minor_radius=grosor, location=centro, rotation=rot)
    obj = bpy.context.active_object
    obj.name = nombre
    return asignar_mat(obj, mat)

def anillo_plano(prefijo, z, a, w, grosor, mats):
    # Anillo horizontal (escalón de grada, cubierta): va desde el radio a hasta a + w en X,
    # y en Y el radio es K veces ese. Cada tramo es una caja tangente a la elipse.
    ar = a + w / 2
    br = ar * K
    perim = math.pi * (3 * (ar + br) - math.sqrt((3 * ar + br) * (ar + 3 * br)))
    seg = perim / N * 1.12
    for s in range(8):
        for j in range(12):
            i = s * 12 + j
            t = 2 * math.pi * i / N
            x = ar * math.cos(t)
            y = br * math.sin(t)
            ang = math.atan2(br * math.cos(t), -ar * math.sin(t))
            caja(prefijo + "_" + str(i), (x, y, z), (seg, w, grosor), mats[s], rot=(0, 0, ang))

def anillo_vertical(prefijo, z0, z1, a, grosor, mats):
    # Pared en anillo (contrahuella, fachada) entre z0 y z1, sobre la elipse de radio a.
    ar = a
    br = ar * K
    perim = math.pi * (3 * (ar + br) - math.sqrt((3 * ar + br) * (ar + 3 * br)))
    seg = perim / N * 1.12
    alto = z1 - z0
    zc = (z0 + z1) / 2
    for s in range(8):
        for j in range(12):
            i = s * 12 + j
            t = 2 * math.pi * i / N
            x = ar * math.cos(t)
            y = br * math.sin(t)
            ang = math.atan2(br * math.cos(t), -ar * math.sin(t))
            caja(prefijo + "_" + str(i), (x, y, zc), (seg, grosor, alto), mats[s], rot=(0, 0, ang))

# ==========================================
# 1. MATERIALES (pocos y compartidos)
# ==========================================
m_hormigon = material("CN_Hormigon", (0.50, 0.48, 0.45, 1.0), 0.8)
m_azul = material("CN_Grada_Azul", (0.02, 0.05, 0.32, 1.0), 0.6)
m_grana = material("CN_Grada_Grana", (0.30, 0.01, 0.03, 1.0), 0.6)
m_cesped = material("CN_Cesped", (0.03, 0.13, 0.02, 1.0), 0.9)
m_blanco = material("CN_Lineas", (0.90, 0.90, 0.88, 1.0), 0.5)
m_cristal = material("CN_Fachada_Cristal", (0.55, 0.72, 0.82, 1.0), 0.1, alfa=0.25, barniz=1.0)
m_etfe = material("CN_Cubierta_ETFE", (0.42, 0.50, 0.56, 1.0), 0.3, alfa=0.35, barniz=0.5)
m_metal = material("CN_Metal", (0.04, 0.04, 0.045, 1.0), 0.45, 1.0)

# Listas de 8 sectores (el motor no admite comprensiones; se escriben a mano)
gradas = [m_azul, m_grana, m_azul, m_grana, m_azul, m_grana, m_azul, m_grana]
h8 = [m_hormigon, m_hormigon, m_hormigon, m_hormigon, m_hormigon, m_hormigon, m_hormigon, m_hormigon]
cristal8 = [m_cristal, m_cristal, m_cristal, m_cristal, m_cristal, m_cristal, m_cristal, m_cristal]
etfe8 = [m_etfe, m_etfe, m_etfe, m_etfe, m_etfe, m_etfe, m_etfe, m_etfe]

# ==========================================
# 2. CAMPO Y EXPLANADA
# ==========================================
caja("CN_Explanada", (0, 0, -0.1), (262, 224, 0.2), m_hormigon)
caja("CN_Campo", (0, 0, 0.25), (105, 68, 0.3), m_cesped)

caja("CN_Linea_Medio", (0, 0, 0.42), (0.12, 68, 0.04), m_blanco)
aro("CN_Circulo_Central", (0, 0, 0.42), 9.15, 0.06, m_blanco)
caja("CN_Area_Izq", (-36, 0, 0.42), (0.12, 40.3, 0.04), m_blanco)
caja("CN_Area_Der", (36, 0, 0.42), (0.12, 40.3, 0.04), m_blanco)
caja("CN_Area_Izq_N", (-44.25, 20.15, 0.42), (16.5, 0.12, 0.04), m_blanco)
caja("CN_Area_Izq_S", (-44.25, -20.15, 0.42), (16.5, 0.12, 0.04), m_blanco)
caja("CN_Area_Der_N", (44.25, 20.15, 0.42), (16.5, 0.12, 0.04), m_blanco)
caja("CN_Area_Der_S", (44.25, -20.15, 0.42), (16.5, 0.12, 0.04), m_blanco)

# ==========================================
# 3. GRADAS ESCALONADAS (4 anillos de asientos, azulgrana por sectores)
# Cada escalón: contrahuella (pared) en el borde interior + asientos horizontales.
# ==========================================
anillo_vertical("CN_Contrahuella_1", 0.3, 2.0, 63, 0.8, h8)
anillo_plano("CN_Grada_1", 2.0, 63, 13, 0.8, gradas)
anillo_vertical("CN_Contrahuella_2", 2.0, 13.0, 76, 0.8, h8)
anillo_plano("CN_Grada_2", 13.0, 76, 13, 0.8, gradas)
anillo_vertical("CN_Contrahuella_3", 13.0, 24.0, 89, 0.8, h8)
anillo_plano("CN_Grada_3", 24.0, 89, 13, 0.8, gradas)
anillo_vertical("CN_Contrahuella_4", 24.0, 35.0, 102, 0.8, h8)
anillo_plano("CN_Grada_4", 35.0, 102, 12, 0.8, gradas)

# Borde interior sobre la última grada hasta la cubierta
anillo_vertical("CN_Borde_Superior", 35.0, 46.0, 114, 0.8, h8)

# ==========================================
# 4. CUBIERTA TRASLÚCIDA (anillo ETFE sobre todo el aforo) y pilares
# ==========================================
anillo_plano("CN_Cubierta", 46.0, 70, 48, 1.0, etfe8)

for i in range(32):
    t = 2 * math.pi * i / 32
    cilindro("CN_Pilar_" + str(i), (112 * math.cos(t), 112 * K * math.sin(t), 40.5), 0.9, 11.0, m_metal, vertices=8)

# ==========================================
# 5. FACHADA ABIERTA: cristal de perímetro y tres anillos de voladizo
# ==========================================
anillo_vertical("CN_Fachada_Cristal", 0.0, 46.0, 121, 1.0, cristal8)
anillo_plano("CN_Anillo_1", 12.0, 117, 3, 1.2, h8)
anillo_plano("CN_Anillo_2", 26.0, 117, 3, 1.2, h8)
anillo_plano("CN_Anillo_3", 40.0, 117, 3, 1.2, h8)
