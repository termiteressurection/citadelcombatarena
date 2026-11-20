/** Pure combat rules. No rendering, no physics: everything here is unit-tested. */

export type Kind = 'player' | 'skirmisher' | 'brute' | 'champion';
export type State = 'idle' | 'windup' | 'strike' | 'recover' | 'dodge' | 'stagger' | 'dead';
export type Atk = 'light' | 'light2' | 'light3' | 'heavy' | 'bash';

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
  guardBreak?: boolean;
}

export const ATTACKS: Record<Atk, Attack> = {
  light:  { windup: 0.2,  strike: 0.1,  recover: 0.26, dmg: 12, stamina: 12, reach: 2.45, half: Math.PI / 3,   knock: 4.5,  lunge: 4.5 },
  light2: { windup: 0.16, strike: 0.1,  recover: 0.26, dmg: 14, stamina: 12, reach: 2.55, half: Math.PI / 2.7, knock: 5.5,  lunge: 5.2 },
  light3: { windup: 0.24, strike: 0.12, recover: 0.42, dmg: 22, stamina: 16, reach: 2.8,  half: Math.PI / 2.5, knock: 10,   lunge: 7.5 },
  heavy:  { windup: 0.5,  strike: 0.12, recover: 0.52, dmg: 30, stamina: 26, reach: 2.8,  half: Math.PI / 3,   knock: 13.5, lunge: 6.5 },
  bash:   { windup: 0.18, strike: 0.1,  recover: 0.34, dmg: 5,  stamina: 14, reach: 2.1,  half: Math.PI / 3.2, knock: 8,    lunge: 5.5, guardBreak: true },
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
    ai: { dist: 3.2, attackEvery: [1.0, 2.0], heavyChance: 0, dodgeChance: 0.35, blockChance: 0.15 } },
  brute: { name: 'BRUTE', hp: 140, stamina: 120, speed: 3.2, dmgMul: 1.1, windupMul: 2.1, radius: 0.75, color: '#ff4fd8',
    ai: { dist: 2.4, attackEvery: [1.4, 2.6], heavyChance: 0.7, dodgeChance: 0, blockChance: 0.35 } },
  champion: { name: 'CHAMPION', hp: 220, stamina: 160, speed: 4.4, dmgMul: 1.15, windupMul: 2.05, radius: 0.65, color: '#ffc95c',
    ai: { dist: 2.8, attackEvery: [0.9, 1.8], heavyChance: 0.4, dodgeChance: 0.2, blockChance: 0.45 } },
};

export const DODGE_TIME = 0.35;
export const DODGE_IFRAMES = 0.25;
export const DODGE_SPEED = 11;
export const DODGE_COST = 20;
export const PARRY_WINDOW = 0.18;
export const BLOCK_ARC = (70 * Math.PI) / 180;

export interface Mods {
  dmg: number; heavyDmg: number; stamRegen: number; speed: number; healOnKill: number; thorns: number;
  parryWindow: number; dodgeCost: number; blockStam: number; maxHp: number; maxStamina: number; glory: number;
}
export const defaultMods = (): Mods => ({
  dmg: 1, heavyDmg: 1, stamRegen: 1, speed: 1, healOnKill: 0, thorns: 0, parryWindow: 0, dodgeCost: 0, blockStam: 0, maxHp: 0, maxStamina: 0, glory: 1,
});
export const dodgeCostOf = (f: Fighter) => Math.max(4, DODGE_COST - f.mods.dodgeCost);

export interface Fighter {
  id: number; kind: Kind; team: 'p' | 'e'; stats: Stats;
  x: number; z: number; vx: number; vz: number; yaw: number;
  hp: number; maxHp: number; stamina: number; maxStamina: number; staminaDelay: number;
  state: State; atk: Atk | null; t: number; stagger: number;
  blocking: boolean; blockT: number; iframes: number;
  dodgeX: number; dodgeZ: number; kx: number; kz: number;
  comboStep: 0 | 1 | 2 | 3; comboTimer: number; queuedAtk: Atk | null;
  localVx: number; localVz: number; facingTarget: boolean;
  dodgeLocalX: number; dodgeLocalZ: number;
  mods: Mods;
  ai: { mode: 'circle' | 'approach' | 'retreat'; timer: number; strafe: 1 | -1; next: number; wantAttack: Atk | null; blockTimer: number };
}

