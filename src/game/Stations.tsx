import { useMemo, useRef, type JSX } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import SpriteText from './art/SpriteText';
import { Brazier } from './art/Ps1Sky';
import { cloneTex, getPs1Texture, makePs1Material } from './art/ps1Textures';
import { STATIONS, type Station } from './world/layout';

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
    };
  }
  return cachedMats;
}

function Gate({ s }: { s: Station }) {
  const m = useMemo(getMats, []);
  const ring = useRef<THREE.Mesh>(null!);
  useFrame(({ clock }) => { if (ring.current) ring.current.rotation.z = clock.elapsedTime * 0.9; });
  return (
    <group>
      {/* Twin stone gate piers */}
      {([-2.4, 2.4] as const).map((x) => (
        <group key={x} position={[x, 0, 0]}>
          <mesh position={[0, 0.25, 0]} material={m.stoneDark}><boxGeometry args={[1.65, 0.5, 1.65]} /></mesh>
          <mesh position={[0, 3.3, 0]} material={m.stone}><boxGeometry args={[1.3, 6.2, 1.3]} /></mesh>
          <mesh position={[0, 6.45, 0]} material={m.bronze}><boxGeometry args={[1.5, 0.32, 1.5]} /></mesh>
          <mesh position={[0, 3.6, 0.72]} material={m.banner}><boxGeometry args={[0.9, 2.8, 0.06]} /></mesh>
        </group>
      ))}
      {/* Lintel + Pediment */}
      <mesh position={[0, 6.95, 0]} material={m.stoneDark}><boxGeometry args={[6.9, 0.95, 1.55]} /></mesh>
      <mesh position={[0, 7.65, 0]} material={m.bronze}><boxGeometry args={[7.2, 0.34, 1.75]} /></mesh>
      <mesh position={[0, 8.2, 0]} rotation={[0, Math.PI / 4, 0]} material={m.bronze}><coneGeometry args={[2.2, 0.9, 4]} /></mesh>

      {/* Iron portcullis grate bars (top) */}
      {[-1.2, -0.6, 0, 0.6, 1.2].map((x) => (
        <mesh key={x} position={[x, 5.5, 0]} material={m.iron}><boxGeometry args={[0.09, 1.9, 0.09]} /></mesh>
      ))}

      {/* Glowing Colosseum Portal Ring */}
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

function Armory({ s }: { s: Station }) {
  const m = useMemo(getMats, []);
  return (
    <group>
      {/* Stone forge plinth + bronze trim */}
      <mesh position={[0, 0.16, 0]} material={m.stoneDark}><boxGeometry args={[4.4, 0.32, 2.8]} /></mesh>
      <mesh position={[0, 0.65, 0]} material={m.stone}><boxGeometry args={[3.1, 0.72, 1.3]} /></mesh>
      {/* 4 Forge Canopy Posts + Pitched Roof */}
      {([[-1.85, -1.05], [1.85, -1.05], [-1.85, 1.05], [1.85, 1.05]] as const).map(([x, z], i) => (
        <mesh key={i} position={[x, 2.0, z]} material={m.wood}><boxGeometry args={[0.18, 3.4, 0.18]} /></mesh>
      ))}
      <mesh position={[0, 3.9, 0]} rotation={[0, Math.PI / 4, 0]} material={m.bronze}><coneGeometry args={[3.2, 1.2, 4]} /></mesh>

      {/* Hanging Bronze Buckler + Weapons on the Rack */}
      <mesh position={[-0.95, 1.75, 0.2]} rotation={[Math.PI / 2, 0, 0]} material={m.bronze}><cylinderGeometry args={[0.52, 0.52, 0.08, 10]} /></mesh>
      <mesh position={[0, 1.95, 0]} material={m.iron}><boxGeometry args={[0.14, 1.85, 0.1]} /></mesh>
      <mesh position={[0.55, 2.05, 0]} material={m.wood}><cylinderGeometry args={[0.045, 0.045, 1.7, 5]} /></mesh>
      <mesh position={[0.55, 2.95, 0]} material={m.bronze}><boxGeometry args={[0.3, 0.24, 0.42]} /></mesh>
      <mesh position={[1.05, 2.1, 0]} material={m.wood}><cylinderGeometry args={[0.035, 0.035, 2.0, 5]} /></mesh>
      <mesh position={[1.05, 3.2, 0]} material={m.iron}><coneGeometry args={[0.08, 0.28, 4]} /></mesh>

      {/* Glowing Forge Hearth Anvil */}
      <mesh position={[-1.0, 0.56, 0.85]} material={m.iron}><boxGeometry args={[0.68, 0.48, 0.42]} /></mesh>
      <mesh position={[0, 1.04, 0]}><boxGeometry args={[0.9, 0.08, 0.4]} /><meshBasicMaterial color={s.color} /></mesh>
      <pointLight position={[0, 2.2, 0.6]} color="#ffaa40" intensity={10} distance={14} decay={1.5} />
    </group>
  );
}

function Shrine({ s }: { s: Station }) {
  const m = useMemo(getMats, []);
  const gem = useRef<THREE.Mesh>(null!);
  const halo = useRef<THREE.Mesh>(null!);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (gem.current) { gem.current.rotation.y = t * 0.9; gem.current.position.y = 2.85 + Math.sin(t * 1.6) * 0.18; }
    if (halo.current) { halo.current.rotation.z = t * 1.2; halo.current.rotation.x = Math.sin(t * 0.8) * 0.4; }
  });
  return (
    <group>
      {[1.85, 1.35, 0.85].map((r, i) => (
        <group key={r}>
          <mesh position={[0, 0.22 + i * 0.44, 0]} material={i % 2 === 0 ? m.stone : m.stoneDark}>
            <cylinderGeometry args={[r, r + 0.16, 0.44, 8]} />
          </mesh>
          <mesh position={[0, 0.45 + i * 0.44, 0]} material={m.bronze}>
            <cylinderGeometry args={[r + 0.04, r + 0.04, 0.06, 8]} />
          </mesh>
        </group>
      ))}
      <mesh ref={gem} position={[0, 2.85, 0]}><octahedronGeometry args={[0.72, 0]} /><meshBasicMaterial color={s.color} /></mesh>
      <mesh ref={halo} position={[0, 2.85, 0]} material={m.bronze}><torusGeometry args={[1.05, 0.07, 5, 12]} /></mesh>
      <pointLight position={[0, 3.0, 0]} color={s.color} intensity={10} distance={14} decay={1.5} />
    </group>
  );
}

