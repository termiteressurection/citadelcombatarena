import { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { Gladiator, type GladiatorHandle } from './Gladiator';
import { Stations } from './Stations';
import { StaticBatch } from './art/StaticBatch';
import { Brazier, Ps1Sky } from './art/Ps1Sky';
import { cloneTex, getPs1Texture, makePs1Material } from './art/ps1Textures';
import { SurrealSpores } from './art/SurrealSpores';
import Starfield from './art/Starfield';
import { CorinthianColumn, DoricColumn, IonicColumn } from './art/ClassicalColumns';
import { ACCENTS } from './art/palette';
import { BASIN, BOUNDS, COLUMNS, PLAYER_START, SOLIDS, nearestStation } from './world/layout';
import { clampBounds, isFree, resolveCircles } from './world/colliders';
import { keys, pressed } from './input';
import { lookColor } from './arena/run';
import { type StyleId } from './arena/styles';
import { gearFromStyle, resolveLoadout } from './rpg/items';
import { useGame } from './store';

const PLAYER_R = 0.55;
// Citadel camera rig, constants carried over cleanly
const MOVE_SPEED = 0.27 * 60;
const KB_YAW_SENS = 0.06;
const CAMERA_SOCKET_DISTANCE = 5.2;
const CAMERA_SOCKET_HEIGHT = 3.35;
const CAMERA_LOOK_AHEAD = 8.8;
const CAMERA_LOOK_HEIGHT = 1.55;
const CAMERA_MOVE_LEAD = 0.9;
const CAMERA_LERP = 0.18;
const EYE_Y = 1.6;

type PosRef = React.MutableRefObject<THREE.Vector3>;

function Colonnade({ playerPos }: { playerPos: PosRef }) {
  return (
    <group>
      {COLUMNS.map((c, i) => {
        const P = c.order === 'doric' ? DoricColumn : c.order === 'ionic' ? IonicColumn : CorinthianColumn;
        return <P key={i} position={c.pos} scale={c.scale} playerPos={playerPos} />;
      })}
    </group>
  );
}

/** Chunky textured PS1 stone parapet walls & Forum braziers framing the Roman Town terrace. */
function Parapet() {
  const { minX, maxX, minZ, maxZ } = BOUNDS;
  const w = maxX - minX, d = maxZ - minZ, cx = (minX + maxX) / 2, cz = (minZ + maxZ) / 2;
  const mats = useMemo(() => ({
    wall: makePs1Material({ color: '#c4b8d6', map: cloneTex(getPs1Texture('stone'), 24, 1) }),
    trim: makePs1Material({ color: '#ffd480', map: cloneTex(getPs1Texture('bronze'), 16, 1) }),
  }), []);
  const seg = (x: number, z: number, sx: number, sz: number, k: string) => (
    <group key={k} position={[x, 0, z]}>
      <mesh position={[0, 0.7, 0]} material={mats.wall}><boxGeometry args={[sx, 1.4, sz]} /></mesh>
      <mesh position={[0, 1.46, 0]} material={mats.trim}><boxGeometry args={[sx + 0.12, 0.16, sz + 0.12]} /></mesh>
    </group>
  );
  return (
    <group>
      {seg(cx, minZ - 0.5, w + 1.8, 0.9, 'n')}
      {seg(cx, maxZ + 0.5, w + 1.8, 0.9, 's')}
      {seg(minX - 0.5, cz, 0.9, d, 'w')}
      {seg(maxX + 0.5, cz, 0.9, d, 'e')}
      <Brazier position={[minX + 1.5, 1.5, maxZ - 1.5]} scale={0.85} />
      <Brazier position={[maxX - 1.5, 1.5, maxZ - 1.5]} scale={0.85} />
      <Brazier position={[minX + 1.5, 1.5, minZ + 1.5]} scale={0.85} />
      <Brazier position={[maxX - 1.5, 1.5, minZ + 1.5]} scale={0.85} />
      {/* Forum Market & Gate Braziers */}
      <Brazier position={[-16, 0, -2]} scale={0.92} light />
      <Brazier position={[16, 0, -2]} scale={0.92} />
      <Brazier position={[-16, 0, -20]} scale={0.92} />
      <Brazier position={[16, 0, -20]} scale={0.92} />
      <Brazier position={[-7, 0, 22]} scale={0.88} />
      <Brazier position={[7, 0, 22]} scale={0.88} />
    </group>
  );
}

/** Dithered PS1 cobblestone Roman hilltop terrace perched above the valley. */
function TempleFloor({ morning }: { morning: boolean }) {
  const mats = useMemo(() => {
    const w = BOUNDS.maxX - BOUNDS.minX + 4;
    const d = BOUNDS.maxZ - BOUNDS.minZ + 4;
    return {
      cobble: makePs1Material({ color: '#dfd5c2', map: cloneTex(getPs1Texture('cobble'), 22, 24) }),
      cliff: makePs1Material({ color: '#6b6080', map: cloneTex(getPs1Texture('stone'), Math.round(w / 4), Math.round(d / 16)) }),
    };
  }, []);
  const cx = (BOUNDS.minX + BOUNDS.maxX) / 2;
  const cz = (BOUNDS.minZ + BOUNDS.maxZ) / 2;
  const w = BOUNDS.maxX - BOUNDS.minX + 2;
  const d = BOUNDS.maxZ - BOUNDS.minZ + 2;
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -6.5, 0]}>
        <circleGeometry args={[340, 24]} />
        <meshBasicMaterial color={morning ? '#162238' : '#07040e'} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[cx, 0, cz]} material={mats.cobble}>
        <planeGeometry args={[w, d]} />
      </mesh>
      <mesh position={[cx, -3.26, cz]} material={mats.cliff}>
        <boxGeometry args={[w + 2, 6.4, d + 2]} />
      </mesh>
    </group>
  );
}

