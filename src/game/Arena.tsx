import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { Gladiator, type GladiatorHandle, type LimbPose } from './Gladiator';
import { SynthwaveHorizon } from './art/SynthwaveHorizon';
import Starfield from './art/Starfield';
import { DoricColumn } from './art/ClassicalColumns';
import {
  ATTACKS, DODGE_TIME, LIMB_KEYS, NO_INTENT, aiIntent, defaultMods, makeFighter, resolveStrike, stepFighter,
  type Fighter, type HitEvent, type Intent, type LimbKey,
} from './arena/combat';
import { ARENA_RADIUS, createArenaWorld, initPhysics, RAPIER } from './arena/physics';
import { PARTS, Ragdoll, SeveredPiece } from './arena/ragdoll';
import { DashGhosts, GhostPool, ShardPool, SlashPool, SlashRibbons } from './arena/effects';
import { fullLimbHud, toLimbHud, useArena, type LimbHud } from './arena/arenaStore';
import { drawBoons, modsFor } from './arena/boons';
import { CHAMPION_BONUS, boutRosterFor, carryHp, gloryForBout, isFinalBout, lookColor, type BoutEnemy } from './arena/run';
import { STYLE_IDS, styleOf, type ArmorKey, type StyleId } from './arena/styles';
import { keys, pressed } from './input';
import { useGame } from './store';

const KB_YAW_SENS = 0.06;
const CAM_DIST = 5.2, CAM_HEIGHT = 3.35 + 1.6, LOOK_AHEAD = 8.8, LOOK_HEIGHT = 1.6 + 1.55, CAM_LERP = 0.18;

const LIMB_Y: Record<LimbKey, number> = { head: 1.85, torso: 1.25, armL: 1.35, armR: 1.35, legL: 0.45, legR: 0.45 };

const sameLimbHud = (a: LimbHud, b: LimbHud): boolean =>
  LIMB_KEYS.every((k) => a[k].r === b[k].r && a[k].s === b[k].s);

interface ArenaWorld {
  bout: number;
  freed: boolean;
  phys: RAPIER.World;
  fighters: Fighter[];
  ragdolls: Ragdoll[];
  debris: SeveredPiece[];
  shards: ShardPool;
  slashes: SlashPool;
  ghosts: GhostPool;
  hitstop: number;
  shake: number;
  fovKick: number;
  time: number;
  acc: number;
  phase: 'intro' | 'fight' | 'victory' | 'defeat';
  phaseT: number;
  ragVersion: number;
  debrisVersion: number;
  buf: { light: number; heavy: number; bash: number; dodge: number };
  camFwd: THREE.Vector2;
  yaw: number;
  pitch: number;
  lockOn: boolean;
  lockedId: number | null;
  calloutId: number;
  settled: boolean;
}

function resolvePlayerStyle(saved: StyleId): StyleId {
  if (typeof location === 'undefined') return saved;
  const p = new URLSearchParams(location.search).get('style');
  return p && (STYLE_IDS as readonly string[]).includes(p) ? (p as StyleId) : saved;
}

function newWorld(bout: number, roster: BoutEnemy[], boons: string[], carry: number, carryMax: number, look: string, playerStyle: StyleId): ArenaWorld {
  const mods = modsFor(boons);
  const player = makeFighter(0, 'player', 0, 8, mods, playerStyle);
  player.stats = { ...player.stats, color: lookColor(look) };
  if (carry > 0) player.hp = Math.min(player.maxHp, carry + Math.max(0, player.maxHp - carryMax));
  const fighters = [player];
  roster.forEach((item, i) => {
    const e = makeFighter(i + 1, item.kind, (i - (roster.length - 1) / 2) * 4, -8, defaultMods(), item.style);
    e.stats = { ...e.stats, color: styleOf(item.style).color };
    fighters.push(e);
  });
  return {
    bout, freed: false,
    phys: createArenaWorld(), fighters, ragdolls: [], debris: [],
    shards: new ShardPool(), slashes: new SlashPool(), ghosts: new GhostPool(),
    hitstop: 0, shake: 0, fovKick: 0, time: 0, acc: 0,
    phase: 'intro', phaseT: 0, ragVersion: 0, debrisVersion: 0,
    buf: { light: 0, heavy: 0, bash: 0, dodge: 0 },
    camFwd: new THREE.Vector2(0, -1), yaw: 0, pitch: 0,
    lockOn: true, lockedId: fighters[1]?.id ?? null, calloutId: 0, settled: false,
  };
}

const nearestFoe = (f: Fighter, all: Fighter[]): Fighter | null => {
  let best: Fighter | null = null, bd = Infinity;
  for (const o of all) if (o.team !== f.team && o.state !== 'dead') { const d = Math.hypot(o.x - f.x, o.z - f.z); if (d < bd) { bd = d; best = o; } }
  return best;
};

const getLockedTarget = (w: ArenaWorld): Fighter | null => {
  if (!w.lockOn) return null;
  const f = w.fighters.find((x) => x.id === w.lockedId && x.team === 'e' && x.state !== 'dead');
  return f ?? nearestFoe(w.fighters[0], w.fighters);
};

