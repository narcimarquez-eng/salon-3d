import bpy
import math

# COORD_MODE: Z_UP
# ==============================================================================
# BUGGY DE TROFEO DE DESIERTO (alto rendimiento, tipo Trophy Truck de 2 plazas)
# ==============================================================================
# Chasis espacial de tubo 4130 (cromoly) a la vista, con soldaduras TIG en cada nodo.
# Suspension de largo recorrido: doble triangulo delantero con barras de direccion,
# brazos traseros de caja y amortiguadores roscados con muelle helicoidal doble
# (dos muelles por amortiguador), topes de cuerda y depositos piggyback azules.
# Motor V8 biturbo en la parte trasera con filtro conico, intercooler, mangueras de
# silicona, poleas y correa serpentina, y colector de titanio azulado en doble salida.
# Ruedas forjadas tipo beadlock de cinco radios con pernos perimetrales, neumaticos
# de taco profundo, discos ventilados con pinzas rojas de seis pistones visibles
# a traves de los radios. Habitaculo abierto: asientos de carbono, arneses de cinco
# puntos, volante plano, cambio secuencial, freno de mano hidraulico y pantalla
# digital montada en la jaula. Carroceria de aluminio cepillado y carbono mate.
# Fuentes: especificacion del usuario. Medidas aproximadas: distancia entre ejes
# 2,9 m, via 2,0 m, neumaticos de 0,88 m de diametro, largo ~3,9 m.
# Ejes: X = ancho (simetrico), Y = largo (morro en Y negativo), Z = altura.
# Sin suelo ni fondo: solo el vehiculo, con las ruedas apoyadas en Z = 0 y centrado
# en X e Y. El fondo gris neutro lo pone el visor, no el GLB.
# Aproximaciones: el colector "trenzado" es una helice doble; los tacos del neumatico
# son bloques; el volante plano tiene una barra recta en la base.
# ==============================================================================

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)

# Motor de render del visor: EEVEE con luz ambiente, sol y oclusion
bpy.ops.render.set_engine(engine='BLENDER_EEVEE_NEXT', env_intensity=0.6, bloom=0.05)
bpy.ops.render.set_lighting(intensity=1.3, angle=35)
bpy.ops.render.set_ssao(intensity=1.2)

# ==========================================
# 0. FUNCIONES DE AYUDA
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

def resta(a, b):
    return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]

def suma(a, b):
    return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]

def escala_v(a, k):
    return [a[0] * k, a[1] * k, a[2] * k]

def cruz(a, b):
    return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]

def largo_v(a):
    return math.sqrt(a[0] * a[0] + a[1] * a[1] + a[2] * a[2])

def norma(a):
    n = largo_v(a)
    return [a[0] / n, a[1] / n, a[2] / n]

def base_perp(d):
    # Dos vectores unitarios perpendiculares a d (para muelles y desplazamientos)
    ref = [0.0, 0.0, 1.0]
    if d[2] * d[2] > 0.81:
        ref = [1.0, 0.0, 0.0]
    u = norma(cruz(d, ref))
    v = cruz(d, u)
    return [u, v]

def espejo(p):
    return [-p[0], p[1], p[2]]

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

def cilindro_entre(nombre, a, b, radio, mat, vertices=10):
    # Cilindro recto entre dos puntos (tubos, mangueras, pistones, depositos)
    dv = resta(b, a)
    horiz = math.sqrt(dv[0] * dv[0] + dv[1] * dv[1])
    L = largo_v(dv)
    centro = escala_v(suma(a, b), 0.5)
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radio, depth=L, location=centro, rotation=(0, math.atan2(horiz, dv[2]), math.atan2(dv[1], dv[0])))
    obj = bpy.context.active_object
    obj.name = nombre
    return asignar_mat(obj, mat)

def cono(nombre, centro, r1, r2, alto, mat, vertices=12, rot=(0, 0, 0)):
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

