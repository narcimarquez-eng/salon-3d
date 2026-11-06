import bpy
import math

# COORD_MODE: Z_UP
# ==============================================================================
# ESQUELETO GUERRERO CON ARMADURA Y CUERNOS VIKINGOS
# ==============================================================================
# Basado en la imagen de referencia (cuatro vistas: frontal, dos laterales y
# trasera). Esqueleto de hueso crema; casco con cara de calavera y cuernos
# curvos; hombreras y brazales con pinchos; peto de hierro oxidado con correas
# cruzadas; grebas en las piernas; faldón de tela azul desgarrada y cinturón de
# cuero con hebilla de acero.
# Ejes: X = ancho, Y = profundidad (la cara mira a Y negativo), Z = altura.
# Los pies están en Z = 0. Altura total unos 2,0 m. Es una ilustración: las
# proporciones salen de la imagen, no de una ficha técnica.
# ==============================================================================

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)

bpy.ops.render.set_engine(engine='BLENDER_EEVEE_NEXT', env_intensity=0.5, bloom=0.05)
bpy.ops.render.set_lighting(intensity=1.2, angle=35)
bpy.ops.render.set_ssao(intensity=1.3)

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

def cono(nombre, centro, r1, r2, alto, mat, vertices=8, rot=(0, 0, 0)):
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

def rot_de(a, b):
    # Rotación (Euler XYZ) que alinea el eje Z local de una pieza con el segmento a -> b.
    # Sirve para cilindros, conos y cajas alargadas (huesos, brazales, pinchos).
    dx = b[0] - a[0]
    dy = b[1] - a[1]
    dz = b[2] - a[2]
    horiz = math.sqrt(dx * dx + dz * dz)
    return (math.atan2(-dy, horiz), math.atan2(dx, dz), 0)

def punto_medio(a, b):
    return ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2)

def largo_de(a, b):
    dx = b[0] - a[0]
    dy = b[1] - a[1]
    dz = b[2] - a[2]
    return math.sqrt(dx * dx + dy * dy + dz * dz)

def hueso(nombre, a, b, radio, mat, vertices=8):
    # Segmento cilíndrico de a a b (huesos largos).
    return cilindro(nombre, punto_medio(a, b), radio, largo_de(a, b), mat, vertices=vertices, rot=rot_de(a, b))

def viga(nombre, a, b, grosor, mat):
    # Barra recta de sección cuadrada de a a b (correas cruzadas del peto).
    dx = b[0] - a[0]
    dy = b[1] - a[1]
    dz = b[2] - a[2]
    horiz = math.sqrt(dx * dx + dy * dy)
    largo = math.sqrt(horiz * horiz + dz * dz)
    centro = punto_medio(a, b)
    return caja(nombre, centro, (largo, grosor, grosor), mat, rot=(0, -math.atan2(dz, horiz), math.atan2(dy, dx)))

def apuntar(nombre, a, b, r1, r2, mat, vertices=8):
    # Cono de a (radio r1) a b (radio r2): cuernos, pinchos y dientes.
    return cono(nombre, punto_medio(a, b), r1, r2, largo_de(a, b), mat, vertices=vertices, rot=rot_de(a, b))

# ==========================================
# 1. MATERIALES (pocos y compartidos)
# ==========================================
m_hueso = material("Esq_Hueso", (0.42, 0.36, 0.22, 1.0), 0.5)
m_hueso.texture = "bone_ivory"
m_armadura = material("Esq_Armadura_Hierro", (0.10, 0.06, 0.04, 1.0), 0.42, 0.7)
m_tela = material("Esq_Tela_Azul", (0.035, 0.06, 0.11, 1.0), 0.9)
m_cuero = material("Esq_Cuero", (0.05, 0.025, 0.012, 1.0), 0.6)
m_acero = material("Esq_Acero", (0.22, 0.22, 0.24, 1.0), 0.3, 1.0)
m_cuerno = material("Esq_Cuerno", (0.45, 0.40, 0.30, 1.0), 0.4)
m_cavidad = material("Esq_Cavidad", (0.02, 0.02, 0.02, 1.0), 0.3)

# ==========================================
# 2. CABEZA: CRÁNEO, CASCO Y CUERNOS
# ==========================================
esfera("Esq_Craneo", (0, 0.01, 1.70), 0.12, m_hueso, escala=(0.95, 1.05, 1.1))
esfera("Esq_Mandibula", (0, -0.04, 1.60), 0.07, m_hueso, escala=(1.2, 1.0, 0.7))
for sx in [-1, 1]:
    esfera("Esq_Cuenca_" + str(sx), (sx * 0.045, -0.11, 1.71), 0.032, m_cavidad, escala=(1.0, 0.5, 1.1))
