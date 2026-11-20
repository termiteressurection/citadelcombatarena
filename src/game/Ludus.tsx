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
import { STYLE_IDS, styleOf, type StyleId } from './arena/styles';
import { useGame } from './store';

const PLAYER_R = 0.55;
// Citadel camera rig, constants carried over exactly
const MOVE_SPEED = 0.27 * 60; // 0.27 units per frame at 60 fps
const KB_YAW_SENS = 0.06;
const CAMERA_SOCKET_DISTANCE = 5.2;
const CAMERA_SOCKET_HEIGHT = 3.35;
const CAMERA_LOOK_AHEAD = 8.8;
const CAMERA_LOOK_HEIGHT = 1.55;
const CAMERA_MOVE_LEAD = 0.9;
const CAMERA_LERP = 0.18;
const EYE_Y = 1.6; // the Citadel's player height; the rig hangs off it

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

/** Chunky textured PS1 stone parapet walls & corner braziers framing the walkable temple sanctuary. */
function Parapet() {
  const { minX, maxX, minZ, maxZ } = BOUNDS;
  const w = maxX - minX, d = maxZ - minZ, cx = (minX + maxX) / 2, cz = (minZ + maxZ) / 2;
  const mats = useMemo(() => ({
    wall: makePs1Material({ color: '#c4b8d6', map: cloneTex(getPs1Texture('stone'), 18, 1) }),
    trim: makePs1Material({ color: '#ffd480', map: cloneTex(getPs1Texture('bronze'), 12, 1) }),
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
      <Brazier position={[-7, 0, 15]} scale={0.9} light />
      <Brazier position={[7, 0, 15]} scale={0.9} />
    </group>
  );
}

/** Dithered PS1 flagstone temple plaza perched over a dark abyss drop-off. */
function TempleFloor() {
  const mats = useMemo(() => {
    const w = BOUNDS.maxX - BOUNDS.minX + 4;
    const d = BOUNDS.maxZ - BOUNDS.minZ + 4;
    return {
      floor: makePs1Material({ color: '#cfc5df', map: cloneTex(getPs1Texture('flagstone'), Math.round(w / 4), Math.round(d / 4)) }),
      cliff: makePs1Material({ color: '#6b6080', map: cloneTex(getPs1Texture('stone'), 20, 4) }),
      abyss: new THREE.MeshBasicMaterial({ color: '#07040e' }),
    };
  }, []);
  const cx = (BOUNDS.minX + BOUNDS.maxX) / 2;
  const cz = (BOUNDS.minZ + BOUNDS.maxZ) / 2;
  const w = BOUNDS.maxX - BOUNDS.minX + 2;
  const d = BOUNDS.maxZ - BOUNDS.minZ + 2;
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -6.5, 0]} material={mats.abyss}><circleGeometry args={[320, 24]} /></mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[cx, 0, cz]} material={mats.floor}><planeGeometry args={[w, d]} /></mesh>
      <mesh position={[cx, -3.26, cz]} material={mats.cliff}><boxGeometry args={[w + 2, 6.4, d + 2]} /></mesh>
    </group>
  );
}

function Court() {
  const waterRef = useRef<THREE.Mesh>(null!);
  const mats = useMemo(() => {
    const waterTex = cloneTex(getPs1Texture('water'), 3, 3);
    return {
      paver: makePs1Material({ color: '#d8cfe8', map: cloneTex(getPs1Texture('stone'), 3, 18) }),
      sidePaver: makePs1Material({ color: '#cfc5df', map: cloneTex(getPs1Texture('stone'), 8, 2) }),
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
      {/* Main processional avenue to the Gate */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, -4]} material={mats.paver}><planeGeometry args={[5.8, 76]} /></mesh>
      {([-2.95, 2.95] as const).map((x) => (
        <mesh key={x} position={[x, 0.035, -4]} material={mats.trim}><boxGeometry args={[0.18, 0.05, 76]} /></mesh>
      ))}
      {/* Cross walkways linking Armory <-> Basin <-> Shrine & Yard <-> Gate <-> Wall */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, 8]} material={mats.sidePaver}><planeGeometry args={[36, 4.4]} /></mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, -33]} material={mats.sidePaver}><planeGeometry args={[38, 4.2]} /></mesh>

      {/* Stepped octagonal stone & bronze Sanctuary Fountain Basin */}
      <group position={[BASIN.x, 0, BASIN.z]}>
        <mesh position={[0, 0.16, 0]} material={mats.stone}><cylinderGeometry args={[3.4, 3.6, 0.32, 8]} /></mesh>
        <mesh position={[0, 0.85, 0]} material={mats.stone}><cylinderGeometry args={[2.8, 2.5, 1.1, 8]} /></mesh>
        <mesh position={[0, 1.42, 0]} rotation={[Math.PI / 2, 0, Math.PI / 8]} material={mats.trim}><torusGeometry args={[2.76, 0.16, 6, 8]} /></mesh>
        <mesh ref={waterRef} position={[0, 1.42, 0]} rotation={[-Math.PI / 2, 0, 0]} material={mats.water}><circleGeometry args={[2.65, 8]} /></mesh>
      </group>
    </group>
  );
}

