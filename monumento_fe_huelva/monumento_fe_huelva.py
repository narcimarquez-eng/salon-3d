import bpy
import math

# COORD_MODE: Z_UP
# ==============================================================================
# MONUMENTO A LA FE DESCUBRIDORA (Huelva) - versión 4, más detalle
# ==============================================================================
# Monumento a Colón en la Punta del Sebo, en la confluencia de los ríos Odiel y Tinto.
# Fuentes:
#  - Fotografía frontal aportada por el usuario: referencia principal. Pedestal de
#    sillería en dos tramos, dos relieves en la parte baja de la cara frontal, cruz de
#    tau de fuste estrecho por delante del cuerpo y travesaño ancho, y un fraile de
#    hombros anchos con capucha y brazos abiertos hacia los extremos de la cruz.
#  - Wikipedia (en): 37 m de altura; estructura de mortero revestida de sillería de
#    calcarenita; fraile apoyado en una cruz de tau; obra de Gertrude Vanderbilt
#    Whitney; construido entre 1927 y 1929, inaugurado el 21/04/1929.
#  - UPO (Patio Colorado): pedestal de caliza blanca de Niebla; base de hormigón y hierro.
# APROXIMADO: alturas de cada tramo y anchos (leídos a ojo de la foto), forma de los
# relieves (figuras simplificadas), pliegues del hábito, juntas de sillería y colores.
# Se asume que la cara frontal (la de los relieves) mira a Y negativo, hacia la ría.
# Ejes: X = ancho, Y = profundidad, Z = altura. Medidas en metros. Altura total ~36,4 m.
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

def cilindro(nombre, centro, radio, alto, mat, vertices=12, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radio, depth=alto, location=centro, rotation=rot)
    obj = bpy.context.active_object
    obj.name = nombre
    return asignar_mat(obj, mat)

def esfera(nombre, centro, radio, mat, escala=(1.0, 1.0, 1.0), segmentos=12, anillos=8):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segmentos, ring_count=anillos, radius=radio, location=centro)
    obj = bpy.context.active_object
    obj.name = nombre
    obj.scale = escala
    return asignar_mat(obj, mat)

def tubo(nombre, a, b, radio, mat, vertices=24):
    # Cilindro recto desde el punto a hasta el punto b (brazos, cordón)
    dx = b[0] - a[0]
    dy = b[1] - a[1]
    dz = b[2] - a[2]
    horiz = math.sqrt(dx * dx + dy * dy)
    largo = math.sqrt(horiz * horiz + dz * dz)
    centro = ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2)
    theta = math.atan2(horiz, dz)
    phi = math.atan2(dy, dx)
    return cilindro(nombre, centro, radio, largo, mat, vertices, rot=(0, theta, phi))

def capas(prefijo, z0, z1, rx0, ry0, rx1, ry1, cx, cy, n, vertices, mat):
    # Cuerpo de revolución elíptico hecho de n anillos (cilindros finos escalados) que van
    # de (rx0, ry0) en z0 a (rx1, ry1) en z1. Así la túnica tiene curvas reales, no cajas.
    for i in range(n):
        t = (i + 0.5) / n
        z = z0 + (z1 - z0) * t
        rx = rx0 + (rx1 - rx0) * t
        ry = ry0 + (ry1 - ry0) * t
        h = (z1 - z0) / n + 0.02
        obj = cilindro(prefijo + "_" + str(i), (cx, cy, z), 1.0, h, mat, vertices)
        obj.scale = (rx, ry, 1.0)
    return None

def muro_sillares(prefijo, x0, x1, y0, y1, z0, z1, nf, nx, ny, mat):
    # Sillares en las cuatro caras de un prisma: nf hiladas, nx bloques por cara frontal
    # y trasera, ny bloques por cara lateral. Cada bloque sobresale un poco (juntas visibles).
    bh = (z1 - z0) / nf
    bw = (x1 - x0) / nx
    bd = (y1 - y0) / ny
    for f in range(nf):
        zc = z0 + (f + 0.5) * bh
        for k in range(nx):
            xc = x0 + (k + 0.5) * bw
            caja(prefijo + "_Fr_" + str(f) + "_" + str(k), (xc, y0 - 0.05, zc), (bw - 0.07, 0.12, bh - 0.07), mat)
            caja(prefijo + "_Tr_" + str(f) + "_" + str(k), (xc, y1 + 0.05, zc), (bw - 0.07, 0.12, bh - 0.07), mat)
        for k in range(ny):
            yc = y0 + (k + 0.5) * bd
            caja(prefijo + "_Iz_" + str(f) + "_" + str(k), (x0 - 0.05, yc, zc), (0.12, bd - 0.07, bh - 0.07), mat)
            caja(prefijo + "_De_" + str(f) + "_" + str(k), (x1 + 0.05, yc, zc), (0.12, bd - 0.07, bh - 0.07), mat)
    return None

# ==========================================
# 1. MATERIALES (pocos y compartidos)
# ==========================================
m_hormigon = material("MFD_Hormigon", (0.33, 0.33, 0.31, 1.0), 0.9)
m_sillar = material("MFD_Sillar", (0.58, 0.52, 0.40, 1.0), 0.8)
m_caliza = material("MFD_Caliza", (0.64, 0.60, 0.50, 1.0), 0.7)
m_sillar.texture = "stone_ashlar"

