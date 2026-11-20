import { useMemo, useRef, type JSX } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import SpriteText from './art/SpriteText';
import { Brazier } from './art/Ps1Sky';
import { cloneTex, getPs1Texture, makePs1Material } from './art/ps1Textures';
import { STATIONS, type Station } from './world/layout';
import { useGame } from './store';
import { generateDailyQuests } from './rpg/quests';

interface StationMats {
  stone: THREE.MeshLambertMaterial;
  stoneDark: THREE.MeshLambertMaterial;
  bronze: THREE.MeshLambertMaterial;
  iron: THREE.MeshLambertMaterial;
  wood: THREE.MeshLambertMaterial;
  banner: THREE.MeshLambertMaterial;
  sand: THREE.MeshLambertMaterial;
  rune: THREE.MeshLambertMaterial;
  straw: THREE.MeshLambertMaterial;
  roof: THREE.MeshLambertMaterial;
  plaster: THREE.MeshLambertMaterial;
}

let cachedMats: StationMats | null = null;
function getMats(): StationMats {
  if (!cachedMats) {
    cachedMats = {
      stone: makePs1Material({ color: '#d4cae2', map: cloneTex(getPs1Texture('stone'), 2, 2) }),
      stoneDark: makePs1Material({ color: '#9c90b2', map: cloneTex(getPs1Texture('stone'), 2, 2) }),
      bronze: makePs1Material({ color: '#ffd57e', map: getPs1Texture('bronze') }),
      iron: makePs1Material({ color: '#8e96b0', map: getPs1Texture('bronze') }),
      wood: makePs1Material({ color: '#b58052', map: getPs1Texture('wood') }),
      banner: makePs1Material({ color: '#ffffff', map: getPs1Texture('banner'), side: THREE.DoubleSide }),
      sand: makePs1Material({ color: '#e6caa0', map: cloneTex(getPs1Texture('sand'), 4, 4) }),
      rune: makePs1Material({ color: '#ffffff', map: getPs1Texture('rune') }),
      straw: makePs1Material({ color: '#d9b574', map: getPs1Texture('tunic') }),
      roof: makePs1Material({ color: '#f2a47a', map: cloneTex(getPs1Texture('roof'), 3, 2) }),
      plaster: makePs1Material({ color: '#f2dfc8', map: cloneTex(getPs1Texture('plaster'), 2, 2) }),
    };
  }
  return cachedMats;
}

function Bunk() {
  const m = useMemo(getMats, []);
  return (
    <group>
      {/* Stone foundation + Roman barracks cottage + terracotta roof */}
      <mesh position={[0, 0.2, 0]} material={m.stoneDark}><boxGeometry args={[4.4, 0.4, 3.6]} /></mesh>
      <mesh position={[0, 1.55, -0.3]} material={m.plaster}><boxGeometry args={[3.8, 2.3, 2.6]} /></mesh>
      <mesh position={[0, 3.3, -0.3]} rotation={[0, Math.PI / 4, 0]} material={m.roof}><coneGeometry args={[3.1, 1.5, 4]} /></mesh>
      {/* Timber frame bed bunk on front porch */}
      <mesh position={[-0.2, 0.65, 1.25]} material={m.wood}><boxGeometry args={[2.1, 0.45, 1.0]} /></mesh>
      <mesh position={[-0.95, 0.92, 1.25]} material={m.straw}><boxGeometry args={[0.5, 0.2, 0.85]} /></mesh>
      <mesh position={[0.15, 0.88, 1.25]} material={m.banner}><boxGeometry args={[1.4, 0.14, 0.92]} /></mesh>
      <mesh position={[1.35, 1.2, 1.2]}><boxGeometry args={[0.22, 0.3, 0.22]} /><meshBasicMaterial color="#ffc95c" /></mesh>
      <pointLight position={[1.3, 1.6, 1.5]} color="#ffaa55" intensity={8} distance={10} decay={1.6} />
    </group>
  );
}

