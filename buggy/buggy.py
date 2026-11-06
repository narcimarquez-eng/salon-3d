import bpy
import math

# COORD_MODE: Z_UP
# ==============================================================================
# BUGGY DE ARENA (tipo Meyers Manx / Chenowth)
# ==============================================================================
# Coche de playa ligero: chasis tubular con jaula antivuelco, carroceria de chapa
# pintada sin puertas, motor boxer trasero refrigerado por aire con aletas y filtros,
# dos asientos tipo cubo con arneses, volante de cuero, cuadro con relojes, faros,
# parachoques cromados, espejos y neumaticos balon con llanta negra y tuercas.
# Fuentes: este script no usa fuentes externas. Medidas aproximadas de un buggy
# clasico: distancia entre ejes 2,0 m, via ~1,44 m, neumaticos de ~0,76 m de diametro
# y ~0,26 m de ancho, largo total ~3,6 m. Colores, relojes, arneses y detalles de
# acabado son de estilo y no copian un modelo concreto.
# Ejes: X = ancho, Y = largo (el morro mira a Y negativo), Z = altura.
# Medidas en metros. El suelo de arena esta en Z = 0 y las ruedas apoyan en el.
# ==============================================================================

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)

# Motor de render del visor: EEVEE con luz ambiente, sol y oclusion
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

def aro(nombre, centro, radio, grosor, mat, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_torus_add(major_radius=radio, minor_radius=grosor, location=centro, rotation=rot)
    obj = bpy.context.active_object
    obj.name = nombre
    return asignar_mat(obj, mat)

def viga(nombre, a, b, grosor, mat):
    # Tubo recto de seccion cuadrada desde a hasta b (jaula, brazos, amortiguadores, arneses)
    dx = b[0] - a[0]
    dy = b[1] - a[1]
    dz = b[2] - a[2]
    horiz = math.sqrt(dx * dx + dy * dy)
    largo = math.sqrt(horiz * horiz + dz * dz)
    centro = ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2)
    return caja(nombre, centro, (largo, grosor, grosor), mat, rot=(0, -math.atan2(dz, horiz), math.atan2(dy, dx)))

def rueda(nombre, x, y):
    # Neumatico de balon (aro grueso), llanta oscura, buje cromado y cinco tuercas
    cz = 0.38
    lado = 1.0
    if x < 0:
        lado = -1.0
    aro(nombre + "_Neumatico", (x, y, cz), 0.25, 0.13, m_caucho, rot=(0, math.pi / 2, 0))
    cilindro(nombre + "_Llanta", (x, y, cz), 0.2, 0.18, m_llanta, vertices=20, rot=(0, math.pi / 2, 0))
    cilindro(nombre + "_Buje", (x, y, cz), 0.07, 0.26, m_cromo, vertices=12, rot=(0, math.pi / 2, 0))
    for k in range(5):
        a = k * 2 * math.pi / 5
        esfera(nombre + "_Tuerca_" + str(k), (x + lado * 0.135, y + 0.045 * math.cos(a), cz + 0.045 * math.sin(a)), 0.018, m_cromo, segmentos=8, anillos=6)

# ==========================================
# 1. MATERIALES (pocos y compartidos: cada material es una pieza al exportar)
# ==========================================
m_pintura = material("BG_Pintura_Naranja", (0.42, 0.06, 0.006, 1.0), 0.3, 0.0, 1.0, 0.7)
m_chasis = material("BG_Negro_Mate", (0.015, 0.015, 0.016, 1.0), 0.55, 0.3)
m_cromo = material("BG_Cromo", (0.75, 0.76, 0.78, 1.0), 0.12, 1.0)
m_caucho = material("BG_Neumatico", (0.012, 0.012, 0.012, 1.0), 0.9, 0.0)
m_llanta = material("BG_Llanta_Negra", (0.09, 0.09, 0.095, 1.0), 0.35, 0.9)
m_cuero = material("BG_Cuero", (0.05, 0.022, 0.01, 1.0), 0.5, 0.0, 1.0, 0.5)
m_cristal = material("BG_Cristal", (0.8, 0.9, 0.93, 1.0), 0.05, 0.0, 0.2, 1.0)
m_faro = material("BG_Faro_Luz", (1.0, 0.93, 0.75, 1.0), 0.3, 0.0, 1.0, 0.0, 4.0)
m_piloto = material("BG_Piloto_Rojo", (0.85, 0.03, 0.01, 1.0), 0.3, 0.0, 1.0, 0.0, 2.0)
m_arena = material("BG_Arena", (0.62, 0.45, 0.22, 1.0), 0.95)
m_arena.texture = "desert_sand"

