import bpy
import math

# COORD_MODE: Z_UP
# ==============================================================================
# MONUMENTO A LA FE DESCUBRIDORA (Huelva) - versión 1
# ==============================================================================
# Monumento a Colón en la Punta del Sebo, en la confluencia de los ríos Odiel y Tinto.
# Fuentes consultadas:
#  - Wikipedia (en): 37 m de altura; estructura de mortero revestida de sillería de
#    calcarenita; figura de un fraile apoyado en una cruz de tau (símbolo franciscano);
#    obra de la escultora Gertrude Vanderbilt Whitney; construido entre 1927 y 1929 e
#    inaugurado el 21 de abril de 1929.
#  - Universidad Pablo de Olavide (Patio Colorado): pedestal de caliza blanca de Niebla;
#    base de hormigón armado y hierro; relieves de los cuatro continentes en el pedestal;
#    el fraile mira hacia la ría.
#  - andalucia.com: la estatua mide unos 20 m.
# APROXIMADO (las fuentes no lo dan): proporciones del pedestal y del fraile, alturas de
# cada tramo, forma exacta de la túnica y la capucha, medallones de los continentes
# (aquí discos de bronce) y colores. Se asume que la ría está en el lado -Y.
# Ejes: X = ancho, Y = profundidad (el fraile mira a Y negativo, hacia la ría), Z = altura.
# Medidas en metros. Altura total ~36,5 m (la cruz remata en ~37 m).
# ==============================================================================

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)

# Render con luz de sol de mediodía, oclusión para los entrantes del pedestal
bpy.ops.render.set_engine(engine='BLENDER_EEVEE_NEXT', env_intensity=0.6, bloom=0.05)
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

def cilindro(nombre, centro, radio, alto, mat, vertices=12, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radio, depth=alto, location=centro, rotation=rot)
    obj = bpy.context.active_object
    obj.name = nombre
    return asignar_mat(obj, mat)

def cono(nombre, centro, r1, r2, alto, mat, vertices=12, rot=(0, 0, 0)):
    # r1 = radio abajo, r2 = radio arriba
    bpy.ops.mesh.primitive_cone_add(vertices=vertices, radius1=r1, radius2=r2, depth=alto, location=centro, rotation=rot)
    obj = bpy.context.active_object
    obj.name = nombre
    return asignar_mat(obj, mat)

def esfera(nombre, centro, radio, mat, escala=(1.0, 1.0, 1.0), segmentos=12, anillos=8):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segmentos, ring_count=anillos, radius=radio, location=centro)
    obj = bpy.context.active_object
    obj.name = nombre
    obj.scale = escala
    return asignar_mat(obj, mat)

def viga(nombre, a, b, grosor, mat):
    # Barra recta de sección cuadrada desde el punto a hasta el punto b (brazos, tirantes)
    dx = b[0] - a[0]
    dy = b[1] - a[1]
    dz = b[2] - a[2]
    horiz = math.sqrt(dx * dx + dy * dy)
    largo = math.sqrt(horiz * horiz + dz * dz)
    centro = ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2)
    return caja(nombre, centro, (largo, grosor, grosor), mat, rot=(0, -math.atan2(dz, horiz), math.atan2(dy, dx)))

# Inclinación del fraile: gira alrededor del eje X en el borde superior del pedestal.
# Con ang negativo la cabeza va hacia +Y, hacia la cruz, en la que se apoya.
Z_PEDESTAL = 10.0
INCLINACION = -0.12

def girar(p, z0=10.0, ang=-0.12):
    dz = p[2] - z0
    y2 = p[1] * math.cos(ang) - dz * math.sin(ang)
    z2 = z0 + p[1] * math.sin(ang) + dz * math.cos(ang)
    return [p[0], y2, z2]

# ==========================================
# 1. MATERIALES (pocos y compartidos)
# ==========================================
m_hormigon = material("MFD_Hormigon", (0.33, 0.33, 0.31, 1.0), 0.9)
m_sillar = material("MFD_Sillar", (0.58, 0.52, 0.40, 1.0), 0.8)
m_caliza = material("MFD_Caliza", (0.66, 0.62, 0.52, 1.0), 0.7)
m_bronce = material("MFD_Bronce", (0.32, 0.16, 0.05, 1.0), 0.45, 0.5)
m_sillar.texture = "stone_ashlar"

