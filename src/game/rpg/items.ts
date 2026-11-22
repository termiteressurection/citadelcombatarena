import { STYLES, type ArmorKey, type MoveSlot, type MoveSpec, type StyleId } from '../arena/styles';

export type WeaponFamily = 'gladius' | 'spear' | 'twinSica' | 'warhammer' | 'trident';
export type OffhandVisual = 'none' | 'buckler' | 'scutum' | 'net';
export type HelmVisual = 'none' | 'leather' | 'galea' | 'horned' | 'cage' | 'corinthian';
export type BodyVisual = 'tunic' | 'galerus' | 'manica' | 'spiked' | 'cuirass';
export type CapeVisual = 'none' | 'scarf' | 'cloak' | 'mantle';
export type EchoCoreId = 'none' | 'volt_arc' | 'frame_freeze' | 'cycle_siphon' | 'corrupt_bleed';

export interface EchoCoreDef {
  id: EchoCoreId;
  name: string;
  desc: string;
  color: string;
  reqEchoes: number;
  cost: number;
  dmgBonus: number;
  limbBonus: number;
}

export const ECHO_CORES: EchoCoreDef[] = [
  {
    id: 'none',
    name: 'UNSOCKETED PORT',
    desc: 'Standard hard-light compilation with zero glitch modifier.',
    color: '#a99dc4',
    reqEchoes: 0,
    cost: 0,
    dmgBonus: 0,
    limbBonus: 0,
  },
  {
    id: 'volt_arc',
    name: 'VOLT-ARC CORE',
    desc: 'High-voltage static (+14% damage & extra stagger shock).',
    color: '#3ff0ff',
    reqEchoes: 1,
    cost: 90,
    dmgBonus: 0.14,
    limbBonus: 0.08,
  },
  {
    id: 'frame_freeze',
    name: 'FRAME-FREEZE CORE',
    desc: 'Heavy/Riposte strikes clock-slow foes for 1.6s.',
    color: '#a78bfa',
    reqEchoes: 3,
    cost: 140,
    dmgBonus: 0.06,
    limbBonus: 0.1,
  },
  {
    id: 'cycle_siphon',
    name: 'CYCLE-SIPHON CORE',
    desc: 'Heavy/Riposte impacts leach +6 HP & +10 Stamina.',
    color: '#4dffa0',
    reqEchoes: 6,
    cost: 185,
    dmgBonus: 0.08,
    limbBonus: 0.08,
  },
  {
    id: 'corrupt_bleed',
    name: 'CORRUPT-BLEED CORE',
    desc: 'Weaponized segfault (+28% limb severing trauma).',
    color: '#ff3b5c',
    reqEchoes: 10,
    cost: 240,
    dmgBonus: 0.12,
    limbBonus: 0.28,
  },
];

export interface GearVisuals {
  weapon: WeaponFamily;
  offhand: OffhandVisual;
  helm: HelmVisual;
  body: BodyVisual;
  cape: CapeVisual;
}

export interface Loadout {
  weaponId: string;
  offhandId: string;
  helmId: string;
  bodyId: string;
  capeId: string;
  coreId?: EchoCoreId;
}

export const DEFAULT_LOADOUT: Loadout = {
  weaponId: 'iron_gladius',
  offhandId: 'wooden_buckler',
  helmId: 'leather_cap',
  bodyId: 'recruit_tunic',
  capeId: 'none',
  coreId: 'none',
};

export type GearSlot = 'weapon' | 'offhand' | 'helm' | 'body' | 'cape';

export interface WeaponDef {
  id: string;
  name: string;
  desc: string;
  family: WeaponFamily;
  cost: number;
  reqFame: number;
  color: string;
  twoHanded: boolean;
  blunt: boolean;
  heavyBreaksBlock: boolean;
  dmgMul: number;
  windupMul: number;
  recoverMul: number;
  reachMul: number;
  lungeMul: number;
  knockMul: number;
  speedMul: number;
  limbMul: number;
}

