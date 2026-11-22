/** Pure combat rules. No rendering, no physics: everything here is unit-tested. */
import { type ArmorKey, type StyleId } from './styles';
import { gearFromStyle, type EchoCoreId, type ResolvedGear, type WeaponFamily } from '../rpg/items';

export type Kind = 'player' | 'skirmisher' | 'brute' | 'champion';
export type State = 'idle' | 'windup' | 'strike' | 'recover' | 'dodge' | 'stagger' | 'dead';
export type Atk = 'light' | 'light2' | 'light3' | 'heavy' | 'bash';
export type HitReaction = 'head_snap' | 'chest_recoil' | 'gut_crunch' | 'leg_trip';
export type FinisherChoreo = 'gladius_throat' | 'spear_impale' | 'twin_scissor' | 'hammer_flatten' | 'trident_pin';

export function reactionForZone(zone: LimbKey, heavy: boolean): HitReaction {
  if (zone === 'head') return 'head_snap';
  if (zone === 'legL' || zone === 'legR') return 'leg_trip';
  if (zone === 'torso' && heavy) return 'gut_crunch';
  return 'chest_recoil';
}

export function finisherChoreoForWeapon(family: WeaponFamily): FinisherChoreo {
  if (family === 'spear') return 'spear_impale';
  if (family === 'twinSica') return 'twin_scissor';
  if (family === 'warhammer') return 'hammer_flatten';
  if (family === 'trident') return 'trident_pin';
  return 'gladius_throat';
}

export type LimbKey = 'head' | 'torso' | 'armL' | 'armR' | 'legL' | 'legR';
export const LIMB_KEYS: readonly LimbKey[] = ['head', 'torso', 'armL', 'armR', 'legL', 'legR'];
export interface Limb { hp: number; max: number; severed: boolean }
export type Limbs = Record<LimbKey, Limb>;

export interface ArmorSlot { hp: number; max: number; broken: boolean }
export type Armor = Record<ArmorKey, ArmorSlot>;

export function makeLimbs(maxHp: number): Limbs {
  const part = (pct: number): Limb => {
    const max = Math.max(1, Math.round(maxHp * pct));
    return { hp: max, max, severed: false };
  };
  return {
    head: part(0.52),
    torso: part(1.0),
    armL: part(0.36),
    armR: part(0.40),
    legL: part(0.34),
    legR: part(0.34),
  };
}

export function makeArmor(style: { armor: Record<ArmorKey, number> }): Armor {
  const slot = (max: number): ArmorSlot => ({ hp: max, max, broken: max <= 0 });
  return {
    helm: slot(style.armor.helm),
    pauldron: slot(style.armor.pauldron),
    shield: slot(style.armor.shield),
  };
}

export type TargetGroup = 'armL' | 'armR' | 'leg' | 'head';

export interface Attack {
  windup: number;
  strike: number;
  recover: number;
  dmg: number;
  stamina: number;
  reach: number;
  half: number;
  knock: number;
  lunge: number;
  zone: TargetGroup;
  limbMul: number;
  guardBreak?: boolean;
}

export const ATTACKS: Record<Atk, Attack> = {
  light:  { windup: 0.2,  strike: 0.1,  recover: 0.26, dmg: 12, stamina: 12, reach: 2.45, half: Math.PI / 3,   knock: 4.5,  lunge: 4.5, zone: 'armL', limbMul: 1.15 },
  light2: { windup: 0.16, strike: 0.1,  recover: 0.26, dmg: 14, stamina: 12, reach: 2.55, half: Math.PI / 2.7, knock: 5.5,  lunge: 5.2, zone: 'armR', limbMul: 1.15 },
  light3: { windup: 0.24, strike: 0.12, recover: 0.42, dmg: 22, stamina: 16, reach: 2.8,  half: Math.PI / 2.5, knock: 10,   lunge: 7.5, zone: 'leg',  limbMul: 1.25 },
  heavy:  { windup: 0.5,  strike: 0.12, recover: 0.52, dmg: 30, stamina: 26, reach: 2.8,  half: Math.PI / 3,   knock: 13.5, lunge: 6.5, zone: 'head', limbMul: 1.25 },
  bash:   { windup: 0.18, strike: 0.1,  recover: 0.34, dmg: 5,  stamina: 14, reach: 2.1,  half: Math.PI / 3.2, knock: 8,    lunge: 5.5, zone: 'leg',  limbMul: 1.4, guardBreak: true },
};

export interface Stats {
  name: string; hp: number; stamina: number; speed: number; dmgMul: number;
  /** multiplies windup so enemy attacks read as telegraphs */
  windupMul: number; radius: number; color: string;
  ai?: { dist: number; attackEvery: [number, number]; heavyChance: number; dodgeChance: number; blockChance?: number };
}

export const KINDS: Record<Kind, Stats> = {
  player: { name: 'YOU', hp: 100, stamina: 100, speed: 5.6, dmgMul: 1, windupMul: 1, radius: 0.55, color: '#3ff0ff' },
  skirmisher: { name: 'SKIRMISHER', hp: 55, stamina: 80, speed: 5.0, dmgMul: 0.85, windupMul: 2.2, radius: 0.55, color: '#ff6b6b',
    ai: { dist: 3.2, attackEvery: [0.85, 1.65], heavyChance: 0.15, dodgeChance: 0.5, blockChance: 0.18 } },
  brute: { name: 'BRUTE', hp: 140, stamina: 120, speed: 3.2, dmgMul: 1.1, windupMul: 2.1, radius: 0.75, color: '#ff4fd8',
    ai: { dist: 2.5, attackEvery: [1.1, 2.1], heavyChance: 0.65, dodgeChance: 0.18, blockChance: 0.32 } },
  champion: { name: 'CHAMPION', hp: 220, stamina: 160, speed: 4.4, dmgMul: 1.15, windupMul: 2.05, radius: 0.65, color: '#ffc95c',
    ai: { dist: 2.9, attackEvery: [0.75, 1.45], heavyChance: 0.42, dodgeChance: 0.42, blockChance: 0.48 } },
};

const DEFAULT_STYLE: Record<Kind, StyleId> = {
  player: 'murmillo',
  skirmisher: 'dimachaerus',
  brute: 'executioner',
  champion: 'hoplomachus',
};

export const DODGE_TIME = 0.35;
export const DODGE_IFRAMES = 0.25;
export const DODGE_SPEED = 11;
export const DODGE_COST = 20;
export const PARRY_WINDOW = 0.26;
export const RIPOSTE_WINDOW = 1.4;
export const RIPOSTE_DMG_MUL = 1.65;
export const PARRY_COOLDOWN = 0.35;
export const BLOCK_ARC = (70 * Math.PI) / 180;

export interface Mods {
  dmg: number; heavyDmg: number; stamRegen: number; speed: number; healOnKill: number; thorns: number;
  parryWindow: number; dodgeCost: number; blockStam: number; maxHp: number; maxStamina: number; glory: number;
  riposteBonus?: number;
}
export const defaultMods = (): Mods => ({
  dmg: 1, heavyDmg: 1, stamRegen: 1, speed: 1, healOnKill: 0, thorns: 0, parryWindow: 0, dodgeCost: 0, blockStam: 0, maxHp: 0, maxStamina: 0, glory: 1, riposteBonus: 0,
});
export const dodgeCostOf = (f: Fighter) => Math.max(4, DODGE_COST - f.mods.dodgeCost);
export const gearOf = (f: Fighter): ResolvedGear => f.gear ?? gearFromStyle(f.style);
export const parryWindowOf = (f: Fighter) => PARRY_WINDOW + f.mods.parryWindow + gearOf(f).parryBonus;

export interface AiState {
  mode: 'approach' | 'duel' | 'flank' | 'feintBack' | 'punish' | 'recoverStam';
  timer: number;
  strafe: 1 | -1;
  strafeTimer: number;
  next: number;
  wantAttack: Atk | null;
  blockTimer: number;
  reactCd: number;
  reactedAtk: boolean;
  punishTimer: number;
  comboLeft: number;
  targetBlockT: number;
}

export type StanceHeight = 'high' | 'mid' | 'low';

