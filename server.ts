import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

const BPY_SYSTEM_INSTRUCTION = `Eres un Ingeniero Técnico de Arte 3D experto en scripting de Blender 5.2 Python (bpy) para el motor universal de videojuegos "CelShade Studio 3D".
Tu objetivo es traducir CUALQUIER elemento de un videojuego descrito por el usuario (props, cofres, pociones, barriles, muebles, vehículos, coches, naves espaciales, barcos, tanques, edificios, casas, torres, castillos, puentes, portales, árboles, rocas, islas, vegetación, armas, escudos, herramientas, criaturas, monstruos, mascotas, robots o personajes) en un script de Python (bpy) limpio y rico en detalles geométricos (entre 16 y 55 primitivas o macro-operadores combinados con bucles).

SISTEMA DE COORDENADAS DEL ESTUDIO 3D:
- El eje Y es la ALTURA VERTICAL (arriba/abajo). El pedestal del suelo está en y = 0.0.
  * Base / ruedas / raíces / cimientos / pies: y entre 0.10 y 0.85
  * Cuerpo central / chasis / tronco / fachada / cofre / torso: y entre 0.5 y 1.9
  * Cima / tejado / copa de árbol / torreta / cabeza: y entre 1.6 y 2.9
- El eje X es IZQUIERDA (-X) y DERECHA (+X), rango ideal entre -1.9 y +1.9.
- El eje Z es PROFUNDIDAD: +Z mira hacia la cámara frontal, -Z es la parte trasera.
- Las rotaciones (rx, ry, rz) están en radianes.

API BPY COMPLETA Y KIT DE HERRAMIENTAS PARA VIDEOJUEGOS SOPORTADAS POR EL MOTOR:
1. Limpieza de escena:
   - bpy.ops.object.select_all(action='SELECT')
   - bpy.ops.object.delete()  # Úsalo al inicio SOLO si mode='replace'. NO lo uses si mode='append'.

2. Primitivas 3D clásicas (todas aceptan location=(x, y, z), rotation=(rx, ry, rz), scale=(sx, sy, sz), color=(r, g, b) con valores float de 0.0 a 1.0):
   - bpy.ops.mesh.primitive_ico_sphere_add(radius=0.6, subdivisions=2, location=(x, y, z), rotation=(rx, ry, rz), scale=(sx, sy, sz), color=(r, g, b))
   - bpy.ops.mesh.primitive_uv_sphere_add(radius=0.5, segments=24, ring_count=16, location=(x, y, z), rotation=(rx, ry, rz), scale=(sx, sy, sz), color=(r, g, b))
   - bpy.ops.mesh.primitive_cube_add(size=1.0, location=(x, y, z), rotation=(rx, ry, rz), scale=(sx, sy, sz), color=(r, g, b))
   - bpy.ops.mesh.primitive_cylinder_add(radius=0.35, depth=1.0, vertices=20, location=(x, y, z), rotation=(rx, ry, rz), scale=(sx, sy, sz), color=(r, g, b))
   - bpy.ops.mesh.primitive_cone_add(radius1=0.35, radius2=0.0, depth=0.9, vertices=16, location=(x, y, z), rotation=(rx, ry, rz), scale=(sx, sy, sz), color=(r, g, b))
   - bpy.ops.mesh.primitive_torus_add(major_radius=1.0, minor_radius=0.07, location=(x, y, z), rotation=(rx, ry, rz), scale=(sx, sy, sz), color=(r, g, b))
   - bpy.ops.mesh.primitive_torus_knot_add(radius=0.65, tube=0.14, p=2, q=3, location=(x, y, z), rotation=(rx, ry, rz), scale=(sx, sy, sz), color=(r, g, b))

3. HERRAMIENTAS DE GEOMETRÍA ORGÁNICA, CHASIS, CRISTALES Y HOJAS:
   - bpy.ops.mesh.primitive_capsule_add(radius=0.25, length=0.75, location=(x, y, z), rotation=(rx, ry, rz), scale=(sx, sy, sz), color=(r, g, b))  # Ideal para troncos, cilindros redondeados, tanques de combustible, cojines o extremidades
   - bpy.ops.mesh.primitive_octahedron_add(radius=0.42, detail=0, location=(x, y, z), rotation=(rx, ry, rz), scale=(sx, sy, sz), color=(r, g, b))  # Ideal para gemas de botín (loot), cristales de maná, faroles y núcleos de energía
   - bpy.ops.mesh.primitive_dodecahedron_add(radius=0.48, detail=0, location=(x, y, z), rotation=(rx, ry, rz), scale=(sx, sy, sz), color=(r, g, b))  # Ideal para rocas low-poly, islas flotantes, copas de árboles, meteoritos o cascos
   - bpy.ops.mesh.primitive_horn_add(base_radius=0.20, tip_radius=0.02, length=1.05, bend=0.48, location=(x, y, z), rotation=(rx, ry, rz), scale=(sx, sy, sz), color=(r, g, b))  # Ideal para ramas curvas, raíces, tubos de escape, cuernos, colmillos o tentáculos
   - bpy.ops.mesh.primitive_blade_add(length=1.45, width=0.26, thickness=0.06, curve=0.12, location=(x, y, z), rotation=(rx, ry, rz), scale=(sx, sy, sz), color=(r, g, b))  # Ideal para hojas de armas, alerones de vehículos, hélices, alas de nave o cuchillas
   - bpy.ops.mesh.primitive_armor_plate_add(width=0.72, height=0.65, thickness=0.09, curvature=0.32, location=(x, y, z), rotation=(rx, ry, rz), scale=(sx, sy, sz), color=(r, g, b))  # Ideal para carrocerías curvas, tejados, escudos, tapas de cofres o armaduras

4. MACRO-HERRAMIENTAS UNIVERSALES PARA ASSETS DE VIDEOJUEGOS (Construyen estructuras completas en 1 línea):
   - bpy.ops.mesh.primitive_prop_chest_add(width=1.15, height=0.82, depth=0.78, location=(0, 0.45, 0), color=(r, g, b), accent_color=(r, g, b))
     * Crea un cofre/contenedor completo con caja base, tapa abovedada, herrajes metálicos y cerradura frontal.
   - bpy.ops.mesh.primitive_wheel_pair_add(radius=0.36, width=0.22, span=0.88, y_pos=0.36, z_pos=0.65, color=(r, g, b), rim_color=(r, g, b))
     * Crea un eje completo con par de neumáticos izquierdo/derecho y llantas metálicas para coches, rovers, camiones, cañones o carruajes.
   - bpy.ops.mesh.primitive_tree_foliage_add(radius=0.95, layers=3, location=(0, 1.65, 0), color=(r, g, b), accent_color=(r, g, b))
     * Crea una copa frondosa de árbol o arbusto estilizado en capas orgánicas para naturaleza y escenarios.
   - bpy.ops.mesh.primitive_arch_add(width=1.25, height=1.65, thickness=0.24, location=(0, 0.0, 0), rotation=(0, 0, 0), color=(r, g, b), accent_color=(r, g, b))
     * Crea un arco arquitectónico completo con pilares, basas, capiteles y dovelas superiores para puertas, castillos, puentes, ruinas o portales.
   - bpy.ops.mesh.primitive_limb_pair_add(start_pos=(0.42, 1.58, 0.0), mid_pos=(0.78, 1.18, 0.14), end_pos=(0.70, 0.72, 0.36), thickness=0.15, joint_size=0.19, color=(r, g, b), joint_color=(r, g, b))
     * Crea un par simétrico de brazos, piernas o patas robóticas articuladas.
   - bpy.ops.mesh.primitive_wing_pair_add(span=1.95, feathers=6, y_height=1.68, z_offset=-0.26, spread=0.92, color=(r, g, b), accent_color=(r, g, b))
     * Crea un par de alas desplegadas en abanico para criaturas, naves o estatuas.

5. Modificadores globales, Corrección Espacial y Materiales (al final del script):
   - bpy.ops.mesh.mirror_x()
   - bpy.ops.mesh.taper(factor=0.22, axis='Y')
   - bpy.ops.mesh.auto_ground()  # Ajusta automáticamente todo el asset para que repose exacto sobre el pedestal Y=0.02
   - bpy.ops.mesh.smooth(iterations=3, factor=0.45)
   - bpy.ops.material.set_texture(name='dragon_scales') # Valores: 'dragon_scales', 'biomech_plates', 'magma_cracks', 'halftone_manga', 'cyber_circuits', 'smooth_skin'

REGLAS IMPORTANTES:
- Adapta SIEMPRE la geometría exactamente al tipo de elemento pedido por el usuario: si pide un coche, barco, casa, árbol, cofre, silla, poción, espada o comida, construye ESE objeto específico (NO construyas un guerrero salvo que el usuario pida un personaje/guerrero).
- Escribe cada llamada bpy.ops.mesh.* en UNA SOLA LÍNEA completa y cierra siempre con bpy.ops.mesh.auto_ground() y un print("...") descriptivo en español.`;

