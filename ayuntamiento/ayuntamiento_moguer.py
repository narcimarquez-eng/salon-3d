import bpy
import math

# ==============================================================================
# AYUNTAMIENTO DE MOGUER (Huelva) - Casa consistorial de dos plantas
# ==============================================================================
# Incluye:
# - Fachada principal de dos plantas con arcadas de medio punto en ambas alturas
# - Portada central con puerta de madera, reja de forja y marco ocre
# - Cuerpo central ("torre del reloj") con esfera, cimborrio piramidal y mástil
# - Pilastras y molduras ocres, zócalo de piedra y cubierta de teja
# - Balcones corridos con barandilla de forja en la planta alta
# - Plaza empedrada con palmeras a ambos lados
# Ejes: X = ancho de la fachada, Y = profundidad (la fachada mira a Y negativo),
#       Z = altura. La plaza queda delante de la fachada.
# ==============================================================================

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)

# ==========================================
# 1. MATERIALES PBR
# ==========================================
def material(nombre, color, rugosidad=0.8, metalico=0.0):
    mat = bpy.data.materials.new(name=nombre)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Base Color"].default_value = color
        bsdf.inputs["Roughness"].default_value = rugosidad
        if "Metallic" in bsdf.inputs:
            bsdf.inputs["Metallic"].default_value = metalico
    return mat

mat_cal        = material("Cal_Blanca_Fachada", (0.94, 0.92, 0.86, 1.0), 0.85)
mat_ocre       = material("Ocre_Amarillo_Molduras", (0.90, 0.70, 0.30, 1.0), 0.60)
mat_zocalo     = material("Zocalo_Piedra_Gris", (0.58, 0.55, 0.50, 1.0), 0.90)
mat_teja       = material("Teja_Cubierta_Terracota", (0.60, 0.30, 0.18, 1.0), 0.80)
mat_hueco      = material("Hueco_Sombra_Interior", (0.09, 0.07, 0.06, 1.0), 0.95)
mat_madera     = material("Madera_Puerta_Consistorial", (0.30, 0.18, 0.10, 1.0), 0.70)
mat_forja      = material("Forja_Negra_Rejas", (0.08, 0.08, 0.09, 1.0), 0.40, 0.80)
mat_reloj      = material("Esfera_Reloj_Marfil", (0.97, 0.96, 0.92, 1.0), 0.35)
mat_empedrado  = material("Plaza_Empedrado_Claro", (0.78, 0.74, 0.66, 1.0), 0.90)
mat_tronco     = material("Tronco_Palmera", (0.45, 0.34, 0.22, 1.0), 0.90)
mat_palma      = material("Hojas_Palmera", (0.16, 0.42, 0.14, 1.0), 0.70)
mat_bandera_v  = material("Bandera_Verde_Andalucia", (0.05, 0.50, 0.24, 1.0), 0.70)
mat_bandera_b  = material("Bandera_Blanca", (0.95, 0.95, 0.95, 1.0), 0.70)
mat_mastil     = material("Metal_Mastil", (0.60, 0.60, 0.60, 1.0), 0.30, 0.90)

# ==========================================
# 2. PRIMITIVAS Y CONSTRUCTORES
# ==========================================
def asignar_mat(obj, mat):
    if mat:
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

def cilindro(nombre, centro, radio, alto, mat, vertices=16, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radio, depth=alto, location=centro, rotation=rot)
    obj = bpy.context.active_object
    obj.name = nombre
    return asignar_mat(obj, mat)