def aro(nombre, centro, radio, grosor, mat, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_torus_add(major_radius=radio, minor_radius=grosor, location=centro, rotation=rot)
    obj = bpy.context.active_object
    obj.name = nombre
    return asignar_mat(obj, mat)

def viga(nombre, a, b, grosor, mat):
    # Barra recta de seccion cuadrada entre a y b (brazos, arneses, radios, correas)
    dx = b[0] - a[0]
    dy = b[1] - a[1]
    dz = b[2] - a[2]
    horiz = math.sqrt(dx * dx + dy * dy)
    largo = math.sqrt(horiz * horiz + dz * dz)
    centro = ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2)
    return caja(nombre, centro, (largo, grosor, grosor), mat, rot=(0, -math.atan2(dz, horiz), math.atan2(dy, dx)))

def tubo(nombre, a, b, radio=0.022):
    # Tubo cromoly redondo con un cordon TIG (esfera oscura) en cada nodo
    cilindro_entre(nombre, a, b, radio, m_cromoly, 12)
    esfera(nombre + "_SoldA", a, radio + 0.008, m_soldadura, segmentos=8, anillos=5)
    esfera(nombre + "_SoldB", b, radio + 0.008, m_soldadura, segmentos=8, anillos=5)

def tubo_par(nombre, a, b, radio=0.022):
    tubo(nombre + "_D", a, b, radio)
    tubo(nombre + "_I", espejo(a), espejo(b), radio)

def viga_par(nombre, a, b, grosor, mat):
    viga(nombre + "_D", a, b, grosor, mat)
    viga(nombre + "_I", espejo(a), espejo(b), grosor, mat)

def punto_helice(A, dv, radio, u, v, t, th):
    c = math.cos(th)
    s = math.sin(th)
    return [A[0] + dv[0] * t + radio * (c * u[0] + s * v[0]),
            A[1] + dv[1] * t + radio * (c * u[1] + s * v[1]),
            A[2] + dv[2] * t + radio * (c * u[2] + s * v[2])]

def helice(nombre, A, B, radio, vueltas, segpv, grosor, mat, fase):
    # Muelle helicoidal (o hilo trenzado) hecho con segmentos rectos entre puntos de una helice
    dv = resta(B, A)
    base = base_perp(norma(dv))
    u = base[0]
    v = base[1]
    n = vueltas * segpv
    prev = punto_helice(A, dv, radio, u, v, 0.0, fase)
    for i in range(1, n + 1):
        t = i / n
        cur = punto_helice(A, dv, radio, u, v, t, 2 * math.pi * vueltas * t + fase)
        viga(nombre + "_" + str(i), prev, cur, grosor, mat)
        prev = cur

def amortiguador(nombre, A, B):
    # Amortiguador roscado: cuerpo, vastago, deposito piggyback azul, muelle exterior e interior y tope de cuerda
    dv = resta(B, A)
    d = norma(dv)
    base = base_perp(d)
    u = base[0]
    v = base[1]
    cilindro_entre(nombre + "_Cuerpo", A, B, 0.03, m_negro, 12)
    cilindro_entre(nombre + "_Vastago", B, suma(B, escala_v(d, 0.12)), 0.013, m_cromo, 10)
    o = escala_v(u, 0.11)
    P1 = suma(suma(A, o), escala_v(d, 0.05))
    P2 = suma(suma(B, o), escala_v(d, -0.12))
    cilindro_entre(nombre + "_Deposito", P1, P2, 0.028, m_azul, 14)
    viga(nombre + "_Manguera", suma(A, escala_v(d, 0.05)), P1, 0.01, m_negro)
    S1 = suma(A, escala_v(dv, 0.22))
    S2 = suma(A, escala_v(dv, 0.9))
    helice(nombre + "_Muelle", S1, S2, 0.058, 7, 8, 0.011, m_resorte, 0.0)
    helice(nombre + "_MuelleInt", S1, S2, 0.04, 5, 8, 0.008, m_cromo, 1.2)
    M = suma(A, escala_v(dv, 0.5))
    viga(nombre + "_Correa", suma(M, escala_v(v, 0.05)), suma(A, escala_v(v, 0.05)), 0.012, m_arnes)

def amortiguador_par(nombre, A, B):
    amortiguador(nombre + "_D", A, B)
    amortiguador(nombre + "_I", espejo(A), espejo(B))