caja("Esq_Nariz", (0, -0.12, 1.66), (0.03, 0.03, 0.05), m_cavidad)
for k in range(4):
    caja("Esq_Diente_" + str(k), (-0.045 + k * 0.03, -0.1, 1.61), (0.018, 0.02, 0.03), m_hueso)

# Casco de hierro que cubre la coronilla; la cara queda al descubierto por delante
esfera("Esq_Casco", (0, 0.02, 1.8), 0.15, m_armadura, escala=(1.0, 1.05, 0.85))
caja("Esq_Visera", (0, -0.15, 1.79), (0.22, 0.04, 0.035), m_armadura)
for sx in [-1, 1]:
    caja("Esq_Mejilla_" + str(sx), (sx * 0.13, -0.05, 1.67), (0.04, 0.1, 0.14), m_armadura)
    # Cuernos vikingos: dos tramos, el segundo más fino y con punta
    apuntar("Esq_Cuerno_Base_" + str(sx), (sx * 0.12, 0.0, 1.86), (sx * 0.22, 0.0, 1.95), 0.035, 0.025, m_cuerno)
    apuntar("Esq_Cuerno_Punta_" + str(sx), (sx * 0.22, 0.0, 1.95), (sx * 0.31, 0.0, 2.02), 0.025, 0.006, m_cuerno)

# Cuello y columna
cilindro("Esq_Cuello", (0, 0.02, 1.52), 0.04, 0.12, m_hueso, vertices=8)
for k in range(5):
    esfera("Esq_Vertebra_" + str(k), (0, 0.07, 1.12 + 0.09 * k), 0.03, m_hueso)

# ==========================================
# 3. TORSO: CAJA TORÁCICA, PETO Y CORREAS
# ==========================================
esfera("Esq_Caja_Toracica", (0, 0.0, 1.25), 0.16, m_hueso, escala=(1.1, 0.7, 1.15))
esfera("Esq_Pelvis", (0, 0.0, 0.92), 0.13, m_hueso, escala=(1.4, 0.8, 0.8))

# Peto de hierro en dos piezas (pecho ancho, cintura más estrecha)
caja("Esq_Peto_Superior", (0, -0.1, 1.43), (0.44, 0.14, 0.22), m_armadura)
caja("Esq_Peto_Inferior", (0, -0.1, 1.13), (0.38, 0.14, 0.28), m_armadura)
caja("Esq_Peto_Quilla", (0, -0.18, 1.27), (0.05, 0.03, 0.5), m_armadura)
for k in range(4):
    esfera("Esq_Remache_" + str(k), (-0.15 + k * 0.1, -0.19, 1.45), 0.012, m_acero)
# Dos correas de cuero que se cruzan en el pecho
viga("Esq_Correa_I", (-0.2, -0.19, 1.5), (0.2, -0.19, 1.0), 0.03, m_cuero)
viga("Esq_Correa_D", (0.2, -0.19, 1.5), (-0.2, -0.19, 1.0), 0.03, m_cuero)

# Espalda: placa trasera
caja("Esq_Placa_Espalda", (0, 0.13, 1.3), (0.36, 0.07, 0.42), m_armadura)

# Cinturón de cuero con hebilla
caja("Esq_Cinturon", (0, -0.09, 0.95), (0.54, 0.2, 0.07), m_cuero)
caja("Esq_Hebilla", (0, -0.2, 0.95), (0.08, 0.025, 0.07), m_acero)

# ==========================================
# 4. FALDÓN DE TELA AZUL DESGARRADA
# ==========================================
caja("Esq_Faldon", (0, -0.02, 0.75), (0.46, 0.16, 0.36), m_tela)
caja("Esq_Faldon_Frente", (0, -0.1, 0.72), (0.5, 0.04, 0.42), m_tela)
caja("Esq_Faldon_Espalda", (0, 0.1, 0.75), (0.46, 0.03, 0.42), m_tela)
for sx in [-1, 1]:
    caja("Esq_Faldon_Lado_" + str(sx), (sx * 0.27, 0.0, 0.72), (0.05, 0.14, 0.38), m_tela)
# Jirones que cuelgan hasta la rodilla
jir_x = [-0.22, -0.15, -0.08, 0.0, 0.08, 0.15, 0.22]
jir_z = [0.6, 0.64, 0.58, 0.63, 0.59, 0.64, 0.6]
for k in range(7):
    caja("Esq_Jiron_" + str(k), (jir_x[k], -0.1, jir_z[k]), (0.05, 0.03, 0.22), m_tela, rot=(0, 0.1 * (k - 3), 0))