export interface OffhandDef {
  id: string;
  name: string;
  desc: string;
  visual: OffhandVisual;
  cost: number;
  reqFame: number;
  color: string;
  hasShield: boolean;
  shieldHp: number;
  blockStamMul: number;
  parryBonus: number;
  netHeavy: boolean;
  speedMul: number;
}

export interface HelmDef {
  id: string;
  name: string;
  desc: string;
  visual: HelmVisual;
  cost: number;
  reqFame: number;
  hp: number;
  speedMul: number;
  fameMul: number;
}

export interface BodyArmorDef {
  id: string;
  name: string;
  desc: string;
  visual: BodyVisual;
  cost: number;
  reqFame: number;
  hp: number;
  bonusHp: number;
  speedMul: number;
  scale: number;
}

export interface CapeDef {
  id: string;
  name: string;
  desc: string;
  visual: CapeVisual;
  cost: number;
  reqFame: number;
  fameMul: number;
  bonusHp: number;
  speedMul: number;
}

export interface ResolvedGear {
  name: string;
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
  bonusHp: number;
  fameMul: number;
  moves: Record<MoveSlot, MoveSpec>;
  visuals: GearVisuals;
  coreId: EchoCoreId;
  coreColor: string | null;
}

export const WEAPONS: WeaponDef[] = [
  {
    id: 'iron_gladius', name: 'PULSE GLADIUS', desc: 'Crisp hard-light slashes into a Vector Thrust.',
    family: 'gladius', cost: 0, reqFame: 0, color: '#3ff0ff',
    twoHanded: false, blunt: false, heavyBreaksBlock: false,
    dmgMul: 1.0, windupMul: 1.0, recoverMul: 1.0, reachMul: 1.0, lungeMul: 1.0, knockMul: 1.0, speedMul: 1.0, limbMul: 1.0,
  },
  {
    id: 'recruit_spear', name: 'VECTOR SPEAR', desc: 'Long laser pokes & Impale Charge heavy thrust.',
    family: 'spear', cost: 35, reqFame: 0, color: '#ffc95c',
    twoHanded: false, blunt: false, heavyBreaksBlock: false,
    dmgMul: 1.02, windupMul: 0.96, recoverMul: 0.96, reachMul: 1.24, lungeMul: 1.28, knockMul: 1.05, speedMul: 1.0, limbMul: 1.05,
  },
  {
    id: 'iron_trident', name: 'ARC TRIDENT', desc: 'Three-pronged voltage lance with huge reach.',
    family: 'trident', cost: 60, reqFame: 0, color: '#4dffa0',
    twoHanded: false, blunt: false, heavyBreaksBlock: false,
    dmgMul: 0.98, windupMul: 0.94, recoverMul: 0.95, reachMul: 1.32, lungeMul: 1.2, knockMul: 0.95, speedMul: 1.03, limbMul: 1.08,
  },
  {
    id: 'twin_sica', name: 'TWIN GLITCH-SICAS', desc: '2H · Rapid alternating limb-shredding blades.',
    family: 'twinSica', cost: 70, reqFame: 0, color: '#ff6b6b',
    twoHanded: true, blunt: false, heavyBreaksBlock: false,
    dmgMul: 0.92, windupMul: 0.78, recoverMul: 0.84, reachMul: 0.95, lungeMul: 1.12, knockMul: 0.85, speedMul: 1.1, limbMul: 1.35,
  },
  {
    id: 'iron_warhammer', name: 'HEX MAUL', desc: '2H · Wide sweeps & block-crushing Kernel Smash.',
    family: 'warhammer', cost: 85, reqFame: 0, color: '#ff4fd8',
    twoHanded: true, blunt: true, heavyBreaksBlock: true,
    dmgMul: 1.32, windupMul: 1.3, recoverMul: 1.18, reachMul: 1.22, lungeMul: 1.05, knockMul: 1.5, speedMul: 0.9, limbMul: 1.15,
  },
  {
    id: 'steel_gladius', name: 'CIRCUIT GLADIUS', desc: 'Overclocked hard-light edge. +16% damage.',
    family: 'gladius', cost: 145, reqFame: 60, color: '#3ff0ff',
    twoHanded: false, blunt: false, heavyBreaksBlock: false,
    dmgMul: 1.16, windupMul: 0.96, recoverMul: 0.96, reachMul: 1.05, lungeMul: 1.08, knockMul: 1.05, speedMul: 1.02, limbMul: 1.08,
  },
  {
    id: 'legion_pike', name: 'CONDUIT PIKE', desc: 'Extended optical shaft. Deadly Impale Charge.',
    family: 'spear', cost: 165, reqFame: 60, color: '#ffc95c',
    twoHanded: false, blunt: false, heavyBreaksBlock: false,
    dmgMul: 1.16, windupMul: 0.94, recoverMul: 0.95, reachMul: 1.34, lungeMul: 1.35, knockMul: 1.1, speedMul: 1.02, limbMul: 1.1,
  },
  {
    id: 'hunter_trident', name: 'SURGE TRIDENT', desc: 'Barbed arc prongs built for tearing shells.',
    family: 'trident', cost: 170, reqFame: 60, color: '#4dffa0',
    twoHanded: false, blunt: false, heavyBreaksBlock: false,
    dmgMul: 1.14, windupMul: 0.92, recoverMul: 0.93, reachMul: 1.38, lungeMul: 1.25, knockMul: 1.05, speedMul: 1.04, limbMul: 1.18,
  },
  {
    id: 'crimson_sica', name: 'CRIMSON DAEMONS', desc: '2H · Brutal black-market glitch twin blades.',
    family: 'twinSica', cost: 185, reqFame: 60, color: '#ff6b6b',
    twoHanded: true, blunt: false, heavyBreaksBlock: false,
    dmgMul: 1.08, windupMul: 0.75, recoverMul: 0.82, reachMul: 0.98, lungeMul: 1.18, knockMul: 0.9, speedMul: 1.14, limbMul: 1.45,
  },
  {
    id: 'maul_breaker', name: 'PURGE CRUSHER', desc: '2H · Heavy data maul that shatters blocks.',
    family: 'warhammer', cost: 210, reqFame: 60, color: '#ff4fd8',
    twoHanded: true, blunt: true, heavyBreaksBlock: true,
    dmgMul: 1.48, windupMul: 1.26, recoverMul: 1.15, reachMul: 1.26, lungeMul: 1.08, knockMul: 1.65, speedMul: 0.92, limbMul: 1.25,
  },
  {
    id: 'gilded_gladius', name: 'ROOT GLADIUS', desc: 'Kernel-gold sovereign hard-light blade.',
    family: 'gladius', cost: 340, reqFame: 300, color: '#ffc95c',
    twoHanded: false, blunt: false, heavyBreaksBlock: false,
    dmgMul: 1.32, windupMul: 0.92, recoverMul: 0.92, reachMul: 1.08, lungeMul: 1.15, knockMul: 1.12, speedMul: 1.04, limbMul: 1.18,
  },
  {
    id: 'champion_spear', name: 'ZERO-DAY LANCE', desc: 'Peerless reach & lightning impale lunges.',
    family: 'spear', cost: 380, reqFame: 300, color: '#ffc95c',
    twoHanded: false, blunt: false, heavyBreaksBlock: false,
    dmgMul: 1.30, windupMul: 0.90, recoverMul: 0.90, reachMul: 1.40, lungeMul: 1.42, knockMul: 1.18, speedMul: 1.05, limbMul: 1.18,
  },
  {
    id: 'obsidian_maul', name: 'SYS-KILL HAMMER', desc: '2H · Unmatched blunt de-rez devastation.',
    family: 'warhammer', cost: 420, reqFame: 300, color: '#ff4fd8',
    twoHanded: true, blunt: true, heavyBreaksBlock: true,
    dmgMul: 1.65, windupMul: 1.22, recoverMul: 1.12, reachMul: 1.30, lungeMul: 1.12, knockMul: 1.75, speedMul: 0.94, limbMul: 1.35,
  },
  {
    id: 'proto_wire_blade', name: 'V0.1 WIRE-BLADE', desc: 'Relic prototype edge from the dawn of Boneyard.',
    family: 'gladius', cost: 650, reqFame: 550, color: '#4dffa0',
    twoHanded: false, blunt: false, heavyBreaksBlock: false,
    dmgMul: 1.46, windupMul: 0.86, recoverMul: 0.86, reachMul: 1.18, lungeMul: 1.22, knockMul: 1.22, speedMul: 1.08, limbMul: 1.30,
  },
];

