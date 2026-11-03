import bpy
import math

# COORD_MODE: Z_UP
# ==============================================================================
# ERMITA DE MONTEMAYOR (Moguer, Huelva) - reconstrucción aproximada
# ==============================================================================
# Reconstrucción de una ermita andaluza de nave única con cabecera ochavada,
# fachada de cal con espadaña de dos campanas, portada de ladrillo mudéjar,
# cubierta de teja árabe, patio de acceso con cipreses y muro bajo.
# Nota: la forma exacta de la ermita no se ha verificado con planos ni fotos;
# las proporciones y los detalles son típicos de la arquitectura de la zona.
# Ejes: X = ancho, Y = profundidad (la fachada mira a Y negativo), Z = altura.
# ==============================================================================

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)

# Render con volumen (EEVEE), luz suave y oclusión para los relieves
bpy.ops.render.set_engine(engine='BLENDER_EEVEE_NEXT', env_intensity=0.6, bloom=0.06)
bpy.ops.render.set_lighting(intensity=1.3, angle=35)
bpy.ops.render.set_ssao(intensity=1.3)

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

def cono(nombre, centro, r1, r2, alto, mat, vertices=8, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cone_add(vertices=vertices, radius1=r1, radius2=r2, depth=alto, location=centro, rotation=rot)
    obj = bpy.context.active_object
    obj.name = nombre
    return asignar_mat(obj, mat)

def esfera(nombre, centro, radio, mat, escala=(1.0, 1.0, 1.0)):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=10, ring_count=6, radius=radio, location=centro)
    obj = bpy.context.active_object
    obj.name = nombre
    obj.scale = escala
    return asignar_mat(obj, mat)

def arco_escalonado(prefijo, x, y, z_base, ancho, alto, mat, pasos=6, marco=None):
    # Vano con remate de medio punto por escalones (frente a Y negativo)
    rad = ancho / 2
    if marco:
        rm = rad + 0.25
        caja(prefijo + "_Jamba_I", (x - rm, y, z_base + alto / 2), (0.25, 0.4, alto), marco)
        caja(prefijo + "_Jamba_D", (x + rm, y, z_base + alto / 2), (0.25, 0.4, alto), marco)
        for k in range(pasos):
            h = (k + 0.5) / pasos * rm
            w = 2 * math.sqrt(max(0.0, rm * rm - h * h))
            caja(prefijo + "_Dovela_" + str(k), (x, y, z_base + alto + h), (w, 0.4, rm / pasos + 0.02), marco)
    caja(prefijo + "_Vano", (x, y, z_base + alto / 2), (ancho, 0.3, alto), mat)
    for k in range(pasos):
        h = (k + 0.5) / pasos * rad
        w = 2 * math.sqrt(max(0.0, rad * rad - h * h))
        caja(prefijo + "_Arco_" + str(k), (x, y, z_base + alto + h), (w, 0.3, rad / pasos + 0.02), mat)

# ==========================================
# 1. MATERIALES (texturas explícitas; la cal y la teja usan las del repo)
# ==========================================
m_cal = material("EM_Cal_Blanca", (0.92, 0.90, 0.84, 1.0), 0.8)
m_cal.color_map = "cal_blanca"
m_cal.color_map_scale = 2.0
m_teja = material("EM_Teja_Arabe", (0.62, 0.32, 0.18, 1.0), 0.8)
m_teja.color_map = "teja_arcilla"
m_teja.color_map_scale = 2.5
m_teja.texture = "terracotta_roof"
m_teja.texture_repeat = 6
m_ladrillo = material("EM_Ladrillo_Mudejar", (0.55, 0.24, 0.12, 1.0), 0.85)
m_ladrillo.texture = "brick_mudejar"
m_ladrillo.texture_repeat = 6
m_piedra = material("EM_Piedra_Sillar", (0.80, 0.75, 0.64, 1.0), 0.7)
m_piedra.texture = "stone_ashlar"
m_piedra.texture_repeat = 4
m_suelo = material("EM_Empedrado", (0.62, 0.55, 0.44, 1.0), 0.9)
m_suelo.texture = "cobblestone"
m_suelo.texture_repeat = 8
m_madera = material("EM_Madera_Puerta", (0.30, 0.17, 0.08, 1.0), 0.7)
m_madera.texture = "wood_oak"
m_madera.texture_repeat = 3
m_hierro = material("EM_Hierro_Forja", (0.12, 0.12, 0.13, 1.0), 0.45, 0.8)
m_hierro.texture = "brushed_metal"
m_bronce = material("EM_Campana_Bronce", (0.62, 0.42, 0.18, 1.0), 0.35, 0.9)
m_hueco = material("EM_Hueco_Oscuro", (0.04, 0.035, 0.03, 1.0), 0.95)
m_cipres = material("EM_Cipres", (0.10, 0.24, 0.12, 1.0), 0.85)
m_tronco = material("EM_Tronco_Cipres", (0.30, 0.20, 0.12, 1.0), 0.9)
m_azulejo = material("EM_Azulejo_Azul", (0.10, 0.28, 0.60, 1.0), 0.3)
m_azulejo.texture = "andalusi_tiles"
m_azulejo.texture_repeat = 3
m_cristal = material("EM_Vidrio_Emplomado", (0.55, 0.70, 0.75, 1.0), 0.15)
m_cristal.texture = "stained_glass"
m_cristal.texture_repeat = 1