def rueda(nombre, xw, yw):
    # Rueda completa: neumatico de taco profundo, llanta forjada beadlock con pernos,
    # cinco radios, buje, disco ventilado con taladros y pinza roja de seis pistones
    zw = 0.44
    sg = 1.0
    if xw < 0:
        sg = -1.0
    # Neumatico (aro grueso) y tacos del dibujo
    aro(nombre + "_Neumatico", (xw, yw, zw), 0.35, 0.09, m_neumatico, rot=(0, math.pi / 2, 0))
    for j in range(24):
        a = j * 2 * math.pi / 24
        caja(nombre + "_Taco_" + str(j), (xw, yw + 0.415 * math.cos(a), zw + 0.415 * math.sin(a)), (0.16, 0.06, 0.06), m_neumatico, rot=(a - math.pi / 2, 0, 0))
    # Barril de la llanta y anillos beadlock en ambas caras con pernos perimetrales
    cilindro(nombre + "_Barril", (xw, yw, zw), 0.27, 0.2, m_llanta, vertices=24, rot=(0, math.pi / 2, 0))
    for q in range(2):
        off = 0.1 - 0.2 * q
        ax = xw + sg * off
        cilindro(nombre + "_Beadlock_" + str(q), (ax, yw, zw), 0.275, 0.03, m_llanta, vertices=24, rot=(0, math.pi / 2, 0))
        for j in range(12):
            a = j * 2 * math.pi / 12
            cilindro(nombre + "_Perno_" + str(q) + "_" + str(j), (ax + sg * 0.02, yw + 0.265 * math.cos(a), zw + 0.265 * math.sin(a)), 0.011, 0.03, m_cromo, vertices=6, rot=(0, math.pi / 2, 0))
    # Cinco radios forjados en la cara exterior y buje
    ax0 = xw + sg * 0.1
    for j in range(5):
        a = j * 2 * math.pi / 5 + 0.3
        viga(nombre + "_Radio_" + str(j), (ax0, yw, zw), (ax0, yw + 0.24 * math.cos(a), zw + 0.24 * math.sin(a)), 0.026, m_llanta)
    cilindro(nombre + "_Buje", (ax0, yw, zw), 0.075, 0.05, m_cromo, vertices=12, rot=(0, math.pi / 2, 0))
    # Disco ventilado con taladros y pinza de seis pistones
    cilindro(nombre + "_Disco", (xw, yw, zw), 0.22, 0.03, m_disco, vertices=32, rot=(0, math.pi / 2, 0))
    for j in range(8):
        a = j * 2 * math.pi / 8
        cilindro(nombre + "_Taladro_" + str(j), (xw + sg * 0.016, yw + 0.17 * math.cos(a), zw + 0.17 * math.sin(a)), 0.012, 0.01, m_negro, vertices=6, rot=(0, math.pi / 2, 0))
    caja(nombre + "_Pinza", (xw, yw, zw + 0.2), (0.08, 0.14, 0.12), m_caliper)
    for q in range(2):
        ax = xw + (0.045 - 0.09 * q)
        for j in range(3):
            yy = yw + (-0.04 + 0.04 * j)
            cilindro(nombre + "_Piston_" + str(q) + "_" + str(j), (ax, yy, zw + 0.2), 0.018, 0.03, m_cromo, vertices=10, rot=(0, math.pi / 2, 0))