export const OFFHANDS: OffhandDef[] = [
  {
    id: 'none', name: 'EMPTY PORT', desc: 'Zero weight. +5% movement speed.',
    visual: 'none', cost: 0, reqFame: 0, color: '#e9e6ff',
    hasShield: false, shieldHp: 0, blockStamMul: 1.45, parryBonus: 0, netHeavy: false, speedMul: 1.05,
  },
  {
    id: 'wooden_buckler', name: 'DATA BUCKLER', desc: 'Light parrying disc (+0.04s parry window).',
    visual: 'buckler', cost: 0, reqFame: 0, color: '#d8b478',
    hasShield: true, shieldHp: 18, blockStamMul: 0.95, parryBonus: 0.04, netHeavy: false, speedMul: 1.0,
  },
  {
    id: 'tower_scutum', name: 'HOLO SCUTUM', desc: 'Heavy tower barrier. Bandwidth-light Guard.',
    visual: 'scutum', cost: 55, reqFame: 0, color: '#3ff0ff',
    hasShield: true, shieldHp: 34, blockStamMul: 0.62, parryBonus: 0.02, netHeavy: false, speedMul: 0.97,
  },
  {
    id: 'bronze_buckler', name: 'CIRCUIT BUCKLER', desc: 'Balanced reflex disc (+0.09s parry window).',
    visual: 'buckler', cost: 75, reqFame: 0, color: '#ffc95c',
    hasShield: true, shieldHp: 26, blockStamMul: 0.85, parryBonus: 0.09, netHeavy: false, speedMul: 1.01,
  },
  {
    id: 'gladiator_net', name: 'HARD-LIGHT TRAP NET', desc: 'Replaces Heavy attack with ensnaring Net Throw!',
    visual: 'net', cost: 90, reqFame: 0, color: '#4dffa0',
    hasShield: false, shieldHp: 0, blockStamMul: 1.35, parryBonus: 0, netHeavy: true, speedMul: 1.04,
  },
  {
    id: 'gilded_scutum', name: 'FIREWALL AEGIS', desc: 'Massive 48 HP shield & elite block efficiency.',
    visual: 'scutum', cost: 230, reqFame: 150, color: '#ffc95c',
    hasShield: true, shieldHp: 48, blockStamMul: 0.52, parryBonus: 0.06, netHeavy: false, speedMul: 0.98,
  },
];