/** Roman Forum flagstone marketplace, paved avenues, and animated central Basin fountain. */
function Court() {
  const waterRef = useRef<THREE.Mesh>(null!);
  const mats = useMemo(() => {
    const waterTex = cloneTex(getPs1Texture('water'), 3, 3);
    return {
      forumSquare: makePs1Material({ color: '#e6dcc8', map: cloneTex(getPs1Texture('flagstone'), 15, 11) }),
      paver: makePs1Material({ color: '#d8cfe8', map: cloneTex(getPs1Texture('stone'), 3, 22) }),
      sidePaver: makePs1Material({ color: '#cfc5df', map: cloneTex(getPs1Texture('stone'), 12, 2) }),
      trim: makePs1Material({ color: '#ffd480', map: getPs1Texture('bronze') }),
      stone: makePs1Material({ color: '#cfc5df', map: cloneTex(getPs1Texture('stone'), 4, 1) }),
      water: makePs1Material({ color: '#ffffff', map: waterTex, emissive: '#1e6e8c', emissiveIntensity: 0.35 }),
      waterTex,
    };
  }, []);

  useFrame(({ clock }) => {
    if (mats.waterTex) {
      mats.waterTex.offset.x = clock.elapsedTime * 0.04;
      mats.waterTex.offset.y = Math.sin(clock.elapsedTime * 0.5) * 0.03;
    }
    if (waterRef.current) waterRef.current.position.y = 1.42 + Math.sin(clock.elapsedTime * 1.8) * 0.025;
  });

  return (
    <group>
      {/* Broad Forum Marketplace Flagstone Square */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, -6]} material={mats.forumSquare}>
        <planeGeometry args={[60, 44]} />
      </mesh>
      {/* Main Processional Colosseum Avenue from Barracks (+40) to Gate (-52) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.022, -6]} material={mats.paver}>
        <planeGeometry args={[6.4, 92]} />
      </mesh>
      {([-3.25, 3.25] as const).map((x) => (
        <mesh key={x} position={[x, 0.038, -6]} material={mats.trim}>
          <boxGeometry args={[0.18, 0.05, 92]} />
        </mesh>
      ))}
      {/* Cross-walkways linking all 9 stations seamlessly */}
      {([30, 12, -10, -26] as const).map((z) => (
        <mesh key={z} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.017, z]} material={mats.sidePaver}>
          <planeGeometry args={[52, 4.2]} />
        </mesh>
      ))}

      {/* Stepped Octagonal Forum Fountain Basin */}
      <group position={[BASIN.x, 0, BASIN.z]}>
        <mesh position={[0, 0.16, 0]} material={mats.stone}><cylinderGeometry args={[3.4, 3.6, 0.32, 8]} /></mesh>
        <mesh position={[0, 0.85, 0]} material={mats.stone}><cylinderGeometry args={[2.8, 2.5, 1.1, 8]} /></mesh>
        <mesh position={[0, 1.42, 0]} rotation={[Math.PI / 2, 0, Math.PI / 8]} material={mats.trim}><torusGeometry args={[2.76, 0.16, 6, 8]} /></mesh>
        <mesh ref={waterRef} position={[0, 1.42, 0]} rotation={[-Math.PI / 2, 0, 0]} material={mats.water}><circleGeometry args={[2.65, 8]} /></mesh>
      </group>
    </group>
  );
}