# ==========================================
# 1. MATERIALES (pocos y compartidos: cada material es una pieza al exportar)
# ==========================================
m_cromoly = material("TB_Cromoly_4130", (0.22, 0.22, 0.23, 1.0), 0.4, 0.9)
m_soldadura = material("TB_Soldadura_TIG", (0.12, 0.07, 0.04, 1.0), 0.5, 0.7)
m_carbono = material("TB_Carbono_Mate", (0.02, 0.02, 0.022, 1.0), 0.7, 0.1)
m_carbono.texture = "carbon_weave"
m_aluminio = material("TB_Aluminio_Cepillado", (0.62, 0.63, 0.65, 1.0), 0.32, 1.0)
m_azul = material("TB_Deposito_Azul", (0.03, 0.09, 0.42, 1.0), 0.3, 0.6, 1.0, 0.3)
m_resorte = material("TB_Muelle", (0.45, 0.3, 0.08, 1.0), 0.35, 1.0)
m_arnes = material("TB_Arnes_Tejido", (0.05, 0.05, 0.05, 1.0), 0.8)
m_arnes.texture = "woven_linen"
m_neumatico = material("TB_Neumatico", (0.012, 0.012, 0.012, 1.0), 0.9)
m_llanta = material("TB_Llanta_Forjada", (0.08, 0.08, 0.09, 1.0), 0.3, 0.9)
m_cromo = material("TB_Cromo", (0.8, 0.81, 0.83, 1.0), 0.12, 1.0)
m_disco = material("TB_Disco_Acero", (0.3, 0.3, 0.31, 1.0), 0.45, 0.9)
m_caliper = material("TB_Pinza_Roja", (0.55, 0.02, 0.02, 1.0), 0.35, 0.2)
m_negro = material("TB_Negro_Mate", (0.012, 0.012, 0.013, 1.0), 0.6, 0.2)
m_pantalla = material("TB_Pantalla_Digital", (0.05, 0.5, 0.9, 1.0), 0.3, 0.0, 1.0, 0.0, 2.0)
m_luz = material("TB_Luz_LED", (1.0, 0.95, 0.85, 1.0), 0.3, 0.0, 1.0, 0.0, 4.0)
m_piloto = material("TB_Piloto_Rojo", (0.9, 0.02, 0.01, 1.0), 0.3, 0.0, 1.0, 0.0, 2.0)
m_titan = material("TB_Titanio_Azulado", (0.2, 0.22, 0.36, 1.0), 0.35, 0.9)
m_silicona = material("TB_Silicona_Roja", (0.5, 0.03, 0.02, 1.0), 0.5)

# ==========================================
# 2. CHASIS ESPACIAL (tubo 4130 con soldaduras)
# ==========================================
# Largueros y travesanos inferiores
tubo_par("Larguero_Inferior", [0.42, -1.5, 0.45], [0.42, 1.5, 0.45])
tubo("Travesano_Morro", [-0.42, -1.5, 0.45], [0.42, -1.5, 0.45])
tubo("Travesano_Central_F", [-0.42, -0.5, 0.45], [0.42, -0.5, 0.45])
tubo("Travesano_Central_R", [-0.42, 0.35, 0.45], [0.42, 0.35, 0.45])
tubo("Travesano_Trasero", [-0.42, 1.5, 0.45], [0.42, 1.5, 0.45])
# Jaula delantera (cabina)
tubo_par("Pilar_Delantero", [0.42, -0.5, 0.45], [0.5, -0.5, 1.35])
tubo("Arco_Delantero", [-0.5, -0.5, 1.35], [0.5, -0.5, 1.35])
tubo("Riostra_Delantera", [-0.464, -0.5, 0.95], [0.464, -0.5, 0.95])
# Aro antivuelco principal con cruces en X
tubo_par("Pilar_Aro", [0.42, 0.35, 0.45], [0.55, 0.35, 1.85])
tubo("Arco_Antivuelco", [-0.55, 0.35, 1.85], [0.55, 0.35, 1.85])
tubo("Cruz_Antivuelco_A", [-0.42, 0.35, 0.45], [0.55, 0.35, 1.85])
tubo("Cruz_Antivuelco_B", [0.42, 0.35, 0.45], [-0.55, 0.35, 1.85])
# Techo y costados
tubo_par("Costado_Superior", [0.5, -0.5, 1.35], [0.5, 1.5, 1.25])
tubo_par("Techo_Delantero", [0.5, -0.5, 1.35], [0.55, 0.35, 1.85])
tubo_par("Techo_Trasero", [0.55, 0.35, 1.85], [0.5, 1.5, 1.25])
tubo("Travesano_Techo", [-0.529, 0.0, 1.644], [0.529, 0.0, 1.644])
# Diagonales de costado en X
tubo_par("Diagonal_Costado_A", [0.42, -0.5, 0.45], [0.5, 0.35, 1.85])
tubo_par("Diagonal_Costado_B", [0.42, 0.35, 0.45], [0.5, -0.5, 1.35])
# Mamparo trasero del motor
tubo_par("Pilar_Trasero", [0.42, 1.5, 0.45], [0.5, 1.5, 1.25])
tubo("Arco_Trasero_Bajo", [-0.5, 1.5, 1.25], [0.5, 1.5, 1.25])
tubo("Riostra_Trasera", [-0.46, 1.5, 0.85], [0.46, 1.5, 0.85])
# Torretas de los brazos superiores delanteros
tubo_par("Torreta_F_A", [0.42, -1.5, 0.45], [0.42, -1.5, 0.92])
tubo_par("Torreta_F_B", [0.42, -1.15, 0.45], [0.42, -1.15, 0.92])
# Parachoques delantero de tubo cromoly
tubo_par("Soporte_Morro", [0.42, -1.5, 0.45], [0.42, -1.9, 0.42])
tubo("Parachoques_Cromoly", [-0.55, -1.9, 0.42], [0.55, -1.9, 0.42])
# Soporte del aleron trasero (tubo cuadrado)
viga_par("Soporte_Aleron", [0.5, 1.6, 1.2], [0.6, 1.75, 1.74], 0.04, m_cromoly)