export const HELMS: HelmDef[] = [
  { id: 'none', name: 'UNMASKED HEADER', desc: 'Raw exposed avatar. +4% speed.', visual: 'none', cost: 0, reqFame: 0, hp: 0, speedMul: 1.04, fameMul: 1.0 },
  { id: 'leather_cap', name: 'CACHE HOOD', desc: 'Basic padded shell cap (12 HP).', visual: 'leather', cost: 0, reqFame: 0, hp: 12, speedMul: 1.0, fameMul: 1.0 },
  { id: 'horned_mask', name: 'DAEMON VISOR', desc: 'Light sharp vector mask (20 HP, +4% speed).', visual: 'horned', cost: 60, reqFame: 0, hp: 20, speedMul: 1.04, fameMul: 1.05 },
  { id: 'murmillo_galea', name: 'CYBER GALEA', desc: 'Finned Purge Grid combat helm (34 HP).', visual: 'galea', cost: 75, reqFame: 0, hp: 34, speedMul: 0.99, fameMul: 1.05 },
  { id: 'iron_cage', name: 'KERNEL VAULT', desc: 'Heavy encrypted cage helm (50 HP, heavy).', visual: 'cage', cost: 135, reqFame: 60, hp: 50, speedMul: 0.95, fameMul: 1.1 },
  { id: 'corinthian_gold', name: 'ROOT CORINTHIAN', desc: 'Plumed sovereign visor (46 HP, +15% Signal).', visual: 'corinthian', cost: 260, reqFame: 150, hp: 46, speedMul: 1.0, fameMul: 1.15 },
];