interface TownBuilding {
  pos: [number, number, number];
  w: number;
  h: number;
  d: number;
  rotY: number;
  tint: string;
}

const TOWNHOUSES: TownBuilding[] = [
  // East & West Roman Townhouse Rows framing the Forum outside walkable bounds
  { pos: [-55, 0, 26], w: 10, h: 6.2, d: 11, rotY: Math.PI / 2, tint: '#e8dac0' },
  { pos: [-55, 0, 6], w: 10, h: 7.4, d: 12, rotY: Math.PI / 2, tint: '#dfcbb0' },
  { pos: [-55, 0, -14], w: 10, h: 5.8, d: 11, rotY: Math.PI / 2, tint: '#d6c2a8' },
  { pos: [-55, 0, -36], w: 10, h: 6.8, d: 12, rotY: Math.PI / 2, tint: '#e8dac0' },
  { pos: [55, 0, 26], w: 10, h: 6.6, d: 12, rotY: -Math.PI / 2, tint: '#dfcbb0' },
  { pos: [55, 0, 6], w: 10, h: 5.9, d: 11, rotY: -Math.PI / 2, tint: '#e8dac0' },
  { pos: [55, 0, -14], w: 10, h: 7.2, d: 12, rotY: -Math.PI / 2, tint: '#d6c2a8' },
  { pos: [55, 0, -36], w: 10, h: 6.0, d: 11, rotY: -Math.PI / 2, tint: '#dfcbb0' },
  // South Barracks Wings & North Colosseum Wing Towers
  { pos: [-24, 0, 51], w: 13, h: 6.2, d: 9, rotY: Math.PI, tint: '#dfcbb0' },
  { pos: [0, 0, 52], w: 15, h: 7.4, d: 9, rotY: Math.PI, tint: '#e8dac0' },
  { pos: [24, 0, 51], w: 13, h: 6.2, d: 9, rotY: Math.PI, tint: '#d6c2a8' },
  { pos: [-28, 0, -69], w: 11, h: 8.4, d: 10, rotY: 0, tint: '#d6c2a8' },
  { pos: [28, 0, -69], w: 11, h: 8.4, d: 10, rotY: 0, tint: '#dfcbb0' },
];

const CYPRESS_POS: [number, number][] = [
  [-47.2, 36], [47.2, 36],
  [-47.2, 16], [47.2, 16],
  [-47.2, -4], [47.2, -4],
  [-47.2, -24], [47.2, -24],
  [-47.2, -44], [47.2, -44],
  [-47.2, -58], [47.2, -58],
];