# ==========================================
# 2. SUELO DE ARENA (para ver la escala)
# ==========================================
caja("BG_Arena_Suelo", (0, 0, -0.06), (5.0, 5.0, 0.12), m_arena)

# ==========================================
# 3. CHASIS TUBULAR Y JAULA ANTIVUELCO
# ==========================================
for k in range(2):
    s = 1 - 2 * k
    x = s * 0.35
    xc = s * 0.62
    # Largueros y travesanos del chasis
    viga("BG_Largero_" + str(k), (x, -1.35, 0.36), (x, 1.35, 0.36), 0.07, m_chasis)
    for y in [-1.0, 0.0, 1.0]:
        viga("BG_Travesano_" + str(k) + "_" + str(y), (-0.35, y, 0.36), (0.35, y, 0.36), 0.06, m_chasis)
    # Jaula: pilares delantero, trasero y laterales
    viga("BG_Jaula_Delantera_" + str(k), (xc, -0.45, 0.36), (xc, -0.45, 1.3), 0.05, m_chasis)
    viga("BG_Jaula_Trasera_" + str(k), (xc, 0.6, 0.36), (xc, 0.6, 1.55), 0.05, m_chasis)
    viga("BG_Jaula_Lateral_" + str(k), (xc, -0.45, 1.3), (xc, 0.6, 1.55), 0.05, m_chasis)
    viga("BG_Jaula_Riostra_" + str(k), (xc, -0.45, 0.9), (xc, 0.6, 0.9), 0.04, m_chasis)
    # Soporte de parachoques delantero
    viga("BG_Parachoques_Del_Soporte_" + str(k), (x, -1.35, 0.36), (s * 0.7, -1.74, 0.3), 0.045, m_cromo)
    # Soporte de parachoques trasero
    viga("BG_Parachoques_Tra_Soporte_" + str(k), (s * 0.35, 1.35, 0.36), (s * 0.7, 1.62, 0.3), 0.04, m_cromo)
    # Espejo en brazo cromado
    viga("BG_Retrovisor_Brazo_" + str(k), (xc, -0.45, 1.25), (s * 0.8, -0.5, 1.12), 0.02, m_cromo)
    caja("BG_Retrovisor_" + str(k), (s * 0.82, -0.5, 1.1), (0.03, 0.14, 0.12), m_cromo)

# Riostras cruzadas de la jaula trasera (en forma de X)
viga("BG_Jaula_Cruz_A", (-0.62, 0.6, 0.36), (0.62, 0.6, 1.55), 0.04, m_chasis)
viga("BG_Jaula_Cruz_B", (0.62, 0.6, 0.36), (-0.62, 0.6, 1.55), 0.04, m_chasis)
# Arcos superiores delantero y trasero
viga("BG_Jaula_Arco_Delantero", (-0.62, -0.45, 1.3), (0.62, -0.45, 1.3), 0.05, m_chasis)
viga("BG_Jaula_Arco_Trasero", (-0.62, 0.6, 1.55), (0.62, 0.6, 1.55), 0.05, m_chasis)
viga("BG_Jaula_Arco_Riostra", (-0.62, -0.45, 0.9), (0.62, -0.45, 0.9), 0.04, m_chasis)