export interface Fighter {
  id: number; kind: Kind; style: StyleId; gear?: ResolvedGear; team: 'p' | 'e'; stats: Stats;
  x: number; z: number; vx: number; vz: number; yaw: number;
  hp: number; maxHp: number; stamina: number; maxStamina: number; staminaDelay: number;
  limbs: Limbs;
  armor: Armor;
  snared: number;
  dazed: number;
  guardHeight: StanceHeight;
  stanceAge: number;
  weaponDisarmed: boolean;
  airY: number;
  airVy: number;
  juggleCount: number;
  diveKicking: boolean;
  wallSplat: number;
  hitReaction?: HitReaction;
  hitReactionT?: number;
  finisherChoreo?: FinisherChoreo;
  finisherT?: number;
  state: State; atk: Atk | null; t: number; stagger: number;
  blocking: boolean; blockT: number; iframes: number;
  parryHold: number; parryCd: number; riposte: number; riposteActive: boolean;
  dodgeX: number; dodgeZ: number; kx: number; kz: number;
  comboStep: 0 | 1 | 2 | 3; comboTimer: number; queuedAtk: Atk | null;
  localVx: number; localVz: number; facingTarget: boolean;
  dodgeLocalX: number; dodgeLocalZ: number;
  mods: Mods;
  ai: AiState;
}

export interface Intent {
  moveX: number; moveZ: number;
  light: boolean; heavy: boolean; bash: boolean;
  block: boolean; parry?: boolean; dodge: boolean;
  stance?: StanceHeight;
  jump?: boolean;
  throwWeapon?: boolean;
}
export const NO_INTENT: Intent = { moveX: 0, moveZ: 0, light: false, heavy: false, bash: false, block: false, parry: false, dodge: false };

export type HitType = 'hit' | 'block' | 'parry' | 'guardBreak' | 'kill';
export interface HitEvent {
  type: HitType; attacker: number; victim: number; dmg: number; heavy: boolean; atk: Atk;
  dx: number; dz: number; x: number; z: number;
  zone: LimbKey; broken?: LimbKey; severed?: LimbKey; decap?: boolean;
  armorBroken?: ArmorKey; snared?: boolean; riposte?: boolean;
  weaponDropped?: boolean; launched?: boolean; juggled?: boolean; diveKick?: boolean; thrownHit?: boolean;
  hitReaction?: HitReaction; finisherChoreo?: FinisherChoreo; coreEffect?: EchoCoreId;
}

export function makeFighter(id: number, kind: Kind, x: number, z: number, mods: Mods = defaultMods(), style?: StyleId, gear?: ResolvedGear): Fighter {
  const stats = KINDS[kind];
  const resolvedStyle = style ?? DEFAULT_STYLE[kind];
  const resolvedGear = gear ?? gearFromStyle(resolvedStyle);
  const maxHp = stats.hp + mods.maxHp;
  return {
    id, kind, style: resolvedStyle, gear: resolvedGear, team: kind === 'player' ? 'p' : 'e', stats, x, z, vx: 0, vz: 0, yaw: 0,
    hp: maxHp, maxHp, stamina: stats.stamina + mods.maxStamina, maxStamina: stats.stamina + mods.maxStamina, staminaDelay: 0,
    limbs: makeLimbs(maxHp),
    armor: makeArmor(resolvedGear),
    snared: 0,
    dazed: 0,
    guardHeight: 'mid',
    stanceAge: 99,
    weaponDisarmed: false,
    airY: 0,
    airVy: 0,
    juggleCount: 0,
    diveKicking: false,
    wallSplat: 0,
    state: 'idle', atk: null, t: 0, stagger: 0, blocking: false, blockT: 0, iframes: 0,
    parryHold: 0, parryCd: 0, riposte: 0, riposteActive: false,
    dodgeX: 0, dodgeZ: 0, kx: 0, kz: 0,
    comboStep: 0, comboTimer: 0, queuedAtk: null,
    localVx: 0, localVz: 0, facingTarget: false,
    dodgeLocalX: 0, dodgeLocalZ: 0,
    mods,
    ai: {
      mode: 'approach', timer: 0, strafe: Math.random() < 0.5 ? 1 : -1, strafeTimer: 1.5,
      next: 0.75 + Math.random() * 0.7, wantAttack: null, blockTimer: 0,
      reactCd: 0, reactedAtk: false, punishTimer: 0, comboLeft: 0, targetBlockT: 0,
    },
  };
}

export function drinkFlask(f: Fighter): boolean {
  if (f.state === 'dead') return false;
  const needsLimb = LIMB_KEYS.some((k) => !f.limbs[k].severed && f.limbs[k].hp < f.limbs[k].max);
  if (f.hp >= f.maxHp && !needsLimb) return false;
  f.hp = Math.min(f.maxHp, f.hp + Math.round(f.maxHp * 0.45));
  for (const k of LIMB_KEYS) {
    const l = f.limbs[k];
    if (!l.severed) l.hp = Math.min(l.max, l.hp + Math.round(l.max * 0.45));
  }
  return true;
}

export function canBlockOf(f: Fighter): boolean {
  const st = gearOf(f);
  if (st.hasShield) return f.limbs.armL.hp > 0 && !f.limbs.armL.severed;
  if (st.dualWield) return f.limbs.armL.hp > 0 && !f.limbs.armL.severed && f.limbs.armR.hp > 0 && !f.limbs.armR.severed;
  return f.limbs.armR.hp > 0 && !f.limbs.armR.severed;
}

export function isDisarmedOf(f: Fighter): boolean {
  const st = gearOf(f);
  return st.dualWield ? (f.limbs.armR.severed && f.limbs.armL.severed) : f.limbs.armR.severed;
}

export const hasWeaponOf = (f: Fighter): boolean => !isDisarmedOf(f) && !f.weaponDisarmed;

const isArmWeak = (f: Fighter): boolean => {
  const st = gearOf(f);
  if (isDisarmedOf(f)) return false;
  return f.limbs.armR.hp <= 0 || (st.dualWield && f.limbs.armL.hp <= 0);
};

export function windupOf(f: Fighter, a: Atk): number {
  const st = gearOf(f);
  const mv = st.moves[a];
  const crippledArm = isArmWeak(f) ? 1.25 : 1;
  const riposteSpeed = f.riposteActive || f.riposte > 0 ? 0.68 : 1;
  const bareFast = f.weaponDisarmed && !isDisarmedOf(f) ? 0.75 : 1;
  const raw = ATTACKS[a].windup * f.stats.windupMul * st.windupMul * (mv.windupMul ?? 1) * crippledArm * riposteSpeed * bareFast;
  return f.team === 'e' ? Math.max(0.4, raw) : raw;
}
const clamp1 = (v: number) => Math.max(-1, Math.min(1, v));

export function pickTargetZone(atk: Atk, v: Fighter, stance: StanceHeight = 'mid'): LimbKey {
  if (stance === 'high') return 'head';
  if (stance === 'low') {
    if (v.limbs.legL.hp > 0 && !v.limbs.legL.severed) return 'legL';
    if (v.limbs.legR.hp > 0 && !v.limbs.legR.severed) return 'legR';
    return 'torso';
  }
  const grp = ATTACKS[atk].zone;
  if (grp === 'armL') return v.limbs.armL.hp > 0 && !v.limbs.armL.severed ? 'armL' : 'torso';
  if (grp === 'armR') return v.limbs.armR.hp > 0 && !v.limbs.armR.severed ? 'armR' : 'torso';
  if (grp === 'leg') {
    if (v.limbs.legL.hp > 0 && !v.limbs.legL.severed) return 'legL';
    if (v.limbs.legR.hp > 0 && !v.limbs.legR.severed) return 'legR';
    return 'torso';
  }
  return 'head';
}

export function startAttack(f: Fighter, a: Atk): boolean {
  if (f.state !== 'idle') return false;
  if (isDisarmedOf(f) && a !== 'bash') return false;
  const at = ATTACKS[a];
  if (f.stamina < at.stamina) return false;
  f.riposteActive = f.riposte > 0;
  f.riposte = 0;
  f.parryHold = 0;
  f.stamina -= at.stamina; f.staminaDelay = 0.7;
  f.state = 'windup'; f.atk = a; f.t = 0; f.blocking = false; f.queuedAtk = null;
  f.comboStep = a === 'light' ? 1 : a === 'light2' ? 2 : a === 'light3' ? 3 : 0;
  f.comboTimer = a === 'light' || a === 'light2' ? 0.5 : 0;
  return true;
}