function onHit(w: ArenaWorld, e: HitEvent) {
  const hud = useArena.getState();
  const v = w.fighters.find((f) => f.id === e.victim)!;
  const a = w.fighters.find((f) => f.id === e.attacker)!;
  const y = 1.3;
  if (e.type === 'parry') {
    w.hitstop = Math.max(w.hitstop, 0.16); w.shake = Math.max(w.shake, 0.55); w.fovKick = -7;
    w.shards.burst(e.x, y, e.z, 28, 9.5, '#ffc95c');
    w.slashes.spawn(e.x, e.z, 0, 'parry', '#ffc95c');
    hud.set({ callout: { text: 'PARRY!', color: '#ffc95c', id: ++w.calloutId } });
    return;
  }
  if (e.type === 'guardBreak') {
    w.hitstop = Math.max(w.hitstop, 0.14); w.shake = Math.max(w.shake, 0.5); w.fovKick = -5;
    w.shards.burst(e.x, y, e.z, 24, 8.5, '#3ff0ff', e.dx, e.dz);
    hud.set({ callout: { text: 'GUARD BREAK!', color: '#3ff0ff', id: ++w.calloutId } });
    return;
  }
  if (e.type === 'block') {
    w.hitstop = Math.max(w.hitstop, 0.05); w.shake = Math.max(w.shake, 0.18);
    w.shards.burst(e.x, y, e.z, 8, 5, '#a78bfa', e.dx, e.dz);
    return;
  }

  // Shattered armor debris & Retiarius net snare
  if (e.armorBroken) {
    w.debris.push(new SeveredPiece(w.phys, {
      kind: e.armorBroken, style: v.style, x: v.x, z: v.z, yaw: v.yaw,
      hitX: e.dx, hitZ: e.dz, hitSpeed: e.heavy ? 12 : 8, color: v.stats.color,
    }));
    w.debrisVersion++;
    w.shards.burst(v.x, e.armorBroken === 'helm' ? 1.9 : 1.4, v.z, 20, 8, '#ffc95c', e.dx, e.dz);
    w.fovKick = Math.min(w.fovKick, -4);
    const label = e.armorBroken === 'helm' ? 'HELM SHATTERED!' : e.armorBroken === 'shield' ? 'SHIELD CRACKED!' : 'ARMOR SHATTERED!';
    hud.set({ callout: { text: label, color: '#ffc95c', id: ++w.calloutId } });
  }
  if (e.snared) {
    w.shards.burst(v.x, 1.1, v.z, 18, 6.5, '#3ff0ff');
    hud.set({ callout: { text: 'NETTED!', color: '#3ff0ff', id: ++w.calloutId } });
  }

  // Severed limb debris
  if (e.severed) {
    w.debris.push(new SeveredPiece(w.phys, {
      kind: e.severed, style: v.style, x: v.x, z: v.z, yaw: v.yaw,
      hitX: e.dx, hitZ: e.dz, hitSpeed: e.heavy || e.decap ? 14 : 9, color: v.stats.color,
    }));
    w.debrisVersion++;
    w.shards.burst(v.x, LIMB_Y[e.severed], v.z, 22, 8.5, v.stats.color, e.dx, e.dz);
  } else if (e.broken) {
    w.shards.burst(v.x, LIMB_Y[e.broken], v.z, 14, 6.5, '#ff3b5c', e.dx, e.dz);
  }

  if (e.decap) {
    w.hitstop = Math.max(w.hitstop, 0.24); w.shake = Math.max(w.shake, 1.0); w.fovKick = -8;
    hud.set({ callout: { text: 'DECAPITATED!', color: '#ff3b5c', id: ++w.calloutId } });
  } else if (e.severed === 'armL') {
    w.hitstop = Math.max(w.hitstop, 0.16); w.shake = Math.max(w.shake, 0.7); w.fovKick = Math.min(w.fovKick, -5);
    hud.set({ callout: { text: 'SHIELD ARM SEVERED!', color: '#ffc95c', id: ++w.calloutId } });
  } else if (e.severed === 'armR') {
    w.hitstop = Math.max(w.hitstop, 0.18); w.shake = Math.max(w.shake, 0.75); w.fovKick = Math.min(w.fovKick, -6);
    hud.set({ callout: { text: 'DISARMED!', color: '#ff4fd8', id: ++w.calloutId } });
  } else if (e.severed === 'legL' || e.severed === 'legR') {
    w.hitstop = Math.max(w.hitstop, 0.16); w.shake = Math.max(w.shake, 0.7); w.fovKick = Math.min(w.fovKick, -5);
    hud.set({ callout: { text: 'LEG SEVERED!', color: '#ff6b6b', id: ++w.calloutId } });
  } else if (e.broken === 'armR') {
    hud.set({ callout: { text: 'WEAPON ARM CRIPPLED!', color: '#ff6b6b', id: ++w.calloutId } });
  } else if (e.broken === 'legL' || e.broken === 'legR') {
    hud.set({ callout: { text: 'LEG CRIPPLED!', color: '#ff6b6b', id: ++w.calloutId } });
  }

  if (e.type === 'hit') {
    const fin = e.atk === 'light3';
    w.hitstop = Math.max(w.hitstop, e.heavy || fin ? 0.11 : 0.06);
    w.shake = Math.max(w.shake, e.heavy || fin ? 0.6 : 0.25);
    if (e.heavy || fin) w.fovKick = Math.min(w.fovKick, -4);
    if (fin && a.team === 'p' && !e.severed) hud.set({ callout: { text: 'FINISHER!', color: '#ff4fd8', id: ++w.calloutId } });
    w.shards.burst(v.x, y, v.z, e.heavy || fin ? 24 : 12, e.heavy || fin ? 8.5 : 5, v.stats.color, e.dx, e.dz);
  } else {
    if (a.team === 'p' && a.state !== 'dead') a.hp = Math.min(a.maxHp, a.hp + a.mods.healOnKill);
    w.hitstop = Math.max(w.hitstop, 0.22); w.shake = Math.max(w.shake, 0.9); w.fovKick = Math.min(w.fovKick, -6);
    w.shards.burst(v.x, y, v.z, 34, 10.5, v.stats.color, e.dx, e.dz);
    if (!v.limbs.armR.severed) {
      w.debris.push(new SeveredPiece(w.phys, {
        kind: 'weapon', style: v.style, x: v.x, z: v.z, yaw: v.yaw,
        hitX: e.dx, hitZ: e.dz, hitSpeed: e.heavy ? 13 : 8, color: v.stats.color,
      }));
      w.debrisVersion++;
    }
    w.ragdolls.push(new Ragdoll(w.phys, {
      x: v.x, z: v.z, yaw: v.yaw, vx: v.vx * 0.5, vz: v.vz * 0.5,
      hitX: e.dx, hitZ: e.dz, hitSpeed: e.heavy || e.atk === 'light3' ? 17 : 10, color: v.stats.color,
      severed: {
        head: v.limbs.head.severed,
        armL: v.limbs.armL.severed,
        armR: v.limbs.armR.severed,
        legL: v.limbs.legL.severed,
        legR: v.limbs.legR.severed,
      },
    }));
    w.ragVersion++;
  }
}

