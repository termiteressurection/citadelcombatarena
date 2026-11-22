import { useMemo, useRef, type JSX } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import SpriteText from './art/SpriteText';
import { Brazier } from './art/Ps1Sky';
import { makeCurvedBasicMaterial } from './art/curvature';
import { cloneTex, getPs1Texture, makePs1Material } from './art/ps1Textures';
import { JAIL_CELL, STATIONS, type Station } from './world/layout';
import { useGame } from './store';
import { generateDailyQuests } from './rpg/quests';

interface StationMats {
  hull: THREE.MeshLambertMaterial;
  hullDark: THREE.MeshLambertMaterial;
  circuit: THREE.MeshLambertMaterial;
  conduit: THREE.MeshLambertMaterial;
  chrome: THREE.MeshLambertMaterial;
  holo: THREE.MeshLambertMaterial;
  banner: THREE.MeshLambertMaterial;
  grid: THREE.MeshLambertMaterial;
  gold: THREE.MeshLambertMaterial;
}

let cachedMats: StationMats | null = null;
function getMats(): StationMats {
  if (!cachedMats) {
    cachedMats = {
      hull: makePs1Material({ color: '#2b3254', map: cloneTex(getPs1Texture('conduit'), 2, 2), emissive: '#0c1c30', emissiveIntensity: 0.35 }),
      hullDark: makePs1Material({ color: '#14172b', map: cloneTex(getPs1Texture('circuit'), 2, 2) }),
      circuit: makePs1Material({ color: '#47598f', map: cloneTex(getPs1Texture('circuit'), 2, 2), emissive: '#143352', emissiveIntensity: 0.4 }),
      conduit: makePs1Material({ color: '#384673', map: cloneTex(getPs1Texture('conduit'), 2, 1), emissive: '#143a4d', emissiveIntensity: 0.4 }),
      chrome: makePs1Material({ color: '#8fa4c8', map: getPs1Texture('bronze'), emissive: '#1e3050', emissiveIntensity: 0.25 }),
      holo: makePs1Material({ color: '#ffffff', map: getPs1Texture('holo'), emissive: '#ff4fd8', emissiveIntensity: 0.35 }),
      banner: makePs1Material({ color: '#3ff0ff', map: getPs1Texture('banner'), side: THREE.DoubleSide, emissive: '#1a6e8c', emissiveIntensity: 0.45 }),
      grid: makePs1Material({ color: '#14263b', map: cloneTex(getPs1Texture('grid'), 4, 4), emissive: '#103547', emissiveIntensity: 0.35 }),
      gold: makePs1Material({ color: '#ffd478', map: getPs1Texture('bronze'), emissive: '#8f5d14', emissiveIntensity: 0.4 }),
    };
  }
  return cachedMats;
}

function NeonStrip({ position, args, color }: { position: [number, number, number]; args: [number, number, number]; color: string }) {
  const mat = useMemo(() => makeCurvedBasicMaterial({ color }), [color]);
  return (
    <mesh position={position} material={mat}>
      <boxGeometry args={args} />
    </mesh>
  );
}

function Bunk({ s }: { s: Station }) {
  const m = useMemo(getMats, []);
  return (
    <group>
      <mesh position={[0, 0.2, 0]} material={m.hullDark}><boxGeometry args={[4.4, 0.4, 3.6]} /></mesh>
      <mesh position={[0, 1.55, -0.3]} material={m.hull}><boxGeometry args={[3.8, 2.3, 2.6]} /></mesh>
      <mesh position={[0, 3.25, -0.3]} rotation={[0, Math.PI / 4, 0]} material={m.circuit}><coneGeometry args={[3.1, 1.4, 4]} /></mesh>
      {/* Cryo/Defrag Memory Pod */}
      <mesh position={[-0.2, 0.65, 1.25]} material={m.conduit}><boxGeometry args={[2.1, 0.45, 1.0]} /></mesh>
      <mesh position={[-0.95, 0.92, 1.25]} material={m.gold}><boxGeometry args={[0.5, 0.2, 0.85]} /></mesh>
      <mesh position={[0.15, 0.88, 1.25]} material={m.banner}><boxGeometry args={[1.4, 0.14, 0.92]} /></mesh>
      <NeonStrip position={[0, 2.75, 1.04]} args={[3.2, 0.12, 0.12]} color={s.color} />
      <NeonStrip position={[1.35, 1.2, 1.2]} args={[0.24, 0.34, 0.24]} color={s.color} />
      <pointLight position={[1.3, 1.6, 1.5]} color={s.color} intensity={8} distance={12} decay={1.6} />
    </group>
  );
}