export function stagger(f: Fighter, dur: number): void {
  if (f.state === 'dead') return;
  f.state = 'stagger'; f.stagger = dur; f.t = 0; f.atk = null; f.blocking = false;
  f.parryHold = 0; f.riposteActive = false; f.diveKicking = false;
  f.comboStep = 0; f.comboTimer = 0; f.queuedAtk = null;
}

function enterParry(f: Fighter): void {
  f.state = 'idle';
  f.atk = null;
  f.queuedAtk = null;
  f.t = 0;
  f.blocking = true;
  f.blockT = 0;
  f.parryHold = parryWindowOf(f);
}

function enterDodge(f: Fighter, i: Intent): void {
  const len = Math.hypot(i.moveX, i.moveZ);
  f.dodgeX = len > 0.1 ? i.moveX / len : -Math.sin(f.yaw);
  f.dodgeZ = len > 0.1 ? i.moveZ / len : -Math.cos(f.yaw);
  const fwdX = Math.sin(f.yaw), fwdZ = Math.cos(f.yaw);
  const rightX = Math.cos(f.yaw), rightZ = -Math.sin(f.yaw);
  f.dodgeLocalZ = f.dodgeX * fwdX + f.dodgeZ * fwdZ;
  f.dodgeLocalX = f.dodgeX * rightX + f.dodgeZ * rightZ;
  f.stamina -= dodgeCostOf(f); f.staminaDelay = 0.6;
  f.state = 'dodge'; f.t = 0; f.iframes = DODGE_IFRAMES; f.blocking = false;
  f.parryHold = 0; f.riposteActive = false; f.diveKicking = false;
  f.comboStep = 0; f.comboTimer = 0; f.queuedAtk = null;
}

/** Advance one fighter by dt. `target` is who it faces. Returns true on the tick the strike lands (hit frame). */
export function stepFighter(f: Fighter, i: Intent, dt: number, target: Fighter | null): boolean {
  if (f.state === 'dead') return false;
  let strikeFrame = false;
  const st = gearOf(f);
  const disarmed = isDisarmedOf(f);
  const canBlock = canBlockOf(f);

  f.facingTarget = target !== null;
  f.iframes = Math.max(0, f.iframes - dt);
  f.snared = Math.max(0, f.snared - dt);
  f.dazed = Math.max(0, f.dazed - dt);
  f.wallSplat = Math.max(0, f.wallSplat - dt);
  f.hitReactionT = Math.max(0, (f.hitReactionT ?? 0) - dt);
  f.finisherT = Math.max(0, (f.finisherT ?? 0) - dt);
  f.stanceAge += dt;
  if (i.stance && i.stance !== f.guardHeight) {
    f.guardHeight = i.stance;
    f.stanceAge = 0;
  }
  f.parryHold = Math.max(0, f.parryHold - dt);
  f.parryCd = Math.max(0, f.parryCd - dt);
  f.riposte = Math.max(0, f.riposte - dt);
  f.staminaDelay = Math.max(0, f.staminaDelay - dt);
  if (f.staminaDelay === 0) f.stamina = Math.min(f.maxStamina, f.stamina + (f.blocking ? 11 : 22) * f.mods.stamRegen * dt);
  f.t += dt;
  const k = Math.exp(-9 * dt);
  f.kx *= k; f.kz *= k;

  if (f.state === 'idle') {
    if (f.comboTimer > 0) f.comboTimer = Math.max(0, f.comboTimer - dt);
    if (f.comboTimer === 0) f.comboStep = 0;
  }

  if (f.state !== 'dodge') {
    if (target) {
      f.yaw = Math.atan2(target.x - f.x, target.z - f.z);
    } else if (Math.hypot(i.moveX, i.moveZ) > 0.1) {
      const wantYaw = Math.atan2(i.moveX, i.moveZ);
      let d = wantYaw - f.yaw;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      f.yaw += d * (1 - Math.exp(-15 * dt));
    }
  }

  if ((f.state === 'strike' || f.state === 'recover') && (f.atk === 'light' || f.atk === 'light2')) {
    if (i.light && !disarmed) f.queuedAtk = f.atk === 'light' ? 'light2' : 'light3';
    else if (i.heavy && !disarmed) f.queuedAtk = 'heavy';
    else if (i.bash) f.queuedAtk = 'bash';
  }

  const brokenLegs = (f.limbs.legL.hp <= 0 ? 1 : 0) + (f.limbs.legR.hp <= 0 ? 1 : 0);
  const legSpeedMul = brokenLegs === 0 ? 1 : brokenLegs === 1 ? 0.55 : 0.42;
  const snareMul = f.snared > 0 ? 0.25 : 1;
  const dazeMul = f.dazed > 0 ? 0.45 : 1;
  const canDodge = brokenLegs === 0 && f.snared <= 0 && f.stamina >= dodgeCostOf(f);

  // Tekken / Nidhogg Jump & Airborne Flying Dive-Kick
  if (i.jump && f.airY === 0 && f.state === 'idle' && brokenLegs === 0 && f.snared <= 0 && f.wallSplat <= 0) {
    f.airVy = 7.8;
    f.airY = 0.02;
  }
  if (f.airY > 0 || f.airVy !== 0) {
    if (f.airY > 0.15 && !f.diveKicking && (f.state === 'idle' || f.state === 'windup') && (i.light || i.heavy)) {
      f.diveKicking = true;
      f.state = 'windup';
      f.atk = 'heavy';
      f.t = windupOf(f, 'heavy') * 0.72;
      f.blocking = false;
      f.parryHold = 0;
      f.queuedAtk = null;
      f.kx += Math.sin(f.yaw) * 11.5;
      f.kz += Math.cos(f.yaw) * 11.5;
      f.airVy = Math.min(f.airVy, -1.2);
    }
    f.airVy -= 21 * dt;
    f.airY += f.airVy * dt;
    if (f.airY <= 0) {
      f.airY = 0;
      f.airVy = 0;
      f.juggleCount = 0;
      f.diveKicking = false;
    }
  }

  let speedMul = dazeMul * (f.weaponDisarmed ? 1.22 : 1);
  let windupPullX = 0;
  let windupPullZ = 0;
  switch (f.state) {
    case 'stagger':
      speedMul = 0;
      if (f.t >= f.stagger && f.airY <= 0) { f.state = 'idle'; f.t = 0; }
      break;
    case 'dodge': {
      f.vx = f.dodgeX * DODGE_SPEED; f.vz = f.dodgeZ * DODGE_SPEED;
      if (i.light && !disarmed) f.queuedAtk = 'light';
      else if (i.heavy && !disarmed) f.queuedAtk = 'heavy';
      else if (i.bash) f.queuedAtk = 'bash';
      if (f.t >= DODGE_TIME * 0.38 && f.queuedAtk && f.stamina >= ATTACKS[f.queuedAtk].stamina) {
        const dashAtk = f.queuedAtk;
        f.iframes = 0;
        f.state = 'idle';
        f.queuedAtk = null;
        if (startAttack(f, dashAtk)) {
          f.kx += Math.sin(f.yaw) * 4.5 * legSpeedMul;
          f.kz += Math.cos(f.yaw) * 4.5 * legSpeedMul;
          break;
        }
      }
      if (f.t >= DODGE_TIME) { f.state = 'idle'; f.t = 0; f.iframes = 0; f.queuedAtk = null; }
      break;
    }
    case 'windup': {
      speedMul = 0.35;
      const wt = windupOf(f, f.atk!);
      if (i.parry && f.t < wt * 0.45 && canBlock && f.parryCd <= 0 && f.stamina > 1) {
        enterParry(f);
        speedMul = 0.5;
        break;
      }
      const at = ATTACKS[f.atk!];
      const mv = st.moves[f.atk!];
      const reach = (st.netHeavy && f.atk === 'heavy' ? 4.6 : at.reach * st.reachMul * (mv.reachMul ?? 1));
      const dTarget = target ? Math.hypot(target.x - f.x, target.z - f.z) : Infinity;

      // Pre-impact magnetic windup lunge so strikes close the gap BEFORE the hit frame
      if (f.t >= wt * 0.35) {
        const lFactor = st.lungeMul * (mv.lungeMul ?? 1) * legSpeedMul;
        if (target && dTarget > 1.48 && dTarget <= reach + 1.85) {
          const pullSpd = Math.min(14, (dTarget - 1.38) / Math.max(0.05, wt - f.t)) * legSpeedMul;
          windupPullX = Math.sin(f.yaw) * pullSpd;
          windupPullZ = Math.cos(f.yaw) * pullSpd;
        } else if (!target) {
          const baseLunge = Math.min(9, at.lunge * 0.72 * lFactor);
          windupPullX = Math.sin(f.yaw) * baseLunge;
          windupPullZ = Math.cos(f.yaw) * baseLunge;
        }
      }

      if (f.t >= wt) {
        f.state = 'strike'; f.t = 0; strikeFrame = true;
        const closeClamp = target && dTarget < 1.75 ? 0.35 : 1.0;
        const follow = at.lunge * st.lungeMul * (mv.lungeMul ?? 1) * legSpeedMul * closeClamp;
        f.kx += Math.sin(f.yaw) * follow;
        f.kz += Math.cos(f.yaw) * follow;
      }
      break;
    }
    case 'strike':
      speedMul = 0.2;
      if (f.t >= ATTACKS[f.atk!].strike) { f.state = 'recover'; f.t = 0; }
      break;
    case 'recover': {
      speedMul = 0.55;
      if (i.parry && canBlock && f.parryCd <= 0 && f.stamina > 1) {
        enterParry(f);
        speedMul = 0.5;
        break;
      }
      if (i.dodge && canDodge) {
        enterDodge(f, i);
        break;
      }
      const rec = ATTACKS[f.atk!].recover * st.recoverMul;
      if (f.queuedAtk && f.t >= rec * 0.45 && f.stamina >= ATTACKS[f.queuedAtk].stamina) {
        const next = f.queuedAtk;
        f.state = 'idle'; f.atk = null; f.queuedAtk = null;
        startAttack(f, next);
      } else if (!f.queuedAtk && f.t >= rec * 0.65 && Math.hypot(i.moveX, i.moveZ) > 0.25) {
        f.state = 'idle'; f.atk = null; f.t = 0; f.queuedAtk = null;
        f.riposteActive = false;
      } else if (f.t >= rec) {
        f.state = 'idle'; f.atk = null; f.t = 0; f.queuedAtk = null;
        f.riposteActive = false;
      }
      break;
    }
    case 'idle': {
      const wasBlocking = f.blocking;
      if (i.dodge && canDodge) {
        enterDodge(f, i);
        break;
      }
      if (i.parry && !f.blocking && canBlock && f.parryCd <= 0 && f.stamina > 1) {
        enterParry(f);
      } else {
        const wantBlock = canBlock && (i.block || f.parryHold > 0) && f.stamina > 1;
        if (wantBlock && !f.blocking) f.blockT = 0;
        f.blocking = wantBlock;
        if (f.blocking) f.blockT += dt;
        else if (wasBlocking && f.blockT > 0 && f.riposte <= 0) f.parryCd = PARRY_COOLDOWN;
      }
      if (f.riposte > 0 || f.parryHold <= 0) {
        if (!f.blocking && i.bash) {
          startAttack(f, 'bash');
        } else if (!f.blocking && i.heavy) {
          startAttack(f, 'heavy');
        } else if (!f.blocking && i.light) {
          const next: Atk = f.comboTimer > 0 && f.comboStep === 1 ? 'light2' : f.comboTimer > 0 && f.comboStep === 2 ? 'light3' : 'light';
          startAttack(f, next);
        } else if (f.riposte > 0 && (i.light || i.heavy || i.bash)) {
          f.blocking = false;
          f.parryHold = 0;
          if (i.bash) startAttack(f, 'bash');
          else if (i.heavy) startAttack(f, 'heavy');
          else startAttack(f, 'light');
        }
      }
      if (f.blocking) speedMul = 0.5;
      break;
    }
  }
  if (f.state !== 'dodge') {
    const len = Math.hypot(i.moveX, i.moveZ) || 1;
    const sp = f.stats.speed * st.speedMul * f.mods.speed * speedMul * legSpeedMul * snareMul * Math.min(1, Math.hypot(i.moveX, i.moveZ));
    const tx = (i.moveX / len) * sp + windupPullX;
    const tz = (i.moveZ / len) * sp + windupPullZ;
    const a = 1 - Math.exp(-16 * dt);
    f.vx += (tx - f.vx) * a; f.vz += (tz - f.vz) * a;
  }
  f.x += (f.vx + f.kx) * dt; f.z += (f.vz + f.kz) * dt;

  const fwdX = Math.sin(f.yaw), fwdZ = Math.cos(f.yaw);
  const rightX = Math.cos(f.yaw), rightZ = -Math.sin(f.yaw);
  const maxSpd = f.stats.speed * st.speedMul * f.mods.speed || 1;
  f.localVz = clamp1((f.vx * fwdX + f.vz * fwdZ) / maxSpd);
  f.localVx = clamp1((f.vx * rightX + f.vz * rightZ) / maxSpd);
  return strikeFrame;
}