/** Low-poly PS1 Mediterranean stucco townhouses & tapered cypress perimeter framing the Roman town. */
function TownPerimeter() {
  const mats = useMemo(() => ({
    plasterA: makePs1Material({ color: '#e8dac0', map: cloneTex(getPs1Texture('plaster'), 2, 2) }),
    plasterB: makePs1Material({ color: '#dfcbb0', map: cloneTex(getPs1Texture('plaster'), 2, 2) }),
    plasterC: makePs1Material({ color: '#d6c2a8', map: cloneTex(getPs1Texture('plaster'), 2, 2) }),
    roof: makePs1Material({ color: '#cc6844', map: cloneTex(getPs1Texture('roof'), 3, 2) }),
    stone: makePs1Material({ color: '#9c92ac', map: getPs1Texture('stone') }),
    door: makePs1Material({ color: '#241812', map: getPs1Texture('wood') }),
    windowGlow: new THREE.MeshBasicMaterial({ color: '#ffb85c' }),
    trunk: makePs1Material({ color: '#5a3a24', map: getPs1Texture('wood') }),
    foliageLow: makePs1Material({ color: '#1f4a2e', map: getPs1Texture('stone') }),
    foliageTop: makePs1Material({ color: '#29603b', map: getPs1Texture('stone') }),
  }), []);

  return (
    <group>
      {TOWNHOUSES.map((b, i) => {
        const wallMat = b.tint === '#e8dac0' ? mats.plasterA : b.tint === '#dfcbb0' ? mats.plasterB : mats.plasterC;
        const roofRadius = Math.max(b.w, b.d) * 0.76;
        return (
          <group key={`house-${i}`} position={b.pos} rotation={[0, b.rotY, 0]}>
            {/* Stone plinth */}
            <mesh position={[0, 0.35, 0]} material={mats.stone}><boxGeometry args={[b.w + 0.5, 0.7, b.d + 0.5]} /></mesh>
            {/* Stucco body */}
            <mesh position={[0, 0.7 + b.h / 2, 0]} material={wallMat}><boxGeometry args={[b.w, b.h, b.d]} /></mesh>
            {/* 4-sided pitched terracotta tile roof */}
            <mesh position={[0, 0.7 + b.h + 1.45, 0]} rotation={[0, Math.PI / 4, 0]} material={mats.roof}>
              <coneGeometry args={[roofRadius, 2.9, 4]} />
            </mesh>
            {/* Front dark doorway + warm glowing PS1 windows facing the Forum */}
            <mesh position={[0, 1.45, b.d / 2 + 0.05]} material={mats.door}><boxGeometry args={[1.6, 2.3, 0.14]} /></mesh>
            {([-b.w * 0.28, b.w * 0.28] as const).map((wx, wi) => (
              <mesh key={wi} position={[wx, b.h * 0.68, b.d / 2 + 0.05]} material={mats.windowGlow}>
                <boxGeometry args={[1.15, 1.35, 0.12]} />
              </mesh>
            ))}
          </group>
        );
      })}

      {CYPRESS_POS.map(([x, z], i) => {
        const hMul = 0.92 + (i % 3) * 0.14;
        return (
          <group key={`cypress-${i}`} position={[x, 0, z]} scale={[1, hMul, 1]}>
            <mesh position={[0, 0.45, 0]} material={mats.stone}><boxGeometry args={[1.5, 0.9, 1.5]} /></mesh>
            <mesh position={[0, 1.8, 0]} material={mats.trunk}><cylinderGeometry args={[0.16, 0.22, 1.8, 5]} /></mesh>
            <mesh position={[0, 4.1, 0]} material={mats.foliageLow}><coneGeometry args={[1.05, 3.6, 6]} /></mesh>
            <mesh position={[0, 6.4, 0]} material={mats.foliageTop}><coneGeometry args={[0.72, 3.1, 6]} /></mesh>
          </group>
        );
      })}
    </group>
  );
}