function playerIntent(w: ArenaWorld): Intent {
  const b = w.buf;
  const fx = w.camFwd.x, fz = w.camFwd.y;
  let fwd = 0, side = 0;
  if (keys.has('KeyW') || keys.has('ArrowUp')) fwd += 1;
  if (keys.has('KeyS') || keys.has('ArrowDown')) fwd -= 1;
  if (keys.has('KeyD') || keys.has('ArrowRight')) side += 1;
  if (keys.has('KeyA') || keys.has('ArrowLeft')) side -= 1;
  const rx = -fz, rz = fx;
  const l = Math.hypot(fwd, side);
  return {
    moveX: l > 0 ? (fx * fwd + rx * side) / l : 0,
    moveZ: l > 0 ? (fz * fwd + rz * side) / l : 0,
    light: b.light > 0, heavy: b.heavy > 0, bash: b.bash > 0,
    block: keys.has('ShiftLeft') || keys.has('ShiftRight') || keys.has('KeyL'),
    dodge: b.dodge > 0,
  };
}

function simulate(w: ArenaWorld, dt: number, bout: number) {
  const hud = useArena.getState();
  w.time += dt; w.phaseT += dt;
  w.shake = Math.max(0, w.shake - dt * 2.4);
  w.fovKick *= Math.exp(-8 * dt);

  const b = w.buf;
  if (pressed('KeyJ') || pressed('Mouse0')) b.light = 0.22;
  if (pressed('KeyK') || pressed('Mouse2')) b.heavy = 0.22;
  if (pressed('KeyF')) b.bash = 0.22;
  if (pressed('Space')) b.dodge = 0.16;

  if (w.phase === 'intro' && w.phaseT > 1.6) {
    w.phase = 'fight'; w.phaseT = 0; hud.set({ phase: 'fight' });
  }
  const fighting = w.phase === 'fight';

  const player = w.fighters[0];
  const liveFoes = w.fighters.filter((f) => f.team === 'e' && f.state !== 'dead');

  // Lock-On toggle / cycle target via Tab
  if (pressed('Tab')) {
    if (!w.lockOn && liveFoes.length > 0) {
      w.lockOn = true; w.lockedId = liveFoes[0].id;
    } else if (w.lockOn) {
      const idx = liveFoes.findIndex((f) => f.id === w.lockedId);
      if (idx >= 0 && idx < liveFoes.length - 1) w.lockedId = liveFoes[idx + 1].id;
      else { w.lockOn = false; w.lockedId = null; }
    }
  }
  let locked = w.lockOn ? liveFoes.find((f) => f.id === w.lockedId) ?? null : null;
  if (w.lockOn && !locked && liveFoes.length > 0) {
    locked = nearestFoe(player, w.fighters);
    w.lockedId = locked?.id ?? null;
  }

  // Camera vector: squared up on locked target, or Citadel free orbit (Q/E/R/F)
  if (w.lockOn && locked) {
    const dx = locked.x - player.x, dz = locked.z - player.z;
    const d = Math.hypot(dx, dz) || 1;
    w.camFwd.set(dx / d, dz / d);
    w.yaw = Math.atan2(-w.camFwd.x, -w.camFwd.y);
  } else {
    let orbit = 0;
    if (keys.has('KeyQ')) orbit += 1;
    if (keys.has('KeyE')) orbit -= 1;
    if (orbit) w.yaw += orbit * KB_YAW_SENS * dt * 60;
    if (keys.has('KeyR')) w.pitch = Math.min(1.4, w.pitch + KB_YAW_SENS * dt * 60);
    if (keys.has('KeyF')) w.pitch = Math.max(-1.3, w.pitch - KB_YAW_SENS * dt * 60);
    w.camFwd.set(-Math.sin(w.yaw), -Math.cos(w.yaw));
  }

  if (w.hitstop > 0) { w.hitstop -= dt; return; }

  for (const f of w.fighters) {
    if (f.state === 'dead') continue;
    const target = f === player ? locked : nearestFoe(f, w.fighters);
    let intent: Intent = NO_INTENT;
    if (fighting) {
      if (f === player) intent = playerIntent(w);
      else if (target) intent = aiIntent(f, target, dt);
    }
    const prev = f.state;
    const prevQueued = f.queuedAtk;
    const strike = stepFighter(f, intent, dt, target);

    if (f === player) {
      if (f.state !== 'idle' && prev === 'idle') { b.light = 0; b.heavy = 0; b.bash = 0; b.dodge = 0; }
      if (f.queuedAtk && f.queuedAtk !== prevQueued) { b.light = 0; b.heavy = 0; b.bash = 0; }
    }

    // Spawn dodge afterimages
    if (f.state === 'dodge') {
      const startGhost = prev !== 'dodge';
      const stepGhost = Math.floor(f.t / 0.09) > Math.floor(Math.max(0, f.t - dt) / 0.09);
      if (startGhost || stepGhost) {
        w.ghosts.spawn(f.x, f.z, f.yaw, f.stats.color, f.dodgeLocalZ * 0.45, -f.dodgeLocalX * 0.45);
      }
    }

    // Keep inside visible arena wall and separate overlapping fighters
    const r = Math.hypot(f.x, f.z), lim = ARENA_RADIUS - f.stats.radius - 0.2;
    if (r > lim) { f.x *= lim / r; f.z *= lim / r; }
    for (const o of w.fighters) {
      if (o === f || o.state === 'dead') continue;
      const dx = f.x - o.x, dz = f.z - o.z, min = f.stats.radius + o.stats.radius, d = Math.hypot(dx, dz) || 1e-6;
      if (d < min) { const p = (min - d) / 2; f.x += (dx / d) * p; f.z += (dz / d) * p; }
    }

    if (strike && f.atk) {
      const slashColor = f.atk === 'light3' ? '#ffc95c' : f.style === 'retiarius' && f.atk === 'heavy' ? '#3ff0ff' : f.team === 'p' ? f.stats.color : '#ff4f6d';
      w.slashes.spawn(f.x, f.z, f.yaw, f.atk, slashColor, f.style);
      for (const e of resolveStrike(f, w.fighters)) onHit(w, e);
    }
  }
  b.light = Math.max(0, b.light - dt); b.heavy = Math.max(0, b.heavy - dt);
  b.bash = Math.max(0, b.bash - dt); b.dodge = Math.max(0, b.dodge - dt);

  if (fighting) {
    const foesLeft = w.fighters.some((f) => f.team === 'e' && f.state !== 'dead');
    if (player.state === 'dead') { w.phase = 'defeat'; w.phaseT = 0; }
    else if (!foesLeft) { w.phase = 'victory'; w.phaseT = 0; }
  }
  void bout;
}

