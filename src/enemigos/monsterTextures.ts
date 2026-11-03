// Texturas recomendadas por salon-3d para los monstruos de Enemigo-rpg.
//
// Todos los monstruos exportan las mismas zonas (Mat_PrimarySurface, Mat_SecondaryScalesOrTrim,
// Mat_UnderbodyHide, Mat_IvoryFangsAndHorns, ojos, boca, efectos...). Aquí se decide el tipo de
// superficie del monstruo (pelaje, plumas, quitina...) y qué textura va en cada zona.
// El color no cambia: los patrones son en gris y los tiñen el color base y los colores de vértice.

import type { TexturePatternType } from '../utils/proceduralTextures';
import type { GlbZone, ZonePlan } from '../utils/glbZoneOptimizer';
import type { MonsterInfo, MonsterTier } from './enemyGenerator';

export type MonsterSurface = 'fur' | 'feathers' | 'chitin' | 'scales' | 'stone' | 'wood' | 'other';

export const SURFACE_LABELS: Record<MonsterSurface, string> = {
  fur: 'Pelaje',
  feathers: 'Plumas',
  chitin: 'Quitina / caparazón',
  scales: 'Escamas (las de Enemigo-rpg)',
  stone: 'Roca',
  wood: 'Corteza',
  other: 'Sin cambio de superficie',
};

// Se compara con la clave e id internos (en inglés), al inicio de palabra: "bat" no debe casar con "combat".
const words = (list: string) => new RegExp(`(?:^|[_\\s-])(?:${list})s?(?=$|[_\\s-])`);
const SKELETON = words('skeleton|skeletal|bone|skull|ossuary|lich|archlich|mummy|marrowgar');
const SCALY = words('pangolin|armadillo|tortoise|turtle|chelonian');
const FUNGUS = words('fungal|myconid|mushroom');
const ICE = words('iceberg|ice|frost|glacier|glacial|crystal');
const BIRD = words('hawk|eagle|raven|crow|owl|griffin|gryphon|harpy|phoenix|cockatrice|vulture|peacock|bird|roc|avian|condor|falcon|wyvern_hawk');
const CHITIN = words('mantid|spider|scorpion|beetle|crab|mantis|ant|wasp|insect|arachn|chitin|centipede|locust|tick|silithid|nerubian|scarab|brood|mud_shell');
const WOOD = words('treant|bramble|dryad|tree|bark|spriggan|briar');
const STONE = words('golem|gargoyle|rock|stone|stonevault|stonemother|boulder|basalt|trogg');
const FUR = words('wolf|bear|boar|fox|stag|deer|rat|ape|gorilla|mandrill|moose|elk|tiger|leopard|panther|lion|jackal|hyena|ram|keltir|lynx|hound|dog|cerberus|yeti|wendigo|sabertooth|saber|porcupine|quillback|furbolg|gnoll|kobold|quillboar|centaur|minotaur|satyr|manticore|chimera|mammoth|bison|buffalo|goat|hare|rabbit|badger|otter|bat|wingbat|ursa|worg|warg|marsupial|bighorn|silverback|prowler|antler|razorback|grizzly|jackalope|werewolf|ox|bull|cat|cougar|puma|jaguar|weasel|ferret|mole|beaver|squirrel|raccoon');

export function monsterSurface(info: MonsterInfo): MonsterSurface {
  const text = `${info.key} ${info.id.replace(/^enemy_/, '')}`.toLowerCase();
  if (info.undead && SKELETON.test(text)) return 'other'; // esqueletos: el hueso va por zonas
  if (FUNGUS.test(text)) return 'other';
  if (SCALY.test(text) || (info.pattern === 'scales' && info.anatomy === 'Scaled')) return 'scales';
  if (BIRD.test(text)) return 'feathers';
  if (CHITIN.test(text)) return 'chitin';
  if (WOOD.test(text)) return 'wood';
  if (STONE.test(text)) return ICE.test(text) ? 'other' : 'stone';
  if (FUR.test(text) || info.furry) return 'fur';
  if (info.pattern === 'scales' || info.anatomy === 'Scaled') return 'scales';
  if (info.pattern === 'wolf_fur' && info.animal) return 'fur';
  if (info.anatomy === 'Chitin' && info.animal) return 'chitin';
  return 'other';
}

/** Lado máximo de las texturas nuevas según la calidad del monstruo. */
export function patternSizeForTier(tier: MonsterTier): number {
  return tier === 'completo' || tier === 'high' ? 512 : tier === 'minimum' ? 128 : 256;
}

type Pick = { pattern: TexturePatternType; repeat: number } | null;

const SURFACE_PATTERNS: Record<MonsterSurface, { primary: Pick; secondary: Pick; under: Pick }> = {
  fur: { primary: { pattern: 'animal_fur', repeat: 3 }, secondary: { pattern: 'animal_fur', repeat: 4 }, under: { pattern: 'animal_fur', repeat: 5 } },
  feathers: { primary: { pattern: 'feathers', repeat: 3 }, secondary: { pattern: 'feathers', repeat: 4 }, under: { pattern: 'feathers', repeat: 5 } },
  chitin: { primary: { pattern: 'chitin_carapace', repeat: 1 }, secondary: { pattern: 'chitin_carapace', repeat: 2 }, under: { pattern: 'chitin_carapace', repeat: 2 } },
  stone: { primary: { pattern: 'cobblestone', repeat: 2 }, secondary: { pattern: 'cobblestone', repeat: 3 }, under: { pattern: 'cobblestone', repeat: 3 } },
  wood: { primary: { pattern: 'tree_bark', repeat: 2 }, secondary: { pattern: 'tree_bark', repeat: 3 }, under: { pattern: 'moss_nature', repeat: 2 } },
  scales: { primary: null, secondary: null, under: null },
  other: { primary: null, secondary: null, under: null },
};

export interface MonsterRecommendation {
  surface: MonsterSurface;
  plans: Map<number, ZonePlan>;
  summary: string;
}

export function recommendMonsterPlans(info: MonsterInfo, tier: MonsterTier, zones: GlbZone[]): MonsterRecommendation {
  const surface = monsterSurface(info);
  const size = patternSizeForTier(tier);
  const set = SURFACE_PATTERNS[surface];
  const plans = new Map<number, ZonePlan>();
  const changed: string[] = [];
  for (const z of zones) {
    const n = z.name.toLowerCase();
    let pick: Pick = null;
    if (z.effect || /(sclera|iris|pupil|eye|void|socket|tongue|oral|crystal|blade|trail|spark|rune|runic|bite|shock|flame|fire)/.test(n)) pick = null;
    else if (/(ivory|fang|horn|cranium|bone|tooth|enamel|claw|tusk)/.test(n)) pick = { pattern: 'bone_ivory', repeat: 2 };
    else if (/primarysurface/.test(n)) pick = set.primary;
    else if (/secondary/.test(n)) pick = set.secondary;
    else if (/underbody/.test(n)) pick = set.under;
    if (pick) {
      plans.set(z.index, { choice: { kind: 'pattern', pattern: pick.pattern, repeat: pick.repeat, natural: false }, maxSize: size });
      changed.push(z.name.replace(/^Mat_/, ''));
    } else {
      plans.set(z.index, { choice: { kind: 'keep' }, maxSize: 0 });
    }
  }
  return {
    surface,
    plans,
    summary: `${SURFACE_LABELS[surface]} · texturas nuevas en ${changed.length} zonas${changed.length ? ` (${changed.join(', ')})` : ''}`,
  };
}
