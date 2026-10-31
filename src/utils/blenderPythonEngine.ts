import * as THREE from 'three';
import { applyGlobalLaplacianSmoothing, decimateModelGeometry } from './meshDeformer';
import { generateProceduralTexture, TexturePatternType } from './proceduralTextures';
import {
  prepareGeometryNormals,
  applyNormalSmoothingToModel,
  createComicOutlineMaterial,
  createThreeToneGradientTexture,
} from './geometrySmoothing';
import { getProceduralMatcapTexture } from './matcapGenerator';
import { addBlenderLoop, setBlenderWater, startBlenderRun, finalizeBlenderRun } from './blenderAnimation';

// PURGA DEFENSIVA INMEDIATA: NUNCA extender Object.prototype (propiedades como 'get' o 'value'
// rompen la especificación ECMAScript de descriptores en Object.defineProperty para React y librerías).
if (typeof Object.prototype === 'object' && Object.prototype !== null) {
  if ('get' in Object.prototype) {
    try {
      delete (Object.prototype as any).get;
    } catch (_) {}
  }
  if ('setdefault' in Object.prototype) {
    try {
      delete (Object.prototype as any).setdefault;
    } catch (_) {}
  }
  if ('update' in Object.prototype) {
    try {
      delete (Object.prototype as any).update;
    } catch (_) {}
  }
}

export type BlenderCoordinateMode = 'auto' | 'blender_z_up' | 'studio_y_up';

export interface ScriptExecutionResult {
  success: boolean;
  logs: string[];
  executionTimeMs: number;
  verticesModified: number;
  objectsCreated?: number;
  coordinateModeUsed?: 'blender_z_up' | 'studio_y_up';
  error?: string;
}

export interface BlenderScriptPreset {
  id: string;
  name: string;
  category: 'generate' | 'modify';
  description: string;
  code: string;
}

export const BLENDER_SCRIPT_PRESETS: BlenderScriptPreset[] = [
  // ============================================================================
  // CATEGORÍA 1: GENERACIÓN PROCEDURAL DE NUEVOS OBJETOS 3D DESDE CERO EN PYTHON
  // ============================================================================
  {
    id: 'gen_blender52_mecha_paladin',
    name: 'Blender 5.2 Web (BSDF + Modifiers + Z-Up)',
    category: 'generate',
    description: 'Script estándar de Blender 5.2 como los creados en Gemini Web (Principled BSDF, def, Mirror, Subsurf y eje Z arriba)',
    code: `# SCRIPT ESTÁNDAR BLENDER 5.2 (Compatible directo con códigos de Gemini Web)
import bpy
import math
from mathutils import Vector, Euler

# 1. Limpiar escena al estilo Blender 5.2
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)

def crear_material_bsdf(nombre, color_rgba, metalico=0.2, rugosidad=0.35, emision=0.0):
    mat = bpy.data.materials.new(name=nombre)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Base Color"].default_value = color_rgba
        bsdf.inputs["Metallic"].default_value = metalico
        bsdf.inputs["Roughness"].default_value = rugosidad
        if emision > 0:
            bsdf.inputs["Emission Color"].default_value = color_rgba
            bsdf.inputs["Emission Strength"].default_value = emision
    return mat

def asignar_mat(obj, mat):
    if obj.data.materials:
        obj.data.materials[0] = mat
    else:
        obj.data.materials.append(mat)

# Materiales Principled BSDF de Blender 5.2
mat_titanio = crear_material_bsdf("Titanio_Oscuro", (0.16, 0.20, 0.28, 1.0), metalico=0.85, rugosidad=0.25)
mat_carmesi = crear_material_bsdf("Armadura_Carmesi", (0.88, 0.14, 0.28, 1.0), metalico=0.45, rugosidad=0.30)
mat_oro = crear_material_bsdf("Oro_Imperial", (0.98, 0.74, 0.14, 1.0), metalico=0.92, rugosidad=0.18)
mat_plasma = crear_material_bsdf("Plasma_Cian", (0.06, 0.88, 0.98, 1.0), emision=4.5)

# Torso blindado (En Blender 5.2 el eje Z es la altura vertical)
bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 0, 1.55))
torso = bpy.context.active_object
torso.name = "Torso_Paladin"
torso.scale = (0.78, 0.48, 0.92)
bpy.ops.object.transform_apply(scale=True)
sub = torso.modifiers.new(name="Subsurf", type='SUBSURF')
sub.levels = 2
asignar_mat(torso, mat_carmesi)

# Núcleo reactor en el pecho
bpy.ops.mesh.primitive_ico_sphere_add(radius=0.22, subdivisions=2, location=(0, -0.26, 1.62))
reactor = bpy.context.active_object
asignar_mat(reactor, mat_plasma)

# Cabeza + Visor + Cuernos con modificador Mirror
bpy.ops.mesh.primitive_uv_sphere_add(radius=0.30, location=(0, 0, 2.28))
cabeza = bpy.context.active_object
cabeza.scale = (0.9, 0.95, 1.05)
asignar_mat(cabeza, mat_titanio)

bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, -0.24, 2.30))
visor = bpy.context.active_object
visor.scale = (0.42, 0.12, 0.10)
asignar_mat(visor, mat_plasma)

bpy.ops.mesh.primitive_cone_add(radius1=0.09, radius2=0.01, depth=0.65, location=(0.26, 0.02, 2.58), rotation=(-0.25, 0.35, 0))
cuerno = bpy.context.active_object
asignar_mat(cuerno, mat_oro)
mod_mirror_cuerno = cuerno.modifiers.new(name="MirrorX", type='MIRROR')
mod_mirror_cuerno.use_axis = (True, False, False)

# Hombreras y Brazos simétricos usando modificador MIRROR de Blender 5.2
bpy.ops.mesh.primitive_uv_sphere_add(radius=0.28, location=(0.64, 0, 1.88))
hombrera = bpy.context.active_object
hombrera.scale = (1.1, 0.9, 0.75)
asignar_mat(hombrera, mat_oro)
hombrera.modifiers.new(name="Mirror", type='MIRROR')

bpy.ops.mesh.primitive_cylinder_add(radius=0.13, depth=0.78, location=(0.72, -0.05, 1.38), rotation=(0.2, 0.15, 0))
brazo = bpy.context.active_object
asignar_mat(brazo, mat_titanio)
brazo.modifiers.new(name="Mirror", type='MIRROR')

# Piernas articuladas con Mirror
bpy.ops.mesh.primitive_cylinder_add(radius=0.16, depth=0.95, location=(0.28, 0, 0.58))
pierna = bpy.context.active_object
asignar_mat(pierna, mat_titanio)
pierna.modifiers.new(name="Mirror", type='MIRROR')

bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0.28, -0.08, 0.12))
bota = bpy.context.active_object
bota.scale = (0.28, 0.44, 0.18)
asignar_mat(bota, mat_carmesi)
bota.modifiers.new(name="Mirror", type='MIRROR')

# Halo de energía con Array radial
for i in range(6):
    ang = i * (math.pi * 2 / 6)
    px = math.cos(ang) * 0.95
    pz = 1.75 + math.sin(ang) * 0.95
    bpy.ops.mesh.primitive_cone_add(radius1=0.08, depth=0.38, location=(px, 0.35, pz), rotation=(0, ang + math.pi/2, 0))
    cristal = bpy.context.active_object
    asignar_mat(cristal, mat_plasma)

bpy.ops.object.shade_smooth()
print("Paladín Mecha Blender 5.2 (Z-Up + Principled BSDF + Mirror Modifiers) generado con éxito!")
`,
  },
  {
    id: 'gen_game_treasure_chest',
    name: 'Cofre del Tesoro & Gemas (Prop / Loot)',
    category: 'generate',
    description: 'Modela un Cofre RPG estilizado con herrajes dorados, cerradura y cristales brillantes alrededor',
    code: `# PROP DE VIDEOJUEGO: Cofre del Tesoro RPG + Cristales de Loot
import bpy
import math

bpy.ops.object.delete()

# 1. Cuerpo del cofre (Madera noble + Tapa abovedada + Bandas de hierro dorado)
bpy.ops.mesh.primitive_prop_chest_add(width=1.45, height=0.95, depth=0.95, location=(0, 0.52, 0), color=(0.48, 0.24, 0.10), accent_color=(0.96, 0.74, 0.14))

# 2. Monedas y gemas octaedricas flotando / saliendo del cofre
for i in range(6):
    ang = i * (math.pi * 2 / 6)
    gx = math.cos(ang) * 0.98
    gz = math.sin(ang) * 0.98
    gy = 0.22 + (i % 2) * 0.18
    bpy.ops.mesh.primitive_octahedron_add(radius=0.18, location=(gx, gy, gz), rotation=(0.3, ang, 0.2), color=(0.08, 0.88, 0.98))

# 3. Gran Gema Legendaria levitando sobre el cofre
bpy.ops.mesh.primitive_octahedron_add(radius=0.34, location=(0, 1.58, 0), scale=(0.85, 1.45, 0.85), color=(0.98, 0.22, 0.55))
bpy.ops.mesh.primitive_torus_add(major_radius=0.62, minor_radius=0.04, location=(0, 1.58, 0), rotation=(0.45, 0.3, 0), color=(0.98, 0.78, 0.15))

bpy.ops.mesh.auto_ground()
print("Prop de juego 'Cofre del Tesoro RPG' generado con éxito!")
`,
  },
  {
    id: 'gen_game_stylized_tree',
    name: 'Árbol Mágico & Isla (Naturaleza / Mundo)',
    category: 'generate',
    description: 'Construye un Árbol estilizado con raíces, rocas, setas luminosas y follaje en capas',
    code: `# ENTORNO / NATURALEZA DE JUEGO: Árbol Mágico sobre Isla Rocosa con Setas
import bpy
import math

bpy.ops.object.delete()

# 1. Base de isla rocosa y piedras laterales
bpy.ops.mesh.primitive_dodecahedron_add(radius=1.15, location=(0, 0.38, 0), scale=(1.25, 0.42, 1.25), color=(0.36, 0.40, 0.48))
bpy.ops.mesh.primitive_cylinder_add(radius=1.22, depth=0.18, location=(0, 0.62, 0), color=(0.22, 0.68, 0.34))

# 2. Tronco orgánico curvado y ramas principales
bpy.ops.mesh.primitive_horn_add(base_radius=0.36, tip_radius=0.16, length=1.65, bend=0.22, location=(0, 1.35, 0), color=(0.46, 0.28, 0.14))
bpy.ops.mesh.primitive_tree_foliage_add(radius=1.05, layers=4, location=(0, 2.25, 0), color=(0.18, 0.78, 0.38), accent_color=(0.35, 0.92, 0.48))

# 3. Rocas y setas bioluminiscentes alrededor del tronco
for i in range(5):
    ang = i * (math.pi * 2 / 5)
    rx = math.cos(ang) * 0.78
    rz = math.sin(ang) * 0.78
    # Tallo de la seta
    bpy.ops.mesh.primitive_capsule_add(radius=0.06, length=0.22, location=(rx, 0.82, rz), color=(0.92, 0.88, 0.78))
    # Sombrero de la seta brillante
    bpy.ops.mesh.primitive_cone_add(radius1=0.20, radius2=0.04, depth=0.18, location=(rx, 0.98, rz), color=(0.12, 0.88, 0.96))

bpy.ops.mesh.auto_ground()
print("Elemento de naturaleza 'Árbol Mágico & Isla' generado con éxito!")
`,
  },
  {
    id: 'gen_game_cyber_vehicle',
    name: 'Vehículo / Nave Rover Sci-Fi (Vehículo)',
    category: 'generate',
    description: 'Construye un vehículo / coche blindado con chasis aerodinámico, cabina, ruedas y turbinas',
    code: `# VEHÍCULO DE VIDEOJUEGO: Rover / Coche Blindado Sci-Fi con Turbinas
import bpy

bpy.ops.object.delete()

# 1. Chasis aerodinámico principal y cabina acristalada
bpy.ops.mesh.primitive_cube_add(size=1.0, scale=(1.35, 0.42, 2.25), location=(0, 0.68, 0), color=(0.16, 0.20, 0.28))
bpy.ops.mesh.primitive_armor_plate_add(width=1.22, height=0.45, thickness=0.85, curvature=0.35, location=(0, 1.02, -0.10), rotation=(1.57, 0, 0), color=(0.08, 0.86, 0.98))
bpy.ops.mesh.primitive_armor_plate_add(width=1.42, height=0.38, thickness=0.32, curvature=0.42, location=(0, 0.68, 1.12), color=(0.92, 0.18, 0.34))

# 2. Pares de ruedas todoterreno delanteras y traseras
bpy.ops.mesh.primitive_wheel_pair_add(radius=0.42, width=0.28, span=0.82, y_pos=0.44, z_pos=0.72, color=(0.14, 0.16, 0.20), rim_color=(0.98, 0.74, 0.14))
bpy.ops.mesh.primitive_wheel_pair_add(radius=0.46, width=0.32, span=0.86, y_pos=0.46, z_pos=-0.74, color=(0.14, 0.16, 0.20), rim_color=(0.98, 0.74, 0.14))

# 3. Alerón trasero y propulsores de plasma
bpy.ops.mesh.primitive_cube_add(size=1.0, scale=(1.45, 0.08, 0.35), location=(0, 1.18, -1.02), color=(0.92, 0.18, 0.34))
for side in [-1, 1]:
    bpy.ops.mesh.primitive_cylinder_add(radius=0.16, depth=0.38, location=(side * 0.38, 0.68, -1.18), rotation=(1.57, 0, 0), color=(0.06, 0.90, 0.98))

bpy.ops.mesh.auto_ground()
print("Vehículo 'Rover Sci-Fi' generado con éxito!")
`,
  },
  {
    id: 'gen_game_medieval_tower',
    name: 'Torre / Portal Arquitectónico (Edificio)',
    category: 'generate',
    description: 'Construye una estructura arquitectónica con escalinata, arco de piedra, columnas y tejado',
    code: `# ARQUITECTURA / ESCENARIO DE JUEGO: Torre & Portal Mágico
import bpy
import math

bpy.ops.object.delete()

# 1. Plataforma escalonada de piedra
bpy.ops.mesh.primitive_cylinder_add(radius=1.55, depth=0.22, vertices=8, location=(0, 0.12, 0), color=(0.42, 0.46, 0.54))
bpy.ops.mesh.primitive_cylinder_add(radius=1.28, depth=0.22, vertices=8, location=(0, 0.32, 0), color=(0.50, 0.54, 0.62))

# 2. Arco monumental de entrada y columnas
bpy.ops.mesh.primitive_arch_add(width=1.45, height=1.85, thickness=0.28, location=(0, 0.42, 0), color=(0.62, 0.66, 0.74), accent_color=(0.96, 0.72, 0.16))

# 3. Vórtice de energía del portal en el centro y tejado cónico superior
bpy.ops.mesh.primitive_torus_add(major_radius=0.52, minor_radius=0.06, location=(0, 1.32, 0), color=(0.08, 0.88, 0.98))
bpy.ops.mesh.primitive_octahedron_add(radius=0.32, location=(0, 1.32, 0), scale=(0.8, 1.4, 0.3), color=(0.45, 0.22, 0.96))
bpy.ops.mesh.primitive_cone_add(radius1=1.18, radius2=0.04, depth=0.95, vertices=8, location=(0, 2.65, 0), color=(0.82, 0.22, 0.28))

bpy.ops.mesh.auto_ground()
print("Estructura arquitectónica 'Torre & Portal Mágico' generada con éxito!")
`,
  },
  {
    id: 'gen_cyber_sentinel',
    name: 'Generar Centinela Mecha (Nuevo Objeto)',
    category: 'generate',
    description: 'Limpia la escena y modela desde cero un Boss Robot Acorazado con anillos orbitales en Python',
    code: `# GENERAR NUEVO ENEMIGO DESDE CERO: Centinela Mecha Orbital
import bpy
import math

# 1. Limpiar el objeto anterior para construir uno nuevo desde cero
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete()

# 2. Nucleo central blindado (Icosaedro subdividido)
bpy.ops.mesh.primitive_ico_sphere_add(radius=0.72, subdivisions=3, location=(0, 1.45, 0), color=(0.18, 0.22, 0.30))

# 3. Ojo laser energetico central
bpy.ops.mesh.primitive_uv_sphere_add(radius=0.32, location=(0, 1.45, 0.56), color=(0.05, 0.85, 1.0))

# 4. Anillos de contencion gravitacional cruzados (Torus)
bpy.ops.mesh.primitive_torus_add(major_radius=1.18, minor_radius=0.075, location=(0, 1.45, 0), rotation=(0.45, 0.35, 0), color=(0.96, 0.62, 0.05))
bpy.ops.mesh.primitive_torus_add(major_radius=1.35, minor_radius=0.055, location=(0, 1.45, 0), rotation=(-0.55, 0.25, 0.4), color=(0.88, 0.15, 0.35))

# 5. Generar 8 canones/puas flotantes en orbita circular con bucle Python
for i in range(8):
    angle = i * (math.pi * 2 / 8)
    px = math.cos(angle) * 1.55
    py = 1.45 + math.sin(angle) * 1.55
    bpy.ops.mesh.primitive_cone_add(radius1=0.16, depth=0.55, location=(px, py, 0), rotation=(0, 0, angle - math.pi / 2), color=(0.95, 0.20, 0.35))

# 6. Pedestal de propulsores inferiores
bpy.ops.mesh.primitive_cylinder_add(radius=0.45, depth=0.65, location=(0, 0.42, 0), color=(0.25, 0.30, 0.40))

print("Nuevo objeto 'Centinela Mecha Orbital' generado integramente con Python!")
`,
  },
  {
    id: 'gen_elder_dragon',
    name: 'Generar Dragón Serpiente (Nuevo Objeto)',
    category: 'generate',
    description: 'Construye proceduralmente un Dragón / Wyrm con vértebras, cuernos y espinas dorsales',
    code: `# GENERAR NUEVO OBJETO: Wyrm / Dragon Abisal articulado con trigonometria
import bpy
import math

bpy.ops.object.delete()

# 1. Crear 14 segmentos vertebrales en forma de 'S' ascendente
for i in range(14):
    t = i / 13.0
    x = math.sin(t * math.pi * 2.0) * 0.65
    y = 0.35 + t * 2.35
    z = math.cos(t * math.pi * 1.5) * 0.45
    rad = 0.46 * (1.0 - t * 0.42)

    # Alternar colores de escamas entre carmesi y oro
    if i % 2 == 0:
        bpy.ops.mesh.primitive_ico_sphere_add(radius=rad, subdivisions=2, location=(x, y, z), color=(0.88, 0.12, 0.28))
    else:
        bpy.ops.mesh.primitive_ico_sphere_add(radius=rad * 0.92, subdivisions=2, location=(x, y, z), color=(0.18, 0.22, 0.32))

    # Espina dorsal sobre cada vertebra
    bpy.ops.mesh.primitive_cone_add(radius1=rad * 0.38, depth=0.48, location=(x, y + rad * 0.9, z - 0.15), rotation=(-0.4, 0, 0), color=(0.98, 0.75, 0.15))

# 2. Cabeza y cuernos del Dragon en la cima
bpy.ops.mesh.primitive_ico_sphere_add(radius=0.48, subdivisions=2, location=(0, 2.75, 0.28), color=(0.88, 0.12, 0.28))
bpy.ops.mesh.primitive_cone_add(radius1=0.14, depth=0.85, location=(-0.38, 3.15, 0.1), rotation=(-0.3, 0, 0.45), color=(0.98, 0.75, 0.15))
bpy.ops.mesh.primitive_cone_add(radius1=0.14, depth=0.85, location=(0.38, 3.15, 0.1), rotation=(-0.3, 0, -0.45), color=(0.98, 0.75, 0.15))

print("Dragon Wyrm de 14 segmentos generado con exito!")
`,
  },
  {
    id: 'gen_floating_sword',
    name: 'Generar Espada Rúnica & Escudo (Accesorios)',
    category: 'generate',
    description: 'Añade objetos nuevos (Espada colosal, Halo y Cristales) alrededor del personaje actual',
    code: `# AÑADIR NUEVOS OBJETOS AL MODELO ACTUAL (Sin borrar al enemigo)
import bpy
import math

# 1. Halo de poder flotando detras de la espalda
bpy.ops.mesh.primitive_torus_add(major_radius=1.15, minor_radius=0.05, location=(0, 1.85, -0.65), rotation=(0, 0, 0), color=(0.98, 0.75, 0.12))

# 2. Espada Colosal levitando a la derecha del enemigo
# Hoja de la espada (Cubo estilizado)
bpy.ops.mesh.primitive_cube_add(size=1.0, scale=(0.18, 2.15, 0.06), location=(1.85, 1.65, 0.35), rotation=(0, 0, -0.15), color=(0.22, 0.82, 0.98))
# Guarda cruzada
bpy.ops.mesh.primitive_cube_add(size=1.0, scale=(0.72, 0.14, 0.16), location=(1.70, 0.68, 0.35), rotation=(0, 0, -0.15), color=(0.96, 0.65, 0.10))
# Empunadura y pomo
bpy.ops.mesh.primitive_cylinder_add(radius=0.07, depth=0.45, location=(1.64, 0.42, 0.35), rotation=(0, 0, -0.15), color=(0.85, 0.15, 0.25))

# 3. Cristales arcanos orbitando a la izquierda
for i in range(4):
    ang = i * (math.pi / 2)
    cy = 1.2 + i * 0.38
    bpy.ops.mesh.primitive_ico_sphere_add(radius=0.18, subdivisions=1, location=(-1.75 + math.cos(ang)*0.2, cy, 0.3 + math.sin(ang)*0.2), color=(0.22, 0.85, 0.98))

print("Espada Colosal, Halo y Cristales añadidos a la escena!")
`,
  },
  {
    id: 'gen_custom_vertices',
    name: 'Crear Malla por Vértices y Caras (from_pydata)',
    category: 'generate',
    description: 'Usa mesh.from_pydata(verts, edges, faces) de Blender para construir un Cristal Obelisco',
    code: `# CREACION MATEMATICA DE GEOMETRIA CON mesh.from_pydata(verts, [], faces)
import bpy

# Limpiar escena para ver el Obelisco Cristalino
bpy.ops.object.delete()

# Definir coordenadas exactas (x, y, z) de los vertices del Obelisco
verts = [
    (0.0, 0.1, 0.0),     # 0: Punta inferior
    (-0.65, 0.6, -0.65), # 1: Base SO
    (0.65, 0.6, -0.65),  # 2: Base SE
    (0.65, 0.6, 0.65),   # 3: Base NE
    (-0.65, 0.6, 0.65),  # 4: Base NO
    (-0.42, 2.2, -0.42), # 5: Corona SO
    (0.42, 2.2, -0.42),  # 6: Corona SE
    (0.42, 2.2, 0.42),   # 7: Corona NE
    (-0.42, 2.2, 0.42),  # 8: Corona NO
    (0.0, 3.05, 0.0)     # 9: Punta superior (Cuspide)
]

# Definir las caras (triangulos y cuadrilateros por indice de vertice)
faces = [
    (0, 2, 1), (0, 3, 2), (0, 4, 3), (0, 1, 4), # Piramide inferior
    (1, 2, 6, 5), (2, 3, 7, 6), (3, 4, 8, 7), (4, 1, 5, 8), # Cuerpo central
    (5, 6, 9), (6, 7, 9), (7, 8, 9), (8, 5, 9)  # Piramide superior
]

# Construir malla en Blender y vincularla a la escena
mesh = bpy.data.meshes.new("Obelisco_Cristal")
mesh.from_pydata(verts, [], faces)
obj = bpy.data.objects.new("Obelisco_Obj", mesh)
bpy.context.collection.objects.link(obj)

# Añadir dos anillos de energia alrededor del obelisco
bpy.ops.mesh.primitive_torus_add(major_radius=1.15, minor_radius=0.05, location=(0, 1.4, 0), rotation=(0.35, 0, 0.25), color=(0.98, 0.68, 0.12))
bpy.ops.mesh.primitive_torus_add(major_radius=0.95, minor_radius=0.04, location=(0, 2.1, 0), rotation=(-0.35, 0, -0.25), color=(0.08, 0.82, 0.98))

print("Obelisco construido desde cero usando verts + faces (from_pydata)!")
`,
  },
  // ============================================================================
  // CATEGORÍA 2: MODIFICACIÓN Y DEFORMACIÓN DE LA MALLA EXISTENTE
  // ============================================================================
  {
    id: 'smooth_round',
    name: 'Redondear & Suavizar Malla Actual',
    category: 'modify',
    description: 'Aplica el operador bpy.ops.mesh.smooth para relajar aristas y redondear caras',
    code: `# Redondear y suavizar toda la geometria activa
import bpy

obj = bpy.context.active_object
print(f"Objeto activo seleccionado: {obj.name}")

# Suavizado laplaciano de vertices estilo Blender
bpy.ops.mesh.smooth(iterations=4, factor=0.55)
print("Geometria redondeada exitosamente. Aristas duras eliminadas.")
`,
  },
  {
    id: 'decimate_50',
    name: 'Reducción de Polígonos (Decimate 50%)',
    category: 'modify',
    description: 'Aplica el modificador Decimate de Blender para reducir a la mitad los triángulos',
    code: `# Reduccion de poligonos manteniendo la silueta exterior
import bpy

# Reducir un 50% de poligonos (ratio=0.5)
bpy.ops.mesh.decimate(ratio=0.5)
print("Modifier Decimate completado: 50% menos de poligonos.")
`,
  },
  {
    id: 'alien_waves',
    name: 'Deformación Ondulatoria Orgánica',
    category: 'modify',
    description: 'Itera sobre mesh.vertices aplicando funciones matemáticas senoidales',
    code: `# Deformacion matematica de vertices con math.sin y math.cos
import bpy
import math

obj = bpy.context.active_object
mesh = obj.data

print(f"Modificando {len(mesh.vertices)} vertices...")

for v in mesh.vertices:
    wave = math.sin(v.co.y * 5.0) * math.cos(v.co.x * 5.0)
    v.co.z += wave * 0.045
    if v.co.y > 0.4:
        v.co.x *= 1.06
        v.co.z *= 1.04

print("Deformacion organica aplicada con exito.")
`,
  },
  {
    id: 'twist_vortex',
    name: 'Torsión en Espiral (Twist Y)',
    category: 'modify',
    description: 'Rota los vértices proporcionalmente a su altura en el eje Y',
    code: `# Torsion angular de la geometria alrededor del eje vertical Y
import bpy

bpy.ops.mesh.twist(angle=0.45, axis='Y')
print("Torsion espiral aplicada al modelo.")
`,
  },
];

// Extender Array.prototype de forma no enumerable para soportar métodos nativos de listas Python (.append, .extend, .clear, .remove, .insert)
function ensurePythonArrayMethods() {
  const proto = Array.prototype as unknown as Record<string, unknown>;
  if (!proto.append) {
    Object.defineProperty(Array.prototype, 'append', {
      value: function (item: unknown) {
        this.push(item);
      },
      writable: true,
      configurable: true,
      enumerable: false,
    });
  }
  if (!proto.extend) {
    Object.defineProperty(Array.prototype, 'extend', {
      value: function (items: unknown[]) {
        if (Array.isArray(items)) this.push(...items);
      },
      writable: true,
      configurable: true,
      enumerable: false,
    });
  }
  if (!proto.clear) {
    Object.defineProperty(Array.prototype, 'clear', {
      value: function () {
        this.length = 0;
      },
      writable: true,
      configurable: true,
      enumerable: false,
    });
  }
  if (!proto.remove) {
    Object.defineProperty(Array.prototype, 'remove', {
      value: function (item: unknown) {
        const idx = this.indexOf(item);
        if (idx !== -1) this.splice(idx, 1);
      },
      writable: true,
      configurable: true,
      enumerable: false,
    });
  }
  if (!proto.insert) {
    Object.defineProperty(Array.prototype, 'insert', {
      value: function (idx: number, item: unknown) {
        this.splice(idx, 0, item);
      },
      writable: true,
      configurable: true,
      enumerable: false,
    });
  }

  // Extender String.prototype de forma no enumerable para soportar métodos nativos de cadenas Python (.format, .strip, .startswith, etc.)
  const strProto = String.prototype as unknown as Record<string, unknown>;
  if (!strProto.format) {
    Object.defineProperty(String.prototype, 'format', {
      value: function (...args: unknown[]) {
        let str = String(this);
        let kw: Record<string, unknown> = {};
        if (
          args.length > 0 &&
          args[args.length - 1] &&
          typeof args[args.length - 1] === 'object' &&
          !Array.isArray(args[args.length - 1])
        ) {
          kw = args[args.length - 1] as Record<string, unknown>;
        }
        let posIdx = 0;
        return str.replace(/\{([^{}]*)\}/g, (match, key) => {
          const trimmed = key.trim();
          if (!trimmed) {
            return posIdx < args.length ? String(args[posIdx++]) : match;
          }
          if (/^\d+$/.test(trimmed)) {
            const idx = parseInt(trimmed, 10);
            return idx < args.length ? String(args[idx]) : match;
          }
          const cleanKey = trimmed.split(':')[0];
          if (cleanKey in kw) return String(kw[cleanKey]);
          return match;
        });
      },
      writable: true,
      configurable: true,
      enumerable: false,
    });
  }
  if (!strProto.strip) {
    Object.defineProperty(String.prototype, 'strip', {
      value: function () {
        return this.trim();
      },
      writable: true,
      configurable: true,
      enumerable: false,
    });
  }
  if (!strProto.lstrip) {
    Object.defineProperty(String.prototype, 'lstrip', {
      value: function () {
        return this.trimStart();
      },
      writable: true,
      configurable: true,
      enumerable: false,
    });
  }
  if (!strProto.rstrip) {
    Object.defineProperty(String.prototype, 'rstrip', {
      value: function () {
        return this.trimEnd();
      },
      writable: true,
      configurable: true,
      enumerable: false,
    });
  }
  if (!strProto.startswith) {
    Object.defineProperty(String.prototype, 'startswith', {
      value: function (prefix: string) {
        return this.startsWith(prefix);
      },
      writable: true,
      configurable: true,
      enumerable: false,
    });
  }
  if (!strProto.endswith) {
    Object.defineProperty(String.prototype, 'endswith', {
      value: function (suffix: string) {
        return this.endsWith(suffix);
      },
      writable: true,
      configurable: true,
      enumerable: false,
    });
  }
  if (!strProto.capitalize) {
    Object.defineProperty(String.prototype, 'capitalize', {
      value: function () {
        return this.charAt(0).toUpperCase() + this.slice(1).toLowerCase();
      },
      writable: true,
      configurable: true,
      enumerable: false,
    });
  }
  if (!strProto.title) {
    Object.defineProperty(String.prototype, 'title', {
      value: function () {
        return this.replace(/\b\w/g, (c: string) => c.toUpperCase());
      },
      writable: true,
      configurable: true,
      enumerable: false,
    });
  }
  if (!strProto.count) {
    Object.defineProperty(String.prototype, 'count', {
      value: function (sub: string) {
        if (!sub) return 0;
        return this.split(sub).length - 1;
      },
      writable: true,
      configurable: true,
      enumerable: false,
    });
  }
  if (!strProto.find) {
    Object.defineProperty(String.prototype, 'find', {
      value: function (sub: string) {
        return this.indexOf(sub);
      },
      writable: true,
      configurable: true,
      enumerable: false,
    });
  }
  if (!strProto.rfind) {
    Object.defineProperty(String.prototype, 'rfind', {
      value: function (sub: string) {
        return this.lastIndexOf(sub);
      },
      writable: true,
      configurable: true,
      enumerable: false,
    });
  }
  if (!strProto.lower) {
    Object.defineProperty(String.prototype, 'lower', {
      value: function () {
        return this.toLowerCase();
      },
      writable: true,
      configurable: true,
      enumerable: false,
    });
  }
  if (!strProto.upper) {
    Object.defineProperty(String.prototype, 'upper', {
      value: function () {
        return this.toUpperCase();
      },
      writable: true,
      configurable: true,
      enumerable: false,
    });
  }

  // NUNCA extender Object.prototype (rompe los descriptores de Object.defineProperty en React y Web APIs).
  // Asegurar que Object.prototype no contenga get, setdefault ni update.
  if (typeof Object.prototype === 'object' && Object.prototype !== null) {
    if ('get' in Object.prototype) {
      try {
        delete (Object.prototype as any).get;
      } catch (_) {}
    }
    if ('setdefault' in Object.prototype) {
      try {
        delete (Object.prototype as any).setdefault;
      } catch (_) {}
    }
    if ('update' in Object.prototype) {
      try {
        delete (Object.prototype as any).update;
      } catch (_) {}
    }
  }

  // Extender Set.prototype para métodos nativos de sets de Python (.discard, .remove, .update)
  const setProto = Set.prototype as unknown as Record<string, unknown>;
  if (!setProto.discard) {
    Object.defineProperty(Set.prototype, 'discard', {
      value: function (val: any) {
        this.delete(val);
      },
      writable: true,
      configurable: true,
      enumerable: false,
    });
  }
  if (!setProto.remove) {
    Object.defineProperty(Set.prototype, 'remove', {
      value: function (val: any) {
        this.delete(val);
      },
      writable: true,
      configurable: true,
      enumerable: false,
    });
  }
  if (!setProto.update) {
    Object.defineProperty(Set.prototype, 'update', {
      value: function (items: any) {
        if (items && Symbol.iterator in Object(items)) {
          for (const it of items) this.add(it);
        }
      },
      writable: true,
      configurable: true,
      enumerable: false,
    });
  }
}