function Player({ playerPos }: { playerPos: PosRef }) {
  const g = useRef<GladiatorHandle>(null!);
  const camera = useThree((s) => s.camera);
  const look = useGame((s) => s.look);
  const loadout = useGame((s) => s.loadout);
  const gear = useMemo(() => resolveLoadout(loadout), [loadout]);
  const st = useRef({
    x: PLAYER_START.x, z: PLAYER_START.z, vx: 0, vz: 0, face: Math.PI, yaw: 0, pitch: 0,
    cam: new THREE.Vector3(PLAYER_START.x, EYE_Y + CAMERA_SOCKET_HEIGHT, PLAYER_START.z + CAMERA_SOCKET_DISTANCE),
    lookAt: new THREE.Vector3(PLAYER_START.x, EYE_Y + CAMERA_LOOK_HEIGHT, PLAYER_START.z - CAMERA_LOOK_AHEAD),
    dCam: new THREE.Vector3(), dLook: new THREE.Vector3(),
  });

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    const s = st.current;
    const game = useGame.getState();
    const frozen = game.panel !== null;

    if (frozen && pressed('Escape')) game.openPanel(null);
    if (pressed('KeyC')) {
      if (game.panel === 'locker') game.openPanel(null);
      else if (!frozen) game.openPanel('locker');
    }

    // Q / E orbit, R / F pitch: the Citadel's camera keys
    let orbit = 0;
    if (keys.has('KeyQ')) orbit += 1;
    if (keys.has('KeyE')) orbit -= 1;
    if (orbit) s.yaw += orbit * KB_YAW_SENS * dt * 60;
    let tilt = 0;
    if (keys.has('KeyR')) tilt += 1;
    if (keys.has('KeyF')) tilt -= 1;
    if (tilt) s.pitch = Math.max(-1.3, Math.min(1.4, s.pitch + tilt * KB_YAW_SENS * dt * 60));

    const fx = -Math.sin(s.yaw), fz = -Math.cos(s.yaw);
    const rx = Math.cos(s.yaw), rz = -Math.sin(s.yaw);
    let mx = 0, mz = 0;
    if (!frozen) {
      if (keys.has('KeyW') || keys.has('ArrowUp')) { mx += fx; mz += fz; }
      if (keys.has('KeyS') || keys.has('ArrowDown')) { mx -= fx; mz -= fz; }
      if (keys.has('KeyA') || keys.has('ArrowLeft')) { mx -= rx; mz -= rz; }
      if (keys.has('KeyD') || keys.has('ArrowRight')) { mx += rx; mz += rz; }
    }
    s.vx = mx * MOVE_SPEED; s.vz = mz * MOVE_SPEED;

    const p = { x: s.x + s.vx * dt, z: s.z + s.vz * dt };
    resolveCircles(p, PLAYER_R, SOLIDS);
    clampBounds(p, PLAYER_R, BOUNDS);
    s.x = p.x; s.z = p.z;

    const showcaseOpen = game.panel === 'locker' || game.panel === 'smith' || game.panel === 'armorer';
    const sp = Math.hypot(s.vx, s.vz);
    const target = showcaseOpen
      ? Math.atan2(-fx, -fz) + 0.32
      : sp > 0.4 ? Math.atan2(s.vx, s.vz) : Math.atan2(fx, fz);
    let d = target - s.face; d = Math.atan2(Math.sin(d), Math.cos(d));
    s.face += d * (1 - Math.exp(-16 * dt));
    g.current.group.position.set(s.x, 0, s.z);
    g.current.group.rotation.y = s.face;
    const move01 = Math.min(1, sp / MOVE_SPEED);
    g.current.setMoving(move01);
    g.current.pose.stance = THREE.MathUtils.lerp(g.current.pose.stance, showcaseOpen ? 0.85 : 0, 1 - Math.exp(-10 * dt));
    g.current.pose.localVz += (move01 - g.current.pose.localVz) * (1 - Math.exp(-14 * dt));
    playerPos.current.set(s.x, 0, s.z);

    // Camera: live 3D showcase for Locker / Blacksmith / Armorer, or Citadel socket rig
    if (showcaseOpen) {
      s.dCam.set(s.x - fx * 3.05 + rx * 0.65, 1.78, s.z - fz * 3.05 + rz * 0.65);
      s.dLook.set(s.x + rx * 0.72, 1.15, s.z + rz * 0.72);
    } else {
      const lead = Math.min(sp / 60, 0.27 * 1.5) * CAMERA_MOVE_LEAD;
      const cp = Math.cos(s.pitch), sn = Math.sin(s.pitch);
      const lookDist = CAMERA_LOOK_AHEAD + lead;
      s.dLook.set(s.x + fx * lookDist * cp, EYE_Y + CAMERA_LOOK_HEIGHT + lookDist * sn * 2.2, s.z + fz * lookDist * cp);
      s.dCam.set(s.x - fx * CAMERA_SOCKET_DISTANCE, EYE_Y + CAMERA_SOCKET_HEIGHT, s.z - fz * CAMERA_SOCKET_DISTANCE);
    }
    const alpha = 1 - Math.pow(1 - CAMERA_LERP, dt * 60);
    s.cam.lerp(s.dCam, alpha);
    s.lookAt.lerp(s.dLook, alpha);
    camera.position.copy(s.cam);
    camera.lookAt(s.lookAt);

    // stations
    const near = nearestStation(s.x, s.z);
    game.setNear(frozen ? game.near : near?.id ?? null);
    if (!frozen && near && (pressed('Enter') || pressed('Space'))) game.openPanel(near.id);
  });

  return (
    <Gladiator
      key={`${look}-${loadout.weaponId}-${loadout.offhandId}-${loadout.helmId}-${loadout.bodyId}-${loadout.capeId}`}
      ref={g}
      gear={gear.visuals}
      color={lookColor(look)}
      scale={gear.scale}
    />
  );
}