function Locker({ s }: { s: Station }) {
  const m = useMemo(getMats, []);
  return (
    <group>
      <mesh position={[0, 0.18, 0]} material={m.hullDark}><boxGeometry args={[3.8, 0.36, 2.6]} /></mesh>
      <mesh position={[0, 1.2, -0.3]} material={m.circuit}><boxGeometry args={[2.9, 1.8, 1.1]} /></mesh>
      <mesh position={[-1.4, 1.6, 0]} material={m.conduit}><boxGeometry args={[0.18, 2.6, 0.18]} /></mesh>
      <mesh position={[1.4, 1.6, 0]} material={m.conduit}><boxGeometry args={[0.18, 2.6, 0.18]} /></mesh>
      <mesh position={[0, 2.95, 0]} material={m.gold}><boxGeometry args={[3.3, 0.28, 1.4]} /></mesh>
      <mesh position={[-0.75, 1.55, 0.32]} rotation={[Math.PI / 2, 0, 0]} material={m.gold}><cylinderGeometry args={[0.45, 0.45, 0.08, 8]} /></mesh>
      <mesh position={[0.65, 1.7, 0.3]} material={m.chrome}><boxGeometry args={[0.14, 1.5, 0.1]} /></mesh>
      <NeonStrip position={[0, 0.45, 0.55]} args={[1.1, 0.1, 0.5]} color={s.color} />
    </group>
  );
}

function Yard({ s }: { s: Station }) {
  const m = useMemo(getMats, []);
  const ringMat = useMemo(() => makeCurvedBasicMaterial({ color: s.color, transparent: true, opacity: 0.72 }), [s.color]);
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]} material={m.grid}><circleGeometry args={[4.6, 16]} /></mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]} material={ringMat}><ringGeometry args={[4.45, 4.7, 16]} /></mesh>
      {Array.from({ length: 8 }, (_, i) => {
        const a = (i / 8) * Math.PI * 2;
        if (Math.cos(a) > 0.7 && Math.abs(Math.sin(a)) < 0.4) return null;
        return (
          <mesh key={i} position={[Math.cos(a) * 4.7, 0.55, Math.sin(a) * 4.7]} material={m.conduit}>
            <cylinderGeometry args={[0.1, 0.12, 1.1, 5]} />
          </mesh>
        );
      })}
      {([-2.5, 2.5] as const).map((x) => (
        <group key={x} position={[x, 0, 0]}>
          <mesh position={[0, 0.95, 0]} material={m.conduit}><cylinderGeometry args={[0.09, 0.11, 1.9, 5]} /></mesh>
          <mesh position={[0, 1.55, 0]} material={m.holo}><cylinderGeometry args={[0.24, 0.18, 0.72, 6]} /></mesh>
          <mesh position={[0, 1.65, 0]} material={m.hull}><boxGeometry args={[1.25, 0.16, 0.16]} /></mesh>
          <mesh position={[0, 2.15, 0]} material={m.chrome}><cylinderGeometry args={[0.16, 0.18, 0.34, 6]} /></mesh>
          <mesh position={[0.45, 1.52, 0.22]} rotation={[Math.PI / 2, 0, 0]} material={m.gold}><cylinderGeometry args={[0.28, 0.28, 0.06, 8]} /></mesh>
        </group>
      ))}
    </group>
  );
}

function Smith({ s }: { s: Station }) {
  const m = useMemo(getMats, []);
  return (
    <group>
      <mesh position={[0, 0.16, 0]} material={m.hullDark}><boxGeometry args={[4.6, 0.32, 3.0]} /></mesh>
      <mesh position={[0, 0.65, -0.2]} material={m.hull}><boxGeometry args={[3.4, 0.75, 1.3]} /></mesh>
      {([[-1.95, -1.1], [1.95, -1.1], [-1.95, 1.1], [1.95, 1.1]] as const).map(([x, z], i) => (
        <mesh key={i} position={[x, 2.0, z]} material={m.conduit}><boxGeometry args={[0.2, 3.4, 0.2]} /></mesh>
      ))}
      <mesh position={[0, 3.9, 0]} rotation={[0, Math.PI / 4, 0]} material={m.circuit}><coneGeometry args={[3.4, 1.3, 4]} /></mesh>
      <mesh position={[-1.0, 0.56, 0.9]} material={m.chrome}><boxGeometry args={[0.72, 0.5, 0.44]} /></mesh>
      <NeonStrip position={[0, 1.08, -0.15]} args={[1.2, 0.12, 0.45]} color={s.color} />
      <mesh position={[0.45, 2.05, 0]} material={m.conduit}><cylinderGeometry args={[0.045, 0.045, 1.7, 5]} /></mesh>
      <mesh position={[0.45, 2.95, 0]} material={m.gold}><boxGeometry args={[0.3, 0.24, 0.42]} /></mesh>
      <mesh position={[1.05, 2.1, 0]} material={m.conduit}><cylinderGeometry args={[0.035, 0.035, 2.0, 5]} /></mesh>
      <mesh position={[1.05, 3.2, 0]} material={m.chrome}><coneGeometry args={[0.08, 0.28, 4]} /></mesh>
      <Brazier position={[-1.5, 0, 1.2]} scale={0.72} color={s.color} light />
    </group>
  );
}