function Locker({ s }: { s: Station }) {
  const m = useMemo(getMats, []);
  return (
    <group>
      <mesh position={[0, 0.18, 0]} material={m.stoneDark}><boxGeometry args={[3.8, 0.36, 2.6]} /></mesh>
      <mesh position={[0, 1.2, -0.3]} material={m.wood}><boxGeometry args={[2.9, 1.8, 1.1]} /></mesh>
      <mesh position={[-1.4, 1.6, 0]} material={m.wood}><boxGeometry args={[0.18, 2.6, 0.18]} /></mesh>
      <mesh position={[1.4, 1.6, 0]} material={m.wood}><boxGeometry args={[0.18, 2.6, 0.18]} /></mesh>
      <mesh position={[0, 2.95, 0]} material={m.bronze}><boxGeometry args={[3.3, 0.28, 1.4]} /></mesh>
      <mesh position={[-0.75, 1.55, 0.32]} rotation={[Math.PI / 2, 0, 0]} material={m.bronze}><cylinderGeometry args={[0.45, 0.45, 0.08, 8]} /></mesh>
      <mesh position={[0.65, 1.7, 0.3]} material={m.iron}><boxGeometry args={[0.14, 1.5, 0.1]} /></mesh>
      <mesh position={[0, 0.45, 0.55]}><boxGeometry args={[0.9, 0.1, 0.5]} /><meshBasicMaterial color={s.color} /></mesh>
    </group>
  );
}

function Yard({ s }: { s: Station }) {
  const m = useMemo(getMats, []);
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]} material={m.sand}><circleGeometry args={[4.6, 16]} /></mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
        <ringGeometry args={[4.45, 4.7, 16]} /><meshBasicMaterial color={s.color} transparent opacity={0.65} />
      </mesh>
      {Array.from({ length: 8 }, (_, i) => {
        const a = (i / 8) * Math.PI * 2;
        if (Math.cos(a) > 0.7 && Math.abs(Math.sin(a)) < 0.4) return null;
        return (
          <mesh key={i} position={[Math.cos(a) * 4.7, 0.55, Math.sin(a) * 4.7]} material={m.wood}>
            <cylinderGeometry args={[0.1, 0.12, 1.1, 5]} />
          </mesh>
        );
      })}
      {([-2.5, 2.5] as const).map((x) => (
        <group key={x} position={[x, 0, 0]}>
          <mesh position={[0, 0.95, 0]} material={m.wood}><cylinderGeometry args={[0.09, 0.11, 1.9, 5]} /></mesh>
          <mesh position={[0, 1.55, 0]} material={m.straw}><cylinderGeometry args={[0.24, 0.18, 0.72, 6]} /></mesh>
          <mesh position={[0, 1.65, 0]} material={m.wood}><boxGeometry args={[1.25, 0.16, 0.16]} /></mesh>
          <mesh position={[0, 2.15, 0]} material={m.iron}><cylinderGeometry args={[0.16, 0.18, 0.34, 6]} /></mesh>
          <mesh position={[0.45, 1.52, 0.22]} rotation={[Math.PI / 2, 0, 0]} material={m.bronze}><cylinderGeometry args={[0.28, 0.28, 0.06, 8]} /></mesh>
        </group>
      ))}
    </group>
  );
}

function Smith({ s }: { s: Station }) {
  const m = useMemo(getMats, []);
  return (
    <group>
      <mesh position={[0, 0.16, 0]} material={m.stoneDark}><boxGeometry args={[4.6, 0.32, 3.0]} /></mesh>
      <mesh position={[0, 0.65, -0.2]} material={m.stone}><boxGeometry args={[3.4, 0.75, 1.3]} /></mesh>
      {([[-1.95, -1.1], [1.95, -1.1], [-1.95, 1.1], [1.95, 1.1]] as const).map(([x, z], i) => (
        <mesh key={i} position={[x, 2.0, z]} material={m.wood}><boxGeometry args={[0.2, 3.4, 0.2]} /></mesh>
      ))}
      <mesh position={[0, 3.9, 0]} rotation={[0, Math.PI / 4, 0]} material={m.roof}><coneGeometry args={[3.4, 1.3, 4]} /></mesh>
      {/* Weaponsmith forge counter & hanging arms */}
      <mesh position={[-1.0, 0.56, 0.9]} material={m.iron}><boxGeometry args={[0.72, 0.5, 0.44]} /></mesh>
      <mesh position={[0, 1.08, -0.15]}><boxGeometry args={[1.0, 0.1, 0.45]} /><meshBasicMaterial color={s.color} /></mesh>
      <mesh position={[0.45, 2.05, 0]} material={m.wood}><cylinderGeometry args={[0.045, 0.045, 1.7, 5]} /></mesh>
      <mesh position={[0.45, 2.95, 0]} material={m.bronze}><boxGeometry args={[0.3, 0.24, 0.42]} /></mesh>
      <mesh position={[1.05, 2.1, 0]} material={m.wood}><cylinderGeometry args={[0.035, 0.035, 2.0, 5]} /></mesh>
      <mesh position={[1.05, 3.2, 0]} material={m.iron}><coneGeometry args={[0.08, 0.28, 4]} /></mesh>
      <Brazier position={[-1.5, 0, 1.2]} scale={0.7} light />
    </group>
  );
}

