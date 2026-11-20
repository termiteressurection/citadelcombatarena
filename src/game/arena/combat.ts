/** Pure combat rules. No rendering, no physics: everything here is unit-tested. */
import { moveOf, styleOf, type ArmorKey, type StyleDef, type StyleId } from './styles';

export type Kind = 'player' | 'skirmisher' | 'brute' | 'champion';
export type State = 'idle' | 'windup' | 'strike' | 'recover' | 'dodge' | 'stagger' | 'dead';
export type Atk = 'light' | 'light2' | 'light3' | 'heavy' | 'bash';

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

export function makeArmor(style: StyleDef): Armor {
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
}
export const defaultMods = (): Mods => ({
  dmg: 1, heavyDmg: 1, stamRegen: 1, speed: 1, healOnKill: 0, thorns: 0, parryWindow: 0, dodgeCost: 0, blockStam: 0, maxHp: 0, maxStamina: 0, glory: 1,
});
export const dodgeCostOf = (f: Fighter) => Math.max(4, DODGE_COST - f.mods.dodgeCost);
export const parryWindowOf = (f: Fighter) => PARRY_WINDOW + f.mods.parryWindow + styleOf(f.style).parryBonus;

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

export interface Fighter {
  id: number; kind: Kind; style: StyleId; team: 'p' | 'e'; stats: Stats;
  x: number; z: number; vx: number; vz: number; yaw: number;
  hp: number; maxHp: number; stamina: number; maxStamina: number; staminaDelay: number;
  limbs: Limbs;
  armor: Armor;
  snared: number;
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
}
export const NO_INTENT: Intent = { moveX: 0, moveZ: 0, light: false, heavy: false, bash: false, block: false, parry: false, dodge: false };

export type HitType = 'hit' | 'block' | 'parry' | 'guardBreak' | 'kill';
export interface HitEvent {
  type: HitType; attacker: number; victim: number; dmg: number; heavy: boolean; atk: Atk;
  dx: number; dz: number; x: number; z: number;
  zone: LimbKey; broken?: LimbKey; severed?: LimbKey; decap?: boolean;
  armorBroken?: ArmorKey; snared?: boolean; riposte?: boolean;
}