function Armorer({ s }: { s: Station }) {
  const m = useMemo(getMats, []);
  return (
    <group>
      <mesh position={[0, 0.16, 0]} material={m.hullDark}><boxGeometry args={[4.6, 0.32, 3.0]} /></mesh>
      <mesh position={[0, 0.65, -0.2]} material={m.conduit}><boxGeometry args={[3.5, 0.78, 1.3]} /></mesh>
      {([[-1.95, -1.1], [1.95, -1.1], [-1.95, 1.1], [1.95, 1.1]] as const).map(([x, z], i) => (
        <mesh key={i} position={[x, 2.0, z]} material={m.conduit}><boxGeometry args={[0.2, 3.4, 0.2]} /></mesh>
      ))}
      <mesh position={[0, 3.7, 0]} material={m.holo}><boxGeometry args={[4.6, 0.45, 2.8]} /></mesh>
      <mesh position={[0, 4.2, 0]} rotation={[0, Math.PI / 4, 0]} material={m.gold}><coneGeometry args={[3.1, 1.0, 4]} /></mesh>
      <mesh position={[-0.9, 1.6, 0.1]} material={m.gold}><cylinderGeometry args={[0.24, 0.18, 0.75, 6]} /></mesh>
      <mesh position={[-0.9, 2.25, 0.1]} material={m.chrome}><cylinderGeometry args={[0.16, 0.18, 0.3, 6]} /></mesh>
      <mesh position={[0.7, 1.7, 0.25]} rotation={[Math.PI / 2, 0, 0]} material={m.banner}><cylinderGeometry args={[0.55, 0.55, 0.1, 8]} /></mesh>
      <NeonStrip position={[0, 1.05, 0.5]} args={[1.3, 0.1, 0.2]} color={s.color} />
      <pointLight position={[0, 2.3, 0.7]} color={s.color} intensity={7} distance={12} decay={1.6} />
    </group>
  );
}

function Apothecary({ s }: { s: Station }) {
  const m = useMemo(getMats, []);
  const orbMat = useMemo(() => makeCurvedBasicMaterial({ color: s.color }), [s.color]);
  return (
    <group>
      <mesh position={[0, 0.16, 0]} material={m.hullDark}><boxGeometry args={[4.2, 0.32, 2.8]} /></mesh>
      <mesh position={[0, 0.68, 0]} material={m.circuit}><boxGeometry args={[3.4, 0.84, 1.4]} /></mesh>
      {([-1.6, 1.6] as const).map((x) => (
        <mesh key={x} position={[x, 1.95, -0.6]} material={m.conduit}><boxGeometry args={[0.18, 3.2, 0.18]} /></mesh>
      ))}
      <mesh position={[0, 3.5, 0]} rotation={[0.15, 0, 0]} material={m.holo}><boxGeometry args={[4.2, 0.32, 2.4]} /></mesh>
      {([-0.9, -0.45, 0] as const).map((x) => (
        <mesh key={x} position={[x, 1.32, 0.2]} material={orbMat}><octahedronGeometry args={[0.18, 0]} /></mesh>
      ))}
      <mesh position={[0.85, 1.24, 0.2]} material={m.gold}><cylinderGeometry args={[0.38, 0.3, 0.25, 6]} /></mesh>
      <pointLight position={[0, 2.0, 0.6]} color={s.color} intensity={8} distance={12} decay={1.6} />
    </group>
  );
}

