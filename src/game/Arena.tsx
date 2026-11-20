import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { Gladiator, type GladiatorHandle } from './Gladiator';
import { SynthwaveHorizon } from './art/SynthwaveHorizon';
import Starfield from './art/Starfield';
import { DoricColumn } from './art/ClassicalColumns';
import { ATTACKS, NO_INTENT, aiIntent, makeFighter, resolveStrike, stepFighter, DODGE_TIME, type Fighter, type HitEvent, type Intent, type Kind } from './arena/combat';
import { ARENA_RADIUS, createArenaWorld, initPhysics, RAPIER } from './arena/physics';
import { PARTS, Ragdoll } from './arena/ragdoll';
import { ShardPool } from './arena/effects';
import { useArena } from './arena/arenaStore';
import { keys, pressed } from './input';
import { useGame } from './store';

interface ArenaWorld {
  phys: RAPIER.World;
  fighters: Fighter[];
  ragdolls: Ragdoll[];
  shards: ShardPool;
  hitstop: number;
  shake: number;
  time: number;
  acc: number;
  phase: 'intro' | 'fight' | 'victory' | 'defeat';
  phaseT: number;
  ragVersion: number;
  buf: { light: number; heavy: number; dodge: number };
  camFwd: THREE.Vector2;
  settled: boolean;
}

function newWorld(bout: number, roster: Kind[]): ArenaWorld {
  const fighters = [makeFighter(0, 'player', 0, 8)];
  roster.forEach((k, i) => fighters.push(makeFighter(i + 1, k, (i - (roster.length - 1) / 2) * 4, -8)));
  return {
    phys: createArenaWorld(), fighters, ragdolls: [], shards: new ShardPool(), hitstop: 0, shake: 0, time: 0, acc: 0,
    phase: 'intro', phaseT: 0, ragVersion: 0, buf: { light: 0, heavy: 0, dodge: 0 }, camFwd: new THREE.Vector2(0, -1), settled: false,
  };
}

const nearestFoe = (f: Fighter, all: Fighter[]): Fighter | null => {
  let best: Fighter | null = null, bd = Infinity;
  for (const o of all) if (o.team !== f.team && o.state !== 'dead') { const d = Math.hypot(o.x - f.x, o.z - f.z); if (d < bd) { bd = d; best = o; } }
  return best;
};

function onHit(w: ArenaWorld, e: HitEvent) {
  const v = w.fighters.find((f) => f.id === e.victim)!;
  const a = w.fighters.find((f) => f.id === e.attacker)!;
  const y = 1.3;
  if (e.type === 'parry') {
    w.hitstop = Math.max(w.hitstop, 0.15); w.shake = Math.max(w.shake, 0.5);
    w.shards.burst(e.x, y, e.z, 26, 9, '#ffc95c');
  } else if (e.type === 'block') {
    w.hitstop = Math.max(w.hitstop, 0.05); w.shake = Math.max(w.shake, 0.18);
    w.shards.burst(e.x, y, e.z, 8, 5, '#a78bfa', e.dx, e.dz);
  } else if (e.type === 'hit') {
    w.hitstop = Math.max(w.hitstop, e.heavy ? 0.11 : 0.06); w.shake = Math.max(w.shake, e.heavy ? 0.6 : 0.25);
    w.shards.burst(v.x, y, v.z, e.heavy ? 22 : 12, e.heavy ? 8 : 5, v.stats.color, e.dx, e.dz);
  } else {
    w.hitstop = Math.max(w.hitstop, 0.2); w.shake = Math.max(w.shake, 0.9);
    w.shards.burst(v.x, y, v.z, 30, 10, v.stats.color, e.dx, e.dz);
    w.ragdolls.push(new Ragdoll(w.phys, {
      x: v.x, z: v.z, yaw: v.yaw, vx: v.vx * 0.5, vz: v.vz * 0.5,
      hitX: e.dx, hitZ: e.dz, hitSpeed: e.heavy ? 17 : 10, color: v.stats.color,
    }));
    w.ragVersion++;
  }
  void a;
}