const makeLimbPose = (): LimbPose => ({
  head: { ratio: 1, severed: false }, torso: { ratio: 1, severed: false },
  armL: { ratio: 1, severed: false }, armR: { ratio: 1, severed: false },
  legL: { ratio: 1, severed: false }, legR: { ratio: 1, severed: false },
});

function FighterView({ w, index }: { w: ArenaWorld; index: number }) {
  const g = useRef<GladiatorHandle>(null!);
  const limbPose = useRef<LimbPose>(makeLimbPose());
  const armorPose = useRef<Record<ArmorKey, boolean>>({ helm: true, pauldron: true, shield: true });
  const f = w.fighters[index];
  const stDef = styleOf(f.style);
  useFrame(() => {
    const h = g.current;
    if (!h) return;
    h.group.visible = f.state !== 'dead';
    h.group.position.set(f.x, 0, f.z);
    h.group.rotation.y = f.yaw;
    const p = h.pose;
    const at = f.atk ? ATTACKS[f.atk] : null;
    let progress = 0, tele = 0;
    if (at && f.state === 'windup') {
      const raw = at.windup * f.stats.windupMul * stDef.windupMul;
      const wt = f.team === 'e' ? Math.max(0.4, raw) : raw;
      progress = Math.min(1, f.t / wt);
      tele = f.team === 'e' ? 0.35 + progress * 0.65 : 0;
    } else if (at && f.state === 'strike') {
      progress = Math.min(1, f.t / at.strike);
    } else if (at && f.state === 'recover') {
      progress = Math.min(1, f.t / (at.recover * stDef.recoverMul));
    } else if (f.state === 'dodge') {
      progress = Math.min(1, f.t / DODGE_TIME);
    } else if (f.state === 'stagger') {
      progress = Math.min(1, f.t / (f.stagger || 0.2));
    }
    p.state = f.state;
    p.atk = f.atk;
    p.progress = progress;
    p.telegraph = tele;
    p.block += ((f.blocking ? 1 : 0) - p.block) * 0.35;
    p.hurt = f.state === 'stagger' ? Math.max(0, 1 - f.t / 0.25) : Math.max(0, p.hurt - 0.12);
    p.stance = 1;
    p.localVx = f.localVx;
    p.localVz = f.localVz;
    p.dodgeLocalX = f.dodgeLocalX;
    p.dodgeLocalZ = f.dodgeLocalZ;
    for (const k of LIMB_KEYS) {
      limbPose.current[k].ratio = f.limbs[k].hp / (f.limbs[k].max || 1);
      limbPose.current[k].severed = f.limbs[k].severed;
    }
    p.limbs = limbPose.current;
    armorPose.current.helm = !f.armor.helm.broken;
    armorPose.current.pauldron = !f.armor.pauldron.broken;
    armorPose.current.shield = !f.armor.shield.broken;
    p.armor = armorPose.current;
    p.snared = f.snared;
    const sp = Math.hypot(f.vx, f.vz);
    h.setMoving(f.state === 'dodge' ? 1 : Math.min(1, sp / (f.stats.speed * stDef.speedMul)));
  });
  return (
    <Gladiator
      ref={g}
      style={f.style}
      color={f.stats.color}
      accent={f.team === 'p' ? '#ffc95c' : '#e9e6ff'}
      scale={f.kind === 'brute' ? 1.24 : f.kind === 'champion' ? 1.15 : stDef.scale}
    />
  );
}