/** Resolve the strike of `a` against `victims`. Mutates victims, returns events. */
export function resolveStrike(a: Fighter, victims: Fighter[]): HitEvent[] {
  const out: HitEvent[] = [];
  if (!a.atk) return out;
  const at = ATTACKS[a.atk];
  const st = gearOf(a);
  const mv = st.moves[a.atk];
  const heavy = a.atk === 'heavy';
  const diveKick = a.diveKicking;
  const bareHanded = a.weaponDisarmed && !diveKick;
  const armMul = isArmWeak(a) ? 0.65 : 1;
  const riposteHit = a.riposteActive;
  const riposteMul = riposteHit ? RIPOSTE_DMG_MUL + (a.mods.riposteBonus ?? 0) : 1;
  const reach = st.netHeavy && heavy ? 4.6 : at.reach * st.reachMul * (mv.reachMul ?? 1) * (bareHanded ? 0.85 : 1);
  const half = mv.half ?? at.half;
  const knock = at.knock * st.knockMul * (mv.knockMul ?? 1) * (diveKick ? 1.35 : 1);
  const isBlunt = st.blunt || Boolean(at.guardBreak) || diveKick || bareHanded;
  const atkHeight: StanceHeight = diveKick
    ? 'high'
    : a.guardHeight !== 'mid'
      ? a.guardHeight
      : a.atk === 'heavy'
        ? 'high'
        : a.atk === 'light3' || a.atk === 'bash'
          ? 'low'
          : 'mid';

  for (const v of victims) {
    if (v.state === 'dead' || v.team === a.team || v.iframes > 0) continue;
    const vertTol = heavy || diveKick || v.airY > 0 ? 2.4 : 1.75;
    if (Math.abs(a.airY - v.airY) > vertTol) continue;
    const dx = v.x - a.x, dz = v.z - a.z, d = Math.hypot(dx, dz) || 1e-6;
    if (d > reach + v.stats.radius) continue;
    const ang = Math.atan2(dx, dz) - a.yaw;
    if (Math.abs(Math.atan2(Math.sin(ang), Math.cos(ang))) > half) continue;

    // Nidhogg high-duck & low-jump evasion
    if (atkHeight === 'high' && !diveKick && v.guardHeight === 'low' && v.blocking && v.state === 'idle' && v.airY === 0) continue;
    if (atkHeight === 'low' && v.airY > 0.45 && v.state !== 'stagger') continue;

    const ux = dx / d, uz = dz / d;
    const dmg = at.dmg * a.stats.dmgMul * st.dmgMul * (mv.dmgMul ?? 1) * a.mods.dmg * (heavy ? a.mods.heavyDmg : 1) * armMul * riposteMul * (bareHanded ? 0.55 : 1);
    const base = { attacker: a.id, victim: v.id, heavy, atk: a.atk, dx: ux, dz: uz, x: (a.x + v.x) / 2, z: (a.z + v.z) / 2 };

    // blocking, parry & Nidhogg flick-parry beat-disarm
    const vst = gearOf(v);
    const canBlock = canBlockOf(v);
    const faceAng = Math.atan2(-dx, -dz) - v.yaw;
    const facing = Math.abs(Math.atan2(Math.sin(faceAng), Math.cos(faceAng))) <= BLOCK_ARC;
    const nidhoggFlick = hasWeaponOf(v) && v.guardHeight === atkHeight && v.stanceAge <= 0.24;
    if (v.state === 'idle' && facing && ((canBlock && v.blocking) || (nidhoggFlick && !at.guardBreak && !diveKick))) {
      let armorBroken: ArmorKey | undefined;
      if (!nidhoggFlick && (at.guardBreak || diveKick)) {
        v.blocking = false;
        v.parryHold = 0;
        v.stamina = Math.max(0, v.stamina - 30);
        v.staminaDelay = 1.2;
        v.hp = Math.max(1, v.hp - dmg);
        v.limbs.armL.hp = Math.max(1, v.limbs.armL.hp - dmg * 1.2);
        if (!v.armor.shield.broken && v.armor.shield.hp > 0) {
          v.armor.shield.hp = Math.max(0, v.armor.shield.hp - dmg * 1.8);
          if (v.armor.shield.hp === 0) { v.armor.shield.broken = true; armorBroken = 'shield'; }
        }
        v.kx += ux * knock; v.kz += uz * knock;
        stagger(v, 0.95);
        v.dazed = 2.2;
        out.push({ ...base, type: 'guardBreak', dmg, zone: 'armL', armorBroken, diveKick: diveKick || undefined });
      } else if ((nidhoggFlick && !at.guardBreak && !diveKick) || (!at.guardBreak && !diveKick && canBlock && v.blocking && v.blockT <= parryWindowOf(v))) {
        stagger(a, 1.35);
        a.dazed = 2.4;
        a.stamina = Math.max(0, a.stamina - 35);
        a.staminaDelay = 1.2;
        v.stamina = Math.min(v.maxStamina, v.stamina + 25);
        v.riposte = RIPOSTE_WINDOW;
        v.parryCd = 0;
        v.parryHold = 0;
        let weaponDropped = false;
        if (nidhoggFlick && hasWeaponOf(a)) {
          a.weaponDisarmed = true;
          weaponDropped = true;
        }
        out.push({ ...base, type: 'parry', dmg: 0, zone: 'armL', weaponDropped: weaponDropped || undefined });
      } else if (heavy && st.heavyBreaksBlock) {
        v.blocking = false;
        v.parryHold = 0;
        v.stamina = Math.max(0, v.stamina - 30);
        v.staminaDelay = 1.2;
        v.hp = Math.max(1, v.hp - dmg);
        v.limbs.armL.hp = Math.max(1, v.limbs.armL.hp - dmg * 1.2);
        if (!v.armor.shield.broken && v.armor.shield.hp > 0) {
          v.armor.shield.hp = Math.max(0, v.armor.shield.hp - dmg * 1.8);
          if (v.armor.shield.hp === 0) { v.armor.shield.broken = true; armorBroken = 'shield'; }
        }
        v.kx += ux * knock; v.kz += uz * knock;
        stagger(v, 0.95);
        v.dazed = 2.2;
        out.push({ ...base, type: 'guardBreak', dmg, zone: 'armL', armorBroken });
      } else {
        const chip = dmg * 0.15;
        v.hp = Math.max(1, v.hp - chip);
        v.limbs.armL.hp = Math.max(1, v.limbs.armL.hp - dmg * 0.25);
        if (!v.armor.shield.broken && v.armor.shield.hp > 0) {
          v.armor.shield.hp = Math.max(0, v.armor.shield.hp - dmg * (isBlunt ? 1.5 : 0.65));
          if (v.armor.shield.hp === 0) { v.armor.shield.broken = true; armorBroken = 'shield'; }
        }
        v.stamina -= dmg * 0.9 * (1 - v.mods.blockStam) * vst.blockStamMul; v.staminaDelay = 1;
        if (v.mods.thorns > 0) a.hp = Math.max(1, a.hp - v.mods.thorns);
        v.kx += ux * knock * 0.3; v.kz += uz * knock * 0.3;
        if (v.stamina <= 0) { v.stamina = 0; stagger(v, 0.7); }
        out.push({ ...base, type: 'block', dmg: chip, zone: 'armL', armorBroken });
      }
      continue;
    }

    const zone = pickTargetZone(a.atk, v, atkHeight);
    const coreId = st.coreId ?? 'none';
    const reaction = reactionForZone(zone, heavy);
    v.hitReaction = reaction;
    v.hitReactionT = 0.42;
    v.hp -= dmg;

    // Armor mitigation & shatter (helm covers head, pauldron covers arms/torso)
    const slotKey: ArmorKey | null = zone === 'head' ? 'helm' : zone === 'armL' || zone === 'armR' || zone === 'torso' ? 'pauldron' : null;
    let armorBroken: ArmorKey | undefined;
    let limbDmg = dmg * at.limbMul * st.limbMul;
    if (slotKey && !v.armor[slotKey].broken && v.armor[slotKey].hp > 0) {
      v.armor[slotKey].hp = Math.max(0, v.armor[slotKey].hp - dmg * (isBlunt ? 1.5 : 1.1));
      if (v.armor[slotKey].hp === 0) {
        v.armor[slotKey].broken = true;
        armorBroken = slotKey;
      }
      limbDmg *= isBlunt ? 0.75 : 0.45;
    }

    let snared = false;
    if (st.netHeavy && heavy) {
      v.snared = 1.8;
      snared = true;
    }

    // Echo Core weapon socketing effects
    let coreEffect: EchoCoreId | undefined;
    if (coreId === 'frame_freeze' && (heavy || riposteHit)) {
      v.snared = Math.max(v.snared, 1.6);
      snared = true;
      coreEffect = 'frame_freeze';
    } else if (coreId === 'cycle_siphon' && (heavy || riposteHit)) {
      a.hp = Math.min(a.maxHp, a.hp + 6);
      a.stamina = Math.min(a.maxStamina, a.stamina + 10);
      coreEffect = 'cycle_siphon';
    } else if (coreId === 'volt_arc' && heavy) {
      v.dazed = Math.max(v.dazed, 1.1);
      coreEffect = 'volt_arc';
    } else if (coreId === 'corrupt_bleed') {
      coreEffect = 'corrupt_bleed';
    }

    const limb = v.limbs[zone];
    const wasIntact = limb.hp > 0;
    limb.hp = Math.max(0, limb.hp - limbDmg);

    let broken: LimbKey | undefined;
    let severed: LimbKey | undefined;
    let decap = false;
    if (wasIntact && limb.hp === 0) {
      broken = zone;
      if (zone === 'head') {
        limb.severed = true; severed = 'head'; decap = true; v.hp = 0;
      } else if (zone === 'armL') {
        limb.severed = true; severed = 'armL'; v.blocking = false;
      } else if (zone === 'armR' && v.team === 'e') {
        limb.severed = true; severed = 'armR';
      } else if ((zone === 'legL' || zone === 'legR') && v.team === 'e') {
        limb.severed = true; severed = zone;
        if (v.limbs.legL.severed && v.limbs.legR.severed) v.hp = 0;
      }
    }

    let weaponDropped = false;
    if (diveKick && hasWeaponOf(v)) {
      v.weaponDisarmed = true;
      weaponDropped = true;
      v.dazed = Math.max(v.dazed, 2.4);
    }

    let launched = false;
    let juggled = false;
    const wasAirborne = v.airY > 0;
    const isLauncher = (heavy && (a.guardHeight === 'low' || a.weaponDisarmed || v.dazed > 0 || v.state === 'stagger')) || (a.atk === 'light3' && wasAirborne);
    if (v.hp > 0) {
      if (wasAirborne && v.juggleCount < 3) {
        v.airVy = 5.6;
        v.airY = Math.max(v.airY, 0.25);
        v.juggleCount++;
        juggled = true;
        v.dazed = 2.4;
      } else if (isLauncher && v.airY === 0) {
        v.airVy = 7.4;
        v.airY = 0.12;
        v.juggleCount = 1;
        launched = true;
        v.dazed = 2.6;
      }
    }

    v.kx += ux * knock; v.kz += uz * knock;
    if (v.hp <= 0) {
      v.hp = 0; v.state = 'dead'; v.atk = null; v.blocking = false; v.parryHold = 0; v.riposteActive = false; v.dazed = 0; v.airY = 0; v.airVy = 0; v.diveKicking = false;
      out.push({
        ...base, type: 'kill', dmg, zone, broken, severed, decap, armorBroken, snared,
        riposte: riposteHit || undefined, weaponDropped: weaponDropped || undefined, diveKick: diveKick || undefined,
        hitReaction: reaction, coreEffect,
      });
    } else {
      stagger(v, launched || juggled ? 0.85 : diveKick ? 0.72 : broken ? 0.65 : heavy ? 0.45 : at.guardBreak ? 0.35 : 0.18);
      if (broken || severed || armorBroken || riposteHit || diveKick || v.hp <= v.maxHp * 0.32) {
        v.dazed = 2.6;
      }
      out.push({
        ...base, type: 'hit', dmg, zone, broken, severed, armorBroken, snared,
        riposte: riposteHit || undefined, weaponDropped: weaponDropped || undefined,
        launched: launched || undefined, juggled: juggled || undefined, diveKick: diveKick || undefined,
        hitReaction: reaction, coreEffect,
      });
    }
  }
  a.riposteActive = false;
  a.diveKicking = false;
  return out;
}