# ==========================================
# 2. BASE Y PEDESTAL
# ==========================================
caja("MFD_Plataforma", (0, 0, 0.3), (28.0, 20.0, 0.6), m_hormigon)
caja("MFD_Escalon", (0, 0, 0.9), (22.0, 14.0, 0.6), m_hormigon)

# Tramo bajo: 16 x 12 m, de z 1.2 a 6.0, con sillares de 2 m y hiladas de 0.6 m
caja("MFD_Nucleo_Bajo", (0, 0, 3.6), (15.9, 11.9, 4.8), m_sillar)
muro_sillares("MFD_Sillar_Bajo", -8, 8, -6, 6, 1.2, 6.0, 12, 16, 12, m_sillar)
caja("MFD_Cornisa", (0, 0, 6.0), (14.0, 11.0, 0.4), m_caliza)

# Tramo alto: 12 x 9 m, de z 6.0 a 10.0
caja("MFD_Nucleo_Alto", (0, 0, 8.0), (11.9, 8.9, 4.0), m_sillar)
muro_sillares("MFD_Sillar_Alto", -6, 6, -4.5, 4.5, 6.0, 10.0, 10, 12, 6, m_sillar)

# Dos relieves en la parte baja de la cara frontal: panel liso con una figura en relieve
caja("MFD_Relieve_Izq", (-4.0, -6.25, 3.6), (3.4, 0.3, 3.6), m_caliza)
caja("MFD_Relieve_Der", (4.0, -6.25, 3.6), (3.4, 0.3, 3.6), m_caliza)
esfera("MFD_Relieve_Cab_Izq", (-4.0, -6.55, 4.4), 0.32, m_caliza, (1.0, 0.7, 1.1), 24, 16)
capas("MFD_Relieve_Tor_Izq", 2.0, 3.8, 0.55, 0.3, 0.4, 0.25, -4.0, -6.5, 6, 24, m_caliza)
esfera("MFD_Relieve_Cab_Der", (4.0, -6.55, 4.4), 0.32, m_caliza, (1.0, 0.7, 1.1), 24, 16)
capas("MFD_Relieve_Tor_Der", 2.0, 3.8, 0.55, 0.3, 0.4, 0.25, 4.0, -6.5, 6, 24, m_caliza)

# ==========================================
# 3. CRUZ DE TAU: fuste estrecho por delante del fraile y travesaño ancho arriba
# ==========================================
caja("MFD_Cruz_Nucleo", (0, -0.4, 20.1), (2.8, 1.8, 20.2), m_sillar)
muro_sillares("MFD_Cruz_Fuste", -1.5, 1.5, -1.4, 0.6, 10.0, 30.2, 40, 4, 4, m_sillar)
caja("MFD_Cruz_Travesano_Nucleo", (0, -0.4, 29.0), (11.9, 1.8, 2.4), m_sillar)
muro_sillares("MFD_Cruz_Travesano", -6, 6, -1.4, 0.6, 27.8, 30.2, 4, 6, 2, m_sillar)

# ==========================================
# 4. FRAILE (de pie detrás del fuste, brazo izquierdo abierto hasta el travesaño)
# ==========================================
# Hábito: falda que se ensancha abajo, luego torso y hombros, con anillos de 48 lados
capas("MFD_Fraile_Falda", 10.0, 18.0, 3.6, 1.5, 3.0, 1.3, 0.0, 0.4, 24, 64, m_caliza)
capas("MFD_Fraile_Torso", 18.0, 27.0, 3.2, 1.3, 3.8, 1.4, 0.0, 0.4, 24, 64, m_caliza)
esfera("MFD_Fraile_Hombros", (0, 0.4, 27.6), 1.0, m_caliza, (4.2, 1.4, 1.2), 64, 48)
capas("MFD_Fraile_Cuello", 28.5, 30.4, 0.9, 0.9, 0.9, 0.9, 0.0, 0.5, 6, 48, m_caliza)

# Cabeza y capucha (la capucha envuelve la cabeza y deja ver la cara por delante)
esfera("MFD_Fraile_Cabeza", (0, 0.5, 33.0), 1.0, m_caliza, (1.25, 1.15, 1.4), 64, 48)
capas("MFD_Fraile_Capucha", 30.8, 36.4, 1.9, 1.6, 1.6, 1.5, 0.0, 0.5, 18, 64, m_caliza)
esfera("MFD_Fraile_Rostro", (0, -0.9, 33.2), 0.5, m_caliza, (0.8, 0.45, 1.0), 24, 16)

# Cordón franciscano por el frente de la falda
tubo("MFD_Fraile_Cordon", (0, -1.25, 11.0), (0, -1.25, 20.0), 0.13, m_caliza, 12)

# Brazo izquierdo abierto hacia el extremo del travesaño, brazo derecho caído
tubo("MFD_Fraile_Brazo_Izq", (-3.0, 0.4, 25.8), (-5.6, 0.4, 29.6), 0.55, m_caliza, 32)
esfera("MFD_Fraile_Mano_Izq", (-5.8, 0.4, 29.7), 0.6, m_caliza, (1.0, 0.9, 1.0), 32, 24)
tubo("MFD_Fraile_Brazo_Der", (3.0, 0.4, 26.5), (3.5, 0.4, 19.5), 0.5, m_caliza, 32)
esfera("MFD_Fraile_Mano_Der", (3.6, 0.4, 19.0), 0.5, m_caliza, (1.0, 0.9, 1.0), 32, 24)