function Yard({ s }: { s: Station }) {
  const m = useMemo(getMats, []);
  return (
    <group>
      {/* Circular sunken PS1 training sand pit */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]} material={m.sand}>
        <circleGeometry args={[4.6, 16]} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
        <ringGeometry args={[4.45, 4.7, 16]} />
        <meshBasicMaterial color={s.color} transparent opacity={0.65} />
      </mesh>
      {/* Wooden ring fence posts */}
      {Array.from({ length: 8 }, (_, i) => {
        const a = (i / 8) * Math.PI * 2;
        if (Math.cos(a) > 0.7 && Math.abs(Math.sin(a)) < 0.4) return null;
        return (
          <mesh key={i} position={[Math.cos(a) * 4.7, 0.55, Math.sin(a) * 4.7]} material={m.wood}>
            <cylinderGeometry args={[0.1, 0.12, 1.1, 5]} />
          </mesh>
        );
      })}
      {/* 2 Chunky PS1 Armored Pell Dummies */}
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

function Wall() {
  const m = useMemo(getMats, []);
  return (
    <group>
      {/* Stepped Granite Memorial Dais */}
      <mesh position={[0, 0.18, 0]} material={m.stoneDark}><boxGeometry args={[6.8, 0.36, 1.6]} /></mesh>
      {/* Etched Rune Tablet */}
      <mesh position={[0, 2.05, 0]} material={m.rune}><boxGeometry args={[5.6, 3.4, 0.44]} /></mesh>
      {/* Flanking Stone Pilasters & Pediment */}
      <mesh position={[-3.05, 2.05, 0]} material={m.stone}><boxGeometry args={[0.6, 3.6, 0.65]} /></mesh>
      <mesh position={[3.05, 2.05, 0]} material={m.stone}><boxGeometry args={[0.6, 3.6, 0.65]} /></mesh>
      <mesh position={[0, 3.95, 0]} material={m.bronze}><boxGeometry args={[6.8, 0.35, 0.8]} /></mesh>
      <mesh position={[0, 4.45, 0]} rotation={[0, Math.PI / 4, 0]} material={m.stoneDark}><coneGeometry args={[1.4, 0.7, 4]} /></mesh>
      <Brazier position={[-3.7, 0, 0.9]} scale={0.75} />
      <Brazier position={[3.7, 0, 0.9]} scale={0.75} />
    </group>
  );
}

const BODY: Record<Station['id'], (p: { s: Station }) => JSX.Element> = { gate: Gate, armory: Armory, shrine: Shrine, yard: Yard, wall: Wall };

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