# ==========================================
# 2. SUELO: PLAZA DE ACCESO Y ESCALONES
# ==========================================
caja("EM_Patio_Empedrado", (0, -12.0, 0.04), (26.0, 16.0, 0.08), m_suelo)
caja("EM_Plataforma", (0, 0, 0.25), (17.0, 22.0, 0.5), m_piedra)
for k in range(3):
    caja("EM_Escalon_" + str(k), (0, -8.9 - k * 0.45, 0.3 + k * 0.12), (5.0 - k * 0.3, 0.5, 0.24 + k * 0.12), m_piedra)

# ==========================================
# 3. NAVE: MUROS DE CAL CON CONTRAFUERTES
# ==========================================
W, L, H = 8.0, 16.0, 7.0
caja("EM_Nave_Muro", (0, 0, H / 2 + 0.5), (W, L, H), m_cal)
for sx in [-1, 1]:
    for yy in [-5.0, 0.0, 5.0]:
        caja("EM_Contrafuerte_" + str(sx) + "_" + str(yy), (sx * (W / 2 + 0.35), yy, 2.6), (0.7, 1.2, 5.0), m_cal)
        caja("EM_Contrafuerte_Remate_" + str(sx) + "_" + str(yy), (sx * (W / 2 + 0.35), yy, 5.3), (0.85, 1.35, 0.25), m_piedra)
    # Hiladas de ladrillo en las esquinas (sillares de quoin)
    for k in range(5):
        caja("EM_Esquina_" + str(sx) + "_" + str(k), (sx * (W / 2 + 0.02), -L / 2 - 0.02, 0.9 + k * 1.2), (0.55, 0.22, 0.5), m_ladrillo)
        caja("EM_Esquina_Tras_" + str(sx) + "_" + str(k), (sx * (W / 2 + 0.02), L / 2 + 0.02, 0.9 + k * 1.2), (0.55, 0.22, 0.5), m_ladrillo)
# Friso de azulejo bajo la cornisa en ambos laterales
for sx in [-1, 1]:
    caja("EM_Friso_Azulejo_" + str(sx), (sx * (W / 2 + 0.03), 0, 6.2), (0.1, L - 1.6, 0.5), m_azulejo)
# Cornisa de piedra
caja("EM_Cornisa_Lateral_I", (-W / 2 - 0.2, 0, H + 0.5), (0.45, L + 0.4, 0.35), m_piedra)
caja("EM_Cornisa_Lateral_D", (W / 2 + 0.2, 0, H + 0.5), (0.45, L + 0.4, 0.35), m_piedra)