# ==========================================
# 3. SUSPENSION DELANTERA: DOBLE TRIANGULO LARGO RECORRIDO
# ==========================================
HF = [1.0, -1.45, 0.44]
UF = [0.98, -1.35, 0.98]
tubo_par("BrazoInf_F_A", [0.42, -1.5, 0.45], HF)
tubo_par("BrazoInf_F_B", [0.42, -1.1, 0.45], HF)
tubo_par("BrazoSup_F_A", [0.42, -1.5, 0.92], UF)
tubo_par("BrazoSup_F_B", [0.42, -1.15, 0.92], UF)
tubo_par("Montante_F", HF, UF)
# Cremallera de direccion y barras de union con las manguetas
tubo("Cremallera_F", [-0.42, -1.62, 0.6], [0.42, -1.62, 0.6])
tubo_par("Tirante_Direccion_F", [0.42, -1.62, 0.6], [0.98, -1.55, 0.62])
# Amortiguadores delanteros: anclaje inferior en el brazo, superior en la jaula
amortiguador_par("Amort_F", [0.72, -1.29, 0.44], [0.5, -0.5, 1.35])

# ==========================================
# 4. SUSPENSION TRASERA: BRAZOS DE CAJA
# ==========================================
HR = [1.0, 1.45, 0.44]
viga_par("BrazoTras_R", [0.42, 1.3, 0.45], HR, 0.09, m_cromoly)
viga_par("Eslabon_R", [0.5, 1.5, 1.25], [0.98, 1.4, 0.92], 0.07, m_cromoly)
amortiguador_par("Amort_R", [0.7, 1.37, 0.45], [0.5, 1.0, 1.27])
# Eje trasero y caja diferencial de aluminio
cilindro_entre("Eje_R", [-0.98, 1.45, 0.44], [0.98, 1.45, 0.44], 0.06, m_aluminio, 12)
caja("Diferencial_R", (0, 1.45, 0.44), (0.3, 0.28, 0.26), m_aluminio)

# ==========================================
# 5. RUEDAS (cuatro)
# ==========================================
rueda("Rueda_DI", -1.0, -1.45)
rueda("Rueda_DD", 1.0, -1.45)
rueda("Rueda_TI", -1.0, 1.45)
rueda("Rueda_TD", 1.0, 1.45)

# ==========================================
# 6. MOTOR V8 BITURBO EN LA PARTE TRASERA
# ==========================================
caja("Motor_Bloque", (0, 1.0, 0.85), (0.78, 0.8, 0.6), m_negro)
for q in range(2):
    s = 1 - 2 * q
    caja("Motor_Culata_" + str(q), (s * 0.22, 1.0, 1.2), (0.2, 0.8, 0.1), m_negro)
    cilindro("Turbo_" + str(q), (s * 0.42, 0.9, 1.0), 0.1, 0.22, m_titan, vertices=14, rot=(math.pi / 2, 0, 0))
    cilindro_entre("Silicona_Turbo_" + str(q), [s * 0.42, 0.79, 1.0], [s * 0.3, 0.56, 1.0], 0.04, m_silicona, 10)
    cilindro_entre("Silicona_Entrada_" + str(q), [0, 0.2, 1.15], [s * 0.42, 0.79, 1.0], 0.04, m_silicona, 10)