const CITIZEN_COLORS = ['#d97a54', '#cfa055', '#6b8e6e', '#6f7f9e', '#9a6588', '#cfc5b4'];
const GLADIATOR_NPCS: { color: string; style: StyleId }[] = [
  { color: ACCENTS.azure.hex, style: 'murmillo' },
  { color: ACCENTS.gold.hex, style: 'hoplomachus' },
  { color: ACCENTS.coral.hex, style: 'dimachaerus' },
  { color: ACCENTS.emerald.hex, style: 'retiarius' },
];

function pickPoint(): { x: number; z: number } {
  for (let i = 0; i < 40; i++) {
    const x = -40 + Math.random() * 80;
    const z = -54 + Math.random() * 90;
    if (isFree(x, z, 1.4, SOLIDS, BOUNDS)) return { x, z };
  }
  return { ...PLAYER_START };
}

function Npc({ color, seed, style, civilian = false }: { color: string; seed: number; style: StyleId; civilian?: boolean }) {
  const g = useRef<GladiatorHandle>(null!);
  const st = useRef({ ...pickPoint(), yaw: seed, target: pickPoint(), wait: seed % 3 });
  const npcGear = useMemo(() => gearFromStyle(style), [style]);
  const walkSpeed = civilian ? 1.85 : 2.3;
  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    const s = st.current;
    let moving = 0;
    if (s.wait > 0) s.wait -= dt;
    else {
      const dx = s.target.x - s.x, dz = s.target.z - s.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.8) { s.target = pickPoint(); s.wait = 1 + Math.random() * 4; }
      else {
        const v = walkSpeed * dt;
        const p = { x: s.x + (dx / d) * v, z: s.z + (dz / d) * v };
        resolveCircles(p, 0.55, SOLIDS); clampBounds(p, 0.55, BOUNDS);
        if (Math.hypot(p.x - s.x, p.z - s.z) < v * 0.3) s.target = pickPoint();
        s.x = p.x; s.z = p.z;
        s.yaw = Math.atan2(dx, dz); moving = 0.35;
      }
    }
    g.current.group.position.set(s.x, 0, s.z);
    g.current.group.rotation.y = s.yaw;
    g.current.setMoving(moving);
    g.current.pose.stance = 0;
    g.current.pose.localVz += (moving - g.current.pose.localVz) * (1 - Math.exp(-10 * dt));
  });
  return (
    <Gladiator
      ref={g}
      civilian={civilian}
      gear={civilian ? undefined : npcGear.visuals}
      color={color}
      accent="#e9e6ff"
      scale={civilian ? 0.96 : npcGear.scale}
    />
  );
}

export function Ludus() {
  const playerPos = useRef(new THREE.Vector3(PLAYER_START.x, 0, PLAYER_START.z));
  const timeOfDay = useGame((s) => s.timeOfDay);
  const morning = timeOfDay === 'morning';

  return (
    <>
      <color attach="background" args={[morning ? '#4c7ba8' : '#18102b']} />
      <fog attach="fog" args={[morning ? '#c4b89c' : '#231538', morning ? 44 : 34, morning ? 165 : 135]} />
      <hemisphereLight args={morning ? ['#fff5dc', '#5b4836', 1.15] : ['#a588cf', '#2a1a32', 0.92]} />
      <directionalLight
        position={morning ? [28, 42, 22] : [-26, 20, -24]}
        intensity={morning ? 1.55 : 1.35}
        color={morning ? '#fff1cc' : '#ff9d5c'}
      />
      <directionalLight
        position={morning ? [-22, 18, -26] : [22, 18, 22]}
        intensity={0.45}
        color={morning ? '#a9d4ff' : '#7694ff'}
      />
      <Ps1Sky mood={morning ? 'town_morning' : 'town_dusk'} />
      {!morning && <Starfield playerPosRef={playerPos} />}
      <TempleFloor morning={morning} />
      <SurrealSpores />
      <Court />
      <Parapet />
      <StaticBatch>
        <Colonnade playerPos={playerPos} />
        <TownPerimeter />
      </StaticBatch>
      <Stations />
      {CITIZEN_COLORS.map((hex, i) => (
        <Npc key={`civ-${i}`} color={hex} seed={i + 1} style="murmillo" civilian />
      ))}
      {GLADIATOR_NPCS.map((g, i) => (
        <Npc key={`glad-${i}`} color={g.color} seed={i + 10} style={g.style} />
      ))}
      <Player playerPos={playerPos} />
    </>
  );
}