# Ventanas de la nave con rejas
for sx in [-1, 1]:
    for yy in [-4.5, -0.5, 3.5]:
        caja("EM_Ventana_Hueco_" + str(sx) + "_" + str(yy), (sx * (W / 2 + 0.02), yy, 3.9), (0.1, 1.0, 2.0), m_hueco)
        caja("EM_Ventana_Marco_" + str(sx) + "_" + str(yy), (sx * (W / 2 + 0.07), yy, 3.9), (0.12, 1.3, 2.3), m_piedra)
        caja("EM_Reja_Vertical_" + str(sx) + "_" + str(yy), (sx * (W / 2 + 0.12), yy, 3.9), (0.04, 0.9, 1.8), m_hierro)
        for k in range(5):
            caja("EM_Reja_Barra_" + str(sx) + "_" + str(yy) + "_" + str(k), (sx * (W / 2 + 0.13), yy - 0.4 + k * 0.2, 3.9), (0.03, 0.03, 1.9), m_hierro)
        caja("EM_Reja_Travesano_" + str(sx) + "_" + str(yy), (sx * (W / 2 + 0.13), yy, 3.9), (0.03, 1.0, 0.04), m_hierro)

# ==========================================
# 4. CUBIERTA DE TEJA A DOS AGUAS
# ==========================================
TH = math.radians(30)
RIDGE_Z = H + 3.5
for sx in [-1, 1]:
    xc = sx * 2.2
    zc = RIDGE_Z - 2.2 * math.tan(TH) - 0.15
    caja("EM_Faldon_" + str(sx), (xc, 0, zc), (4.9, L + 0.8, 0.28), m_teja, rot=(0, -sx * TH, 0))
    # Hileras de tejas (canales) en el faldón
    for k in range(10):
        yy = -L / 2 + 0.4 + k * (L - 0.8) / 9
        caja("EM_Teja_Canal_" + str(sx) + "_" + str(k), (xc, yy, zc + 0.22), (4.9, 0.12, 0.06), m_teja, rot=(0, -sx * TH, 0))
caja("EM_Cumbrera", (0, 0, RIDGE_Z + 0.1), (0.5, L + 0.9, 0.22), m_teja)
# Aleros de madera
for sx in [-1, 1]:
    caja("EM_Alero_Lateral_" + str(sx), (sx * (W / 2 + 0.7), 0, H + 0.4), (1.0, L + 1.0, 0.12), m_madera)

# ==========================================
# 5. FACHADA: PORTADA DE LADRILLO MUDÉJAR Y ESPADAÑA
# ==========================================
FY = -L / 2
# Portada con arco de medio punto de ladrillo y dintel de piedra
caja("EM_Portada_Fondo", (0, FY - 0.05, 2.7), (3.4, 0.25, 4.0), m_ladrillo)
arco_escalonado("EM_Portada_Vano", 0, FY - 0.12, 0.5, 2.2, 3.0, m_madera, pasos=8, marco=m_ladrillo)
caja("EM_Portada_Dintel", (0, FY - 0.25, 4.8), (2.8, 0.35, 0.25), m_piedra)
# Puerta de dos hojas con clavos de hierro
for sx in [-1, 1]:
    caja("EM_Puerta_Hoja_" + str(sx), (sx * 0.55, FY - 0.25, 2.2), (1.0, 0.1, 3.0), m_madera)
    for k in range(4):
        esfera("EM_Clavo_" + str(sx) + "_" + str(k), (sx * 0.55 + 0.25 * sx * 0.0, FY - 0.32, 1.1 + k * 0.7), 0.045, m_hierro)
    caja("EM_Refuerzo_Hierro_" + str(sx), (sx * 0.55, FY - 0.31, 2.4), (0.9, 0.05, 0.08), m_hierro)
esfera("EM_Aldaba", (0.05, FY - 0.34, 2.0), 0.07, m_hierro)
# Pilastras de ladrillo a los lados de la portada
for sx in [-1, 1]:
    caja("EM_Pilastra_Ladrillo_" + str(sx), (sx * 2.2, FY - 0.15, 2.4), (0.6, 0.5, 4.8), m_ladrillo)
    caja("EM_Pilastra_Capitel_" + str(sx), (sx * 2.2, FY - 0.15, 4.95), (0.8, 0.6, 0.3), m_piedra)

# Espadaña de dos campanas sobre la fachada
EY = FY - 0.15
caja("EM_Espadana_Cuerpo", (0, EY, H + 1.4), (2.4, 0.6, 3.9), m_cal)
for sx in [-1, 1]:
    cono("EM_Espadana_Pinaculo_" + str(sx), (sx * 1.1, EY, H + 3.5), 0.22, 0.0, 0.9, m_piedra, vertices=6)