# ==========================================
# 4. SUSPENSION: BRAZOS Y AMORTIGUADORES
# ==========================================
for k in range(2):
    s = 1 - 2 * k
    x = s * 0.35
    for j in range(2):
        y = -1.0 + 2.0 * j
        viga("BG_Brazo_Sup_" + str(k) + "_" + str(j), (x, y - 0.14, 0.36), (s * 0.7, y, 0.38), 0.045, m_cromo)
        viga("BG_Brazo_Inf_" + str(k) + "_" + str(j), (x, y + 0.14, 0.36), (s * 0.7, y, 0.38), 0.045, m_cromo)
        viga("BG_Amortiguador_" + str(k) + "_" + str(j), (s * 0.5, y + 0.06, 0.4), (s * 0.45, y + 0.12, 0.85), 0.05, m_cromo)

# ==========================================
# 5. RUEDAS
# ==========================================
rueda("BG_Rueda_Del_I", -0.72, -1.0)
rueda("BG_Rueda_Del_D", 0.72, -1.0)
rueda("BG_Rueda_Tra_I", -0.72, 1.0)
rueda("BG_Rueda_Tra_D", 0.72, 1.0)
# Rueda de repuesto montada en la parte trasera
aro("BG_Repuesto_Neumatico", (0, 1.78, 0.62), 0.25, 0.13, m_caucho, rot=(math.pi / 2, 0, 0))
cilindro("BG_Repuesto_Llanta", (0, 1.78, 0.62), 0.2, 0.18, m_llanta, vertices=20, rot=(math.pi / 2, 0, 0))

# ==========================================
# 6. CARROCERIA
# ==========================================
# Suelo de chapa
caja("BG_Suelo_Chapa", (0, -0.1, 0.42), (1.2, 1.7, 0.05), m_pintura)
# Laterales bajos
for k in range(2):
    s = 1 - 2 * k
    caja("BG_Lateral_" + str(k), (s * 0.6, -0.1, 0.52), (0.04, 1.6, 0.14), m_pintura)
# Capo delantero
caja("BG_Morro_Capo", (0, -1.22, 0.5), (1.1, 0.95, 0.12), m_pintura)
# Salpicadero
caja("BG_Tablero", (0, -0.62, 0.72), (1.0, 0.16, 0.26), m_chasis)
# Parabrisas (cristal con transparencia)
caja("BG_Parabrisas", (0, -0.46, 1.07), (1.0, 0.015, 0.44), m_cristal)
# Guardabarros delanteros y traseros con pestanas laterales
for k in range(2):
    s = 1 - 2 * k
    for j in range(2):
        y = -1.0 + 2.0 * j
        caja("BG_Guardabarros_" + str(k) + "_" + str(j), (s * 0.72, y, 0.8), (0.5, 0.8, 0.04), m_pintura)
        caja("BG_Pestana_" + str(k) + "_" + str(j), (s * 0.97, y, 0.66), (0.04, 0.8, 0.22), m_pintura)
# Cubierta del motor boxer trasero
caja("BG_Motor_Cubierta", (0, 1.0, 0.66), (1.0, 1.05, 0.5), m_pintura)
# Aletas de refrigeracion sobre el motor
for i in range(6):
    yf = 0.6 + 0.17 * i
    caja("BG_Aleta_" + str(i), (0, yf, 0.93), (1.04, 0.03, 0.05), m_chasis)
    for k in range(2):
        s = 1 - 2 * k
        caja("BG_Rejilla_" + str(k) + "_" + str(i), (s * 0.51, yf, 0.66), (0.02, 0.05, 0.36), m_chasis)
# Filtros de aire
for k in range(2):
    s = 1 - 2 * k
    cilindro("BG_Filtro_Aire_" + str(k), (s * 0.25, 1.22, 1.02), 0.12, 0.14, m_chasis, vertices=16)
# Escape lateral
for k in range(2):
    s = 1 - 2 * k
    cilindro("BG_Escape_" + str(k), (s * 0.5, 1.38, 0.22), 0.05, 0.36, m_cromo, vertices=12, rot=(math.pi / 2, 0, 0))