export function makeFighter(id: number, kind: Kind, x: number, z: number, mods: Mods = defaultMods(), style?: StyleId): Fighter {
  const stats = KINDS[kind];
  const resolvedStyle = style ?? DEFAULT_STYLE[kind];
  const stDef = styleOf(resolvedStyle);
  const maxHp = stats.hp + mods.maxHp;
  return {
    id, kind, style: resolvedStyle, team: kind === 'player' ? 'p' : 'e', stats, x, z, vx: 0, vz: 0, yaw: 0,
    hp: maxHp, maxHp, stamina: stats.stamina + mods.maxStamina, maxStamina: stats.stamina + mods.maxStamina, staminaDelay: 0,
    limbs: makeLimbs(maxHp),
    armor: makeArmor(stDef),
    snared: 0,
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

export function canBlockOf(f: Fighter): boolean {
  const st = styleOf(f.style);
  if (st.hasShield) return f.limbs.armL.hp > 0 && !f.limbs.armL.severed;
  if (st.dualWield) return f.limbs.armL.hp > 0 && !f.limbs.armL.severed && f.limbs.armR.hp > 0 && !f.limbs.armR.severed;
  return f.limbs.armR.hp > 0 && !f.limbs.armR.severed;
}

export function isDisarmedOf(f: Fighter): boolean {
  const st = styleOf(f.style);
  return st.dualWield ? (f.limbs.armR.severed && f.limbs.armL.severed) : f.limbs.armR.severed;
}

const isArmWeak = (f: Fighter): boolean => {
  const st = styleOf(f.style);
  if (isDisarmedOf(f)) return false;
  return f.limbs.armR.hp <= 0 || (st.dualWield && f.limbs.armL.hp <= 0);
};

export function windupOf(f: Fighter, a: Atk): number {
  const st = styleOf(f.style);
  const mv = moveOf(f.style, a);
  const crippledArm = isArmWeak(f) ? 1.25 : 1;
  const riposteSpeed = f.riposteActive || f.riposte > 0 ? 0.68 : 1;
  const raw = ATTACKS[a].windup * f.stats.windupMul * st.windupMul * (mv.windupMul ?? 1) * crippledArm * riposteSpeed;
  return f.team === 'e' ? Math.max(0.4, raw) : raw;
}
const clamp1 = (v: number) => Math.max(-1, Math.min(1, v));

export function pickTargetZone(atk: Atk, v: Fighter): LimbKey {
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
  f.parryHold = 0; f.riposteActive = false;
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
  f.parryHold = 0; f.riposteActive = false;
  f.comboStep = 0; f.comboTimer = 0; f.queuedAtk = null;
}

/** Advance one fighter by dt. `target` is who it faces. Returns true on the tick the strike lands (hit frame). */
export function stepFighter(f: Fighter, i: Intent, dt: number, target: Fighter | null): boolean {
  if (f.state === 'dead') return false;
  let strikeFrame = false;
  const st = styleOf(f.style);
  const disarmed = isDisarmedOf(f);
  const canBlock = canBlockOf(f);

  f.facingTarget = target !== null;
  f.iframes = Math.max(0, f.iframes - dt);
  f.snared = Math.max(0, f.snared - dt);
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
      f.yaw += d * (1 - Math.exp(-12 * dt));
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
  const canDodge = brokenLegs === 0 && f.snared <= 0 && f.stamina >= dodgeCostOf(f);

  let speedMul = 1;
  switch (f.state) {
    case 'stagger':
      speedMul = 0;
      if (f.t >= f.stagger) { f.state = 'idle'; f.t = 0; }
      break;
    case 'dodge':
      f.vx = f.dodgeX * DODGE_SPEED; f.vz = f.dodgeZ * DODGE_SPEED;
      if (f.t >= DODGE_TIME) { f.state = 'idle'; f.t = 0; f.iframes = 0; }
      break;
    case 'windup': {
      speedMul = 0.35;
      const wt = windupOf(f, f.atk!);
      if (i.parry && f.t < wt * 0.45 && canBlock && f.parryCd <= 0 && f.stamina > 1) {
        enterParry(f);
        speedMul = 0.5;
        break;
      }
      if (f.t >= wt) {
        const at = ATTACKS[f.atk!];
        const mv = moveOf(f.style, f.atk!);
        f.state = 'strike'; f.t = 0; strikeFrame = true;
        f.kx += Math.sin(f.yaw) * at.lunge * st.lungeMul * (mv.lungeMul ?? 1) * legSpeedMul;
        f.kz += Math.cos(f.yaw) * at.lunge * st.lungeMul * (mv.lungeMul ?? 1) * legSpeedMul;
      }
      break;
    }
    case 'strike':
      speedMul = 0.2;
      if (f.t >= ATTACKS[f.atk!].strike) { f.state = 'recover'; f.t = 0; }
      break;
    case 'recover': {
      speedMul = 0.5;
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
    const tx = (i.moveX / len) * sp, tz = (i.moveZ / len) * sp;
    const a = 1 - Math.exp(-14 * dt);
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
  const st = styleOf(a.style);
  const mv = moveOf(a.style, a.atk);
  const heavy = a.atk === 'heavy';
  const armMul = isArmWeak(a) ? 0.65 : 1;
  const riposteHit = a.riposteActive;
  const reach = st.netHeavy && heavy ? 4.6 : at.reach * st.reachMul * (mv.reachMul ?? 1);
  const half = mv.half ?? at.half;
  const knock = at.knock * st.knockMul * (mv.knockMul ?? 1);
  const isBlunt = st.blunt || Boolean(at.guardBreak);

  for (const v of victims) {
    if (v.state === 'dead' || v.team === a.team || v.iframes > 0) continue;
    const dx = v.x - a.x, dz = v.z - a.z, d = Math.hypot(dx, dz) || 1e-6;
    if (d > reach + v.stats.radius) continue;
    const ang = Math.atan2(dx, dz) - a.yaw;
    if (Math.abs(Math.atan2(Math.sin(ang), Math.cos(ang))) > half) continue;
    const ux = dx / d, uz = dz / d;
    const dmg = at.dmg * a.stats.dmgMul * st.dmgMul * (mv.dmgMul ?? 1) * a.mods.dmg * (heavy ? a.mods.heavyDmg : 1) * armMul * (riposteHit ? RIPOSTE_DMG_MUL : 1);
    const base = { attacker: a.id, victim: v.id, heavy, atk: a.atk, dx: ux, dz: uz, x: (a.x + v.x) / 2, z: (a.z + v.z) / 2 };

    // blocking & parry: defender must be able to block and face the attacker
    const vst = styleOf(v.style);
    const canBlock = canBlockOf(v);
    const faceAng = Math.atan2(-dx, -dz) - v.yaw;
    const facing = Math.abs(Math.atan2(Math.sin(faceAng), Math.cos(faceAng))) <= BLOCK_ARC;
    if (canBlock && v.blocking && v.state === 'idle' && facing) {
      let armorBroken: ArmorKey | undefined;
      if (at.guardBreak) {
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
        out.push({ ...base, type: 'guardBreak', dmg, zone: 'armL', armorBroken });
      } else if (v.blockT <= parryWindowOf(v)) {
        stagger(a, 1.35);
        a.stamina = Math.max(0, a.stamina - 35);
        a.staminaDelay = 1.2;
        v.stamina = Math.min(v.maxStamina, v.stamina + 25);
        v.riposte = RIPOSTE_WINDOW;
        v.parryCd = 0;
        v.parryHold = 0;
        out.push({ ...base, type: 'parry', dmg: 0, zone: 'armL' });
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

    const zone = pickTargetZone(a.atk, v);
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

    v.kx += ux * knock; v.kz += uz * knock;
    if (v.hp <= 0) {
      v.hp = 0; v.state = 'dead'; v.atk = null; v.blocking = false; v.parryHold = 0; v.riposteActive = false;
      out.push({ ...base, type: 'kill', dmg, zone, broken, severed, decap, armorBroken, snared, riposte: riposteHit || undefined });
    } else {
      stagger(v, broken ? 0.65 : heavy ? 0.45 : at.guardBreak ? 0.35 : 0.18);
      out.push({ ...base, type: 'hit', dmg, zone, broken, severed, armorBroken, snared, riposte: riposteHit || undefined });
    }
  }
  a.riposteActive = false;
  return out;
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
  const st = styleOf(f.style);
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
    const finHeavy = (f.style === 'executioner' || f.style === 'dimachaerus') && f.comboStep === 1 && Math.random() < 0.35;
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
      const backBias = f.style === 'retiarius' || f.style === 'hoplomachus' ? 0.65 : 0.25;
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
    const hvyDist = f.style === 'hoplomachus' ? reach + 1.4 : maxStrikeDist;
    const chooseHeavy = r < Math.max(cfg.heavyChance, prof.heavyRate) && d <= hvyDist && f.stamina >= ATTACKS.heavy.stamina;
    const chooseBash = !chooseHeavy && r > 0.88 && d < 2.25 && f.stamina >= ATTACKS.bash.stamina;
    if (chooseHeavy) {
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