function Board({ s }: { s: Station }) {
  const m = useMemo(getMats, []);
  const marker = useRef<THREE.Mesh>(null!);
  const day = useGame((g) => g.day);
  const active = useGame((g) => g.activeQuests);
  const completed = useGame((g) => g.completedQuestIds);

  const hasReady = active.some((q) => q.progress >= q.target && !q.claimed);
  const daily = generateDailyQuests(day);
  const hasNew = daily.some((q) => !active.some((a) => a.id === q.id) && !completed.includes(q.id));
  const markerMat = useMemo(
    () => makeCurvedBasicMaterial({ color: hasReady ? '#4dffa0' : s.color }),
    [hasReady, s.color],
  );

  useFrame(({ clock }) => {
    if (!marker.current) return;
    marker.current.visible = hasReady || hasNew;
    marker.current.rotation.y = clock.elapsedTime * 2.2;
    marker.current.position.y = 3.7 + Math.sin(clock.elapsedTime * 3.2) * 0.18;
  });

  return (
    <group>
      <mesh position={[0, 0.15, 0]} material={m.hullDark}><boxGeometry args={[3.2, 0.3, 1.6]} /></mesh>
      <mesh position={[-1.2, 1.5, 0]} material={m.conduit}><boxGeometry args={[0.2, 2.8, 0.2]} /></mesh>
      <mesh position={[1.2, 1.5, 0]} material={m.conduit}><boxGeometry args={[0.2, 2.8, 0.2]} /></mesh>
      <mesh position={[0, 1.75, 0]} material={m.holo}><boxGeometry args={[2.3, 1.5, 0.18]} /></mesh>
      <mesh position={[0, 2.85, 0]} material={m.circuit}><boxGeometry args={[3.0, 0.35, 1.2]} /></mesh>
      {([-0.6, 0, 0.6] as const).map((x) => (
        <NeonStrip key={x} position={[x, 1.78, 0.12]} args={[0.42, 0.55, 0.04]} color={x === 0 ? '#4dffa0' : '#3ff0ff'} />
      ))}
      <mesh ref={marker} position={[0, 3.7, 0]} material={markerMat}>
        <octahedronGeometry args={[0.35, 0]} />
      </mesh>
    </group>
  );
}

function Wall({ s }: { s: Station }) {
  const m = useMemo(getMats, []);
  return (
    <group>
      <mesh position={[0, 0.18, 0]} material={m.hullDark}><boxGeometry args={[6.8, 0.36, 1.6]} /></mesh>
      <mesh position={[0, 2.05, 0]} material={m.circuit}><boxGeometry args={[5.6, 3.4, 0.44]} /></mesh>
      <mesh position={[-3.05, 2.05, 0]} material={m.conduit}><boxGeometry args={[0.6, 3.6, 0.65]} /></mesh>
      <mesh position={[3.05, 2.05, 0]} material={m.conduit}><boxGeometry args={[0.6, 3.6, 0.65]} /></mesh>
      <mesh position={[0, 3.95, 0]} material={m.gold}><boxGeometry args={[6.8, 0.35, 0.8]} /></mesh>
      <mesh position={[0, 4.45, 0]} rotation={[0, Math.PI / 4, 0]} material={m.hull}><coneGeometry args={[1.4, 0.7, 4]} /></mesh>
      <NeonStrip position={[0, 2.05, 0.25]} args={[4.8, 0.12, 0.05]} color={s.color} />
      <Brazier position={[-3.7, 0, 0.9]} scale={0.75} color={s.color} />
      <Brazier position={[3.7, 0, 0.9]} scale={0.75} color={s.color} />
    </group>
  );
}