# ==========================================
# 5. HOMBROS, BRAZOS Y MANOS
# ==========================================
for sx in [-1, 1]:
    s = str(sx)
    # Hombrera con dos pinchos
    esfera("Esq_Hombrera_" + s, (sx * 0.25, 0, 1.5), 0.11, m_armadura, escala=(1.2, 1.0, 0.7))
    apuntar("Esq_Pincho_Hombro_A_" + s, (sx * 0.3, 0, 1.56), (sx * 0.4, 0, 1.68), 0.025, 0.0, m_cuerno)
    apuntar("Esq_Pincho_Hombro_B_" + s, (sx * 0.27, -0.05, 1.55), (sx * 0.33, -0.12, 1.66), 0.02, 0.0, m_cuerno)

    S = (sx * 0.2, 0.0, 1.46)
    E = (sx * 0.4, 0.0, 1.2)
    W = (sx * 0.52, -0.02, 0.92)
    H = (sx * 0.56, -0.04, 0.8)

    hueso("Esq_Humero_" + s, S, E, 0.035, m_hueso)
    esfera("Esq_Codo_" + s, E, 0.045, m_hueso)
    hueso("Esq_Radio_" + s, E, W, 0.03, m_hueso)
    esfera("Esq_Muneca_" + s, W, 0.035, m_hueso)

    # Brazal de hierro en el antebrazo con dos pinchos hacia fuera
    brazal = punto_medio(E, W)
    caja("Esq_Brazal_" + s, brazal, (0.12, 0.12, 0.16), m_armadura, rot=rot_de(E, W))
    apuntar("Esq_Pincho_Brazal_A_" + s, (brazal[0] + sx * 0.06, brazal[1], brazal[2] + 0.03), (brazal[0] + sx * 0.14, brazal[1], brazal[2] + 0.06), 0.02, 0.0, m_cuerno)
    apuntar("Esq_Pincho_Brazal_B_" + s, (brazal[0] + sx * 0.06, brazal[1] - 0.04, brazal[2] - 0.03), (brazal[0] + sx * 0.12, brazal[1] - 0.06, brazal[2] - 0.05), 0.018, 0.0, m_cuerno)

    # Mano esquelética: palma, cuatro dedos curvados y pulgar
    caja("Esq_Palma_" + s, H, (0.08, 0.04, 0.09), m_hueso)
    for k in range(4):
        x0 = sx * (0.53 + k * 0.02)
        hueso("Esq_Dedo_" + s + "_" + str(k), (x0, -0.04, 0.8), (x0 + sx * 0.01, -0.07, 0.7), 0.011, m_hueso, vertices=6)
    hueso("Esq_Pulgar_" + s, (sx * 0.5, -0.04, 0.84), (sx * 0.47, -0.1, 0.76), 0.013, m_hueso, vertices=6)

# ==========================================
# 6. PIERNAS, GREBAS Y PIES
# ==========================================
for sx in [-1, 1]:
    s = str(sx)
    Hp = (sx * 0.12, 0.0, 0.9)
    Kn = (sx * 0.13, -0.02, 0.47)
    An = (sx * 0.13, 0.0, 0.1)

    hueso("Esq_Femur_" + s, Hp, Kn, 0.04, m_hueso)
    esfera("Esq_Rotula_" + s, (sx * 0.13, -0.05, 0.47), 0.06, m_armadura, escala=(1.0, 0.9, 1.0))
    hueso("Esq_Tibia_" + s, Kn, An, 0.03, m_hueso)
    esfera("Esq_Tobillo_" + s, An, 0.03, m_hueso)

    # Greba de hierro delante de la espinilla, con dos correas de cuero
    caja("Esq_Greba_" + s, (sx * 0.13, -0.04, 0.3), (0.12, 0.08, 0.36), m_armadura)
    caja("Esq_Correa_Greba_A_" + s, (sx * 0.13, -0.09, 0.36), (0.13, 0.02, 0.03), m_cuero)
    caja("Esq_Correa_Greba_B_" + s, (sx * 0.13, -0.09, 0.22), (0.13, 0.02, 0.03), m_cuero)

    # Pie óseo con los dedos hacia delante
    caja("Esq_Pie_" + s, (sx * 0.13, -0.1, 0.04), (0.1, 0.24, 0.04), m_hueso)
    for k in range(3):
        esfera("Esq_Dedo_Pie_" + s + "_" + str(k), (sx * (0.11 + k * 0.02), -0.23, 0.04), 0.02, m_hueso)

print("Esqueleto guerrero generado")