def cono(nombre, centro, r1, r2, alto, mat, vertices=8, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cone_add(vertices=vertices, radius1=r1, radius2=r2, depth=alto, location=centro, rotation=rot)
    obj = bpy.context.active_object
    obj.name = nombre
    return asignar_mat(obj, mat)

def dovelas(prefijo, cx, zs, radio, y, mat, n=8):
    # Arco de medio punto formado por dovelas: cada una gira para apuntar al centro
    for k in range(n + 1):
        th = math.pi * k / n
        px = cx + radio * math.cos(th)
        pz = zs + radio * math.sin(th)
        caja(f"{prefijo}_Dovela_{k}", (px, y, pz), (0.30, 0.16, 0.36), mat, rot=(0, -th, 0))

def abertura(prefijo, cx, zbase, ancho, zs, y, mat):
    # Hueco rectangular hasta la línea de impostas + semicírculo superior
    alto = zs - zbase
    caja(f"{prefijo}_Hueco", (cx, y, zbase + alto * 0.5), (ancho, 0.06, alto), mat)
    cilindro(f"{prefijo}_Hueco_Arco", (cx, y, zs), ancho * 0.5, 0.06, mat, vertices=24, rot=(math.pi / 2, 0, 0))

# ==========================================
# 3. CUERPO PRINCIPAL DE DOS PLANTAS
# ==========================================
# Fachada principal en y = -7.0. Ancho total 44 m, profundidad 14 m.
caja("Cuerpo_Planta_Baja", (0, 0, 2.6), (44.0, 14.0, 5.2), mat_cal)
caja("Cuerpo_Planta_Alta", (0, 0, 7.8), (44.0, 14.0, 5.2), mat_cal)
caja("Zocalo_Piedra", (0, 0, 0.2), (44.4, 14.4, 0.4), mat_zocalo)
caja("Imposta_Planta_Alta", (0, -7.25, 5.2), (44.4, 0.5, 0.3), mat_ocre)
caja("Cornisa_Superior", (0, -7.3, 10.6), (44.6, 0.6, 0.5), mat_ocre)
caja("Cubierta_Teja", (0, 0, 11.2), (44.2, 14.2, 0.8), mat_teja)

# Esquinas con sillares ocres
for sx in [-1, 1]:
    for sy in [-1, 1]:
        caja(f"Esquina_Ocre_{sx}_{sy}", (sx * 21.8, sy * 7.0, 5.3), (0.8, 0.8, 10.6), mat_ocre)

# Pilastras ocres entre arcos de ambas plantas
xs_pilastras = [-18.0, -14.0, -10.0, -6.0, -2.0, 2.0, 6.0, 10.0, 14.0, 18.0]
for i, x in enumerate(xs_pilastras):
    caja(f"Pilastra_Fachada_{i}", (x, -7.1, 5.2), (0.42, 0.25, 10.4), mat_ocre)

# ==========================================
# 4. ARCADAS DE LA FACHADA (PLANTA BAJA Y ALTA)
# ==========================================
xs_arcos = [-16.0, -12.0, -8.0, -4.0, 4.0, 8.0, 12.0, 16.0]
for i, x in enumerate(xs_arcos):
    # Planta baja: arcada de medio punto, ancho 2.4 m
    abertura(f"Arco_Baja_{i}", x, 0.5, 2.4, 3.0, -7.03, mat_hueco)
    dovelas(f"Arco_Baja_{i}", x, 3.0, 1.45, -7.09, mat_ocre)
    # Planta alta: ventanal de medio punto con balcón corrido
    abertura(f"Arco_Alta_{i}", x, 5.9, 1.9, 7.3, -7.03, mat_hueco)
    dovelas(f"Arco_Alta_{i}", x, 7.3, 1.2, -7.09, mat_cal)
    caja(f"Balcon_Losa_{i}", (x, -7.5, 5.42), (2.6, 1.0, 0.22), mat_cal)
    caja(f"Balcon_Pasamanos_{i}", (x, -7.95, 6.45), (2.6, 0.06, 0.06), mat_forja)
    for j in range(9):
        bx = x - 1.2 + j * 0.3
        cilindro(f"Balcon_Barrote_{i}_{j}", (bx, -7.95, 6.0), 0.025, 1.0, mat_forja, vertices=8)

# ==========================================
# 5. PORTADA CENTRAL CON PUERTA Y REJA
# ==========================================
abertura("Portada", 0.0, 0.5, 2.8, 2.9, -7.03, mat_madera)
dovelas("Portada", 0.0, 2.9, 1.6, -7.11, mat_ocre)
caja("Portada_Jamba_Izq", (-1.56, -7.12, 2.15), (0.28, 0.28, 4.3), mat_ocre)
caja("Portada_Jamba_Der", (1.56, -7.12, 2.15), (0.28, 0.28, 4.3), mat_ocre)
for j in range(11):
    bx = -1.25 + j * 0.25
    cilindro(f"Reja_Barrote_{j}", (bx, -7.14, 1.65), 0.025, 2.5, mat_forja, vertices=8)
caja("Reja_Travesano_Bajo", (0, -7.14, 1.1), (2.8, 0.05, 0.05), mat_forja)
caja("Reja_Travesano_Alto", (0, -7.14, 2.2), (2.8, 0.05, 0.05), mat_forja)

# ==========================================
# 6. CUERPO CENTRAL: TORRE DEL RELOJ
# ==========================================
caja("Torre_Cuerpo", (0, 0, 14.6), (9.0, 14.0, 6.0), mat_cal)
caja("Torre_Cornisa", (0, -7.25, 17.8), (9.6, 0.5, 0.4), mat_ocre)
caja("Torre_Cornisa_Lateral_Der", (4.8, 0, 17.8), (0.4, 14.5, 0.4), mat_ocre)
caja("Torre_Cornisa_Lateral_Izq", (-4.8, 0, 17.8), (0.4, 14.5, 0.4), mat_ocre)
for sx in [-1, 1]:
    caja(f"Torre_Pilastra_{sx}", (sx * 3.9, -7.1, 14.6), (0.4, 0.25, 6.0), mat_ocre)

# Esfera del reloj con aro ocre
cilindro("Reloj_Aro", (0, -7.1, 14.6), 1.65, 0.14, mat_ocre, vertices=32, rot=(math.pi / 2, 0, 0))
cilindro("Reloj_Esfera", (0, -7.12, 14.6), 1.5, 0.22, mat_reloj, vertices=32, rot=(math.pi / 2, 0, 0))
caja("Reloj_Manecilla_Larga", (0, -7.27, 14.95), (0.09, 0.05, 0.7), mat_forja)
caja("Reloj_Manecilla_Corta", (0.27, -7.27, 14.6), (0.55, 0.05, 0.09), mat_forja)

# Cimborrio piramidal, mástil y bandera andaluza
cono("Torre_Tejado_Piramide", (0, 0, 19.6), 6.4, 0.0, 3.2, mat_teja, vertices=4, rot=(0, 0, math.pi / 4))
cilindro("Torre_Mastil", (0, 0, 22.8), 0.06, 3.2, mat_mastil, vertices=8)
caja("Bandera_Franja_Verde_Sup", (1.2, 0, 23.9), (2.2, 0.05, 0.5), mat_bandera_v)
caja("Bandera_Franja_Blanca", (1.2, 0, 23.4), (2.2, 0.05, 0.5), mat_bandera_b)
caja("Bandera_Franja_Verde_Inf", (1.2, 0, 22.9), (2.2, 0.05, 0.5), mat_bandera_v)

# Ventanas de la trasera (cara Y positiva)
for i, x in enumerate(xs_arcos):
    caja(f"Ventana_Trasera_Baja_{i}", (x, 7.03, 2.2), (1.4, 0.06, 2.4), mat_hueco)
    caja(f"Ventana_Trasera_Alta_{i}", (x, 7.03, 6.9), (1.2, 0.06, 2.0), mat_hueco)

# ==========================================
# 7. PLAZA EMPEDRADA Y PALMERAS
# ==========================================
caja("Plaza_Empedrado", (0, -20.0, 0.02), (62.0, 26.0, 0.04), mat_empedrado)

def palmera(prefijo, x, y, altura):
    cono(f"{prefijo}_Tronco", (x, y, altura * 0.5), 0.30, 0.18, altura, mat_tronco, vertices=8)
    tilt = 0.55
    largo = 3.4
    for k in range(9):
        a = 2.0 * math.pi * k / 9
        cx = x + largo * 0.5 * math.cos(tilt) * math.cos(a)
        cy = y + largo * 0.5 * math.cos(tilt) * math.sin(a)
        cz = altura + 0.1 - largo * 0.5 * math.sin(tilt)
        caja(f"{prefijo}_Hoja_{k}", (cx, cy, cz), (largo, 0.4, 0.05), mat_palma, rot=(0, tilt, a))

palmera("Palmera_1", -27.0, -13.0, 8.5)
palmera("Palmera_2", 27.0, -13.0, 8.5)
palmera("Palmera_3", -17.0, -27.0, 7.5)
palmera("Palmera_4", 17.0, -27.0, 7.5)

# ==========================================
# 8. ZOCALO Y ESCALONES DE ACCESO
# ==========================================
for k in range(3):
    caja(f"Escalon_Acceso_{k}", (0, -7.6 - k * 0.4, 0.1 + k * 0.1), (6.0, 0.4, 0.2 + k * 0.2), mat_zocalo)

print("Ayuntamiento de Moguer generado")