export interface Intent { moveX: number; moveZ: number; light: boolean; heavy: boolean; bash: boolean; block: boolean; dodge: boolean }
export const NO_INTENT: Intent = { moveX: 0, moveZ: 0, light: false, heavy: false, bash: false, block: false, dodge: false };

export type HitType = 'hit' | 'block' | 'parry' | 'guardBreak' | 'kill';
export interface HitEvent { type: HitType; attacker: number; victim: number; dmg: number; heavy: boolean; atk: Atk; dx: number; dz: number; x: number; z: number }

export function makeFighter(id: number, kind: Kind, x: number, z: number, mods: Mods = defaultMods()): Fighter {
  const stats = KINDS[kind];
  return {
    id, kind, team: kind === 'player' ? 'p' : 'e', stats, x, z, vx: 0, vz: 0, yaw: 0,
    hp: stats.hp + mods.maxHp, maxHp: stats.hp + mods.maxHp, stamina: stats.stamina + mods.maxStamina, maxStamina: stats.stamina + mods.maxStamina, staminaDelay: 0,
    state: 'idle', atk: null, t: 0, stagger: 0, blocking: false, blockT: 0, iframes: 0,
    dodgeX: 0, dodgeZ: 0, kx: 0, kz: 0,
    comboStep: 0, comboTimer: 0, queuedAtk: null,
    localVx: 0, localVz: 0, facingTarget: false,
    dodgeLocalX: 0, dodgeLocalZ: 0,
    mods,
    ai: { mode: 'approach', timer: 0, strafe: Math.random() < 0.5 ? 1 : -1, next: 1 + Math.random(), wantAttack: null, blockTimer: 0 },
  };
}

const wind = (f: Fighter, a: Atk) => ATTACKS[a].windup * f.stats.windupMul;
const clamp1 = (v: number) => Math.max(-1, Math.min(1, v));

export function startAttack(f: Fighter, a: Atk): boolean {
  if (f.state !== 'idle') return false;
  const at = ATTACKS[a];
  if (f.stamina < at.stamina) return false;
  f.stamina -= at.stamina; f.staminaDelay = 0.7;
  f.state = 'windup'; f.atk = a; f.t = 0; f.blocking = false; f.queuedAtk = null;
  f.comboStep = a === 'light' ? 1 : a === 'light2' ? 2 : a === 'light3' ? 3 : 0;
  f.comboTimer = a === 'light' || a === 'light2' ? 0.5 : 0;
  return true;
}

export function stagger(f: Fighter, dur: number): void {
  if (f.state === 'dead') return;
  f.state = 'stagger'; f.stagger = dur; f.t = 0; f.atk = null; f.blocking = false;
  f.comboStep = 0; f.comboTimer = 0; f.queuedAtk = null;
}