caja("EM_Espadana_Cornisa", (0, EY - 0.05, H + 2.8), (3.1, 0.7, 0.3), m_piedra)
caja("EM_Espadana_Remate", (0, EY - 0.05, H + 3.2), (2.0, 0.6, 0.25), m_piedra)
for sx in [-0.6, 0.6]:
    arco_escalonado("EM_Espadana_Vano_" + str(sx), sx, EY - 0.33, H + 0.9, 0.8, 1.5, m_hueco, pasos=4, marco=m_piedra)
    # Campana de bronce colgada con su yugo de hierro
    cilindro("EM_Yugo_" + str(sx), (sx, EY - 0.36, H + 2.3), 0.02, 0.7, m_hierro, vertices=6, rot=(0, math.pi / 2, 0))
    cono("EM_Campana_" + str(sx), (sx, EY - 0.36, H + 2.15), 0.18, 0.1, 0.3, m_bronce, vertices=12)
    cilindro("EM_Campana_Badajo_" + str(sx), (sx, EY - 0.36, H + 1.98), 0.015, 0.12, m_hierro, vertices=6)
    cilindro("EM_Campana_Asa_" + str(sx), (sx, EY - 0.36, H + 2.33), 0.03, 0.04, m_hierro, vertices=6)
# Cruz de forja en el remate
cilindro("EM_Cruz_Poste", (0, EY - 0.05, H + 4.5), 0.04, 1.0, m_hierro, vertices=6)
caja("EM_Cruz_Brazo", (0, EY - 0.05, H + 4.7), (0.5, 0.06, 0.06), m_hierro)

# ==========================================
# 6. CABECERA OCHAVADA (ábside) CON TEJADO CÓNICO
# ==========================================
AY = L / 2 + 0.2
cilindro("EM_Cabecera_Muro", (0, AY, 3.8), 3.8, 6.6, m_cal, vertices=8, rot=(0, 0, math.pi / 8))
cilindro("EM_Cabecera_Friso", (0, AY, 6.0), 3.9, 0.35, m_azulejo, vertices=8, rot=(0, 0, math.pi / 8))
cilindro("EM_Cabecera_Cornisa", (0, AY, 7.25), 4.0, 0.3, m_piedra, vertices=8, rot=(0, 0, math.pi / 8))
cono("EM_Cabecera_Tejado", (0, AY, 9.1), 4.2, 0.0, 3.6, m_teja, vertices=8, rot=(0, 0, math.pi / 8))
cilindro("EM_Cabecera_Linterna", (0, AY, 11.2), 0.2, 0.5, m_hierro, vertices=6)
# Ventanas ojivales de vidrio emplomado en el ábside
for k in range(3):
    a = math.radians(-60 + k * 60)
    px, py = 3.85 * math.cos(a), AY + 3.85 * math.sin(a)
    caja("EM_Ventana_Abside_" + str(k), (px, py, 4.2), (0.2, 0.9, 2.6), m_cristal, rot=(0, 0, a))
    caja("EM_Ventana_Abside_Marco_" + str(k), (px * 1.01, py * 1.0, 4.2), (0.25, 1.0, 2.8), m_piedra, rot=(0, 0, a))

# ==========================================
# 7. PATIO, CIPRESES Y MURO BAJO
# ==========================================
# Muro bajo del patio, con hueco de entrada en el centro
for sx in [-1, 1]:
    caja("EM_Muro_Bajo_Frente_" + str(sx), (sx * 7.25, -17.5, 0.8), (11.5, 0.45, 1.6), m_cal)
    caja("EM_Muro_Coronacion_Frente_" + str(sx), (sx * 7.25, -17.5, 1.7), (11.6, 0.55, 0.14), m_piedra)
for sx in [-1, 1]:
    caja("EM_Muro_Bajo_Lateral_" + str(sx), (sx * 13.0, -12.0, 0.8), (0.45, 11.0, 1.6), m_cal)
    caja("EM_Muro_Coronacion_" + str(sx), (sx * 13.0, -12.0, 1.7), (0.55, 11.0, 0.14), m_piedra)
