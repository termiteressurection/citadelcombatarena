import { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { Gladiator, type GladiatorHandle } from './Gladiator';
import { Stations } from './Stations';
import { StaticBatch } from './art/StaticBatch';
import { SynthwaveHorizon } from './art/SynthwaveHorizon';
import { SurrealSpores } from './art/SurrealSpores';
import Starfield from './art/Starfield';
import { CorinthianColumn, DoricColumn, IonicColumn } from './art/ClassicalColumns';
import { ACCENTS } from './art/palette';
import { BASIN, BOUNDS, COLUMNS, PLAYER_START, SOLIDS, nearestStation } from './world/layout';
import { clampBounds, isFree, resolveCircles } from './world/colliders';
import { keys, pressed } from './input';
import { lookColor } from './arena/run';
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

/** Low glowing parapet: the visible edge of the walkable court. It is the only boundary. */
function Parapet() {
  const { minX, maxX, minZ, maxZ } = BOUNDS;
  const w = maxX - minX, d = maxZ - minZ, cx = (minX + maxX) / 2, cz = (minZ + maxZ) / 2;
  const seg = (x: number, z: number, sx: number, sz: number, k: string) => (
    <group key={k} position={[x, 0.6, z]}>
      <mesh><boxGeometry args={[sx, 1.2, sz]} /><meshBasicMaterial color="#0b051b" /></mesh>
      <mesh><boxGeometry args={[sx + 0.05, 1.25, sz + 0.05]} /><meshBasicMaterial color="#a78bfa" wireframe transparent opacity={0.7} /></mesh>
    </group>
  );
  return (
    <group>
      {seg(cx, minZ - 0.4, w + 1.6, 0.8, 'n')}
      {seg(cx, maxZ + 0.4, w + 1.6, 0.8, 's')}
      {seg(minX - 0.4, cz, 0.8, d, 'w')}
      {seg(maxX + 0.4, cz, 0.8, d, 'e')}
    </group>
  );
}

/** Replaces the Citadel's full-screen grid shader (too heavy for 60 FPS here) with plain line segments. */
function CheapGrid() {
  const geo = useMemo(() => {
    const pts: number[] = [];
    const R = 150, step = 6;
    for (let v = -R; v <= R; v += step) { pts.push(v, 0.2, -R, v, 0.2, R, -R, 0.2, v, R, 0.2, v); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    return g;
  }, []);
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}><circleGeometry args={[400, 32]} /><meshBasicMaterial color="#05030c" /></mesh>
      <lineSegments geometry={geo}><lineBasicMaterial color="#7a38ee" transparent opacity={0.28} /></lineSegments>
    </group>
  );
}

function Court() {
  const lines = useMemo(() => {
    const pts: number[] = [];
    for (let z = BOUNDS.minZ; z <= BOUNDS.maxZ; z += 4) pts.push(-3, 0.24, z, 3, 0.24, z);
    pts.push(-3, 0.24, BOUNDS.minZ, -3, 0.24, BOUNDS.maxZ, 3, 0.24, BOUNDS.minZ, 3, 0.24, BOUNDS.maxZ);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    return g;
  }, []);
  return (
    <group>
      {/* the processional avenue to the Gate */}
      <lineSegments geometry={lines}><lineBasicMaterial color="#ffc95c" transparent opacity={0.55} /></lineSegments>
      {/* bronze basin */}
      <group position={[BASIN.x, 0, BASIN.z]}>
        <mesh position={[0, 0.7, 0]}><cylinderGeometry args={[2.9, 2.4, 1.4, 20]} /><meshBasicMaterial color="#0b051b" /></mesh>
        <mesh position={[0, 0.7, 0]}><cylinderGeometry args={[3, 2.5, 1.45, 20]} /><meshBasicMaterial color="#ffc95c" wireframe transparent opacity={0.8} /></mesh>
        <mesh position={[0, 1.42, 0]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[2.7, 28]} /><meshBasicMaterial color="#3ff0ff" transparent opacity={0.35} /></mesh>
      </group>
    </group>
  );
}

function Player({ playerPos }: { playerPos: PosRef }) {
  const g = useRef<GladiatorHandle>(null!);
  const camera = useThree((s) => s.camera);
  const look = useGame((s) => s.look);
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

    const sp = Math.hypot(s.vx, s.vz);
    const target = sp > 0.4 ? Math.atan2(s.vx, s.vz) : Math.atan2(fx, fz);
    let d = target - s.face; d = Math.atan2(Math.sin(d), Math.cos(d));
    s.face += d * (1 - Math.exp(-16 * dt));
    g.current.group.position.set(s.x, 0, s.z);
    g.current.group.rotation.y = s.face;
    g.current.setMoving(Math.min(1, sp / MOVE_SPEED));
    playerPos.current.set(s.x, 0, s.z);

    // camera: exactly the Citadel socket rig
    const lead = Math.min(sp / 60, 0.27 * 1.5) * CAMERA_MOVE_LEAD;
    const cp = Math.cos(s.pitch), sn = Math.sin(s.pitch);
    const lookDist = CAMERA_LOOK_AHEAD + lead;
    s.dLook.set(s.x + fx * lookDist * cp, EYE_Y + CAMERA_LOOK_HEIGHT + lookDist * sn * 2.2, s.z + fz * lookDist * cp);
    s.dCam.set(s.x - fx * CAMERA_SOCKET_DISTANCE, EYE_Y + CAMERA_SOCKET_HEIGHT, s.z - fz * CAMERA_SOCKET_DISTANCE);
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

  return <Gladiator key={look} ref={g} color={lookColor(look)} />;
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

function Npc({ color, seed }: { color: string; seed: number }) {
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
  });
  return <Gladiator ref={g} color={color} accent="#e9e6ff" scale={0.97 + (seed % 3) * 0.04} />;
}

export function Ludus() {
  const playerPos = useRef(new THREE.Vector3(PLAYER_START.x, 0, PLAYER_START.z));
  return (
    <>
      <color attach="background" args={['#06050d']} />
      <fog attach="fog" args={['#0a0620', 70, 230]} />
      <SynthwaveHorizon />
      <Starfield playerPosRef={playerPos} />
      <CheapGrid />
      <SurrealSpores />
      <Court />
      <Parapet />
      <StaticBatch><Colonnade playerPos={playerPos} /></StaticBatch>
      <Stations />
      {NPC_COLORS.map((c, i) => <Npc key={i} color={c.hex} seed={i + 1} />)}
      <Player playerPos={playerPos} />
    </>
  );
}