function TargetReticle({ w }: { w: ArenaWorld }) {
  const ref = useRef<THREE.Group>(null!);
  useFrame(({ clock }) => {
    const t = getLockedTarget(w);
    if (!ref.current) return;
    if (!t || w.phase !== 'fight') {
      ref.current.visible = false;
      return;
    }
    ref.current.visible = true;
    ref.current.position.set(t.x, 0.05, t.z);
    ref.current.rotation.y = clock.elapsedTime * 2.2;
    const pulse = 1 + Math.sin(clock.elapsedTime * 6) * 0.08;
    ref.current.scale.setScalar(pulse);
  });
  return (
    <group ref={ref} visible={false}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.76, 0.88, 4]} />
        <meshBasicMaterial color="#3ff0ff" transparent opacity={0.85} side={THREE.DoubleSide} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, Math.PI / 4]}>
        <ringGeometry args={[0.92, 0.98, 4]} />
        <meshBasicMaterial color="#ffc95c" transparent opacity={0.6} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

const STICK_DIMS: Record<string, [number, number, number]> = {
  pelvis: [0.1, 0.16, 0.1], torso: [0.1, 0.56, 0.1], head: [0.075, 0.2, 0.075],
  thighL: [0.11, 0.4, 0.11], thighR: [0.11, 0.4, 0.11], shinL: [0.1, 0.4, 0.1], shinR: [0.1, 0.4, 0.1],
  uarmL: [0.075, 0.28, 0.075], uarmR: [0.075, 0.28, 0.075], farmL: [0.075, 0.26, 0.075], farmR: [0.075, 0.26, 0.075],
};
const PART_MAP = new Map(PARTS.map((p) => [p.name, p]));

/** The dead keep their stick rig: surviving dashes flung about by physics. */
function RagdollView({ w, rag }: { w: ArenaWorld; rag: Ragdoll }) {
  const refs = useRef<(THREE.Group | null)[]>([]);
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ color: new THREE.Color(rag.color).lerp(new THREE.Color('#ffffff'), 0.72) }), [rag.color]);
  useFrame(() => {
    if (w.freed || rag.shattered || rag.bodies.length === 0) return;
    rag.bodies.forEach((b, i) => {
      const g = refs.current[i];
      if (!g) return;
      const t = b.translation(), q = b.rotation();
      g.position.set(t.x, t.y, t.z); g.quaternion.set(q.x, q.y, q.z, q.w);
    });
  });
  return (
    <group>
      {rag.partNames.map((name, i) => {
        const d = PART_MAP.get(name)!;
        return (
          <group key={name} ref={(el) => { refs.current[i] = el; }} position={d.pos}>
            <mesh material={mat}><boxGeometry args={STICK_DIMS[name]} /></mesh>
          </group>
        );
      })}
    </group>
  );
}