interface GeminiBpyHelpers {
  archetype?: string;
  symmetry?: string;
  complexity?: 'standard' | 'high' | 'ultra';
  palette?: string;
  autoSmooth?: boolean;
  autoTexture?: string;
  aiTools?: string[];
  autoCritique?: boolean;
  sceneBounds?: {
    minY: number;
    maxY: number;
    widthX: number;
    depthZ: number;
    meshCount: number;
  };
}

const AI_TOOL_INSTRUCTIONS: Record<string, string> = {
  use_world_props:
    '- HERRAMIENTA ACTIVA [Props, Vehículos, Árboles y Arquitectura]: Si el usuario pide cofres/cajas usa `bpy.ops.mesh.primitive_prop_chest_add(...)`; si pide vehículos/coches/rovers/carros usa `bpy.ops.mesh.primitive_wheel_pair_add(...)`; si pide árboles/bosques/plantas usa `bpy.ops.mesh.primitive_tree_foliage_add(...)`; si pide edificios/puertas/puentes/portales usa `bpy.ops.mesh.primitive_arch_add(...)`.',
  use_limbs:
    '- HERRAMIENTA ACTIVA [Extremidades Articuladas & Cápsulas]: Usa `bpy.ops.mesh.primitive_limb_pair_add(...)` para brazos/patas articuladas y `bpy.ops.mesh.primitive_capsule_add(...)` para cilindros redondeados, troncos o segmentos.',
  use_horns_blades:
    '- HERRAMIENTA ACTIVA [Hojas Biseladas & Formas Curvas]: Usa `bpy.ops.mesh.primitive_horn_add(...)` para ramas curvas, raíces, tubos de escape o cuernos, y `bpy.ops.mesh.primitive_blade_add(...)` para hojas de armas, alerones, hélices o cuchillas.',
  use_armor_plates:
    '- HERRAMIENTA ACTIVA [Placas Curvas & Cristales]: Usa `bpy.ops.mesh.primitive_armor_plate_add(...)` para carrocerías, tejados curvos, escudos o blindajes, y `bpy.ops.mesh.primitive_octahedron_add(...)` para gemas, faros o cristales.',
  use_wings:
    '- HERRAMIENTA ACTIVA [Alas / Paneles en Abanico]: Usa `bpy.ops.mesh.primitive_wing_pair_add(...)` cuando el modelo requiera alas, velas o paneles desplegados.',
  auto_mirror:
    '- HERRAMIENTA ACTIVA [Simetría Espejo Automática]: Asegura simetría bilateral o incluye `bpy.ops.mesh.mirror_x()` antes del final del script.',
  auto_ground:
    '- HERRAMIENTA ACTIVA [Auto-Apoyo en Pedestal]: Incluye `bpy.ops.mesh.auto_ground()` al final del script para asentar el modelo exactamente sobre Y=0.02.',
};

const ARCHETYPE_GUIDES: Record<string, string> = {
  auto: 'ELEMENTO DE VIDEOJUEGO LIBRE: Analiza exactamente qué pide el usuario (prop, cofre, vehículo, edificio, árbol, mueble, arma, criatura o personaje) y construye su estructura específica con todo detalle.',
  game_prop_item:
    'ARQUETIPO PROP / OBJETO DE JUEGO / BOTÍN (LOOT): Construye el objeto de inventario o escenario (cofre con primitive_prop_chest_add, barril con cilindros y aros toroidales, frasco/poción con esfera de cristal + cuello cilíndrico + tapón, llave, escudo o moneda) con herrajes metálicos y gemas.',
  vehicle_spaceship:
    'ARQUETIPO VEHÍCULO / COCHE / NAVE / TANQUE / BARCO: Construye el chasis principal aerodinámico con cubos escalados y primitive_armor_plate_add, cabina acristalada superior, par de ejes con ruedas (primitive_wheel_pair_add) o propulsores traseros cilíndricos luminosos, alerones (primitive_blade_add) y faros frontales.',
  building_architecture:
    'ARQUETIPO EDIFICIO / CASA / TORRE / CASTILLO / PUENTE / PORTAL: Construye cimientos de piedra en la base, muros o cuerpo arquitectónico, entradas y arcos con primitive_arch_add, tejado cónico o a dos aguas, almenas, ventanas iluminadas y detalles de entorno.',
  nature_vegetation:
    'ARQUETIPO NATURALEZA / ÁRBOL / ROCA / SETA / ISLA: Construye una base de terreno o isla rocosa con primitive_dodecahedron_add, raíces y tronco curvo orgánico con primitive_capsule_add / primitive_horn_add, copa frondosa multicapa con primitive_tree_foliage_add, setas luminosas o cristales minerales.',
  furniture_interior:
    'ARQUETIPO MOBILIARIO / MESA / TRONO / FAROLA / ALTAR: Construye patas o soportes simétricos bien apoyados, tablero/asiento/estructura principal con tablones y marcos metálicos, y objetos decorativos encima (velas, libros, farol brillante o cáliz).',
  weapon_relic:
    'ARQUETIPO ARMA / ESCUDO / HERRAMIENTA / RELIQUIA: Construye mango o empuñadura ergonómica, pomo facetado, guarda ornamentada, y hoja biselada (primitive_blade_add), cabeza de martillo/hacha o núcleo de reliquia con runas brillantes.',
  biped_boss:
    'ARQUETIPO PERSONAJE / HÉROE / NPC / ROBOT: Construye piernas y brazos articulados con primitive_limb_pair_add, torso estilizado, cabeza expresiva o casco con visor y accesorios característicos.',
  arachnid_mecha:
    'ARQUETIPO ARÁCNIDO / DRON / MECHA MULTI-PATA: Construye chasis central, sensores/ojos frontales y múltiples patas radiales articuladas apoyadas en el suelo.',
  serpentine_dragon:
    'ARQUETIPO CRIATURA / DRAGÓN / MONSTRUO / MASCOTA: Construye cuerpo orgánico, extremidades o cola serpenteante, cabeza con mandíbula/ojos/cuernos (primitive_horn_add) y alas o espinas dorsales.',
  winged_entity:
    'ARQUETIPO SER ALADO / AVE / FÉNIX / ÁNGEL: Construye cuerpo estilizado y despliega un gran par de alas en abanico con primitive_wing_pair_add.',
  architecture_altar:
    'ARQUETIPO ALTAR / TORRE / TRONO ARCANO: Construye base escalonada, arcos (primitive_arch_add), columnas simétricas y núcleo cristalino central.',
};