export const BODIES: BodyArmorDef[] = [
  { id: 'recruit_tunic', name: 'RAW SHELL', desc: 'Default orphan process wrap (12 Armor HP).', visual: 'tunic', cost: 0, reqFame: 0, hp: 12, bonusHp: 0, speedMul: 1.0, scale: 1.0 },
  { id: 'retiarius_galerus', name: 'VECTOR SHOULDER', desc: 'Asymmetric left deflector (24 Armor HP, +3% spd).', visual: 'galerus', cost: 55, reqFame: 0, hp: 24, bonusHp: 4, speedMul: 1.03, scale: 1.0 },
  { id: 'bronze_manica', name: 'SECTOR CHASSIS', desc: 'Segmented hard-plate rig (34 Armor HP, +8 HP).', visual: 'manica', cost: 80, reqFame: 0, hp: 34, bonusHp: 8, speedMul: 0.99, scale: 1.02 },
  { id: 'spiked_iron', name: 'HEX PAULDRONS', desc: 'Heavy brutalizer plating (52 Armor HP, heavy).', visual: 'spiked', cost: 150, reqFame: 60, hp: 52, bonusHp: 15, speedMul: 0.95, scale: 1.08 },
  { id: 'champion_cuirass', name: 'PRIME CUIRASS', desc: 'Gilded kernel carapace (48 Armor HP, +22 HP).', visual: 'cuirass', cost: 280, reqFame: 150, hp: 48, bonusHp: 22, speedMul: 1.01, scale: 1.05 },
];

export const CAPES: CapeDef[] = [
  { id: 'none', name: 'NO STREAMER', desc: 'Clean chassis backplate.', visual: 'none', cost: 0, reqFame: 0, fameMul: 1.0, bonusHp: 0, speedMul: 1.0 },
  { id: 'tattered_scarf', name: 'PATCH SCARF', desc: 'Frayed neon data ribbon (+3% speed).', visual: 'scarf', cost: 35, reqFame: 0, fameMul: 1.04, bonusHp: 0, speedMul: 1.03 },
  { id: 'legion_cloak', name: 'CRIMSON TRACE CLOAK', desc: '3-segment flowing light-cloak (+10% Signal).', visual: 'cloak', cost: 100, reqFame: 0, fameMul: 1.1, bonusHp: 5, speedMul: 1.0 },
  { id: 'imperial_mantle', name: 'KERNEL MANTLE', desc: 'Royal Purge Grid banner cape (+25% Signal, +12 HP).', visual: 'mantle', cost: 240, reqFame: 150, fameMul: 1.25, bonusHp: 12, speedMul: 1.0 },
];

export const itemById = <T extends { id: string }>(list: T[], id?: string): T =>
  (id && list.find((x) => x.id === id)) || list[0];

const FAMILY_TO_STYLE: Record<WeaponFamily, StyleId> = {
  gladius: 'murmillo',
  twinSica: 'dimachaerus',
  warhammer: 'executioner',
  trident: 'retiarius',
  spear: 'hoplomachus',
};

const TRIDENT_HEAVY_THRUST: MoveSpec = {
  motion: 'thrust',
  reachMul: 1.32,
  half: Math.PI / 5,
  lungeMul: 1.7,
  dmgMul: 1.15,
  name: 'Oceanic Skewer',
};

