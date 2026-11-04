import bpy
import math

# COORD_MODE: Z_UP
# ==============================================================================
# MONUMENTO A LA FE DESCUBRIDORA (Huelva) - versión 3, basada en fotografía
# ==============================================================================
# Monumento a Colón en la Punta del Sebo, en la confluencia de los ríos Odiel y Tinto.
# Fuentes:
#  - Fotografía frontal aportada por el usuario: referencia principal. Se ve un pedestal
#    de sillería en dos tramos, dos relieves en la parte baja de la cara frontal, una cruz
#    de tau de fuste estrecho y un fraile de hombros anchos, capucha y brazos abiertos
#    hacia los extremos de la cruz, que queda por delante del cuerpo.
#  - Wikipedia (en): 37 m de altura; estructura de mortero revestida de sillería de
#    calcarenita; figura de un fraile apoyado en una cruz de tau; obra de Gertrude
#    Vanderbilt Whitney; construido entre 1927 y 1929, inaugurado el 21/04/1929.
#  - UPO (Patio Colorado): pedestal de caliza blanca de Niebla; base de hormigón armado y hierro.
# APROXIMADO: alturas de cada tramo, anchos (leídos a ojo de la foto), forma de los
# relieves (aquí paneles lisos sin figuras), posición de los pies y colores.
# Se asume que la cara frontal (la de los relieves) mira a Y negativo, hacia la ría.
# Ejes: X = ancho, Y = profundidad, Z = altura. Medidas en metros. Altura total 36,4 m.
# ==============================================================================

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)

# Render con luz de sol y oclusión para las juntas de la sillería
bpy.ops.render.set_engine(engine='BLENDER_EEVEE_NEXT', env_intensity=0.6, bloom=0.05)
bpy.ops.render.set_lighting(intensity=1.3, angle=35)
bpy.ops.render.set_ssao(intensity=1.2)

def material(nombre, color, rugosidad=0.6, metalico=0.0):
    mat = bpy.data.materials.new(name=nombre)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Base Color"].default_value = color
        bsdf.inputs["Roughness"].default_value = rugosidad
        bsdf.inputs["Metallic"].default_value = metalico
    return mat

def asignar_mat(obj, mat):
    if obj.data.materials:
        obj.data.materials[0] = mat
    else:
        obj.data.materials.append(mat)
    return obj

def caja(nombre, centro, tamano, mat, rot=(0, 0, 0)):
    # tamano = medidas reales (ancho X, fondo Y, alto Z) del cubo de lado 1
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=centro, rotation=rot)
    obj = bpy.context.active_object
    obj.name = nombre
    obj.scale = tamano
    return asignar_mat(obj, mat)

def viga(nombre, a, b, grosor, mat):
    # Barra recta de sección cuadrada desde el punto a hasta el punto b (brazos)
    dx = b[0] - a[0]
    dy = b[1] - a[1]
    dz = b[2] - a[2]
    horiz = math.sqrt(dx * dx + dy * dy)
    largo = math.sqrt(horiz * horiz + dz * dz)
    centro = ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2)
    return caja(nombre, centro, (largo, grosor, grosor), mat, rot=(0, -math.atan2(dz, horiz), math.atan2(dy, dx)))

# ==========================================
# 1. MATERIALES (pocos y compartidos)
# ==========================================
m_hormigon = material("MFD_Hormigon", (0.33, 0.33, 0.31, 1.0), 0.9)
m_sillar = material("MFD_Sillar", (0.58, 0.52, 0.40, 1.0), 0.8)
m_caliza = material("MFD_Caliza", (0.64, 0.60, 0.50, 1.0), 0.7)
m_sillar.texture = "stone_ashlar"

# ==========================================
# 2. BASE Y PEDESTAL (sillería en dos tramos, como en la foto)
# ==========================================
caja("MFD_Plataforma", (0, 0, 0.3), (28.0, 20.0, 0.6), m_hormigon)
caja("MFD_Escalon", (0, 0, 0.9), (22.0, 14.0, 0.6), m_hormigon)
caja("MFD_Pedestal_Bajo", (0, 0, 3.6), (16.0, 12.0, 4.8), m_sillar)   # z 1.2 .. 6.0
caja("MFD_Cornisa", (0, 0, 6.0), (14.0, 11.0, 0.4), m_caliza)
caja("MFD_Pedestal_Alto", (0, 0, 8.0), (12.0, 9.0, 4.0), m_sillar)    # z 6.0 .. 10.0

# Dos relieves en la parte baja de la cara frontal (paneles lisos, aproximados)
caja("MFD_Relieve_Izq", (-4.0, -6.2, 3.6), (3.4, 0.4, 3.6), m_caliza)
caja("MFD_Relieve_Der", (4.0, -6.2, 3.6), (3.4, 0.4, 3.6), m_caliza)

# ==========================================
# 3. CRUZ DE TAU: fuste estrecho por delante del fraile y travesaño ancho arriba
# ==========================================
caja("MFD_Cruz_Astil", (0, -0.4, 20.1), (3.0, 2.0, 20.2), m_caliza)   # z 10 .. 30.2
caja("MFD_Cruz_Travesano", (0, -0.4, 29.0), (12.0, 2.0, 2.4), m_caliza)  # z 27.8 .. 30.2

# ==========================================
# 4. FRAILE (de pie detrás del fuste, brazo izquierdo abierto hasta el travesaño)
# ==========================================
caja("MFD_Fraile_Pies", (0, 0.4, 11.0), (7.2, 2.8, 2.0), m_caliza)       # hábito que se ensancha abajo
caja("MFD_Fraile_Tunica", (0, 0.4, 16.0), (6.0, 2.6, 8.0), m_caliza)
caja("MFD_Fraile_Torso", (0, 0.4, 23.5), (6.6, 2.8, 7.0), m_caliza)     # z 20 .. 27
caja("MFD_Fraile_Hombros", (0, 0.4, 28.0), (7.0, 2.8, 2.0), m_caliza)   # z 27 .. 29
caja("MFD_Fraile_Cuello", (0, 0.4, 30.0), (2.0, 2.0, 1.2), m_caliza)
caja("MFD_Fraile_Capucha", (0, 0.5, 33.6), (3.6, 3.0, 5.6), m_caliza)   # z 30.8 .. 36.4
caja("MFD_Fraile_Rostro", (0, -1.1, 33.2), (2.0, 0.5, 2.6), m_caliza)   # cara, por delante de la capucha

viga("MFD_Fraile_Brazo_Izq", (-3.2, 0.4, 25.5), (-5.6, 0.4, 29.6), 1.5, m_caliza)
viga("MFD_Fraile_Brazo_Der", (3.2, 0.4, 27.0), (3.6, 0.4, 19.5), 1.4, m_caliza)
caja("MFD_Fraile_Mano_Izq", (-5.8, 0.4, 29.6), (1.4, 1.4, 1.4), m_caliza)
caja("MFD_Fraile_Mano_Der", (3.6, 0.4, 19.3), (1.2, 1.2, 1.2), m_caliza)