caja("Colector_Admision", (0, 0.98, 1.36), (0.34, 0.5, 0.12), m_aluminio)
caja("Intercooler", (0, 0.5, 1.0), (0.7, 0.12, 0.3), m_aluminio)
cilindro_entre("Silicona_Plenum", [0, 0.5, 1.15], [0, 0.74, 1.3], 0.045, m_silicona, 10)
# Filtro de aire conico
cono("Filtro_Cono", (0, 0.2, 1.3), 0.13, 0.08, 0.3, m_negro, vertices=16)
# Poleas y correa serpentina en la cara delantera del motor
cilindro("Polea_Ciguenal", (0, 0.58, 0.62), 0.07, 0.04, m_aluminio, vertices=16, rot=(math.pi / 2, 0, 0))
cilindro("Polea_Alternador", (0.22, 0.58, 0.92), 0.05, 0.04, m_aluminio, vertices=14, rot=(math.pi / 2, 0, 0))
cilindro("Polea_Bomba", (-0.22, 0.58, 0.92), 0.06, 0.04, m_aluminio, vertices=14, rot=(math.pi / 2, 0, 0))
aro("Correa_Serpentina", (0, 0.58, 0.8), 0.27, 0.012, m_negro, rot=(math.pi / 2, 0, 0))
# Colectores de titanio: cuatro tubos por banco hasta el colector y helice doble trenzada
for q in range(2):
    s = 1 - 2 * q
    for j in range(4):
        cilindro_entre("Primario_" + str(q) + "_" + str(j), [s * 0.26, 0.78 + 0.15 * j, 1.0], [s * 0.45, 1.5, 0.6], 0.02, m_titan, 8)
    helice("Escape_Trenzado_" + str(q) + "_a", [s * 0.45, 1.5, 0.6], [s * 0.5, 1.95, 0.56], 0.045, 2, 10, 0.02, m_titan, 0.0)
    helice("Escape_Trenzado_" + str(q) + "_b", [s * 0.45, 1.5, 0.6], [s * 0.5, 1.95, 0.56], 0.045, 2, 10, 0.02, m_titan, math.pi)
    cilindro_entre("Punta_Escape_" + str(q), [s * 0.5, 1.92, 0.56], [s * 0.5, 1.97, 0.56], 0.05, m_titan, 12)

# ==========================================
# 7. CARROCERIA (carbono mate y aluminio cepillado, con pernos)
# ==========================================
caja("Piso_Carbono", (0, -0.1, 0.46), (0.84, 3.0, 0.03), m_carbono)
for q in range(2):
    s = 1 - 2 * q
    caja("Falda_Aluminio_" + str(q), (s * 0.56, -0.05, 0.6), (0.02, 1.9, 0.2), m_aluminio)
caja("Morro_Carbono", (0, -1.45, 0.72), (0.95, 0.85, 0.22), m_carbono)
caja("Parachoques_Aluminio", (0, -1.9, 0.5), (1.2, 0.06, 0.2), m_aluminio)
caja("Barra_LED", (0, -1.91, 0.7), (0.8, 0.02, 0.04), m_luz)
caja("Tablero_Carbono", (0, -0.7, 0.78), (0.9, 0.12, 0.2), m_carbono)
for q in range(2):
    s = 1 - 2 * q
    for j in range(2):
        yj = -1.45 + 2.9 * j
        caja("Guardabarros_" + str(q) + "_" + str(j), (s * 1.12, yj, 1.02), (0.5, 0.95, 0.04), m_aluminio)
        caja("Pestana_" + str(q) + "_" + str(j), (s * 1.36, yj, 0.82), (0.04, 0.95, 0.3), m_aluminio)
        for a2 in range(2):
            for b2 in range(2):
                xb = s * (0.95 + 0.35 * b2)
                yb = yj - 0.35 + 0.7 * a2
                cilindro("Perno_Panel_" + str(q) + "_" + str(j) + "_" + str(a2) + str(b2), (xb, yb, 1.05), 0.012, 0.02, m_cromo, vertices=6)
caja("Panel_Trasero", (0, 1.62, 1.22), (1.2, 0.05, 0.42), m_aluminio)
caja("Aleron", (0, 1.8, 1.78), (1.8, 0.3, 0.04), m_carbono)
for q in range(2):
    s = 1 - 2 * q
    caja("Placa_Aleron_" + str(q), (s * 0.9, 1.8, 1.78), (0.02, 0.3, 0.12), m_carbono)
    caja("Piloto_" + str(q), (s * 0.6, 1.665, 1.02), (0.2, 0.02, 0.05), m_piloto)