/** Tumbling severed limb, shattered armor piece, or dropped weapon on the arena sand. */
function SeveredPieceView({ w, piece }: { w: ArenaWorld; piece: SeveredPiece }) {
  const limbRef = useRef<THREE.Group>(null!);
  const weaponRef = useRef<THREE.Group>(null!);
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ color: new THREE.Color(piece.color).lerp(new THREE.Color('#ffffff'), 0.72) }), [piece.color]);
  const wireMat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#ffc95c', wireframe: true, side: THREE.DoubleSide }), []);
  const shieldMat = useMemo(() => new THREE.MeshBasicMaterial({ color: piece.color, wireframe: true, side: THREE.DoubleSide }), [piece.color]);

  useFrame(() => {
    if (w.freed || piece.shattered) return;
    if (limbRef.current) {
      const t = piece.body.translation(), q = piece.body.rotation();
      limbRef.current.position.set(t.x, t.y, t.z);
      limbRef.current.quaternion.set(q.x, q.y, q.z, q.w);
    }
    if (weaponRef.current && piece.weaponBody) {
      const t = piece.weaponBody.translation(), q = piece.weaponBody.rotation();
      weaponRef.current.position.set(t.x, t.y, t.z);
      weaponRef.current.quaternion.set(q.x, q.y, q.z, q.w);
    }
  });

  const renderWeapon = () => {
    if (piece.style === 'executioner') {
      return (
        <group>
          <mesh material={wireMat}><boxGeometry args={[0.055, 1.2, 0.055]} /></mesh>
          <mesh position={[0, -0.58, 0]} material={wireMat}><boxGeometry args={[0.26, 0.22, 0.42]} /></mesh>
        </group>
      );
    }
    if (piece.style === 'retiarius') {
      return (
        <group>
          <mesh material={wireMat}><boxGeometry args={[0.045, 1.4, 0.045]} /></mesh>
          <mesh position={[0, -0.7, 0]} material={wireMat}><boxGeometry args={[0.3, 0.05, 0.05]} /></mesh>
        </group>
      );
    }
    if (piece.style === 'hoplomachus') {
      return (
        <group>
          <mesh material={wireMat}><boxGeometry args={[0.045, 1.5, 0.045]} /></mesh>
          <mesh position={[0, -0.78, 0]} rotation={[Math.PI, 0, 0]}><coneGeometry args={[0.08, 0.25, 4]} /><meshBasicMaterial color="#ffffff" /></mesh>
        </group>
      );
    }
    return <mesh><boxGeometry args={[0.055, 0.85, 0.055]} /><meshBasicMaterial color="#ffffff" /></mesh>;
  };

  return (
    <group>
      <group ref={limbRef}>
        {piece.kind === 'helm' && (
          <group>
            <mesh material={wireMat}><boxGeometry args={[0.22, 0.24, 0.24]} /></mesh>
            <mesh position={[0, 0.16, 0]} material={wireMat}><boxGeometry args={[0.05, 0.16, 0.3]} /></mesh>
          </group>
        )}
        {piece.kind === 'pauldron' && (
          <group>
            <mesh material={wireMat}><icosahedronGeometry args={[0.17, 0]} /></mesh>
            <mesh position={[0, 0.18, 0]} material={wireMat}><coneGeometry args={[0.06, 0.22, 4]} /></mesh>
          </group>
        )}
        {piece.kind === 'shield' && (
          <mesh rotation={[Math.PI / 2, 0, 0]} material={shieldMat}><ringGeometry args={[0.22, 0.34, 8]} /></mesh>
        )}
        {piece.kind === 'weapon' && renderWeapon()}
        {piece.kind !== 'helm' && piece.kind !== 'pauldron' && piece.kind !== 'shield' && piece.kind !== 'weapon' && (
          <mesh material={mat}><boxGeometry args={piece.kind === 'head' ? [0.08, 0.2, 0.08] : [0.09, 0.38, 0.09]} /></mesh>
        )}
      </group>
      {piece.weaponBody && piece.kind === 'armR' && (
        <group ref={weaponRef}>{renderWeapon()}</group>
      )}
      {piece.weaponBody && piece.kind === 'armL' && (
        <group ref={weaponRef}>
          {styleOf(piece.style).dualWield
            ? <mesh><boxGeometry args={[0.05, 0.78, 0.05]} /><meshBasicMaterial color="#ffffff" /></mesh>
            : <mesh rotation={[Math.PI / 2, 0, 0]} material={shieldMat}><ringGeometry args={[0.2, 0.27, 10]} /></mesh>}
        </group>
      )}
    </group>
  );
}

function Ring() {
  const rings = [4, 8, 12, 16];
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}><circleGeometry args={[ARENA_RADIUS, 64]} /><meshBasicMaterial color="#0b0620" /></mesh>
      {rings.map((r) => (
        <mesh key={r} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}><ringGeometry args={[r - 0.04, r + 0.04, 64]} /><meshBasicMaterial color={r === 16 ? '#ff4fd8' : '#3ff0ff'} transparent opacity={r === 16 ? 0.8 : 0.35} /></mesh>
      ))}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]}><circleGeometry args={[1.2, 6]} /><meshBasicMaterial color="#ffc95c" wireframe /></mesh>
      {/* the wall that physics and fighters actually collide with */}
      <mesh position={[0, 1.2, 0]}><cylinderGeometry args={[ARENA_RADIUS + 0.55, ARENA_RADIUS + 0.55, 2.4, 48, 1, true]} /><meshBasicMaterial color="#0b051b" side={THREE.DoubleSide} /></mesh>
      <mesh position={[0, 1.2, 0]}><cylinderGeometry args={[ARENA_RADIUS + 0.6, ARENA_RADIUS + 0.6, 2.4, 48, 6, true]} /><meshBasicMaterial color="#ffc95c" wireframe transparent opacity={0.45} /></mesh>
    </group>
  );
}