# ==========================================
# 2. BASE Y PEDESTAL (aprox.: 28 x 20 m de base, 10 m de pedestal)
# ==========================================
caja("MFD_Plataforma", (0, 0, 0.3), (28.0, 20.0, 0.6), m_hormigon)
caja("MFD_Escalon", (0, 0, 0.9), (22.0, 14.0, 0.6), m_hormigon)
caja("MFD_Pedestal_Bajo", (0, 0, 3.1), (16.0, 12.0, 3.8), m_sillar)
caja("MFD_Cornisa", (0, 0, 5.0), (14.0, 11.0, 0.4), m_caliza)
caja("MFD_Pedestal_Alto", (0, 0, 7.0), (12.0, 9.0, 4.0), m_sillar)
caja("MFD_Remate", (0, 0, 9.5), (14.0, 11.0, 1.0), m_caliza)

# Medallones de los cuatro continentes (discos de bronce, uno por cara)
cilindro("MFD_Medallon_Europa", (0, -4.6, 7.0), 1.5, 0.2, m_bronce, 24, (math.pi / 2, 0, 0))
cilindro("MFD_Medallon_Asia", (0, 4.6, 7.0), 1.5, 0.2, m_bronce, 24, (math.pi / 2, 0, 0))
cilindro("MFD_Medallon_Africa", (6.1, 0, 7.0), 1.5, 0.2, m_bronce, 24, (0, math.pi / 2, 0))
cilindro("MFD_Medallon_America", (-6.1, 0, 7.0), 1.5, 0.2, m_bronce, 24, (0, math.pi / 2, 0))

# ==========================================
# 3. CRUZ DE TAU (detrás del fraile, sube hasta ~36,5 m)
# ==========================================
caja("MFD_Cruz_Astil", (0, 4.0, 23.25), (1.3, 1.0, 26.5), m_caliza)
caja("MFD_Cruz_Travesano", (0, 4.0, 35.5), (7.0, 1.0, 2.0), m_caliza)

# ==========================================
# 4. FRAILE (aprox. 20 m, inclinado hacia la cruz)
# ==========================================
# Túnica: falda ancha, cintura, pecho y hombros (sale de la vista como una silueta humana)
cono("MFD_Fraile_Falda", girar((0, 0, Z_PEDESTAL + 4.0)), 2.4, 1.8, 8.0, m_caliza, 16, (INCLINACION, 0, 0))
cono("MFD_Fraile_Torso", girar((0, 0, Z_PEDESTAL + 11.0)), 1.8, 1.3, 6.0, m_caliza, 16, (INCLINACION, 0, 0))
esfera("MFD_Fraile_Hombros", girar((0, 0, Z_PEDESTAL + 14.0)), 1.35, m_caliza, (1.25, 0.85, 0.7), 16, 10)
# Cuello y cabeza, con la capucha echada hacia atrás (la cara sale por delante)
cilindro("MFD_Fraile_Cuello", girar((0, 0, Z_PEDESTAL + 15.6)), 0.4, 1.0, m_caliza, 12, (INCLINACION, 0, 0))
esfera("MFD_Fraile_Cabeza", girar((0, -0.2, Z_PEDESTAL + 16.9)), 0.8, m_caliza, (1.0, 0.95, 1.1), 16, 12)
cono("MFD_Fraile_Capucha", girar((0, 0.45, Z_PEDESTAL + 17.6)), 1.15, 0.75, 3.0, m_caliza, 16, (INCLINACION, 0, 0))
# Cordón franciscano en el frente de la falda
cilindro("MFD_Fraile_Cordon", girar((0, -2.1, Z_PEDESTAL + 5.0)), 0.13, 8.0, m_caliza, 8, (INCLINACION, 0, 0))
# Brazo apoyado en la cruz y brazo caído junto al cuerpo
viga("MFD_Fraile_Brazo_Cruz", girar((0.9, 0.0, Z_PEDESTAL + 14.0)), girar((1.0, 3.2, Z_PEDESTAL + 12.5)), 0.55, m_caliza)
viga("MFD_Fraile_Brazo_Caido", girar((-1.0, -0.2, Z_PEDESTAL + 14.0)), girar((-1.5, -0.5, Z_PEDESTAL + 7.0)), 0.5, m_caliza)
