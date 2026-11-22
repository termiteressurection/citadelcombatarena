import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { Gladiator, type GladiatorHandle, type LimbPose } from './Gladiator';
import { Brazier, Ps1Sky } from './art/Ps1Sky';
import { setCurvature } from './art/curvature';
import { cloneTex, getPs1Texture, makePs1Material } from './art/ps1Textures';
import { sfx } from './art/sfx';
import Starfield from './art/Starfield';
import {
  ATTACKS, DODGE_TIME, KINDS, LIMB_KEYS, NO_INTENT, aiIntent, canExecuteTarget, checkWallSplat, defaultMods, drinkFlask,
  gearOf, makeFighter, parryWindowOf, resolveStrike, spawnDroppedWeapon, stepFighter, stepWeaponProps,
  throwFighterWeapon, tryExecute, tryPickupWeapon, windupOf,
  type ArenaWeaponProp, type Fighter, type HitEvent, type Intent, type LimbKey, type StanceHeight,
} from './arena/combat';
import { ARENA_RADIUS, createArenaWorld, initPhysics, RAPIER } from './arena/physics';
import { PARTS, Ragdoll, SeveredPiece } from './arena/ragdoll';
import { DashGhosts, GhostPool, ShardPool, SlashPool, SlashRibbons } from './arena/effects';
import { fullLimbHud, toLimbHud, useArena, type LimbHud } from './arena/arenaStore';
import { drawBoons, modsFor } from './arena/boons';
import { CHAMPION_BONUS, boutRosterFor, carryHp, gloryForBout, isFinalBout, lookColor, type BoutEnemy } from './arena/run';
import { STYLE_IDS, styleOf, type ArmorKey, type StyleId } from './arena/styles';
import { gearFromStyle, itemById, resolveLoadout, WEAPONS, type WeaponFamily } from './rpg/items';
import { buildPlayerMods } from './rpg/stats';
import type { FightCard } from './rpg/quests';
import { COLOSSEUMS, type CapitalId } from './world/universe';
import { consumeMouseLook, keys, pressed } from './input';
import { useGame, type SpectatorBout } from './store';

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
  slowMo: number;
  shake: number;
  fovKick: number;
  time: number;
  acc: number;
  phase: 'intro' | 'fight' | 'victory' | 'defeat';
  phaseT: number;
  ragVersion: number;
  debrisVersion: number;
  propVersion: number;
  nextPropId: number;
  weaponProps: ArenaWeaponProp[];
  buf: { light: number; heavy: number; bash: number; dodge: number; parry: number; jump: number };
  camFwd: THREE.Vector2;
  sideCamDir: THREE.Vector2;
  lastTapA: number;
  lastTapD: number;
  yaw: number;
  pitch: number;
  lockOn: boolean;
  lockedId: number | null;
  calloutId: number;
  settled: boolean;
  card: FightCard | null;
  kills: number;
  parries: number;
  armorsBroken: number;
  limbsSevered: number;
  usedFlask: boolean;
  weaponFamily: WeaponFamily;
  spectator: SpectatorBout | null;
  spectatorSpeed: 1 | 2;
  spectatorCamMode: 'side' | 'orbit';
  cheerCd: number;
  crowdFavor: number;
  tauntT: number;
  tauntCd: number;
  specialKind: 'v01_boss' | 'garbage_collector' | 'nemesis' | 'grand_prix' | null;
  nemesisCyberLimbs?: Partial<Record<LimbKey, boolean>>;
}

function resolveQueryStyle(): StyleId | null {
  if (typeof location === 'undefined') return null;
  const p = new URLSearchParams(location.search).get('style');
  return p && (STYLE_IDS as readonly string[]).includes(p) ? (p as StyleId) : null;
}

const STYLE_FAMILY: Record<StyleId, WeaponFamily> = {
  murmillo: 'gladius',
  dimachaerus: 'twinSica',
  executioner: 'warhammer',
  retiarius: 'trident',
  hoplomachus: 'spear',
};