function playerIntent(w: ArenaWorld, f: Fighter, target: Fighter | null): Intent {
  const b = w.buf;
  const fx = w.camFwd.x, fz = w.camFwd.y;
  let fwd = 0, side = 0;
  if (keys.has('KeyW')) fwd += 1;
  if (keys.has('KeyS')) fwd -= 1;
  if (keys.has('KeyD')) side += 1;
  if (keys.has('KeyA')) side -= 1;
  const rx = -fz, rz = fx;
  const l = Math.hypot(fwd, side);
  const it: Intent = {
    moveX: l > 0 ? (fx * fwd + rx * side) / l : 0,
    moveZ: l > 0 ? (fz * fwd + rz * side) / l : 0,
    light: b.light > 0, heavy: b.heavy > 0, block: keys.has('ShiftLeft') || keys.has('ShiftRight') || keys.has('KeyL'), dodge: b.dodge > 0,
  };
  void f; void target;
  return it;
}

function simulate(w: ArenaWorld, dt: number, bout: number) {
  const hud = useArena.getState();
  w.time += dt; w.phaseT += dt;
  w.shake = Math.max(0, w.shake - dt * 2.4);
  const b = w.buf;
  if (pressed('KeyJ') || pressed('Mouse0')) b.light = 0.18;
  if (pressed('KeyK') || pressed('Mouse2')) b.heavy = 0.18;
  if (pressed('Space')) b.dodge = 0.14;

  if (w.phase === 'intro') {
    if (w.phaseT > 1.6) { w.phase = 'fight'; w.phaseT = 0; hud.set({ phase: 'fight', banner: '' }); }
  }
  const fighting = w.phase === 'fight';

  if (w.hitstop > 0) { w.hitstop -= dt; return; }
  const player = w.fighters[0];
  for (const f of w.fighters) {
    if (f.state === 'dead') continue;
    const foe = nearestFoe(f, w.fighters);
    if (foe && f === player) { const dx = foe.x - f.x, dz = foe.z - f.z, d = Math.hypot(dx, dz) || 1; w.camFwd.set(dx / d, dz / d); }
    let intent: Intent = NO_INTENT;
    if (fighting && foe) intent = f === player ? playerIntent(w, f, foe) : aiIntent(f, foe, dt);
    const prev = f.state;
    const strike = stepFighter(f, intent, dt, foe);
    if (f === player && f.state !== 'idle' && prev === 'idle') { b.light = 0; b.heavy = 0; b.dodge = 0; }

    // keep inside the visible wall, and don't overlap other fighters
    const r = Math.hypot(f.x, f.z), lim = ARENA_RADIUS - f.stats.radius - 0.2;
    if (r > lim) { f.x *= lim / r; f.z *= lim / r; }
    for (const o of w.fighters) {
      if (o === f || o.state === 'dead') continue;
      const dx = f.x - o.x, dz = f.z - o.z, min = f.stats.radius + o.stats.radius, d = Math.hypot(dx, dz) || 1e-6;
      if (d < min) { const p = (min - d) / 2; f.x += (dx / d) * p; f.z += (dz / d) * p; }
    }
    if (strike) for (const e of resolveStrike(f, w.fighters)) onHit(w, e);
  }
  b.light = Math.max(0, b.light - dt); b.heavy = Math.max(0, b.heavy - dt); b.dodge = Math.max(0, b.dodge - dt);

  // end of bout
  if (fighting) {
    const foesLeft = w.fighters.some((f) => f.team === 'e' && f.state !== 'dead');
    if (player.state === 'dead') { w.phase = 'defeat'; w.phaseT = 0; }
    else if (!foesLeft) { w.phase = 'victory'; w.phaseT = 0; }
  }
  void bout;
}