export interface ArenaWeaponProp {
  id: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  yaw: number;
  spin: number;
  style: StyleId;
  gear?: ResolvedGear;
  color: string;
  ownerId: number;
  flying: boolean;
}

/** Hurl the fighter's weapon straight along their facing line like Nidhogg. */
export function throwFighterWeapon(a: Fighter, nextId: number): ArenaWeaponProp | null {
  if (a.state === 'dead' || !hasWeaponOf(a) || a.stamina < 12) return null;
  a.stamina = Math.max(0, a.stamina - 12);
  a.staminaDelay = 0.65;
  a.weaponDisarmed = true;
  a.blocking = false;
  a.parryHold = 0;
  const fx = Math.sin(a.yaw), fz = Math.cos(a.yaw);
  const startY = a.guardHeight === 'high' ? 1.62 : a.guardHeight === 'low' ? 0.72 : 1.22;
  return {
    id: nextId,
    x: a.x + fx * 0.65,
    y: startY + a.airY,
    z: a.z + fz * 0.65,
    vx: fx * 21,
    vy: 1.4,
    vz: fz * 21,
    yaw: a.yaw,
    spin: 0,
    style: a.style,
    gear: a.gear,
    color: a.stats.color,
    ownerId: a.id,
    flying: true,
  };
}