function newWorld(
  bout: number,
  card: FightCard | null,
  roster: BoutEnemy[],
  boons: string[],
  carry: number,
  carryMax: number,
  gs: ReturnType<typeof useGame.getState>,
): ArenaWorld {
  const queryStyle = resolveQueryStyle();
  const spectator = gs.spectatorBout;
  const specialKind = gs.specialBoutKind;
  const nemesisRival = specialKind === 'nemesis' ? gs.nemesisRoster[gs.activeColosseumId] : undefined;
  let fighters: Fighter[] = [];
  let weaponFamily: WeaponFamily = queryStyle ? STYLE_FAMILY[queryStyle] : itemById(WEAPONS, gs.loadout.weaponId).family;

  if (spectator) {
    const { red, blue } = spectator;
    const redGear = gearFromStyle(red.style);
    const blueGear = gearFromStyle(blue.style);
    const redF = makeFighter(0, red.kind, -4.5, 0, { ...defaultMods(), maxHp: 115 - KINDS[red.kind].hp }, red.style, redGear);
    redF.team = 'p';
    redF.yaw = Math.PI / 2;
    redF.stats = { ...redF.stats, name: red.name, color: red.color, windupMul: 1.35 };

    const blueF = makeFighter(1, blue.kind, 4.5, 0, { ...defaultMods(), maxHp: 115 - KINDS[blue.kind].hp }, blue.style, blueGear);
    blueF.team = 'e';
    blueF.yaw = -Math.PI / 2;
    blueF.stats = { ...blueF.stats, name: blue.name, color: blue.color, windupMul: 1.35 };

    fighters = [redF, blueF];
    weaponFamily = redGear.visuals.weapon;
  } else {
    const playerGear = queryStyle ? gearFromStyle(queryStyle) : resolveLoadout(gs.loadout);
    const mods = buildPlayerMods(gs.stats, playerGear, gs.dailyBuffs, modsFor(boons));
    const player = makeFighter(0, 'player', 0, 8, mods, queryStyle ?? gs.style, playerGear);
    player.stats = { ...player.stats, color: lookColor(gs.look) };
    if (carry > 0) player.hp = Math.min(player.maxHp, carry + Math.max(0, player.maxHp - carryMax));
    fighters = [player];

    if (card) {
      card.enemies.forEach((item, i) => {
        const eGear = item.loadout ? resolveLoadout(item.loadout) : gearFromStyle(item.style);
        const eMods = defaultMods();
        if (specialKind === 'garbage_collector' && i === 0) eMods.maxHp = 180;
        else if (specialKind === 'nemesis' && nemesisRival) eMods.maxHp = nemesisRival.level * 28;
        else if (specialKind === 'v01_boss') eMods.maxHp = 95;
        const e = makeFighter(i + 1, item.kind, (i - (card.enemies.length - 1) / 2) * 4, -8, eMods, item.style, eGear);
        e.stats = {
          ...e.stats,
          name: item.name,
          color: specialKind === 'v01_boss' ? '#4dffa0' : nemesisRival?.color ?? eGear.color,
        };
        fighters.push(e);
      });
    } else {
      roster.forEach((item, i) => {
        const e = makeFighter(i + 1, item.kind, (i - (roster.length - 1) / 2) * 4, -8, defaultMods(), item.style);
        e.stats = { ...e.stats, color: styleOf(item.style).color };
        fighters.push(e);
      });
    }
  }

  return {
    bout, freed: false, card,
    kills: 0, parries: 0, armorsBroken: 0, limbsSevered: 0, usedFlask: false, weaponFamily,
    spectator, spectatorSpeed: 1, spectatorCamMode: 'side', cheerCd: 0,
    crowdFavor: 20, tauntT: 0, tauntCd: 0, specialKind, nemesisCyberLimbs: nemesisRival?.cyberLimbs,
    phys: createArenaWorld(), fighters, ragdolls: [], debris: [],
    shards: new ShardPool(), slashes: new SlashPool(), ghosts: new GhostPool(),
    hitstop: 0, slowMo: 0, shake: 0, fovKick: 0, time: 0, acc: 0,
    phase: 'intro', phaseT: 0, ragVersion: 0, debrisVersion: 0, propVersion: 0, nextPropId: 100, weaponProps: [],
    buf: { light: 0, heavy: 0, bash: 0, dodge: 0, parry: 0, jump: 0 },
    camFwd: new THREE.Vector2(0, -1), sideCamDir: new THREE.Vector2(1, 0), lastTapA: -9, lastTapD: -9, yaw: 0, pitch: 0,
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

function addCrowdFavor(w: ArenaWorld, amount: number) {
  if (w.spectator || amount <= 0) return;
  const p = w.fighters[0];
  if (!p || p.state === 'dead') return;
  w.crowdFavor = Math.min(100, w.crowdFavor + amount);
  if (w.crowdFavor >= 100) {
    w.crowdFavor = 0;
    p.hp = Math.min(p.maxHp, p.hp + Math.round(p.maxHp * 0.25));
    p.stamina = Math.min(p.maxStamina, p.stamina + 40);
    p.mods = { ...p.mods, dmg: p.mods.dmg + 0.12 };
    w.weaponProps.push(spawnDroppedWeapon(p, 0, -1, ++w.nextPropId));
    w.propVersion++;
    sfx.restoreWave();
    w.shards.burst(p.x, 1.8, p.z, 34, 11, '#ffd866');
    useArena.getState().set({
      crowdFavor: 0,
      crowdBlessing: 'CROWD OVERCLOCK GIFT! +25% HP & +12% DMG',
      callout: { text: 'CROWD OVERCLOCK GIFT!', color: '#ffd866', id: ++w.calloutId },
    });
  } else {
    useArena.getState().set({ crowdFavor: Math.round(w.crowdFavor) });
  }
}

function onHit(w: ArenaWorld, e: HitEvent) {
  const hud = useArena.getState();
  const v = w.fighters.find((f) => f.id === e.victim)!;
  const a = w.fighters.find((f) => f.id === e.attacker)!;
  const y = 1.3 + v.airY;
  if (e.weaponDropped) {
    const dropTarget = e.type === 'parry' ? a : v;
    w.weaponProps.push(spawnDroppedWeapon(dropTarget, e.dx, e.dz, ++w.nextPropId));
    w.propVersion++;
  }
  if (e.type === 'parry') {
    sfx.parry();
    if (v.team === 'p') {
      w.parries++;
      addCrowdFavor(w, 18);
    }
    w.hitstop = Math.max(w.hitstop, 0.18); w.slowMo = Math.max(w.slowMo, 0.28); w.shake = Math.max(w.shake, 0.6); w.fovKick = -8;
    w.shards.burst(e.x, y, e.z, 32, 10, '#ffc95c');
    w.slashes.spawn(e.x, e.z, 0, 'parry', '#ffc95c');
    hud.set({
      callout: {
        text: e.weaponDropped ? 'BEAT DISARM!' : e.thrownHit ? 'THROW DEFLECTED!' : 'PARRY! RIPOSTE!',
        color: e.weaponDropped ? '#ff4fd8' : '#ffc95c',
        id: ++w.calloutId,
      },
    });
    return;
  }
  if (e.type === 'guardBreak') {
    sfx.guardBreak();
    w.hitstop = Math.max(w.hitstop, 0.14); w.shake = Math.max(w.shake, 0.5); w.fovKick = -5;
    w.shards.burst(e.x, y, e.z, 24, 8.5, '#3ff0ff', e.dx, e.dz);
    hud.set({ callout: { text: e.diveKick ? 'DIVE CRUSH!' : 'GUARD BREAK!', color: '#3ff0ff', id: ++w.calloutId } });
    return;
  }
  if (e.type === 'block') {
    sfx.block();
    w.hitstop = Math.max(w.hitstop, 0.05); w.shake = Math.max(w.shake, 0.18);
    w.shards.burst(e.x, y, e.z, 8, 5, '#a78bfa', e.dx, e.dz);
    return;
  }

  // Shattered armor debris & Retiarius net snare
  if (e.armorBroken) {
    if (v.team === 'e') {
      w.armorsBroken++;
      addCrowdFavor(w, 15);
    }
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
    sfx.sever();
    if (v.team === 'e') {
      w.limbsSevered++;
      addCrowdFavor(w, 22);
    }
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
    if (!e.severed) sfx.hit(e.heavy, e.riposte);
    const fin = e.atk === 'light3';
    w.hitstop = Math.max(w.hitstop, e.riposte || e.heavy || fin || e.launched ? 0.13 : 0.06);
    w.shake = Math.max(w.shake, e.riposte || e.heavy || fin ? 0.65 : 0.25);
    if (e.riposte || e.heavy || fin || e.launched) w.fovKick = Math.min(w.fovKick, -4.5);
    if (e.launched) {
      w.slowMo = Math.max(w.slowMo, 0.22);
      hud.set({ callout: { text: 'LAUNCHED!', color: '#3ff0ff', id: ++w.calloutId } });
    } else if (e.juggled) {
      hud.set({ callout: { text: `AIR JUGGLE ×${v.juggleCount}!`, color: '#ffc95c', id: ++w.calloutId } });
    } else if (e.diveKick) {
      hud.set({ callout: { text: e.weaponDropped ? 'DIVE-KICK DISARM!' : 'FLYING DIVE KICK!', color: '#3ff0ff', id: ++w.calloutId } });
    } else if (e.thrownHit) {
      hud.set({ callout: { text: 'IMPALED!', color: '#ff3b5c', id: ++w.calloutId } });
    } else if (e.riposte) {
      w.shards.burst(v.x, y, v.z, 26, 9, '#ffc95c', e.dx, e.dz);
      if (a.team === 'p' && !e.severed) hud.set({ callout: { text: 'RIPOSTE!', color: '#ffc95c', id: ++w.calloutId } });
    } else if (fin && a.team === 'p' && !e.severed) {
      hud.set({ callout: { text: 'FINISHER!', color: '#ff4fd8', id: ++w.calloutId } });
    }
    w.shards.burst(v.x, y, v.z, e.heavy || fin ? 24 : 12, e.heavy || fin ? 8.5 : 5, v.stats.color, e.dx, e.dz);
  } else {
    if (!e.severed) sfx.hit(true, e.riposte);
    if (v.team === 'e') w.kills++;
    if (a.team === 'p' && a.state !== 'dead') a.hp = Math.min(a.maxHp, a.hp + a.mods.healOnKill);
    w.hitstop = Math.max(w.hitstop, 0.22); w.shake = Math.max(w.shake, 0.9); w.fovKick = Math.min(w.fovKick, -6);
    w.shards.burst(v.x, y, v.z, 34, 10.5, v.stats.color, e.dx, e.dz);
    if (!v.limbs.armR.severed && !v.weaponDisarmed) {
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

function playerIntent(w: ArenaWorld, locked: Fighter | null): Intent {
  const b = w.buf;
  const upHeld = keys.has('KeyW') || keys.has('ArrowUp');
  const downHeld = keys.has('KeyS') || keys.has('ArrowDown');
  const stance: StanceHeight = upHeld && !downHeld ? 'high' : downHeld && !upHeld ? 'low' : 'mid';

  if (w.lockOn && locked) {
    // 2.5D Tekken x Nidhogg lane controls perpendicular to sideCamDir
    const screenRightX = w.sideCamDir.y;
    const screenRightZ = -w.sideCamDir.x;
    const fwdCamX = -w.sideCamDir.x;
    const fwdCamZ = -w.sideCamDir.y;
    const rightInput = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0);
    const depthInput = stance === 'high' ? 1 : stance === 'low' ? -1 : 0;

    let moveX = screenRightX * rightInput;
    let moveZ = screenRightZ * rightInput;
    if (b.dodge > 0 && depthInput !== 0 && rightInput === 0) {
      moveX = fwdCamX * depthInput;
      moveZ = fwdCamZ * depthInput;
    }
    return {
      moveX,
      moveZ,
      light: b.light > 0,
      heavy: b.heavy > 0,
      bash: b.bash > 0,
      block: keys.has('ShiftLeft') || keys.has('ShiftRight') || keys.has('KeyL'),
      parry: b.parry > 0,
      dodge: b.dodge > 0,
      jump: b.jump > 0,
      stance,
    };
  }

  const fx = w.camFwd.x, fz = w.camFwd.y;
  let fwd = 0, side = 0;
  if (upHeld) fwd += 1;
  if (downHeld) fwd -= 1;
  if (keys.has('KeyD') || keys.has('ArrowRight')) side += 1;
  if (keys.has('KeyA') || keys.has('ArrowLeft')) side -= 1;
  const rx = -fz, rz = fx;
  const l = Math.hypot(fwd, side);
  return {
    moveX: l > 0 ? (fx * fwd + rx * side) / l : 0,
    moveZ: l > 0 ? (fz * fwd + rz * side) / l : 0,
    light: b.light > 0, heavy: b.heavy > 0, bash: b.bash > 0,
    block: keys.has('ShiftLeft') || keys.has('ShiftRight') || keys.has('KeyL'),
    parry: b.parry > 0,
    dodge: b.dodge > 0,
    jump: b.jump > 0,
    stance: 'mid',
  };
}

function simulate(w: ArenaWorld, dt: number, bout: number) {
  const hud = useArena.getState();
  w.time += dt; w.phaseT += dt;
  w.shake = Math.max(0, w.shake - dt * 2.4);
  w.fovKick *= Math.exp(-8 * dt);
  if (w.cheerCd > 0) w.cheerCd = Math.max(0, w.cheerCd - dt);
  if (w.tauntCd > 0) w.tauntCd = Math.max(0, w.tauntCd - dt);
  if (w.tauntT > 0) w.tauntT = Math.max(0, w.tauntT - dt);
  sfx.stepMusic({ biome: 'kernel', combat: true, onCycle: false, dt });

  const player = w.fighters[0];
  const liveFoes = w.fighters.filter((f) => f.team === 'e' && f.state !== 'dead');

  const b = w.buf;
  if (w.spectator) {
    if (pressed('Space')) {
      w.spectatorCamMode = w.spectatorCamMode === 'side' ? 'orbit' : 'side';
      hud.set({ callout: { text: w.spectatorCamMode === 'orbit' ? 'ORBIT BROADCAST CAM' : '2.5D RINGSIDE CAM', color: '#3ff0ff', id: ++w.calloutId } });
    }
    if (pressed('KeyF')) {
      w.spectatorSpeed = w.spectatorSpeed === 1 ? 2 : 1;
      hud.set({ callout: { text: `SPEED ${w.spectatorSpeed}×`, color: '#ffc95c', id: ++w.calloutId } });
    }
    if (w.phase === 'fight' && w.cheerCd <= 0 && pressed('KeyT')) {
      const backed = w.spectator.pickedCorner === 'red' ? w.fighters[0] : w.fighters[1];
      if (backed && backed.state !== 'dead') {
        w.cheerCd = 2.4;
        backed.stamina = Math.min(backed.maxStamina, backed.stamina + 28);
        sfx.parry();
        w.shards.burst(backed.x, 1.5, backed.z, 24, 8, '#ffc95c');
        hud.set({ callout: { text: `CROWD ROARS FOR ${backed.stats.name}!`, color: '#ffc95c', id: ++w.calloutId } });
      }
    }
  } else {
    if (pressed('KeyJ') || pressed('Mouse0')) b.light = 0.22;
    if (pressed('KeyK') || pressed('Mouse2')) b.heavy = 0.22;
    if (pressed('ShiftLeft') || pressed('ShiftRight') || pressed('KeyL')) b.parry = 0.16;

    // [F]: Hurl Weapon across screen, Grab Fallen Weapon, or Bare-Handed Shove
    if (w.phase === 'fight' && player.state !== 'dead' && pressed('KeyF')) {
      if (!player.weaponDisarmed) {
        const prop = throwFighterWeapon(player, ++w.nextPropId);
        if (prop) {
          w.weaponProps.push(prop);
          w.propVersion++;
          sfx.swing(true);
          hud.set({ callout: { text: 'WEAPON HURLED!', color: '#ffc95c', id: ++w.calloutId } });
        }
      } else {
        const picked = tryPickupWeapon(player, w.weaponProps, 2.6);
        if (picked) {
          w.propVersion++;
          sfx.parry();
          hud.set({ callout: { text: 'WEAPON RECLAIMED!', color: '#3ff0ff', id: ++w.calloutId } });
        } else {
          b.bash = 0.22;
        }
      }
    }

    if (w.lockOn && liveFoes.length > 0) {
      // Double-tap A / D dash & Tekken W/S sidestep vs Space Jump
      if (pressed('KeyA') || pressed('ArrowLeft')) {
        if (w.time - w.lastTapA < 0.24) b.dodge = 0.16;
        w.lastTapA = w.time;
      }
      if (pressed('KeyD') || pressed('ArrowRight')) {
        if (w.time - w.lastTapD < 0.24) b.dodge = 0.16;
        w.lastTapD = w.time;
      }
      const vertHeld = keys.has('KeyW') || keys.has('ArrowUp') || keys.has('KeyS') || keys.has('ArrowDown');
      const shiftHeld = keys.has('ShiftLeft') || keys.has('ShiftRight');
      if (shiftHeld && (pressed('KeyW') || pressed('ArrowUp') || pressed('KeyS') || pressed('ArrowDown'))) {
        b.dodge = 0.16;
      }
      if (pressed('Space')) {
        if (vertHeld) b.dodge = 0.16;
        else b.jump = 0.16;
      }
    } else {
      if (pressed('Space')) b.dodge = 0.16;
    }
  }

  if (w.phase === 'intro' && w.phaseT > 1.6) {
    w.phase = 'fight'; w.phaseT = 0; hud.set({ phase: 'fight' });
  }
  const fighting = w.phase === 'fight';

  if (!w.spectator && fighting && player.state !== 'dead' && pressed('KeyH')) {
    const gs = useGame.getState();
    if (gs.flasks > 0 && drinkFlask(player)) {
      gs.consumeFlaskInBout();
      w.usedFlask = true;
      w.shards.burst(player.x, 1.35, player.z, 26, 8, '#4dffa0');
      hud.set({ callout: { text: 'FLASK! +HP', color: '#4dffa0', id: ++w.calloutId } });
    }
  }

  if (!w.spectator && fighting && player.state !== 'dead' && pressed('KeyE')) {
    const execEv = tryExecute(player, w.fighters);
    if (execEv) {
      sfx.execute();
      w.slowMo = Math.max(w.slowMo, 0.34);
      onHit(w, execEv);
      w.hitstop = 0.26;
      w.shake = 1.15;
      w.fovKick = -10;
      addCrowdFavor(w, 28);
      hud.set({ callout: { text: 'EXECUTED! +22% HP', color: '#ffc95c', id: ++w.calloutId } });
    }
  }

  // [T] Crowd Favor Taunt during Arena duels
  if (!w.spectator && fighting && player.state === 'idle' && w.tauntCd <= 0 && pressed('KeyT')) {
    w.tauntCd = 4.2;
    w.tauntT = 0.9;
    sfx.taunt();
    player.stamina = Math.min(player.maxStamina, player.stamina + 18);
    w.shards.burst(player.x, 1.9, player.z, 20, 8, '#ffd866');
    addCrowdFavor(w, 28);
    hud.set({ tauntCd: 4.2, callout: { text: 'CROWD ROARS! +28 FAVOR', color: '#ffd866', id: ++w.calloutId } });
  }

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

  const mouseLook = consumeMouseLook();
  let pivotLocalVx = 0;
  // Camera orientation: 2.5D perpendicular side-cam when locked on (+ 3D stationary lane rotation), or free orbit
  if (w.lockOn && locked) {
    if (fighting && player.state === 'idle') {
      const rightInput = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0);
      if (rightInput === 0) {
        const upK = keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0;
        const dnK = keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0;
        const laneRotate = THREE.MathUtils.clamp((upK - dnK) + (keys.has('KeyQ') ? 1 : 0) - (keys.has('KeyE') ? 1 : 0) - mouseLook.dx * 0.08, -1.6, 1.6);
        if (Math.abs(laneRotate) > 0.01) {
          const relX = player.x - locked.x;
          const relZ = player.z - locked.z;
          const distOpp = Math.hypot(relX, relZ);
          if (distOpp > 0.4) {
            const ang = laneRotate * 1.55 * dt;
            const c = Math.cos(ang), sn = Math.sin(ang);
            player.x = locked.x + relX * c - relZ * sn;
            player.z = locked.z + relX * sn + relZ * c;
            pivotLocalVx = THREE.MathUtils.clamp(laneRotate * 0.7, -1, 1);
          }
        }
      }
    }
    const dx = locked.x - player.x, dz = locked.z - player.z;
    const d = Math.hypot(dx, dz) || 1;
    w.camFwd.set(dx / d, dz / d);
    w.yaw = Math.atan2(-w.camFwd.x, -w.camFwd.y);
    const n1x = -dz / d, n1z = dx / d;
    const dot = n1x * w.sideCamDir.x + n1z * w.sideCamDir.y;
    const goalX = dot >= 0 ? n1x : -n1x;
    const goalZ = dot >= 0 ? n1z : -n1z;
    w.sideCamDir.x += (goalX - w.sideCamDir.x) * (1 - Math.exp(-8 * dt));
    w.sideCamDir.y += (goalZ - w.sideCamDir.y) * (1 - Math.exp(-8 * dt));
    w.sideCamDir.normalize();
  } else {
    let orbit = 0;
    if (keys.has('KeyQ')) orbit += 1;
    if (keys.has('KeyE')) orbit -= 1;
    if (orbit) w.yaw += orbit * KB_YAW_SENS * dt * 60;
    w.yaw -= mouseLook.dx * 0.0042;
    w.pitch = Math.max(-1.3, Math.min(1.4, w.pitch - mouseLook.dy * 0.0032));
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
      if (w.spectator && target) {
        intent = aiIntent(f, target, dt, w.fighters.filter((x) => x.team === f.team && x.state !== 'dead'));
        if (canExecuteTarget(target) && Math.hypot(target.x - f.x, target.z - f.z) < 2.6 && f.state === 'idle' && Math.random() < 0.05) {
          const execEv = tryExecute(f, w.fighters);
          if (execEv) {
            sfx.execute();
            w.slowMo = Math.max(w.slowMo, 0.3);
            onHit(w, execEv);
          }
        }
      } else if (f === player) {
        intent = playerIntent(w, locked);
      } else if (target) {
        intent = aiIntent(f, target, dt, liveFoes);
      }
    }
    const prev = f.state;
    const prevQueued = f.queuedAtk;
    const strike = stepFighter(f, intent, dt, target);

    if (f === player) {
      if (pivotLocalVx !== 0) f.localVx = pivotLocalVx;
      if (f.state !== 'idle' && prev === 'idle') { b.light = 0; b.heavy = 0; b.bash = 0; b.dodge = 0; b.jump = 0; }
      if (f.airY > 0) b.jump = 0;
      if (f.parryHold > 0 || f.blocking) b.parry = 0;
      if (f.queuedAtk && f.queuedAtk !== prevQueued) { b.light = 0; b.heavy = 0; b.bash = 0; }
    }

    // Auto-scoop grounded fallen weapon if running closely over it
    if (fighting && f.weaponDisarmed && f.state === 'idle' && f.airY === 0) {
      if (tryPickupWeapon(f, w.weaponProps, 1.35)) {
        w.propVersion++;
        if (f === player) {
          sfx.parry();
          hud.set({ callout: { text: 'WEAPON RECLAIMED!', color: '#3ff0ff', id: ++w.calloutId } });
        }
      }
    }

    // Spawn dodge afterimages + sound
    if (f.state === 'dodge') {
      const startGhost = prev !== 'dodge';
      if (startGhost && f === player) sfx.dodge();
      const stepGhost = Math.floor(f.t / 0.09) > Math.floor(Math.max(0, f.t - dt) / 0.09);
      if (startGhost || stepGhost) {
        w.ghosts.spawn(f.x, f.z, f.yaw, f.stats.color, f.dodgeLocalZ * 0.45, -f.dodgeLocalX * 0.45);
      }
    }

    // Keep inside visible arena wall & detect Tekken Wall-Splat!
    const r = Math.hypot(f.x, f.z), lim = ARENA_RADIUS - f.stats.radius - 0.2;
    if (r > lim) {
      f.x *= lim / r;
      f.z *= lim / r;
      if (checkWallSplat(f, lim)) {
        sfx.guardBreak();
        w.hitstop = Math.max(w.hitstop, 0.12);
        w.shake = Math.max(w.shake, 0.65);
        w.shards.burst(f.x, 1.3, f.z, 20, 8, '#ff4fd8');
        if (f.team === 'e') hud.set({ callout: { text: 'WALL SPLAT!', color: '#ff4fd8', id: ++w.calloutId } });
      }
    }
    for (const o of w.fighters) {
      if (o === f || o.state === 'dead') continue;
      if (Math.abs(f.airY - o.airY) > 1.2) continue;
      const dx = f.x - o.x, dz = f.z - o.z, min = f.stats.radius + o.stats.radius, d = Math.hypot(dx, dz) || 1e-6;
      if (d < min) { const p = (min - d) / 2; f.x += (dx / d) * p; f.z += (dz / d) * p; }
    }

    if (strike && f.atk) {
      sfx.swing(f.atk === 'heavy' || f.atk === 'light3');
      const fg = gearOf(f);
      const motion = fg.moves[f.atk].motion;
      const slashColor = f.atk === 'light3' ? '#ffc95c' : motion === 'netThrow' ? '#3ff0ff' : f.team === 'p' ? f.stats.color : '#ff4f6d';
      w.slashes.spawn(f.x, f.z, f.yaw, f.atk, slashColor, f.style, motion);
      for (const e of resolveStrike(f, w.fighters)) onHit(w, e);
    }
  }

  for (const e of stepWeaponProps(w.weaponProps, w.fighters, dt, ARENA_RADIUS - 0.5)) {
    onHit(w, e);
  }

  b.light = Math.max(0, b.light - dt); b.heavy = Math.max(0, b.heavy - dt);
  b.bash = Math.max(0, b.bash - dt); b.dodge = Math.max(0, b.dodge - dt);
  b.parry = Math.max(0, b.parry - dt); b.jump = Math.max(0, b.jump - dt);

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
  const fg = gearOf(f);
  useFrame(() => {
    const h = g.current;
    if (!h) return;
    h.group.visible = f.state !== 'dead';
    h.group.position.set(f.x, 0, f.z);
    h.group.rotation.y = f.yaw;
    const p = h.pose;
    const at = f.atk ? ATTACKS[f.atk] : null;
    let progress = 0, tele = 0, parryFlash = 0;
    if (at && f.atk && f.state === 'windup') {
      const wt = windupOf(f, f.atk);
      progress = Math.min(1, f.t / wt);
      tele = f.team === 'e' ? 0.35 + progress * 0.65 : 0;
      if (f.team === 'e' && f.atk !== 'bash' && wt - f.t <= 0.30) {
        parryFlash = Math.min(1, Math.max(0, 1 - (wt - f.t) / 0.30));
      }
    } else if (at && f.state === 'strike') {
      progress = Math.min(1, f.t / at.strike);
    } else if (at && f.state === 'recover') {
      progress = Math.min(1, f.t / (at.recover * fg.recoverMul));
    } else if (f.state === 'dodge') {
      progress = Math.min(1, f.t / DODGE_TIME);
    } else if (f.state === 'stagger') {
      progress = Math.min(1, f.t / (f.stagger || 0.2));
    }
    p.state = f.state;
    p.atk = f.atk;
    p.motion = f.atk ? fg.moves[f.atk].motion : undefined;
    p.progress = progress;
    p.telegraph = tele;
    p.parryFlash = parryFlash;
    p.parryReady = f.blocking && f.blockT <= parryWindowOf(f) ? 1 : 0;
    p.riposte = f.riposte > 0 || f.riposteActive ? 1 : 0;
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
    p.dazed = f.dazed;
    p.guardHeight = f.guardHeight;
    p.weaponDisarmed = f.weaponDisarmed;
    p.airY = f.airY;
    p.diveKicking = f.diveKicking;
    p.wallSplat = f.wallSplat;
    p.hitReaction = f.hitReaction;
    p.hitReactionT = f.hitReactionT;
    p.finisherChoreo = f.finisherChoreo;
    p.finisherT = f.finisherT;
    p.coreColor = fg.coreColor;
    p.taunting = f.team === 'p' ? w.tauntT : 0;
    p.wireframeBoss = f.team === 'e' && w.specialKind === 'v01_boss';
    p.cyberLimbs = f.team === 'e' && w.specialKind === 'nemesis' ? w.nemesisCyberLimbs : undefined;
    const sp = Math.hypot(f.vx, f.vz);
    h.setMoving(f.state === 'dodge' ? 1 : Math.min(1, sp / (f.stats.speed * fg.speedMul)));
  });
  return (
    <Gladiator
      ref={g}
      gear={fg.visuals}
      color={f.stats.color}
      accent={f.team === 'p' ? '#ffc95c' : '#e9e6ff'}
      scale={
        f.team === 'e' && w.specialKind === 'garbage_collector' && f.kind === 'champion'
          ? 1.42
          : f.kind === 'brute' ? 1.24 : f.kind === 'champion' ? 1.15 : fg.scale
      }
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
  pelvis: [0.16, 0.14, 5], torso: [0.21, 0.50, 6], head: [0.10, 0.22, 6],
  thighL: [0.085, 0.42, 5], thighR: [0.085, 0.42, 5], shinL: [0.068, 0.40, 5], shinR: [0.068, 0.40, 5],
  uarmL: [0.072, 0.32, 5], uarmR: [0.072, 0.32, 5], farmL: [0.058, 0.28, 5], farmR: [0.058, 0.28, 5],
};
const PART_MAP = new Map(PARTS.map((p) => [p.name, p]));

/** The dead keep their low-poly PS1 polygon silhouette, flung about by physics. */
function RagdollView({ w, rag }: { w: ArenaWorld; rag: Ragdoll }) {
  const refs = useRef<(THREE.Group | null)[]>([]);
  const mat = useMemo(
    () => makePs1Material({
      color: new THREE.Color(rag.color).lerp(new THREE.Color('#e6dff2'), 0.65),
      map: getPs1Texture('tunic'),
    }),
    [rag.color],
  );
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
        const [r, h, seg] = STICK_DIMS[name];
        return (
          <group key={name} ref={(el) => { refs.current[i] = el; }} position={d.pos}>
            <mesh material={mat}><cylinderGeometry args={[r, r * 0.8, h, seg]} /></mesh>
          </group>
        );
      })}
    </group>
  );
}