/** Advance one fighter by dt. `target` is who it faces. Returns true on the tick the strike lands (hit frame). */
export function stepFighter(f: Fighter, i: Intent, dt: number, target: Fighter | null): boolean {
  if (f.state === 'dead') return false;
  let strikeFrame = false;
  f.facingTarget = target !== null;
  f.iframes = Math.max(0, f.iframes - dt);
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
    if (i.light) f.queuedAtk = f.atk === 'light' ? 'light2' : 'light3';
    else if (i.heavy) f.queuedAtk = 'heavy';
    else if (i.bash) f.queuedAtk = 'bash';
  }

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
    case 'windup':
      speedMul = 0.35;
      if (f.t >= wind(f, f.atk!)) {
        const at = ATTACKS[f.atk!];
        f.state = 'strike'; f.t = 0; strikeFrame = true;
        f.kx += Math.sin(f.yaw) * at.lunge;
        f.kz += Math.cos(f.yaw) * at.lunge;
      }
      break;
    case 'strike':
      speedMul = 0.2;
      if (f.t >= ATTACKS[f.atk!].strike) { f.state = 'recover'; f.t = 0; }
      break;
    case 'recover':
      speedMul = 0.5;
      if (f.queuedAtk && f.t >= ATTACKS[f.atk!].recover * 0.45 && f.stamina >= ATTACKS[f.queuedAtk].stamina) {
        const next = f.queuedAtk;
        f.state = 'idle'; f.atk = null; f.queuedAtk = null;
        startAttack(f, next);
      } else if (f.t >= ATTACKS[f.atk!].recover) {
        f.state = 'idle'; f.atk = null; f.t = 0; f.queuedAtk = null;
      }
      break;
    case 'idle': {
      const wantBlock = i.block && f.stamina > 1;
      if (wantBlock && !f.blocking) f.blockT = 0;
      f.blocking = wantBlock;
      if (f.blocking) f.blockT += dt;
      if (i.dodge && f.stamina >= dodgeCostOf(f)) {
        const len = Math.hypot(i.moveX, i.moveZ);
        f.dodgeX = len > 0.1 ? i.moveX / len : -Math.sin(f.yaw);
        f.dodgeZ = len > 0.1 ? i.moveZ / len : -Math.cos(f.yaw);
        const fwdX = Math.sin(f.yaw), fwdZ = Math.cos(f.yaw);
        const rightX = Math.cos(f.yaw), rightZ = -Math.sin(f.yaw);
        f.dodgeLocalZ = f.dodgeX * fwdX + f.dodgeZ * fwdZ;
        f.dodgeLocalX = f.dodgeX * rightX + f.dodgeZ * rightZ;
        f.stamina -= dodgeCostOf(f); f.staminaDelay = 0.6;
        f.state = 'dodge'; f.t = 0; f.iframes = DODGE_IFRAMES; f.blocking = false;
        f.comboStep = 0; f.comboTimer = 0; f.queuedAtk = null;
      } else if (!f.blocking && i.bash) {
        startAttack(f, 'bash');
      } else if (!f.blocking && i.heavy) {
        startAttack(f, 'heavy');
      } else if (!f.blocking && i.light) {
        const next: Atk = f.comboTimer > 0 && f.comboStep === 1 ? 'light2' : f.comboTimer > 0 && f.comboStep === 2 ? 'light3' : 'light';
        startAttack(f, next);
      }
      if (f.blocking) speedMul = 0.5;
      break;
    }
  }
  if (f.state !== 'dodge') {
    const len = Math.hypot(i.moveX, i.moveZ) || 1;
    const sp = f.stats.speed * f.mods.speed * speedMul * Math.min(1, Math.hypot(i.moveX, i.moveZ));
    const tx = (i.moveX / len) * sp, tz = (i.moveZ / len) * sp;
    const a = 1 - Math.exp(-14 * dt);
    f.vx += (tx - f.vx) * a; f.vz += (tz - f.vz) * a;
  }
  f.x += (f.vx + f.kx) * dt; f.z += (f.vz + f.kz) * dt;

  const fwdX = Math.sin(f.yaw), fwdZ = Math.cos(f.yaw);
  const rightX = Math.cos(f.yaw), rightZ = -Math.sin(f.yaw);
  const maxSpd = f.stats.speed * f.mods.speed || 1;
  f.localVz = clamp1((f.vx * fwdX + f.vz * fwdZ) / maxSpd);
  f.localVx = clamp1((f.vx * rightX + f.vz * rightZ) / maxSpd);
  return strikeFrame;
}

/** Resolve the strike of `a` against `victims`. Mutates victims, returns events. */
export function resolveStrike(a: Fighter, victims: Fighter[]): HitEvent[] {
  const out: HitEvent[] = [];
  if (!a.atk) return out;
  const at = ATTACKS[a.atk];
  const heavy = a.atk === 'heavy';
  for (const v of victims) {
    if (v.state === 'dead' || v.team === a.team || v.iframes > 0) continue;
    const dx = v.x - a.x, dz = v.z - a.z, d = Math.hypot(dx, dz) || 1e-6;
    if (d > at.reach + v.stats.radius) continue;
    const ang = Math.atan2(dx, dz) - a.yaw;
    if (Math.abs(Math.atan2(Math.sin(ang), Math.cos(ang))) > at.half) continue;
    const ux = dx / d, uz = dz / d;
    const dmg = at.dmg * a.stats.dmgMul * a.mods.dmg * (heavy ? a.mods.heavyDmg : 1);
    const base = { attacker: a.id, victim: v.id, heavy, atk: a.atk, dx: ux, dz: uz, x: (a.x + v.x) / 2, z: (a.z + v.z) / 2 };

    // blocking: shield must face the attacker
    const faceAng = Math.atan2(-dx, -dz) - v.yaw;
    const facing = Math.abs(Math.atan2(Math.sin(faceAng), Math.cos(faceAng))) <= BLOCK_ARC;
    if (v.blocking && v.state === 'idle' && facing) {
      if (at.guardBreak) {
        v.blocking = false;
        v.stamina = Math.max(0, v.stamina - 30);
        v.staminaDelay = 1.2;
        v.hp = Math.max(1, v.hp - dmg);
        v.kx += ux * at.knock; v.kz += uz * at.knock;
        stagger(v, 0.95);
        out.push({ ...base, type: 'guardBreak', dmg });
      } else if (v.blockT <= PARRY_WINDOW + v.mods.parryWindow) {
        stagger(a, 0.9);
        v.stamina = Math.min(v.maxStamina, v.stamina + 15);
        out.push({ ...base, type: 'parry', dmg: 0 });
      } else {
        const chip = dmg * 0.15;
        v.hp = Math.max(1, v.hp - chip);
        v.stamina -= dmg * 0.9 * (1 - v.mods.blockStam); v.staminaDelay = 1;
        if (v.mods.thorns > 0) a.hp = Math.max(1, a.hp - v.mods.thorns);
        v.kx += ux * at.knock * 0.3; v.kz += uz * at.knock * 0.3;
        if (v.stamina <= 0) { v.stamina = 0; stagger(v, 0.7); }
        out.push({ ...base, type: 'block', dmg: chip });
      }
      continue;
    }
    v.hp -= dmg;
    v.kx += ux * at.knock; v.kz += uz * at.knock;
    if (v.hp <= 0) {
      v.hp = 0; v.state = 'dead'; v.atk = null; v.blocking = false;
      out.push({ ...base, type: 'kill', dmg });
    } else {
      stagger(v, heavy ? 0.45 : at.guardBreak ? 0.35 : 0.18);
      out.push({ ...base, type: 'hit', dmg });
    }
  }
  return out;
}