function Player({ playerPos }: { playerPos: PosRef }) {
  const g = useRef<GladiatorHandle>(null!);
  const camera = useThree((s) => s.camera);
  const look = useGame((s) => s.look);
  const style = useGame((s) => s.style);
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

    if (frozen && (pressed('Escape') || pressed('Enter') || pressed('Space'))) game.openPanel(null);

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
    // Citadel movement is instant (no easing): speed is added straight to position
    s.vx = mx * MOVE_SPEED; s.vz = mz * MOVE_SPEED;

    const p = { x: s.x + s.vx * dt, z: s.z + s.vz * dt };
    resolveCircles(p, PLAYER_R, SOLIDS);
    clampBounds(p, PLAYER_R, BOUNDS);
    s.x = p.x; s.z = p.z;

    const armoryOpen = game.panel === 'armory';
    const sp = Math.hypot(s.vx, s.vz);
    const target = armoryOpen
      ? Math.atan2(-fx, -fz) + 0.32
      : sp > 0.4 ? Math.atan2(s.vx, s.vz) : Math.atan2(fx, fz);
    let d = target - s.face; d = Math.atan2(Math.sin(d), Math.cos(d));
    s.face += d * (1 - Math.exp(-16 * dt));
    g.current.group.position.set(s.x, 0, s.z);
    g.current.group.rotation.y = s.face;
    const move01 = Math.min(1, sp / MOVE_SPEED);
    g.current.setMoving(move01);
    g.current.pose.stance = THREE.MathUtils.lerp(g.current.pose.stance, armoryOpen ? 0.85 : 0, 1 - Math.exp(-10 * dt));
    g.current.pose.localVz += (move01 - g.current.pose.localVz) * (1 - Math.exp(-14 * dt));
    playerPos.current.set(s.x, 0, s.z);

    // Camera: live 3D Armory close-up hero showcase, or exact Citadel socket rig
    if (armoryOpen) {
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

  return <Gladiator key={`${look}-${style}`} ref={g} style={style} color={lookColor(look)} scale={styleOf(style).scale} />;
}

const NPC_COLORS = [ACCENTS.coral, ACCENTS.lime, ACCENTS.magenta, ACCENTS.azure, ACCENTS.rose, ACCENTS.emerald, ACCENTS.violet, ACCENTS.gold];

function pickPoint(): { x: number; z: number } {
  for (let i = 0; i < 40; i++) {
    const x = BOUNDS.minX + 3 + Math.random() * (BOUNDS.maxX - BOUNDS.minX - 6);
    const z = BOUNDS.minZ + 8 + Math.random() * (BOUNDS.maxZ - BOUNDS.minZ - 12);
    if (isFree(x, z, 1.4, SOLIDS, BOUNDS)) return { x, z };
  }
  return { ...PLAYER_START };
}

function Npc({ color, seed, style }: { color: string; seed: number; style: StyleId }) {
  const g = useRef<GladiatorHandle>(null!);
  const st = useRef({ ...pickPoint(), yaw: seed, target: pickPoint(), wait: seed % 3, started: false });
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
        const v = 2.3 * dt;
        const p = { x: s.x + (dx / d) * v, z: s.z + (dz / d) * v };
        resolveCircles(p, 0.55, SOLIDS); clampBounds(p, 0.55, BOUNDS);
        // stuck? choose a new goal
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
  return <Gladiator ref={g} style={style} color={color} accent="#e9e6ff" scale={styleOf(style).scale} />;
}

export function Ludus() {
  const playerPos = useRef(new THREE.Vector3(PLAYER_START.x, 0, PLAYER_START.z));
  return (
    <>
      <color attach="background" args={['#0b0818']} />
      <fog attach="fog" args={['#140e26', 30, 125]} />
      <hemisphereLight args={['#8a80d0', '#23182e', 0.9]} />
      <directionalLight position={[20, 32, 16]} intensity={1.25} color="#ffdba8" />
      <directionalLight position={[-18, 16, -24]} intensity={0.45} color="#6cd0ff" />
      <Ps1Sky mood="ludus" />
      <Starfield playerPosRef={playerPos} />
      <TempleFloor />
      <SurrealSpores />
      <Court />
      <Parapet />
      <StaticBatch><Colonnade playerPos={playerPos} /></StaticBatch>
      <Stations />
      {NPC_COLORS.map((c, i) => <Npc key={i} color={c.hex} seed={i + 1} style={STYLE_IDS[i % STYLE_IDS.length]} />)}
      <Player playerPos={playerPos} />
    </>
  );
}