/**
 * Convierte un parámetro de color Python `(r, g, b)`, `(r, g, b, a)` o `'#hex'` en `THREE.Color`.
 */
function parsePythonColor(
  colInput?: number[] | string | { r?: number; g?: number; b?: number },
  fallbackHex: string = '#e11d48'
): THREE.Color {
  if (!colInput) return new THREE.Color(fallbackHex);
  if (typeof colInput === 'string') return new THREE.Color(colInput);
  if (Array.isArray(colInput) && colInput.length >= 3) {
    const [r, g, b] = colInput;
    if (r > 1.05 || g > 1.05 || b > 1.05) {
      return new THREE.Color(r / 255, g / 255, b / 255);
    }
    return new THREE.Color(
      Math.max(0, Math.min(1, Number(r) || 0)),
      Math.max(0, Math.min(1, Number(g) || 0)),
      Math.max(0, Math.min(1, Number(b) || 0))
    );
  }
  if (typeof colInput === 'object' && 'r' in colInput) {
    return new THREE.Color(
      Number(colInput.r) || 0,
      Number(colInput.g) || 0,
      Number(colInput.b) || 0
    );
  }
  return new THREE.Color(fallbackHex);
}

/**
 * Configura cualquier nueva malla creada por Python con todos los materiales del estudio.
 */
function configureNewlySpawnedMesh(
  mesh: THREE.Mesh,
  baseColor: THREE.Color,
  gradientTexture: THREE.DataTexture,
  outlineThickness: number = 1.25,
  outlineOpacity: number = 0.9,
  pbrProps?: { metallic?: number; roughness?: number; emissionColor?: THREE.Color; emissionStrength?: number }
): void {
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  prepareGeometryNormals(mesh);

  const posAttr = mesh.geometry.attributes.position as THREE.BufferAttribute;
  if (posAttr) {
    mesh.userData.initialPositions = new Float32Array(posAttr.array);
  }
  mesh.userData.undoStack = [] as Float32Array[];

  const stdMat = new THREE.MeshStandardMaterial({
    color: baseColor.clone(),
    roughness: pbrProps?.roughness ?? 0.38,
    metalness: pbrProps?.metallic ?? 0.2,
    ...(pbrProps?.emissionColor && (pbrProps.emissionStrength ?? 0) > 0
      ? {
          emissive: pbrProps.emissionColor.clone(),
          emissiveIntensity: Math.min(2.5, (pbrProps.emissionStrength ?? 1) * 0.35),
        }
      : {}),
  });

  const toonMaterial = new THREE.MeshToonMaterial({
    color: baseColor.clone(),
    gradientMap: gradientTexture,
    ...(pbrProps?.emissionColor && (pbrProps.emissionStrength ?? 0) > 0
      ? {
          emissive: pbrProps.emissionColor.clone(),
          emissiveIntensity: Math.min(1.5, (pbrProps.emissionStrength ?? 1) * 0.22),
        }
      : {}),
  });

  const matcapMaterial = new THREE.MeshMatcapMaterial({
    matcap: getProceduralMatcapTexture('clay'),
    color: new THREE.Color(0xffffff),
  });

  const normalDebugMaterial = new THREE.MeshNormalMaterial({
    flatShading: false,
  });

  mesh.userData.originalMaterial = stdMat;
  mesh.userData.toonMaterial = toonMaterial;
  mesh.userData.matcapMaterial = matcapMaterial;
  mesh.userData.normalDebugMaterial = normalDebugMaterial;
  mesh.material = toonMaterial;

  // Evitar duplicar outlineMesh si ya tiene uno
  const existingOutline = mesh.children.find((c) => c.userData?.isOutlineMesh);
  if (existingOutline) {
    mesh.remove(existingOutline);
  }

  const outlineMat = createComicOutlineMaterial(outlineThickness, outlineOpacity);
  const outlineMesh = new THREE.Mesh(mesh.geometry, outlineMat);
  outlineMesh.name = `${mesh.name}_outline`;
  outlineMesh.userData.isOutlineMesh = true;
  outlineMesh.castShadow = false;
  outlineMesh.receiveShadow = false;
  mesh.add(outlineMesh);
  mesh.userData.outlineMesh = outlineMesh;
}

/**
 * Actualiza el color y propiedades PBR/Toon de una malla ya existente en Three.js.
 */
function applyMaterialToThreeMesh(
  mesh: THREE.Mesh,
  color: THREE.Color,
  metallic: number = 0.2,
  roughness: number = 0.38,
  emissionColor?: THREE.Color | null,
  emissionStrength: number = 0
) {
  // Las superficies de agua (bpy.anim.agua) usan un shader propio y no reciben colores de material
  if ((mesh.material as THREE.Material).type === 'ShaderMaterial') return;

  const effectiveColor =
    emissionColor && emissionStrength > 0.5
      ? color.clone().lerp(emissionColor, 0.65)
      : color.clone();

  const stdMat = mesh.userData.originalMaterial as THREE.MeshStandardMaterial | undefined;
  if (stdMat) {
    stdMat.color.copy(effectiveColor);
    stdMat.metalness = Math.max(0, Math.min(1, metallic));
    stdMat.roughness = Math.max(0.05, Math.min(1, roughness));
    if (emissionColor && emissionStrength > 0) {
      stdMat.emissive.copy(emissionColor);
      stdMat.emissiveIntensity = Math.min(2.5, emissionStrength * 0.3);
    }
    stdMat.needsUpdate = true;
  }

  const toonMat = mesh.userData.toonMaterial as THREE.MeshToonMaterial | undefined;
  if (toonMat) {
    toonMat.color.copy(effectiveColor);
    if (emissionColor && emissionStrength > 0) {
      toonMat.emissive.copy(emissionColor);
      toonMat.emissiveIntensity = Math.min(1.2, emissionStrength * 0.18);
    }
    toonMat.needsUpdate = true;
  }

  const activeMat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
  if (activeMat && 'color' in activeMat) {
    (activeMat as THREE.MeshStandardMaterial).color.copy(effectiveColor);
  }
}

/**
 * Detecta automáticamente si un script de Python fue creado para Blender 5.2 estándar (Eje Z arriba)
 * o para el Estudio Nativo (Eje Y arriba).
 */
export function detectBlenderZUpScript(script: string): boolean {
  // Si es uno de los presets nativos Y-Up del estudio, mantener Y-Up
  if (
    script.includes('Centinela Mecha Orbital') ||
    script.includes('Wyrm / Dragon Abisal articulado') ||
    script.includes('AÑADIR NUEVOS OBJETOS AL MODELO ACTUAL') ||
    script.includes('Obelisco_Cristal') ||
    script.includes('primitive_limb_pair_add') ||
    script.includes('primitive_armor_plate_add') ||
    script.includes('primitive_wing_pair_add') ||
    script.includes('primitive_wheel_pair_add') ||
    script.includes('primitive_arch_add') ||
    script.includes('primitive_tree_foliage_add') ||
    script.includes('primitive_prop_chest_add') ||
    script.includes('bpy.ops.mesh.auto_ground()')
  ) {
    return false;
  }

  // Señales inequívocas de scripts Blender 4.x / 5.2 creados desde Gemini Web, ChatGPT o tutoriales
  if (
    /Principled BSDF|ShaderNode|bpy\.data\.materials|use_nodes|active_material|diffuse_color|rotation_euler|modifiers\.new|modifier_add|shade_smooth|shade_auto_smooth|bmesh|mathutils|transform_apply|mode_set|origin_set/i.test(
      script
    )
  ) {
    return true;
  }

  // Analizar tuplas location=(x, y, z): si varias tienen y == 0 y z > 0.35, es claramente Z-Up
  const locMatches = [...script.matchAll(/location\s*=\s*\(\s*([-0-9.]+)\s*,\s*([-0-9.]+)\s*,\s*([-0-9.]+)\s*\)/g)];
  if (locMatches.length >= 2) {
    let zUpScore = 0;
    let yUpScore = 0;
    for (const m of locMatches) {
      const yVal = Math.abs( parseFloat(m[2]) );
      const zVal = Math.abs( parseFloat(m[3]) );
      if (zVal > 0.35 && yVal < 0.25) zUpScore++;
      if (yVal > 0.35 && zVal < 0.25) yUpScore++;
    }
    if (zUpScore > yUpScore) return true;
  }

  return false;
}

/**
 * Detecta si un bloque de texto pegado por el usuario es código Python de Blender (`bpy`).
 */