# ==========================================
# 8. HABITACULO ABIERTO: ASIENTOS, ARNESES, VOLANTE Y MANDOS
# ==========================================
for q in range(2):
    s = 1 - 2 * q
    sx = s * 0.3
    caja("Asiento_Base_" + str(q), (sx, 0.0, 0.6), (0.42, 0.55, 0.14), m_carbono)
    caja("Asiento_Respaldo_" + str(q), (sx, 0.28, 0.95), (0.42, 0.1, 0.6), m_carbono)
    caja("Apoyacabezas_" + str(q), (sx, 0.28, 1.2), (0.3, 0.1, 0.14), m_carbono)
    # Arnes de cinco puntos: dos hombros, dos cinturones y un entrepierna
    viga("Arnes_Hombro_A_" + str(q), (sx - 0.16, 0.22, 1.22), (sx - 0.06, -0.2, 0.66), 0.024, m_arnes)
    viga("Arnes_Hombro_B_" + str(q), (sx + 0.16, 0.22, 1.22), (sx + 0.06, -0.2, 0.66), 0.024, m_arnes)
    viga("Arnes_Cintura_A_" + str(q), (sx - 0.2, -0.22, 0.68), (sx, -0.22, 0.6), 0.024, m_arnes)
    viga("Arnes_Cintura_B_" + str(q), (sx + 0.2, -0.22, 0.68), (sx, -0.22, 0.6), 0.024, m_arnes)
    viga("Arnes_Entrepierna_" + str(q), (sx, -0.22, 0.6), (sx, -0.02, 0.5), 0.024, m_arnes)

# Volante plano de carreras (base recta) con columna
cx = -0.3
cy = -0.55
cz = 0.95
aro("Volante_Aro", (cx, cy, cz), 0.18, 0.016, m_carbono, rot=(math.pi / 2, 0, 0))
viga("Volante_Base_Plana", (cx - 0.15, cy, cz - 0.12), (cx + 0.15, cy, cz - 0.12), 0.03, m_carbono)
for k in range(3):
    a = k * 2 * math.pi / 3
    viga("Volante_Radio_" + str(k), (cx, cy, cz), (cx + 0.18 * math.cos(a), cy, cz + 0.18 * math.sin(a)), 0.02, m_negro)
cilindro("Volante_Buje", (cx, cy, cz), 0.04, 0.03, m_negro, vertices=12, rot=(math.pi / 2, 0, 0))
cilindro_entre("Volante_Columna", [cx, cy + 0.02, cz], [cx, -0.7, 0.7], 0.02, m_cromo, 10)

# Pedales
for k in range(3):
    caja("Pedal_" + str(k), (-0.4 + 0.1 * k, -0.36, 0.56), (0.07, 0.1, 0.2), m_cromo)

# Cambio secuencial con pomo de carbono
cilindro_entre("Cambio_Palanca", [0.0, -0.25, 0.6], [0.0, -0.25, 0.95], 0.016, m_cromo, 10)
esfera("Cambio_Pomo", (0.0, -0.25, 0.97), 0.03, m_carbono, segmentos=10, anillos=6)

# Freno de mano hidraulico vertical: cilindro maestro cromado y palanca
cilindro_entre("Freno_Cilindro", [-0.55, -0.1, 0.55], [-0.55, -0.1, 0.72], 0.03, m_cromo, 12)
cilindro_entre("Freno_Palanca", [-0.55, -0.1, 0.72], [-0.55, -0.2, 1.0], 0.012, m_negro, 8)
caja("Freno_Empunadura", (-0.55, -0.22, 1.02), (0.05, 0.05, 0.12), m_carbono)

# Pantalla digital montada en la jaula
cilindro_entre("Pantalla_Soporte", [0.0, -0.5, 1.35], [0.0, -0.6, 1.3], 0.014, m_cromoly, 10)
caja("Pantalla_Marco", (0, -0.6, 1.22), (0.36, 0.03, 0.18), m_negro)
caja("Pantalla_Digital", (0, -0.615, 1.22), (0.32, 0.01, 0.14), m_pantalla)