export function resolveLoadout(loadout: Loadout): ResolvedGear {
  const w = itemById(WEAPONS, loadout.weaponId);
  const off = w.twoHanded ? OFFHANDS[0] : itemById(OFFHANDS, loadout.offhandId);
  const helm = itemById(HELMS, loadout.helmId);
  const body = itemById(BODIES, loadout.bodyId);
  const cape = itemById(CAPES, loadout.capeId);
  const core = itemById(ECHO_CORES, loadout.coreId ?? 'none');

  const baseStyle = STYLES[FAMILY_TO_STYLE[w.family]];
  const moves: Record<MoveSlot, MoveSpec> = {
    ...baseStyle.moves,
    ...(w.family === 'trident' && !off.netHeavy ? { heavy: TRIDENT_HEAVY_THRUST } : {}),
    ...(off.netHeavy ? { heavy: STYLES.retiarius.moves.heavy } : {}),
  };

  const dualWield = w.family === 'twinSica';
  const speedMul = Math.max(0.75, w.speedMul * off.speedMul * helm.speedMul * body.speedMul * cape.speedMul);

  return {
    name: w.name,
    color: core.id !== 'none' ? core.color : w.color,
    dmgMul: w.dmgMul * (1 + core.dmgBonus),
    windupMul: w.windupMul,
    recoverMul: w.recoverMul,
    reachMul: w.reachMul,
    lungeMul: w.lungeMul,
    knockMul: w.knockMul,
    speedMul,
    limbMul: w.limbMul * (1 + core.limbBonus),
    blockStamMul: off.blockStamMul,
    parryBonus: off.parryBonus,
    blunt: w.blunt,
    dualWield,
    hasShield: off.hasShield,
    netHeavy: off.netHeavy,
    heavyBreaksBlock: w.heavyBreaksBlock,
    armor: {
      helm: helm.hp,
      pauldron: body.hp,
      shield: off.hasShield ? off.shieldHp : 0,
    },
    scale: body.scale,
    bonusHp: body.bonusHp + cape.bonusHp,
    fameMul: helm.fameMul * cape.fameMul,
    moves,
    visuals: {
      weapon: w.family,
      offhand: w.twoHanded ? 'none' : off.visual,
      helm: helm.visual,
      body: body.visual,
      cape: cape.visual,
    },
    coreId: core.id,
    coreColor: core.id !== 'none' ? core.color : null,
  };
}

const STYLE_VISUALS: Record<StyleId, GearVisuals> = {
  murmillo: { weapon: 'gladius', offhand: 'scutum', helm: 'galea', body: 'manica', cape: 'none' },
  dimachaerus: { weapon: 'twinSica', offhand: 'none', helm: 'horned', body: 'spiked', cape: 'none' },
  executioner: { weapon: 'warhammer', offhand: 'none', helm: 'cage', body: 'spiked', cape: 'none' },
  retiarius: { weapon: 'trident', offhand: 'net', helm: 'none', body: 'galerus', cape: 'none' },
  hoplomachus: { weapon: 'spear', offhand: 'buckler', helm: 'corinthian', body: 'cuirass', cape: 'cloak' },
};

/** Maps legacy 5 StyleId presets identically onto ResolvedGear for unit tests and preset rivals. */
export function gearFromStyle(id?: StyleId): ResolvedGear {
  const st = STYLES[id ?? 'murmillo'] ?? STYLES.murmillo;
  return {
    name: st.name,
    color: st.color,
    dmgMul: st.dmgMul,
    windupMul: st.windupMul,
    recoverMul: st.recoverMul,
    reachMul: st.reachMul,
    lungeMul: st.lungeMul,
    knockMul: st.knockMul,
    speedMul: st.speedMul,
    limbMul: st.limbMul,
    blockStamMul: st.blockStamMul,
    parryBonus: st.parryBonus,
    blunt: st.blunt,
    dualWield: st.dualWield,
    hasShield: st.hasShield,
    netHeavy: st.netHeavy,
    heavyBreaksBlock: st.heavyBreaksBlock,
    armor: { ...st.armor },
    scale: st.scale,
    bonusHp: 0,
    fameMul: 1,
    moves: { ...st.moves },
    visuals: { ...STYLE_VISUALS[st.id] },
    coreId: 'none',
    coreColor: null,
  };
}