function FighterView({ w, index }: { w: ArenaWorld; index: number }) {
  const g = useRef<GladiatorHandle>(null!);
  const f = w.fighters[index];
  useFrame(() => {
    const h = g.current;
    if (!h) return;
    h.group.visible = f.state !== 'dead';
    h.group.position.set(f.x, 0, f.z);
    h.group.rotation.y = f.yaw;
    const p = h.pose;
    const at = f.atk ? ATTACKS[f.atk] : null;
    let swing = 0, tele = 0;
    if (at && f.state === 'windup') {
      const wt = at.windup * f.stats.windupMul;
      const k = Math.min(1, f.t / wt);
      swing = -k * 2.0; tele = f.team === 'e' ? 0.3 + k * 0.7 : 0;
    } else if (at && f.state === 'strike') { swing = -2.0 + (f.t / at.strike) * 3.6; }
    else if (at && f.state === 'recover') { swing = 1.6 * (1 - f.t / at.recover); }
    p.swing += (swing - p.swing) * 0.5;
    p.telegraph = tele;
    p.block += ((f.blocking ? 1 : 0) - p.block) * 0.35;
    p.hurt = f.state === 'stagger' ? Math.max(0, 1 - f.t / 0.2) : Math.max(0, p.hurt - 0.1);
    const sp = Math.hypot(f.vx, f.vz);
    h.setMoving(f.state === 'dodge' ? 1 : Math.min(1, sp / f.stats.speed));
    if (f.state === 'dodge') h.group.rotation.x = Math.sin((f.t / DODGE_TIME) * Math.PI) * 0.5; else h.group.rotation.x = 0;
  });
  return <Gladiator ref={g} color={f.stats.color} accent={f.team === 'p' ? '#ffc95c' : '#e9e6ff'} scale={f.kind === 'brute' ? 1.3 : f.kind === 'champion' ? 1.15 : 1} />;
}