/** Spawn a disarmed weapon prop knocked loose into the air toward `(dx, dz)`. */
export function spawnDroppedWeapon(v: Fighter, dx: number, dz: number, nextId: number): ArenaWeaponProp {
  const rx = -dz, rz = dx;
  return {
    id: nextId,
    x: v.x,
    y: 1.35 + v.airY,
    z: v.z,
    vx: dx * 5.2 + rx * 2.4,
    vy: 5.5,
    vz: dz * 5.2 + rz * 2.4,
    yaw: v.yaw,
    spin: 0,
    style: v.style,
    gear: v.gear,
    color: v.stats.color,
    ownerId: v.id,
    flying: false,
  };
}

/** Step thrown & fallen weapon props, handling high-duck, jump-hop, flick deflects & floor settling. */
export function stepWeaponProps(props: ArenaWeaponProp[], fighters: Fighter[], dt: number, maxRadius = 13.5): HitEvent[] {
  const out: HitEvent[] = [];
  for (const prop of props) {
    if (prop.flying) {
      prop.x += prop.vx * dt;
      prop.z += prop.vz * dt;
      prop.vy -= 4.2 * dt;
      prop.y += prop.vy * dt;
      prop.spin += 18 * dt;

      const owner = fighters.find((x) => x.id === prop.ownerId);
      const sp = Math.hypot(prop.vx, prop.vz) || 1;
      const ux = prop.vx / sp, uz = prop.vz / sp;
      const propH: StanceHeight = prop.y >= 1.42 ? 'high' : prop.y <= 0.9 ? 'low' : 'mid';

      for (const f of fighters) {
        if (f.id === prop.ownerId || f.state === 'dead' || f.iframes > 0) continue;
        if (owner && owner.team === f.team) continue;
        if (Math.hypot(f.x - prop.x, f.z - prop.z) > f.stats.radius + 0.45) continue;

        if (propH === 'high' && f.guardHeight === 'low' && f.blocking && f.airY === 0) continue;
        if (propH === 'low' && f.airY > 0.45) continue;

        const nidhoggDeflect = f.state === 'idle' && (
          (hasWeaponOf(f) && f.guardHeight === propH && f.stanceAge <= 0.24)
          || (canBlockOf(f) && f.blocking && f.blockT <= parryWindowOf(f))
        );
        if (nidhoggDeflect) {
          prop.vx = -prop.vx * 0.35;
          prop.vz = -prop.vz * 0.35;
          prop.vy = 4.2;
          prop.flying = false;
          f.riposte = RIPOSTE_WINDOW;
          out.push({
            type: 'parry', attacker: prop.ownerId, victim: f.id, dmg: 0, heavy: true, atk: 'heavy',
            dx: ux, dz: uz, x: prop.x, z: prop.z, zone: 'armL', thrownHit: true,
          });
          break;
        }

        const dmg = 28;
        f.hp -= dmg;
        f.kx += ux * 12;
        f.kz += uz * 12;
        prop.flying = false;
        prop.vx *= 0.15;
        prop.vz *= 0.15;
        prop.vy = 2.5;
        const zone: LimbKey = propH === 'high' ? 'head' : propH === 'low' ? 'legL' : 'torso';
        if (f.hp <= 0) {
          f.hp = 0; f.state = 'dead'; f.atk = null; f.dazed = 0; f.airY = 0; f.airVy = 0;
          out.push({
            type: 'kill', attacker: prop.ownerId, victim: f.id, dmg, heavy: true, atk: 'heavy',
            dx: ux, dz: uz, x: f.x, z: f.z, zone, thrownHit: true,
          });
        } else {
          stagger(f, 0.75);
          f.dazed = 2.6;
          out.push({
            type: 'hit', attacker: prop.ownerId, victim: f.id, dmg, heavy: true, atk: 'heavy',
            dx: ux, dz: uz, x: f.x, z: f.z, zone, thrownHit: true,
          });
        }
        break;
      }

      const r = Math.hypot(prop.x, prop.z);
      if (r >= maxRadius) {
        const sc = (maxRadius - 0.3) / r;
        prop.x *= sc; prop.z *= sc;
        prop.flying = false;
        prop.vx = -prop.vx * 0.25;
        prop.vz = -prop.vz * 0.25;
        prop.vy = 2;
      } else if (prop.y <= 0.16) {
        prop.y = 0.16; prop.vy = 0; prop.vx = 0; prop.vz = 0; prop.flying = false;
      }
    } else if (prop.y > 0.16 || Math.abs(prop.vy) > 0.01) {
      prop.vy -= 18 * dt;
      prop.x += prop.vx * dt;
      prop.z += prop.vz * dt;
      prop.y += prop.vy * dt;
      prop.spin += 8 * dt;
      const r = Math.hypot(prop.x, prop.z);
      if (r >= maxRadius) {
        const sc = (maxRadius - 0.3) / r;
        prop.x *= sc; prop.z *= sc;
        prop.vx *= -0.3; prop.vz *= -0.3;
      }
      if (prop.y <= 0.16) {
        prop.y = 0.16; prop.vy = 0; prop.vx = 0; prop.vz = 0;
      }
    }
  }
  return out;
}

