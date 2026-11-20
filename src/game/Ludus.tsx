import { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { Gladiator, type GladiatorHandle } from './Gladiator';
import { Stations } from './Stations';
import { SurrealGrid } from './art/SurrealGrid';
import { SynthwaveHorizon } from './art/SynthwaveHorizon';
import { SurrealSpores } from './art/SurrealSpores';
import Starfield from './art/Starfield';
import { CorinthianColumn, DoricColumn, IonicColumn } from './art/ClassicalColumns';
import { ACCENTS } from './art/palette';
import { BASIN, BOUNDS, COLUMNS, PLAYER_START, SOLIDS, nearestStation } from './world/layout';
import { clampBounds, isFree, resolveCircles } from './world/colliders';
import { drag, keys, pressed } from './input';
import { useGame } from './store';

const PLAYER_R = 0.55;
const SPEED = 7.2;

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
  const st = useRef({ x: PLAYER_START.x, z: PLAYER_START.z, vx: 0, vz: 0, yaw: Math.PI, camYaw: 0, camLook: new THREE.Vector3() });

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    const s = st.current;
    const game = useGame.getState();
    const frozen = game.panel !== null;

    // camera orbit: drag or arrow keys
    s.camYaw -= drag.dx * 0.006; drag.dx = 0;
    if (keys.has('ArrowLeft')) s.camYaw += 1.8 * dt;
    if (keys.has('ArrowRight')) s.camYaw -= 1.8 * dt;

    let ix = 0, iz = 0;
    if (!frozen) {
      if (keys.has('KeyW')) iz -= 1;
      if (keys.has('KeyS')) iz += 1;
      if (keys.has('KeyA')) ix -= 1;
      if (keys.has('KeyD')) ix += 1;
    }
    const len = Math.hypot(ix, iz) || 1;
    ix /= len; iz /= len;
    const fx = -Math.sin(s.camYaw), fz = -Math.cos(s.camYaw);
    const rx = Math.cos(s.camYaw), rz = -Math.sin(s.camYaw);
    const tvx = (fx * -iz + rx * ix) * SPEED;
    const tvz = (fz * -iz + rz * ix) * SPEED;
    const k = 1 - Math.exp(-12 * dt);
    s.vx += (tvx - s.vx) * k; s.vz += (tvz - s.vz) * k;

    const p = { x: s.x + s.vx * dt, z: s.z + s.vz * dt };
    resolveCircles(p, PLAYER_R, SOLIDS);
    clampBounds(p, PLAYER_R, BOUNDS);
    s.x = p.x; s.z = p.z;

    const sp = Math.hypot(s.vx, s.vz);
    if (sp > 0.4) {
      const target = Math.atan2(s.vx, s.vz);
      let d = target - s.yaw; d = Math.atan2(Math.sin(d), Math.cos(d));
      s.yaw += d * (1 - Math.exp(-14 * dt));
    }
    g.current.group.position.set(s.x, 0, s.z);
    g.current.group.rotation.y = s.yaw;
    g.current.setMoving(Math.min(1, sp / SPEED));
    playerPos.current.set(s.x, 0, s.z);

    // follow camera
    const D = 10.5, H = 6.4;
    camera.position.lerp(new THREE.Vector3(s.x + Math.sin(s.camYaw) * D, H, s.z + Math.cos(s.camYaw) * D), 1 - Math.exp(-9 * dt));
    s.camLook.set(s.x, 1.6, s.z);
    camera.lookAt(s.camLook);

    // stations
    const near = nearestStation(s.x, s.z);
    game.setNear(frozen ? game.near : near?.id ?? null);
    if (pressed('KeyE') && !frozen && near) game.openPanel(near.id);
  });

  return <Gladiator ref={g} color="#3ff0ff" accent="#ffc95c" />;
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
      <SurrealGrid playerPosRef={playerPos} />
      <SurrealSpores />
      <Court />
      <Parapet />
      <Colonnade playerPos={playerPos} />
      <Stations />
      {NPC_COLORS.map((c, i) => <Npc key={i} color={c.hex} seed={i + 1} />)}
      <Player playerPos={playerPos} />
    </>
  );
}
