// Puente con el generador de monstruos de Enemigo-rpg (copiado en ./vendor con scripts/sync-enemigos.mjs).
// Se carga bajo demanda: el código de los monstruos (~1 MB) no se descarga hasta que se usa.

export type MonsterTier = 'completo' | 'high' | 'medium' | 'low' | 'minimum';

export const MONSTER_TIERS: { id: MonsterTier; label: string }[] = [
  { id: 'completo', label: 'Completo (100 %)' },
  { id: 'high', label: 'High (~68 %)' },
  { id: 'medium', label: 'Medium (~44 %)' },
  { id: 'low', label: 'Low (~25 %)' },
  { id: 'minimum', label: 'Minimum (~13 %)' },
];

/** Datos del monstruo que sirven para recomendar texturas por zona. */
export interface MonsterInfo {
  key: string;
  id: string;
  name: string;
  title: string;
  category: string;
  categoryLabel: string;
  /** Undead | Flesh | Scaled | Chitin | Elemental */
  anatomy: string;
  /** Patrón de superficie de Enemigo-rpg: wolf_fur | scales | chitin_fur | damascus_plate | runic_obsidian | none */
  pattern: string;
  furry: boolean;
  animal: boolean;
  undead: boolean;
  element: string;
  bodyPlan: string;
  rpgTier: string;
}

export interface GeneratedMonster {
  info: MonsterInfo;
  tier: MonsterTier;
  bytes: ArrayBuffer;
  filename: string;
  triangles: number;
  vertices: number;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
type VendorModules = { enemy: any; builder: any; textures: any; exporters: any; version: { commit: string; date: string } };

let modulesPromise: Promise<VendorModules> | null = null;
function loadVendor(): Promise<VendorModules> {
  if (!modulesPromise) {
    modulesPromise = Promise.all([
      import('./vendor/types/enemy'),
      import('./vendor/three/enemyBuilder'),
      import('./vendor/three/proceduralTextures'),
      import('./vendor/three/exporters'),
      import('./vendor/version.json'),
    ]).then(([enemy, builder, textures, exporters, version]) => ({ enemy, builder, textures, exporters, version: version.default ?? version }));
  }
  return modulesPromise;
}

let textureSet: any = null;

function describe(m: VendorModules, key: string, config: any): MonsterInfo {
  const e = m.enemy;
  return {
    key,
    id: config.id,
    name: config.name,
    title: config.title,
    category: config.raceCategory,
    categoryLabel: e.RACE_CATEGORY_LABELS?.[config.raceCategory] ?? config.raceCategory,
    anatomy: e.getEffectiveAnatomyCategory(config),
    pattern: e.getEffectiveTexturePattern(config),
    furry: e.FURRY_BEAST_ARCHETYPES?.has(config.archetype) ?? false,
    animal: e.isAnimalEnemy(config),
    undead: e.isUndeadArchetype(config),
    element: config.stats?.element ?? '',
    bodyPlan: config.bodyPlan,
    rpgTier: config.stats?.tier ?? '',
  };
}

export async function getEnemigoVersion(): Promise<{ commit: string; date: string }> {
  return (await loadVendor()).version;
}

export async function listMonsters(): Promise<MonsterInfo[]> {
  const m = await loadVendor();
  const presets = m.enemy.ARCHETYPE_PRESETS as Record<string, any>;
  return Object.entries(presets).map(([key, cfg]) => describe(m, key, cfg));
}

/** Construye el monstruo en la calidad pedida y lo exporta a GLB con sus huesos y animaciones. */
export async function generateMonsterGlb(key: string, tier: MonsterTier): Promise<GeneratedMonster> {
  const m = await loadVendor();
  const preset = m.enemy.ARCHETYPE_PRESETS[key];
  if (!preset) throw new Error(`Monstruo desconocido: ${key}`);
  const config = structuredClone(preset);
  config.morphology = { ...config.morphology, meshDensity: tier };
  if (!textureSet) textureSet = m.textures.createProceduralTextureSet(8);
  const rig = m.builder.buildProceduralEnemy(config, textureSet, false, false);
  try {
    const bytes = (await m.exporters.serializeEnemyToGLBData(rig, 'arcane_sparks', true)) as ArrayBuffer;
    return {
      info: describe(m, key, config),
      tier,
      bytes,
      filename: `${config.id}_${tier}.glb`,
      triangles: rig.metrics?.totalTriangles ?? 0,
      vertices: rig.metrics?.totalVertices ?? 0,
    };
  } finally {
    rig.dispose?.();
  }
}
