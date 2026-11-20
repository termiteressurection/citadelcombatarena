export type StyleId = 'murmillo' | 'dimachaerus' | 'executioner' | 'retiarius' | 'hoplomachus';
export type ArmorKey = 'helm' | 'pauldron' | 'shield';
export type MoveMotion =
  | 'slash'
  | 'backhand'
  | 'thrust'
  | 'overhead'
  | 'twinSlash'
  | 'twinCross'
  | 'sweep'
  | 'crush'
  | 'netThrow'
  | 'bash';
export type MoveSlot = 'light' | 'light2' | 'light3' | 'heavy' | 'bash';

export interface MoveSpec {
  motion: MoveMotion;
  name: string;
  windupMul?: number;
  dmgMul?: number;
  reachMul?: number;
  lungeMul?: number;
  knockMul?: number;
  half?: number;
}

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
  moves: Record<MoveSlot, MoveSpec>;
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
    moves: {
      light: { motion: 'slash', name: 'Gladius Slash' },
      light2: { motion: 'backhand', name: 'Reverse Cut' },
      light3: { motion: 'thrust', lungeMul: 1.15, half: Math.PI / 4, name: 'Legion Thrust' },
      heavy: { motion: 'overhead', name: 'Crest Cleave' },
      bash: { motion: 'bash', knockMul: 1.25, name: 'Tower Slam' },
    },
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
    moves: {
      light: { motion: 'slash', windupMul: 0.92, name: 'Right Fang' },
      light2: { motion: 'backhand', windupMul: 0.88, name: 'Left Fang' },
      light3: { motion: 'twinCross', dmgMul: 1.15, half: Math.PI / 2.2, lungeMul: 1.25, name: 'Scissor Cross' },
      heavy: { motion: 'twinSlash', dmgMul: 1.1, lungeMul: 1.45, windupMul: 0.9, name: 'Twin Leap Cleave' },
      bash: { motion: 'bash', name: 'Hilt Break' },
    },
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
    moves: {
      light: { motion: 'sweep', half: 1.42, knockMul: 1.25, name: 'Rib Sweep' },
      light2: { motion: 'backhand', half: 1.38, knockMul: 1.25, name: 'Iron Backswing' },
      light3: { motion: 'sweep', half: 1.65, dmgMul: 1.18, knockMul: 1.45, name: 'Tornado Smash' },
      heavy: { motion: 'crush', dmgMul: 1.12, reachMul: 1.12, half: Math.PI / 3.4, knockMul: 1.35, name: 'Skull Breaker' },
      bash: { motion: 'bash', knockMul: 1.35, name: 'Haft Ram' },
    },
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
    moves: {
      light: { motion: 'thrust', reachMul: 1.1, half: Math.PI / 4.8, lungeMul: 1.15, name: 'Trident Jab' },
      light2: { motion: 'slash', half: Math.PI / 2.5, name: 'Prong Hook' },
      light3: { motion: 'thrust', reachMul: 1.22, half: Math.PI / 5, lungeMul: 1.45, dmgMul: 1.12, name: 'Deep Skewer' },
      heavy: { motion: 'netThrow', half: Math.PI / 2.0, name: 'Energy Net Cast' },
      bash: { motion: 'bash', reachMul: 1.2, name: 'Shaft Shove' },
    },
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
    moves: {
      light: { motion: 'thrust', reachMul: 1.08, half: Math.PI / 5, lungeMul: 1.1, name: 'Phalanx Poke' },
      light2: { motion: 'thrust', reachMul: 1.12, half: Math.PI / 5, lungeMul: 1.2, name: 'High Spear Stab' },
      light3: { motion: 'sweep', half: Math.PI / 2.1, knockMul: 1.35, name: 'Crescent Sweep' },
      heavy: { motion: 'thrust', reachMul: 1.38, half: Math.PI / 5.5, lungeMul: 1.85, dmgMul: 1.15, windupMul: 0.96, name: 'Impale Charge' },
      bash: { motion: 'bash', windupMul: 0.85, name: 'Buckler Punch' },
    },
  },
};

export const styleOf = (id?: StyleId): StyleDef => (id && STYLES[id]) || STYLES.murmillo;
export const moveOf = (style: StyleId | undefined, atk: MoveSlot): MoveSpec => styleOf(style).moves[atk];