# ==========================================
# 7. FAROS, PILOTOS Y PARACHOQUES
# ==========================================
for k in range(2):
    s = 1 - 2 * k
    cilindro("BG_Faro_Aro_" + str(k), (s * 0.42, -1.69, 0.52), 0.1, 0.03, m_cromo, vertices=16, rot=(math.pi / 2, 0, 0))
    cilindro("BG_Faro_" + str(k), (s * 0.42, -1.7, 0.52), 0.09, 0.06, m_faro, vertices=16, rot=(math.pi / 2, 0, 0))
    caja("BG_Piloto_" + str(k), (s * 0.6, 1.56, 0.62), (0.2, 0.05, 0.12), m_piloto)
viga("BG_Parachoques_Delantero", (-0.7, -1.74, 0.3), (0.7, -1.74, 0.3), 0.05, m_cromo)
viga("BG_Parachoques_Trasero", (-0.7, 1.62, 0.3), (0.7, 1.62, 0.3), 0.05, m_cromo)

# ==========================================
# 8. HABITACULO: ASIENTOS, ARNESES, VOLANTE, MANDOS
# ==========================================
for k in range(2):
    s = 1 - 2 * k
    sx = s * 0.32
    caja("BG_Asiento_Base_" + str(k), (sx, 0.02, 0.56), (0.42, 0.5, 0.14), m_cuero)
    caja("BG_Asiento_Respaldo_" + str(k), (sx, 0.28, 0.85), (0.42, 0.12, 0.5), m_cuero)
    # Arneses de cuatro puntos
    viga("BG_Arnes_A_" + str(k), (sx - 0.13, 0.22, 1.05), (sx + 0.1, -0.2, 0.6), 0.025, m_chasis)
    viga("BG_Arnes_B_" + str(k), (sx + 0.13, 0.22, 1.05), (sx - 0.1, -0.2, 0.6), 0.025, m_chasis)
    viga("BG_Arnes_Regazo_" + str(k), (sx - 0.2, -0.2, 0.6), (sx + 0.2, -0.2, 0.6), 0.025, m_chasis)

# Cuadro de relojes en el salpicadero
for i in range(3):
    xr = -0.22 + 0.22 * i
    cilindro("BG_Reloj_Aro_" + str(i), (xr, -0.515, 0.78), 0.05, 0.02, m_cromo, vertices=16, rot=(math.pi / 2, 0, 0))
    cilindro("BG_Reloj_Cara_" + str(i), (xr, -0.5, 0.78), 0.04, 0.02, m_chasis, vertices=16, rot=(math.pi / 2, 0, 0))

# Volante de cuero del lado izquierdo, con columna de direccion
cx = -0.3
cy = -0.5
cz = 0.98
aro("BG_Volante_Aro", (cx, cy, cz), 0.18, 0.014, m_cuero, rot=(math.pi / 2, 0, 0))
for k in range(3):
    a = k * 2 * math.pi / 3
    viga("BG_Volante_Radio_" + str(k), (cx, cy, cz), (cx + 0.18 * math.cos(a), cy, cz + 0.18 * math.sin(a)), 0.02, m_chasis)
cilindro("BG_Volante_Buje", (cx, cy, cz), 0.04, 0.03, m_chasis, vertices=12, rot=(math.pi / 2, 0, 0))
viga("BG_Columna_Direccion", (cx, cy + 0.02, cz), (cx, -0.6, 0.7), 0.03, m_chasis)

# Pedales
for k in range(3):
    caja("BG_Pedal_" + str(k), (-0.4 + 0.1 * k, -0.36, 0.56), (0.06, 0.1, 0.22), m_cromo)

# Palanca de cambios con pomo de cuero
cilindro("BG_Palanca_Cambio", (0.0, -0.1, 0.6), 0.018, 0.3, m_cromo, vertices=10)
esfera("BG_Pomo_Cambio", (0.0, -0.1, 0.78), 0.035, m_cuero, segmentos=10, anillos=6)

# ==========================================
# 9. DETALLES DE LA CARROCERIA
# ==========================================
# Tuberia de escape: punta cromada
for k in range(2):
    s = 1 - 2 * k
    cilindro("BG_Escape_Punta_" + str(k), (s * 0.5, 1.58, 0.22), 0.06, 0.08, m_cromo, vertices=12, rot=(math.pi / 2, 0, 0))