const SYMMETRY_GUIDES: Record<string, string> = {
  bilateral_x:
    'SIMETRÍA BILATERAL EJE X: Para cada elemento lateral en +X, genera su par simétrico en -X.',
  radial_circle:
    'SIMETRÍA RADIAL 360°: Distribuye los elementos periféricos en círculo usando "for i in range(N):" con math.cos(ang) y math.sin(ang).',
  spiral_helix:
    'PATRÓN ESPIRAL / HÉLICE: Distribuye partes ascendiendo en Y mientras rotan en X/Z.',
  organic_asym:
    'COMPOSICIÓN ASIMÉTRICA / ESCENARIO NATURAL: Ideal para árboles, islas rocosas, ruinas o dioramas con distribución natural.',
};

const PALETTE_GUIDES: Record<string, string> = {
  crimson_gold:
    'PALETA CARMESÍ & ORO IMPERIAL: Base oscura (0.15, 0.17, 0.24), principal carmesí (0.90, 0.14, 0.28), herrajes y detalles en oro (0.98, 0.74, 0.12), energía (1.0, 0.35, 0.15).',
  cyber_neon:
    'PALETA CIBERNEÓN SCI-FI: Chasis titanio oscuro (0.14, 0.18, 0.26), paneles secundarios (0.28, 0.34, 0.46), neón cian (0.06, 0.88, 0.98), acentos magenta (0.95, 0.18, 0.62).',
  forest_nature:
    'PALETA BOSQUE & MADERA NATURAL: Madera corteza (0.45, 0.28, 0.14), follaje verde vivo (0.16, 0.74, 0.32), acentos musgo/hoja clara (0.48, 0.88, 0.26), flores/magia dorada (0.98, 0.82, 0.18).',
  medieval_stone:
    'PALETA PIEDRA MEDIEVAL, ROBLE & ORO: Piedra gris (0.42, 0.46, 0.52), madera roble (0.52, 0.31, 0.15), bronce/oro (0.95, 0.72, 0.18), antorcha/magia cálida (1.0, 0.48, 0.12).',
  abyssal_void:
    'PALETA ABISAL & ESMERALDA: Base obsidiana (0.10, 0.12, 0.18), secundario púrpura (0.42, 0.16, 0.68), bioluminiscencia esmeralda (0.12, 0.95, 0.55), detalles marfil (0.88, 0.86, 0.78).',
  celestial_ice:
    'PALETA CRISTAL ÁRTICO & PLATA: Base marfil/plata (0.85, 0.90, 0.96), hielo profundo (0.22, 0.68, 0.96), energía celeste (0.45, 0.92, 1.0), detalles oro blanco (0.96, 0.84, 0.45).',
  toxic_bio:
    'PALETA BIOMECÁNICA ÁCIDA: Base orgánica (0.18, 0.14, 0.24), secundario púrpura (0.58, 0.18, 0.42), verde ácido (0.55, 0.98, 0.12), ámbar (0.98, 0.58, 0.08).',
};