function Stands() {
  const ref = useRef(new THREE.Vector3());
  const cols = useMemo(() => Array.from({ length: 16 }, (_, i) => {
    const a = (i / 16) * Math.PI * 2, r = ARENA_RADIUS + 5;
    return [Math.cos(a) * r, 0, Math.sin(a) * r] as [number, number, number];
  }), []);
  return <group>{cols.map((p, i) => <DoricColumn key={i} position={p} scale={1.15} playerPos={ref} />)}</group>;
}

function Scene({ w, bout }: { w: ArenaWorld; bout: number }) {
  const camera = useThree((s) => s.camera);
  const shardMesh = useRef<THREE.InstancedMesh>(null!);
  const [ragVer, setRagVer] = useState(0);
  const [debVer, setDebVer] = useState(0);
  const playerPos = useRef(new THREE.Vector3());
  const camPos = useRef(new THREE.Vector3(1.35, 3.85, 13.8));
  const look = useRef(new THREE.Vector3(0, 1.45, 0));
  const desiredCam = useRef(new THREE.Vector3());
  const desiredLook = useRef(new THREE.Vector3());

  useEffect(() => () => {
    if (camera instanceof THREE.PerspectiveCamera && camera.fov !== 66) {
      camera.fov = 66;
      camera.updateProjectionMatrix();
    }
  }, [camera]);

  useFrame((_, delta) => {
    if (w.freed) return;
    const dt = Math.min(delta, 0.05);
    const hud = useArena.getState();
    w.acc += dt;
    while (w.acc >= 1 / 60) {
      w.acc -= 1 / 60;
      const frozen = w.hitstop > 0;
      simulate(w, 1 / 60, bout);
      if (!frozen || w.ragdolls.length || w.debris.length) {
        if (w.ragdolls.length || w.debris.length) w.phys.step();
        for (const r of [...w.ragdolls]) {
          if (r.tick(1 / 60)) {
            r.bodies.forEach((b) => { const t = b.translation(); w.shards.burst(t.x, t.y, t.z, 6, 7, r.color); });
            r.dispose(); w.ragdolls.splice(w.ragdolls.indexOf(r), 1); w.ragVersion++;
          }
        }
        for (const d of [...w.debris]) {
          if (d.tick(1 / 60)) {
            const t = d.body.translation();
            w.shards.burst(t.x, t.y, t.z, 10, 6, d.color);
            d.dispose(); w.debris.splice(w.debris.indexOf(d), 1); w.debrisVersion++;
          }
        }
      }
      w.shards.update(1 / 60, shardMesh.current);
      w.slashes.update(1 / 60);
      w.ghosts.update(1 / 60);
    }
    if (ragVer !== w.ragVersion) setRagVer(w.ragVersion);
    if (debVer !== w.debrisVersion) setDebVer(w.debrisVersion);

    // HUD sync (only when values change)
    const p = w.fighters[0];
    const locked = getLockedTarget(w);
    const lockedName = w.lockOn && locked ? locked.stats.name : null;
    const playerLimbs = toLimbHud(p.limbs);
    const samePlayerLimbs = sameLimbHud(playerLimbs, hud.playerLimbs);
    const enemies = w.fighters.filter((f) => f.team === 'e').map((f) => ({
      id: f.id, name: f.stats.name, styleName: styleOf(f.style).name, hp: Math.ceil(f.hp), max: f.maxHp, limbs: toLimbHud(f.limbs),
    }));
    const sameEnemies = enemies.length === hud.enemies.length && enemies.every((e, i) =>
      e.hp === hud.enemies[i].hp && sameLimbHud(e.limbs, hud.enemies[i].limbs),
    );
    const hp = Math.ceil(p.hp), st = Math.floor(p.stamina);
    const resultLive = (w.phase === 'victory' || w.phase === 'defeat') && w.phaseT > 2.2;
    if (!w.settled) {
      const shown = w.phase === 'intro' ? 'intro' : 'fight';
      if (
        hp !== hud.hp || st !== hud.st || !samePlayerLimbs || !sameEnemies ||
        hud.maxHp !== p.maxHp || shown !== hud.phase || lockedName !== hud.lockedName || p.comboStep !== hud.combo
      ) {
        hud.set({
          hp, st, maxHp: p.maxHp, maxSt: p.maxStamina,
          playerLimbs: samePlayerLimbs ? hud.playerLimbs : playerLimbs,
          enemies: sameEnemies ? hud.enemies : enemies,
          phase: shown, lockedName, combo: p.comboStep,
        });
      }
    }
    if (resultLive && !w.settled) {
      w.settled = true;
      const game = useGame.getState();
      const mul = p.mods.glory;
      if (w.phase === 'victory') {
        const earned = gloryForBout(bout, mul) + (isFinalBout(bout) ? Math.round(CHAMPION_BONUS * mul) : 0);
        game.addGlory(earned);
        if (isFinalBout(bout)) { game.recordChampion(); hud.set({ phase: 'champion', earned, enemies: [], callout: null }); }
        else hud.set({ phase: 'draft', earned, enemies: [], draft: drawBoons().map((b) => b.id), carryHp: carryHp(p.hp, p.maxHp), carryMax: p.maxHp, callout: null });
      } else {
        game.recordDeath({ name: 'A nameless gladiator', bouts: bout, cause: `slain by ${w.fighters.find((x) => x.team === 'e' && x.state !== 'dead')?.stats.name ?? 'the sand'}`, date: new Date().toISOString().slice(0, 10) });
        hud.set({ phase: 'defeat', enemies: [], callout: null });
      }
    }

    // Camera FOV punch
    if (camera instanceof THREE.PerspectiveCamera) {
      const targetFov = 66 + w.fovKick;
      if (Math.abs(camera.fov - targetFov) > 0.02) {
        camera.fov = targetFov;
        camera.updateProjectionMatrix();
      }
    }

    // Lock-On over-shoulder framing or Citadel free cam
    const f = w.camFwd;
    playerPos.current.set(p.x, 0, p.z);
    if (w.lockOn && locked) {
      const rx = -f.y, rz = f.x;
      desiredCam.current.set(p.x - f.x * 5.8 + rx * 1.35, 3.85, p.z - f.y * 5.8 + rz * 1.35);
      desiredLook.current.set(p.x + (locked.x - p.x) * 0.45, 1.45, p.z + (locked.z - p.z) * 0.45);
    } else {
      const cp = Math.cos(w.pitch), sp = Math.sin(w.pitch);
      desiredCam.current.set(p.x - f.x * CAM_DIST, CAM_HEIGHT, p.z - f.y * CAM_DIST);
      desiredLook.current.set(p.x + f.x * LOOK_AHEAD * cp, LOOK_HEIGHT + LOOK_AHEAD * sp * 2.2, p.z + f.y * LOOK_AHEAD * cp);
    }
    const alpha = 1 - Math.pow(1 - CAM_LERP, dt * 60);
    camPos.current.lerp(desiredCam.current, alpha);
    camera.position.copy(camPos.current);
    if (w.shake > 0) {
      camera.position.x += (Math.random() - 0.5) * w.shake * 0.6;
      camera.position.y += (Math.random() - 0.5) * w.shake * 0.4;
      camera.position.z += (Math.random() - 0.5) * w.shake * 0.6;
    }
    look.current.lerp(desiredLook.current, alpha);
    camera.lookAt(look.current);
  });

  return (
    <>
      <color attach="background" args={['#06050d']} />
      <fog attach="fog" args={['#0a0620', 60, 230]} />
      <SynthwaveHorizon />
      <Starfield playerPosRef={playerPos} />
      <Ring />
      <Stands />
      <TargetReticle w={w} />
      {w.fighters.map((f, i) => <FighterView key={f.id} w={w} index={i} />)}
      <SlashRibbons pool={w.slashes} />
      <DashGhosts pool={w.ghosts} />
      {w.ragdolls.map((r) => <RagdollView key={r.id} w={w} rag={r} />)}
      {w.debris.map((d) => <SeveredPieceView key={d.id} w={w} piece={d} />)}
      <instancedMesh ref={shardMesh} args={[undefined, undefined, ShardPool.CAP]} frustumCulled={false}>
        <octahedronGeometry args={[1, 0]} />
        <meshBasicMaterial color="#ffffff" />
      </instancedMesh>
    </>
  );
}

export function Arena() {
  const bout = useArena((s) => s.bout);
  const [world, setWorld] = useState<ArenaWorld | null>(null);
  useEffect(() => {
    let dead = false;
    let local: ArenaWorld | null = null;
    initPhysics().then(() => {
      if (dead) return;
      const a = useArena.getState();
      const gs = useGame.getState();
      local = newWorld(bout, boutRosterFor(bout), a.boons, a.carryHp, a.carryMax, gs.look, resolvePlayerStyle(gs.style));
      a.set({
        phase: 'intro',
        hp: local.fighters[0].hp,
        maxHp: local.fighters[0].maxHp,
        st: 100,
        playerLimbs: fullLimbHud(),
        enemies: [],
        lockedName: local.fighters[1]?.stats.name ?? null,
        combo: 0,
        callout: null,
      });
      setWorld(local);
    });
    return () => {
      dead = true;
      if (local) {
        local.freed = true;
        local.phys.free();
        local = null;
      }
      setWorld(null);
    };
  }, [bout]);
  if (!world || world.freed || world.bout !== bout) return null;
  return <Scene key={world.bout} w={world} bout={world.bout} />;
}