export function isLikelyBlenderPythonCode(raw: string): boolean {
  if (!raw || typeof raw !== 'string') return false;
  const t = raw.trim();
  if (t.length < 12) return false;
  return (
    /\bimport\s+(?:bpy|bmesh|mathutils)\b/.test(t) ||
    /\bfrom\s+(?:mathutils|bpy|bmesh)\s+import\b/.test(t) ||
    /\bbpy\.(?:ops|data|context)\b/.test(t) ||
    /```(?:python|py)\b/i.test(t) ||
    (/\bdef\s+[a-zA-Z_]\w*\s*\(/.test(t) && /\b(?:bpy|bmesh|location|primitive_)\b/.test(t))
  );
}

/**
 * Extrae y limpia bloques de código pegados directamente desde Gemini Web, ChatGPT, Claude o tutoriales.
 * Normaliza espacios no separables (\u00A0), comillas tipográficas, tabuladores y cabeceras/pies de interfaz web.
 */
export function stripMarkdownCodeFences(raw: string): string {
  // 1. Normalizar saltos de línea, espacios invisibles y comillas curvas de páginas web
  let normalized = raw
    .replace(/\r\n?/g, '\n')
    .replace(/[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/g, ' ')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'");

  // 2. Si contiene bloques ```python ... ```, extraer todos los bloques de código y unirlos
  const fenceMatches = [...normalized.matchAll(/```(?:python|py|blender)?\s*\n([\s\S]*?)```/gi)];
  if (fenceMatches.length > 0) {
    normalized = fenceMatches.map((m) => m[1]).join('\n\n');
  } else {
    normalized = normalized
      .replace(/^\s*```(?:python|py|blender)?\s*$/gim, '')
      .replace(/^\s*```\s*$/gm, '');
  }

  // 3. Limpiar líneas residuales de botones de "Copiar código" de interfaces web (Gemini Web / ChatGPT)
  const webUiArtifacts =
    /^(?:python|py|blender|copiar\s+c[oó]digo|copy\s+code|content_copy|expand_more|expand_less|usa\s+el\s+c[oó]digo\s+con\s+precauci[oó]n\.?|use\s+code\s+with\s+caution\.?|c[oó]digo\s+python)$/i;

  const lines = normalized.split('\n');
  // Si el usuario copió texto explicativo antes de `import bpy`, recortar el preámbulo conversacional
  // Un script puede empezar directamente por una clase, un decorador, una asignación o un bucle
  // (sin `import bpy`); si no se reconoce, se descartaría todo lo que hay antes del primer `def`/`import`.
  const firstCodeIdx = lines.findIndex((l) => {
    const t = l.trim();
    return (
      /^import\s+(?:bpy|bmesh|math|random|numpy)/.test(t) ||
      /^from\s+(?:mathutils|math|random|bpy)/.test(t) ||
      /^bpy\.(?:ops|data|context)/.test(t) ||
      /^#/.test(t) ||
      /^def\s+[a-zA-Z_]/.test(t) ||
      /^class\s+[a-zA-Z_]\w*\s*(?:\([^)]*\))?\s*:$/.test(t) ||
      /^@[a-zA-Z_]\w*\s*(?:\(.*\))?$/.test(t) ||
      /^for\s+[a-zA-Z_]\w*\s+in\s+.+:$/.test(t) ||
      /^with\s+bpy\.[\w.]+\(.*\)\s*:$/.test(t) ||
      /^try\s*:$/.test(t) ||
      /^[a-zA-Z_][\w.\[\]'"]*\s*[+\-*/]?=(?!=)\s*\S/.test(t)
    );
  });

  const relevantLines = firstCodeIdx > 0 ? lines.slice(firstCodeIdx) : lines;

  return relevantLines
    .filter((line) => !webUiArtifacts.test(line.trim()))
    // Convertir tabuladores en 4 espacios para que el cálculo de indentación sea exacto
    .map((line) => line.replace(/\t/g, '    '))
    .join('\n')
    .trim();
}

/**
 * Elimina docstrings multilínea `"""..."""` y `'''...'''` y comentarios `# ...` respetando strings literales.
 */
function stripPythonCommentsAndDocstrings(code: string): string {
  // 1. Reemplazar docstrings triple-comilla por string vacío `""` si van tras `=`, o por nada si son comentarios
  const withoutDocstrings = code
    .replace(/=\s*[rRfFbBuU]{0,2}"""[\s\S]*?"""/g, '= ""')
    .replace(/=\s*[rRfFbBuU]{0,2}'''[\s\S]*?'''/g, "= ''")
    .replace(/[rRfFbBuU]{0,2}"""[\s\S]*?"""/g, '')
    .replace(/[rRfFbBuU]{0,2}'''[\s\S]*?'''/g, '');

  // 2. Eliminar comentarios # fuera de strings
  return withoutDocstrings
    .split('\n')
    .map((line) => {
      let inStr: string | null = null;
      let cleaned = '';
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (inStr) {
          cleaned += ch;
          if (ch === inStr && line[i - 1] !== '\\') inStr = null;
        } else {
          if (ch === '"' || ch === "'" || ch === '`') {
            inStr = ch;
            cleaned += ch;
          } else if (ch === '#') {
            break;
          } else {
            cleaned += ch;
          }
        }
      }
      return cleaned;
    })
    .join('\n');
}

/**
 * Convierte f-strings (`f"..."`, `f'...'`, `rf"..."`) y raw strings (`r"..."`, `b"..."`) de forma consciente
 * del estado de cadenas, evitando corromper strings normales que terminan en la letra 'f' (ej. `"Subsurf"`).
 */
function convertPythonFStringsAndRawStrings(code: string): string {
  let out = '';
  let i = 0;
  while (i < code.length) {
    const ch = code[i];
    const prev = i > 0 ? code[i - 1] : '';
    const isStartOfToken = i === 0 || !/[a-zA-Z0-9_$"']/.test(prev);

    if (isStartOfToken) {
      // Detectar prefijos f/r/b combinados: f", f', rf", fr", r", r', b", b'
      const sub2 = code.slice(i, i + 3);
      const sub1 = code.slice(i, i + 2);
      let prefixLen = 0;
      let isFString = false;
      let quoteChar = '';

      if (/^(?:rf|fr|RF|FR|rF|Rf)["']/.test(sub2)) {
        prefixLen = 2;
        isFString = true;
        quoteChar = sub2[2];
      } else if (/^[fF]["']/.test(sub1)) {
        prefixLen = 1;
        isFString = true;
        quoteChar = sub1[1];
      } else if (/^[rRbBuU]["']/.test(sub1)) {
        prefixLen = 1;
        isFString = false;
        quoteChar = sub1[1];
      }

      if (prefixLen > 0 && quoteChar) {
        let cursor = i + prefixLen + 1;
        let inner = '';
        while (cursor < code.length) {
          const c = code[cursor];
          if (c === quoteChar && code[cursor - 1] !== '\\') {
            cursor++;
            break;
          }
          inner += c;
          cursor++;
        }
        if (isFString) {
          const tplInner = inner
            .replace(/`/g, '\\`')
            .replace(/\{\{/g, '\uE000')
            .replace(/\}\}/g, '\uE001')
            .replace(/\{([^{}:]+)(?::[^{}]*)?\}/g, (_, expr: string) => {
              return '${' + rewritePythonSyntaxInLine(expr.trim(), true) + '}';
            })
            .replace(/\uE000/g, '{')
            .replace(/\uE001/g, '}');
          out += '`' + tplInner + '`';
        } else {
          out += quoteChar + inner + quoteChar;
        }
        i = cursor;
        continue;
      }
    }

    if (ch === '"' || ch === "'" || ch === '`') {
      const q = ch;
      out += ch;
      i++;
      while (i < code.length) {
        const c = code[i];
        out += c;
        i++;
        if (c === q && code[i - 2] !== '\\') {
          break;
        }
      }
      continue;
    }

    out += ch;
    i++;
  }
  return out;
}

/**
 * Une sentencias Python que continúan en múltiples líneas dentro de paréntesis `()`, corchetes `[]` o llaves `{}`
 * o que terminan con barra invertida `\`. También separa sentencias en una misma línea unidas con `;`.
 */
function joinMultilineBracketStatements(code: string): string {
  const rawLines = code.split('\n');
  const outLines: string[] = [];
  let buffer = '';
  let depth = 0;
  let inStr: string | null = null;

  for (let i = 0; i < rawLines.length; i++) {
    let line = rawLines[i];
    const trimmed = line.trim();
    if (!trimmed && depth === 0) {
      continue;
    }

    const hasExplicitBackslash = /\\\s*$/.test(line);
    if (hasExplicitBackslash) {
      line = line.replace(/\\\s*$/, ' ');
    }

    if (depth === 0 && !buffer) {
      buffer = line;
    } else {
      buffer += ' ' + trimmed;
    }

    for (let c = 0; c < trimmed.length; c++) {
      const ch = trimmed[c];
      if (inStr) {
        if (ch === inStr && trimmed[c - 1] !== '\\') inStr = null;
      } else {
        if (ch === '"' || ch === "'" || ch === '`') {
          inStr = ch;
        } else if (ch === '(' || ch === '[' || ch === '{') {
          depth++;
        } else if (ch === ')' || ch === ']' || ch === '}') {
          depth = Math.max(0, depth - 1);
        }
      }
    }

    if (depth === 0 && !hasExplicitBackslash) {
      outLines.push(buffer);
      buffer = '';
    }
  }

  if (buffer.trim()) {
    outLines.push(buffer);
  }

  // Primero expandir suites de una línea (`if cond: a = 1; b = 2`) y luego dividir `;` conservando la indentación
  const expandedLines: string[] = [];
  for (const line of outLines) {
    const suiteExpanded = expandSingleLineColonSuite(line);
    for (const sLine of suiteExpanded) {
      const sIndent = sLine.match(/^\s*/)?.[0] ?? '';
      const statements = splitTopLevelChar(sLine.trim(), ';');
      for (const stmt of statements) {
        if (!stmt.trim()) continue;
        const nestedSuite = expandSingleLineColonSuite(sIndent + stmt.trim());
        expandedLines.push(...nestedSuite);
      }
    }
  }

  return expandedLines.join('\n');
}

function splitTopLevelChar(str: string, sepChar: string): string[] {
  const parts: string[] = [];
  let cur = '';
  let depth = 0;
  let inStr: string | null = null;
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (inStr) {
      cur += ch;
      if (ch === inStr && str[i - 1] !== '\\') inStr = null;
    } else {
      if (ch === '"' || ch === "'" || ch === '`') {
        inStr = ch;
        cur += ch;
      } else if (ch === '(' || ch === '[' || ch === '{') {
        depth++;
        cur += ch;
      } else if (ch === ')' || ch === ']' || ch === '}') {
        depth = Math.max(0, depth - 1);
        cur += ch;
      } else if (ch === sepChar && depth === 0) {
        if (cur.trim()) parts.push(cur);
        cur = '';
      } else {
        cur += ch;
      }
    }
  }
  if (cur.trim()) parts.push(cur);
  return parts;
}

/**
 * Si una sentencia de bloque (`if`, `elif`, `else`, `for`, `while`, `try`, `except`, `finally`, `with`)
 * tiene código en la misma línea después de `:` (ej. `if bsdf: bsdf.inputs[0].default_value = c`),
 * la divide en dos líneas con la indentación correcta.
 */
function expandSingleLineColonSuite(line: string): string[] {
  const indent = line.match(/^\s*/)?.[0] ?? '';
  const trimmed = line.trim();
  if (!/^(?:if|elif|else|for|while|try|except|finally|with|def)\b/.test(trimmed)) {
    return [line];
  }

  let depth = 0;
  let inStr: string | null = null;
  for (let i = 0; i < trimmed.length; i++) {
    const ch = trimmed[i];
    if (inStr) {
      if (ch === inStr && trimmed[i - 1] !== '\\') inStr = null;
    } else {
      if (ch === '"' || ch === "'" || ch === '`') {
        inStr = ch;
      } else if (ch === '(' || ch === '[' || ch === '{') {
        depth++;
      } else if (ch === ')' || ch === ']' || ch === '}') {
        depth = Math.max(0, depth - 1);
      } else if (ch === ':' && depth === 0) {
        const beforeColon = trimmed.slice(0, i + 1).trim();
        const afterColon = trimmed.slice(i + 1).trim();
        if (!afterColon) {
          return [line];
        }
        return [`${indent}${beforeColon}`, ...expandSingleLineColonSuite(`${indent}    ${afterColon}`)];
      }
    }
  }
  return [line];
}

function isBalancedOuterParens(str: string): { balanced: boolean; hasTopComma: boolean } {
  const s = str.trim();
  if (!s.startsWith('(') || !s.endsWith(')')) {
    return { balanced: false, hasTopComma: false };
  }
  let depth = 0;
  let inStr: string | null = null;
  let hasTopComma = false;

  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (inStr) {
      if (ch === inStr && s[i - 1] !== '\\') inStr = null;
    } else {
      if (ch === '"' || ch === "'" || ch === '`') {
        inStr = ch;
      } else if (ch === '(' || ch === '[' || ch === '{') {
        depth++;
      } else if (ch === ')' || ch === ']' || ch === '}') {
        depth--;
        if (depth === 0 && i < s.length - 1) {
          return { balanced: false, hasTopComma: false };
        }
      } else if (ch === ',' && depth === 1) {
        hasTopComma = true;
      }
    }
  }
  return { balanced: depth === 0, hasTopComma };
}

/**
 * Transforma llamadas a funciones/métodos con argumentos por nombre de Python (`fn(a, k=v)`)
 * en `fn(a, { __isKw: true, k: v })` de forma recursiva en todo el script.
 */
const NON_CALL_KEYWORDS = new Set([
  'if',
  'elif',
  'while',
  'for',
  'def',
  'return',
  'except',
  'catch',
  'switch',
  'function',
  'typeof',
  'await',
  'in',
  'not',
  'and',
  'or',
  'is',
  'else',
  'with',
  'assert',
  'del',
  'yield',
]);

function splitTopLevelCommas(rawArgs: string): string[] {
  const items: string[] = [];
  let current = '';
  let depth = 0;
  let inStr: string | null = null;

  for (let i = 0; i < rawArgs.length; i++) {
    const c = rawArgs[i];
    if (inStr) {
      current += c;
      if (c === inStr && rawArgs[i - 1] !== '\\') inStr = null;
    } else {
      if (c === '"' || chIsOpen(c)) {
        if (c === '"' || c === "'" || c === '`') {
          inStr = c;
          current += c;
        } else {
          depth++;
          current += c;
        }
      } else if (c === "'" || c === '`') {
        inStr = c;
        current += c;
      } else if (c === ')' || c === ']' || c === '}') {
        depth = Math.max(0, depth - 1);
        current += c;
      } else if (c === ',' && depth === 0) {
        if (current.trim()) items.push(current.trim());
        current = '';
      } else {
        current += c;
      }
    }
  }
  if (current.trim()) items.push(current.trim());
  return items;
}

function chIsOpen(c: string): boolean {
  return c === '(' || c === '[' || c === '{';
}

function transformAllKeywordFunctionCalls(code: string): string {
  // No transformar la cabecera de `def nombre_funcion(...):`
  return code
    .split('\n')
    .map((line) => {
      if (/^\s*def\s+[a-zA-Z_]\w*\s*\(/.test(line)) {
        return line;
      }
      return transformKeywordCallsInExpression(line);
    })
    .join('\n');
}

function transformKeywordCallsInExpression(expr: string): string {
  let out = '';
  let i = 0;
  let inStr: string | null = null;

  while (i < expr.length) {
    const ch = expr[i];
    if (inStr) {
      out += ch;
      if (ch === inStr && expr[i - 1] !== '\\') inStr = null;
      i++;
      continue;
    }

    if (ch === '"' || ch === "'" || ch === '`') {
      inStr = ch;
      out += ch;
      i++;
      continue;
    }

    // Buscar un identificador o cadena de propiedades seguida de '('
    const sub = expr.slice(i);
    const callMatch = sub.match(/^([a-zA-Z_][a-zA-Z0-9_.]*)\s*\(/);
    if (callMatch) {
      const fnName = callMatch[1];
      const lastSegment = fnName.split('.').pop() || fnName;

      if (!NON_CALL_KEYWORDS.has(fnName) && !NON_CALL_KEYWORDS.has(lastSegment)) {
        const openParenIdx = i + callMatch[0].length - 1;
        let depth = 1;
        let cursor = openParenIdx + 1;
        let subStr: string | null = null;

        while (cursor < expr.length && depth > 0) {
          const c = expr[cursor];
          if (subStr) {
            if (c === subStr && expr[cursor - 1] !== '\\') subStr = null;
          } else {
            if (c === '"' || c === "'" || c === '`') {
              subStr = c;
            } else if (c === '(') {
              depth++;
            } else if (c === ')') {
              depth--;
            }
          }
          cursor++;
        }

        if (depth === 0) {
          const closeParenIdx = cursor - 1;
          const rawInner = expr.slice(openParenIdx + 1, closeParenIdx).trim();
          const transformedInner = rawInner ? transformKeywordCallsInExpression(rawInner) : '';

          const isAsyncDecimate = fnName === 'bpy.ops.mesh.decimate';
          const prefix = isAsyncDecimate ? 'await ' : '';

          if (!transformedInner) {
            out += `${prefix}${fnName}()`;
          } else {
            const topArgs = splitTopLevelCommas(transformedInner);
            const hasKw = topArgs.some(
              (a) => /^[a-zA-Z_]\w*\s*=(?!=)/.test(a) || /^\*\*[a-zA-Z_]\w*$/.test(a)
            );

            if (hasKw) {
              const posArgs: string[] = [];
              const kwProps: string[] = ['__isKw: true'];

              for (const arg of topArgs) {
                const kwMatch = arg.match(/^([a-zA-Z_]\w*)\s*=(?!=)\s*([\s\S]+)$/);
                const spreadKw = arg.match(/^\*\*([a-zA-Z_]\w*)$/);
                if (spreadKw) {
                  kwProps.push(`...${spreadKw[1]}`);
                } else if (kwMatch) {
                  const key = kwMatch[1];
                  let val = kwMatch[2].trim();
                  const check = isBalancedOuterParens(val);
                  if (check.balanced && check.hasTopComma) {
                    val = '[' + val.slice(1, -1) + ']';
                  }
                  kwProps.push(`${key}: ${val}`);
                } else {
                  posArgs.push(arg);
                }
              }

              const kwObjStr = `{ ${kwProps.join(', ')} }`;
              if (posArgs.length > 0) {
                out += `${prefix}${fnName}(${posArgs.join(', ')}, ${kwObjStr})`;
              } else {
                out += `${prefix}${fnName}(${kwObjStr})`;
              }
            } else {
              out += `${prefix}${fnName}(${transformedInner})`;
            }
          }

          i = cursor;
          continue;
        }
      }
    }

    out += ch;
    i++;
  }

  return out;
}

/**
 * Busca ` for <vars> in <iter> [if <cond>]` en el nivel superior de una expresión interior de `[]`, `()` o `{}`.
 */
function parseTopLevelComprehension(inner: string): {
  expr: string;
  param: string;
  iter: string;
  cond?: string;
} | null {
  let depth = 0;
  let inStr: string | null = null;
  let forIdx = -1;

  for (let i = 0; i < inner.length; i++) {
    const ch = inner[i];
    if (inStr) {
      if (ch === inStr && inner[i - 1] !== '\\') inStr = null;
    } else if (ch === '"' || ch === "'" || ch === '`') {
      inStr = ch;
    } else if (ch === '(' || ch === '[' || ch === '{') {
      depth++;
    } else if (ch === ')' || ch === ']' || ch === '}') {
      depth = Math.max(0, depth - 1);
    } else if (depth === 0) {
      const rem = inner.slice(i);
      if (/^\s+for\s+[a-zA-Z_(]/.test(rem)) {
        forIdx = i;
        break;
      }
    }
  }

  if (forIdx <= 0) return null;

  const exprPart = inner.slice(0, forIdx).trim();
  const afterFor = inner.slice(forIdx).replace(/^\s+for\s+/, '');

  // Encontrar ` in ` a profundidad 0 en afterFor
  depth = 0;
  inStr = null;
  let inIdx = -1;
  for (let i = 0; i < afterFor.length; i++) {
    const ch = afterFor[i];
    if (inStr) {
      if (ch === inStr && afterFor[i - 1] !== '\\') inStr = null;
    } else if (ch === '"' || ch === "'" || ch === '`') {
      inStr = ch;
    } else if (ch === '(' || ch === '[' || ch === '{') {
      depth++;
    } else if (ch === ')' || ch === ']' || ch === '}') {
      depth = Math.max(0, depth - 1);
    } else if (depth === 0) {
      const rem = afterFor.slice(i);
      if (/^\s+in\s+/.test(rem)) {
        inIdx = i;
        break;
      }
    }
  }

  if (inIdx <= 0) return null;

  const rawVars = afterFor.slice(0, inIdx).trim();
  const afterIn = afterFor.slice(inIdx).replace(/^\s+in\s+/, '');

  // Buscar ` if ` opcional a profundidad 0 en afterIn
  depth = 0;
  inStr = null;
  let ifIdx = -1;
  for (let i = 0; i < afterIn.length; i++) {
    const ch = afterIn[i];
    if (inStr) {
      if (ch === inStr && afterIn[i - 1] !== '\\') inStr = null;
    } else if (ch === '"' || ch === "'" || ch === '`') {
      inStr = ch;
    } else if (ch === '(' || ch === '[' || ch === '{') {
      depth++;
    } else if (ch === ')' || ch === ']' || ch === '}') {
      depth = Math.max(0, depth - 1);
    } else if (depth === 0) {
      const rem = afterIn.slice(i);
      if (/^\s+if\s+/.test(rem)) {
        ifIdx = i;
        break;
      }
    }
  }

  const iterPart = (ifIdx !== -1 ? afterIn.slice(0, ifIdx) : afterIn).trim();
  const condPart = ifIdx !== -1 ? afterIn.slice(ifIdx).replace(/^\s+if\s+/, '').trim() : undefined;

  const vClean = rawVars.replace(/^\(|\)$/g, '').trim();
  const param = vClean.includes(',') ? `[${vClean.replace(/\(/g, '[').replace(/\)/g, ']')}]` : vClean;

  return {
    expr: exprPart,
    param,
    iter: iterPart,
    cond: condPart,
  };
}

/**
 * Convierte comprensiones de listas `[expr for x in iter]`, diccionarios `{k: v for x in iter}`
 * y expresiones generadoras `(expr for x in iter)` soportando corchetes anidados como `[v.co[0] for v in bm.verts]`.
 */
function convertListComprehensions(code: string): string {
  let out = '';
  let i = 0;
  let inStr: string | null = null;

  while (i < code.length) {
    const ch = code[i];
    if (inStr) {
      out += ch;
      if (ch === inStr && code[i - 1] !== '\\') inStr = null;
      i++;
      continue;
    }

    if (ch === '"' || ch === "'" || ch === '`') {
      inStr = ch;
      out += ch;
      i++;
      continue;
    }

    if (ch === '[' || ch === '(' || ch === '{') {
      const openChar = ch;
      const closeChar = ch === '[' ? ']' : ch === '(' ? ')' : '}';
      let depth = 1;
      let cursor = i + 1;
      let subStr: string | null = null;

      while (cursor < code.length && depth > 0) {
        const c = code[cursor];
        if (subStr) {
          if (c === subStr && code[cursor - 1] !== '\\') subStr = null;
        } else if (c === '"' || c === "'" || c === '`') {
          subStr = c;
        } else if (c === openChar) {
          depth++;
        } else if (c === closeChar) {
          depth--;
        }
        cursor++;
      }

      if (depth === 0) {
        const rawInner = code.slice(i + 1, cursor - 1);
        const comp = parseTopLevelComprehension(rawInner);
        if (comp) {
          const convExpr = rewritePythonSyntaxInLine(convertListComprehensions(comp.expr));
          const convIter = rewritePythonSyntaxInLine(convertListComprehensions(comp.iter), true);
          const convCond = comp.cond
            ? rewritePythonSyntaxInLine(convertListComprehensions(comp.cond))
            : undefined;

          if (openChar === '{') {
            // Dict comprehension `{k: v for x in iter}` vs Set comprehension `{x for x in iter}`
            let colonIdx = -1;
            let cDepth = 0;
            let cStr: string | null = null;
            for (let k = 0; k < convExpr.length; k++) {
              const cc = convExpr[k];
              if (cStr) {
                if (cc === cStr && convExpr[k - 1] !== '\\') cStr = null;
              } else if (cc === '"' || cc === "'" || cc === '`') {
                cStr = cc;
              } else if (cc === '(' || cc === '[' || cc === '{') {
                cDepth++;
              } else if (cc === ')' || cc === ']' || cc === '}') {
                cDepth = Math.max(0, cDepth - 1);
              } else if (cc === ':' && cDepth === 0) {
                colonIdx = k;
                break;
              }
            }
            if (colonIdx !== -1) {
              const kExpr = convExpr.slice(0, colonIdx).trim();
              const vExpr = convExpr.slice(colonIdx + 1).trim();
              const arrCode = convCond
                ? `Array.from(${convIter}).filter((${comp.param}) => (${convCond})).map((${comp.param}) => [${kExpr}, ${vExpr}])`
                : `Array.from(${convIter}, (${comp.param}) => [${kExpr}, ${vExpr}])`;
              out += `Object.fromEntries(${arrCode})`;
            } else {
              const arrCode = convCond
                ? `Array.from(${convIter}).filter((${comp.param}) => (${convCond})).map((${comp.param}) => (${convExpr}))`
                : `Array.from(${convIter}, (${comp.param}) => (${convExpr}))`;
              out += `new Set(${arrCode})`;
            }
          } else {
            const arrCode = convCond
              ? `Array.from(${convIter}).filter((${comp.param}) => (${convCond})).map((${comp.param}) => (${convExpr}))`
              : `Array.from(${convIter}, (${comp.param}) => (${convExpr}))`;
            out += openChar === '(' ? `(${arrCode})` : arrCode;
          }
          i = cursor;
          continue;
        }
      }
    }

    out += ch;
    i++;
  }

  return out;
}

/**
 * Convierte tuplas de Python `(a, b, c)` en arrays `[a, b, c]` cuando no son llamadas a funciones ni parámetros `=>`.
 */
function convertPythonTuplesToArrays(code: string): string {
  let out = '';
  let i = 0;
  let inStr: string | null = null;

  while (i < code.length) {
    const ch = code[i];
    if (inStr) {
      out += ch;
      if (ch === inStr && code[i - 1] !== '\\') inStr = null;
      i++;
      continue;
    }

    if (ch === '"' || ch === "'" || ch === '`') {
      inStr = ch;
      out += ch;
      i++;
      continue;
    }

    if (ch === '(') {
      const trimmedOut = out.trimEnd();
      const prevChar = trimmedOut.length > 0 ? trimmedOut[trimmedOut.length - 1] : '';
      const trailingWordMatch = trimmedOut.match(/([a-zA-Z_$][a-zA-Z0-9_$]*)$/);
      const trailingWord = trailingWordMatch ? trailingWordMatch[1] : '';

      const isProtectedClause =
        trailingWord === 'def' || trailingWord === 'class' || trailingWord === 'except';
      const isKeywordBeforeParen =
        trailingWord !== '' && !isProtectedClause && NON_CALL_KEYWORDS.has(trailingWord);
      const isFunctionCallOrControl =
        isProtectedClause || (!isKeywordBeforeParen && /[a-zA-Z0-9_$)\]]/.test(prevChar));

      if (!isFunctionCallOrControl) {
        let depth = 1;
        let cursor = i + 1;
        let subStr: string | null = null;
        let hasTopLevelComma = false;

        while (cursor < code.length && depth > 0) {
          const c = code[cursor];
          if (subStr) {
            if (c === subStr && code[cursor - 1] !== '\\') subStr = null;
          } else {
            if (c === '"' || c === "'" || c === '`') {
              subStr = c;
            } else if (c === '(' || c === '[' || c === '{') {
              depth++;
            } else if (c === ')' || c === ']' || c === '}') {
              depth--;
            } else if (c === ',' && depth === 1) {
              hasTopLevelComma = true;
            }
          }
          cursor++;
        }

        const afterClose = code.slice(cursor).trimStart();
        const isArrowFnParams = afterClose.startsWith('=>');

        const innerContent = code.slice(i + 1, cursor - 1).trim();
        const isEmptyTuple = depth === 0 && innerContent === '';
        if (depth === 0 && !isArrowFnParams && (hasTopLevelComma || isEmptyTuple)) {
          const cleanedInner = innerContent.replace(/,\s*$/, '');
          out += '[' + (isEmptyTuple ? '' : convertPythonTuplesToArrays(cleanedInner)) + ']';
          i = cursor;
          continue;
        }
      }
    }

    out += ch;
    i++;
  }

  return out;
}

/**
 * Reescribe operadores y tokens exclusivos de Python (`True`, `False`, `None`, `and`, `or`, `not`, `is`, `in`,
 * `//`, `**`, slicing `[:3]`, índices negativos `[-1]`, unpacking `*arr`, lambdas, `@`, sets) respetando strings.
 */
function rewritePythonSyntaxInLine(line: string, isForOrCompHeader: boolean = false): string {
  // 0. Conjuntos estilo Blender (`return {'FINISHED'}`) se reescriben sobre la línea completa.
  // Deben hacerse antes de segmentar: al separar las strings, la llave y la cadena quedan en
  // segmentos distintos y ninguna regla de conjuntos llegaría a casar (provocaba "Unexpected string").
  line = line.replace(
    /(^|[^a-zA-Z0-9_$.'"])\{\s*(['"][A-Za-z_0-9]+['"](?:\s*,\s*['"][A-Za-z_0-9]+['"])*)\s*\}/g,
    '$1new Set([$2])'
  );

  // 1. Separar en segmentos fuera y dentro de strings para no alterar literales de texto
  const segments: { text: string; isString: boolean }[] = [];
  let cur = '';
  let inStr: string | null = null;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inStr) {
      cur += ch;
      if (ch === inStr && line[i - 1] !== '\\') {
        segments.push({ text: cur, isString: true });
        cur = '';
        inStr = null;
      }
    } else {
      if (ch === '"' || ch === "'" || ch === '`') {
        if (cur) segments.push({ text: cur, isString: false });
        cur = ch;
        inStr = ch;
      } else {
        cur += ch;
      }
    }
  }
  if (cur) {
    segments.push({ text: cur, isString: inStr !== null });
  }

  const processed = segments
    .map((seg) => {
      if (seg.isString) return seg.text;
      let t = seg.text;

      // Asignación de división entera `a //= b` -> `a = Math.trunc((a) / (b))`
      t = t.replace(/^(\s*[a-zA-Z_][a-zA-Z0-9_.\[\]]*)\s*\/\/=\s*(.+)$/, '$1 = Math.trunc(($1) / ($2))');

      // Asignaciones compuestas sobre vectores (`v.co *= 1.2`, `v.co += vec`, `obj.scale *= 0.5`, `obj.location += vec`)
      t = t.replace(
        /^(\s*[a-zA-Z_][a-zA-Z0-9_.\[\]]*\.(?:co|location|scale|rotation_euler|position|rotation))\s*(\+=|-=|\*=|\/=)\s*(.+)$/,
        "bpy._vecOpAssign($1, '$2', $3)"
      );

      // Asignación a slice completo `arr[:] = val` -> `bpy._sliceAssign(arr, val)`
      t = t.replace(/^(\s*[a-zA-Z_][a-zA-Z0-9_.\[\]]*)\[\s*:\s*\]\s*=\s*(?!=)(.+)$/, 'bpy._sliceAssign($1, $2)');

      // Negación unaria antes de exponenciación `-x ** 2` -> `-(x ** 2)` (evita SyntaxError en JS)
      t = t.replace(/(^|[=(\[,:;+\-*/%&|^~<>?\s])-\s*([a-zA-Z0-9_.()\[\]]+)\s*\*\*\s*([a-zA-Z0-9_.()\[\]+-]+)/g, '$1-($2 ** $3)');

      // Repetición de listas estilo Python: `[True] * n` o `[0, 0] * 4` -> `bpy._repeatList([True], n)`
      t = t.replace(/(\[[^\[\]]+\])\s*\*\s*([a-zA-Z0-9_.()\[\]]+)/g, 'bpy._repeatList($1, $2)');

      // Operaciones vectoriales `(a - b).length`, `(a - b).normalized()`, `(a + b).normalized()`
      t = t.replace(
        /\(([^()]+?)\s*-\s*([^()]+?)\)\.(length|normalized|normalize|dot|cross|x|y|z)\b/g,
        'bpy._sub($1, $2).$3'
      );
      t = t.replace(
        /\(([^()]+?)\s*\+\s*([^()]+?)\)\.(length|normalized|normalize|dot|cross|x|y|z)\b/g,
        'bpy._add($1, $2).$3'
      );

      // Multiplicación de matrices con operador `@` de Blender / Python: `mat @ vec`
      while (/([a-zA-Z0-9_.[\]()]+)\s*@\s*([a-zA-Z0-9_.[\]()]+)/.test(t)) {
        t = t.replace(/([a-zA-Z0-9_.[\]()]+)\s*@\s*([a-zA-Z0-9_.[\]()]+)/, 'bpy._matmul($1, $2)');
      }
      // Slicing con paso: `arr[::-1]` -> `[...arr].reverse()`, `arr[s:e:step]` -> `bpy._slice(arr, s, e, step)`
      t = t.replace(
        /([a-zA-Z0-9_)\]])\[\s*([^:\[\]]*)\s*:\s*([^:\[\]]*)\s*:\s*([^:\[\]]*)\s*\]/g,
        (_, obj, start, end, step) => {
          const s = start.trim() ? start.trim() : 'null';
          const e = end.trim() ? end.trim() : 'null';
          const st = step.trim() ? step.trim() : '1';
          return `bpy._slice(${obj}, ${s}, ${e}, ${st})`;
        }
      );
      // Slicing de listas Python: `arr[:3]` -> `arr.slice(0, 3)`, `arr[1:]` -> `arr.slice(1)`
      t = t.replace(
        /([a-zA-Z0-9_)\]])\[\s*([^:\[\]]*)\s*:\s*([^:\[\]]*)\s*\]/g,
        (_, obj, start, end) => {
          const s = start ? start.trim() : '0';
          const e = end ? end.trim() : '';
          return e ? `${obj}.slice(${s}, ${e})` : `${obj}.slice(${s})`;
        }
      );
      // Índices negativos en lectura: `arr[-1]` -> `arr.at(-1)` (cuando no va seguido de `=`)
      t = t.replace(/([a-zA-Z0-9_)\]])\[\s*-\s*([0-9]+)\s*\](?!\s*=[^=])/g, '$1.at(-$2)');
      // Desempaquetado con asterisco en tuplas/listas: `(*rgb, 1.0)` -> `(...rgb, 1.0)`
      t = t.replace(/([(\[,]\s*)\*([a-zA-Z_][a-zA-Z0-9_.[\]():]*)(?=\s*[,)\]])/g, '$1...$2');
      // Lambdas de Python: `lambda x, y: expr` -> `((x, y) => (expr))`
      t = t.replace(
        /\blambda\s+([a-zA-Z0-9_,\s]*?)\s*:\s*([^,)\]\n]+)/g,
        '(($1) => ($2))'
      );
      // Métodos de diccionarios Python: `.items()`, `.values()`, `.keys()`, `.get(...)`, `.setdefault(...)`
      t = t.replace(/([a-zA-Z0-9_.\[\]()]+)\.items\(\)/g, 'bpy._items($1)');
      t = t.replace(/([a-zA-Z0-9_.\[\]()]+)\.values\(\)/g, 'bpy._values($1)');
      t = t.replace(/([a-zA-Z0-9_.\[\]()]+)\.keys\(\)/g, 'bpy._keys($1)');
      t = t.replace(/([a-zA-Z0-9_.\[\]()]+)\.get\(/g, 'bpy._get($1, ');
      t = t.replace(/([a-zA-Z0-9_.\[\]()]+)\.setdefault\(/g, 'bpy._setdefault($1, ');
      // Booleanos, None y operadores lógicos
      t = t
        .replace(/\bTrue\b/g, 'true')
        .replace(/\bFalse\b/g, 'false')
        .replace(/\bNone\b/g, 'null')
        .replace(/\bis\s+not\b/g, '!==')
        .replace(/\bis\b/g, '===')
        .replace(/\band\b/g, '&&')
        .replace(/\bor\b/g, '||')
        .replace(/\bnot\s+/g, '!');
      return t;
    })
    .join('');

  // 2. Resolver división entera `a // b` fuera de strings extrayendo el operando completo (ej. `len(verts) // 2`)
  const afterFloorDiv = rewritePythonFloorDivisions(processed);

  if (isForOrCompHeader) {
    return afterFloorDiv;
  }

  // 3. Resolver `x not in y` y `x in y` fuera de strings
  return rewritePythonInExpressions(afterFloorDiv);
}

function findOutsideStrings(str: string, regex: RegExp): { index: number; length: number; match: RegExpExecArray } | null {
  let inStr: string | null = null;
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (inStr) {
      if (ch === inStr && str[i - 1] !== '\\') inStr = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      inStr = ch;
      continue;
    }
    const sub = str.slice(i);
    const m = regex.exec(sub);
    if (m && m.index === 0) {
      return { index: i, length: m[0].length, match: m };
    }
  }
  return null;
}

function rewritePythonFloorDivisions(line: string): string {
  let result = line;
  let safetyLimit = 25;
  while (safetyLimit-- > 0) {
    const found = findOutsideStrings(result, /^\/\/(?!=)/);
    if (!found) break;

    const beforeStr = result.slice(0, found.index);
    const afterStr = result.slice(found.index + found.length);
    const left = extractBalancedOperandBackward(beforeStr, beforeStr.length - 1);
    const right = extractBalancedOperandForward(afterStr, 0);
    if (!left.operand || !right.operand) break;

    const prefix = beforeStr.slice(0, left.startIdx);
    const suffix = afterStr.slice(right.endIdx);
    result = `${prefix}Math.trunc((${left.operand}) / (${right.operand}))${suffix}`;
  }
  return result;
}

function extractBalancedOperandBackward(str: string, endIdx: number): { operand: string; startIdx: number } {
  let idx = endIdx;
  while (idx >= 0 && /\s/.test(str[idx])) idx--;
  if (idx < 0) return { operand: '', startIdx: endIdx };

  if (str[idx] === '"' || str[idx] === "'" || str[idx] === '`') {
    const q = str[idx];
    let qStart = idx - 1;
    while (qStart >= 0 && (str[qStart] !== q || str[qStart - 1] === '\\')) {
      qStart--;
    }
    const start = Math.max(0, qStart);
    return { operand: str.slice(start, idx + 1), startIdx: start };
  }

  let depth = 0;
  let inQuote: string | null = null;
  let cursor = idx;
  while (cursor >= 0) {
    const ch = str[cursor];
    if (inQuote) {
      if (ch === inQuote && str[cursor - 1] !== '\\') inQuote = null;
    } else if (ch === '"' || ch === "'" || ch === '`') {
      inQuote = ch;
    } else if (ch === ')' || ch === ']' || ch === '}') {
      depth++;
    } else if (ch === '(' || ch === '[' || ch === '{') {
      if (depth > 0) depth--;
      else break;
    } else if (depth === 0) {
      if (/[\s,;:?!=<>&|^~+*/%([{]/.test(ch)) {
        cursor++;
        break;
      }
    }
    cursor--;
  }
  const startIdx = Math.max(0, cursor);
  return { operand: str.slice(startIdx, idx + 1).trim(), startIdx };
}

function extractBalancedOperandForward(str: string, startIdx: number): { operand: string; endIdx: number } {
  let idx = startIdx;
  while (idx < str.length && /\s/.test(str[idx])) idx++;
  if (idx >= str.length) return { operand: '', endIdx: startIdx };

  if (str[idx] === '"' || str[idx] === "'" || str[idx] === '`') {
    const q = str[idx];
    let qEnd = idx + 1;
    while (qEnd < str.length && (str[qEnd] !== q || str[qEnd - 1] === '\\')) {
      qEnd++;
    }
    const end = Math.min(str.length, qEnd + 1);
    return { operand: str.slice(idx, end), endIdx: end };
  }

  let depth = 0;
  let inQuote: string | null = null;
  let cursor = idx;
  while (cursor < str.length) {
    const ch = str[cursor];
    if (inQuote) {
      if (ch === inQuote && str[cursor - 1] !== '\\') inQuote = null;
    } else if (ch === '"' || ch === "'" || ch === '`') {
      inQuote = ch;
    } else if (ch === '(' || ch === '[' || ch === '{') {
      depth++;
    } else if (ch === ')' || ch === ']' || ch === '}') {
      if (depth > 0) depth--;
      else break;
    } else if (depth === 0) {
      if (/[\s,;:?!=<>&|^~+*/%\])}]/.test(ch)) {
        break;
      }
    }
    cursor++;
  }
  return { operand: str.slice(idx, cursor).trim(), endIdx: cursor };
}

function rewritePythonInExpressions(line: string): string {
  let result = line;
  let safetyLimit = 30;
  while (safetyLimit-- > 0) {
    const notInFound = findOutsideStrings(result, /^\s+not\s+in\s+/);
    const inFound = findOutsideStrings(result, /^\s+in\s+/);
    if (!notInFound && !inFound) break;

    let isNotIn = false;
    let matchIdx = -1;
    let matchLen = 0;

    if (notInFound && (!inFound || notInFound.index <= inFound.index)) {
      isNotIn = true;
      matchIdx = notInFound.index;
      matchLen = notInFound.length;
    } else if (inFound) {
      isNotIn = false;
      matchIdx = inFound.index;
      matchLen = inFound.length;
    } else {
      break;
    }

    const beforeStr = result.slice(0, matchIdx);
    const afterStr = result.slice(matchIdx + matchLen);

    const left = extractBalancedOperandBackward(beforeStr, beforeStr.length - 1);
    const right = extractBalancedOperandForward(afterStr, 0);

    if (!left.operand || !right.operand) {
      break;
    }

    const prefix = beforeStr.slice(0, left.startIdx);
    const suffix = afterStr.slice(right.endIdx);
    const replacement = isNotIn
      ? `!bpy._in(${left.operand}, ${right.operand})`
      : `bpy._in(${left.operand}, ${right.operand})`;

    result = prefix + replacement + suffix;
  }
  return result;
}

function rewriteInlineTernaries(line: string): string {
  if (!line.includes(' if ') || !line.includes(' else ')) {
    return line;
  }
  if (/^\s*(?:if|elif|while|for)\b/.test(line)) return line;

  let out = '';
  let i = 0;
  let inStr: string | null = null;
  while (i < line.length) {
    const ch = line[i];
    if (inStr) {
      out += ch;
      if (ch === inStr && line[i - 1] !== '\\') inStr = null;
      i++;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      inStr = ch;
      out += ch;
      i++;
      continue;
    }

    const sub = line.slice(i);
    const ifMatch = sub.match(/^\s+if\s+/);
    if (ifMatch && i > 0) {
      const ifEnd = i + ifMatch[0].length;
      let depth = 0;
      let cursor = ifEnd;
      let elseIdx = -1;
      let subStr: string | null = null;

      while (cursor < line.length) {
        const c = line[cursor];
        if (subStr) {
          if (c === subStr && line[cursor - 1] !== '\\') subStr = null;
        } else if (c === '"' || c === "'" || c === '`') {
          subStr = c;
        } else if (c === '(' || c === '[' || c === '{') {
          depth++;
        } else if (c === ')' || c === ']' || c === '}') {
          if (depth > 0) depth--;
          else break;
        } else if (depth === 0) {
          const rem = line.slice(cursor);
          if (/^\s+else\s+/.test(rem)) {
            elseIdx = cursor;
            break;
          }
          if (c === ';' || c === ':') break;
        }
        cursor++;
      }

      if (elseIdx !== -1) {
        const cond = line.slice(ifEnd, elseIdx).trim();
        const elseMatch = line.slice(elseIdx).match(/^\s+else\s+/);
        const elseEnd = elseIdx + elseMatch![0].length;

        let endCursor = elseEnd;
        let endDepth = 0;
        let endSubStr: string | null = null;

        while (endCursor < line.length) {
          const c = line[endCursor];
          if (endSubStr) {
            if (c === endSubStr && line[endCursor - 1] !== '\\') endSubStr = null;
          } else if (c === '"' || c === "'" || c === '`') {
            endSubStr = c;
          } else if (c === '(' || c === '[' || c === '{') {
            endDepth++;
          } else if (c === ')' || c === ']' || c === '}') {
            if (endDepth > 0) endDepth--;
            else break;
          } else if (endDepth === 0) {
            if (c === ',' || c === ';' || c === ')') break;
          }
          endCursor++;
        }

        const right = line.slice(elseEnd, endCursor).trim();
        const eqIdx = out.lastIndexOf('=');
        if (eqIdx !== -1 && eqIdx > out.lastIndexOf('(') && eqIdx > out.lastIndexOf(',')) {
          const assignPrefix = out.slice(0, eqIdx + 1);
          const leftExpr = out.slice(eqIdx + 1).trim();
          out = `${assignPrefix} ((${cond}) ? (${leftExpr}) : (${right}))`;
        } else {
          const leftExpr = out.trim();
          out = `((${cond}) ? (${leftExpr}) : (${right}))`;
        }
        i = endCursor;
        continue;
      }
    }

    out += ch;
    i++;
  }
  return out;
}

/**
 * Crea un Proxy de Vector 3D compatible con Blender (`v.x, v.y, v.z` y `v[0], v[1], v[2]`)
 * que convierte automáticamente entre coordenadas Blender 5.2 (Z-Up) y Three.js (Y-Up) si `isZUp` está activo.
 */
function createBlenderVectorProxy(
  getThreeXYZ: () => [number, number, number],
  setThreeXYZ: (x: number, y: number, z: number) => void,
  mode: 'location' | 'scale' | 'rotation',
  isZUp: boolean
) {
  const toBlender = (): [number, number, number] => {
    const [tx, ty, tz] = getThreeXYZ();
    if (!isZUp) return [tx, ty, tz];
    if (mode === 'scale') return [tx, tz, ty];
    // En Blender Z-Up: X=tx, Y=-tz, Z=ty
    return [tx, -tz, ty];
  };

  const fromBlender = (bx: number, by: number, bz: number) => {
    if (!isZUp) {
      setThreeXYZ(bx, by, bz);
    } else if (mode === 'scale') {
      setThreeXYZ(bx, bz, by);
    } else {
      setThreeXYZ(bx, bz, -by);
    }
  };

  const target = {
    x: 0,
    y: 0,
    z: 0,
    order: 'XYZ',
    set: (x: number, y: number, z: number) => fromBlender(x, y, z),
    copy: (other: { x?: number; y?: number; z?: number } | number[]) => {
      if (Array.isArray(other)) {
        fromBlender(Number(other[0]) || 0, Number(other[1]) || 0, Number(other[2]) || 0);
      } else if (other && typeof other === 'object') {
        fromBlender(Number(other.x) || 0, Number(other.y) || 0, Number(other.z) || 0);
      }
    },
    rotate_axis: (axis: string, angle: number) => {
      const [bx, by, bz] = toBlender();
      const a = String(axis).toUpperCase();
      const rad = Number(angle) || 0;
      if (a === 'X') fromBlender(bx + rad, by, bz);
      else if (a === 'Y') fromBlender(bx, by + rad, bz);
      else if (a === 'Z') fromBlender(bx, by, bz + rad);
    },
  };

  return new Proxy(target, {
    get(_t, prop) {
      const [bx, by, bz] = toBlender();
      if (prop === 'x' || prop === '0') return bx;
      if (prop === 'y' || prop === '1') return by;
      if (prop === 'z' || prop === '2') return bz;
      if (prop === 'length') return Math.hypot(bx, by, bz);
      if (prop === Symbol.iterator) {
        return function* () {
          yield bx;
          yield by;
          yield bz;
        };
      }
      return Reflect.get(_t, prop);
    },
    set(_t, prop, value) {
      const num = Number(value) || 0;
      const [bx, by, bz] = toBlender();
      if (prop === 'x' || prop === '0') {
        fromBlender(num, by, bz);
        return true;
      }
      if (prop === 'y' || prop === '1') {
        fromBlender(bx, num, bz);
        return true;
      }
      if (prop === 'z' || prop === '2') {
        fromBlender(bx, by, num);
        return true;
      }
      return true;
    },
  });
}

/**
 * Extrae argumentos posicionales y por nombre (`__isKw`) para funciones de la API de Blender o `def` del usuario.
 */
function extractPyArgs(
  rawArgs: unknown[],
  paramNames: string[],
  defaults: Record<string, unknown> = {}
): Record<string, any> {
  const args = [...rawArgs];
  let kw: Record<string, unknown> = {};

  if (
    args.length > 0 &&
    args[args.length - 1] &&
    typeof args[args.length - 1] === 'object' &&
    !Array.isArray(args[args.length - 1]) &&
    (args[args.length - 1] as any).__isKw
  ) {
    kw = args.pop() as Record<string, unknown>;
  } else if (
    args.length === 1 &&
    args[0] &&
    typeof args[0] === 'object' &&
    !Array.isArray(args[0]) &&
    !(args[0] as any)._geometry &&
    !(args[0] as any)._threeMesh &&
    !(args[0] as any)._isBMesh &&
    !(args[0] as any)._isBlenderMaterial &&
    !(args[0] as any)._isMathutils
  ) {
    kw = args.pop() as Record<string, unknown>;
  }

  const result: Record<string, any> = { ...defaults };
  paramNames.forEach((name, idx) => {
    if (idx < args.length && args[idx] !== undefined) {
      result[name] = args[idx];
    } else if (kw[name] !== undefined) {
      result[name] = kw[name];
    }
  });

  for (const [k, v] of Object.entries(kw)) {
    if (k !== '__isKw' && v !== undefined) {
      result[k] = v;
    }
  }
  return result;
}

/**
 * Entorno de ejecución compatible con **Blender 5.2** (`bpy`, `bmesh`, `mathutils`, `Principled BSDF`, `modifiers`, `def`, Z-Up y Y-Up)
 */
export async function executeBlenderPythonScript(
  script: string,
  modelWrapper: THREE.Object3D,
  callbacks?: {
    onTextureChange?: (texName: TexturePatternType) => void;
    onColorChange?: (colorHex: string) => void;
    outlineThickness?: number;
    outlineOpacity?: number;
    normalSmoothing?: number;
    coordinateMode?: BlenderCoordinateMode;
  }
): Promise<ScriptExecutionResult> {
  ensurePythonArrayMethods();
  startBlenderRun();

  const startTime = performance.now();
  const logs: string[] = [];

  const cleanedRawScript = stripMarkdownCodeFences(script);
  const coordMode = callbacks?.coordinateMode ?? 'auto';
  const isZUp =
    coordMode === 'blender_z_up'
      ? true
      : coordMode === 'studio_y_up'
      ? false
      : detectBlenderZUpScript(cleanedRawScript);

  logs.push(
    `Python 3.11 [Blender 5.2 bpy Engine • ${
      isZUp ? 'Modo Blender 5.2 Estándar (Z-Up → Y-Up)' : 'Modo Estudio Nativo (Y-Up)'
    }]`
  );
  logs.push(`>>> Ejecutando script...`);

  const gradientTex = createThreeToneGradientTexture();
  const outThick = callbacks?.outlineThickness ?? 1.25;
  const outOpac = callbacks?.outlineOpacity ?? 0.9;
  const normSmooth = callbacks?.normalSmoothing ?? 0.92;

  const targetParent = modelWrapper.children[0] || modelWrapper;

  // Conversores de vectores Blender <-> Three.js según modo Z-Up / Y-Up
  const convertLocToThree = (loc?: any): [number, number, number] => {
    if (!loc) return [0, isZUp ? 0 : 1.35, 0];
    const x = Number(loc[0] ?? loc.x) || 0;
    const y = Number(loc[1] ?? loc.y) || 0;
    const z = Number(loc[2] ?? loc.z) || 0;
    return isZUp ? [x, z, -y] : [x, y, z];
  };

  const convertRotToThree = (rot?: any): [number, number, number] => {
    if (!rot) return [0, 0, 0];
    const rx = Number(rot[0] ?? rot.x) || 0;
    const ry = Number(rot[1] ?? rot.y) || 0;
    const rz = Number(rot[2] ?? rot.z) || 0;
    return isZUp ? [rx, rz, -ry] : [rx, ry, rz];
  };

  const convertScaleToThree = (sc?: any): [number, number, number] => {
    if (sc === undefined || sc === null) return [1, 1, 1];
    if (typeof sc === 'number') return [sc || 1, sc || 1, sc || 1];
    const sx = Number(sc[0] ?? sc.x) || 1;
    const sy = Number(sc[1] ?? sc.y) || 1;
    const sz = Number(sc[2] ?? sc.z) || 1;
    return isZUp ? [sx, sz, sy] : [sx, sz, sy];
  };

  class VertexProxy {
    index: number;
    posAttr: THREE.BufferAttribute;
    normAttr: THREE.BufferAttribute | null;
    _coProxy!: any;
    normal: any;
    dirty: boolean;

    constructor(idx: number, pos: THREE.BufferAttribute, norm: THREE.BufferAttribute | null) {
      this.index = idx;
      this.posAttr = pos;
      this.normAttr = norm;
      this.dirty = false;
      const tx = pos.getX(idx);
      const ty = pos.getY(idx);
      const tz = pos.getZ(idx);

      const self = this;
      let _bx = tx;
      let _by = isZUp ? -tz : ty;
      let _bz = isZUp ? ty : tz;

      this._coProxy = {
        get x() {
          return _bx;
        },
        set x(v: number) {
          _bx = Number(v) || 0;
          self.dirty = true;
          self.syncToBuffer();
        },
        get y() {
          return _by;
        },
        set y(v: number) {
          _by = Number(v) || 0;
          self.dirty = true;
          self.syncToBuffer();
        },
        get z() {
          return _bz;
        },
        set z(v: number) {
          _bz = Number(v) || 0;
          self.dirty = true;
          self.syncToBuffer();
        },
        get 0() {
          return _bx;
        },
        set 0(v: number) {
          this.x = v;
        },
        get 1() {
          return _by;
        },
        set 1(v: number) {
          this.y = v;
        },
        get 2() {
          return _bz;
        },
        set 2(v: number) {
          this.z = v;
        },
        get length() {
          return Math.hypot(_bx, _by, _bz);
        },
        copy() {
          return [_bx, _by, _bz];
        },
        *[Symbol.iterator]() {
          yield _bx;
          yield _by;
          yield _bz;
        },
      };

      const nx = norm ? norm.getX(idx) : 0;
      const ny = norm ? (isZUp ? -norm.getZ(idx) : norm.getY(idx)) : 1;
      const nz = norm ? (isZUp ? norm.getY(idx) : norm.getZ(idx)) : 0;
      this.normal = {
        x: nx,
        y: ny,
        z: nz,
        0: nx,
        1: ny,
        2: nz,
        *[Symbol.iterator]() {
          yield nx;
          yield ny;
          yield nz;
        },
      };
    }

    get co(): any {
      return this._coProxy;
    }

    set co(val: any) {
      if (val && typeof val === 'object') {
        this._coProxy.x = Number(val[0] ?? val.x ?? this._coProxy.x);
        this._coProxy.y = Number(val[1] ?? val.y ?? this._coProxy.y);
        this._coProxy.z = Number(val[2] ?? val.z ?? this._coProxy.z);
      }
    }

    syncToBuffer(): void {
      if (isZUp) {
        this.posAttr.setXYZ(this.index, this._coProxy.x, this._coProxy.z, -this._coProxy.y);
      } else {
        this.posAttr.setXYZ(this.index, this._coProxy.x, this._coProxy.y, this._coProxy.z);
      }
      this.posAttr.needsUpdate = true;
      totalVerticesModified++;
    }

    commit(): boolean {
      if (this.dirty) {
        this.syncToBuffer();
        this.dirty = false;
        return true;
      }
      return false;
    }
  }

  let meshes: THREE.Mesh[] = [];
  let allVertexProxies: VertexProxy[] = [];
  let proxiesDirty = true;
  let objectsCreatedCount = 0;
  let totalVerticesModified = 0;

  const collectMeshes = () => {
    meshes = [];
    modelWrapper.traverse((child) => {
      if ((child as THREE.Mesh).isMesh && !child.userData.isOutlineMesh) {
        meshes.push(child as THREE.Mesh);
      }
    });
  };

  const ensureVertexProxies = () => {
    if (!proxiesDirty) return allVertexProxies;
    collectMeshes();
    allVertexProxies = [];
    meshes.forEach((m) => {
      const geo = m.geometry as THREE.BufferGeometry;
      const pos = geo.attributes.position as THREE.BufferAttribute;
      const norm = geo.attributes.normal as THREE.BufferAttribute | null;
      if (pos) {
        for (let i = 0; i < pos.count; i++) {
          allVertexProxies.push(new VertexProxy(i, pos, norm));
        }
      }
    });
    proxiesDirty = false;
    return allVertexProxies;
  };

  collectMeshes();

  // ==========================================================================
  // SISTEMA DE MATERIALES Y NODOS PRINCIPLED BSDF DE BLENDER 5.2
  // ==========================================================================
  interface BlenderMaterialInstance {
    _isBlenderMaterial: true;
    name: string;
    use_nodes: boolean;
    diffuse_color: number[];
    metallic: number;
    roughness: number;
    _baseColor: THREE.Color;
    _emissionColor: THREE.Color | null;
    _emissionStrength: number;
    _linkedMeshes: Set<THREE.Mesh>;
    _sync: () => void;
    node_tree: {
      nodes: any;
      links: { new: (...args: any[]) => any; clear: () => void };
    };
  }

  const materialsStore: BlenderMaterialInstance[] = [];

  const createBlenderMaterial = (matName: string = 'Material'): BlenderMaterialInstance => {
    const matObj: BlenderMaterialInstance = {
      _isBlenderMaterial: true,
      name: matName,
      use_nodes: true,
      diffuse_color: [0.8, 0.8, 0.8, 1.0],
      metallic: 0.2,
      roughness: 0.38,
      _baseColor: new THREE.Color('#e11d48'),
      _emissionColor: null,
      _emissionStrength: 0,
      _linkedMeshes: new Set<THREE.Mesh>(),
      _sync() {
        this._linkedMeshes.forEach((m) => {
          applyMaterialToThreeMesh(
            m,
            this._baseColor,
            this.metallic,
            this.roughness,
            this._emissionColor,
            this._emissionStrength
          );
        });
      },
      node_tree: {
        nodes: null,
        links: {
          new: () => ({}),
          clear: () => {},
        },
      },
    };

    const createSocketProxy = (socketKey: string) => {
      let _val: any = socketKey === 'Base Color' ? [0.8, 0.8, 0.8, 1.0] : 0.0;
      return {
        name: socketKey,
        get default_value() {
          return _val;
        },
        set default_value(v: any) {
          _val = v;
          const kLower = socketKey.toLowerCase();
          if (
            kLower === 'base color' ||
            kLower === 'color' ||
            kLower === '0' ||
            socketKey === 'ShaderSocket0'
          ) {
            matObj._baseColor = parsePythonColor(v, '#38bdf8');
            matObj._sync();
          } else if (kLower === 'metallic' || kLower === '4' || kLower === '1') {
            if (typeof v === 'number') {
              matObj.metallic = v;
              matObj._sync();
            }
          } else if (kLower === 'roughness' || kLower === '7' || kLower === '2') {
            if (typeof v === 'number') {
              matObj.roughness = v;
              matObj._sync();
            }
          } else if (kLower.includes('emission') && !kLower.includes('strength')) {
            matObj._emissionColor = parsePythonColor(v, '#38bdf8');
            if (matObj._emissionStrength === 0) matObj._emissionStrength = 1.5;
            matObj._sync();
          } else if (kLower === 'emission strength' || kLower === 'strength') {
            matObj._emissionStrength = Number(v) || 0;
            matObj._sync();
          }
        },
      };
    };

    const socketsMap: Record<string, any> = {};
    const inputsProxy = new Proxy(socketsMap, {
      get(target, prop) {
        if (typeof prop === 'string') {
          if (prop === 'get') {
            return (name: string) => {
              if (!target[name]) target[name] = createSocketProxy(name);
              return target[name];
            };
          }
          if (!target[prop]) {
            target[prop] = createSocketProxy(prop);
          }
          return target[prop];
        }
        return Reflect.get(target, prop);
      },
      has() {
        return true; // Para que `if "Emission Color" in bsdf.inputs:` siempre sea True en Blender 5.2
      },
    });

    const createShaderNode = (nodeName: string, nodeType: string = 'ShaderNodeBsdfPrincipled') => ({
      name: nodeName,
      type: nodeType,
      location: [0, 0],
      inputs: inputsProxy,
      outputs: new Proxy(
        {},
        {
          get: () => ({ default_value: [1, 1, 1, 1] }),
        }
      ),
      color_ramp: {
        elements: new Proxy(
          [
            { position: 0, color: [0, 0, 0, 1] },
            { position: 1, color: [1, 1, 1, 1] },
          ],
          {
            get(arr, p) {
              if (p === 'new') {
                return (pos: number) => {
                  const el = { position: pos, color: [1, 1, 1, 1] };
                  arr.push(el);
                  return el;
                };
              }
              return Reflect.get(arr, p);
            },
          }
        ),
      },
    });

    const nodesDict: Record<string, any> = {
      'Principled BSDF': createShaderNode('Principled BSDF', 'BSDF_PRINCIPLED'),
      'Material Output': createShaderNode('Material Output', 'OUTPUT_MATERIAL'),
      Emission: createShaderNode('Emission', 'EMISSION'),
    };

    matObj.node_tree.nodes = new Proxy(nodesDict, {
      get(target, prop) {
        if (prop === 'get') {
          return (name: string) => target[name] || target['Principled BSDF'];
        }
        if (prop === 'new') {
          return (...rawArgs: unknown[]) => {
            const { type } = extractPyArgs(rawArgs, ['type'], { type: 'ShaderNodeBsdfPrincipled' });
            const node = createShaderNode(String(type), String(type));
            target[String(type)] = node;
            return node;
          };
        }
        if (prop === 'clear') {
          return () => {};
        }
        if (prop === 'remove') {
          return () => {};
        }
        if (typeof prop === 'string') {
          if (!target[prop]) {
            target[prop] = createShaderNode(prop);
          }
          return target[prop];
        }
        return Reflect.get(target, prop);
      },
    });

    return new Proxy(matObj, {
      set(target, prop, value) {
        if (prop === 'diffuse_color') {
          target.diffuse_color = value;
          target._baseColor = parsePythonColor(value, '#38bdf8');
          target._sync();
          return true;
        }
        if (prop === 'metallic') {
          target.metallic = Number(value) || 0;
          target._sync();
          return true;
        }
        if (prop === 'roughness') {
          target.roughness = Number(value) || 0.35;
          target._sync();
          return true;
        }
        return Reflect.set(target, prop, value);
      },
    });
  };

  // ==========================================================================
  // SISTEMA DE OBJETOS Y MODIFICADORES DE BLENDER 5.2 (`BlenderObjectProxy`)
  // ==========================================================================
  interface PendingModifier {
    name: string;
    type: string;
    levels: number;
    render_levels: number;
    use_axis: boolean[];
    mirror_object: any;
    width: number;
    segments: number;
    thickness: number;
    count: number;
    use_relative_offset: boolean;
    relative_offset_displace: number[];
    use_constant_offset: boolean;
    constant_offset_displace: number[];
    ratio: number;
    angle: number;
    factor: number;
    _applied: boolean;
  }

  const allObjectProxies: any[] = [];
  let currentActiveObjProxy: any = null;

  const createBlenderObjectProxy = (mesh: THREE.Mesh) => {
    const locProxy = createBlenderVectorProxy(
      () => [mesh.position.x, mesh.position.y, mesh.position.z],
      (x, y, z) => mesh.position.set(x, y, z),
      'location',
      isZUp
    );
    const scaleProxy = createBlenderVectorProxy(
      () => [mesh.scale.x, mesh.scale.y, mesh.scale.z],
      (x, y, z) => mesh.scale.set(x, y, z),
      'scale',
      isZUp
    );
    const rotProxy = createBlenderVectorProxy(
      () => [mesh.rotation.x, mesh.rotation.y, mesh.rotation.z],
      (x, y, z) => mesh.rotation.set(x, y, z),
      'rotation',
      isZUp
    );

    const assignedMaterials: BlenderMaterialInstance[] = [];
    const modifiersList: PendingModifier[] = [];

    const linkMatToMesh = (mat: any) => {
      if (!mat) return;
      if (mat._isBlenderMaterial) {
        mat._linkedMeshes.add(mesh);
        mat._sync();
      } else if (Array.isArray(mat) || typeof mat === 'string') {
        const c = parsePythonColor(mat as any);
        applyMaterialToThreeMesh(mesh, c);
      }
    };

    const materialsArrayProxy = new Proxy(assignedMaterials, {
      get(target, prop) {
        if (prop === 'append') {
          return (mat: any) => {
            target.push(mat);
            linkMatToMesh(mat);
          };
        }
        if (prop === 'clear') {
          return () => {
            target.length = 0;
          };
        }
        return Reflect.get(target, prop);
      },
      set(target, prop, value) {
        const idx = Number(prop);
        if (!Number.isNaN(idx)) {
          target[idx] = value;
          linkMatToMesh(value);
          return true;
        }
        return Reflect.set(target, prop, value);
      },
    });

    const modifiersProxy = new Proxy(modifiersList, {
      get(target, prop) {
        if (prop === 'new') {
          return (...rawArgs: unknown[]) => {
            const { name, type } = extractPyArgs(rawArgs, ['name', 'type'], {
              name: 'Modifier',
              type: 'SUBSURF',
            });
            const mod: PendingModifier = {
              name: String(name),
              type: String(type).toUpperCase(),
              levels: 2,
              render_levels: 2,
              use_axis: [true, false, false],
              mirror_object: null,
              width: 0.04,
              segments: 2,
              thickness: 0.05,
              count: 2,
              use_relative_offset: true,
              relative_offset_displace: [1.0, 0, 0],
              use_constant_offset: false,
              constant_offset_displace: [0, 0, 0],
              ratio: 0.5,
              angle: 0.4,
              factor: 0.4,
              _applied: false,
            };
            target.push(mod);
            return mod;
          };
        }
        if (prop === 'remove') {
          return (mod: PendingModifier) => {
            const idx = target.indexOf(mod);
            if (idx !== -1) target.splice(idx, 1);
          };
        }
        if (prop === 'get') {
          return (name: string) => target.find((m) => m.name === name) || null;
        }
        if (typeof prop === 'string' && Number.isNaN(Number(prop))) {
          const byName = target.find((m) => m.name === prop);
          if (byName) return byName;
        }
        return Reflect.get(target, prop);
      },
    });

    const getMeshVertexProxies = () => {
      const geo = mesh.geometry as THREE.BufferGeometry;
      const pos = geo.attributes.position as THREE.BufferAttribute;
      const norm = geo.attributes.normal as THREE.BufferAttribute | null;
      const list: VertexProxy[] = [];
      if (pos) {
        for (let i = 0; i < pos.count; i++) {
          list.push(new VertexProxy(i, pos, norm));
        }
      }
      return list;
    };

    const objData = {
      _geometry: mesh.geometry,
      _threeMesh: mesh,
      materials: materialsArrayProxy,
      bevel_depth: 0,
      bevel_resolution: 2,
      extrude: 0,
      use_auto_smooth: true,
      get vertices() {
        return getMeshVertexProxies();
      },
      get polygons() {
        const pos = mesh.geometry.attributes.position;
        const count = pos ? Math.floor(pos.count / 3) : 0;
        const polyArr: any[] = [];
        for (let pIdx = 0; pIdx < count; pIdx++) {
          polyArr.push({
            index: pIdx,
            use_smooth: true,
            material_index: 0,
            vertices: [pIdx * 3, pIdx * 3 + 1, pIdx * 3 + 2],
          });
        }
        (polyArr as any).foreach_set = () => {};
        return polyArr;
      },
      update: () => {
        mesh.geometry.computeVertexNormals();
      },
    };

    const rawObj = {
      _threeMesh: mesh,
      _modifiers: modifiersList,
      name: mesh.name,
      type: 'MESH',
      mode: 'OBJECT',
      data: objData,
      location: locProxy,
      position: locProxy,
      scale: scaleProxy,
      rotation_euler: rotProxy,
      rotation: rotProxy,
      modifiers: modifiersProxy,
      parent: null as any,
      hide_viewport: false,
      hide_render: false,
      show_wire: false,
      get matrix_world() {
        return [
          [mesh.scale.x, 0, 0, mesh.position.x],
          [0, mesh.scale.y, 0, mesh.position.y],
          [0, 0, mesh.scale.z, mesh.position.z],
          [0, 0, 0, 1],
        ];
      },
      evaluated_get: () => rawObj,
      to_mesh: () => objData,
      select_set: () => {},
      select_get: () => true,
      hide_set: () => {},
      keyframe_insert: () => {},
      copy: () => {
        const clonedGeo = mesh.geometry.clone();
        const clonedMesh = new THREE.Mesh(clonedGeo);
        clonedMesh.position.copy(mesh.position);
        clonedMesh.rotation.copy(mesh.rotation);
        clonedMesh.scale.copy(mesh.scale);
        const origMat = mesh.userData.originalMaterial as THREE.MeshStandardMaterial | undefined;
        const col = origMat ? origMat.color.clone() : new THREE.Color('#38bdf8');
        configureNewlySpawnedMesh(clonedMesh, col, gradientTex, outThick, outOpac);
        return createBlenderObjectProxy(clonedMesh);
      },
    };

    const proxy = new Proxy(rawObj, {
      get(target, prop) {
        if (prop === 'name') return mesh.name;
        if (prop === 'active_material') return assignedMaterials[0] || null;
        if (prop === 'material_slots') {
          return new Proxy(assignedMaterials, {
            get(arr, idxProp) {
              const idx = Number(idxProp);
              if (!Number.isNaN(idx)) {
                return {
                  get material() {
                    return arr[idx];
                  },
                  set material(m: any) {
                    arr[idx] = m;
                    linkMatToMesh(m);
                  },
                };
              }
              return Reflect.get(arr, idxProp);
            },
          });
        }
        if (prop === 'dimensions') {
          mesh.geometry.computeBoundingBox();
          const bb = mesh.geometry.boundingBox;
          const sz = new THREE.Vector3(1, 1, 1);
          if (bb) bb.getSize(sz);
          const dx = sz.x * mesh.scale.x;
          const dy = sz.y * mesh.scale.y;
          const dz = sz.z * mesh.scale.z;
          return isZUp ? [dx, dz, dy] : [dx, dy, dz];
        }
        return Reflect.get(target, prop);
      },
      set(target, prop, value) {
        if (prop === 'name') {
          mesh.name = String(value);
          target.name = String(value);
          return true;
        }
        if (prop === 'location' || prop === 'position') {
          if (Array.isArray(value)) {
            const [tx, ty, tz] = convertLocToThree(value);
            mesh.position.set(tx, ty, tz);
          } else if (value && typeof value === 'object') {
            locProxy.copy(value);
          }
          return true;
        }
        if (prop === 'scale') {
          if (Array.isArray(value) || typeof value === 'number') {
            const [sx, sy, sz] = convertScaleToThree(value);
            mesh.scale.set(sx, sy, sz);
          } else if (value && typeof value === 'object') {
            scaleProxy.copy(value);
          }
          return true;
        }
        if (prop === 'dimensions' && Array.isArray(value)) {
          mesh.geometry.computeBoundingBox();
          const bb = mesh.geometry.boundingBox;
          const sz = new THREE.Vector3(1, 1, 1);
          if (bb) bb.getSize(sz);
          const [tx, ty, tz] = convertScaleToThree(value);
          mesh.scale.set(
            tx / Math.max(0.001, sz.x),
            ty / Math.max(0.001, sz.y),
            tz / Math.max(0.001, sz.z)
          );
          return true;
        }
        if (prop === 'rotation_euler' || prop === 'rotation') {
          if (Array.isArray(value)) {
            const [rx, ry, rz] = convertRotToThree(value);
            mesh.rotation.set(rx, ry, rz);
          } else if (value && typeof value === 'object') {
            rotProxy.copy(value);
          }
          return true;
        }
        if (prop === 'active_material' || prop === 'color') {
          assignedMaterials[0] = value;
          linkMatToMesh(value);
          return true;
        }
        return Reflect.set(target, prop, value);
      },
    });

    allObjectProxies.push(proxy);
    return proxy;
  };

  // Inicializar todos los objetos actuales de la escena para que `for obj in list(bpy.data.objects): bpy.data.objects.remove(obj)` funcione
  if (meshes.length > 0) {
    meshes.forEach((m) => {
      currentActiveObjProxy = createBlenderObjectProxy(m);
    });
  } else {
    const dummyMesh = new THREE.Mesh(new THREE.BufferGeometry());
    dummyMesh.name = 'Scene_Root';
    currentActiveObjProxy = createBlenderObjectProxy(dummyMesh);
  }

  const spawnPrimitiveMesh = (
    name: string,
    geometry: THREE.BufferGeometry,
    opts?: {
      location?: [number, number, number];
      rotation?: [number, number, number];
      scale?: [number, number, number] | number;
      color?: [number, number, number] | string;
    }
  ) => {
    const col = parsePythonColor(opts?.color, '#e11d48');
    const mesh = new THREE.Mesh(geometry);
    mesh.name = `${name}_${objectsCreatedCount + 1}`;

    if (opts?.location && Array.isArray(opts.location)) {
      const [tx, ty, tz] = convertLocToThree(opts.location);
      mesh.position.set(tx, ty, tz);
    } else {
      mesh.position.set(0, isZUp ? 0 : 1.35, 0);
    }

    if (opts?.rotation && Array.isArray(opts.rotation)) {
      const [rx, ry, rz] = convertRotToThree(opts.rotation);
      mesh.rotation.set(rx, ry, rz);
    }

    if (opts?.scale !== undefined) {
      const [sx, sy, sz] = convertScaleToThree(opts.scale);
      mesh.scale.set(sx, sy, sz);
    }

    configureNewlySpawnedMesh(mesh, col, gradientTex, outThick, outOpac);

    targetParent.add(mesh);
    objectsCreatedCount++;
    proxiesDirty = true;
    collectMeshes();

    currentActiveObjProxy = createBlenderObjectProxy(mesh);

    logs.push(
      `+ Objeto creado: '${mesh.name}' (${Math.floor(
        (mesh.geometry.attributes.position?.count || 0) / 3
      )} tris)`
    );
    return currentActiveObjProxy;
  };

  // Procesador de modificadores de Blender 5.2 (MIRROR, SUBSURF, BEVEL, SOLIDIFY, ARRAY, DECIMATE)
  const applyPendingModifiersForObject = async (objProxy: any) => {
    const mesh: THREE.Mesh | undefined = objProxy?._threeMesh;
    const mods: PendingModifier[] | undefined = objProxy?._modifiers;
    if (!mesh || !mods || mods.length === 0 || !mesh.parent) return;

    for (const mod of mods) {
      if (mod._applied) continue;
      mod._applied = true;

      const mType = mod.type.toUpperCase();
      if (mType === 'MIRROR') {
        const useX = Array.isArray(mod.use_axis) ? Boolean(mod.use_axis[0]) : true;
        const useY = Array.isArray(mod.use_axis) ? Boolean(mod.use_axis[1]) : false;
        const useZ = Array.isArray(mod.use_axis) ? Boolean(mod.use_axis[2]) : false;

        const mirrorCenter = mod.mirror_object?._threeMesh
          ? mod.mirror_object._threeMesh.position.clone()
          : new THREE.Vector3(0, 0, 0);

        const spawnMirrorAxis = (flipX: boolean, flipThreeY: boolean, flipThreeZ: boolean) => {
          const clonedGeo = mesh.geometry.clone();
          const cloneMesh = new THREE.Mesh(clonedGeo);
          cloneMesh.name = `${mesh.name}_Mirror`;
          cloneMesh.position.set(
            flipX ? 2 * mirrorCenter.x - mesh.position.x : mesh.position.x,
            flipThreeY ? 2 * mirrorCenter.y - mesh.position.y : mesh.position.y,
            flipThreeZ ? 2 * mirrorCenter.z - mesh.position.z : mesh.position.z
          );
          cloneMesh.rotation.set(
            flipThreeY || flipThreeZ ? -mesh.rotation.x : mesh.rotation.x,
            flipX || flipThreeZ ? -mesh.rotation.y : mesh.rotation.y,
            flipX || flipThreeY ? -mesh.rotation.z : mesh.rotation.z
          );
          cloneMesh.scale.copy(mesh.scale);
          cloneMesh.userData.isMirroredClone = true;

          // Si el objeto estaba en x == mirrorCenter.x (vértices desplazados en local), espejar la geometría
          if (
            flipX &&
            Math.abs(mesh.position.x - mirrorCenter.x) < 0.02
          ) {
            clonedGeo.scale(-1, 1, 1);
            // Invertir el orden de vértices por triángulo para conservar las normales hacia afuera
            const pos = clonedGeo.attributes.position as THREE.BufferAttribute;
            if (pos) {
              for (let i = 0; i < pos.count; i += 3) {
                const x1 = pos.getX(i + 1), y1 = pos.getY(i + 1), z1 = pos.getZ(i + 1);
                const x2 = pos.getX(i + 2), y2 = pos.getY(i + 2), z2 = pos.getZ(i + 2);
                pos.setXYZ(i + 1, x2, y2, z2);
                pos.setXYZ(i + 2, x1, y1, z1);
              }
            }
            clonedGeo.computeVertexNormals();
          }

          const origMat = mesh.userData.originalMaterial as THREE.MeshStandardMaterial | undefined;
          const col = origMat ? origMat.color.clone() : new THREE.Color('#38bdf8');
          configureNewlySpawnedMesh(cloneMesh, col, gradientTex, outThick, outOpac, {
            metallic: origMat?.metalness,
            roughness: origMat?.roughness,
            emissionColor: origMat?.emissive,
            emissionStrength: origMat?.emissiveIntensity,
          });
          targetParent.add(cloneMesh);
          objectsCreatedCount++;
        };

        if (useX) spawnMirrorAxis(true, false, false);
        if (useY) spawnMirrorAxis(false, !isZUp, isZUp);
        if (useZ) spawnMirrorAxis(false, isZUp, !isZUp);
        logs.push(`Modifier MIRROR aplicado sobre '${mesh.name}'.`);
      } else if (mType === 'ARRAY') {
        const count = Math.min(24, Math.max(1, Number(mod.count) || 2));
        mesh.geometry.computeBoundingBox();
        const bb = mesh.geometry.boundingBox;
        const size = new THREE.Vector3(1, 1, 1);
        if (bb) bb.getSize(size);
        size.multiply(mesh.scale);

        const rel = convertLocToThree(mod.relative_offset_displace || [1, 0, 0]);
        const cst = convertLocToThree(mod.constant_offset_displace || [0, 0, 0]);

        for (let k = 1; k < count; k++) {
          const cloneGeo = mesh.geometry.clone();
          const cloneMesh = new THREE.Mesh(cloneGeo);
          cloneMesh.name = `${mesh.name}_Array_${k}`;
          cloneMesh.position.set(
            mesh.position.x + k * ((mod.use_relative_offset ? rel[0] * size.x : 0) + (mod.use_constant_offset ? cst[0] : 0)),
            mesh.position.y + k * ((mod.use_relative_offset ? rel[1] * size.y : 0) + (mod.use_constant_offset ? cst[1] : 0)),
            mesh.position.z + k * ((mod.use_relative_offset ? rel[2] * size.z : 0) + (mod.use_constant_offset ? cst[2] : 0))
          );
          cloneMesh.rotation.copy(mesh.rotation);
          cloneMesh.scale.copy(mesh.scale);
          const origMat = mesh.userData.originalMaterial as THREE.MeshStandardMaterial | undefined;
          const col = origMat ? origMat.color.clone() : new THREE.Color('#38bdf8');
          configureNewlySpawnedMesh(cloneMesh, col, gradientTex, outThick, outOpac);
          targetParent.add(cloneMesh);
          objectsCreatedCount++;
        }
        logs.push(`Modifier ARRAY (count=${count}) aplicado sobre '${mesh.name}'.`);
      } else if (mType === 'SOLIDIFY') {
        const thick = Number(mod.thickness) || 0.04;
        const pos = mesh.geometry.attributes.position as THREE.BufferAttribute;
        const norm = mesh.geometry.attributes.normal as THREE.BufferAttribute;
        if (pos && norm) {
          for (let i = 0; i < pos.count; i++) {
            pos.setXYZ(
              i,
              pos.getX(i) + norm.getX(i) * thick * 0.35,
              pos.getY(i) + norm.getY(i) * thick * 0.35,
              pos.getZ(i) + norm.getZ(i) * thick * 0.35
            );
          }
          pos.needsUpdate = true;
          mesh.geometry.computeVertexNormals();
        }
      }
    }
  };

  // Crear colección iterable estilo Blender (`bpy.data.objects`, `bpy.data.meshes`, `bpy.data.materials`)
  const createDataCollection = (items: any[], createFn: (...args: any[]) => any) => {
    return new Proxy(items, {
      get(target, prop) {
        if (prop === 'new') return createFn;
        if (prop === 'get') {
          return (name: string) => target.find((it) => it?.name === name) || null;
        }
        if (prop === 'remove') {
          return (...rawRemoveArgs: any[]) => {
            const item = rawRemoveArgs[0];
            const idx = target.indexOf(item);
            if (idx !== -1) target.splice(idx, 1);
            if (item?._threeMesh && item._threeMesh.parent) {
              item._threeMesh.parent.remove(item._threeMesh);
              proxiesDirty = true;
              collectMeshes();
              if (meshes.length === 0) {
                targetParent.scale.set(1, 1, 1);
                targetParent.position.set(0, -1.35, 0);
                targetParent.rotation.set(0, 0, 0);
              }
            }
          };
        }
        if (typeof prop === 'string' && Number.isNaN(Number(prop)) && prop !== 'length' && prop !== '__isKw') {
          const byName = target.find((it) => it?.name === prop);
          if (byName) return byName;
          if (typeof createFn === 'function') {
            const autoCreated = createFn({ name: prop, __isKw: true });
            if (autoCreated) {
              if (autoCreated.name === undefined) autoCreated.name = prop;
              return autoCreated;
            }
          }
        }
        return Reflect.get(target, prop);
      },
    });
  };

  const meshesStore: any[] = [];

  const createCustomMeshData = (...rawArgs: unknown[]) => {
    const { name: meshName } = extractPyArgs(rawArgs, ['name'], { name: 'CustomMesh' });
    const customGeo = new THREE.BufferGeometry();
    const meshMaterials: any[] = [];
    const meshMaterialsProxy = new Proxy(meshMaterials, {
      get(target, prop) {
        if (prop === 'append') {
          return (mat: any) => {
            target.push(mat);
          };
        }
        if (prop === 'clear') {
          return () => {
            target.length = 0;
          };
        }
        return Reflect.get(target, prop);
      },
    });

    const meshDataObj = {
      name: String(meshName),
      users: 1,
      _geometry: customGeo,
      materials: meshMaterialsProxy,
      polygons: [] as any[],
      vertices: [] as any[],
      from_pydata: (...fdArgs: unknown[]) => {
        const { vertices: rawVerts, faces: rawFaces } = extractPyArgs(
          fdArgs,
          ['vertices', 'edges', 'faces'],
          { vertices: [], edges: [], faces: [] }
        );
        const verts: any[] = Array.isArray(rawVerts) ? rawVerts : [];
        const faces: any[] = Array.isArray(rawFaces) ? rawFaces : [];
        const positions: number[] = [];
        const uvs: number[] = [];

        const transformedVerts: [number, number, number][] = verts.map((v: any) => {
          const vx = Number(v?.[0] ?? v?.x) || 0;
          const vy = Number(v?.[1] ?? v?.y) || 0;
          const vz = Number(v?.[2] ?? v?.z) || 0;
          return isZUp ? [vx, vz, -vy] : [vx, vy, vz];
        });

        let cx = 0, cy = 0, cz = 0;
        if (transformedVerts.length > 0) {
          for (const v of transformedVerts) {
            cx += v[0];
            cy += v[1];
            cz += v[2];
          }
          cx /= transformedVerts.length;
          cy /= transformedVerts.length;
          cz /= transformedVerts.length;
        }

        const pushOutwardTriangle = (
          a: [number, number, number],
          b: [number, number, number],
          c: [number, number, number]
        ) => {
          const abx = b[0] - a[0], aby = b[1] - a[1], abz = b[2] - a[2];
          const acx = c[0] - a[0], acy = c[1] - a[1], acz = c[2] - a[2];
          const nx = aby * acz - abz * acy;
          const ny = abz * acx - abx * acz;
          const nz = abx * acy - aby * acx;
          const tx = (a[0] + b[0] + c[0]) / 3 - cx;
          const ty = (a[1] + b[1] + c[1]) / 3 - cy;
          const tz = (a[2] + b[2] + c[2]) / 3 - cz;
          const dot = nx * tx + ny * ty + nz * tz;

          if (dot < 0) {
            positions.push(a[0], a[1], a[2], c[0], c[1], c[2], b[0], b[1], b[2]);
            uvs.push(a[0], a[1], c[0], c[1], b[0], b[1]);
          } else {
            positions.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
            uvs.push(a[0], a[1], b[0], b[1], c[0], c[1]);
          }
        };

        for (const rawFace of faces) {
          const faceIndices: number[] = Array.isArray(rawFace)
            ? rawFace.map((idxOrV: any) => Number(typeof idxOrV === 'object' ? idxOrV?.index : idxOrV))
            : Array.isArray(rawFace?.verts)
              ? rawFace.verts.map((v: any) => Number(v?.index ?? v))
              : [];

          if (faceIndices.length === 3) {
            const v0 = transformedVerts[faceIndices[0]];
            const v1 = transformedVerts[faceIndices[1]];
            const v2 = transformedVerts[faceIndices[2]];
            if (v0 && v1 && v2) pushOutwardTriangle(v0, v1, v2);
          } else if (faceIndices.length >= 4) {
            const v0 = transformedVerts[faceIndices[0]];
            for (let k = 1; k < faceIndices.length - 1; k++) {
              const v1 = transformedVerts[faceIndices[k]];
              const v2 = transformedVerts[faceIndices[k + 1]];
              if (v0 && v1 && v2) pushOutwardTriangle(v0, v1, v2);
            }
          }
        }

        if (positions.length === 0 && transformedVerts.length > 0) {
          const sz = 0.04;
          for (let i = 0; i < transformedVerts.length; i++) {
            const p = transformedVerts[i];
            positions.push(
              p[0] - sz, p[1] - sz, p[2],
              p[0] + sz, p[1] - sz, p[2],
              p[0], p[1] + sz, p[2]
            );
            uvs.push(0, 0, 1, 0, 0.5, 1);
          }
        }
        customGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
        customGeo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(uvs), 2));
        customGeo.computeVertexNormals();
        logs.push(
          `mesh.from_pydata: ${transformedVerts.length} vértices y ${faces.length} caras ensambladas.`
        );
      },
      update: () => {
        customGeo.computeVertexNormals();
      },
    };
    meshesStore.push(meshDataObj);
    return meshDataObj;
  };

  const linkObjectToScene = (objProxy: any) => {
    if (objProxy && objProxy._threeMesh) {
      const mesh = objProxy._threeMesh as THREE.Mesh;
      if (!mesh.parent) {
        const col = objProxy._color || new THREE.Color('#22d3ee');
        configureNewlySpawnedMesh(mesh, col, gradientTex, outThick, outOpac);
        if (Array.isArray(objProxy._pendingMaterials)) {
          objProxy._pendingMaterials.forEach((m: any) => {
            objProxy.data.materials.append(m);
          });
        }
        targetParent.add(mesh);
        objectsCreatedCount++;
        proxiesDirty = true;
        collectMeshes();
      }
      currentActiveObjProxy = objProxy;
      logs.push(`Objeto '${objProxy.name || 'Custom_Mesh'}' vinculado a la colección de escena.`);
    }
  };

  // Safe proxy generator so unknown Blender scene/render settings, operators, and properties never crash
  const createSafeNoopProxy = (extra: Record<string, any> = {}): any => {
    function NoopConstructor(this: any) {
      return this instanceof NoopConstructor ? this : createSafeNoopProxy();
    }
    NoopConstructor.prototype = {};
    return new Proxy(NoopConstructor, {
      get(target, prop) {
        if (prop in extra) return extra[prop as string];
        if (prop === Symbol.toPrimitive) return () => 0;
        if (prop === 'valueOf') return () => 0;
        if (prop === 'toString') return () => '';
        if (prop === Symbol.iterator) {
          return function* () {};
        }
        if (prop === 'prototype') return target.prototype;
        if (prop === 'objects') {
          return {
            link: linkObjectToScene,
            unlink: () => {},
          };
        }
        return createSafeNoopProxy();
      },
      set() {
        return true;
      },
      apply() {
        return createSafeNoopProxy();
      },
      construct() {
        return createSafeNoopProxy();
      },
    });
  };

  const sceneObjectsProxy = new Proxy(allObjectProxies, {
    get(target, prop) {
      if (prop === 'link') return linkObjectToScene;
      if (prop === 'unlink') return () => {};
      if (prop === 'active') return currentActiveObjProxy;
      if (typeof prop === 'string' && Number.isNaN(Number(prop)) && prop !== 'length') {
        const byName = target.find((it) => it?.name === prop);
        if (byName) return byName;
      }
      return Reflect.get(target, prop);
    },
    set(target, prop, value) {
      if (prop === 'active') {
        currentActiveObjProxy = value;
        return true;
      }
      return Reflect.set(target, prop, value);
    },
  });

  const sceneProxyObj = new Proxy(
    {
      name: 'Scene',
      collection: {
        name: 'Master Collection',
        objects: sceneObjectsProxy,
        children: {
          link: () => {},
        },
      },
      objects: sceneObjectsProxy,
      view_layers: createSafeNoopProxy(),
      render: createSafeNoopProxy(),
      cycles: createSafeNoopProxy(),
      eevee: createSafeNoopProxy(),
      world: createSafeNoopProxy(),
      frame_start: 1,
      frame_end: 250,
      frame_current: 1,
    },
    {
      get(target, prop) {
        if (prop in target) return (target as any)[prop];
        return createSafeNoopProxy();
      },
      set() {
        return true;
      },
    }
  );

  const bpy = {
    _extractArgs: extractPyArgs,
    // Animaciones: bpy.anim.loop(objeto, duracion, funcion(t)) y bpy.anim.agua(objeto)
    anim: {
      loop: (objProxy: any, duracion: any, funcion: any) => {
        const mesh: THREE.Object3D | undefined = objProxy?._threeMesh ?? objProxy;
        if (!mesh || typeof funcion !== 'function') return;
        addBlenderLoop({
          object: mesh,
          base: mesh.position.clone(),
          scale: 1,
          duration: Math.max(0.1, Number(duracion) || 1.0),
          sample: (t: number): [number, number, number] => {
            const r = funcion(t);
            return [Number(r[0]) || 0, Number(r[1]) || 0, Number(r[2]) || 0];
          },
          toThree: (v: [number, number, number]): [number, number, number] =>
            isZUp ? [v[0], v[2], -v[1]] : [v[0], v[1], v[2]],
        });
      },
      agua: (objProxy: any, velocidad: any = 1.0) => {
        const mesh: THREE.Mesh | undefined = objProxy?._threeMesh;
        if (!mesh || !(mesh as THREE.Mesh).isMesh) return;
        const mat = mesh.material as THREE.MeshStandardMaterial;
        const color = mat && mat.color ? mat.color.clone() : new THREE.Color('#38bdf8');
        setBlenderWater(mesh, color, Number(velocidad) || 1.0);
      },
    },
    _get: (obj: any, key: any, defVal: any = null) => {
      if (obj == null) return defVal;
      if (typeof obj.get === 'function') {
        const r = obj.get(key, defVal);
        return r !== undefined && r !== null ? r : defVal;
      }
      if (obj instanceof Map) {
        return obj.has(key) ? obj.get(key) : defVal;
      }
      if (typeof obj === 'object' && key in obj && obj[key] !== undefined) {
        return obj[key];
      }
      return defVal;
    },
    _setdefault: (obj: any, key: any, defVal: any = null) => {
      if (obj && typeof obj === 'object') {
        if (!(key in obj) || obj[key] === undefined) {
          obj[key] = defVal;
        }
        return obj[key];
      }
      return defVal;
    },
    _vecOpAssign: (target: any, op: string, rhs: any) => {
      if (!target || typeof target !== 'object') return target;
      const isScalar = typeof rhs === 'number';
      const rx = isScalar ? rhs : Number(rhs?.[0] ?? rhs?.x ?? (op === '*' || op === '/' ? 1 : 0));
      const ry = isScalar ? rhs : Number(rhs?.[1] ?? rhs?.y ?? (op === '*' || op === '/' ? 1 : 0));
      const rz = isScalar ? rhs : Number(rhs?.[2] ?? rhs?.z ?? (op === '*' || op === '/' ? 1 : 0));

      const apply = (a: number, b: number) => {
        if (op === '+') return a + b;
        if (op === '-') return a - b;
        if (op === '*') return a * b;
        if (op === '/') return b !== 0 ? a / b : a;
        return a;
      };

      if ('x' in target && 'y' in target && 'z' in target) {
        target.x = apply(Number(target.x) || 0, rx);
        target.y = apply(Number(target.y) || 0, ry);
        target.z = apply(Number(target.z) || 0, rz);
      } else if (Array.isArray(target)) {
        target[0] = apply(Number(target[0]) || 0, rx);
        target[1] = apply(Number(target[1]) || 0, ry);
        if (target.length > 2) target[2] = apply(Number(target[2]) || 0, rz);
      }
      return target;
    },
    _repeatList: (arr: any[], count: number) => {
      const n = Math.max(0, Math.floor(Number(count) || 0));
      const out: any[] = [];
      for (let i = 0; i < n; i++) {
        out.push(...(Array.isArray(arr) ? arr : [arr]));
      }
      return out;
    },
    _slice: (seq: any, start?: number | null, stop?: number | null, step?: number | null) => {
      if (seq == null) return [];
      const isStr = typeof seq === 'string';
      const arr = isStr ? seq.split('') : Array.isArray(seq) ? seq : Array.from(seq);
      const len = arr.length;
      const st = step == null ? 1 : Number(step);
      if (st === 0) return isStr ? '' : [];

      let s: number;
      let e: number;
      if (st > 0) {
        s = start == null ? 0 : start < 0 ? Math.max(0, len + start) : Math.min(len, start);
        e = stop == null ? len : stop < 0 ? Math.max(0, len + stop) : Math.min(len, stop);
        const res: any[] = [];
        for (let i = s; i < e; i += st) res.push(arr[i]);
        return isStr ? res.join('') : res;
      } else {
        s = start == null ? len - 1 : start < 0 ? len + start : Math.min(len - 1, start);
        e = stop == null ? -1 : stop < 0 ? len + stop : stop;
        const res: any[] = [];
        for (let i = s; i > e; i += st) {
          if (i >= 0 && i < len) res.push(arr[i]);
        }
        return isStr ? res.join('') : res;
      }
    },
    _sliceAssign: (target: any, start: number, stop: number | null, val: any) => {
      if (!target || typeof target !== 'object') return target;
      const vals = Array.isArray(val) ? val : Array.from(val || []);
      const s = Math.max(0, Number(start) || 0);
      const e = stop == null ? s + vals.length : Number(stop);
      for (let i = s; i < e && i - s < vals.length; i++) {
        target[i] = vals[i - s];
      }
      return target;
    },
    _add: (a: any, b: any) => {
      if (typeof a === 'number' && typeof b === 'number') return a + b;
      if (typeof a === 'string' || typeof b === 'string') return String(a) + String(b);
      if (
        (Array.isArray(a) || a?._isMathutils || (a && 'x' in a)) &&
        (Array.isArray(b) || b?._isMathutils || (b && 'x' in b))
      ) {
        if (a?._isMathutils || b?._isMathutils || ('x' in a && 'x' in b)) {
          return createMathutilsVector([
            Number(a[0] ?? a.x ?? 0) + Number(b[0] ?? b.x ?? 0),
            Number(a[1] ?? a.y ?? 0) + Number(b[1] ?? b.y ?? 0),
            Number(a[2] ?? a.z ?? 0) + Number(b[2] ?? b.z ?? 0),
          ]);
        }
        if (Array.isArray(a) && Array.isArray(b)) {
          return [...a, ...b];
        }
      }
      return (a as any) + (b as any);
    },
    _sub: (a: any, b: any) => {
      if (typeof a === 'number' && typeof b === 'number') return a - b;
      if (
        (Array.isArray(a) || a?._isMathutils || (a && 'x' in a)) &&
        (Array.isArray(b) || b?._isMathutils || (b && 'x' in b))
      ) {
        return createMathutilsVector([
          Number(a[0] ?? a.x ?? 0) - Number(b[0] ?? b.x ?? 0),
          Number(a[1] ?? a.y ?? 0) - Number(b[1] ?? b.y ?? 0),
          Number(a[2] ?? a.z ?? 0) - Number(b[2] ?? b.z ?? 0),
        ]);
      }
      return Number(a) - Number(b);
    },
    _matmul: (a: any, b: any) => {
      if (Array.isArray(a) && a.length === 4 && Array.isArray(a[0])) {
        // 4x4 Matrix @ 4x4 Matrix
        if (Array.isArray(b) && b.length === 4 && Array.isArray(b[0])) {
          const out = [
            [0, 0, 0, 0],
            [0, 0, 0, 0],
            [0, 0, 0, 0],
            [0, 0, 0, 0],
          ];
          for (let r = 0; r < 4; r++) {
            for (let c = 0; c < 4; c++) {
              out[r][c] =
                (a[r][0] || 0) * (b[0][c] || 0) +
                (a[r][1] || 0) * (b[1][c] || 0) +
                (a[r][2] || 0) * (b[2][c] || 0) +
                (a[r][3] || 0) * (b[3][c] || 0);
            }
          }
          return out;
        }
        // 4x4 Matrix @ 3D Vector
        if (Array.isArray(b) || (b && typeof b === 'object')) {
          const x = Number(b[0] ?? b.x ?? 0);
          const y = Number(b[1] ?? b.y ?? 0);
          const z = Number(b[2] ?? b.z ?? 0);
          const rx = a[0][0] * x + a[0][1] * y + a[0][2] * z + (a[0][3] ?? 0);
          const ry = a[1][0] * x + a[1][1] * y + a[1][2] * z + (a[1][3] ?? 0);
          const rz = a[2][0] * x + a[2][1] * y + a[2][2] * z + (a[2][3] ?? 0);
          return createMathutilsVector([rx, ry, rz]);
        }
      }
      if (typeof a === 'number' && typeof b === 'number') return a * b;
      return b;
    },
    _in: (item: any, container: any): boolean => {
      if (!container) return false;
      if (container instanceof Set || container instanceof Map) {
        return container.has(item);
      }
      if (Array.isArray(container) || typeof container === 'string') {
        return container.includes(item);
      }
      if (typeof container === 'object') {
        return item in container;
      }
      return false;
    },
    _items: (obj: any): [any, any][] => {
      if (!obj) return [];
      if (typeof obj.items === 'function') return obj.items();
      if (obj instanceof Map) return Array.from(obj.entries());
      if (typeof obj === 'object') return Object.entries(obj);
      return [];
    },
    _values: (obj: any): any[] => {
      if (!obj) return [];
      if (typeof obj.values === 'function' && !Array.isArray(obj)) return Array.from(obj.values());
      if (Array.isArray(obj)) return obj;
      if (typeof obj === 'object') return Object.values(obj);
      return [];
    },
    _keys: (obj: any): any[] => {
      if (!obj) return [];
      if (typeof obj.keys === 'function' && !Array.isArray(obj)) return Array.from(obj.keys());
      if (typeof obj === 'object') return Object.keys(obj);
      return [];
    },
    _range: (a: number, b?: number, step: number = 1): number[] => {
      const start = b === undefined ? 0 : a;
      const end = b === undefined ? a : b;
      const arr: number[] = [];
      if (step > 0) {
        for (let k = start; k < end; k += step) arr.push(k);
      } else if (step < 0) {
        for (let k = start; k > end; k += step) arr.push(k);
      }
      return arr;
    },
    app: {
      version: [5, 2, 0],
      version_string: '5.2.0',
      version_cycle: 'release',
      background: false,
    },
    types: createSafeNoopProxy(),
    props: createSafeNoopProxy(),
    utils: createSafeNoopProxy({
      register_class: (cls: any) => {
        try {
          if (typeof cls === 'function') {
            const inst = new cls();
            const idname: string = inst.bl_idname || cls.bl_idname || '';
            if (idname && idname.includes('.')) {
              const [cat, op] = idname.split('.');
              if (!(bpy.ops as any)[cat]) (bpy.ops as any)[cat] = {};
              (bpy.ops as any)[cat][op] = (...rawArgs: unknown[]) => {
                if (typeof inst.execute === 'function') {
                  return inst.execute(bpy.context);
                }
                return { FINISHED: true };
              };
            }
            if (typeof inst.execute === 'function' && !inst._autoExecuted) {
              inst._autoExecuted = true;
              inst.execute(bpy.context);
            }
          }
        } catch {
          // Noop
        }
      },
      unregister_class: () => {},
    }),
    path: createSafeNoopProxy({
      basename: (p: string) => String(p || '').split(/[\\/]/).pop() || '',
      abspath: (p: string) => String(p || ''),
    }),
    context: {
      get active_object() {
        return currentActiveObjProxy;
      },
      set active_object(v: any) {
        if (v) currentActiveObjProxy = v;
      },
      get object() {
        return currentActiveObjProxy;
      },
      set object(v: any) {
        if (v) currentActiveObjProxy = v;
      },
      get selected_objects() {
        return allObjectProxies;
      },
      view_layer: {
        objects: sceneObjectsProxy,
        update: () => {},
      },
      collection: {
        objects: sceneObjectsProxy,
      },
      scene: sceneProxyObj,
      evaluated_depsgraph_get: () => createSafeNoopProxy(),
    },
    data: {
      scenes: createDataCollection([sceneProxyObj], () => sceneProxyObj),
      meshes: createDataCollection(meshesStore, createCustomMeshData),
      materials: createDataCollection(materialsStore, (...rawArgs: unknown[]) => {
        const { name } = extractPyArgs(rawArgs, ['name'], { name: 'Material' });
        const mat = createBlenderMaterial(String(name));
        materialsStore.push(mat);
        return mat;
      }),
      objects: createDataCollection(allObjectProxies, (...rawArgs: unknown[]) => {
        const { name: objName, object_data: meshData, color } = extractPyArgs(
          rawArgs,
          ['name', 'object_data', 'color'],
          { name: 'Object', object_data: null, color: '#38bdf8' }
        );
        const geo = meshData?._geometry || new THREE.BufferGeometry();
        const col = parsePythonColor(color, '#38bdf8');
        const mesh = new THREE.Mesh(geo);
        mesh.name = String(objName);
        configureNewlySpawnedMesh(mesh, col, gradientTex, outThick, outOpac);
        const proxy = createBlenderObjectProxy(mesh);
        (proxy as any)._color = col;
        if (Array.isArray(meshData?.materials) && meshData.materials.length > 0) {
          (proxy as any)._pendingMaterials = [...meshData.materials];
          meshData.materials.forEach((m: any) => (proxy.data.materials as any).append(m));
        }
        return proxy;
      }),
      collections: createDataCollection(
        [
          {
            name: 'Collection',
            objects: sceneObjectsProxy,
          },
        ],
        (...rawArgs: unknown[]) => {
          const { name } = extractPyArgs(rawArgs, ['name'], { name: 'Collection' });
          return {
            name: String(name),
            objects: sceneObjectsProxy,
          };
        }
      ),
      curves: createDataCollection([], (...rawArgs: unknown[]) => {
        const { name } = extractPyArgs(rawArgs, ['name', 'type'], { name: 'Curve', type: 'CURVE' });
        const geo = new THREE.TorusGeometry(0.6, 0.05, 12, 32);
        return {
          name: String(name),
          _geometry: geo,
          dimensions: '3D',
          bevel_depth: 0.05,
          splines: {
            new: () => ({
              points: {
                add: () => {},
                0: { co: [0, 0, 0, 1] },
              },
              bezier_points: {
                add: () => {},
                0: { co: [0, 0, 0], handle_left: [0, 0, 0], handle_right: [0, 0, 0] },
              },
            }),
          },
        };
      }),
      armatures: createDataCollection([], () => createSafeNoopProxy()),
      lights: createDataCollection([], () => createSafeNoopProxy()),
      cameras: createDataCollection([], () => createSafeNoopProxy()),
      worlds: createDataCollection([], () => createSafeNoopProxy()),
    },
    ops: {
      object: {
        select_all: (_opts?: { action?: string }) => {},
        select_by_type: (_opts?: { type?: string }) => {},
        mode_set: (_opts?: { mode?: string }) => {},
        shade_smooth: () => {},
        shade_auto_smooth: () => {},
        shade_flat: () => {},
        origin_set: () => {},
        join: () => {},
        duplicate: () => {
          if (currentActiveObjProxy && currentActiveObjProxy.copy) {
            const copyProxy = currentActiveObjProxy.copy();
            linkObjectToScene(copyProxy);
          }
        },
        duplicate_move: (opts?: { TRANSFORM_OT_translate?: { value?: [number, number, number] } }) => {
          if (currentActiveObjProxy && currentActiveObjProxy.copy) {
            const copyProxy = currentActiveObjProxy.copy();
            linkObjectToScene(copyProxy);
            const val = opts?.TRANSFORM_OT_translate?.value;
            if (val) {
              const [dx, dy, dz] = convertLocToThree(val);
              copyProxy._threeMesh.position.x += dx;
              copyProxy._threeMesh.position.y += dy;
              copyProxy._threeMesh.position.z += dz;
            }
          }
        },
        transform_apply: (opts?: { location?: boolean; rotation?: boolean; scale?: boolean }) => {
          const mesh: THREE.Mesh | undefined = currentActiveObjProxy?._threeMesh;
          if (!mesh) return;
          if (opts?.scale !== false) {
            mesh.geometry.scale(mesh.scale.x, mesh.scale.y, mesh.scale.z);
            mesh.scale.set(1, 1, 1);
            mesh.geometry.computeVertexNormals();
          }
          if (opts?.rotation) {
            mesh.geometry.rotateX(mesh.rotation.x);
            mesh.geometry.rotateY(mesh.rotation.y);
            mesh.geometry.rotateZ(mesh.rotation.z);
            mesh.rotation.set(0, 0, 0);
            mesh.geometry.computeVertexNormals();
          }
        },
        modifier_add: (...rawArgs: unknown[]) => {
          const { type } = extractPyArgs(rawArgs, ['type'], { type: 'SUBSURF' });
          if (currentActiveObjProxy?.modifiers?.new) {
            currentActiveObjProxy.modifiers.new(String(type), String(type));
          }
        },
        modifier_apply: async () => {
          if (currentActiveObjProxy) {
            await applyPendingModifiersForObject(currentActiveObjProxy);
          }
        },
        light_add: () => createSafeNoopProxy(),
        camera_add: () => createSafeNoopProxy(),
        empty_add: () => createSafeNoopProxy(),
        armature_add: () => createSafeNoopProxy(),
        text_add: () => createSafeNoopProxy(),
        metaball_add: (...rawArgs: unknown[]) => {
          const opts = extractPyArgs(rawArgs, ['radius', 'location', 'scale', 'color'], {
            radius: 0.5,
          });
          return bpy.ops.mesh.primitive_ico_sphere_add({
            radius: opts.radius ?? 0.5,
            subdivisions: 3,
            location: opts.location,
            scale: opts.scale,
            color: opts.color,
          });
        },
        delete: () => {
          const childrenCopy = [...targetParent.children];
          childrenCopy.forEach((child) => {
            child.traverse((c) => {
              if ((c as THREE.Mesh).isMesh) {
                const m = c as THREE.Mesh;
                m.geometry?.dispose();
              }
            });
            targetParent.remove(child);
          });
          targetParent.scale.setScalar(1);
          targetParent.position.set(0, -1.35, 0);
          targetParent.rotation.set(0, 0, 0);
          allObjectProxies.length = 0;
          proxiesDirty = true;
          collectMeshes();
          logs.push(`bpy.ops.object.delete(): escena limpiada para generar nuevo modelo.`);
        },
      },
      curve: {
        primitive_bezier_circle_add: (...rawArgs: unknown[]) => {
          const opts = extractPyArgs(rawArgs, ['radius', 'location', 'rotation', 'scale', 'color'], {
            radius: 0.8,
          });
          const r = Number(opts.radius) || 0.8;
          const geo = new THREE.TorusGeometry(r, Math.max(0.035, r * 0.06), 14, 36);
          return spawnPrimitiveMesh('BezierCircle', geo, opts as any);
        },
        primitive_bezier_curve_add: (...rawArgs: unknown[]) => {
          const opts = extractPyArgs(rawArgs, ['radius', 'location', 'rotation', 'scale', 'color'], {
            radius: 1.0,
          });
          const len = Number(opts.radius) || 1.0;
          const geo = new THREE.CapsuleGeometry(0.06, len, 8, 16);
          return spawnPrimitiveMesh('BezierCurve', geo, opts as any);
        },
        primitive_nurbs_circle_add: (...rawArgs: unknown[]) =>
          bpy.ops.curve.primitive_bezier_circle_add(...rawArgs),
        primitive_nurbs_curve_add: (...rawArgs: unknown[]) =>
          bpy.ops.curve.primitive_bezier_curve_add(...rawArgs),
        primitive_nurbs_path_add: (...rawArgs: unknown[]) =>
          bpy.ops.curve.primitive_bezier_curve_add(...rawArgs),
      },
      mesh: {
        primitive_plane_add: (...rawArgs: unknown[]) => {
          const opts = extractPyArgs(rawArgs, ['size', 'location', 'rotation', 'scale', 'color'], {
            size: 1.5,
          });
          const s = Number(opts.size) || 1.5;
          const geo = new THREE.BoxGeometry(s, isZUp ? s : 0.04, isZUp ? 0.04 : s, 4, 4, 2);
          if (isZUp) {
            const planeGeo = new THREE.BoxGeometry(s, 0.04, s, 4, 2, 4);
            return spawnPrimitiveMesh('Plane', planeGeo, opts as any);
          }
          return spawnPrimitiveMesh('Plane', geo, opts as any);
        },
        primitive_circle_add: (...rawArgs: unknown[]) => {
          const opts = extractPyArgs(
            rawArgs,
            ['radius', 'vertices', 'location', 'rotation', 'scale', 'color'],
            { radius: 0.8, vertices: 24 }
          );
          const r = Number(opts.radius) || 0.8;
          const v = Number(opts.vertices) || 24;
          const geo = new THREE.CylinderGeometry(r, r, 0.05, v, 1);
          return spawnPrimitiveMesh('Circle', geo, opts as any);
        },
        primitive_grid_add: (...rawArgs: unknown[]) =>
          bpy.ops.mesh.primitive_plane_add(...rawArgs),
        primitive_monkey_add: (...rawArgs: unknown[]) => {
          const opts = extractPyArgs(rawArgs, ['size', 'location', 'rotation', 'scale', 'color'], {
            size: 1.0,
          });
          const s = (Number(opts.size) || 1.0) * 0.5;
          const geo = new THREE.DodecahedronGeometry(s, 2);
          return spawnPrimitiveMesh('Suzanne', geo, opts as any);
        },
        primitive_cube_add: (...rawArgs: unknown[]) => {
          const opts = extractPyArgs(rawArgs, ['size', 'location', 'rotation', 'scale', 'color'], {
            size: 1.0,
          });
          const s = Number(opts.size ?? 1.0);
          // 1 división por cara: 12 triángulos. El suavizado conserva las aristas duras de la caja.
          const geo = new THREE.BoxGeometry(s, s, s, 1, 1, 1);
          return spawnPrimitiveMesh('Cube', geo, opts as any);
        },
        primitive_uv_sphere_add: (...rawArgs: unknown[]) => {
          const opts = extractPyArgs(
            rawArgs,
            ['radius', 'segments', 'ring_count', 'location', 'rotation', 'scale', 'color'],
            { radius: 0.6, segments: 24, ring_count: 16 }
          );
          const r = Number(opts.radius ?? opts.diameter ?? 0.6);
          const segs = Math.min(48, Math.max(8, Number(opts.segments ?? 24)));
          const rings = Math.min(32, Math.max(6, Number(opts.ring_count ?? 16)));
          const geo = new THREE.SphereGeometry(r, segs, rings);
          return spawnPrimitiveMesh('UVSphere', geo, opts as any);
        },
        primitive_ico_sphere_add: (...rawArgs: unknown[]) => {
          const opts = extractPyArgs(
            rawArgs,
            ['radius', 'subdivisions', 'location', 'rotation', 'scale', 'color'],
            { radius: 0.65, subdivisions: 2 }
          );
          const r = Number(opts.radius ?? 0.65);
          const sub = Math.min(4, Math.max(0, Number(opts.subdivisions ?? 2)));
          const geo = new THREE.IcosahedronGeometry(r, sub);
          return spawnPrimitiveMesh('IcoSphere', geo, opts as any);
        },
        primitive_cylinder_add: (...rawArgs: unknown[]) => {
          const opts = extractPyArgs(
            rawArgs,
            ['radius', 'depth', 'vertices', 'location', 'rotation', 'scale', 'color'],
            { radius: 0.45, depth: 1.0, vertices: 20 }
          );
          const r = Number(opts.radius ?? 0.45);
          const d = Number(opts.depth ?? 1.0);
          const v = Math.min(48, Math.max(6, Number(opts.vertices ?? 20)));
          const geo = new THREE.CylinderGeometry(r, r, d, v, 4);
          return spawnPrimitiveMesh('Cylinder', geo, opts as any);
        },
        primitive_cone_add: (...rawArgs: unknown[]) => {
          const opts = extractPyArgs(
            rawArgs,
            ['radius1', 'radius2', 'depth', 'vertices', 'location', 'rotation', 'scale', 'color'],
            { radius1: 0.4, radius2: 0.0, depth: 0.9, vertices: 16 }
          );
          const r1 = Number(opts.radius1 ?? 0.4);
          const r2 = Number(opts.radius2 ?? 0.0);
          const d = Number(opts.depth ?? 0.9);
          const v = Math.min(48, Math.max(4, Number(opts.vertices ?? 16)));
          const geo = new THREE.CylinderGeometry(r2, r1, d, v, 4);
          return spawnPrimitiveMesh('Cone', geo, opts as any);
        },
        primitive_torus_add: (...rawArgs: unknown[]) => {
          const opts = extractPyArgs(
            rawArgs,
            ['major_radius', 'minor_radius', 'location', 'rotation', 'scale', 'color'],
            { major_radius: 0.8, minor_radius: 0.15 }
          );
          const maj = Number(opts.major_radius ?? 0.8);
          const min = Number(opts.minor_radius ?? 0.15);
          const geo = new THREE.TorusGeometry(maj, min, 14, 36);
          if (isZUp) {
            geo.rotateX(Math.PI / 2);
          }
          return spawnPrimitiveMesh('Torus', geo, opts as any);
        },
        primitive_torus_knot_add: (...rawArgs: unknown[]) => {
          const opts = extractPyArgs(
            rawArgs,
            ['radius', 'tube', 'p', 'q', 'location', 'rotation', 'scale', 'color'],
            { radius: 0.7, tube: 0.18, p: 2, q: 3 }
          );
          const r = Number(opts.radius ?? 0.7);
          const tube = Number(opts.tube ?? 0.18);
          const p = Number(opts.p ?? 2);
          const q = Number(opts.q ?? 3);
          const geo = new THREE.TorusKnotGeometry(r, tube, 64, 12, p, q);
          return spawnPrimitiveMesh('TorusKnot', geo, opts as any);
        },
        primitive_capsule_add: (...rawArgs: unknown[]) => {
          const opts = extractPyArgs(
            rawArgs,
            ['radius', 'length', 'cap_subdivisions', 'radial_segments', 'location', 'rotation', 'scale', 'color'],
            { radius: 0.32, length: 0.85, cap_subdivisions: 10, radial_segments: 20 }
          );
          const r = Number(opts.radius ?? 0.32);
          const len = Number(opts.length ?? 0.85);
          const capSub = Number(opts.cap_subdivisions ?? 10);
          const radSeg = Number(opts.radial_segments ?? 20);
          const geo = new THREE.CapsuleGeometry(r, len, capSub, radSeg);
          return spawnPrimitiveMesh('Capsule', geo, opts as any);
        },
        primitive_octahedron_add: (...rawArgs: unknown[]) => {
          const opts = extractPyArgs(
            rawArgs,
            ['radius', 'detail', 'location', 'rotation', 'scale', 'color'],
            { radius: 0.45, detail: 0 }
          );
          const r = Number(opts.radius ?? 0.45);
          const det = Math.min(3, Math.max(0, Number(opts.detail ?? 0)));
          const geo = new THREE.OctahedronGeometry(r, det);
          return spawnPrimitiveMesh('Octahedron', geo, opts as any);
        },
        primitive_dodecahedron_add: (...rawArgs: unknown[]) => {
          const opts = extractPyArgs(
            rawArgs,
            ['radius', 'detail', 'location', 'rotation', 'scale', 'color'],
            { radius: 0.52, detail: 0 }
          );
          const r = Number(opts.radius ?? 0.52);
          const det = Math.min(3, Math.max(0, Number(opts.detail ?? 0)));
          const geo = new THREE.DodecahedronGeometry(r, det);
          return spawnPrimitiveMesh('Dodecahedron', geo, opts as any);
        },
        primitive_blade_add: (...rawArgs: unknown[]) => {
          const opts = extractPyArgs(
            rawArgs,
            ['length', 'width', 'thickness', 'curve', 'location', 'rotation', 'scale', 'color'],
            { length: 1.4, width: 0.26, thickness: 0.06, curve: 0.12 }
          );
          const length = Number(opts.length ?? 1.4);
          const width = Number(opts.width ?? 0.26);
          const thickness = Number(opts.thickness ?? 0.06);
          const curve = Number(opts.curve ?? 0.12);
          const geo = new THREE.BoxGeometry(width, length, thickness, 4, 14, 2);
          const pos = geo.attributes.position as THREE.BufferAttribute;
          const halfLen = length / 2;
          for (let i = 0; i < pos.count; i++) {
            const x = pos.getX(i);
            const y = pos.getY(i);
            const z = pos.getZ(i);
            const t = (y + halfLen) / Math.max(0.001, length);
            const taperWidth = t > 0.7 ? 1.0 - ((t - 0.7) / 0.3) * 0.92 : 1.0 + Math.sin(t * Math.PI) * 0.15;
            const edgeSharpness = Math.max(0.12, 1.0 - Math.abs(x / Math.max(0.001, width * 0.5)) * 0.82);
            const bendX = Math.pow(t, 1.8) * curve;
            pos.setXYZ(i, x * taperWidth + bendX, y, z * edgeSharpness * (1 - t * 0.5));
          }
          geo.computeVertexNormals();
          return spawnPrimitiveMesh('Blade', geo, opts as any);
        },
        primitive_horn_add: (...rawArgs: unknown[]) => {
          const opts = extractPyArgs(
            rawArgs,
            ['base_radius', 'tip_radius', 'length', 'bend', 'segments', 'location', 'rotation', 'scale', 'color', 'radius', 'height', 'curve', 'mirror_x'],
            { base_radius: 0.2, tip_radius: 0.015, length: 1.0, bend: 0.45, segments: 14 }
          );
          const rBase = Number(opts.base_radius ?? opts.radius ?? 0.2);
          const rTip = Number(opts.tip_radius ?? 0.015);
          const len = Number(opts.length ?? opts.height ?? 1.0);
          const bend = Number(opts.bend ?? opts.curve ?? 0.45);
          const segs = Math.min(32, Math.max(8, Number(opts.segments ?? 14)));

          const createSingleHorn = (loc?: [number, number, number], rot?: [number, number, number]) => {
            const geo = new THREE.CylinderGeometry(rTip, rBase, len, 16, segs);
            const pos = geo.attributes.position as THREE.BufferAttribute;
            const halfLen = len / 2;
            for (let i = 0; i < pos.count; i++) {
              const x = pos.getX(i);
              const y = pos.getY(i);
              const z = pos.getZ(i);
              const t = (y + halfLen) / Math.max(0.001, len);
              const curveOffsetZ = -Math.pow(t, 2.0) * bend * len * 0.65;
              const curveOffsetX = Math.sin(t * Math.PI * 0.85) * bend * len * 0.18;
              pos.setXYZ(i, x + curveOffsetX, y, z + curveOffsetZ);
            }
            geo.computeVertexNormals();
            return spawnPrimitiveMesh('Horn', geo, { ...opts, location: loc, rotation: rot } as any);
          };

          const primary = createSingleHorn(opts.location, opts.rotation);
          if (opts.mirror_x && Array.isArray(opts.location) && Math.abs(opts.location[0]) > 0.02) {
            const mLoc: [number, number, number] = [-opts.location[0], opts.location[1], opts.location[2]];
            const mRot: [number, number, number] | undefined = Array.isArray(opts.rotation)
              ? [opts.rotation[0], -opts.rotation[1], -opts.rotation[2]]
              : undefined;
            createSingleHorn(mLoc, mRot);
          }
          return primary;
        },
        primitive_armor_plate_add: (...rawArgs: unknown[]) => {
          const opts = extractPyArgs(
            rawArgs,
            ['width', 'height', 'thickness', 'curvature', 'arch', 'location', 'rotation', 'scale', 'color', 'mirror_x'],
            { width: 0.72, height: 0.65, thickness: 0.09, curvature: 0.32 }
          );
          const width = Number(opts.width ?? 0.72);
          const height = Number(opts.height ?? 0.65);
          const thickness = Number(opts.thickness ?? 0.09);
          const curvature = Number(opts.curvature ?? opts.arch ?? 0.32);

          const createPlate = (loc?: [number, number, number], rot?: [number, number, number]) => {
            const geo = new THREE.BoxGeometry(width, height, thickness, 10, 8, 2);
            const pos = geo.attributes.position as THREE.BufferAttribute;
            const halfW = width / 2;
            const halfH = height / 2;
            for (let i = 0; i < pos.count; i++) {
              const x = pos.getX(i);
              const y = pos.getY(i);
              const z = pos.getZ(i);
              const nx = x / Math.max(0.001, halfW);
              const ny = y / Math.max(0.001, halfH);
              const archZ = (1.0 - nx * nx) * curvature * 0.45;
              const shieldTaper = 1.0 - Math.max(0, -ny) * 0.25;
              pos.setXYZ(i, x * shieldTaper, y, z + archZ);
            }
            geo.computeVertexNormals();
            return spawnPrimitiveMesh('ArmorPlate', geo, { ...opts, location: loc, rotation: rot } as any);
          };

          const primary = createPlate(opts.location, opts.rotation);
          if (opts.mirror_x && Array.isArray(opts.location) && Math.abs(opts.location[0]) > 0.02) {
            const mLoc: [number, number, number] = [-opts.location[0], opts.location[1], opts.location[2]];
            const mRot: [number, number, number] | undefined = Array.isArray(opts.rotation)
              ? [opts.rotation[0], -opts.rotation[1], -opts.rotation[2]]
              : undefined;
            createPlate(mLoc, mRot);
          }
          return primary;
        },
        primitive_limb_pair_add: (...rawArgs: unknown[]) => {
          const opts = extractPyArgs(
            rawArgs,
            ['start_pos', 'mid_pos', 'end_pos', 'thickness', 'joint_size', 'color', 'joint_color', 'span', 'upper_len', 'lower_len', 'radius', 'bend', 'y_top', 'z_offset'],
            {}
          );

          // Soportar tanto formato (start_pos, mid_pos, end_pos) como formato paramétrico (span, upper_len, lower_len, y_top)
          let sPos: [number, number, number] = opts.start_pos ?? [0.42, 1.58, 0.0];
          let mPos: [number, number, number] = opts.mid_pos ?? [0.78, 1.18, 0.12];
          let ePos: [number, number, number] = opts.end_pos ?? [0.72, 0.72, 0.34];

          if (!opts.start_pos && opts.span !== undefined) {
            const span = Number(opts.span) || 0.38;
            const uLen = Number(opts.upper_len) || 0.52;
            const lLen = Number(opts.lower_len) || 0.54;
            const bend = Number(opts.bend) || 0.35;
            const yTop = Number(opts.y_top) || 1.2;
            const zOff = Number(opts.z_offset) || 0.0;
            sPos = [span, yTop, zOff];
            mPos = [span + bend * 0.35, yTop - uLen * 0.85, zOff + bend * 0.28];
            ePos = [span + bend * 0.2, yTop - (uLen + lLen) * 0.88, zOff + bend * 0.12];
          }

          const thick = Number(opts.thickness ?? opts.radius ?? 0.15);
          const jSize = Number(opts.joint_size ?? thick * 1.28);
          const mainCol = opts.color ?? [0.2, 0.25, 0.36];
          const jCol = opts.joint_color ?? [0.95, 0.68, 0.12];

          const createSegmentBetween = (
            p1: THREE.Vector3,
            p2: THREE.Vector3,
            r: number,
            col: [number, number, number] | string
          ) => {
            const dir = new THREE.Vector3().subVectors(p2, p1);
            const len = Math.max(0.05, dir.length());
            const center = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);
            const quat = new THREE.Quaternion().setFromUnitVectors(
              new THREE.Vector3(0, 1, 0),
              dir.clone().normalize()
            );
            const euler = new THREE.Euler().setFromQuaternion(quat);
            const geo = new THREE.CapsuleGeometry(r, Math.max(0.02, len - r * 1.2), 8, 16);
            spawnPrimitiveMesh('LimbSeg', geo, {
              location: [center.x, center.y, center.z],
              rotation: [euler.x, euler.y, euler.z],
              color: col,
            });
          };

          for (const side of [-1, 1]) {
            const pStart = new THREE.Vector3(sPos[0] * side, sPos[1], sPos[2]);
            const pMid = new THREE.Vector3(mPos[0] * side, mPos[1], mPos[2]);
            const pEnd = new THREE.Vector3(ePos[0] * side, ePos[1], ePos[2]);

            spawnPrimitiveMesh('JointTop', new THREE.IcosahedronGeometry(jSize, 2), {
              location: [pStart.x, pStart.y, pStart.z],
              color: jCol,
            });
            createSegmentBetween(pStart, pMid, thick, mainCol);
            spawnPrimitiveMesh('JointMid', new THREE.IcosahedronGeometry(jSize * 0.88, 2), {
              location: [pMid.x, pMid.y, pMid.z],
              color: jCol,
            });
            createSegmentBetween(pMid, pEnd, thick * 0.85, mainCol);
            spawnPrimitiveMesh('LimbEnd', new THREE.DodecahedronGeometry(jSize * 0.92, 1), {
              location: [pEnd.x, pEnd.y, pEnd.z],
              color: jCol,
            });
          }
          logs.push(`bpy.ops.mesh.primitive_limb_pair_add: Par de extremidades articuladas simétricas generadas.`);
        },
        primitive_wing_pair_add: (...rawArgs: unknown[]) => {
          const opts = extractPyArgs(
            rawArgs,
            ['span', 'feathers', 'y_height', 'z_offset', 'spread', 'color', 'accent_color', 'y_pos', 'z_pos'],
            { span: 1.9, feathers: 6, y_height: 1.65, z_offset: -0.28, spread: 0.9 }
          );
          const span = Number(opts.span ?? 1.9);
          const feathers = Math.min(12, Math.max(3, Number(opts.feathers ?? 6)));
          const yHeight = Number(opts.y_height ?? opts.y_pos ?? 1.65);
          const zOffset = Number(opts.z_offset ?? opts.z_pos ?? -0.28);
          const spread = Number(opts.spread ?? 0.9);
          const colMain = opts.color ?? [0.9, 0.16, 0.32];
          const colAcc = opts.accent_color ?? [0.98, 0.74, 0.14];

          for (const side of [-1, 1]) {
            for (let i = 0; i < feathers; i++) {
              const t = i / Math.max(1, feathers - 1);
              const angle = (0.25 + t * spread * 1.15) * side;
              const dist = 0.45 + t * (span * 0.55);
              const px = side * (0.28 + Math.cos(t * 0.9) * dist * 0.75);
              const py = yHeight + (0.35 - t * 0.65) * (span * 0.45);
              const pz = zOffset - t * 0.18;
              const fLen = span * (0.68 - t * 0.28);

              bpy.ops.mesh.primitive_blade_add({
                length: fLen,
                width: 0.18,
                thickness: 0.045,
                curve: 0.12 * side,
                location: [px, py, pz],
                rotation: [0.18, -0.2 * side, -angle],
                color: i % 2 === 0 ? colMain : colAcc,
              });
            }
          }
          logs.push(`bpy.ops.mesh.primitive_wing_pair_add: Par de alas con ${feathers * 2} plumas/hojas creadas.`);
        },
        primitive_wheel_pair_add: (...rawArgs: unknown[]) => {
          const opts = extractPyArgs(
            rawArgs,
            ['radius', 'width', 'span', 'y_pos', 'z_pos', 'color', 'rim_color'],
            { radius: 0.42, width: 0.26, span: 0.78, y_pos: 0.42, z_pos: 0.0 }
          );
          const r = Number(opts.radius ?? 0.42);
          const w = Number(opts.width ?? 0.26);
          const span = Number(opts.span ?? 0.78);
          const yPos = Number(opts.y_pos ?? 0.42);
          const zPos = Number(opts.z_pos ?? 0.0);
          const tireCol = opts.color ?? [0.15, 0.17, 0.22];
          const rimCol = opts.rim_color ?? [0.95, 0.72, 0.15];

          // Eje central de conexión
          spawnPrimitiveMesh('Axle', new THREE.CylinderGeometry(r * 0.16, r * 0.16, span * 2, 12), {
            location: [0, yPos, zPos],
            rotation: [0, 0, Math.PI / 2],
            color: tireCol,
          });

          for (const side of [-1, 1]) {
            // Neumático / Rueda exterior
            spawnPrimitiveMesh('WheelTire', new THREE.CylinderGeometry(r, r, w, 24), {
              location: [side * span, yPos, zPos],
              rotation: [0, 0, Math.PI / 2],
              color: tireCol,
            });
            // Llanta interior metálica
            spawnPrimitiveMesh('WheelRim', new THREE.CylinderGeometry(r * 0.58, r * 0.58, w * 1.08, 16), {
              location: [side * span, yPos, zPos],
              rotation: [0, 0, Math.PI / 2],
              color: rimCol,
            });
          }
          logs.push(`bpy.ops.mesh.primitive_wheel_pair_add: Par de ruedas y eje generados.`);
        },
        primitive_arch_add: (...rawArgs: unknown[]) => {
          const opts = extractPyArgs(
            rawArgs,
            ['width', 'height', 'thickness', 'location', 'rotation', 'color', 'accent_color'],
            { width: 1.4, height: 1.8, thickness: 0.26, location: [0, 0.2, 0] }
          );
          const width = Number(opts.width ?? 1.4);
          const height = Number(opts.height ?? 1.8);
          const thick = Number(opts.thickness ?? 0.26);
          const loc = Array.isArray(opts.location) ? opts.location : [0, 0.2, 0];
          const colMain = opts.color ?? [0.58, 0.62, 0.70];
          const colAcc = opts.accent_color ?? [0.95, 0.72, 0.16];

          const halfSpan = width * 0.5;
          const pillarH = height * 0.65;

          for (const side of [-1, 1]) {
            // Columna vertical
            spawnPrimitiveMesh('ArchPillar', new THREE.BoxGeometry(thick, pillarH, thick, 2, 4, 2), {
              location: [loc[0] + side * halfSpan, loc[1] + pillarH * 0.5, loc[2]],
              color: colMain,
            });
            // Base y capitel de la columna
            spawnPrimitiveMesh('PillarBase', new THREE.BoxGeometry(thick * 1.35, thick * 0.45, thick * 1.35), {
              location: [loc[0] + side * halfSpan, loc[1] + thick * 0.22, loc[2]],
              color: colAcc,
            });
            spawnPrimitiveMesh('PillarCap', new THREE.BoxGeometry(thick * 1.35, thick * 0.45, thick * 1.35), {
              location: [loc[0] + side * halfSpan, loc[1] + pillarH, loc[2]],
              color: colAcc,
            });
          }

          // Dovelas del arco superior semicircular
          const archSteps = 7;
          for (let i = 0; i < archSteps; i++) {
            const t = i / (archSteps - 1);
            const ang = t * Math.PI;
            const ax = loc[0] + Math.cos(ang) * halfSpan;
            const ay = loc[1] + pillarH + Math.sin(ang) * halfSpan * 0.85;
            const isKeystone = i === Math.floor(archSteps / 2);
            spawnPrimitiveMesh(
              'ArchStone',
              new THREE.BoxGeometry(thick * (isKeystone ? 1.15 : 0.92), thick * 0.95, thick * (isKeystone ? 1.2 : 1.0)),
              {
                location: [ax, ay, loc[2]],
                rotation: [0, 0, ang - Math.PI / 2],
                color: isKeystone ? colAcc : colMain,
              }
            );
          }
          logs.push(`bpy.ops.mesh.primitive_arch_add: Arco arquitectónico con columnas generado.`);
        },
        primitive_tree_foliage_add: (...rawArgs: unknown[]) => {
          const opts = extractPyArgs(
            rawArgs,
            ['radius', 'layers', 'location', 'color', 'accent_color'],
            { radius: 0.95, layers: 3, location: [0, 2.0, 0] }
          );
          const rad = Number(opts.radius ?? 0.95);
          const layers = Math.min(6, Math.max(2, Number(opts.layers ?? 3)));
          const loc = Array.isArray(opts.location) ? opts.location : [0, 2.0, 0];
          const colMain = opts.color ?? [0.18, 0.76, 0.36];
          const colAcc = opts.accent_color ?? [0.36, 0.90, 0.46];

          for (let i = 0; i < layers; i++) {
            const t = i / Math.max(1, layers - 1);
            const layerR = rad * (1.0 - t * 0.38);
            const ly = loc[1] + i * (rad * 0.45);
            spawnPrimitiveMesh('FoliageCrown', new THREE.IcosahedronGeometry(layerR, 2), {
              location: [loc[0], ly, loc[2]],
              scale: [1.15, 0.72, 1.15],
              color: i % 2 === 0 ? colMain : colAcc,
            });
          }
          logs.push(`bpy.ops.mesh.primitive_tree_foliage_add: Copa de follaje estilizado en ${layers} capas creada.`);
        },
        primitive_prop_chest_add: (...rawArgs: unknown[]) => {
          const opts = extractPyArgs(
            rawArgs,
            ['width', 'height', 'depth', 'location', 'color', 'accent_color'],
            { width: 1.35, height: 0.9, depth: 0.88, location: [0, 0.5, 0] }
          );
          const w = Number(opts.width ?? 1.35);
          const h = Number(opts.height ?? 0.9);
          const d = Number(opts.depth ?? 0.88);
          const loc = Array.isArray(opts.location) ? opts.location : [0, 0.5, 0];
          const woodCol = opts.color ?? [0.48, 0.24, 0.10];
          const metalCol = opts.accent_color ?? [0.96, 0.74, 0.14];

          // Caja base del cofre
          spawnPrimitiveMesh('ChestBase', new THREE.BoxGeometry(w, h * 0.62, d, 4, 4, 4), {
            location: [loc[0], loc[1], loc[2]],
            color: woodCol,
          });
          // Tapa cilíndrica abovedada superior
          spawnPrimitiveMesh('ChestLid', new THREE.CylinderGeometry(d * 0.5, d * 0.5, w * 0.98, 18), {
            location: [loc[0], loc[1] + h * 0.31, loc[2]],
            rotation: [0, 0, Math.PI / 2],
            color: woodCol,
          });
          // Herrajes laterales dorados y cerradura frontal
          for (const side of [-1, 1]) {
            spawnPrimitiveMesh('ChestBand', new THREE.BoxGeometry(w * 0.12, h * 0.68, d * 1.05), {
              location: [loc[0] + side * (w * 0.36), loc[1] + h * 0.04, loc[2]],
              color: metalCol,
            });
          }
          spawnPrimitiveMesh('ChestLock', new THREE.BoxGeometry(w * 0.18, h * 0.28, d * 0.12), {
            location: [loc[0], loc[1] + h * 0.22, loc[2] + d * 0.52],
            color: metalCol,
          });
          logs.push(`bpy.ops.mesh.primitive_prop_chest_add: Cofre / contenedor 3D generado.`);
        },
        subdivide: () => {
          const affected = applyGlobalLaplacianSmoothing(modelWrapper, 2, 0.35);
          totalVerticesModified += affected;
          proxiesDirty = true;
        },
        bevel: () => {
          const affected = applyGlobalLaplacianSmoothing(modelWrapper, 1, 0.25);
          totalVerticesModified += affected;
          proxiesDirty = true;
        },
        extrude_region_move: () => {},
        mirror_x: () => {
          collectMeshes();
          const sourceMeshes = [...meshes];
          let mirroredCount = 0;
          sourceMeshes.forEach((m) => {
            if (Math.abs(m.position.x) > 0.08 && !m.userData.isMirroredClone) {
              const hasTwin = sourceMeshes.some(
                (other) =>
                  other !== m &&
                  Math.abs(other.position.x + m.position.x) < 0.06 &&
                  Math.abs(other.position.y - m.position.y) < 0.06 &&
                  Math.abs(other.position.z - m.position.z) < 0.06
              );
              if (!hasTwin) {
                const clonedGeo = m.geometry.clone();
                const cloneMesh = new THREE.Mesh(clonedGeo);
                cloneMesh.name = `${m.name}_MirrorX`;
                cloneMesh.position.set(-m.position.x, m.position.y, m.position.z);
                cloneMesh.rotation.set(m.rotation.x, -m.rotation.y, -m.rotation.z);
                cloneMesh.scale.copy(m.scale);
                cloneMesh.userData.isMirroredClone = true;

                const origMat = m.userData.originalMaterial as THREE.MeshStandardMaterial | undefined;
                const col = origMat ? origMat.color.clone() : new THREE.Color('#38bdf8');
                configureNewlySpawnedMesh(cloneMesh, col, gradientTex, outThick, outOpac);
                targetParent.add(cloneMesh);
                objectsCreatedCount++;
                mirroredCount++;
              }
            }
          });
          proxiesDirty = true;
          collectMeshes();
          logs.push(`bpy.ops.mesh.mirror_x(): ${mirroredCount} piezas duplicadas en simetría espejo X.`);
        },
        taper: (...rawArgs: unknown[]) => {
          const options = extractPyArgs(rawArgs, ['factor', 'axis'], { factor: 0.25, axis: 'Y' });
          const factor = Number(options.factor ?? 0.25);
          const axis = options.axis ?? 'Y';
          let count = 0;
          ensureVertexProxies().forEach((v) => {
            if (axis === 'Y') {
              const scaleXZ = Math.max(0.2, 1.0 + (v.co.y - 1.2) * factor);
              v.co.x *= scaleXZ;
              v.co.z *= scaleXZ;
            }
            v.commit();
            count++;
          });
          totalVerticesModified += count;
          logs.push(`bpy.ops.mesh.taper(factor=${factor}): silueta estilizada.`);
        },
        auto_ground: () => {
          collectMeshes();
          if (meshes.length === 0) return;
          let minLocalY = Infinity;
          meshes.forEach((m) => {
            m.geometry.computeBoundingBox();
            const bb = m.geometry.boundingBox;
            if (bb) {
              const worldMinY = m.position.y + bb.min.y * m.scale.y;
              if (worldMinY < minLocalY) minLocalY = worldMinY;
            }
          });
          if (Number.isFinite(minLocalY)) {
            const desiredMinY = 0.02;
            const shiftY = desiredMinY - minLocalY;
            meshes.forEach((m) => {
              m.position.y += shiftY;
            });
            logs.push(
              `bpy.ops.mesh.auto_ground(): modelo alineado perfectamente sobre el pedestal (ajuste Y=${shiftY.toFixed(2)}).`
            );
          }
        },
        smooth: (...rawArgs: unknown[]) => {
          const options = extractPyArgs(rawArgs, ['iterations', 'factor'], {
            iterations: 3,
            factor: 0.5,
          });
          const iter = Number(options.iterations ?? 3);
          const fac = Number(options.factor ?? 0.5);
          const affected = applyGlobalLaplacianSmoothing(modelWrapper, iter, fac);
          totalVerticesModified += affected;
          proxiesDirty = true;
          logs.push(
            `bpy.ops.mesh.smooth(iterations=${iter}, factor=${fac}): ${affected} vértices redondeados.`
          );
        },
        decimate: async (...rawArgs: unknown[]) => {
          const options = extractPyArgs(rawArgs, ['ratio'], { ratio: 0.5 });
          const ratio = Number(options.ratio ?? 0.5);
          logs.push(`bpy.ops.mesh.decimate(ratio=${ratio}): procesando reducción...`);
          const res = await decimateModelGeometry(modelWrapper, 1 - ratio, { preserveFeatures: true });
          proxiesDirty = true;
          logs.push(
            `Reducción completada: de ${res.originalTriangles} a ${res.newTriangles} triángulos.`
          );
        },
        inflate: (...rawArgs: unknown[]) => {
          const options = extractPyArgs(rawArgs, ['amount'], { amount: 0.05 });
          const amount = Number(options.amount ?? 0.05);
          let count = 0;
          ensureVertexProxies().forEach((v) => {
            v.co.x += v.normal.x * amount;
            v.co.y += v.normal.y * amount;
            v.co.z += v.normal.z * amount;
            v.commit();
            count++;
          });
          totalVerticesModified += count;
          logs.push(
            `bpy.ops.mesh.inflate(amount=${amount}): ${count} vértices desplazados hacia afuera.`
          );
        },
        noise: (...rawArgs: unknown[]) => {
          const options = extractPyArgs(rawArgs, ['scale', 'frequency'], {
            scale: 0.04,
            frequency: 3.0,
          });
          const scale = Number(options.scale ?? 0.04);
          const freq = Number(options.frequency ?? 3.0);
          let count = 0;
          ensureVertexProxies().forEach((v) => {
            const nX = (Math.sin(v.co.y * freq * 3.1) + Math.cos(v.co.z * freq * 2.3)) * scale;
            const nY = (Math.sin(v.co.z * freq * 2.7) + Math.cos(v.co.x * freq * 3.7)) * scale;
            const nZ = (Math.sin(v.co.x * freq * 1.9) + Math.cos(v.co.y * freq * 2.9)) * scale;
            v.co.x += nX;
            v.co.y += nY;
            v.co.z += nZ;
            v.commit();
            count++;
          });
          totalVerticesModified += count;
          logs.push(`bpy.ops.mesh.noise(scale=${scale}, frequency=${freq}): ruido aplicado.`);
        },
        twist: (...rawArgs: unknown[]) => {
          const options = extractPyArgs(rawArgs, ['angle', 'axis'], { angle: 0.4, axis: 'Y' });
          const angle = Number(options.angle ?? 0.4);
          const axis = options.axis ?? 'Y';
          let count = 0;
          ensureVertexProxies().forEach((v) => {
            if (axis === 'Y') {
              const theta = v.co.y * angle;
              const cosT = Math.cos(theta);
              const sinT = Math.sin(theta);
              const newX = v.co.x * cosT - v.co.z * sinT;
              const newZ = v.co.x * sinT + v.co.z * cosT;
              v.co.x = newX;
              v.co.z = newZ;
            } else if (axis === 'X') {
              const theta = v.co.x * angle;
              const cosT = Math.cos(theta);
              const sinT = Math.sin(theta);
              const newY = v.co.y * cosT - v.co.z * sinT;
              const newZ = v.co.y * sinT + v.co.z * cosT;
              v.co.y = newY;
              v.co.z = newZ;
            }
            v.commit();
            count++;
          });
          totalVerticesModified += count;
          logs.push(`bpy.ops.mesh.twist(angle=${angle}, axis='${axis}'): torsión completada.`);
        },
      },
      transform: {
        resize: (...rawArgs: unknown[]) => {
          const options = extractPyArgs(rawArgs, ['value'], { value: [1, 1, 1] });
          const [sx, sy, sz] = convertScaleToThree(options.value);
          const targetMesh: THREE.Mesh | undefined = currentActiveObjProxy?._threeMesh;
          if (targetMesh) {
            targetMesh.scale.x *= sx;
            targetMesh.scale.y *= sy;
            targetMesh.scale.z *= sz;
          }
          logs.push(`bpy.ops.transform.resize(value=${JSON.stringify(options.value)})`);
        },
        translate: (...rawArgs: unknown[]) => {
          const options = extractPyArgs(rawArgs, ['value'], { value: [0, 0, 0] });
          const [dx, dy, dz] = convertLocToThree(options.value);
          const targetMesh: THREE.Mesh | undefined = currentActiveObjProxy?._threeMesh;
          if (targetMesh) {
            targetMesh.position.x += dx;
            targetMesh.position.y += dy;
            targetMesh.position.z += dz;
          }
          logs.push(`bpy.ops.transform.translate(value=${JSON.stringify(options.value)})`);
        },
        rotate: (...rawArgs: unknown[]) => {
          const options = extractPyArgs(rawArgs, ['value', 'orient_axis'], {
            value: 0,
            orient_axis: 'Y',
          });
          const val = Number(options.value ?? 0);
          const axis = String(options.orient_axis ?? 'Y').toUpperCase();
          const targetMesh: THREE.Mesh | undefined = currentActiveObjProxy?._threeMesh;
          if (targetMesh) {
            if (axis === 'X') targetMesh.rotation.x += val;
            else if (axis === 'Y') {
              if (isZUp) targetMesh.rotation.z -= val;
              else targetMesh.rotation.y += val;
            } else if (axis === 'Z') {
              if (isZUp) targetMesh.rotation.y += val;
              else targetMesh.rotation.z += val;
            }
          }
          logs.push(`bpy.ops.transform.rotate(value=${val}, axis='${axis}')`);
        },
      },
      material: {
        set_color: (...rawArgs: unknown[]) => {
          const options = extractPyArgs(rawArgs, ['color'], {});
          if (!options.color) return;
          const col = parsePythonColor(options.color);
          const hex = `#${col.getHexString()}`;
          const activeMesh: THREE.Mesh | undefined = currentActiveObjProxy?._threeMesh;
          if (objectsCreatedCount > 0 && activeMesh) {
            applyMaterialToThreeMesh(activeMesh, col);
          } else {
            collectMeshes();
            meshes.forEach((m) => applyMaterialToThreeMesh(m, col));
            callbacks?.onColorChange?.(hex);
          }
          logs.push(`bpy.ops.material.set_color(color='${hex}')`);
        },
        set_texture: (...rawArgs: unknown[]) => {
          const options = extractPyArgs(rawArgs, ['name'], { name: 'dragon_scales' });
          const texName = (options.name ?? 'dragon_scales') as TexturePatternType;
          const tex = generateProceduralTexture(texName);
          collectMeshes();
          meshes.forEach((m) => {
            const mat = Array.isArray(m.material) ? m.material[0] : m.material;
            if (mat && 'map' in mat) {
              (mat as unknown as THREE.MeshStandardMaterial).map = tex;
              (mat as unknown as THREE.MeshStandardMaterial).needsUpdate = true;
            }
          });
          callbacks?.onTextureChange?.(texName);
          logs.push(`bpy.ops.material.set_texture(name='${texName}')`);
        },
        set_cel_shading: (...rawArgs: unknown[]) => {
          const options = extractPyArgs(rawArgs, ['tones'], { tones: 3 });
          logs.push(`bpy.ops.material.set_cel_shading(tones=${options.tones}): Cel-Shading activo.`);
        },
      },
      wm: createSafeNoopProxy(),
      render: createSafeNoopProxy(),
    },
  };

  // ==========================================================================
  // MÓDULOS COMPLEMENTARIOS DE BLENDER 5.2: `bmesh`, `mathutils`, `random`
  // ==========================================================================
  const createMathutilsVector = (init?: any, y?: number, z?: number): any => {
    let _0 = 0;
    let _1 = 0;
    let _2 = 0;
    if (Array.isArray(init)) {
      _0 = Number(init[0]) || 0;
      _1 = Number(init[1]) || 0;
      _2 = Number(init[2]) || 0;
    } else if (init && typeof init === 'object' && ('x' in init || 0 in init)) {
      _0 = Number(init.x ?? init[0]) || 0;
      _1 = Number(init.y ?? init[1]) || 0;
      _2 = Number(init.z ?? init[2]) || 0;
    } else if (typeof init === 'number') {
      _0 = Number(init) || 0;
      _1 = Number(y) || 0;
      _2 = Number(z) || 0;
    }

    const vec: any = {
      _isMathutils: true,
      get 0() {
        return _0;
      },
      set 0(v: number) {
        _0 = Number(v) || 0;
      },
      get 1() {
        return _1;
      },
      set 1(v: number) {
        _1 = Number(v) || 0;
      },
      get 2() {
        return _2;
      },
      set 2(v: number) {
        _2 = Number(v) || 0;
      },
      get x() {
        return _0;
      },
      set x(v: number) {
        _0 = Number(v) || 0;
      },
      get y() {
        return _1;
      },
      set y(v: number) {
        _1 = Number(v) || 0;
      },
      get z() {
        return _2;
      },
      set z(v: number) {
        _2 = Number(v) || 0;
      },
      get length() {
        return Math.hypot(_0, _1, _2);
      },
      set length(newLen: number) {
        const cur = Math.hypot(_0, _1, _2) || 1;
        const scale = (Number(newLen) || 0) / cur;
        _0 *= scale;
        _1 *= scale;
        _2 *= scale;
      },
      get length_squared() {
        return _0 * _0 + _1 * _1 + _2 * _2;
      },
      *[Symbol.iterator]() {
        yield _0;
        yield _1;
        yield _2;
      },
      slice(start?: number, end?: number) {
        return [_0, _1, _2].slice(start, end);
      },
      map(fn: (v: number, i: number) => any) {
        return [_0, _1, _2].map(fn);
      },
      toArray() {
        return [_0, _1, _2];
      },
      normalized() {
        const l = Math.hypot(_0, _1, _2) || 1;
        return createMathutilsVector([_0 / l, _1 / l, _2 / l]);
      },
      normalize() {
        const l = Math.hypot(_0, _1, _2) || 1;
        _0 /= l;
        _1 /= l;
        _2 /= l;
        return this;
      },
      copy() {
        return createMathutilsVector([_0, _1, _2]);
      },
      dot(other: any) {
        return (
          _0 * Number(other?.[0] ?? other?.x ?? 0) +
          _1 * Number(other?.[1] ?? other?.y ?? 0) +
          _2 * Number(other?.[2] ?? other?.z ?? 0)
        );
      },
      cross(other: any) {
        const ox = Number(other?.[0] ?? other?.x ?? 0);
        const oy = Number(other?.[1] ?? other?.y ?? 0);
        const oz = Number(other?.[2] ?? other?.z ?? 0);
        return createMathutilsVector([
          _1 * oz - _2 * oy,
          _2 * ox - _0 * oz,
          _0 * oy - _1 * ox,
        ]);
      },
      angle(other: any) {
        const d = this.dot(other);
        const l1 = this.length;
        const l2 = Math.hypot(
          Number(other?.[0] ?? other?.x ?? 0),
          Number(other?.[1] ?? other?.y ?? 0),
          Number(other?.[2] ?? other?.z ?? 0)
        );
        return Math.acos(Math.max(-1, Math.min(1, d / (l1 * l2 || 1))));
      },
      negate() {
        _0 = -_0;
        _1 = -_1;
        _2 = -_2;
        return this;
      },
      to_tuple() {
        return [_0, _1, _2];
      },
    };

    return vec;
  };

  const createMathutilsEuler = (init?: any, y?: number, z?: number, order: string = 'XYZ'): any => {
    const vec = createMathutilsVector(init, y, z);
    vec.order = order;
    vec.to_matrix = function () {
      return mathutils.Matrix.Rotation(vec[2], 4, 'Z');
    };
    return vec;
  };

  const createMathutilsMatrix: any = function (..._args: any[]) {
    return [
      [1, 0, 0, 0],
      [0, 1, 0, 0],
      [0, 0, 1, 0],
      [0, 0, 0, 1],
    ];
  };
  createMathutilsMatrix.Identity = () => [
    [1, 0, 0, 0],
    [0, 1, 0, 0],
    [0, 0, 1, 0],
    [0, 0, 0, 1],
  ];
  createMathutilsMatrix.Translation = (v: any) => {
    const x = Number(v?.[0] ?? v?.x ?? 0);
    const y = Number(v?.[1] ?? v?.y ?? 0);
    const z = Number(v?.[2] ?? v?.z ?? 0);
    return [
      [1, 0, 0, x],
      [0, 1, 0, y],
      [0, 0, 1, z],
      [0, 0, 0, 1],
    ];
  };
  createMathutilsMatrix.Rotation = (ang: number, _size: number = 4, axis: any = 'Z') => {
    const c = Math.cos(ang || 0);
    const s = Math.sin(ang || 0);
    const ax = typeof axis === 'string' ? axis.toUpperCase() : 'Z';
    if (ax === 'X') {
      return [
        [1, 0, 0, 0],
        [0, c, -s, 0],
        [0, s, c, 0],
        [0, 0, 0, 1],
      ];
    } else if (ax === 'Y') {
      return [
        [c, 0, s, 0],
        [0, 1, 0, 0],
        [-s, 0, c, 0],
        [0, 0, 0, 1],
      ];
    }
    return [
      [c, -s, 0, 0],
      [s, c, 0, 0],
      [0, 0, 1, 0],
      [0, 0, 0, 1],
    ];
  };
  createMathutilsMatrix.Scale = (s: any, _size: number = 4, axis?: any) => {
    if (typeof s === 'number' && axis && (Array.isArray(axis) || typeof axis === 'object')) {
      const ax = Math.abs(Number(axis[0] ?? axis.x ?? 0)) > 0.5 ? s : 1;
      const ay = Math.abs(Number(axis[1] ?? axis.y ?? 0)) > 0.5 ? s : 1;
      const az = Math.abs(Number(axis[2] ?? axis.z ?? 0)) > 0.5 ? s : 1;
      return [
        [ax, 0, 0, 0],
        [0, ay, 0, 0],
        [0, 0, az, 0],
        [0, 0, 0, 1],
      ];
    }
    const sx = typeof s === 'number' ? s : Number(s?.[0] ?? s?.x ?? 1);
    const sy = typeof s === 'number' ? s : Number(s?.[1] ?? s?.y ?? 1);
    const sz = typeof s === 'number' ? s : Number(s?.[2] ?? s?.z ?? 1);
    return [
      [sx, 0, 0, 0],
      [0, sy, 0, 0],
      [0, 0, sz, 0],
      [0, 0, 0, 1],
    ];
  };
  createMathutilsMatrix.Diagonal = (v: any) => createMathutilsMatrix.Scale(v);

  const mathutils = {
    Vector: createMathutilsVector,
    Euler: createMathutilsEuler,
    Color: (init?: any) => parsePythonColor(init),
    Quaternion: (init?: any) => init || [1, 0, 0, 0],
    Matrix: createMathutilsMatrix,
  };

  const bmesh = {
    new: () => {
      const bmVerts: { index: number; co: any; normal: any; select?: boolean }[] = [];
      const bmFaces: any[] = [];
      let internalGeo: THREE.BufferGeometry | null = null;

      const makeBMFace = (idx: number, vObjs: any[]) => ({
        index: idx,
        verts: vObjs,
        material_index: 0,
        smooth: true,
        normal: createMathutilsVector([0, 1, 0]),
        normal_update: () => {},
        select: true,
        calc_center_median: () => {
          if (!vObjs || vObjs.length === 0) return createMathutilsVector([0, 0, 0]);
          let sx = 0, sy = 0, sz = 0;
          for (const v of vObjs) {
            sx += Number(v?.co?.x ?? v?.co?.[0] ?? 0);
            sy += Number(v?.co?.y ?? v?.co?.[1] ?? 0);
            sz += Number(v?.co?.z ?? v?.co?.[2] ?? 0);
          }
          return createMathutilsVector([sx / vObjs.length, sy / vObjs.length, sz / vObjs.length]);
        },
      });

      const bmObj = {
        _isBMesh: true,
        verts: new Proxy(bmVerts, {
          get(target, prop) {
            if (prop === 'new') {
              return (co: any = [0, 0, 0]) => {
                const x = Number(co?.[0] ?? co?.x ?? 0);
                const y = Number(co?.[1] ?? co?.y ?? 0);
                const z = Number(co?.[2] ?? co?.z ?? 0);
                const v = {
                  index: target.length,
                  co: createMathutilsVector([x, y, z]),
                  normal: createMathutilsVector([0, 0, 1]),
                  select: true,
                };
                target.push(v);
                return v;
              };
            }
            if (prop === 'ensure_lookup_table' || prop === 'index_update') return () => {};
            if (prop === 'remove') {
              return (v: any) => {
                const idx = target.indexOf(v);
                if (idx !== -1) target.splice(idx, 1);
              };
            }
            if (typeof prop === 'string') {
              const numIdx = Number(prop);
              if (!Number.isNaN(numIdx) && numIdx < 0) {
                return target[target.length + numIdx];
              }
            }
            return Reflect.get(target, prop);
          },
        }),
        edges: new Proxy([] as any[], {
          get(target, prop) {
            if (prop === 'new') return () => ({ select: true, verts: [] });
            if (prop === 'ensure_lookup_table' || prop === 'index_update') return () => {};
            return Reflect.get(target, prop);
          },
        }),
        faces: new Proxy(bmFaces, {
          get(target, prop) {
            if (prop === 'new') {
              return (vList: any[]) => {
                const vObjs = Array.isArray(vList) ? vList : [];
                const faceObj = makeBMFace(target.length, vObjs);
                target.push(faceObj);
                return faceObj;
              };
            }
            if (prop === 'ensure_lookup_table' || prop === 'index_update') return () => {};
            if (prop === 'remove') {
              return (f: any) => {
                const idx = target.indexOf(f);
                if (idx !== -1) target.splice(idx, 1);
              };
            }
            return Reflect.get(target, prop);
          },
        }),
        from_mesh: (meshData: any) => {
          const geo: THREE.BufferGeometry | undefined = meshData?._geometry;
          if (!geo) return;
          internalGeo = geo;
          const pos = geo.attributes.position as THREE.BufferAttribute;
          bmVerts.length = 0;
          bmFaces.length = 0;
          if (pos) {
            for (let i = 0; i < pos.count; i++) {
              const tx = pos.getX(i), ty = pos.getY(i), tz = pos.getZ(i);
              bmVerts.push({
                index: i,
                co: createMathutilsVector([tx, isZUp ? -tz : ty, isZUp ? ty : tz]),
                normal: createMathutilsVector([0, 0, 1]),
                select: true,
              });
            }
          }
        },
        to_mesh: (meshData: any) => {
          if (!meshData) return;
          if (bmVerts.length > 0 && bmFaces.length > 0 && meshData.from_pydata) {
            // Re-index vertices sequentially in case any were removed
            bmVerts.forEach((v, idx) => {
              v.index = idx;
            });
            const rawV: [number, number, number][] = bmVerts.map((v) => [v.co.x, v.co.y, v.co.z]);
            const rawF: number[][] = bmFaces.map((f) =>
              Array.isArray(f)
                ? f.map((item: any) => Number(typeof item === 'object' ? item?.index : item))
                : Array.isArray(f?.verts)
                  ? f.verts.map((v: any) => Number(v?.index ?? 0))
                  : []
            );
            meshData.from_pydata(rawV, [], rawF);
          } else if (internalGeo && bmVerts.length > 0) {
            const pos = internalGeo.attributes.position as THREE.BufferAttribute;
            if (pos && pos.count === bmVerts.length) {
              for (let i = 0; i < bmVerts.length; i++) {
                const c = bmVerts[i].co;
                if (isZUp) pos.setXYZ(i, c.x, c.z, -c.y);
                else pos.setXYZ(i, c.x, c.y, c.z);
              }
              pos.needsUpdate = true;
              internalGeo.computeVertexNormals();
            }
            meshData._geometry.copy(internalGeo);
          } else if (internalGeo) {
            meshData._geometry.copy(internalGeo);
          }
          if (meshData._threeMesh) {
            prepareGeometryNormals(meshData._threeMesh);
          }
        },
        transform: (mat: any) => {
          if (!mat) return;
          for (const v of bmVerts) {
            const transformed = bpy._matmul(mat, v.co);
            if (transformed) {
              v.co.x = Number(transformed[0] ?? transformed.x ?? v.co.x);
              v.co.y = Number(transformed[1] ?? transformed.y ?? v.co.y);
              v.co.z = Number(transformed[2] ?? transformed.z ?? v.co.z);
            }
          }
        },
        free: () => {},
        clear: () => {
          bmVerts.length = 0;
          bmFaces.length = 0;
        },
        normal_update: () => {},
        _appendInternalGeo: (g: THREE.BufferGeometry, matrix?: any) => {
          const nonIndexed = g.index ? g.toNonIndexed() : g;
          const pos = nonIndexed.attributes.position as THREE.BufferAttribute;
          const baseIdx = bmVerts.length;
          const addedVerts: any[] = [];
          const addedFaces: any[] = [];
          if (pos) {
            for (let i = 0; i < pos.count; i++) {
              const tx = pos.getX(i), ty = pos.getY(i), tz = pos.getZ(i);
              let vec = createMathutilsVector([tx, isZUp ? -tz : ty, isZUp ? ty : tz]);
              if (matrix) {
                const tr = bpy._matmul(matrix, vec);
                if (tr) vec = createMathutilsVector([tr[0] ?? tr.x, tr[1] ?? tr.y, tr[2] ?? tr.z]);
              }
              const vObj = {
                index: baseIdx + i,
                co: vec,
                normal: createMathutilsVector([0, 0, 1]),
                select: true,
              };
              bmVerts.push(vObj);
              addedVerts.push(vObj);
            }
            for (let i = 0; i + 2 < addedVerts.length; i += 3) {
              const fObj = makeBMFace(bmFaces.length, [
                addedVerts[i],
                addedVerts[i + 1],
                addedVerts[i + 2],
              ]);
              bmFaces.push(fObj);
              addedFaces.push(fObj);
            }
          }
          internalGeo = nonIndexed;
          return { verts: addedVerts, faces: addedFaces };
        },
      };
      return bmObj;
    },
    ops: {
      create_icosphere: (...rawArgs: unknown[]) => {
        const opts = extractPyArgs(rawArgs, ['bm', 'subdivisions', 'radius', 'diameter', 'matrix'], {
          subdivisions: 2,
          radius: 0.65,
        });
        const r = Number(opts.radius ?? opts.diameter ?? 0.65);
        const sub = Math.min(4, Math.max(0, Number(opts.subdivisions ?? 2)));
        const added = opts.bm?._appendInternalGeo
          ? opts.bm._appendInternalGeo(new THREE.IcosahedronGeometry(r, sub), opts.matrix)
          : { verts: [], faces: [] };
        return { geom: [...added.verts, ...added.faces], verts: added.verts, faces: added.faces, edges: [] };
      },
      create_uvsphere: (...rawArgs: unknown[]) => {
        const opts = extractPyArgs(rawArgs, ['bm', 'u_segments', 'v_segments', 'radius', 'diameter', 'matrix'], {
          u_segments: 24,
          v_segments: 16,
          radius: 0.65,
        });
        const r = Number(opts.radius ?? opts.diameter ?? 0.65);
        const added = opts.bm?._appendInternalGeo
          ? opts.bm._appendInternalGeo(new THREE.SphereGeometry(r, 20, 14), opts.matrix)
          : { verts: [], faces: [] };
        return { geom: [...added.verts, ...added.faces], verts: added.verts, faces: added.faces, edges: [] };
      },
      create_cube: (...rawArgs: unknown[]) => {
        const opts = extractPyArgs(rawArgs, ['bm', 'size', 'matrix'], { size: 1.0 });
        const s = Number(opts.size ?? 1.0);
        const added = opts.bm?._appendInternalGeo
          ? opts.bm._appendInternalGeo(new THREE.BoxGeometry(s, s, s, 2, 2, 2), opts.matrix)
          : { verts: [], faces: [] };
        return { geom: [...added.verts, ...added.faces], verts: added.verts, faces: added.faces, edges: [] };
      },
      create_cone: (...rawArgs: unknown[]) => {
        const opts = extractPyArgs(
          rawArgs,
          ['bm', 'segments', 'radius1', 'radius2', 'diameter1', 'diameter2', 'depth', 'matrix'],
          {
            segments: 16,
            radius1: 0.5,
            radius2: 0.0,
            depth: 1.0,
          }
        );
        const r1 = Number(opts.radius1 ?? opts.diameter1 ?? 0.5);
        const r2 = Number(opts.radius2 ?? opts.diameter2 ?? 0.0);
        const added = opts.bm?._appendInternalGeo
          ? opts.bm._appendInternalGeo(
              new THREE.CylinderGeometry(r2, r1, Number(opts.depth ?? 1.0), 16, 2),
              opts.matrix
            )
          : { verts: [], faces: [] };
        return { geom: [...added.verts, ...added.faces], verts: added.verts, faces: added.faces, edges: [] };
      },
      create_cylinder: (...rawArgs: unknown[]) => {
        const opts = extractPyArgs(
          rawArgs,
          ['bm', 'radius', 'radius1', 'radius2', 'diameter', 'depth', 'segments', 'matrix'],
          { radius: 0.5, depth: 1.0, segments: 16 }
        );
        const r1 = Number(opts.radius1 ?? opts.radius ?? opts.diameter ?? 0.5);
        const r2 = Number(opts.radius2 ?? opts.radius ?? opts.diameter ?? 0.5);
        const d = Number(opts.depth ?? 1.0);
        const segs = Math.max(6, Number(opts.segments ?? 16));
        const added = opts.bm?._appendInternalGeo
          ? opts.bm._appendInternalGeo(new THREE.CylinderGeometry(r2, r1, d, segs, 2), opts.matrix)
          : { verts: [], faces: [] };
        return { geom: [...added.verts, ...added.faces], verts: added.verts, faces: added.faces, edges: [] };
      },
      create_circle: (...rawArgs: unknown[]) => {
        const opts = extractPyArgs(rawArgs, ['bm', 'segments', 'radius', 'matrix'], {
          segments: 16,
          radius: 0.5,
        });
        const r = Number(opts.radius ?? 0.5);
        const segs = Math.max(6, Number(opts.segments ?? 16));
        const added = opts.bm?._appendInternalGeo
          ? opts.bm._appendInternalGeo(new THREE.CylinderGeometry(r, r, 0.02, segs, 1), opts.matrix)
          : { verts: [], faces: [] };
        return { geom: [...added.verts, ...added.faces], verts: added.verts, faces: added.faces, edges: [] };
      },
      create_grid: (...rawArgs: unknown[]) => {
        const opts = extractPyArgs(rawArgs, ['bm', 'x_segments', 'y_segments', 'size', 'matrix'], {
          x_segments: 4,
          y_segments: 4,
          size: 1.0,
        });
        const s = Number(opts.size ?? 1.0);
        const added = opts.bm?._appendInternalGeo
          ? opts.bm._appendInternalGeo(new THREE.BoxGeometry(s, s, 0.02, 4, 4, 1), opts.matrix)
          : { verts: [], faces: [] };
        return { geom: [...added.verts, ...added.faces], verts: added.verts, faces: added.faces, edges: [] };
      },
      subdivide_edges: (...rawArgs: unknown[]) => {
        const opts = extractPyArgs(rawArgs, ['bm', 'edges', 'cuts'], { cuts: 1 });
        return { geom: opts.bm?.verts || [], verts: opts.bm?.verts || [], edges: [], faces: opts.bm?.faces || [] };
      },
      bevel: (...rawArgs: unknown[]) => {
        const opts = extractPyArgs(rawArgs, ['bm', 'geom', 'offset'], { offset: 0.1 });
        return { geom: opts.bm?.verts || [], verts: opts.bm?.verts || [], edges: [], faces: opts.bm?.faces || [] };
      },
      extrude_face_region: (...rawArgs: unknown[]) => {
        const opts = extractPyArgs(rawArgs, ['bm', 'geom'], {});
        const geomIn = Array.isArray(opts.geom) ? opts.geom : opts.bm?.verts || [];
        return { geom: geomIn, verts: opts.bm?.verts || [], faces: opts.bm?.faces || [] };
      },
      translate: (...rawArgs: unknown[]) => {
        const opts = extractPyArgs(rawArgs, ['bm', 'vec', 'verts'], {});
        const vec = opts.vec || [0, 0, 0];
        const [dx, dy, dz] = [
          Number(vec[0] ?? vec.x ?? 0),
          Number(vec[1] ?? vec.y ?? 0),
          Number(vec[2] ?? vec.z ?? 0),
        ];
        const rawList = opts.verts || opts.bm?.verts || [];
        for (const item of rawList) {
          if (item && item.co) {
            item.co.x += dx;
            item.co.y += dy;
            item.co.z += dz;
          }
        }
        return { geom: rawList };
      },
      scale: (...rawArgs: unknown[]) => {
        const opts = extractPyArgs(rawArgs, ['bm', 'vec', 'verts'], {});
        const vec = opts.vec || [1, 1, 1];
        const [sx, sy, sz] = [
          Number(vec[0] ?? vec.x ?? 1),
          Number(vec[1] ?? vec.y ?? 1),
          Number(vec[2] ?? vec.z ?? 1),
        ];
        const rawList = opts.verts || opts.bm?.verts || [];
        for (const item of rawList) {
          if (item && item.co) {
            item.co.x *= sx;
            item.co.y *= sy;
            item.co.z *= sz;
          }
        }
        return { geom: rawList };
      },
      rotate: (...rawArgs: unknown[]) => {
        const opts = extractPyArgs(rawArgs, ['bm', 'matrix', 'cent', 'verts'], {});
        const rawList = opts.verts || opts.bm?.verts || [];
        const mat = opts.matrix;
        const cent = opts.cent || [0, 0, 0];
        const cx = Number(cent[0] ?? cent.x ?? 0);
        const cy = Number(cent[1] ?? cent.y ?? 0);
        const cz = Number(cent[2] ?? cent.z ?? 0);
        if (mat) {
          for (const item of rawList) {
            if (item && item.co) {
              const rel = [item.co.x - cx, item.co.y - cy, item.co.z - cz];
              const rot = bpy._matmul(mat, rel);
              if (rot) {
                item.co.x = Number(rot[0] ?? rot.x ?? rel[0]) + cx;
                item.co.y = Number(rot[1] ?? rot.y ?? rel[1]) + cy;
                item.co.z = Number(rot[2] ?? rot.z ?? rel[2]) + cz;
              }
            }
          }
        }
        return { geom: rawList };
      },
      recalc_face_normals: () => ({}),
      remove_doubles: () => ({}),
    },
  };

  let rngSeed = 1337;
  const seededRandom = () => {
    rngSeed = (rngSeed * 16807) % 2147483647;
    return (rngSeed - 1) / 2147483646;
  };

  const pyRandom = {
    seed: (s?: number) => {
      rngSeed = Math.max(1, Math.abs(Number(s) || 1337));
    },
    random: () => seededRandom(),
    uniform: (a: number, b: number) => a + seededRandom() * (b - a),
    randint: (a: number, b: number) => Math.floor(a + seededRandom() * (b - a + 1)),
    choice: <T>(arr: T[]): T => arr[Math.floor(seededRandom() * arr.length)],
    gauss: (mu: number = 0, sigma: number = 1) => {
      const u1 = Math.max(1e-6, seededRandom());
      const u2 = seededRandom();
      return mu + sigma * Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
    },
    shuffle: <T>(arr: T[]): T[] => {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(seededRandom() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    },
  };

  const customPrint = (...args: unknown[]) => {
    const msg = args
      .map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a)))
      .join(' ');
    logs.push(msg);
  };

  const pyMath = {
    PI: Math.PI,
    pi: Math.PI,
    tau: Math.PI * 2,
    e: Math.E,
    inf: Infinity,
    nan: NaN,
    sin: Math.sin,
    cos: Math.cos,
    tan: Math.tan,
    asin: Math.asin,
    acos: Math.acos,
    atan: Math.atan,
    atan2: Math.atan2,
    sinh: Math.sinh,
    cosh: Math.cosh,
    tanh: Math.tanh,
    sqrt: Math.sqrt,
    abs: Math.abs,
    fabs: Math.abs,
    pow: Math.pow,
    floor: Math.floor,
    ceil: Math.ceil,
    trunc: Math.trunc,
    round: Math.round,
    min: Math.min,
    max: Math.max,
    exp: Math.exp,
    log: Math.log,
    log10: Math.log10,
    log2: Math.log2,
    hypot: Math.hypot,
    radians: (deg: number) => (deg * Math.PI) / 180,
    degrees: (rad: number) => (rad * 180) / Math.PI,
    copysign: (x: number, y: number) => (Math.sign(y) < 0 ? -Math.abs(x) : Math.abs(x)),
    isclose: (a: number, b: number) => Math.abs(a - b) <= 1e-6,
  };

  // Soporte ligero para scripts que usan `import numpy as np`
  const pyNumpy = {
    pi: Math.PI,
    sin: (x: any) => (Array.isArray(x) ? x.map(Math.sin) : Math.sin(Number(x) || 0)),
    cos: (x: any) => (Array.isArray(x) ? x.map(Math.cos) : Math.cos(Number(x) || 0)),
    tan: (x: any) => (Array.isArray(x) ? x.map(Math.tan) : Math.tan(Number(x) || 0)),
    sqrt: (x: any) => (Array.isArray(x) ? x.map(Math.sqrt) : Math.sqrt(Number(x) || 0)),
    abs: (x: any) => (Array.isArray(x) ? x.map(Math.abs) : Math.abs(Number(x) || 0)),
    deg2rad: (deg: number) => (deg * Math.PI) / 180,
    rad2deg: (rad: number) => (rad * 180) / Math.PI,
    radians: (deg: number) => (deg * Math.PI) / 180,
    degrees: (rad: number) => (rad * 180) / Math.PI,
    array: (arr: any) => (Array.isArray(arr) ? [...arr] : [arr]),
    zeros: (n: number) => new Array(Number(n) || 3).fill(0),
    ones: (n: number) => new Array(Number(n) || 3).fill(1),
    linspace: (start: number, stop: number, num: number = 10) => {
      const n = Math.max(1, Math.floor(Number(num) || 10));
      if (n === 1) return [start];
      const step = (stop - start) / (n - 1);
      return Array.from({ length: n }, (_, idx) => start + idx * step);
    },
    arange: (start: number, stop?: number, step: number = 1) => bpy._range(start, stop, step),
  };

  // Funciones built-in de Python (`len`, `enumerate`, `zip`, `sum`, `reversed`, `sorted`, `isinstance`)
  const pyLen = (x: any): number => {
    if (x == null) return 0;
    if (x._isMathutils) return 3;
    if (Array.isArray(x) || typeof x === 'string') return x.length;
    if (typeof x.length === 'number') return x.length;
    if (typeof x.size === 'number') return x.size;
    if (typeof x === 'object') return Object.keys(x).length;
    return 0;
  };

  const pyEnumerate = (iterable: Iterable<any>, start: number = 0) => {
    const res: [number, any][] = [];
    let idx = start;
    if (iterable && Symbol.iterator in Object(iterable)) {
      for (const item of iterable) {
        res.push([idx++, item]);
      }
    }
    return res;
  };

  const pyZip = (...iterables: any[][]) => {
    if (iterables.length === 0) return [];
    const minLen = Math.min(...iterables.map((it) => (Array.isArray(it) ? it.length : 0)));
    const out: any[][] = [];
    for (let i = 0; i < minLen; i++) {
      out.push(iterables.map((it) => it[i]));
    }
    return out;
  };

  const pySum = (arr: number[], start: number = 0) =>
    Array.isArray(arr) ? arr.reduce((a, b) => a + Number(b || 0), start) : start;

  // Envolver sub-espacios de bpy.ops y bmesh.ops en Proxies tolerantes para que operadores no esenciales nunca lancen TypeError
  const wrapOpsNamespace = <T extends Record<string, any>>(nsObj: T): T =>
    new Proxy(nsObj, {
      get(target, prop) {
        if (prop in target) return target[prop as keyof T];
        if (typeof prop === 'string') {
          return () => ({ FINISHED: true, geom: [], verts: [], edges: [], faces: [] });
        }
        return Reflect.get(target, prop);
      },
    });

  bpy.ops.object = wrapOpsNamespace(bpy.ops.object);
  bpy.ops.mesh = wrapOpsNamespace(bpy.ops.mesh);
  bpy.ops.curve = wrapOpsNamespace(bpy.ops.curve);
  bpy.ops.transform = wrapOpsNamespace(bpy.ops.transform);
  bpy.ops.material = wrapOpsNamespace(bpy.ops.material);
  (bpy as any).ops = new Proxy(bpy.ops, {
    get(target, prop) {
      if (prop in target) return (target as any)[prop];
      return createSafeNoopProxy();
    },
  });
  bmesh.ops = wrapOpsNamespace(bmesh.ops);
  (bmesh as any).from_edit_mesh = (me: any) => {
    const bm = bmesh.new();
    bm.from_mesh(me);
    return bm;
  };
  (bmesh as any).update_edit_mesh = (me: any) => {
    if (me?.update) me.update();
  };

  try {
    // 1. Limpiar docstrings, comentarios y unir sentencias multilínea entre paréntesis
    let jsCode = stripPythonCommentsAndDocstrings(cleanedRawScript);
    jsCode = joinMultilineBracketStatements(jsCode);

    // 2. Limpiar imports estándar de Python/Blender y formatear f-strings/r-strings con escáner consciente de strings
    jsCode = jsCode
      .replace(/^\s*import\s+[a-zA-Z0-9_.,\s]+$/gm, '')
      .replace(/^\s*from\s+[a-zA-Z0-9_.]+\s+import\s+.*$/gm, '');
    jsCode = convertPythonFStringsAndRawStrings(jsCode);
    jsCode = jsCode.replace(/\brange\s*\(/g, 'bpy._range(');

    // 3. Convertir comprensiones de listas, generadores y diccionarios Python
    jsCode = convertListComprehensions(jsCode);

    // 4. Transformar todas las llamadas con argumentos keyword `fn(a, k=v)` -> `fn(a, { __isKw: true, k: v })`
    jsCode = transformAllKeywordFunctionCalls(jsCode);

    // 5. Convertir tuplas literales de Python `(a, b, c)` en arrays `[a, b, c]`
    jsCode = convertPythonTuplesToArrays(jsCode);

    // 6. Procesar bloques por indentación de Python (`def`, `for`, `while`, `if`, `elif`, `else`, `try`, `except`, `finally`, `with`)
    const lines = jsCode.split('\n');
    const transformedLines: string[] = [];
    const blockStack: {
      headerIndent: number;
      scopeVars?: Set<string>;
      fnLocalVars?: Set<string>;
      fnDeclLineIndex?: number;
      isClass?: boolean;
    }[] = [];
    const topLevelVars = new Set<string>();
    const reservedVars = new Set<string>([
      'bpy',
      'bmesh',
      'mathutils',
      'Vector',
      'Euler',
      'Matrix',
      'Color',
      'Quaternion',
      'random',
      'math',
      'np',
      'numpy',
      'pi',
      'tau',
      'sin',
      'cos',
      'tan',
      'asin',
      'acos',
      'atan',
      'atan2',
      'sqrt',
      'radians',
      'degrees',
      'floor',
      'ceil',
      'hypot',
      'uniform',
      'randint',
      'choice',
      'seed',
      'print',
      'len',
      'abs',
      'min',
      'max',
      'round',
      'int',
      'float',
      'str',
      'bool',
      'list',
      'tuple',
      'dict',
      'enumerate',
      'zip',
      'sum',
      'reversed',
      'sorted',
      'isinstance',
      'hasattr',
      'getattr',
      'setattr',
      'pow',
      'exp',
      'log',
      'range',
      'set',
      '__name__',
    ]);

    const registerAssignedVariable = (varName: string) => {
      if (!varName || !/^[a-zA-Z_]\w*$/.test(varName) || reservedVars.has(varName)) return;
      const activeFnBlock = [...blockStack].reverse().find((b) => b.scopeVars);
      if (activeFnBlock) {
        if (!activeFnBlock.scopeVars!.has(varName)) {
          activeFnBlock.fnLocalVars?.add(varName);
        }
      } else {
        topLevelVars.add(varName);
      }
    };

    const closeBlockAndInjectLocals = (top: {
      headerIndent: number;
      fnLocalVars?: Set<string>;
      fnDeclLineIndex?: number;
    }) => {
      if (
        top.fnLocalVars &&
        top.fnLocalVars.size > 0 &&
        typeof top.fnDeclLineIndex === 'number'
      ) {
        transformedLines[top.fnDeclLineIndex] = `${' '.repeat(
          top.headerIndent + 2
        )}let ${Array.from(top.fnLocalVars).join(', ')};`;
      }
      transformedLines.push(`${' '.repeat(top.headerIndent)}}`);
    };

    for (let i = 0; i < lines.length; i++) {
      const rawLine = lines[i];
      let trimmed = rawLine.trim();

      if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('@')) {
        continue;
      }

      const currentIndent = rawLine.match(/^\s*/)?.[0].length ?? 0;
      const isContinuationClause =
        trimmed === 'else:' ||
        /^elif\s+.+:$/.test(trimmed) ||
        /^except\b.*:$/.test(trimmed) ||
        trimmed === 'finally:';

      while (
        blockStack.length > 0 &&
        currentIndent <= blockStack[blockStack.length - 1].headerIndent
      ) {
        const top = blockStack[blockStack.length - 1];
        if (isContinuationClause && currentIndent === top.headerIndent) {
          blockStack.pop();
          break;
        }
        blockStack.pop();
        closeBlockAndInjectLocals(top);
      }

      const indentStr = ' '.repeat(currentIndent);

      // Ignorar `pass`, `global`, `nonlocal`, `del`, `assert` de Python
      if (
        trimmed === 'pass' ||
        /^(?:global|nonlocal|del|assert)\b/.test(trimmed)
      ) {
        transformedLines.push(`${indentStr}/* ${trimmed.split(/\s+/)[0]} */`);
        continue;
      }

      const activeClassBlock = [...blockStack].reverse().find((b) => b.isClass);
      const isInClass = Boolean(activeClassBlock && currentIndent > activeClassBlock.headerIndent);

      // Cabecera de clase: `class NombreClase(bpy.types.Operator):`
      const classMatch = trimmed.match(/^class\s+([a-zA-Z_]\w*)(?:\(([^)]*)\))?\s*:$/);
      if (classMatch) {
        const className = classMatch[1];
        reservedVars.add(className);
        transformedLines.push(`${indentStr}class ${className} {`);
        blockStack.push({ headerIndent: currentIndent, isClass: true });
        continue;
      }

      // Cabecera de función o método Python: `def nombre_func(a, b=1, c: float = 2.0) -> Object:`
      const defMatch = trimmed.match(/^def\s+([a-zA-Z_]\w*)\s*\((.*)\)\s*(?:->\s*[^:]+)?\s*:$/);
      if (defMatch) {
        const fnName = defMatch[1];
        const rawParamsStr = rewritePythonSyntaxInLine(defMatch[2].trim(), true);
        if (!isInClass) reservedVars.add(fnName);

        const paramParts = rawParamsStr ? splitTopLevelCommas(rawParamsStr) : [];
        const paramNames: string[] = [];
        const defaultEntries: string[] = [];
        const localScopeVars = new Set<string>();
        const fnLocalVars = new Set<string>();

        for (const p of paramParts) {
          const cleanP = p.trim();
          if (!cleanP || cleanP.startsWith('*')) continue;
          if (isInClass && (cleanP === 'self' || cleanP === 'cls')) continue;

          const eqIdx = cleanP.indexOf('=');
          if (eqIdx !== -1) {
            const left = cleanP.slice(0, eqIdx).split(':')[0].trim();
            const right = cleanP.slice(eqIdx + 1).trim();
            paramNames.push(left);
            localScopeVars.add(left);
            defaultEntries.push(`${left}: ${right}`);
          } else {
            const pName = cleanP.split(':')[0].trim();
            paramNames.push(pName);
            localScopeVars.add(pName);
          }
        }

        const paramNamesJson = JSON.stringify(paramNames);
        const defaultsObj = `{ ${defaultEntries.join(', ')} }`;
        const destructureVars =
          paramNames.length > 0
            ? `let { ${paramNames.join(', ')} } = bpy._extractArgs(__rawArgs, ${paramNamesJson}, ${defaultsObj});`
            : '';

        if (isInClass) {
          transformedLines.push(`${indentStr}${fnName}(...__rawArgs) {`);
        } else {
          transformedLines.push(`${indentStr}function ${fnName}(...__rawArgs) {`);
        }
        if (destructureVars) {
          transformedLines.push(`${indentStr}  ${destructureVars}`);
        }
        const fnDeclLineIndex = transformedLines.length;
        transformedLines.push('');
        blockStack.push({
          headerIndent: currentIndent,
          scopeVars: localScopeVars,
          fnLocalVars,
          fnDeclLineIndex,
        });
        continue;
      }

      // Propiedad estática/de campo dentro de una clase Python (`bl_idname = "mesh.my_op"`)
      if (
        isInClass &&
        trimmed.includes('=') &&
        !trimmed.startsWith('if ') &&
        !trimmed.startsWith('for ') &&
        !trimmed.startsWith('while ')
      ) {
        transformedLines.push(`${indentStr}${trimmed};`);
        continue;
      }

      // Bloque `with ...:` (ej. `with bpy.context.temp_override(...):`)
      if (/^with\s+.+:$/.test(trimmed)) {
        transformedLines.push(`${indentStr}if (true) {`);
        blockStack.push({ headerIndent: currentIndent });
        continue;
      }

      // Bucle `for` con soporte de desempaquetado de tuplas e iterables implícitos: `for s in -1, 1:`
      const forMatch = trimmed.match(/^for\s+(.+?)\s+in\s+(.+):$/);
      if (forMatch) {
        const rawTarget = forMatch[1].trim();
        let iterExpr = rewritePythonSyntaxInLine(forMatch[2].trim(), true);
        if (splitTopLevelCommas(iterExpr).length > 1) {
          iterExpr = `[${iterExpr}]`;
        }
        let jsTarget = rawTarget;

        if (rawTarget.includes(',') && !rawTarget.startsWith('[')) {
          jsTarget = `[${rawTarget.replace(/\(/g, '[').replace(/\)/g, ']')}]`;
        }

        transformedLines.push(`${indentStr}for (let ${jsTarget} of ${iterExpr}) {`);
        blockStack.push({ headerIndent: currentIndent });
        continue;
      }

      // Bucle `while cond:`
      const whileMatch = trimmed.match(/^while\s+(.+):$/);
      if (whileMatch) {
        transformedLines.push(`${indentStr}while (${rewritePythonSyntaxInLine(whileMatch[1])}) {`);
        blockStack.push({ headerIndent: currentIndent });
        continue;
      }

      // `if cond:`
      const ifMatch = trimmed.match(/^if\s+(.+):$/);
      if (ifMatch) {
        transformedLines.push(`${indentStr}if (${rewritePythonSyntaxInLine(ifMatch[1])}) {`);
        blockStack.push({ headerIndent: currentIndent });
        continue;
      }

      // `elif cond:`
      const elifMatch = trimmed.match(/^elif\s+(.+):$/);
      if (elifMatch) {
        transformedLines.push(`${indentStr}} else if (${rewritePythonSyntaxInLine(elifMatch[1])}) {`);
        blockStack.push({ headerIndent: currentIndent });
        continue;
      }

      if (trimmed === 'else:') {
        transformedLines.push(`${indentStr}} else {`);
        blockStack.push({ headerIndent: currentIndent });
        continue;
      }

      if (trimmed === 'try:') {
        transformedLines.push(`${indentStr}try {`);
        blockStack.push({ headerIndent: currentIndent });
        continue;
      }

      // Manejar cláusulas `except:` o `except Exception as e:` vinculando las variables e, err, error
      // Acepta `except:`, `except X:`, `except X as e:`, `except (A, B) as err:` y `except(A, B):` (sin espacio).
      const exceptMatch = trimmed.match(/^except\b\s*[^:]*?(?:\s+as\s+([a-zA-Z_]\w*))?\s*:$/);
      if (exceptMatch) {
        // El parámetro del catch es siempre `__pyErr` para no colisionar con `let e` cuando la
        // variable del `as` se llama igual (`except Exception as e:` -> "Identifier 'e' has already been declared").
        const boundName = exceptMatch[1];
        const aliases = Array.from(new Set(['e', 'err', 'error', ...(boundName ? [boundName] : [])]));
        transformedLines.push(`${indentStr}} catch (__pyErr) {`);
        transformedLines.push(
          `${indentStr}  ${aliases.map((name) => `let ${name} = __pyErr;`).join(' ')}`
        );
        blockStack.push({ headerIndent: currentIndent });
        continue;
      }

      if (trimmed === 'finally:') {
        transformedLines.push(`${indentStr}} finally {`);
        blockStack.push({ headerIndent: currentIndent });
        continue;
      }

      // Soportar anotaciones de tipo en asignaciones: `verts: list = []` -> `verts = []`
      trimmed = trimmed.replace(/^([a-zA-Z_]\w*)\s*:\s*[a-zA-Z_][a-zA-Z0-9_.\[\], ]*\s*=\s*/, '$1 = ');

      // Reescribir tokens Python (`True`, `False`, `None`, `and`, `or`, `not`, `in`, slicing, etc.) en la línea actual
      trimmed = rewritePythonSyntaxInLine(trimmed);

      // Soportar `return a, b, c` (tupla implícita en return sin paréntesis)
      const returnMatch = trimmed.match(/^return\s+(.+)$/);
      if (returnMatch) {
        const retExpr = returnMatch[1].trim();
        const topParts = splitTopLevelCommas(retExpr);
        if (topParts.length > 1) {
          transformedLines.push(`${indentStr}return [${retExpr}];`);
          continue;
        }
      }

      // Soportar desempaquetado de tuplas en asignación: `x, y, z = loc` o `[x, y, z] = loc` o `x, y = 1, 2`
      const tupleAssignMatch = trimmed.match(
        /^\[?\s*([a-zA-Z_]\w*(?:\s*,\s*[a-zA-Z_]\w*)+)\s*\]?\s*=\s*(?!=)([\s\S]+)$/
      );
      if (tupleAssignMatch) {
        const lhsVars = tupleAssignMatch[1].split(',').map((s) => s.trim());
        let rhsExpr = tupleAssignMatch[2].trim();
        if (splitTopLevelCommas(rhsExpr).length > 1) {
          rhsExpr = `[${rhsExpr}]`;
        }
        lhsVars.forEach((v) => registerAssignedVariable(v));
        transformedLines.push(`${indentStr}[${lhsVars.join(', ')}] = ${rhsExpr};`);
        continue;
      }

      // Detectar asignación simple de variable Python `varName = expr`
      const assignMatch = trimmed.match(/^([a-zA-Z_]\w*)\s*(?:\+|-|\*|\/)?=\s*(?!=)/);
      if (assignMatch) {
        const vName = assignMatch[1];
        registerAssignedVariable(vName);
        // Si es `x = 1, 2, 3` (tupla implícita sin paréntesis a una sola variable), envolver el RHS en `[...]`
        const eqPos = trimmed.indexOf('=');
        const opChar = trimmed[eqPos - 1];
        if (opChar !== '+' && opChar !== '-' && opChar !== '*' && opChar !== '/') {
          const rhsSingle = trimmed.slice(eqPos + 1).trim();
          if (splitTopLevelCommas(rhsSingle).length > 1) {
            transformedLines.push(`${indentStr}${vName} = [${rhsSingle}];`);
            continue;
          }
        }
      }

      // Expresión ternaria inline de Python: `x = a if cond else b`
      const ternaryAssign = trimmed.match(/^([a-zA-Z0-9_.[\]]+\s*=\s*)([^=]+?)\s+if\s+(.+?)\s+else\s+(.+)$/);
      if (ternaryAssign) {
        transformedLines.push(
          `${indentStr}${ternaryAssign[1]}(${ternaryAssign[3]}) ? (${ternaryAssign[2]}) : (${ternaryAssign[4]});`
        );
        continue;
      }

      // Expresiones ternarias generales dentro de argumentos o llamadas
      trimmed = rewriteInlineTernaries(trimmed);

      // Añadir punto y coma para eliminar colisiones ASI de JavaScript
      if (!trimmed.endsWith(';') && !trimmed.endsWith('{') && !trimmed.endsWith('}') && !trimmed.startsWith('/*')) {
        transformedLines.push(`${indentStr}${trimmed};`);
      } else {
        transformedLines.push(`${indentStr}${trimmed}`);
      }
    }

    while (blockStack.length > 0) {
      const top = blockStack.pop()!;
      closeBlockAndInjectLocals(top);
    }

    const varDeclHeader =
      topLevelVars.size > 0 ? `let ${Array.from(topLevelVars).join(', ')};\n` : '';
    const processedCode = varDeclHeader + transformedLines.join('\n');

    const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
    const runner = new AsyncFunction(
      'bpy',
      'bmesh',
      'mathutils',
      'Vector',
      'Euler',
      'Matrix',
      'Color',
      'Quaternion',
      'random',
      'math',
      'np',
      'numpy',
      'pi',
      'tau',
      'sin',
      'cos',
      'tan',
      'asin',
      'acos',
      'atan',
      'atan2',
      'sqrt',
      'pow',
      'exp',
      'log',
      'radians',
      'degrees',
      'floor',
      'ceil',
      'hypot',
      'uniform',
      'randint',
      'choice',
      'seed',
      'print',
      'len',
      'abs',
      'min',
      'max',
      'round',
      'int',
      'float',
      'str',
      'bool',
      'list',
      'tuple',
      'dict',
      'enumerate',
      'zip',
      'sum',
      'reversed',
      'sorted',
      'isinstance',
      'hasattr',
      'getattr',
      'setattr',
      'range',
      'set',
      '__name__',
      processedCode
    );

    await runner(
      bpy,
      bmesh,
      mathutils,
      mathutils.Vector,
      mathutils.Euler,
      mathutils.Matrix,
      mathutils.Color,
      mathutils.Quaternion,
      pyRandom,
      pyMath,
      pyNumpy,
      pyNumpy,
      Math.PI,
      Math.PI * 2,
      Math.sin,
      Math.cos,
      Math.tan,
      Math.asin,
      Math.acos,
      Math.atan,
      Math.atan2,
      Math.sqrt,
      Math.pow,
      Math.exp,
      Math.log,
      pyMath.radians,
      pyMath.degrees,
      Math.floor,
      Math.ceil,
      Math.hypot,
      pyRandom.uniform,
      pyRandom.randint,
      pyRandom.choice,
      pyRandom.seed,
      customPrint,
      pyLen,
      Math.abs,
      Math.min,
      Math.max,
      Math.round,
      Math.trunc,
      Number,
      String,
      Boolean,
      (x: any) => (Array.isArray(x) ? [...x] : Array.from(x || [])),
      (x: any) => (Array.isArray(x) ? [...x] : Array.from(x || [])),
      (x: any) => {
        const d: Record<string, any> = {};
        if (x && typeof x === 'object') {
          if (Array.isArray(x)) {
            for (const item of x) {
              if (Array.isArray(item) && item.length >= 2) d[item[0]] = item[1];
            }
          } else {
            Object.assign(d, x);
          }
        }
        Object.defineProperty(d, 'get', {
          value: function (k: string, defVal: any = null) {
            return k in this && this[k] !== undefined ? this[k] : defVal;
          },
          enumerable: false,
          writable: true,
          configurable: true,
        });
        Object.defineProperty(d, 'setdefault', {
          value: function (k: string, defVal: any = null) {
            if (!(k in this)) this[k] = defVal;
            return this[k];
          },
          enumerable: false,
          writable: true,
          configurable: true,
        });
        Object.defineProperty(d, 'update', {
          value: function (other: any) {
            if (other && typeof other === 'object') Object.assign(this, other);
          },
          enumerable: false,
          writable: true,
          configurable: true,
        });
        return d;
      },
      pyEnumerate,
      pyZip,
      pySum,
      (arr: any[]) => (Array.isArray(arr) ? [...arr].reverse() : []),
      (arr: any[]) => (Array.isArray(arr) ? [...arr].sort() : []),
      (o: any, c: any) => Boolean(o && typeof o === 'object'),
      (o: any, k: string) => o != null && (k in o || (typeof o === 'object' && Object.prototype.hasOwnProperty.call(o, k))),
      (o: any, k: string, defVal?: any) => (o != null && k in o ? o[k] : defVal),
      (o: any, k: string, val: any) => {
        if (o != null) o[k] = val;
      },
      bpy._range,
      (init?: any) => new Set(init || []),
      '__main__'
    );

    // 7. Evaluar modificadores de Blender 5.2 pendientes (MIRROR, ARRAY, SOLIDIFY, etc.)
    for (const objProxy of [...allObjectProxies]) {
      await applyPendingModifiersForObject(objProxy);
    }

    let manualEdits = 0;
    if (!proxiesDirty && allVertexProxies.length > 0) {
      allVertexProxies.forEach((v) => {
        if (v.commit()) {
          manualEdits++;
        }
      });
    }

    collectMeshes();

    // 8. Si el script se ejecutó en modo Blender 5.2 (Z-Up) y creó objetos nuevos,
    // auto-ajustar escala si excede el visor y apoyar la base sobre el pedestal Y=0.02
    let autoScaleFactor = 1;
    if (isZUp && objectsCreatedCount > 0 && meshes.length > 0) {
      let minX = Infinity, maxX = -Infinity;
      let minY = Infinity, maxY = -Infinity;
      let minZ = Infinity, maxZ = -Infinity;

      meshes.forEach((m) => {
        m.geometry.computeBoundingBox();
        const bb = m.geometry.boundingBox;
        if (bb) {
          minX = Math.min(minX, m.position.x + bb.min.x * m.scale.x);
          maxX = Math.max(maxX, m.position.x + bb.max.x * m.scale.x);
          minY = Math.min(minY, m.position.y + bb.min.y * m.scale.y);
          maxY = Math.max(maxY, m.position.y + bb.max.y * m.scale.y);
          minZ = Math.min(minZ, m.position.z + bb.min.z * m.scale.z);
          maxZ = Math.max(maxZ, m.position.z + bb.max.z * m.scale.z);
        }
      });

      const heightY = maxY - minY;
      const spanMax = Math.max(maxX - minX, heightY, maxZ - minZ);

      // Si el modelo de la web es gigantesco (> 4.2m) o diminuto (< 0.6m), normalizar a ~2.6m de altura
      if (Number.isFinite(spanMax) && (spanMax > 4.2 || spanMax < 0.6) && spanMax > 0.001) {
        const normFactor = 2.6 / spanMax;
        autoScaleFactor = normFactor;
        const centerX = (minX + maxX) * 0.5;
        const centerZ = (minZ + maxZ) * 0.5;
        meshes.forEach((m) => {
          m.position.x = (m.position.x - centerX) * normFactor;
          m.position.y = (m.position.y - minY) * normFactor + 0.02;
          m.position.z = (m.position.z - centerZ) * normFactor;
          m.scale.multiplyScalar(normFactor);
        });
        logs.push(
          `[Blender 5.2 Auto-Scale]: Escala normalizada (factor=${normFactor.toFixed(2)}) y apoyada en pedestal.`
        );
      } else if (Number.isFinite(minY) && (minY < -0.05 || minY > 0.65)) {
        const shiftY = 0.02 - minY;
        meshes.forEach((m) => {
          m.position.y += shiftY;
        });
      }
    }

    // Las animaciones de posición siguen a la malla tras el auto-escalado del modelo
    finalizeBlenderRun(autoScaleFactor);

    if (manualEdits > 0 || totalVerticesModified > 0 || objectsCreatedCount > 0) {
      meshes.forEach((m) => {
        const geo = m.geometry as THREE.BufferGeometry;
        if (geo.attributes.position) {
          geo.attributes.position.needsUpdate = true;
          geo.computeVertexNormals();
          geo.computeBoundingBox();
          geo.computeBoundingSphere();
          prepareGeometryNormals(m);
          if (m.userData.outlineMesh) {
            (m.userData.outlineMesh as THREE.Mesh).geometry = m.geometry;
          }
        }
      });
    }

    applyNormalSmoothingToModel(modelWrapper, normSmooth);

    const execTime = Math.round(performance.now() - startTime);
    logs.push(
      `>>> Ejecución Blender 5.2 completada en ${execTime} ms (${objectsCreatedCount} objetos nuevos, ${meshes.length} mallas en escena).`
    );

    return {
      success: true,
      logs,
      executionTimeMs: execTime,
      verticesModified: totalVerticesModified + manualEdits,
      objectsCreated: objectsCreatedCount,
      coordinateModeUsed: isZUp ? 'blender_z_up' : 'studio_y_up',
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    logs.push(`Error en ejecución: ${errorMsg}`);
    return {
      success: false,
      logs,
      executionTimeMs: Math.round(performance.now() - startTime),
      verticesModified: 0,
      coordinateModeUsed: isZUp ? 'blender_z_up' : 'studio_y_up',
      error: errorMsg,
    };
  }
}