/** Pick up the nearest grounded weapon prop when bare-handed (removes it from props). */
export function tryPickupWeapon(f: Fighter, props: ArenaWeaponProp[], maxDist = 2.2): ArenaWeaponProp | null {
  if (f.state === 'dead' || isDisarmedOf(f) || !f.weaponDisarmed) return null;
  let bestIdx = -1;
  let bestD = maxDist;
  for (let i = 0; i < props.length; i++) {
    const pr = props[i];
    if (pr.flying) continue;
    const d = Math.hypot(pr.x - f.x, pr.z - f.z);
    if (d <= bestD) { bestD = d; bestIdx = i; }
  }
  if (bestIdx < 0) return null;
  const picked = props.splice(bestIdx, 1)[0];
  f.weaponDisarmed = false;
  return picked;
}

/** Tekken Colosseum/building Wall-Splat when a staggered victim slams into a boundary under heavy knockback. */
export function checkWallSplat(f: Fighter, limitRadius: number): boolean {
  if (f.state !== 'stagger' || f.wallSplat > 0) return false;
  if (Math.hypot(f.kx, f.kz) > 4.2 && Math.hypot(f.x, f.z) >= limitRadius - 0.15) {
    f.wallSplat = 1.6;
    f.dazed = 2.8;
    f.hp = Math.max(1, f.hp - 8);
    f.stagger = Math.max(f.stagger, 1.35);
    return true;
  }
  return false;
}

/** Checks if `v` is currently vulnerable to an `[E]` Execution Finisher. */
export const canExecuteTarget = (v: Fighter): boolean =>
  v.state !== 'dead' && (v.dazed > 0 || (v.state === 'stagger' && v.hp <= v.maxHp * 0.38));

/** Perform a visceral `[E]` Execution Finisher on the closest dazed/broken foe within 4.2m, restoring +22% HP & +35 stamina. */
export function tryExecute(a: Fighter, victims: Fighter[]): HitEvent | null {
  if (a.state === 'dead' || isDisarmedOf(a)) return null;
  let target: Fighter | null = null;
  let bestD = 4.2;
  for (const v of victims) {
    if (v.team === a.team || !canExecuteTarget(v)) continue;
    const d = Math.hypot(v.x - a.x, v.z - a.z);
    if (d <= bestD) {
      bestD = d;
      target = v;
    }
  }
  if (!target) return null;

  const dx = target.x - a.x;
  const dz = target.z - a.z;
  const d = Math.hypot(dx, dz) || 1e-6;
  const ux = dx / d;
  const uz = dz / d;

  const finisherChoreo = finisherChoreoForWeapon(gearOf(a).visuals.weapon);
  a.x = target.x - ux * 1.2;
  a.z = target.z - uz * 1.2;
  a.yaw = Math.atan2(ux, uz);
  a.state = 'recover';
  a.atk = 'heavy';
  a.finisherChoreo = finisherChoreo;
  a.finisherT = 0.65;
  a.t = 0;
  a.blocking = false;
  a.parryHold = 0;
  a.riposte = 0;
  a.riposteActive = false;
  a.iframes = 0.35;
  a.hp = Math.min(a.maxHp, a.hp + Math.round(a.maxHp * 0.22));
  a.stamina = Math.min(a.maxStamina, a.stamina + 35);

  target.hp = 0;
  target.state = 'dead';
  target.dazed = 0;
  target.atk = null;
  target.blocking = false;
  target.limbs.head.hp = 0;
  target.limbs.head.severed = true;
  target.kx += ux * 16;
  target.kz += uz * 16;

  return {
    type: 'kill',
    attacker: a.id,
    victim: target.id,
    dmg: 99,
    heavy: true,
    atk: 'heavy',
    dx: ux,
    dz: uz,
    x: target.x,
    z: target.z,
    zone: 'head',
    broken: 'head',
    severed: 'head',
    decap: true,
    riposte: true,
    finisherChoreo,
  };
}

interface AiStyleProfile {
  idealDist: number;
  dodgeRate: number;
  blockRate: number;
  parryRate: number;
  comboRate: number;
  heavyRate: number;
  bashRate: number;
  agile: boolean;
}

const AI_PROFILE: Record<StyleId, AiStyleProfile> = {
  murmillo:    { idealDist: 2.3, dodgeRate: 0.32, blockRate: 0.50, parryRate: 0.32, comboRate: 0.62, heavyRate: 0.25, bashRate: 0.48, agile: false },
  dimachaerus: { idealDist: 2.1, dodgeRate: 0.62, blockRate: 0.18, parryRate: 0.36, comboRate: 0.85, heavyRate: 0.28, bashRate: 0.18, agile: true },
  executioner: { idealDist: 2.7, dodgeRate: 0.18, blockRate: 0.28, parryRate: 0.12, comboRate: 0.45, heavyRate: 0.62, bashRate: 0.40, agile: false },
  retiarius:   { idealDist: 3.4, dodgeRate: 0.56, blockRate: 0.15, parryRate: 0.24, comboRate: 0.55, heavyRate: 0.38, bashRate: 0.18, agile: true },
  hoplomachus: { idealDist: 3.1, dodgeRate: 0.36, blockRate: 0.52, parryRate: 0.44, comboRate: 0.52, heavyRate: 0.48, bashRate: 0.28, agile: false },
};

