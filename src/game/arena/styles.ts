export type StyleId = 'murmillo' | 'dimachaerus' | 'executioner' | 'retiarius' | 'hoplomachus';
export type ArmorKey = 'helm' | 'pauldron' | 'shield';

export const STYLE_IDS: readonly StyleId[] = ['murmillo', 'dimachaerus', 'executioner', 'retiarius', 'hoplomachus'];
export const ARMOR_KEYS: readonly ArmorKey[] = ['helm', 'pauldron', 'shield'];

export interface StyleDef {
  id: StyleId;
  name: string;
  tagline: string;
  color: string;
  dmgMul: number;
  windupMul: number;
  recoverMul: number;
  reachMul: number;
  lungeMul: number;
  knockMul: number;
  speedMul: number;
  limbMul: number;
  blockStamMul: number;
  parryBonus: number;
  blunt: boolean;
  dualWield: boolean;
  hasShield: boolean;
  netHeavy: boolean;
  heavyBreaksBlock: boolean;
  armor: Record<ArmorKey, number>;
  scale: number;
}

export const STYLES: Record<StyleId, StyleDef> = {
  murmillo: {
    id: 'murmillo',
    name: 'MURMILLO',
    tagline: 'Gladius & Tower Shield · Fortress Guard',
    color: '#3ff0ff',
    dmgMul: 1,
    windupMul: 1,
    recoverMul: 1,
    reachMul: 1,
    lungeMul: 1,
    knockMul: 1,
    speedMul: 1,
    limbMul: 1,
    blockStamMul: 0.65,
    parryBonus: 0,
    blunt: false,
    dualWield: false,
    hasShield: true,
    netHeavy: false,
    heavyBreaksBlock: false,
    armor: { helm: 28, pauldron: 24, shield: 32 },
    scale: 1.0,
  },
  dimachaerus: {
    id: 'dimachaerus',
    name: 'DIMACHAERUS',
    tagline: 'Twin Curved Blades · Blazing Sever',
    color: '#ff6b6b',
    dmgMul: 0.9,
    windupMul: 0.78,
    recoverMul: 0.84,
    reachMul: 0.94,
    lungeMul: 1.1,
    knockMul: 0.85,
    speedMul: 1.12,
    limbMul: 1.35,
    blockStamMul: 1.5,
    parryBonus: 0,
    blunt: false,
    dualWield: true,
    hasShield: false,
    netHeavy: false,
    heavyBreaksBlock: false,
    armor: { helm: 16, pauldron: 14, shield: 0 },
    scale: 0.97,
  },
  executioner: {
    id: 'executioner',
    name: 'EXECUTIONER',
    tagline: 'Colossal Warhammer · Crushes Armor & Guard',
    color: '#ff4fd8',
    dmgMul: 1.35,
    windupMul: 1.32,
    recoverMul: 1.2,
    reachMul: 1.24,
    lungeMul: 1.05,
    knockMul: 1.55,
    speedMul: 0.86,
    limbMul: 1.15,
    blockStamMul: 1.25,
    parryBonus: 0,
    blunt: true,
    dualWield: false,
    hasShield: false,
    netHeavy: false,
    heavyBreaksBlock: true,
    armor: { helm: 36, pauldron: 42, shield: 0 },
    scale: 1.24,
  },
  retiarius: {
    id: 'retiarius',
    name: 'RETIARIUS',
    tagline: 'Trident & Energy Net · Long Reach & Snare',
    color: '#4dffa0',
    dmgMul: 0.96,
    windupMul: 0.94,
    recoverMul: 0.95,
    reachMul: 1.35,
    lungeMul: 1.2,
    knockMul: 0.95,
    speedMul: 1.08,
    limbMul: 1.05,
    blockStamMul: 1.4,
    parryBonus: 0,
    blunt: false,
    dualWield: false,
    hasShield: false,
    netHeavy: true,
    heavyBreaksBlock: false,
    armor: { helm: 0, pauldron: 22, shield: 0 },
    scale: 1.0,
  },
  hoplomachus: {
    id: 'hoplomachus',
    name: 'HOPLOMACHUS',
    tagline: 'Spear, Cape & Buckler · Master Parrier',
    color: '#ffc95c',
    dmgMul: 1.02,
    windupMul: 0.96,
    recoverMul: 0.96,
    reachMul: 1.25,
    lungeMul: 1.3,
    knockMul: 1.05,
    speedMul: 1.02,
    limbMul: 1.05,
    blockStamMul: 0.85,
    parryBonus: 0.08,
    blunt: false,
    dualWield: false,
    hasShield: true,
    netHeavy: false,
    heavyBreaksBlock: false,
    armor: { helm: 32, pauldron: 26, shield: 24 },
    scale: 1.06,
  },
};

export const styleOf = (id?: StyleId): StyleDef => (id && STYLES[id]) || STYLES.murmillo;