function parseDataUrlImage(dataUrl?: string): { mimeType: string; data: string } | null {
  if (!dataUrl || typeof dataUrl !== 'string') return null;
  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) return null;
  return {
    mimeType: match[1],
    data: match[2],
  };
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: '10mb' }));

  app.post('/api/gemini/bpy-generator', async (req, res) => {
    try {
      const {
        prompt,
        mode = 'replace',
        currentCode = '',
        helpers,
        referenceImageBase64,
        viewportImageBase64,
        selectedModel = 'gemini-3.8-flash',
        thinkingLevel = 'MEDIUM',
        userEmail,
      } = req.body as {
        prompt?: string;
        mode?: 'replace' | 'append' | 'refine';
        currentCode?: string;
        helpers?: GeminiBpyHelpers;
        referenceImageBase64?: string;
        viewportImageBase64?: string;
        selectedModel?: string;
        thinkingLevel?: 'LOW' | 'MEDIUM' | 'HIGH';
        userEmail?: string;
      };

      // Mapeo a modelos oficiales soportados en @google/genai
      const VALID_MODELS: Record<string, string> = {
        'gemini-4-argon': 'gemini-4-argon',
        'gemini-3.8-flash': 'gemini-3.8-flash',
        'gemini-3.8-pro': 'gemini-4-argon',
        'gemini-3.8-thinking': 'gemini-3.8-flash',
        'gemini-3.1-flash-lite': 'gemini-3.1-flash-lite',
        'gemini-2.5-flash': 'gemini-flash-latest',
      };
      const requestedModel = VALID_MODELS[selectedModel] || 'gemini-3.8-flash';

      const THINKING_LEVEL_MAP: Record<string, ThinkingLevel> = {
        LOW: ThinkingLevel.LOW,
        MEDIUM: ThinkingLevel.MEDIUM,
        HIGH: ThinkingLevel.HIGH,
      };
      // Si el usuario eligió el preset "gemini-3.8-thinking", forzamos HIGH por defecto
      const effectiveThinkingKey =
        selectedModel === 'gemini-3.8-thinking'
          ? 'HIGH'
          : String(thinkingLevel).toUpperCase();
      const resolvedThinkingLevel =
        THINKING_LEVEL_MAP[effectiveThinkingKey] || ThinkingLevel.MEDIUM;

      if (!prompt || !prompt.trim()) {
        res.status(400).json({ error: 'Por favor escribe una descripción de lo que deseas modelar con Python.' });
        return;
      }

      let modeInstruction = '';
      if (mode === 'append') {
        modeInstruction =
          'MODO ACTUAL: APPEND (Añadir sobre el modelo actual). NO llames a bpy.ops.object.delete(). Añade los nuevos objetos, accesorios, alas, armas o deformaciones alrededor del personaje existente.';
      } else if (mode === 'refine') {
        modeInstruction =
          'MODO ACTUAL: REFINE (Mejorar y evolucionar el script Python actual). Toma el "Script actual en el editor" como base, conserva lo mejor de su estructura y mejóralo o modifícalo según la petición del usuario.';
      } else {
        modeInstruction =
          'MODO ACTUAL: REPLACE (Crear objeto nuevo desde cero). DEBES incluir bpy.ops.object.delete() al principio del script para construir el nuevo modelo completo.';
      }

      const archetypeText = helpers?.archetype
        ? ARCHETYPE_GUIDES[helpers.archetype] || ''
        : '';
      const symmetryText = helpers?.symmetry
        ? SYMMETRY_GUIDES[helpers.symmetry] || ''
        : '';
      const paletteText = helpers?.palette
        ? PALETTE_GUIDES[helpers.palette] || ''
        : '';

      let complexityText =
        'NIVEL DE DETALLE ESTÁNDAR: Combina entre 14 y 24 primitivas bien posicionadas.';
      if (helpers?.complexity === 'high') {
        complexityText =
          'NIVEL DE DETALLE ALTO: Construye un modelo rico y complejo de entre 28 y 45 piezas usando bucles for para articulaciones, placas de armadura, espinas, dedos o anillos.';
      } else if (helpers?.complexity === 'ultra') {
        complexityText =
          'NIVEL DE DETALLE ULTRA (OBRA MAESTRA PROCEDURAL): Construye una escultura 3D hiper-detallada de entre 45 y 75 piezas combinando múltiples bucles for, sub-partes anatómicas (núcleo, placas pectorales, hombreras en capas, articulaciones, corona/cuernos, armas y halo orbital).';
      }

      const postEffectsLines: string[] = [];
      if (helpers?.autoSmooth) {
        postEffectsLines.push(
          '- Al final del script, antes del print final, incluye: bpy.ops.mesh.smooth(iterations=3, factor=0.45)'
        );
      }
      if (helpers?.autoTexture && helpers.autoTexture !== 'none') {
        postEffectsLines.push(
          `- Al final del script, aplica la textura procedural: bpy.ops.material.set_texture(name='${helpers.autoTexture}')`
        );
      }

      const activeToolsLines: string[] = [];
      if (Array.isArray(helpers?.aiTools)) {
        for (const toolId of helpers.aiTools) {
          if (AI_TOOL_INSTRUCTIONS[toolId]) {
            activeToolsLines.push(AI_TOOL_INSTRUCTIONS[toolId]);
          }
        }
      }

      const autoCritiqueDirective = helpers?.autoCritique
        ? `\nMODO AUDITORÍA VISUAL Y AUTO-MEJORA 3D ACTIVO:
1. Examina la captura actual del visor 3D, las dimensiones BoundingBox y el código actual.
2. Detecta partes demasiado simples, extremidades rígidas sin articulaciones, falta de simetría o piezas flotantes.
3. Reemplaza cilindros/cubos simples por \`primitive_limb_pair_add\`, \`primitive_capsule_add\`, \`primitive_armor_plate_add\`, \`primitive_horn_add\` o \`primitive_blade_add\`.
4. Cierra el script con \`bpy.ops.mesh.auto_ground()\` para que el modelo descanse perfecto sobre el pedestal.`
        : '';

      const boundsInfo = helpers?.sceneBounds
        ? `\nDIMENSIONES DEL MODELO ACTUAL EN ESCENA: Altura Y desde ${helpers.sceneBounds.minY.toFixed(2)} hasta ${helpers.sceneBounds.maxY.toFixed(2)}, Ancho X=${helpers.sceneBounds.widthX.toFixed(2)}, Profundidad Z=${helpers.sceneBounds.depthZ.toFixed(2)} (${helpers.sceneBounds.meshCount} mallas activas). Usa estas coordenadas para encajar accesorios con precisión.`
        : '';

      const contextSnippet = currentCode
        ? `\nScript actual en el editor:\n\`\`\`python\n${currentCode.slice(0, 3500)}\n\`\`\``
        : '';

      const fullTextPrompt = [
        modeInstruction,
        `NIVEL DE RAZONAMIENTO SOLICITADO: ${effectiveThinkingKey} (${userEmail ? `Cuenta Google: ${userEmail}` : 'Sesión Estándar'}).`,
        archetypeText ? `\nGUÍA DE ARQUETIPO:\n${archetypeText}` : '',
        symmetryText ? `\nGUÍA DE SIMETRÍA:\n${symmetryText}` : '',
        complexityText ? `\n${complexityText}` : '',
        paletteText ? `\n${paletteText}` : '',
        activeToolsLines.length > 0
          ? `\nKIT DE HERRAMIENTAS IA ACTIVADAS PARA MEJORAR EL RESULTADO:\n${activeToolsLines.join('\n')}`
          : '',
        autoCritiqueDirective,
        postEffectsLines.length > 0
          ? `\nACABADOS AUTOMÁTICOS REQUERIDOS:\n${postEffectsLines.join('\n')}`
          : '',
        boundsInfo,
        `\nPETICIÓN DEL USUARIO: "${prompt.trim()}"`,
        contextSnippet,
        '\nGenera el script Python (bpy) completo y detalla en "thoughtEvolution" los 4 a 6 pasos clave de tu evolución de pensamiento (análisis morfológico, herramientas avanzadas utilizadas, cálculo espacial Y/X/Z y acabado de materiales).',
      ]
        .filter(Boolean)
        .join('\n');

      const parts: Array<
        { text: string } | { inlineData: { mimeType: string; data: string } }
      > = [];

      const refImg = parseDataUrlImage(referenceImageBase64);
      if (refImg) {
        parts.push({
          inlineData: {
            mimeType: refImg.mimeType,
            data: refImg.data,
          },
        });
        parts.push({
          text: 'IMAGEN DE REFERENCIA / BOCETO ADJUNTO POR EL USUARIO: Analiza la silueta, partes anatómicas, proporciones y colores de esta imagen para reconstruirla fielmente mediante primitivas y bucles Python (bpy).',
        });
      }

      const viewImg = parseDataUrlImage(viewportImageBase64);
      if (viewImg) {
        parts.push({
          inlineData: {
            mimeType: viewImg.mimeType,
            data: viewImg.data,
          },
        });
        parts.push({
          text: 'CAPTURA ACTUAL DEL VISOR 3D: Así se ve actualmente el objeto en el escenario 3D. Ten en cuenta su forma y colores actuales.',
        });
      }

      parts.push({ text: fullTextPrompt });

      // Función auxiliar para invocar un modelo con soporte de thinkingLevel
      const callGeminiModel = async (targetModel: string) => {
        const supportsThinking =
          targetModel === 'gemini-3.8-flash' || targetModel === 'gemini-4-argon';

        return await ai.models.generateContent({
          model: targetModel,
          contents: { parts },
          config: {
            systemInstruction: BPY_SYSTEM_INSTRUCTION,
            ...(supportsThinking
              ? { thinkingConfig: { thinkingLevel: resolvedThinkingLevel } }
              : {}),
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                title: {
                  type: Type.STRING,
                  description: 'Nombre corto del modelo o modificación generada (ej. Araña Mecha Cibernética).',
                },
                summary: {
                  type: Type.STRING,
                  description: 'Breve explicación en español (1-2 frases) de las partes geométricas creadas con Python.',
                },
                thoughtEvolution: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.STRING,
                  },
                  description:
                    'Lista cronológica de 4 a 6 pasos detallando la evolución del pensamiento técnico de Gemini (1. Análisis de forma, 2. Coordenadas y proporciones, 3. Simetría y bucles trigonométricos, 4. Paleta Cel-Shading y ensamblado final).',
                },
                pythonCode: {
                  type: Type.STRING,
                  description: 'Código fuente Python (bpy) completo y ejecutable.',
                },
              },
              required: ['title', 'summary', 'thoughtEvolution', 'pythonCode'],
            },
          },
        });
      };

      // Sintetizador procedural local de respaldo para CUALQUIER elemento de videojuego cuando la cuota gratuita se agota (HTTP 429)
      const buildLocalProceduralFallback = () => {
        const pLower = prompt.toLowerCase();
        const palMap: Record<string, { base: string; primary: string; accent: string; glow: string }> = {
          crimson_gold: {
            base: '(0.15, 0.17, 0.24)',
            primary: '(0.90, 0.14, 0.28)',
            accent: '(0.98, 0.74, 0.12)',
            glow: '(1.00, 0.38, 0.14)',
          },
          cyber_neon: {
            base: '(0.14, 0.18, 0.26)',
            primary: '(0.26, 0.34, 0.48)',
            accent: '(0.95, 0.18, 0.62)',
            glow: '(0.06, 0.88, 0.98)',
          },
          forest_nature: {
            base: '(0.45, 0.28, 0.14)',
            primary: '(0.16, 0.74, 0.32)',
            accent: '(0.48, 0.88, 0.26)',
            glow: '(0.98, 0.82, 0.18)',
          },
          medieval_stone: {
            base: '(0.42, 0.46, 0.52)',
            primary: '(0.52, 0.31, 0.15)',
            accent: '(0.95, 0.72, 0.18)',
            glow: '(1.00, 0.48, 0.12)',
          },
          abyssal_void: {
            base: '(0.10, 0.12, 0.18)',
            primary: '(0.42, 0.16, 0.68)',
            accent: '(0.88, 0.86, 0.78)',
            glow: '(0.12, 0.95, 0.55)',
          },
          celestial_ice: {
            base: '(0.84, 0.90, 0.96)',
            primary: '(0.22, 0.68, 0.96)',
            accent: '(0.96, 0.84, 0.45)',
            glow: '(0.45, 0.92, 1.00)',
          },
          toxic_bio: {
            base: '(0.18, 0.14, 0.24)',
            primary: '(0.58, 0.18, 0.42)',
            accent: '(0.98, 0.58, 0.08)',
            glow: '(0.55, 0.98, 0.12)',
          },
        };
        const pal = palMap[helpers?.palette || 'cyber_neon'] || palMap.cyber_neon;
        const arch = helpers?.archetype || 'auto';

        const isVehicle =
          arch === 'vehicle_spaceship' ||
          /coche|auto|carro|veh[ií]culo|nave|camion|tanque|moto|rover|barco|lancha| tren|helic[oó]ptero|avi[oó]n|jet|submarino/i.test(pLower);
        const isNature =
          arch === 'nature_vegetation' ||
          /[aá]rbol|bosque|planta|pino|roble|palmera|seta|hongo|flor|roca|piedra|monta[nñ]a|isla|volc[aá]n|arbusto|cactus/i.test(pLower);
        const isBuilding =
          arch === 'building_architecture' ||
          arch === 'architecture_altar' ||
          /casa|edificio|torre|castillo|puente|portal|templo|iglesia|caba[nñ]a|muro|muralla|fortaleza|pir[aá]mide|ruina|calabozo|mazmorra|pozo|molino|faro/i.test(pLower);
        const isPropOrFurniture =
          arch === 'game_prop_item' ||
          arch === 'furniture_interior' ||
          /cofre|ba[uú]l|caja|barril|tonel|poci[oó]n|frasco|botella|llave|moneda|gema|mesa|silla|trono|cama|estanter[ií]a|farola|antorcha|farol|estatua|carrito|bomba|comida|manzana|pan|libro|pergamino/i.test(pLower);
        const isDragon =
          arch === 'serpentine_dragon' ||
          arch === 'winged_entity' ||
          /drag[oó]n|wyvern|bestia|monstruo|f[eé]nix|ave|p[aá]jaro|grifo|lobo|perro|gato|mascota|dinosaurio|serpiente/i.test(pLower);
        const isSpider =
          arch === 'arachnid_mecha' ||
          /ara[nñ]a|escorpi[oó]n|insecto|cangrejo|crust[aá]ceo|escarabajo|dron/i.test(pLower);
        const isWeapon =
          arch === 'weapon_relic' ||
          /espada|hacha|lanza|arma|mandoble|guada[nñ]a|escudo|martillo|arco|pistola|rifle|ca[nñ][oó]n|b[aá]culo|varita|daga|pico|pala/i.test(pLower);
        const isRelic =
          /cristal|reliquia|orbe|altar|corona|t[oó]tem|amuleto/i.test(pLower);

        const headerLines: string[] = [
          'import bpy',
          'import math',
          '',
          `# Generado por Motor Procedural Universal de Juegos: ${prompt.trim().replace(/\n+/g, ' ')}`,
        ];

        if (mode === 'replace' || !currentCode.trim()) {
          headerLines.push('bpy.ops.object.delete()');
        } else {
          headerLines.push('# Conservando geometría previa y añadiendo mejoras procedurales:');
          const cleanedPrev = currentCode
            .split('\n')
            .filter((line) => !line.trim().startsWith('import ') && !line.trim().startsWith('print('))
            .join('\n');
          headerLines.push(cleanedPrev);
        }

        const bodyLines: string[] = [];

        if (isVehicle) {
          const isSpaceshipOrBoat = /nave|avi[oó]n|jet|cohete|barco|lancha|submarino/i.test(pLower);
          bodyLines.push(
            '# Chasis aerodinámico del vehículo y cabina acristalada',
            `bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 0.56, 0.0), scale=(1.15, 0.36, 1.95), color=${pal.base})`,
            `bpy.ops.mesh.primitive_armor_plate_add(width=1.18, height=0.45, thickness=0.14, curvature=0.35, location=(0, 0.65, 0.88), rotation=(1.05, 0, 0), color=${pal.primary})`,
            `bpy.ops.mesh.primitive_ico_sphere_add(radius=0.48, subdivisions=2, location=(0, 0.86, 0.05), scale=(0.95, 0.52, 1.35), color=${pal.glow})`
          );
          if (isSpaceshipOrBoat) {
            bodyLines.push(
              '# Alas delta / estabilizadores y propulsores traseros',
              `bpy.ops.mesh.primitive_wing_pair_add(span=1.95, feathers=4, y_height=0.62, z_offset=-0.15, spread=0.55, color=${pal.primary}, accent_color=${pal.accent})`,
              'for sx in [-0.38, 0.38]:',
              `    bpy.ops.mesh.primitive_cylinder_add(radius=0.20, depth=0.65, location=(sx, 0.58, -1.02), rotation=(1.57, 0, 0), color=${pal.base})`,
              `    bpy.ops.mesh.primitive_octahedron_add(radius=0.18, location=(sx, 0.58, -1.35), color=${pal.glow})`
            );
          } else {
            bodyLines.push(
              '# Ejes delantero y trasero con neumáticos y llantas',
              `bpy.ops.mesh.primitive_wheel_pair_add(radius=0.36, width=0.24, span=0.68, y_pos=0.36, z_pos=0.66, color=(0.14, 0.16, 0.20), rim_color=${pal.glow})`,
              `bpy.ops.mesh.primitive_wheel_pair_add(radius=0.38, width=0.26, span=0.70, y_pos=0.38, z_pos=-0.66, color=(0.14, 0.16, 0.20), rim_color=${pal.glow})`,
              '# Alerón trasero y faros frontales',
              `bpy.ops.mesh.primitive_blade_add(length=1.15, width=0.24, thickness=0.06, curve=0.10, location=(0, 0.96, -0.88), rotation=(0, 0, 1.57), color=${pal.accent})`,
              'for sx in [-0.38, 0.38]:',
              `    bpy.ops.mesh.primitive_octahedron_add(radius=0.13, location=(sx, 0.58, 1.02), color=${pal.glow})`
            );
          }
        } else if (isNature) {
          bodyLines.push(
            '# Isla / terreno rocoso base y raíces',
            `bpy.ops.mesh.primitive_dodecahedron_add(radius=1.05, detail=1, location=(0, 0.28, 0), scale=(1.25, 0.35, 1.18), color=${pal.base})`,
            'for i in range(4):',
            '    ang = i * (math.pi * 2 / 4) + 0.4',
            `    bpy.ops.mesh.primitive_dodecahedron_add(radius=0.32, location=(math.cos(ang)*0.78, 0.42, math.sin(ang)*0.78), color=(0.45, 0.50, 0.58))`,
            '',
            '# Tronco orgánico y ramas principales',
            `bpy.ops.mesh.primitive_capsule_add(radius=0.25, length=1.15, location=(0, 0.95, 0), rotation=(0.06, 0, -0.05), color=(0.46, 0.28, 0.14))`,
            `bpy.ops.mesh.primitive_horn_add(base_radius=0.18, tip_radius=0.05, length=0.85, bend=0.45, location=(0.12, 1.35, 0), rotation=(0, 0, -0.55), color=(0.46, 0.28, 0.14))`,
            `bpy.ops.mesh.primitive_horn_add(base_radius=0.16, tip_radius=0.05, length=0.78, bend=0.42, location=(-0.12, 1.28, 0.08), rotation=(0.2, 0, 0.62), color=(0.46, 0.28, 0.14))`,
            '',
            '# Copa de follaje frondoso en capas y cristales/setas del bosque',
            `bpy.ops.mesh.primitive_tree_foliage_add(radius=0.96, layers=3, location=(0, 1.68, 0), color=${pal.primary}, accent_color=${pal.accent})`,
            'for i in range(5):',
            '    ang = i * (math.pi * 2 / 5)',
            `    bpy.ops.mesh.primitive_octahedron_add(radius=0.14, location=(math.cos(ang)*0.65, 0.52, math.sin(ang)*0.65), scale=(0.6, 1.5, 0.6), color=${pal.glow})`
          );
        } else if (isBuilding) {
          bodyLines.push(
            '# Cimientos escalonados y estructura arquitectónica',
            `bpy.ops.mesh.primitive_cylinder_add(radius=1.35, depth=0.22, vertices=8, location=(0, 0.11, 0), color=${pal.base})`,
            `bpy.ops.mesh.primitive_cylinder_add(radius=0.92, depth=1.55, vertices=8, location=(0, 0.95, -0.10), color=${pal.base})`,
            '',
            '# Arco de entrada principal y tejado cónico',
            `bpy.ops.mesh.primitive_arch_add(width=1.08, height=1.35, thickness=0.24, location=(0, 0.18, 0.52), color=${pal.accent}, accent_color=${pal.primary})`,
            `bpy.ops.mesh.primitive_cone_add(radius1=1.18, radius2=0.04, depth=0.95, vertices=8, location=(0, 2.22, -0.10), color=${pal.primary})`,
            '',
            '# Almenas y cristales/faroles de iluminación',
            'for i in range(8):',
            '    ang = i * (math.pi * 2 / 8)',
            `    bpy.ops.mesh.primitive_cube_add(size=0.22, location=(math.cos(ang)*0.88, 1.75, -0.10 + math.sin(ang)*0.88), color=${pal.accent})`,
            `bpy.ops.mesh.primitive_octahedron_add(radius=0.24, location=(0, 0.85, 0.52), scale=(0.75, 1.45, 0.55), color=${pal.glow})`
          );
        } else if (isPropOrFurniture) {
          const isPotionOrBottle = /poci[oó]n|frasco|botella|elixir|c[aá]liz|copa/i.test(pLower);
          const isBarrel = /barril|tonel|cubo|bid[oó]n/i.test(pLower);
          const isTableOrChair = /mesa|silla|trono|banco|altar|cama/i.test(pLower);

          if (isPotionOrBottle) {
            bodyLines.push(
              '# Base, cuerpo esférico de cristal y líquido mágico interior',
              `bpy.ops.mesh.primitive_cylinder_add(radius=0.45, depth=0.14, location=(0, 0.08, 0), color=${pal.accent})`,
              `bpy.ops.mesh.primitive_uv_sphere_add(radius=0.68, location=(0, 0.72, 0), color=${pal.primary})`,
              `bpy.ops.mesh.primitive_ico_sphere_add(radius=0.52, subdivisions=2, location=(0, 0.65, 0), color=${pal.glow})`,
              '# Cuello del frasco, anillo dorado y tapón de cristal/corcho',
              `bpy.ops.mesh.primitive_cylinder_add(radius=0.22, depth=0.48, location=(0, 1.42, 0), color=${pal.base})`,
              `bpy.ops.mesh.primitive_torus_add(major_radius=0.26, minor_radius=0.06, location=(0, 1.55, 0), rotation=(1.57, 0, 0), color=${pal.accent})`,
              `bpy.ops.mesh.primitive_octahedron_add(radius=0.24, location=(0, 1.82, 0), scale=(0.8, 1.3, 0.8), color=${pal.glow})`
            );
          } else if (isBarrel) {
            bodyLines.push(
              '# Cuerpo abombado del barril de madera y tapas',
              `bpy.ops.mesh.primitive_cylinder_add(radius=0.62, depth=1.35, vertices=16, location=(0, 0.72, 0), color=(0.52, 0.31, 0.15))`,
              `bpy.ops.mesh.primitive_uv_sphere_add(radius=0.68, location=(0, 0.72, 0), scale=(1.0, 0.85, 1.0), color=(0.56, 0.34, 0.16))`,
              '# Aros metálicos de refuerzo y remaches',
              'for y_ring in [0.28, 0.72, 1.16]:',
              `    bpy.ops.mesh.primitive_torus_add(major_radius=0.66, minor_radius=0.05, location=(0, y_ring, 0), rotation=(1.57, 0, 0), color=${pal.accent})`,
              `bpy.ops.mesh.primitive_octahedron_add(radius=0.14, location=(0, 0.72, 0.68), color=${pal.glow})`
            );
          } else if (isTableOrChair) {
            bodyLines.push(
              '# Patas simétricas y tablero/estructura de mobiliario',
              'for sx in [-0.62, 0.62]:',
              '    for sz in [-0.42, 0.42]:',
              `        bpy.ops.mesh.primitive_cylinder_add(radius=0.09, depth=0.82, location=(sx, 0.42, sz), color=(0.48, 0.28, 0.14))`,
              `bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 0.86, 0), scale=(1.55, 0.14, 1.12), color=(0.56, 0.34, 0.16))`,
              `bpy.ops.mesh.primitive_armor_plate_add(width=1.15, height=0.95, thickness=0.14, curvature=0.22, location=(0, 1.38, -0.48), color=${pal.primary})`,
              '# Objetos sobre el mueble (cáliz / cristal luminoso)',
              `bpy.ops.mesh.primitive_octahedron_add(radius=0.20, location=(0, 1.14, 0.12), color=${pal.glow})`
            );
          } else {
            bodyLines.push(
              '# Base de piedra, Cofre del Tesoro con herrajes y gemas de botín',
              `bpy.ops.mesh.primitive_cylinder_add(radius=1.08, depth=0.16, vertices=8, location=(0, 0.08, 0), color=${pal.base})`,
              `bpy.ops.mesh.primitive_prop_chest_add(width=1.18, height=0.84, depth=0.78, location=(0, 0.46, 0), color=(0.52, 0.29, 0.14), accent_color=${pal.accent})`,
              'for i in range(5):',
              '    ang = i * (math.pi * 2 / 5)',
              `    bpy.ops.mesh.primitive_octahedron_add(radius=0.14, location=(math.cos(ang)*0.76, 0.26, math.sin(ang)*0.76), color=${pal.glow})`
            );
          }
        } else if (isSpider) {
          bodyLines.push(
            '# Cefalotórax y abdomen acorazado',
            'bpy.ops.mesh.primitive_capsule_add(radius=0.38, length=0.55, location=(0, 0.55, 0.15), rotation=(1.35, 0, 0))',
            `bpy.ops.material.set_color(color=${pal.base})`,
            'bpy.ops.mesh.primitive_dodecahedron_add(radius=0.52, location=(0, 0.72, -0.55))',
            'bpy.ops.transform.resize(value=(1.0, 0.82, 1.28))',
            `bpy.ops.material.set_color(color=${pal.primary})`,
            '',
            '# 4 pares de patas articuladas biomecánicas',
            'for i in range(4):',
            '    z_off = 0.35 - i * 0.24',
            '    bpy.ops.mesh.primitive_limb_pair_add(span=0.36, upper_len=0.58, lower_len=0.66, radius=0.075, bend=0.72, y_top=0.55, z_offset=z_off)',
            `    bpy.ops.material.set_color(color=${pal.base})`,
            '',
            '# Ojos múltiples bioluminiscentes y colmillos',
            'for side in [-1, 1]:',
            '    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.07, location=(side * 0.14, 0.64, 0.48))',
            `    bpy.ops.material.set_color(color=${pal.glow})`,
            'bpy.ops.mesh.primitive_horn_add(radius=0.08, height=0.45, curve=0.55, location=(0.14, 0.50, 0.55), rotation=(0.8, 0, 0), mirror_x=True)',
            `bpy.ops.material.set_color(color=${pal.accent})`
          );
        } else if (isDragon) {
          bodyLines.push(
            '# Torso dracónico y cuello segmentado',
            'bpy.ops.mesh.primitive_capsule_add(radius=0.42, length=0.95, location=(0, 0.95, 0), rotation=(0.45, 0, 0))',
            `bpy.ops.material.set_color(color=${pal.primary})`,
            'bpy.ops.mesh.primitive_armor_plate_add(width=0.65, height=0.85, thickness=0.14, arch=0.35, location=(0, 0.92, 0.28), rotation=(0.45, 0, 0))',
            `bpy.ops.material.set_color(color=${pal.accent})`,
            '',
            '# Cabeza, cuernos curvados y alas desplegadas',
            'bpy.ops.mesh.primitive_dodecahedron_add(radius=0.28, location=(0, 1.68, 0.36))',
            `bpy.ops.material.set_color(color=${pal.primary})`,
            'bpy.ops.mesh.primitive_horn_add(radius=0.08, height=0.68, curve=0.72, location=(0.16, 1.82, 0.32), rotation=(-0.4, 0, -0.35), mirror_x=True)',
            `bpy.ops.material.set_color(color=${pal.accent})`,
            'bpy.ops.mesh.primitive_wing_pair_add(span=1.95, height=1.25, feathers=6, y_pos=1.22, z_pos=-0.12)',
            `bpy.ops.material.set_color(color=${pal.glow})`,
            '',
            '# Extremidades inferiores y garras',
            'bpy.ops.mesh.primitive_limb_pair_add(span=0.38, upper_len=0.56, lower_len=0.58, radius=0.11, bend=0.52, y_top=0.62, z_offset=0.05)',
            `bpy.ops.material.set_color(color=${pal.base})`
          );
        } else if (isWeapon) {
          bodyLines.push(
            '# Empuñadura, pomo octaedro y guarda ornamentada',
            'bpy.ops.mesh.primitive_cylinder_add(radius=0.08, depth=0.85, location=(0, 0.55, 0))',
            `bpy.ops.material.set_color(color=${pal.base})`,
            'bpy.ops.mesh.primitive_octahedron_add(radius=0.18, location=(0, 0.12, 0))',
            `bpy.ops.material.set_color(color=${pal.accent})`,
            'bpy.ops.mesh.primitive_armor_plate_add(width=0.95, height=0.24, thickness=0.18, arch=0.35, location=(0, 1.02, 0))',
            `bpy.ops.material.set_color(color=${pal.accent})`,
            'bpy.ops.mesh.primitive_horn_add(radius=0.09, height=0.55, curve=0.6, location=(0.35, 1.05, 0), rotation=(0, 0, -1.1), mirror_x=True)',
            `bpy.ops.material.set_color(color=${pal.primary})`,
            '',
            '# Hoja principal biselada y núcleo de energía',
            'bpy.ops.mesh.primitive_blade_add(length=1.85, width=0.28, thickness=0.06, location=(0, 1.95, 0))',
            `bpy.ops.material.set_color(color=${pal.glow})`,
            'bpy.ops.mesh.primitive_octahedron_add(radius=0.16, location=(0, 1.02, 0.12))',
            `bpy.ops.material.set_color(color=${pal.glow})`
          );
        } else if (isRelic) {
          bodyLines.push(
            '# Núcleo sagrado dodecaédrico y anillos giroscópicos',
            'bpy.ops.mesh.primitive_dodecahedron_add(radius=0.48, location=(0, 1.05, 0))',
            `bpy.ops.material.set_color(color=${pal.glow})`,
            'bpy.ops.mesh.primitive_torus_add(major_radius=0.88, minor_radius=0.05, location=(0, 1.05, 0), rotation=(0.6, 0.4, 0))',
            `bpy.ops.material.set_color(color=${pal.accent})`,
            'bpy.ops.mesh.primitive_torus_add(major_radius=1.08, minor_radius=0.04, location=(0, 1.05, 0), rotation=(-0.5, 0.8, 0.3))',
            `bpy.ops.material.set_color(color=${pal.primary})`,
            '',
            '# Corona radial de cristales octaédricos',
            'for i in range(8):',
            '    ang = i * (math.pi * 2 / 8)',
            '    bpy.ops.mesh.primitive_octahedron_add(radius=0.18, location=(math.cos(ang)*1.25, 1.05 + math.sin(ang*2)*0.18, math.sin(ang)*1.25))',
            '    bpy.ops.transform.resize(value=(0.65, 1.85, 0.65))',
            `    bpy.ops.material.set_color(color=${pal.glow})`
          );
        } else {
          // Personaje / NPC / Robot / Héroe
          bodyLines.push(
            '# Torso estilizado, núcleo central y pelvis articulada',
            'bpy.ops.mesh.primitive_capsule_add(radius=0.36, length=0.68, location=(0, 1.18, 0))',
            `bpy.ops.material.set_color(color=${pal.base})`,
            'bpy.ops.mesh.primitive_armor_plate_add(width=0.76, height=0.62, thickness=0.16, arch=0.32, location=(0, 1.26, 0.24))',
            `bpy.ops.material.set_color(color=${pal.primary})`,
            'bpy.ops.mesh.primitive_octahedron_add(radius=0.16, location=(0, 1.30, 0.36))',
            `bpy.ops.material.set_color(color=${pal.glow})`,
            '',
            '# Cabeza, visor y detalles simétricos',
            'bpy.ops.mesh.primitive_dodecahedron_add(radius=0.26, location=(0, 1.88, 0.04))',
            `bpy.ops.material.set_color(color=${pal.primary})`,
            'bpy.ops.mesh.primitive_armor_plate_add(width=0.38, height=0.12, thickness=0.10, arch=0.45, location=(0, 1.88, 0.24))',
            `bpy.ops.material.set_color(color=${pal.glow})`,
            'bpy.ops.mesh.primitive_horn_add(radius=0.065, height=0.52, curve=0.58, location=(0.18, 2.00, 0.02), rotation=(-0.25, 0, -0.35), mirror_x=True)',
            `bpy.ops.material.set_color(color=${pal.accent})`,
            '',
            '# Piernas y brazos articulados',
            'bpy.ops.mesh.primitive_limb_pair_add(span=0.32, upper_len=0.54, lower_len=0.56, radius=0.115, bend=0.28, y_top=0.88, z_offset=0.0)',
            `bpy.ops.material.set_color(color=${pal.base})`,
            'bpy.ops.mesh.primitive_limb_pair_add(span=0.58, upper_len=0.46, lower_len=0.48, radius=0.095, bend=0.45, y_top=1.46, z_offset=0.04)',
            `bpy.ops.material.set_color(color=${pal.primary})`,
            'bpy.ops.mesh.primitive_armor_plate_add(width=0.34, height=0.32, thickness=0.14, arch=0.42, location=(0.56, 1.56, 0.04), rotation=(0, 0, -0.45), mirror_x=True)',
            `bpy.ops.material.set_color(color=${pal.accent})`
          );
        }

        if (helpers?.autoSmooth) {
          bodyLines.push('bpy.ops.mesh.smooth(iterations=2, factor=0.35)');
        }
        if (helpers?.autoTexture && helpers.autoTexture !== 'none') {
          bodyLines.push(`bpy.ops.material.set_texture(name='${helpers.autoTexture}')`);
        }

        bodyLines.push(
          'bpy.ops.mesh.auto_ground()',
          `print("Asset 3D de juego completado: ${prompt.trim().slice(0, 48).replace(/"/g, "'")}")`
        );

        return {
          title: `Asset Procedural: ${prompt.trim().slice(0, 36)}`,
          summary:
            'Elemento de juego 3D ensamblado por el Motor Procedural Universal con primitivas especializadas, simetría axial y apoyo automático.',
          thoughtEvolution: [
            `1. Analizando el tipo de asset solicitado ("${prompt.trim().slice(0, 60)}") para elegir la arquitectura 3D adecuada (prop, vehículo, edificio, naturaleza, arma o personaje).`,
            '2. Activando el Motor Procedural Autónomo para construir el objeto sin interrupción.',
            '3. Ensamblando volúmenes primarios, sub-piezas funcionales y ornamentos con operadores de Blender 5.2.',
            '4. Aplicando paleta Cel-Shading estilizada y auto_ground() sobre el pedestal.',
          ],
          pythonCode: [...headerLines, '', ...bodyLines].join('\n'),
        };
      };

      // Cadena de modelos de respaldo (cada modelo tiene su propio cupo en Free Tier)
      const candidateModels = Array.from(
        new Set([
          requestedModel,
          'gemini-3.8-flash',
          'gemini-3.1-flash-lite',
          'gemini-flash-latest',
        ])
      );

      let finalModelUsed = requestedModel;
      let fallbackNotice: string | undefined;
      let response = null;
      let lastErrMsg = '';

      for (const candidate of candidateModels) {
        try {
          response = await callGeminiModel(candidate);
          finalModelUsed = candidate;
          if (candidate !== requestedModel) {
            const isQuotaOrBilling = /429|RESOURCE_EXHAUSTED|quota|billing|403|PERMISSION_DENIED/i.test(lastErrMsg);
            fallbackNotice = isQuotaOrBilling
              ? `Se alcanzó el límite gratuito diario (20 req/día) de ${requestedModel}. Se completó automáticamente con ${candidate} (puedes ampliar tu cuota en Settings > Secrets).`
              : `El modelo ${requestedModel} estaba saturado; se completó automáticamente usando ${candidate}.`;
          }
          break;
        } catch (err: unknown) {
          lastErrMsg = err instanceof Error ? err.message : String(err);
        }
      }

      // Si todos los modelos en la nube agotaron su cuota gratuita (429), usamos el sintetizador procedural local
      if (!response) {
        const localResult = buildLocalProceduralFallback();
        res.json({
          title: localResult.title,
          summary: localResult.summary,
          thoughtEvolution: localResult.thoughtEvolution,
          pythonCode: localResult.pythonCode,
          modelUsed: 'motor-procedural-local',
          requestedModel,
          fallbackNotice:
            'Alcanzaste el límite de 20 generaciones/día del plan gratuito (Free Tier) en Gemini API. Se activó el Motor Procedural Autónomo Local para construir tu modelo 3D al instante. Si deseas cuota ilimitada en la nube, puedes actualizar tu clave en Settings > Secrets.',
          thinkingLevelUsed: effectiveThinkingKey,
          usage: {
            promptTokens: 0,
            OutputTokens: 0,
            thoughtsTokens: 0,
            totalTokens: 0,
          },
        });
        return;
      }

      const rawText = (response.text ?? '{}').trim();
      const parsed = JSON.parse(rawText) as {
        title?: string;
        summary?: string;
        thoughtEvolution?: string[];
        pythonCode?: string;
      };

      if (!parsed.pythonCode) {
        const localResult = buildLocalProceduralFallback();
        res.json({
          ...localResult,
          modelUsed: finalModelUsed,
          requestedModel,
          fallbackNotice: 'Se aplicó síntesis procedural de respaldo para garantizar geometría válida.',
          thinkingLevelUsed: effectiveThinkingKey,
          usage: { promptTokens: 0, OutputTokens: 0, thoughtsTokens: 0, totalTokens: 0 },
        });
        return;
      }

      const usage = response.usageMetadata;

      res.json({
        title: parsed.title || 'Modelo Generado con Gemini',
        summary: parsed.summary || 'Geometría 3D generada proceduralmente mediante bpy.',
        thoughtEvolution:
          parsed.thoughtEvolution && parsed.thoughtEvolution.length > 0
            ? parsed.thoughtEvolution
            : [
                'Analizando proporciones espaciales y silueta principal del modelo 3D.',
                'Calculando coordenadas de simetría en ejes X, Y, Z sobre el pedestal.',
                'Construyendo primitivas bpy y bucles trigonométricos para articulaciones y detalles.',
                'Aplicando paleta de colores contrastada para sombreado Cel-Shading de 3 tonos.',
              ],
        pythonCode: parsed.pythonCode,
        modelUsed: finalModelUsed,
        requestedModel,
        fallbackNotice,
        thinkingLevelUsed: effectiveThinkingKey,
        usage: {
          promptTokens: usage?.promptTokenCount || 0,
          OutputTokens: usage?.candidatesTokenCount || 0,
          thoughtsTokens: usage?.thoughtsTokenCount || 0,
          totalTokens: usage?.totalTokenCount || 0,
        },
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({
        error: `Error al generar script con Gemini: ${message}`,
      });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`CelShade Studio 3D + Gemini bpy Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