/** Tactical Gladiator AI. Reads telegraphs cleanly, dodges, parries, punishes turtling, chains combos, and flanks. */
export function aiIntent(f: Fighter, target: Fighter, dt: number, allies?: Fighter[]): Intent {
  const cfg = f.stats.ai!;
  const st = gearOf(f);
  const prof = AI_PROFILE[f.style] ?? AI_PROFILE.murmillo;
  const ai = f.ai;
  const it: Intent = { moveX: 0, moveZ: 0, light: false, heavy: false, bash: false, block: false, parry: false, dodge: false };
  if (target.state === 'dead') return it;

  const dx = target.x - f.x, dz = target.z - f.z, d = Math.hypot(dx, dz) || 1e-6;
  const fx = dx / d, fz = dz / d;
  const rx = -fz, rz = fx;
  const disarmed = isDisarmedOf(f);
  const canBlock = canBlockOf(f);
  const canDodge = f.limbs.legL.hp > 0 && f.limbs.legR.hp > 0 && f.snared <= 0 && f.stamina >= dodgeCostOf(f);
  const reach = ATTACKS.light.reach * st.reachMul + target.stats.radius;

  ai.reactCd = Math.max(0, ai.reactCd - dt);
  ai.punishTimer = Math.max(0, ai.punishTimer - dt);
  ai.strafeTimer -= dt;
  if (ai.strafeTimer <= 0) {
    ai.strafe = Math.random() < 0.5 ? 1 : -1;
    ai.strafeTimer = 1.2 + Math.random() * 1.4;
  }
  if (target.blocking && d < prof.idealDist + 1.5) ai.targetBlockT += dt;
  else ai.targetBlockT = Math.max(0, ai.targetBlockT - dt * 1.6);

  if (target.state !== 'windup') ai.reactedAtk = false;

  // Nidhogg dynamic High / Mid / Low guard shifting & reactive flick-parry
  if (target.state === 'windup' && d < reach + 1.4 && f.state === 'idle' && !ai.reactedAtk && Math.random() < prof.parryRate * 0.45) {
    const incomingH: StanceHeight = target.diveKicking
      ? 'high'
      : target.guardHeight !== 'mid'
        ? target.guardHeight
        : target.atk === 'heavy' ? 'high' : target.atk === 'light3' || target.atk === 'bash' ? 'low' : 'mid';
    it.stance = incomingH;
  } else if (ai.strafeTimer <= 0.04) {
    const roll = Math.random();
    it.stance = roll < 0.34 ? 'high' : roll < 0.68 ? 'mid' : 'low';
  }

  // Immediate riposte after a successful AI parry!
  if (f.riposte > 0 && f.state === 'idle' && !disarmed && d < reach + 1.1) {
    ai.comboLeft = 1;
    if (f.stamina >= ATTACKS.heavy.stamina && Math.random() < 0.45) it.heavy = true;
    else if (f.stamina >= ATTACKS.light.stamina) it.light = true;
    return it;
  }

  // Agile fighters dodge-cancel out of recovery if the player swings at them
  if (prof.agile && f.state === 'recover' && target.state === 'windup' && !ai.reactedAtk && canDodge && d < 3.8) {
    ai.reactedAtk = true;
    ai.reactCd = 0.45;
    if (Math.random() < prof.dodgeRate * 0.78) {
      it.dodge = true;
      it.moveX = rx * ai.strafe * 0.85 - fx * 0.45;
      it.moveZ = rz * ai.strafe * 0.85 - fz * 0.45;
      ai.punishTimer = 0.85;
      return it;
    }
  }

  // Chain multi-hit combos during active strike/recover frames
  if (!disarmed && (f.state === 'strike' || f.state === 'recover') && (f.atk === 'light' || f.atk === 'light2') && ai.comboLeft > 0 && !f.queuedAtk && d < reach + 1.15) {
    const finHeavy = (st.heavyBreaksBlock || st.dualWield) && f.comboStep === 1 && Math.random() < 0.35;
    const cost = finHeavy ? ATTACKS.heavy.stamina : ATTACKS.light2.stamina;
    if (f.stamina >= cost) {
      ai.comboLeft--;
      if (finHeavy) it.heavy = true; else it.light = true;
      return it;
    }
  }

  if (f.state !== 'idle') return it;
  ai.timer += dt;

  // Continue short held guard if active
  if (canBlock && ai.blockTimer > 0) {
    ai.blockTimer = Math.max(0, ai.blockTimer - dt);
    it.block = true;
    const radial = clamp1((d - prof.idealDist) * 0.5);
    it.moveX = fx * radial + rx * ai.strafe * 0.55;
    it.moveZ = fz * radial + rz * ai.strafe * 0.55;
    return it;
  }

  // Deliberate one-shot defensive read against incoming player windup
  if (target.state === 'windup' && d < Math.max(3.6, reach + 0.9) && !ai.reactedAtk && ai.reactCd <= 0) {
    ai.reactedAtk = true;
    ai.reactCd = 0.48;
    const isHeavyThreat = target.atk === 'heavy' || target.atk === 'bash' || target.atk === 'light3';
    const dodgeProb = isHeavyThreat ? Math.min(0.88, prof.dodgeRate * 1.4) : prof.dodgeRate;
    const r = Math.random();
    if (canDodge && r < dodgeProb) {
      const backBias = st.netHeavy || st.moves.heavy.motion === 'thrust' ? 0.65 : 0.25;
      it.dodge = true;
      it.moveX = rx * ai.strafe - fx * backBias;
      it.moveZ = rz * ai.strafe - fz * backBias;
      ai.punishTimer = 0.9;
      return it;
    }
    if (canBlock && !isHeavyThreat && f.stamina > 18 && r < dodgeProb + prof.blockRate) {
      if (Math.random() < prof.parryRate && f.parryCd <= 0) {
        it.parry = true;
        return it;
      }
      ai.blockTimer = 0.45;
      it.block = true;
      return it;
    }
  }

  // Low stamina recovery phase
  if (f.stamina < 20) ai.mode = 'recoverStam';
  else if (ai.mode === 'recoverStam' && f.stamina >= 44) ai.mode = 'duel';

  if (ai.mode === 'recoverStam') {
    const rad = d < prof.idealDist + 1.4 ? -0.75 : 0.2;
    it.moveX = fx * rad + rx * ai.strafe * 0.7;
    it.moveZ = fz * rad + rz * ai.strafe * 0.7;
    return it;
  }

  // Multi-enemy flank separation & turn pacing
  let flankX = 0, flankZ = 0, allyBusy = false;
  if (allies && allies.length > 1) {
    for (const o of allies) {
      if (o === f || o.state === 'dead' || o.team !== f.team) continue;
      if (o.state === 'windup' || o.state === 'strike') allyBusy = true;
      const ox = f.x - o.x, oz = f.z - o.z, od = Math.hypot(ox, oz) || 1;
      if (od < 3.4) {
        const push = (3.4 - od) / 3.4;
        flankX += (ox / od) * push * 0.7;
        flankZ += (oz / od) * push * 0.7;
      }
    }
  }

  const windowOpen = ai.punishTimer > 0 || target.state === 'stagger' || target.state === 'recover' || target.snared > 0;
  const engage = prof.idealDist;

  if (d > engage + 1.65) {
    ai.mode = 'approach';
    it.moveX = fx + rx * ai.strafe * 0.2 + flankX;
    it.moveZ = fz + rz * ai.strafe * 0.2 + flankZ;
  } else if (windowOpen) {
    ai.mode = 'punish';
    const closeBias = d > reach * 0.85 ? 0.95 : 0.15;
    it.moveX = fx * closeBias + rx * ai.strafe * 0.35 + flankX;
    it.moveZ = fz * closeBias + rz * ai.strafe * 0.35 + flankZ;
  } else {
    ai.mode = 'duel';
    const radial = clamp1((d - engage) * 0.95);
    it.moveX = fx * radial + rx * ai.strafe * 0.85 + flankX;
    it.moveZ = fz * radial + rz * ai.strafe * 0.85 + flankZ;
  }

  if (disarmed) {
    if (ai.timer > ai.next && d < 2.2 && f.stamina >= ATTACKS.bash.stamina) {
      it.bash = true;
      ai.timer = 0;
      ai.next = cfg.attackEvery[0] + Math.random() * (cfg.attackEvery[1] - cfg.attackEvery[0]);
    }
    return it;
  }

  // Retiarius nets targets at mid-range before closing to skewer
  if (st.netHeavy && target.snared <= 0 && d >= 2.1 && d <= 4.5 && ai.timer > ai.next * 0.85 && f.stamina >= ATTACKS.heavy.stamina) {
    it.heavy = true;
    ai.timer = 0;
    ai.next = cfg.attackEvery[0] + Math.random() * (cfg.attackEvery[1] - cfg.attackEvery[0]);
    return it;
  }

  // Anti-turtle: punish sustained blocking with bash or Executioner overhead crush
  if (ai.targetBlockT > 0.42 && d < reach + 0.85 && ai.timer > 0.32) {
    const breakMove: Atk = st.heavyBreaksBlock && f.stamina >= ATTACKS.heavy.stamina ? 'heavy' : 'bash';
    if (f.stamina >= ATTACKS[breakMove].stamina && Math.random() < prof.bashRate + 0.35) {
      if (breakMove === 'heavy') it.heavy = true; else it.bash = true;
      ai.targetBlockT = 0;
      ai.timer = 0;
      ai.next = cfg.attackEvery[0] + Math.random() * (cfg.attackEvery[1] - cfg.attackEvery[0]);
      return it;
    }
  }

  const readyAt = allyBusy ? ai.next + 0.35 : windowOpen ? Math.min(ai.next, 0.38) : ai.next;
  const maxStrikeDist = st.reachMul >= 1.2 ? reach + 1.0 : reach + 0.75;
  if (ai.timer >= readyAt && d <= maxStrikeDist) {
    const r = Math.random();
    const hvyDist = st.moves.heavy.motion === 'thrust' ? reach + 1.4 : maxStrikeDist;
    const chooseHeavy = r < Math.max(cfg.heavyChance, prof.heavyRate) && d <= hvyDist && f.stamina >= ATTACKS.heavy.stamina;
    const chooseBash = !chooseHeavy && r > 0.88 && d < 2.25 && f.stamina >= ATTACKS.bash.stamina;
    if (f.airY === 0 && prof.agile && r > 0.78 && r <= 0.85 && f.stamina > 30) {
      it.jump = true;
    } else if (chooseHeavy) {
      it.heavy = true;
    } else if (chooseBash) {
      it.bash = true;
    } else if (f.stamina >= ATTACKS.light.stamina) {
      it.light = true;
      ai.comboLeft = Math.random() < prof.comboRate ? (Math.random() < 0.45 ? 2 : 1) : 0;
    }
    ai.timer = 0;
    ai.punishTimer = 0;
    ai.next = cfg.attackEvery[0] + Math.random() * (cfg.attackEvery[1] - cfg.attackEvery[0]);
  }
  return it;
}