function Armorer({ s }: { s: Station }) {
  const m = useMemo(getMats, []);
  return (
    <group>
      <mesh position={[0, 0.16, 0]} material={m.stoneDark}><boxGeometry args={[4.6, 0.32, 3.0]} /></mesh>
      <mesh position={[0, 0.65, -0.2]} material={m.wood}><boxGeometry args={[3.5, 0.78, 1.3]} /></mesh>
      {([[-1.95, -1.1], [1.95, -1.1], [-1.95, 1.1], [1.95, 1.1]] as const).map(([x, z], i) => (
        <mesh key={i} position={[x, 2.0, z]} material={m.wood}><boxGeometry args={[0.2, 3.4, 0.2]} /></mesh>
      ))}
      {/* Market striped crimson awning + bronze shields & torso stand */}
      <mesh position={[0, 3.7, 0]} material={m.banner}><boxGeometry args={[4.6, 0.4, 2.8]} /></mesh>
      <mesh position={[0, 4.2, 0]} rotation={[0, Math.PI / 4, 0]} material={m.bronze}><coneGeometry args={[3.1, 1.0, 4]} /></mesh>
      <mesh position={[-0.9, 1.6, 0.1]} material={m.bronze}><cylinderGeometry args={[0.24, 0.18, 0.75, 6]} /></mesh>
      <mesh position={[-0.9, 2.25, 0.1]} material={m.bronze}><cylinderGeometry args={[0.16, 0.18, 0.3, 6]} /></mesh>
      <mesh position={[0.7, 1.7, 0.25]} rotation={[Math.PI / 2, 0, 0]} material={m.bronze}><cylinderGeometry args={[0.55, 0.55, 0.1, 8]} /></mesh>
      <mesh position={[0, 1.05, 0.5]}><boxGeometry args={[1.1, 0.08, 0.2]} /><meshBasicMaterial color={s.color} /></mesh>
      <pointLight position={[0, 2.3, 0.7]} color="#6be8ff" intensity={7} distance={12} decay={1.6} />
    </group>
  );
}