function RagdollView({ rag }: { rag: Ragdoll }) {
  const refs = useRef<(THREE.Group | null)[]>([]);
  useFrame(() => {
    rag.bodies.forEach((b, i) => {
      const g = refs.current[i];
      if (!g) return;
      const t = b.translation(), q = b.rotation();
      g.position.set(t.x, t.y, t.z); g.quaternion.set(q.x, q.y, q.z, q.w);
    });
  });
  return (
    <group>
      {PARTS.map((d, i) => (
        <group key={d.name} ref={(el) => { refs.current[i] = el; }} position={d.pos}>
          <mesh>
            {d.shape === 'box' ? <boxGeometry args={[d.size[0] * 2, d.size[1] * 2, d.size[2] * 2]} />
              : d.shape === 'ball' ? <icosahedronGeometry args={[d.size[0], 1]} />
              : <capsuleGeometry args={[d.size[1], d.size[0] * 2, 3, 8]} />}
            <meshBasicMaterial color="#0b051b" />
          </mesh>
          <mesh scale={1.08}>
            {d.shape === 'box' ? <boxGeometry args={[d.size[0] * 2, d.size[1] * 2, d.size[2] * 2]} />
              : d.shape === 'ball' ? <icosahedronGeometry args={[d.size[0], 1]} />
              : <capsuleGeometry args={[d.size[1], d.size[0] * 2, 3, 8]} />}
            <meshBasicMaterial color={rag.color} wireframe />
          </mesh>
        </group>
      ))}
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
  const playerPos = useRef(new THREE.Vector3());
  const camPos = useRef(new THREE.Vector3(0, 8, 19));
  const look = useRef(new THREE.Vector3());

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    const hud = useArena.getState();
    w.acc += dt;
    while (w.acc >= 1 / 60) {
      w.acc -= 1 / 60;
      const frozen = w.hitstop > 0;
      simulate(w, 1 / 60, bout);
      if (!frozen || w.ragdolls.length) {
        if (w.ragdolls.length) w.phys.step();
        for (const r of [...w.ragdolls]) {
          if (r.tick(1 / 60)) {
            r.bodies.forEach((b) => { const t = b.translation(); w.shards.burst(t.x, t.y, t.z, 6, 7, r.color); });
            r.dispose(); w.ragdolls.splice(w.ragdolls.indexOf(r), 1); w.ragVersion++;
          }
        }
      }
      w.shards.update(1 / 60, shardMesh.current);
    }
    if (ragVer !== w.ragVersion) setRagVer(w.ragVersion);

    // HUD sync (only when values change)
    const p = w.fighters[0];
    const enemies = w.fighters.filter((f) => f.team === 'e').map((f) => ({ id: f.id, name: f.stats.name, hp: Math.ceil(f.hp), max: f.maxHp }));
    const sameEnemies = enemies.length === hud.enemies.length && enemies.every((e, i) => e.hp === hud.enemies[i].hp);
    const hp = Math.ceil(p.hp), st = Math.floor(p.stamina);
    const resultLive = (w.phase === 'victory' || w.phase === 'defeat') && w.phaseT > 2.2;
    const shown = w.phase === 'intro' ? 'intro' : resultLive ? w.phase : 'fight';
    if (hp !== hud.hp || st !== hud.st || !sameEnemies || hud.maxHp !== p.maxHp || shown !== hud.phase) {
      hud.set({ hp, st, maxHp: p.maxHp, maxSt: p.maxStamina, enemies: sameEnemies ? hud.enemies : enemies, phase: shown });
    }
    if (resultLive && !w.settled) {
      w.settled = true;
      const game = useGame.getState();
      if (w.phase === 'victory') game.addGlory(25);
      else game.recordDeath({ name: 'A nameless gladiator', bouts: bout, cause: `slain by ${w.fighters.find((x) => x.team === 'e' && x.state !== 'dead')?.stats.name ?? 'the sand'}`, date: new Date().toISOString().slice(0, 10) });
    }

    // camera: behind the player, looking toward the foe
    const f = w.camFwd;
    playerPos.current.set(p.x, 0, p.z);
    const target = new THREE.Vector3(p.x - f.x * 9.5, 6.8, p.z - f.y * 9.5);
    camPos.current.lerp(target, 1 - Math.exp(-5 * dt));
    camera.position.copy(camPos.current);
    if (w.shake > 0) camera.position.add(new THREE.Vector3((Math.random() - 0.5) * w.shake * 0.6, (Math.random() - 0.5) * w.shake * 0.4, (Math.random() - 0.5) * w.shake * 0.6));
    look.current.lerp(new THREE.Vector3(p.x + f.x * 3.5, 1.4, p.z + f.y * 3.5), 1 - Math.exp(-6 * dt));
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
      {w.fighters.map((f, i) => <FighterView key={f.id} w={w} index={i} />)}
      {w.ragdolls.map((r) => <RagdollView key={r.id} rag={r} />)}
      <instancedMesh ref={shardMesh} args={[undefined, undefined, ShardPool.CAP]} frustumCulled={false}>
        <octahedronGeometry args={[1, 0]} />
        <meshBasicMaterial color="#ffffff" />
      </instancedMesh>
    </>
  );
}

export function Arena() {
  const [ready, setReady] = useState(false);
  const bout = useArena((s) => s.bout);
  const w = useRef<ArenaWorld | null>(null);
  useEffect(() => {
    let dead = false;
    initPhysics().then(() => {
      if (dead) return;
      w.current = newWorld(bout, ['skirmisher']);
      useArena.getState().set({ phase: 'intro', hp: 100, st: 100, enemies: [], banner: `BOUT ${bout}` });
      setReady(true);
    });
    return () => { dead = true; w.current?.phys.free(); w.current = null; setReady(false); };
  }, [bout]);
  void useGame;
  if (!ready || !w.current) return null;
  return <Scene w={w.current} bout={bout} />;
}