/** Enemy brain. Produces the same Intent a player would. */
export function aiIntent(f: Fighter, target: Fighter, dt: number): Intent {
  const cfg = f.stats.ai!;
  const ai = f.ai;
  const dx = target.x - f.x, dz = target.z - f.z, d = Math.hypot(dx, dz) || 1e-6;
  const fx = dx / d, fz = dz / d;
  const it: Intent = { moveX: 0, moveZ: 0, light: false, heavy: false, bash: false, block: false, dodge: false };
  if (target.state === 'dead' || f.state !== 'idle') return it;
  ai.timer += dt;

  if (ai.blockTimer > 0) {
    ai.blockTimer = Math.max(0, ai.blockTimer - dt);
    it.block = true;
    const radial = (d - cfg.dist) * 0.4;
    it.moveX = fx * radial - fz * ai.strafe * 0.5;
    it.moveZ = fz * radial + fx * ai.strafe * 0.5;
    return it;
  }

  // read the player's windup and sometimes dodge or block it
  if (target.state === 'windup' && d < 3.4) {
    if (cfg.dodgeChance > 0 && f.stamina >= dodgeCostOf(f) && Math.random() < cfg.dodgeChance * dt * 6) {
      it.dodge = true; it.moveX = -fz * ai.strafe; it.moveZ = fx * ai.strafe; return it;
    }
    if ((cfg.blockChance ?? 0) > 0 && f.stamina > 20 && Math.random() < (cfg.blockChance ?? 0) * dt * 5) {
      ai.blockTimer = 0.55;
      it.block = true;
      return it;
    }
  }

  if (ai.mode === 'retreat') {
    it.moveX = -fx; it.moveZ = -fz;
    if (ai.timer > 0.8) { ai.mode = 'circle'; ai.timer = 0; ai.strafe = Math.random() < 0.5 ? 1 : -1; ai.next = cfg.attackEvery[0] + Math.random() * (cfg.attackEvery[1] - cfg.attackEvery[0]); }
    return it;
  }
  if (d > cfg.dist + 1.6) { ai.mode = 'approach'; it.moveX = fx; it.moveZ = fz; return it; }
  ai.mode = 'circle';
  const radial = (d - cfg.dist) * 0.8;
  it.moveX = fx * radial + -fz * ai.strafe * 0.8;
  it.moveZ = fz * radial + fx * ai.strafe * 0.8;
  if ((cfg.blockChance ?? 0) > 0 && d < cfg.dist + 1.2 && ai.timer < ai.next * 0.7 && f.stamina > 30 && Math.random() < (cfg.blockChance ?? 0) * dt * 0.6) {
    ai.blockTimer = 0.5;
    it.block = true;
    return it;
  }
  if (ai.timer > ai.next && d < cfg.dist + 0.9) {
    const a: Atk = Math.random() < cfg.heavyChance ? 'heavy' : 'light';
    if (f.stamina >= ATTACKS[a].stamina) {
      if (a === 'heavy') it.heavy = true; else it.light = true;
      ai.mode = 'retreat'; ai.timer = 0;
    }
  }
  return it;
}