/** Tumbling low-poly PS1 severed limb, shattered armor piece, or dropped weapon on the sand. */
function SeveredPieceView({ w, piece }: { w: ArenaWorld; piece: SeveredPiece }) {
  const limbRef = useRef<THREE.Group>(null!);
  const weaponRef = useRef<THREE.Group>(null!);
  const mats = useMemo(() => ({
    limb: makePs1Material({ color: new THREE.Color(piece.color).lerp(new THREE.Color('#e6dff2'), 0.65), map: getPs1Texture('tunic') }),
    bronze: makePs1Material({ color: '#ffd57e', map: getPs1Texture('bronze') }),
    wood: makePs1Material({ color: '#a8784e', map: getPs1Texture('wood') }),
    shield: makePs1Material({ color: piece.color, map: getPs1Texture('bronze') }),
    blade: makePs1Material({ color: '#e8eeff', map: getPs1Texture('bronze'), emissive: piece.color, emissiveIntensity: 0.2 }),
  }), [piece.color]);

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
          <mesh material={mats.wood}><cylinderGeometry args={[0.04, 0.04, 1.2, 5]} /></mesh>
          <mesh position={[0, -0.58, 0]} material={mats.bronze}><boxGeometry args={[0.26, 0.22, 0.42]} /></mesh>
        </group>
      );
    }
    if (piece.style === 'retiarius') {
      return (
        <group>
          <mesh material={mats.wood}><cylinderGeometry args={[0.032, 0.032, 1.4, 5]} /></mesh>
          <mesh position={[0, -0.7, 0]} material={mats.bronze}><boxGeometry args={[0.3, 0.05, 0.05]} /></mesh>
        </group>
      );
    }
    if (piece.style === 'hoplomachus') {
      return (
        <group>
          <mesh material={mats.wood}><cylinderGeometry args={[0.032, 0.032, 1.5, 5]} /></mesh>
          <mesh position={[0, -0.78, 0]} rotation={[Math.PI, 0, 0]} material={mats.blade}><coneGeometry args={[0.08, 0.25, 4]} /></mesh>
        </group>
      );
    }
    return <mesh material={mats.blade}><boxGeometry args={[0.06, 0.85, 0.07]} /></mesh>;
  };

  return (
    <group>
      <group ref={limbRef}>
        {piece.kind === 'helm' && (
          <group>
            <mesh material={mats.bronze}><cylinderGeometry args={[0.13, 0.145, 0.24, 6]} /></mesh>
            <mesh position={[0, 0.17, 0]} material={mats.shield}><boxGeometry args={[0.055, 0.16, 0.32]} /></mesh>
          </group>
        )}
        {piece.kind === 'pauldron' && (
          <group>
            <mesh material={mats.bronze}><icosahedronGeometry args={[0.17, 0]} /></mesh>
            <mesh position={[0, 0.18, 0]} material={mats.shield}><coneGeometry args={[0.06, 0.22, 4]} /></mesh>
          </group>
        )}
        {piece.kind === 'shield' && (
          <mesh rotation={[Math.PI / 2, 0, 0]} material={mats.shield}><cylinderGeometry args={[0.32, 0.32, 0.06, 8]} /></mesh>
        )}
        {piece.kind === 'weapon' && renderWeapon()}
        {piece.kind !== 'helm' && piece.kind !== 'pauldron' && piece.kind !== 'shield' && piece.kind !== 'weapon' && (
          <mesh material={mats.limb}><cylinderGeometry args={piece.kind === 'head' ? [0.1, 0.085, 0.22, 6] : [0.075, 0.06, 0.38, 5]} /></mesh>
        )}
      </group>
      {piece.weaponBody && piece.kind === 'armR' && (
        <group ref={weaponRef}>{renderWeapon()}</group>
      )}
      {piece.weaponBody && piece.kind === 'armL' && (
        <group ref={weaponRef}>
          {styleOf(piece.style).dualWield
            ? <mesh material={mats.blade}><boxGeometry args={[0.055, 0.78, 0.065]} /></mesh>
            : <mesh rotation={[Math.PI / 2, 0, 0]} material={mats.shield}><cylinderGeometry args={[0.26, 0.26, 0.06, 8]} /></mesh>}
        </group>
      )}
    </group>
  );
}