function Gate({ s }: { s: Station }) {
  const m = useMemo(getMats, []);
  const ring = useRef<THREE.Mesh>(null!);
  const ringMat = useMemo(() => makeCurvedBasicMaterial({ color: s.color }), [s.color]);
  const portalMat = useMemo(
    () => makeCurvedBasicMaterial({ color: s.color, transparent: true, opacity: 0.24, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }),
    [s.color],
  );
  useFrame(({ clock }) => { if (ring.current) ring.current.rotation.z = clock.elapsedTime * 0.9; });
  return (
    <group>
      {([-2.6, 2.6] as const).map((x) => (
        <group key={x} position={[x, 0, 0]}>
          <mesh position={[0, 0.25, 0]} material={m.hullDark}><boxGeometry args={[1.7, 0.5, 1.7]} /></mesh>
          <mesh position={[0, 3.4, 0]} material={m.circuit}><boxGeometry args={[1.35, 6.4, 1.35]} /></mesh>
          <mesh position={[0, 6.65, 0]} material={m.gold}><boxGeometry args={[1.55, 0.32, 1.55]} /></mesh>
          <mesh position={[0, 3.6, 0.72]} material={m.banner}><boxGeometry args={[0.9, 2.8, 0.06]} /></mesh>
        </group>
      ))}
      <mesh position={[0, 7.1, 0]} material={m.hull}><boxGeometry args={[7.4, 0.95, 1.65]} /></mesh>
      <mesh position={[0, 7.8, 0]} material={m.gold}><boxGeometry args={[7.8, 0.34, 1.85]} /></mesh>
      <mesh position={[0, 8.35, 0]} rotation={[0, Math.PI / 4, 0]} material={m.holo}><coneGeometry args={[2.3, 0.95, 4]} /></mesh>
      <mesh ref={ring} position={[0, 3.3, 0]} material={ringMat}><torusGeometry args={[2.1, 0.11, 6, 20]} /></mesh>
      <mesh position={[0, 3.3, 0]} material={portalMat}><circleGeometry args={[2.05, 16]} /></mesh>
      <Brazier position={[-3.9, 0, 1.4]} scale={0.95} color={s.color} light />
      <Brazier position={[3.9, 0, 1.4]} scale={0.95} color={s.color} />
    </group>
  );
}

/** Playable Quarantine Cell beneath the Under-Conduit district where arrested files wake up. */
function QuarantineCell() {
  const m = useMemo(getMats, []);
  const inJail = useGame((g) => g.inJail);
  const laserMat = useMemo(
    () => makeCurvedBasicMaterial({ color: '#ff3b5c', transparent: true, opacity: inJail ? 0.85 : 0.25 }),
    [inJail],
  );
  return (
    <group position={[JAIL_CELL.x, 0, JAIL_CELL.z]}>
      <mesh position={[0, 0.14, 0]} material={m.hullDark}><boxGeometry args={[7.2, 0.28, 7.2]} /></mesh>
      {/* Back, Left, and Right containment walls */}
      <mesh position={[0, 2.2, -3.2]} material={m.conduit}><boxGeometry args={[6.8, 4.1, 0.4]} /></mesh>
      <mesh position={[-3.2, 2.2, 0]} material={m.conduit}><boxGeometry args={[0.4, 4.1, 6.8]} /></mesh>
      <mesh position={[3.2, 2.2, 0]} material={m.conduit}><boxGeometry args={[0.4, 4.1, 6.8]} /></mesh>
      <mesh position={[0, 4.35, 0]} material={m.circuit}><boxGeometry args={[7.1, 0.35, 7.1]} /></mesh>
      {/* Southern door laser grid when locked */}
      {inJail && [-1.8, -0.9, 0, 0.9, 1.8].map((x) => (
        <mesh key={x} position={[x, 2.1, 3.2]} material={laserMat}>
          <boxGeometry args={[0.1, 3.8, 0.1]} />
        </mesh>
      ))}
      <SpriteText position={[0, 5.2, 0]} fontSize={0.48} color="#ff4f6d" letterSpacing={0.1}>
        QUARANTINE CELL
      </SpriteText>
    </group>
  );
}

const BODY: Record<Station['id'], (p: { s: Station }) => JSX.Element> = {
  bunk: Bunk,
  locker: Locker,
  yard: Yard,
  apothecary: Apothecary,
  smith: Smith,
  armorer: Armorer,
  board: Board,
  wall: Wall,
  gate: Gate,
};

export function Stations() {
  const ringMats = useMemo(() => {
    const map = new Map<string, THREE.MeshBasicMaterial>();
    for (const s of STATIONS) map.set(s.id, makeCurvedBasicMaterial({ color: s.color, transparent: true, opacity: 0.42 }));
    return map;
  }, []);

  return (
    <group>
      {STATIONS.map((s) => {
        const Body = BODY[s.id];
        return (
          <group key={s.id} position={[s.pos[0], 0, s.pos[1]]}>
            <Body s={s} />
            <mesh position={[0, 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]} material={ringMats.get(s.id)}>
              <ringGeometry args={[3.9, 4.15, 16]} />
            </mesh>
            <SpriteText position={[0, s.id === 'gate' ? 9.4 : 5.4, 0]} fontSize={0.55} color={s.color} letterSpacing={0.1}>
              {s.label}
            </SpriteText>
          </group>
        );
      })}
      <QuarantineCell />
    </group>
  );
}