function Apothecary({ s }: { s: Station }) {
  const m = useMemo(getMats, []);
  return (
    <group>
      <mesh position={[0, 0.16, 0]} material={m.stoneDark}><boxGeometry args={[4.2, 0.32, 2.8]} /></mesh>
      <mesh position={[0, 0.68, 0]} material={m.wood}><boxGeometry args={[3.4, 0.84, 1.4]} /></mesh>
      {([-1.6, 1.6] as const).map((x) => (
        <mesh key={x} position={[x, 1.95, -0.6]} material={m.wood}><boxGeometry args={[0.18, 3.2, 0.18]} /></mesh>
      ))}
      <mesh position={[0, 3.5, 0]} rotation={[0.15, 0, 0]} material={m.roof}><boxGeometry args={[4.2, 0.26, 2.4]} /></mesh>
      {/* Glowing emerald healing flasks & warm Roman honey loaves on counter */}
      {([-0.9, -0.45, 0] as const).map((x) => (
        <mesh key={x} position={[x, 1.32, 0.2]}><octahedronGeometry args={[0.18, 0]} /><meshBasicMaterial color={s.color} /></mesh>
      ))}
      <mesh position={[0.85, 1.24, 0.2]} material={m.straw}><cylinderGeometry args={[0.38, 0.3, 0.25, 6]} /></mesh>
      <pointLight position={[0, 2.0, 0.6]} color="#4dffa0" intensity={8} distance={12} decay={1.6} />
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

  useFrame(({ clock }) => {
    if (!marker.current) return;
    marker.current.visible = hasReady || hasNew;
    marker.current.rotation.y = clock.elapsedTime * 2.2;
    marker.current.position.y = 3.7 + Math.sin(clock.elapsedTime * 3.2) * 0.18;
  });

  return (
    <group>
      <mesh position={[0, 0.15, 0]} material={m.stoneDark}><boxGeometry args={[3.2, 0.3, 1.6]} /></mesh>
      <mesh position={[-1.2, 1.5, 0]} material={m.wood}><boxGeometry args={[0.2, 2.8, 0.2]} /></mesh>
      <mesh position={[1.2, 1.5, 0]} material={m.wood}><boxGeometry args={[0.2, 2.8, 0.2]} /></mesh>
      <mesh position={[0, 1.75, 0]} material={m.wood}><boxGeometry args={[2.3, 1.5, 0.18]} /></mesh>
      <mesh position={[0, 2.85, 0]} material={m.roof}><boxGeometry args={[3.0, 0.35, 1.2]} /></mesh>
      {([-0.6, 0, 0.6] as const).map((x) => (
        <mesh key={x} position={[x, 1.78, 0.12]} material={m.straw}><boxGeometry args={[0.42, 0.55, 0.04]} /></mesh>
      ))}
      <mesh ref={marker} position={[0, 3.7, 0]}>
        <octahedronGeometry args={[0.35, 0]} />
        <meshBasicMaterial color={hasReady ? '#4dffa0' : s.color} />
      </mesh>
    </group>
  );
}

function Wall() {
  const m = useMemo(getMats, []);
  return (
    <group>
      <mesh position={[0, 0.18, 0]} material={m.stoneDark}><boxGeometry args={[6.8, 0.36, 1.6]} /></mesh>
      <mesh position={[0, 2.05, 0]} material={m.rune}><boxGeometry args={[5.6, 3.4, 0.44]} /></mesh>
      <mesh position={[-3.05, 2.05, 0]} material={m.stone}><boxGeometry args={[0.6, 3.6, 0.65]} /></mesh>
      <mesh position={[3.05, 2.05, 0]} material={m.stone}><boxGeometry args={[0.6, 3.6, 0.65]} /></mesh>
      <mesh position={[0, 3.95, 0]} material={m.bronze}><boxGeometry args={[6.8, 0.35, 0.8]} /></mesh>
      <mesh position={[0, 4.45, 0]} rotation={[0, Math.PI / 4, 0]} material={m.stoneDark}><coneGeometry args={[1.4, 0.7, 4]} /></mesh>
      <Brazier position={[-3.7, 0, 0.9]} scale={0.75} />
      <Brazier position={[3.7, 0, 0.9]} scale={0.75} />
    </group>
  );
}

function Gate({ s }: { s: Station }) {
  const m = useMemo(getMats, []);
  const ring = useRef<THREE.Mesh>(null!);
  useFrame(({ clock }) => { if (ring.current) ring.current.rotation.z = clock.elapsedTime * 0.9; });
  return (
    <group>
      {([-2.4, 2.4] as const).map((x) => (
        <group key={x} position={[x, 0, 0]}>
          <mesh position={[0, 0.25, 0]} material={m.stoneDark}><boxGeometry args={[1.65, 0.5, 1.65]} /></mesh>
          <mesh position={[0, 3.3, 0]} material={m.stone}><boxGeometry args={[1.3, 6.2, 1.3]} /></mesh>
          <mesh position={[0, 6.45, 0]} material={m.bronze}><boxGeometry args={[1.5, 0.32, 1.5]} /></mesh>
          <mesh position={[0, 3.6, 0.72]} material={m.banner}><boxGeometry args={[0.9, 2.8, 0.06]} /></mesh>
        </group>
      ))}
      <mesh position={[0, 6.95, 0]} material={m.stoneDark}><boxGeometry args={[6.9, 0.95, 1.55]} /></mesh>
      <mesh position={[0, 7.65, 0]} material={m.bronze}><boxGeometry args={[7.2, 0.34, 1.75]} /></mesh>
      <mesh position={[0, 8.2, 0]} rotation={[0, Math.PI / 4, 0]} material={m.bronze}><coneGeometry args={[2.2, 0.9, 4]} /></mesh>
      {[-1.2, -0.6, 0, 0.6, 1.2].map((x) => (
        <mesh key={x} position={[x, 5.5, 0]} material={m.iron}><boxGeometry args={[0.09, 1.9, 0.09]} /></mesh>
      ))}
      <mesh ref={ring} position={[0, 3.2, 0]}>
        <torusGeometry args={[2.0, 0.1, 6, 20]} />
        <meshBasicMaterial color={s.color} />
      </mesh>
      <mesh position={[0, 3.2, 0]}>
        <circleGeometry args={[1.95, 16]} />
        <meshBasicMaterial color={s.color} transparent opacity={0.2} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      <Brazier position={[-3.7, 0, 1.4]} scale={0.95} light />
      <Brazier position={[3.7, 0, 1.4]} scale={0.95} />
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
  return (
    <group>
      {STATIONS.map((s) => {
        const Body = BODY[s.id];
        return (
          <group key={s.id} position={[s.pos[0], 0, s.pos[1]]}>
            <Body s={s} />
            <mesh position={[0, 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[3.9, 4.15, 16]} />
              <meshBasicMaterial color={s.color} transparent opacity={0.38} />
            </mesh>
            <SpriteText position={[0, s.id === 'gate' ? 9.3 : 5.4, 0]} fontSize={0.55} color={s.color} letterSpacing={0.1}>
              {s.label}
            </SpriteText>
          </group>
        );
      })}
    </group>
  );
}