function Ring() {
  const mats = useMemo(() => {
    const sandTex = cloneTex(getPs1Texture('grid'), 11, 11);
    const stoneWallTex = cloneTex(getPs1Texture('circuit'), 16, 1.5);
    const stoneCapTex = cloneTex(getPs1Texture('conduit'), 2, 2);
    const bronzeTex = getPs1Texture('bronze');
    return {
      sand: makePs1Material({ color: '#8ae8ff', map: sandTex, emissive: '#0c2d42', emissiveIntensity: 0.4 }),
      stoneWall: makePs1Material({ color: '#394678', map: stoneWallTex, side: THREE.DoubleSide, emissive: '#10213d', emissiveIntensity: 0.35 }),
      stoneCap: makePs1Material({ color: '#2b3661', map: stoneCapTex, emissive: '#0e283b', emissiveIntensity: 0.4 }),
      bronze: makePs1Material({ color: '#4deeff', map: bronzeTex, emissive: '#22c2e8', emissiveIntensity: 0.5 }),
      iron: new THREE.MeshBasicMaterial({ color: '#07050c' }),
      markGold: new THREE.MeshBasicMaterial({ color: '#3ff0ff', transparent: true, opacity: 0.65 }),
      markCrimson: new THREE.MeshBasicMaterial({ color: '#ff4fd8', transparent: true, opacity: 0.55 }),
    };
  }, []);

  const wallShields = useMemo(() => {
    const out: { x: number; z: number; ry: number }[] = [];
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2 + Math.PI / 12;
      if (Math.abs(Math.sin(a)) > 0.92) continue; // skip N/S gate tunnels
      const r = ARENA_RADIUS + 0.48;
      out.push({ x: Math.cos(a) * r, z: Math.sin(a) * r, ry: -a + Math.PI / 2 });
    }
    return out;
  }, []);

  return (
    <group>
      {/* Textured PS1 Colosseum sand pit floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} material={mats.sand}>
        <circleGeometry args={[ARENA_RADIUS + 0.5, 24]} />
      </mesh>
      {/* Central octagonal stone medallion & battle ring lines */}
      <mesh position={[0, 0.02, 0]} material={mats.stoneCap}>
        <cylinderGeometry args={[2.2, 2.5, 0.06, 8]} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]} material={mats.markGold}>
        <ringGeometry args={[2.55, 2.75, 8]} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]} material={mats.markGold}>
        <ringGeometry args={[8.5, 8.68, 24]} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]} material={mats.markCrimson}>
        <ringGeometry args={[15.8, 16.05, 24]} />
      </mesh>

      {/* Chunky weathered stone arena podium wall (24-sided) + upper bronze coping */}
      <mesh position={[0, 1.3, 0]} material={mats.stoneWall}>
        <cylinderGeometry args={[ARENA_RADIUS + 0.65, ARENA_RADIUS + 0.65, 2.6, 24, 1, true]} />
      </mesh>
      <mesh position={[0, 2.7, 0]} rotation={[Math.PI / 2, 0, 0]} material={mats.bronze}>
        <torusGeometry args={[ARENA_RADIUS + 0.72, 0.24, 6, 24]} />
      </mesh>

      {/* Decorative bronze shields ringing the podium wall */}
      {wallShields.map((s, i) => (
        <group key={i} position={[s.x, 1.45, s.z]} rotation={[0, s.ry, 0]}>
          <mesh rotation={[Math.PI / 2, 0, 0]} material={mats.bronze}>
            <cylinderGeometry args={[0.62, 0.62, 0.14, 8]} />
          </mesh>
        </group>
      ))}

      {/* North & South Gladiator Entry Tunnels with portcullis grate */}
      {([-1, 1] as const).map((dir) => (
        <group key={dir} position={[0, 0, dir * (ARENA_RADIUS + 0.7)]}>
          <mesh position={[-1.9, 1.9, 0]} material={mats.stoneCap}><boxGeometry args={[0.9, 3.8, 1.8]} /></mesh>
          <mesh position={[1.9, 1.9, 0]} material={mats.stoneCap}><boxGeometry args={[0.9, 3.8, 1.8]} /></mesh>
          <mesh position={[0, 3.6, 0]} material={mats.bronze}><boxGeometry args={[5.0, 0.75, 2.0]} /></mesh>
          <mesh position={[0, 1.65, dir * 0.25]} material={mats.iron}><boxGeometry args={[2.9, 3.2, 0.8]} /></mesh>
          {[-0.9, -0.3, 0.3, 0.9].map((x) => (
            <mesh key={x} position={[x, 1.65, -dir * 0.2]} material={mats.bronze}><boxGeometry args={[0.09, 3.2, 0.09]} /></mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

const CROWD_COLORS = ['#3ff0ff', '#ff4fd8', '#ffc95c', '#a78bfa', '#4dffa0'];

const ARENA_THEME: Record<CapitalId, { bg: string; fog: string; hemi: string; key: string; fill: string; brazier: string }> = {
  cache_city: { bg: '#151029', fog: '#22173a', hemi: '#aba0e6', key: '#ffe4bd', fill: '#80d4ff', brazier: '#3ff0ff' },
  drift_bazaars: { bg: '#26140c', fog: '#3b1f10', hemi: '#ffcc8c', key: '#ffe09e', fill: '#ff9d57', brazier: '#ffc95c' },
  cold_vaults: { bg: '#101430', fog: '#1c224f', hemi: '#cbc4ff', key: '#f5f8ff', fill: '#b8a0ff', brazier: '#a78bfa' },
  rust_citadel: { bg: '#260a12', fog: '#3d0e1a', hemi: '#ff8591', key: '#ffb091', fill: '#ff5270', brazier: '#ff3b5c' },
  kernel_spire: { bg: '#1f1a0d', fog: '#332a14', hemi: '#ffefb3', key: '#fffae6', fill: '#ffe07d', brazier: '#ffd866' },
};

function Stands({ w, accentColor }: { w: ArenaWorld; accentColor: string }) {
  const mats = useMemo(() => {
    const stoneTierTex = cloneTex(getPs1Texture('circuit'), 20, 3);
    const stonePierTex = cloneTex(getPs1Texture('conduit'), 2, 4);
    const bannerTex = getPs1Texture('banner');
    const bronzeTex = getPs1Texture('bronze');
    return {
      tier: makePs1Material({ color: '#2b345c', map: stoneTierTex, side: THREE.DoubleSide, emissive: '#0c1a36', emissiveIntensity: 0.35 }),
      pier: makePs1Material({ color: '#394678', map: stonePierTex, emissive: '#0e2840', emissiveIntensity: 0.35 }),
      darkBay: new THREE.MeshBasicMaterial({ color: '#05040e' }),
      bronze: makePs1Material({ color: '#4deeff', map: bronzeTex, emissive: '#22c2e8', emissiveIntensity: 0.45 }),
      banner: makePs1Material({ color: '#3ff0ff', map: bannerTex, side: THREE.DoubleSide, emissive: '#1e78a8', emissiveIntensity: 0.4 }),
      crowdBody: makePs1Material({ color: '#ffffff', map: getPs1Texture('tunic'), emissive: '#2a2252', emissiveIntensity: 0.45 }),
      crowdHead: new THREE.MeshLambertMaterial({ color: '#e6f6ff', flatShading: true }),
    };
  }, []);

  const arches = useMemo(() => {
    const out: { x: number; z: number; ry: number }[] = [];
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const r = 32.5;
      out.push({ x: Math.cos(a) * r, z: Math.sin(a) * r, ry: -a + Math.PI / 2 });
    }
    return out;
  }, []);

  const braziers = useMemo(() => Array.from({ length: 8 }, (_, i) => {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    const r = ARENA_RADIUS + 1.4;
    return [Math.cos(a) * r, 2.75, Math.sin(a) * r] as [number, number, number];
  }), []);

  const crowdSpecs = useMemo(() => {
    const list: { x: number; y: number; z: number; ry: number; phase: number; color: THREE.Color }[] = [];
    const tiers = [
      { r: 21.8, y: 3.15, n: 32 },
      { r: 25.4, y: 4.95, n: 40 },
      { r: 29.0, y: 6.75, n: 48 },
    ];
    let idx = 0;
    for (const tier of tiers) {
      for (let i = 0; i < tier.n; i++) {
        const a = (i / tier.n) * Math.PI * 2 + (tier.y * 0.17);
        // Leave gap behind Emperor's Royal Box (North, sin(a) < -0.92)
        if (Math.sin(a) < -0.9 && tier.r < 27) continue;
        list.push({
          x: Math.cos(a) * tier.r,
          y: tier.y,
          z: Math.sin(a) * tier.r,
          ry: -a - Math.PI / 2,
          phase: idx * 0.73,
          color: new THREE.Color(CROWD_COLORS[idx % CROWD_COLORS.length]),
        });
        idx++;
      }
    }
    return list;
  }, []);

  const torsoMesh = useRef<THREE.InstancedMesh>(null!);
  const headMesh = useRef<THREE.InstancedMesh>(null!);
  const scratch = useMemo(() => ({ obj: new THREE.Object3D() }), []);
  const painted = useRef(false);

  useFrame(({ clock }) => {
    const tm = torsoMesh.current;
    const hm = headMesh.current;
    if (!tm || !hm) return;
    if (!painted.current) {
      painted.current = true;
      crowdSpecs.forEach((c, i) => {
        tm.setColorAt(i, c.color);
        hm.setColorAt(i, c.color);
      });
      if (tm.instanceColor) tm.instanceColor.needsUpdate = true;
      if (hm.instanceColor) hm.instanceColor.needsUpdate = true;
    }
    const hyped = w.shake > 0.05 || (w.fighters[0]?.comboStep ?? 0) >= 2 || w.phase === 'victory';
    const t = clock.elapsedTime;
    const o = scratch.obj;
    for (let i = 0; i < crowdSpecs.length; i++) {
      const c = crowdSpecs[i];
      const freq = hyped ? 11 : 2.6;
      const amp = hyped ? 0.36 : 0.07;
      const jump = Math.max(0, Math.sin(t * freq + c.phase)) * amp;
      o.position.set(c.x, c.y + 0.48 + jump, c.z);
      o.rotation.set(0, c.ry, hyped ? Math.sin(t * 14 + c.phase) * 0.14 : 0);
      o.scale.set(1, 1, 1);
      o.updateMatrix();
      tm.setMatrixAt(i, o.matrix);

      o.position.set(c.x, c.y + 1.05 + jump, c.z);
      o.rotation.set(0, c.ry, 0);
      o.updateMatrix();
      hm.setMatrixAt(i, o.matrix);
    }
    tm.instanceMatrix.needsUpdate = true;
    hm.instanceMatrix.needsUpdate = true;
  });

  return (
    <group>
      {/* 3 Tiered Colosseum Seating Risers & Horizontal Decks (open-center bowl) */}
      <mesh position={[0, 2.75, 0]} material={mats.tier}>
        <cylinderGeometry args={[19.6, 19.6, 0.9, 24, 1, true]} />
      </mesh>
      <mesh position={[0, 3.15, 0]} rotation={[-Math.PI / 2, 0, 0]} material={mats.tier}>
        <ringGeometry args={[19.5, 23.8, 24]} />
      </mesh>
      <mesh position={[0, 4.05, 0]} material={mats.tier}>
        <cylinderGeometry args={[23.6, 23.6, 1.85, 24, 1, true]} />
      </mesh>
      <mesh position={[0, 4.95, 0]} rotation={[-Math.PI / 2, 0, 0]} material={mats.tier}>
        <ringGeometry args={[23.5, 27.4, 24]} />
      </mesh>
      <mesh position={[0, 5.85, 0]} material={mats.tier}>
        <cylinderGeometry args={[27.2, 27.2, 1.85, 24, 1, true]} />
      </mesh>
      <mesh position={[0, 6.75, 0]} rotation={[-Math.PI / 2, 0, 0]} material={mats.tier}>
        <ringGeometry args={[27.1, 32.8, 24]} />
      </mesh>

      {/* Outer ring of 16 Monumental Roman Arches + Hanging Banners */}
      {arches.map((ar, i) => (
        <group key={i} position={[ar.x, 0, ar.z]} rotation={[0, ar.ry, 0]}>
          <mesh position={[-5.2, 7.6, 0]} material={mats.pier}><boxGeometry args={[2.2, 8.2, 2.6]} /></mesh>
          <mesh position={[0, 11.4, 0]} material={mats.pier}><boxGeometry args={[12.8, 1.8, 2.8]} /></mesh>
          <mesh position={[0, 12.6, 0]} material={mats.bronze}><boxGeometry args={[13.2, 0.65, 3.1]} /></mesh>
          <mesh position={[0, 7.2, 1.6]} material={mats.darkBay}><boxGeometry args={[11.2, 9.5, 0.5]} /></mesh>
          <mesh position={[0, 9.2, -1.55]} material={mats.banner}><boxGeometry args={[1.4, 3.0, 0.08]} /></mesh>
        </group>
      ))}

      {/* Emperor's Royal Box overlooking North Wall */}
      <group position={[0, 3.0, -21.2]}>
        <mesh position={[0, 0.7, 0]} material={mats.pier}><boxGeometry args={[8.4, 1.4, 4.2]} /></mesh>
        <mesh position={[0, 1.5, 2.15]} material={mats.bronze}><boxGeometry args={[8.6, 0.4, 0.35]} /></mesh>
        {([-3.6, -1.3, 1.3, 3.6] as const).map((x) => (
          <mesh key={x} position={[x, 3.3, 1.6]} material={mats.bronze}><cylinderGeometry args={[0.24, 0.28, 3.6, 6]} /></mesh>
        ))}
        <mesh position={[0, 5.25, 0.4]} material={mats.bronze}><boxGeometry args={[9.0, 0.65, 4.6]} /></mesh>
        <mesh position={[0, 6.2, 0.4]} rotation={[0, Math.PI / 4, 0]} material={mats.banner}><coneGeometry args={[5.4, 1.6, 4]} /></mesh>
        <mesh position={[-2.4, 3.3, 1.9]} material={mats.banner}><boxGeometry args={[1.2, 2.8, 0.08]} /></mesh>
        <mesh position={[2.4, 3.3, 1.9]} material={mats.banner}><boxGeometry args={[1.2, 2.8, 0.08]} /></mesh>
      </group>

      {/* 8 Podium Braziers (2 cast warm firelight on the sand) */}
      {braziers.map((pos, i) => (
        <Brazier key={i} position={pos} scale={0.95} light={i === 0 || i === 4} color={accentColor} />
      ))}

      {/* Instanced Low-Poly Cheering Spectators */}
      <instancedMesh ref={torsoMesh} args={[undefined, undefined, crowdSpecs.length]} material={mats.crowdBody} frustumCulled={false}>
        <cylinderGeometry args={[0.24, 0.3, 0.76, 5]} />
      </instancedMesh>
      <instancedMesh ref={headMesh} args={[undefined, undefined, crowdSpecs.length]} material={mats.crowdHead} frustumCulled={false}>
        <cylinderGeometry args={[0.15, 0.14, 0.28, 6]} />
      </instancedMesh>
    </group>
  );
}

function WeaponPropView({ prop }: { prop: ArenaWeaponProp }) {
  const grp = useRef<THREE.Group>(null!);
  const ring = useRef<THREE.Mesh>(null!);
  const mats = useMemo(() => ({
    wood: makePs1Material({ color: '#383254', map: getPs1Texture('wood') }),
    bronze: makePs1Material({ color: '#ffd06b', map: getPs1Texture('bronze'), emissive: '#7a5218', emissiveIntensity: 0.25 }),
    blade: makePs1Material({ color: '#e8fbff', map: getPs1Texture('bronze'), emissive: prop.color, emissiveIntensity: 0.65 }),
    ring: new THREE.MeshBasicMaterial({ color: '#3ff0ff', transparent: true, opacity: 0.85, side: THREE.DoubleSide }),
  }), [prop.color]);

  useFrame((state) => {
    const g = grp.current;
    if (!g) return;
    g.position.set(prop.x, prop.y, prop.z);
    g.rotation.set(prop.flying ? Math.PI / 2 : 0.18, prop.yaw, prop.flying ? prop.spin : state.clock.elapsedTime * 2.2);
    if (ring.current) {
      ring.current.visible = !prop.flying;
      ring.current.position.set(prop.x, 0.04, prop.z);
      const pulse = 1 + Math.sin(state.clock.elapsedTime * 8) * 0.14;
      ring.current.scale.set(pulse, pulse, 1);
    }
  });

  const fam = prop.gear?.visuals.weapon ?? (
    prop.style === 'executioner' ? 'warhammer'
    : prop.style === 'retiarius' ? 'trident'
    : prop.style === 'hoplomachus' ? 'spear'
    : prop.style === 'dimachaerus' ? 'twinSica'
    : 'gladius'
  );

  return (
    <group>
      <group ref={grp}>
        {fam === 'warhammer' ? (
          <group>
            <mesh material={mats.wood}><cylinderGeometry args={[0.04, 0.04, 1.32, 5]} /></mesh>
            <mesh position={[0, -0.62, 0]} material={mats.bronze}><boxGeometry args={[0.28, 0.24, 0.48]} /></mesh>
          </group>
        ) : fam === 'trident' ? (
          <group>
            <mesh material={mats.wood}><cylinderGeometry args={[0.032, 0.032, 1.5, 5]} /></mesh>
            <mesh position={[0, -0.74, 0]} material={mats.bronze}><boxGeometry args={[0.34, 0.06, 0.06]} /></mesh>
            <mesh position={[0, -0.88, 0]} rotation={[Math.PI, 0, 0]} material={mats.blade}><coneGeometry args={[0.06, 0.3, 4]} /></mesh>
          </group>
        ) : fam === 'spear' ? (
          <group>
            <mesh material={mats.wood}><cylinderGeometry args={[0.032, 0.032, 1.6, 5]} /></mesh>
            <mesh position={[0, -0.85, 0]} rotation={[Math.PI, 0, 0]} material={mats.blade}><coneGeometry args={[0.08, 0.28, 4]} /></mesh>
          </group>
        ) : (
          <group>
            <mesh position={[0, 0.25, 0]} material={mats.bronze}><boxGeometry args={[0.20, 0.045, 0.07]} /></mesh>
            <mesh position={[0, -0.15, 0]} material={mats.blade}><boxGeometry args={[0.06, 0.78, 0.075]} /></mesh>
          </group>
        )}
      </group>
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} material={mats.ring}>
        <ringGeometry args={[0.34, 0.48, 12]} />
      </mesh>
    </group>
  );
}

function Scene({ w, bout }: { w: ArenaWorld; bout: number }) {
  const camera = useThree((s) => s.camera);
  const activeColosseumId = useGame((s) => s.activeColosseumId);
  const col = COLOSSEUMS.find((c) => c.id === activeColosseumId) ?? COLOSSEUMS[0];
  const theme = ARENA_THEME[col.id] ?? ARENA_THEME.cache_city;
  const shardMesh = useRef<THREE.InstancedMesh>(null!);
  const [ragVer, setRagVer] = useState(0);
  const [debVer, setDebVer] = useState(0);
  const [propVer, setPropVer] = useState(0);
  const playerPos = useRef(new THREE.Vector3());
  const camPos = useRef(new THREE.Vector3(8.5, 2.35, 0));
  const look = useRef(new THREE.Vector3(0, 1.32, 0));
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
    const timeScale = w.slowMo > 0 ? 0.36 : 1;
    w.slowMo = Math.max(0, w.slowMo - dt);
    w.acc += dt * timeScale * (w.spectator ? w.spectatorSpeed : 1);
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
    if (propVer !== w.propVersion) setPropVer(w.propVersion);

    // HUD sync (only when values change)
    const p = w.fighters[0];
    const locked = getLockedTarget(w);
    const lockedName = w.lockOn && locked ? locked.stats.name : null;
    const executeReady = w.phase === 'fight' && p.state !== 'dead' && w.fighters.some(
      (f) => f.team === 'e' && canExecuteTarget(f) && Math.hypot(f.x - p.x, f.z - p.z) <= 4.2,
    );
    const armed = !p.weaponDisarmed;
    const playerLimbs = toLimbHud(p.limbs);
    const samePlayerLimbs = sameLimbHud(playerLimbs, hud.playerLimbs);
    const enemies = w.fighters.filter((f) => f.team === 'e').map((f) => ({
      id: f.id, name: f.stats.name, styleName: gearOf(f).name, hp: Math.ceil(f.hp), max: f.maxHp, limbs: toLimbHud(f.limbs),
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
        hud.maxHp !== p.maxHp || shown !== hud.phase || lockedName !== hud.lockedName ||
        p.comboStep !== hud.combo || executeReady !== hud.executeReady ||
        p.guardHeight !== hud.stance || armed !== hud.armed ||
        Math.round(w.crowdFavor) !== hud.crowdFavor ||
        Math.abs((hud.tauntCd ?? 0) - w.tauntCd) > 0.25
      ) {
        hud.set({
          hp, st, maxHp: p.maxHp, maxSt: p.maxStamina,
          playerLimbs: samePlayerLimbs ? hud.playerLimbs : playerLimbs,
          enemies: sameEnemies ? hud.enemies : enemies,
          phase: shown, lockedName, combo: p.comboStep, executeReady,
          stance: p.guardHeight, armed, crowdFavor: Math.round(w.crowdFavor), tauntCd: Number(w.tauntCd.toFixed(1)),
        });
      }
    }
    if (resultLive && !w.settled) {
      w.settled = true;
      const game = useGame.getState();
      const slayer = w.fighters.find((x) => x.team === 'e' && x.state !== 'dead')?.stats.name ?? 'the sand';
      if (w.spectator) {
        const outcome = game.settleSpectatorBout(w.phase === 'victory' ? 'red' : 'blue');
        hud.set({
          phase: outcome.victory ? 'victory' : 'defeat',
          earned: outcome.denariiDelta,
          enemies: [],
          callout: null,
        });
      } else if (w.card) {
        const outcome = game.settleBout({
          victory: w.phase === 'victory',
          kills: w.kills,
          parries: w.parries,
          armorsBroken: w.armorsBroken,
          limbsSevered: w.limbsSevered,
          usedFlask: w.usedFlask,
          weaponFamily: w.weaponFamily,
          card: w.card,
          cause: w.phase === 'defeat' ? `felled by ${slayer}` : undefined,
        });
        hud.set({
          phase: w.phase === 'victory' ? (w.card.tier === 4 ? 'champion' : 'victory') : 'defeat',
          earned: outcome.fameDelta,
          enemies: [],
          callout: null,
        });
      } else {
        const mul = p.mods.glory;
        if (w.phase === 'victory') {
          const earned = gloryForBout(bout, mul) + (isFinalBout(bout) ? Math.round(CHAMPION_BONUS * mul) : 0);
          game.addGlory(earned);
          if (isFinalBout(bout)) { game.recordChampion(); hud.set({ phase: 'champion', earned, enemies: [], callout: null }); }
          else hud.set({ phase: 'draft', earned, enemies: [], draft: drawBoons().map((b) => b.id), carryHp: carryHp(p.hp, p.maxHp), carryMax: p.maxHp, callout: null });
        } else {
          game.recordDeath({ name: 'A nameless gladiator', bouts: bout, cause: `slain by ${slayer}`, date: new Date().toISOString().slice(0, 10) });
          hud.set({ phase: 'defeat', enemies: [], callout: null });
        }
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

    // Cinematic intro sweep or Spectator Broadcast / 2.5D Side-Duel / Free cam
    const f = w.camFwd;
    playerPos.current.set(p.x, 0, p.z);
    if (w.spectator && w.spectatorCamMode === 'orbit') {
      const target = w.fighters[1] ?? p;
      const midX = (p.x + target.x) * 0.5;
      const midZ = (p.z + target.z) * 0.5;
      const orbAng = w.time * 0.45;
      desiredCam.current.set(midX + Math.sin(orbAng) * 10.5, 4.2, midZ + Math.cos(orbAng) * 10.5);
      desiredLook.current.set(midX, 1.35, midZ);
    } else if (w.lockOn && locked) {
      const midX = (p.x + locked.x) * 0.5;
      const midZ = (p.z + locked.z) * 0.5;
      const dist = Math.hypot(locked.x - p.x, locked.z - p.z);
      const camPull = THREE.MathUtils.clamp(5.8 + dist * 0.58, 6.2, 11.8);
      const midAirY = (p.airY + locked.airY) * 0.5;
      desiredCam.current.set(midX + w.sideCamDir.x * camPull, 2.35 + midAirY * 0.35, midZ + w.sideCamDir.y * camPull);
      desiredLook.current.set(midX, 1.32 + midAirY * 0.38, midZ);
    } else {
      const cp = Math.cos(w.pitch), sp = Math.sin(w.pitch);
      desiredCam.current.set(p.x - f.x * CAM_DIST, CAM_HEIGHT, p.z - f.y * CAM_DIST);
      desiredLook.current.set(p.x + f.x * LOOK_AHEAD * cp, LOOK_HEIGHT + LOOK_AHEAD * sp * 2.2, p.z + f.y * LOOK_AHEAD * cp);
    }
    if (w.phase === 'intro') {
      const st = Math.min(1, w.phaseT / 1.55);
      const introCamX = Math.sin(st * 1.1) * 7.5;
      const introCamY = 2.2 + st * 1.65;
      const introCamZ = -2.5 + st * 14;
      const aimX = locked?.x ?? 0;
      const aimZ = locked ? locked.z * (1 - st * 0.5) - 4 * (1 - st) : -6;
      desiredCam.current.set(
        THREE.MathUtils.lerp(introCamX, desiredCam.current.x, st * st),
        THREE.MathUtils.lerp(introCamY, desiredCam.current.y, st * st),
        THREE.MathUtils.lerp(introCamZ, desiredCam.current.z, st * st),
      );
      desiredLook.current.set(
        THREE.MathUtils.lerp(aimX, desiredLook.current.x, st * st),
        THREE.MathUtils.lerp(2.2, desiredLook.current.y, st * st),
        THREE.MathUtils.lerp(aimZ, desiredLook.current.z, st * st),
      );
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
      <color attach="background" args={[theme.bg]} />
      <fog attach="fog" args={[theme.fog, 28, 112]} />
      <hemisphereLight args={[theme.hemi, '#4a2e22', 1.25]} />
      <directionalLight position={[18, 30, 14]} intensity={1.68} color={theme.key} />
      <directionalLight position={[-18, 14, -20]} intensity={0.72} color={theme.fill} />
      <Ps1Sky mood="arena" />
      <Starfield playerPosRef={playerPos} />
      <Ring />
      <Stands w={w} accentColor={theme.brazier} />
      <TargetReticle w={w} />
      {w.fighters.map((f, i) => <FighterView key={f.id} w={w} index={i} />)}
      <SlashRibbons pool={w.slashes} />
      <DashGhosts pool={w.ghosts} />
      {w.ragdolls.map((r) => <RagdollView key={r.id} w={w} rag={r} />)}
      {w.debris.map((d) => <SeveredPieceView key={d.id} w={w} piece={d} />)}
      {w.weaponProps.map((pr) => <WeaponPropView key={pr.id} prop={pr} />)}
      <instancedMesh ref={shardMesh} args={[undefined, undefined, ShardPool.CAP]} frustumCulled={false}>
        <octahedronGeometry args={[1, 0]} />
        <meshBasicMaterial color="#ffffff" />
      </instancedMesh>
    </>
  );
}

export function Arena() {
  const bout = useArena((s) => s.bout);
  const cardId = useGame((s) => s.selectedCard?.id ?? null);
  const spectatorId = useGame((s) => s.spectatorBout?.id ?? null);
  const [world, setWorld] = useState<ArenaWorld | null>(null);
  useEffect(() => {
    setCurvature(0, 0, 0);
    let dead = false;
    let local: ArenaWorld | null = null;
    initPhysics().then(() => {
      if (dead) return;
      const a = useArena.getState();
      const gs = useGame.getState();
      local = newWorld(bout, gs.selectedCard, boutRosterFor(bout), a.boons, a.carryHp, a.carryMax, gs);
      a.set({
        phase: 'intro',
        hp: local.fighters[0].hp,
        maxHp: local.fighters[0].maxHp,
        st: local.fighters[0].maxStamina,
        maxSt: local.fighters[0].maxStamina,
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
  }, [bout, cardId, spectatorId]);
  if (!world || world.freed || world.bout !== bout) return null;
  return <Scene key={`${world.bout}-${cardId ?? spectatorId ?? 'run'}`} w={world} bout={world.bout} />;
}