for sx in [-1, 1]:
    for yy in [-6.0, -17.0]:
        cono("EM_Cipres_" + str(sx) + "_" + str(yy), (sx * 9.8, yy, 4.6), 0.85, 0.0, 6.0, m_cipres, vertices=8)
        cono("EM_Cipres_Copa_" + str(sx) + "_" + str(yy), (sx * 9.8, yy, 7.9), 0.55, 0.0, 2.2, m_cipres, vertices=8)
        cilindro("EM_Cipres_Tronco_" + str(sx) + "_" + str(yy), (sx * 9.8, yy, 0.6), 0.08, 1.2, m_tronco, vertices=6)
# Farolas de la portada
for sx in [-1, 1]:
    cilindro("EM_Farol_Poste_" + str(sx), (sx * 3.3, FY - 2.2, 1.6), 0.06, 3.2, m_hierro, vertices=6)
    caja("EM_Farol_Caja_" + str(sx), (sx * 3.3, FY - 2.2, 3.4), (0.35, 0.35, 0.4), m_hierro)
    esfera("EM_Farol_Luz_" + str(sx), (sx * 3.3, FY - 2.2, 3.4), 0.12, m_piedra)


# Canecillos (soportes de madera/piedra) bajo los aleros laterales
for sx in [-1, 1]:
    for k in range(11):
        yy = -L / 2 + 0.8 + k * (L - 1.6) / 10
        caja("EM_Canecillo_" + str(sx) + "_" + str(k), (sx * (W / 2 + 0.55), yy, H - 0.05), (0.35, 0.16, 0.45), m_madera)

# Hornacina con imagen de la Virgen sobre la portada y panel de azulejo
caja("EM_Hornacina_Marco", (0, FY - 0.2, 6.1), (1.8, 0.4, 2.0), m_piedra)
caja("EM_Hornacina_Hueco", (0, FY - 0.36, 6.1), (1.2, 0.2, 1.6), m_hueco)
esfera("EM_Imagen_Cabeza", (0, FY - 0.44, 6.7), 0.16, m_piedra)
caja("EM_Imagen_Cuerpo", (0, FY - 0.44, 6.1), (0.4, 0.2, 0.9), m_piedra)
caja("EM_Panel_Azulejo", (0, FY - 0.22, 7.3), (2.2, 0.1, 0.6), m_azulejo)

# Patio: bancos de piedra, pilón de agua y macetas de cerámica con plantas
for sx in [-1, 1]:
    caja("EM_Banco_Patio_" + str(sx), (sx * 5.2, -13.0, 0.55), (3.0, 0.6, 0.5), m_piedra)
    caja("EM_Banco_Patio_Respaldo_" + str(sx), (sx * 5.2, -13.45, 1.0), (3.0, 0.1, 0.5), m_piedra)
cilindro("EM_Pilon_Base", (-5.8, -9.5, 0.4), 0.9, 0.7, m_piedra, vertices=12)
cilindro("EM_Pilon_Agua", (-5.8, -9.5, 0.72), 0.75, 0.05, m_azulejo, vertices=12)
cilindro("EM_Pilon_Columna", (-5.8, -9.5, 1.2), 0.12, 0.9, m_piedra, vertices=8)
cilindro("EM_Pilon_Caño", (-5.8, -9.5, 1.7), 0.09, 0.2, m_bronce, vertices=8)
for sx in [-1, 1]:
    for k in range(2):
        cilindro("EM_Maceta_" + str(sx) + "_" + str(k), (sx * (1.8 + k * 0.5), FY - 1.2, 0.25), 0.22, 0.5, m_teja, vertices=10)
        esfera("EM_Planta_" + str(sx) + "_" + str(k), (sx * (1.8 + k * 0.5), FY - 1.2, 0.75), 0.25, m_cipres, escala=(1.0, 1.0, 0.8))
        esfera("EM_Flor_" + str(sx) + "_" + str(k), (sx * (1.8 + k * 0.5) + 0.08, FY - 1.25, 0.95), 0.05, m_azulejo)

print("Ermita de Montemayor generada")
