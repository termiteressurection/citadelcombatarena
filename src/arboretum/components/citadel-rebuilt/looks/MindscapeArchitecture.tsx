import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import SpriteText from '../../three/SpriteText';
import { applyGlobeCurvature } from '../RebuiltWorldShared';
import { useWorldLook, type WorldLookId } from './worldLook';

export interface MindscapeArchitectureProps {
  playerPos: React.MutableRefObject<THREE.Vector3>;
  nearNoticeBoard?: boolean;
  nearMapTable?: boolean;
  nearLibrary?: boolean;
  nearMoodStone?: boolean;
  nearBottlePost?: boolean;
}

const HUB_COORDS = {
  mindmap: [0, 0, -34] as [number, number, number],
  vault: [-36, 0, -34] as [number, number, number],
  post: [36, 0, -34] as [number, number, number],
  terminal: [0, 0, -68] as [number, number, number],
};

const WING_COORDS: [number, number, number][] = [
  [-36, 0, -22],
  [-36, 0, -46],
  [36, 0, -22],
  [36, 0, -46],
];

const GATE_COORDS: { pos: [number, number, number]; rot: number }[] = [
  { pos: [0, 0, -18], rot: 0 },
  { pos: [0, 0, 28], rot: Math.PI },
  { pos: [-28, 0, 0], rot: Math.PI / 2 },
  { pos: [28, 0, 0], rot: -Math.PI / 2 },
];

const STREET_LAMP_COORDS: [number, number, number][] = [
  [-6, 0, -12],
  [6, 0, -12],
  [-6, 0, -54],
  [6, 0, -54],
  [-5, 0, 18],
  [5, 0, 18],
  [-5, 0, 34],
  [5, 0, 34],
  [-20, 0, -5],
  [-20, 0, 5],
  [-34, 0, -5],
  [-34, 0, 5],
  [20, 0, -5],
  [20, 0, 5],
  [34, 0, -5],
  [34, 0, 5],
];

const PLAZA_LANTERN_COORDS: [number, number, number][] = [
  [-8, 0, -14],
  [8, 0, -14],
  [-8, 0, 14],
  [8, 0, 14],
  [-18, 0, -8],
  [18, 0, -8],
  [-18, 0, 8],
  [18, 0, 8],
];

const OWN_TAG = {
  dreamOwn: true,
  comicOwn: true,
  acidOwn: true,
  minimalOwn: true,
  papercraftOwn: true,
  industrialOwn: true,
  westernOwn: true,
  archetypeOwn: true,
};

interface LookTheme {
  core: string;
  secondary: string;
  roof: string;
  wire: string;
  accent: string;
  window: string;
  sign: string;
  flat?: boolean;
  inkOutline?: boolean;
  wireOpacity?: number;
}

const LOOK_THEMES: Record<Exclude<WorldLookId, 'wireframe'>, LookTheme> = {
  dream: {
    core: '#f5dcc4',
    secondary: '#f7c6d9',
    roof: '#8e6b9e',
    wire: '#f9e4c8',
    accent: '#9cd654',
    window: '#fff3b0',
    sign: '#ffffff',
    wireOpacity: 0.45,
  },
  comic: {
    core: '#00d4ff',
    secondary: '#ff2a55',
    roof: '#ffe600',
    wire: '#08040f',
    accent: '#00e575',
    window: '#fff75e',
    sign: '#ffe600',
    inkOutline: true,
    wireOpacity: 0.9,
  },
  acid: {
    core: '#19052c',
    secondary: '#2d0647',
    roof: '#ff007f',
    wire: '#00f0ff',
    accent: '#39ff14',
    window: '#ffe600',
    sign: '#39ff14',
    wireOpacity: 0.88,
  },
  minimal: {
    core: '#ffffff',
    secondary: '#f4f4f6',
    roof: '#ffffff',
    wire: '#111115',
    accent: '#ffffff',
    window: '#ffffff',
    sign: '#ffffff',
    wireOpacity: 0.35,
  },
  papercraft: {
    core: '#f6ead4',
    secondary: '#f2cc8f',
    roof: '#e07a5f',
    wire: '#8a5a44',
    accent: '#81b29a',
    window: '#fff3b0',
    sign: '#fdf8ee',
    flat: true,
    wireOpacity: 0.55,
  },
  industrial: {
    core: '#1d2128',
    secondary: '#2b303a',
    roof: '#3b2618',
    wire: '#d97706',
    accent: '#ff6b00',
    window: '#ff9e00',
    sign: '#ffae42',
    wireOpacity: 0.72,
  },
  western: {
    core: '#8c5e36',
    secondary: '#6e4726',
    roof: '#4a301c',
    wire: '#d4a373',
    accent: '#5c5338',
    window: '#ffd27d',
    sign: '#faedcd',
    wireOpacity: 0.42,
  },
  crt: {
    core: '#031608',
    secondary: '#05240d',
    roof: '#073614',
    wire: '#22ff66',
    accent: '#ffb000',
    window: '#39ff14',
    sign: '#22ff66',
    wireOpacity: 0.92,
  },
  ukiyoe: {
    core: '#f4ebd9',
    secondary: '#1d3557',
    roof: '#d62828',
    wire: '#161412',
    accent: '#e63946',
    window: '#ffe5b4',
    sign: '#f4ebd9',
    flat: true,
    wireOpacity: 0.65,
  },
  cathedral: {
    core: '#160c28',
    secondary: '#23133d',
    roof: '#3a1c5e',
    wire: '#ffb703',
    accent: '#ff006e',
    window: '#3a86ff',
    sign: '#ffb703',
    wireOpacity: 0.82,
  },
  blueprint: {
    core: '#082c54',
    secondary: '#0b3b6e',
    roof: '#104c8a',
    wire: '#e0f4ff',
    accent: '#ffd166',
    window: '#90e0ef',
    sign: '#e0f4ff',
    wireOpacity: 0.9,
  },
  biolume: {
    core: '#041f36',
    secondary: '#073454',
    roof: '#0a4870',
    wire: '#00f5d4',
    accent: '#f15bb5',
    window: '#7bf1a8',
    sign: '#00f5d4',
    wireOpacity: 0.85,
  },
  kintsugi: {
    core: '#141218',
    secondary: '#1f1c24',
    roof: '#292530',
    wire: '#ffd166',
    accent: '#ffb703',
    window: '#ffe599',
    sign: '#ffd166',
    wireOpacity: 0.88,
  },
  solarpunk: {
    core: '#f4f1de',
    secondary: '#e9edc9',
    roof: '#52b788',
    wire: '#d4a373',
    accent: '#ffd166',
    window: '#b7e4c7',
    sign: '#ffffff',
    wireOpacity: 0.68,
  },
  noir: {
    core: '#0c0c10',
    secondary: '#16161d',
    roof: '#20202a',
    wire: '#cbd5e1',
    accent: '#e6193c',
    window: '#f8fafc',
    sign: '#ff2a4b',
    wireOpacity: 0.72,
  },
};

/* ──────────────────────  GOLD-STANDARD DUAL-LAYER PRIMITIVES  ────────────────────── */

function FramedBox({
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  args,
  color,
  wireColor,
  wireOpacity = 0.75,
  flat = false,
  inkOutline = false,
}: {
  position?: [number, number, number];
  rotation?: [number, number, number];
  args: [number, number, number];
  color: string;
  wireColor: string;
  wireOpacity?: number;
  flat?: boolean;
  inkOutline?: boolean;
}) {
  return (
    <group position={position} rotation={rotation}>
      <mesh>
        <boxGeometry args={args} />
        <meshLambertMaterial color={color} flatShading={flat} />
      </mesh>
      <mesh scale={[1.012, 1.012, 1.012]}>
        <boxGeometry args={args} />
        <meshBasicMaterial color={wireColor} wireframe transparent opacity={wireOpacity} />
      </mesh>
      {inkOutline && (
        <mesh scale={[1.045, 1.025, 1.045]}>
          <boxGeometry args={args} />
          <meshBasicMaterial color="#08040f" side={THREE.BackSide} />
        </mesh>
      )}
    </group>
  );
}

function FramedCylinder({
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  args,
  color,
  wireColor,
  wireOpacity = 0.75,
  flat = false,
  inkOutline = false,
}: {
  position?: [number, number, number];
  rotation?: [number, number, number];
  args: [number, number, number, number];
  color: string;
  wireColor: string;
  wireOpacity?: number;
  flat?: boolean;
  inkOutline?: boolean;
}) {
  return (
    <group position={position} rotation={rotation}>
      <mesh>
        <cylinderGeometry args={args} />
        <meshLambertMaterial color={color} flatShading={flat} />
      </mesh>
      <mesh scale={[1.016, 1.01, 1.016]}>
        <cylinderGeometry args={args} />
        <meshBasicMaterial color={wireColor} wireframe transparent opacity={wireOpacity} />
      </mesh>
      {inkOutline && (
        <mesh scale={[1.05, 1.025, 1.05]}>
          <cylinderGeometry args={args} />
          <meshBasicMaterial color="#08040f" side={THREE.BackSide} />
        </mesh>
      )}
    </group>
  );
}

function FramedCone({
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  args,
  color,
  wireColor,
  wireOpacity = 0.8,
  flat = false,
  inkOutline = false,
}: {
  position?: [number, number, number];
  rotation?: [number, number, number];
  args: [number, number, number];
  color: string;
  wireColor: string;
  wireOpacity?: number;
  flat?: boolean;
  inkOutline?: boolean;
}) {
  return (
    <group position={position} rotation={rotation}>
      <mesh>
        <coneGeometry args={args} />
        <meshLambertMaterial color={color} flatShading={flat} />
      </mesh>
      <mesh scale={[1.018, 1.015, 1.018]}>
        <coneGeometry args={args} />
        <meshBasicMaterial color={wireColor} wireframe transparent opacity={wireOpacity} />
      </mesh>
      {inkOutline && (
        <mesh scale={[1.055, 1.03, 1.055]}>
          <coneGeometry args={args} />
          <meshBasicMaterial color="#08040f" side={THREE.BackSide} />
        </mesh>
      )}
    </group>
  );
}

/* ──────────────────────  CURVED GROUP WRAPPER  ────────────────────── */

function CurvedNode({
  position,
  rotation = 0,
  playerPos,
  near = false,
  children,
}: {
  position: [number, number, number];
  rotation?: number;
  playerPos: React.MutableRefObject<THREE.Vector3>;
  near?: boolean;
  children: React.ReactNode;
}) {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    applyGlobeCurvature(ref.current, position[0], position[1], position[2], playerPos.current, rotation);
    if (near) {
      ref.current.scale.setScalar(1 + Math.sin(clock.elapsedTime * 2.5) * 0.02);
    } else {
      ref.current.scale.setScalar(1);
    }
  });
  return (
    <group ref={ref} position={position} userData={OWN_TAG}>
      {children}
    </group>
  );
}

/* ──────────────────────  15 BESPOKE WORLD HUB ARCHITECTURES  ────────────────────── */

function HubLandmark({
  look,
  role,
  position,
  label,
  near,
  playerPos,
}: {
  look: Exclude<WorldLookId, 'wireframe'>;
  role: 'mindmap' | 'vault' | 'post' | 'terminal';
  position: [number, number, number];
  label: string;
  near: boolean;
  playerPos: React.MutableRefObject<THREE.Vector3>;
}) {
  const spinRef = useRef<THREE.Group>(null);
  const ringRef = useRef<THREE.Group>(null);
  const t = LOOK_THEMES[look];

  useFrame(({ clock }) => {
    const elapsed = clock.elapsedTime;
    const stepped = look === 'comic' || look === 'papercraft' ? Math.floor(elapsed * 12) / 12 : elapsed;
    if (spinRef.current) {
      spinRef.current.rotation.y = stepped * 0.65;
      if (look === 'dream' || look === 'industrial' || look === 'western' || look === 'solarpunk' || look === 'papercraft') {
        spinRef.current.rotation.z = stepped * 0.85;
      }
    }
    if (ringRef.current) {
      ringRef.current.rotation.x = Math.sin(stepped * 0.7) * 0.45;
      ringRef.current.rotation.y = -stepped * 0.55;
    }
  });

  // ── 1. DREAM (Storybook Sanctuary — Windmill, Rose Cottage, Dovecote & Cloud Keep) ──
  if (look === 'dream') {
    return (
      <CurvedNode position={position} playerPos={playerPos} near={near}>
        <FramedCylinder position={[0, 0.45, 0]} args={[4.6, 5.0, 0.9, 12]} color="#ebd4be" wireColor="#f9e4c8" wireOpacity={0.45} />
        <FramedCylinder
          position={[0, 4.2, 0]}
          args={[role === 'mindmap' ? 2.8 : 3.6, 4.0, 7.6, 12]}
          color={role === 'vault' ? '#f7c6d9' : role === 'post' ? '#c8e6b8' : '#f5dcc4'}
          wireColor="#ffffff"
          wireOpacity={0.38}
        />
        <mesh position={[0, 8.1, 0]}>
          <cylinderGeometry args={[4.8, 4.2, 0.45, 12]} />
          <meshLambertMaterial color="#f9e4c8" />
        </mesh>
        <FramedCone
          position={[0, 10.6, 0]}
          args={[4.8, 4.8, 12]}
          color={role === 'mindmap' ? '#8e6b9e' : role === 'vault' ? '#d95b72' : role === 'post' ? '#5c8d89' : '#6a8caf'}
          wireColor="#fbe4ee"
          wireOpacity={0.45}
        />
        <mesh position={[0, 1.5, 3.88]}>
          <boxGeometry args={[1.4, 2.6, 0.18]} />
          <meshLambertMaterial color="#c94a58" />
        </mesh>
        <mesh position={[0, 4.6, 3.75]}>
          <circleGeometry args={[1.25, 16]} />
          <meshBasicMaterial color="#fff3b0" />
        </mesh>
        {role === 'mindmap' ? (
          <group ref={spinRef} position={[0, 6.8, 3.8]}>
            {[0, 1, 2, 3].map((i) => (
              <mesh key={i} rotation={[0, 0, (i * Math.PI) / 2]}>
                <boxGeometry args={[0.55, 10.2, 0.14]} />
                <meshLambertMaterial color="#f9e4c8" />
              </mesh>
            ))}
          </group>
        ) : (
          <group ref={spinRef} position={[0, 14.2, 0]}>
            <mesh>
              <octahedronGeometry args={[0.85, 0]} />
              <meshBasicMaterial color="#fff3b0" />
            </mesh>
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[1.45, 0.08, 8, 24]} />
              <meshBasicMaterial color="#f7c6d9" />
            </mesh>
          </group>
        )}
        <SpriteText position={[0, 16.5, 0]} fontSize={near ? 0.78 : 0.48} color="#ffffff" outlineWidth={0.045} outlineColor="#2b1938">
          {label.toUpperCase()}
        </SpriteText>
      </CurvedNode>
    );
  }

  // ── 2. WESTERN (High-Noon Frontier Town — False-Front Saloons, Boardwalks & Windmills) ──
  if (look === 'western') {
    return (
      <CurvedNode position={position} playerPos={playerPos} near={near}>
        <FramedBox position={[0, 0.35, 1.2]} args={[8.8, 0.7, 9.6]} color="#5c3d24" wireColor="#d4a373" wireOpacity={0.45} />
        <FramedBox
          position={[0, 3.8, 0]}
          args={[7.4, 6.4, 7.0]}
          color={role === 'vault' ? '#7a4e2d' : role === 'post' ? '#94663c' : '#8c5e36'}
          wireColor="#d4a373"
          wireOpacity={0.5}
        />
        <FramedBox position={[0, 6.2, 3.55]} args={[7.8, 10.8, 0.5]} color="#6e4726" wireColor="#faedcd" wireOpacity={0.48} />
        <FramedBox position={[0, 12.1, 3.55]} args={[4.8, 1.6, 0.55]} color="#5c3d24" wireColor="#faedcd" wireOpacity={0.5} />
        <FramedBox position={[0, 4.1, 4.8]} args={[8.4, 0.4, 2.8]} color="#4a301c" wireColor="#d4a373" wireOpacity={0.45} />
        {[-3.6, -1.4, 1.4, 3.6].map((px) => (
          <mesh key={px} position={[px, 2.1, 5.8]}>
            <cylinderGeometry args={[0.14, 0.16, 3.8, 6]} />
            <meshLambertMaterial color="#3d2616" />
          </mesh>
        ))}
        <mesh position={[0, 1.8, 3.82]}>
          <boxGeometry args={[1.8, 2.4, 0.12]} />
          <meshLambertMaterial color="#3d2616" />
        </mesh>
        {[-2.2, 2.2].map((wx) => (
          <mesh key={wx} position={[wx, 2.8, 3.82]}>
            <planeGeometry args={[1.6, 2.0]} />
            <meshBasicMaterial color="#ffd27d" />
          </mesh>
        ))}
        <mesh position={[0, 9.5, -1.2]}>
          <cylinderGeometry args={[0.3, 1.2, 5.5, 4]} />
          <meshBasicMaterial color="#d4a373" wireframe />
        </mesh>
        <group ref={spinRef} position={[0, 13.2, -0.4]}>
          {[0, 1, 2, 3].map((i) => (
            <mesh key={i} rotation={[0, 0, (i * Math.PI) / 4]}>
              <boxGeometry args={[0.38, 5.8, 0.12]} />
              <meshLambertMaterial color="#faedcd" />
            </mesh>
          ))}
        </group>
        <SpriteText position={[0, 16.8, 0]} fontSize={near ? 0.78 : 0.48} color="#faedcd" outlineWidth={0.045} outlineColor="#261509">
          {label.toUpperCase()}
        </SpriteText>
      </CurvedNode>
    );
  }

  // ── 3. COMIC (Spider-Verse / Kirby Pop-Art Metropolis — Stepped Skyscrapers, Daily Planet Globe & Water Towers) ──
  if (look === 'comic') {
    const primary = role === 'mindmap' ? '#00d4ff' : role === 'vault' ? '#ff2a55' : role === 'post' ? '#ffe600' : '#9b4dff';
    const secondary = role === 'mindmap' ? '#ffe600' : role === 'vault' ? '#00d4ff' : role === 'post' ? '#ff2a55' : '#00e575';
    return (
      <CurvedNode position={position} playerPos={playerPos} near={near}>
        <FramedBox position={[0, 0.5, 0]} args={[8.6, 1.0, 8.6]} color="#08040f" wireColor="#ffe600" wireOpacity={0.9} />
        <FramedBox position={[0, 6.0, 0]} args={[7.0, 10.5, 7.0]} color={primary} wireColor="#08040f" wireOpacity={0.95} inkOutline />
        <FramedBox position={[0, 13.5, 0]} args={[4.8, 6.0, 4.8]} color={secondary} wireColor="#08040f" wireOpacity={0.95} inkOutline />
        {/* 4x3 Halftone Yellow Comic Window Grid */}
        {[-2.0, 0, 2.0].map((wx) =>
          [3.0, 5.8, 8.6].map((wy) => (
            <mesh key={`${wx}-${wy}`} position={[wx, wy, 3.58]}>
              <planeGeometry args={[1.3, 1.7]} />
              <meshBasicMaterial color="#fff75e" />
            </mesh>
          )),
        )}
        {/* Role-Specific Pop-Art Rooftop Landmarks */}
        {role === 'mindmap' && (
          /* Daily Planet Ringed Golden Globe on Steel Truss */
          <group ref={ringRef} position={[0, 19.2, 0]}>
            <mesh>
              <sphereGeometry args={[2.1, 14, 12]} />
              <meshBasicMaterial color="#ffe600" />
            </mesh>
            <mesh scale={1.08}>
              <sphereGeometry args={[2.1, 12, 10]} />
              <meshBasicMaterial color="#08040f" wireframe />
            </mesh>
            <mesh rotation={[Math.PI / 3, 0, 0]}>
              <torusGeometry args={[3.2, 0.22, 8, 28]} />
              <meshBasicMaterial color="#ff2a55" />
            </mesh>
          </group>
        )}
        {role === 'vault' && (
          /* Giant Circular Pop-Art Steel Bank Vault Door on Front + Kirby Krackle Crown */
          <>
            <mesh position={[0, 4.5, 3.62]}>
              <circleGeometry args={[2.2, 20]} />
              <meshBasicMaterial color="#ffe600" />
            </mesh>
            <mesh position={[0, 4.5, 3.65]}>
              <ringGeometry args={[1.7, 2.25, 20]} />
              <meshBasicMaterial color="#08040f" />
            </mesh>
            <group ref={spinRef} position={[0, 18.8, 0]}>
              <mesh>
                <icosahedronGeometry args={[1.9, 0]} />
                <meshBasicMaterial color="#00e575" />
              </mesh>
              <mesh scale={1.15}>
                <icosahedronGeometry args={[1.9, 0]} />
                <meshBasicMaterial color="#08040f" wireframe />
              </mesh>
            </group>
          </>
        )}
        {(role === 'post' || role === 'terminal') && (
          /* NYC Rooftop Water Tower + Radio Broadcast Mast & Action Starburst */
          <>
            <FramedCylinder position={[-1.4, 18.2, 0]} args={[1.2, 1.2, 2.6, 8]} color="#ff2a55" wireColor="#08040f" wireOpacity={0.95} inkOutline />
            <FramedCone position={[-1.4, 20.1, 0]} args={[1.45, 1.3, 8]} color="#ffe600" wireColor="#08040f" wireOpacity={0.95} inkOutline />
            <group ref={spinRef} position={[1.4, 19.5, 0]}>
              <mesh>
                <octahedronGeometry args={[1.7, 0]} />
                <meshBasicMaterial color="#00d4ff" />
              </mesh>
              <mesh scale={1.18}>
                <octahedronGeometry args={[1.7, 0]} />
                <meshBasicMaterial color="#08040f" side={THREE.BackSide} />
              </mesh>
            </group>
          </>
        )}
        <SpriteText position={[0, 23.2, 0]} fontSize={near ? 0.82 : 0.5} color="#ffe600" outlineWidth={0.055} outlineColor="#08040f">
          {label.toUpperCase()}
        </SpriteText>
      </CurvedNode>
    );
  }

  // ── 4. ACID (Psychedelic Mycelium Cathedrals, Crystal Geodes & Sacred Geometry on R=60) ──
  if (look === 'acid') {
    const capColor = role === 'mindmap' ? '#ff007f' : role === 'vault' ? '#00f0ff' : role === 'post' ? '#39ff14' : '#ffe600';
    return (
      <CurvedNode position={position} playerPos={playerPos} near={near}>
        {/* Sacred Geometry Octagonal Wireframe Base */}
        <FramedCylinder position={[0, 0.5, 0]} args={[4.8, 5.4, 1.0, 8]} color="#19052c" wireColor="#39ff14" wireOpacity={0.92} />
        {role === 'vault' ? (
          /* Cluster of 5 Towering Bioluminescent Quartz Crystal Prisms in Neon Wireframe Cages */
          <>
            {[
              { x: 0, z: 0, h: 12.5, r: 1.6, rotZ: 0, col: '#00f0ff' },
              { x: -2.2, z: 0.8, h: 9.2, r: 1.2, rotZ: 0.22, col: '#ff007f' },
              { x: 2.2, z: 0.8, h: 9.6, r: 1.2, rotZ: -0.22, col: '#39ff14' },
              { x: -1.6, z: -1.8, h: 8.0, r: 1.0, rotZ: 0.18, col: '#ffe600' },
              { x: 1.6, z: -1.8, h: 8.4, r: 1.0, rotZ: -0.18, col: '#ff007f' },
            ].map((cr, i) => (
              <group key={i} position={[cr.x, 0, cr.z]} rotation={[0, 0, cr.rotZ]}>
                <FramedCylinder position={[0, cr.h * 0.5, 0]} args={[cr.r * 0.65, cr.r, cr.h, 6]} color="#19052c" wireColor={cr.col} wireOpacity={0.95} />
                <FramedCone position={[0, cr.h + 1.2, 0]} args={[cr.r * 0.7, 2.4, 6]} color={cr.col} wireColor="#ffffff" wireOpacity={0.9} />
              </group>
            ))}
          </>
        ) : (
          /* Colossal Multi-Tier Bioluminescent Mushroom Cathedral with Wireframe Gill Exoskeleton */
          <>
            <FramedCylinder position={[0, 5.2, 0]} args={[1.35, 2.4, 9.6, 10]} color="#2d0647" wireColor="#00f0ff" wireOpacity={0.9} />
            {/* Glowing Gill Ring Underside */}
            <mesh position={[0, 9.6, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[3.8, 0.22, 8, 24]} />
              <meshBasicMaterial color="#39ff14" wireframe />
            </mesh>
            {/* Primary Spotted Mushroom Dome + Wireframe Lattice */}
            <mesh position={[0, 9.8, 0]} scale={[1.35, 0.75, 1.35]}>
              <sphereGeometry args={[4.6, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.58]} />
              <meshLambertMaterial color={capColor} />
            </mesh>
            <mesh position={[0, 9.85, 0]} scale={[1.38, 0.78, 1.38]}>
              <sphereGeometry args={[4.6, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.58]} />
              <meshBasicMaterial color="#ffe600" wireframe />
            </mesh>
            {/* Secondary Upper Canopy Tier on Terminal & Mindmap */}
            {(role === 'mindmap' || role === 'terminal') && (
              <FramedCone position={[0, 13.5, 0]} args={[3.4, 2.8, 10]} color="#00f0ff" wireColor="#ff007f" wireOpacity={0.95} />
            )}
          </>
        )}
        {/* Levitating Star-Tetrahedron Merkaba & Gyroscope Rings */}
        <group ref={ringRef} position={[0, 16.5, 0]}>
          <mesh>
            <tetrahedronGeometry args={[2.1, 0]} />
            <meshBasicMaterial color="#39ff14" wireframe />
          </mesh>
          <mesh rotation={[Math.PI, 0, 0]}>
            <tetrahedronGeometry args={[2.1, 0]} />
            <meshBasicMaterial color="#00f0ff" wireframe />
          </mesh>
          <mesh>
            <torusGeometry args={[2.6, 0.1, 8, 28]} />
            <meshBasicMaterial color="#ff007f" />
          </mesh>
        </group>
        <SpriteText position={[0, 20.2, 0]} fontSize={near ? 0.78 : 0.48} color="#39ff14" outlineWidth={0.045} outlineColor="#120224">
          {label.toUpperCase()}
        </SpriteText>
      </CurvedNode>
    );
  }

  // ── 5. INDUSTRIAL (Heavy Brutalist Foundry — Reactors, Silos, Smokestacks & Steel Trusses) ──
  if (look === 'industrial') {
    return (
      <CurvedNode position={position} playerPos={playerPos} near={near}>
        {/* OSHA Hazard Plinth & Steel Truss Base */}
        <FramedBox position={[0, 0.6, 0]} args={[9.0, 1.2, 9.0]} color="#d97706" wireColor="#1d2128" wireOpacity={0.85} />
        {role === 'post' ? (
          /* Triple Riveted Steel Silo Battery & Catwalk Bridge + Rotating Radar */
          <>
            {[-2.4, 0, 2.4].map((sx, i) => (
              <FramedCylinder
                key={sx}
                position={[sx, 6.2, 0]}
                args={[1.35, 1.45, 11.2, 10]}
                color={i === 1 ? '#2b303a' : '#1d2128'}
                wireColor="#d97706"
                wireOpacity={0.8}
              />
            ))}
            <FramedBox position={[0, 11.8, 0]} args={[8.2, 0.9, 2.2]} color="#3b2618" wireColor="#ff9e00" wireOpacity={0.9} />
            <group ref={spinRef} position={[0, 14.2, 0]}>
              <mesh>
                <torusGeometry args={[1.9, 0.14, 8, 20]} />
                <meshBasicMaterial color="#ff9e00" wireframe />
              </mesh>
              <mesh>
                <boxGeometry args={[3.6, 0.4, 0.2]} />
                <meshBasicMaterial color="#ff6b00" />
              </mesh>
            </group>
          </>
        ) : (
          /* Heavy Foundry Reactor Hall + External Steel Truss Cage + Twin Smokestacks + Spinning Turbine */
          <>
            <FramedBox position={[0, 5.2, 0]} args={[7.6, 9.2, 7.6]} color="#1d2128" wireColor="#d97706" wireOpacity={0.78} />
            {/* External Steel Buttress Girders */}
            {[-4.0, 4.0].map((gx) => (
              <FramedBox key={gx} position={[gx, 5.2, 0]} args={[0.7, 9.4, 8.2]} color="#2b303a" wireColor="#ff6b00" wireOpacity={0.8} />
            ))}
            {/* Twin Towering Foundry Smokestacks with Molten Rims */}
            {[-2.2, 2.2].map((sx, idx) => (
              <React.Fragment key={sx}>
                <FramedCylinder position={[sx, 12.5 + idx * 1.0, -1.6]} args={[0.85, 1.15, 9.5 + idx * 2.0, 8]} color="#3b2618" wireColor="#d97706" wireOpacity={0.8} />
                <mesh position={[sx, 17.3 + idx * 2.0, -1.6]} rotation={[Math.PI / 2, 0, 0]}>
                  <torusGeometry args={[0.88, 0.14, 6, 16]} />
                  <meshBasicMaterial color="#ff6b00" />
                </mesh>
              </React.Fragment>
            ))}
            {/* Glowing Molten Blast Furnace Core Window */}
            <mesh position={[0, 3.8, 3.86]}>
              <planeGeometry args={[4.4, 2.8]} />
              <meshBasicMaterial color="#ff6b00" />
            </mesh>
            {/* Spinning Steel Exhaust Turbine on Facade */}
            <group ref={spinRef} position={[0, 7.6, 4.0]}>
              <mesh rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[1.9, 1.9, 0.3, 12]} />
                <meshBasicMaterial color="#d97706" wireframe />
              </mesh>
              {[0, 1, 2].map((i) => (
                <mesh key={i} rotation={[0, 0, (i * Math.PI) / 3]}>
                  <boxGeometry args={[0.42, 3.6, 0.15]} />
                  <meshBasicMaterial color="#ff9e00" />
                </mesh>
              ))}
            </group>
          </>
        )}
        <SpriteText position={[0, 20.5, 0]} fontSize={near ? 0.78 : 0.48} color="#ffae42" outlineWidth={0.045} outlineColor="#0a0c10">
          {label.toUpperCase()}
        </SpriteText>
      </CurvedNode>
    );
  }

  // ── 6. PAPERCRAFT (Folded Origami Castles, Kirigami Shadowboxes, Pinwheels & Paper Cranes) ──
  if (look === 'papercraft') {
    return (
      <CurvedNode position={position} playerPos={playerPos} near={near}>
        {/* Accordion-Folded Cardstock Base */}
        <FramedCylinder position={[0, 0.5, 0]} rotation={[0, Math.PI / 4, 0]} args={[5.2, 5.8, 1.0, 4]} color="#e6ccb2" wireColor="#8a5a44" wireOpacity={0.7} flat />
        <FramedCylinder position={[0, 3.6, 0]} rotation={[0, Math.PI / 4, 0]} args={[3.8, 4.5, 5.8, 4]} color="#f6ead4" wireColor="#8a5a44" wireOpacity={0.65} flat />
        {/* 3 Stacked Rotated Origami Pyramid Roofs with Crease Wireframes */}
        {[0, 1, 2].map((tier) => (
          <FramedCone
            key={tier}
            position={[0, 7.0 + tier * 2.5, 0]}
            rotation={[0, (tier * Math.PI) / 4, 0]}
            args={[4.8 - tier * 0.85, 2.9, 4]}
            color={tier === 0 ? '#e07a5f' : tier === 1 ? '#81b29a' : '#f2cc8f'}
            wireColor="#8a5a44"
            wireOpacity={0.75}
            flat
          />
        ))}
        {/* Cut-Paper Vellum Window */}
        <mesh position={[0, 3.4, 3.25]}>
          <planeGeometry args={[2.2, 2.2]} />
          <meshBasicMaterial color="#fff3b0" />
        </mesh>
        {/* Spinning Origami Pinwheel (Post) or Orbiting Giant Origami Crane */}
        <group ref={spinRef} position={[0, 14.5, 0]}>
          <mesh scale={[1.6, 0.35, 2.1]}>
            <octahedronGeometry args={[1.4, 0]} />
            <meshLambertMaterial color="#fdf8ee" flatShading />
          </mesh>
          <mesh scale={[1.65, 0.38, 2.15]}>
            <octahedronGeometry args={[1.4, 0]} />
            <meshBasicMaterial color="#e07a5f" wireframe />
          </mesh>
        </group>
        <SpriteText position={[0, 17.5, 0]} fontSize={near ? 0.78 : 0.48} color="#fdf8ee" outlineWidth={0.045} outlineColor="#3d281d">
          {label.toUpperCase()}
        </SpriteText>
      </CurvedNode>
    );
  }

  // ── 7. CATHEDRAL (Twin-Spire Gothic Sanctuary, Flying Buttresses & Glowing Rose Windows) ──
  if (look === 'cathedral') {
    return (
      <CurvedNode position={position} playerPos={playerPos} near={near}>
        <FramedBox position={[0, 0.5, 0]} args={[9.0, 1.0, 8.6]} color="#160c28" wireColor="#ffb703" wireOpacity={0.85} />
        {/* Central Gothic Nave */}
        <FramedBox position={[0, 6.2, 0]} args={[6.2, 11.4, 6.8]} color="#160c28" wireColor="#ffb703" wireOpacity={0.85} />
        {/* Twin Flanking Gothic Belfry Towers & Needle Spires */}
        {[-3.8, 3.8].map((tx) => (
          <React.Fragment key={tx}>
            <FramedBox position={[tx, 7.2, 0.4]} args={[2.2, 13.4, 2.4]} color="#23133d" wireColor="#ffb703" wireOpacity={0.9} />
            <FramedCone position={[tx, 16.5, 0.4]} rotation={[0, Math.PI / 4, 0]} args={[1.7, 5.4, 4]} color="#ffb703" wireColor="#ff006e" wireOpacity={0.92} />
          </React.Fragment>
        ))}
        {/* Central Steep Gable Roof & Flèche Spire */}
        <FramedCone position={[0, 14.5, 0]} rotation={[0, Math.PI / 4, 0]} args={[4.6, 5.2, 4]} color="#3a1c5e" wireColor="#ffb703" wireOpacity={0.92} />
        {/* Multi-Ring Stained-Glass Rose Window */}
        <mesh position={[0, 7.6, 3.48]}>
          <circleGeometry args={[2.1, 20]} />
          <meshBasicMaterial color="#ff006e" />
        </mesh>
        <mesh position={[0, 7.6, 3.52]}>
          <ringGeometry args={[1.35, 2.15, 20]} />
          <meshBasicMaterial color="#ffb703" />
        </mesh>
        <mesh position={[0, 7.6, 3.55]}>
          <ringGeometry args={[0.55, 0.95, 16]} />
          <meshBasicMaterial color="#3a86ff" />
        </mesh>
        {/* 3 Pointed Lancet Windows Below */}
        {[-1.6, 0, 1.6].map((wx, i) => (
          <mesh key={wx} position={[wx, 3.2, 3.48]}>
            <planeGeometry args={[0.95, 2.8]} />
            <meshBasicMaterial color={i === 1 ? '#ffb703' : '#3a86ff'} />
          </mesh>
        ))}
        <SpriteText position={[0, 21.0, 0]} fontSize={near ? 0.78 : 0.48} color="#ffb703" outlineWidth={0.045} outlineColor="#0b0416">
          {label.toUpperCase()}
        </SpriteText>
      </CurvedNode>
    );
  }

  // ── 8. BLUEPRINT (Geodesic Cyanotype Domes, Brass Armillary Spheres & Technical Elevations) ──
  if (look === 'blueprint') {
    return (
      <CurvedNode position={position} playerPos={playerPos} near={near}>
        {/* Stepped Technical Drafting Plinth with Compass Ring */}
        <FramedCylinder position={[0, 0.5, 0]} args={[5.4, 5.8, 1.0, 12]} color="#082c54" wireColor="#e0f4ff" wireOpacity={0.95} />
        <mesh position={[0, 0.12, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[6.2, 6.45, 32]} />
          <meshBasicMaterial color="#ffd166" side={THREE.DoubleSide} />
        </mesh>
        {/* Colonnade Base + Triangulated Geodesic Dome */}
        <FramedCylinder position={[0, 3.6, 0]} args={[4.4, 4.6, 5.2, 12]} color="#0b3b6e" wireColor="#e0f4ff" wireOpacity={0.92} />
        <mesh position={[0, 7.6, 0]}>
          <icosahedronGeometry args={[4.8, 1]} />
          <meshLambertMaterial color="#082c54" transparent opacity={0.85} />
        </mesh>
        <mesh position={[0, 7.6, 0]} scale={1.02}>
          <icosahedronGeometry args={[4.8, 1]} />
          <meshBasicMaterial color="#e0f4ff" wireframe />
        </mesh>
        {/* 3-Axis Rotating Brass Armillary Sphere Crown */}
        <group ref={ringRef} position={[0, 14.5, 0]}>
          <mesh>
            <torusGeometry args={[2.5, 0.11, 8, 32]} />
            <meshBasicMaterial color="#ffd166" />
          </mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[2.1, 0.1, 8, 32]} />
            <meshBasicMaterial color="#e0f4ff" />
          </mesh>
          <mesh rotation={[0, Math.PI / 4, Math.PI / 4]}>
            <octahedronGeometry args={[1.2, 0]} />
            <meshBasicMaterial color="#ffd166" wireframe />
          </mesh>
        </group>
        <SpriteText position={[0, 18.8, 0]} fontSize={near ? 0.78 : 0.48} color="#e0f4ff" outlineWidth={0.045} outlineColor="#04152b">
          {label.toUpperCase()}
        </SpriteText>
      </CurvedNode>
    );
  }

  // ── 9. BIOLUME (Abyssal Medusa Jellyfish Bells, Nautilus Spirals & Coral Chimneys) ──
  if (look === 'biolume') {
    return (
      <CurvedNode position={position} playerPos={playerPos} near={near}>
        {/* Abyssal Reef Basal Ring */}
        <FramedCylinder position={[0, 0.5, 0]} args={[4.8, 5.5, 1.0, 10]} color="#041f36" wireColor="#00f5d4" wireOpacity={0.9} />
        {/* Bioluminescent Stalks / Tentacle Columns */}
        {[-2.2, 0, 2.2].map((tx, i) => (
          <FramedCylinder
            key={tx}
            position={[tx, 4.5, i === 1 ? 0 : 1.2]}
            args={[0.55, 0.85, 8.0, 8]}
            color="#073454"
            wireColor={i === 1 ? '#00f5d4' : '#f15bb5'}
            wireOpacity={0.92}
          />
        ))}
        {/* Pulsing Medusa Jellyfish Bell Canopy + Bioluminescent Nerve-Net Wireframe */}
        <mesh position={[0, 9.6, 0]} scale={[1.3, 0.85, 1.3]}>
          <sphereGeometry args={[4.4, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.62]} />
          <meshLambertMaterial color="#0a4870" />
        </mesh>
        <mesh position={[0, 9.65, 0]} scale={[1.33, 0.88, 1.33]}>
          <sphereGeometry args={[4.4, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.62]} />
          <meshBasicMaterial color="#00f5d4" wireframe />
        </mesh>
        {/* Rotating Torus-Knot Nautilus Crown */}
        <group ref={spinRef} position={[0, 14.8, 0]}>
          <mesh>
            <torusKnotGeometry args={[1.55, 0.32, 48, 8]} />
            <meshBasicMaterial color="#f15bb5" wireframe />
          </mesh>
          <mesh>
            <sphereGeometry args={[0.85, 12, 12]} />
            <meshBasicMaterial color="#7bf1a8" />
          </mesh>
        </group>
        <SpriteText position={[0, 18.8, 0]} fontSize={near ? 0.78 : 0.48} color="#00f5d4" outlineWidth={0.045} outlineColor="#02101c">
          {label.toUpperCase()}
        </SpriteText>
      </CurvedNode>
    );
  }

  // ── 10. KINTSUGI (Shattered Black Raku Ceramic Mended with Molten 24k Gold Seams & Floating Shards) ──
  if (look === 'kintsugi') {
    return (
      <CurvedNode position={position} playerPos={playerPos} near={near}>
        <FramedBox position={[0, 0.45, 0]} args={[8.4, 0.9, 8.4]} color="#141218" wireColor="#ffd166" wireOpacity={0.9} />
        {/* Lower Tilted Obsidian Tier */}
        <FramedBox position={[-0.35, 3.4, 0]} rotation={[0, 0, 0.05]} args={[6.2, 5.2, 6.2]} color="#141218" wireColor="#ffd166" wireOpacity={0.88} />
        {/* Blazing Molten 24k Gold Fracture Seam */}
        <mesh position={[0, 6.2, 0]} rotation={[0.08, 0.35, -0.07]}>
          <boxGeometry args={[6.8, 0.65, 6.8]} />
          <meshBasicMaterial color="#ffd166" />
        </mesh>
        {/* Middle Offset Obsidian Tier */}
        <FramedBox position={[0.4, 9.0, 0]} rotation={[0, 0.18, -0.06]} args={[4.8, 4.8, 4.8]} color="#1f1c24" wireColor="#ffd166" wireOpacity={0.92} />
        {/* Second Golden Seam & Upper Crown Shard */}
        <mesh position={[0.1, 11.6, 0]} rotation={[-0.08, -0.25, 0.08]}>
          <boxGeometry args={[5.2, 0.55, 5.2]} />
          <meshBasicMaterial color="#ffb703" />
        </mesh>
        <FramedCone position={[0, 13.8, 0]} rotation={[0, Math.PI / 4, 0]} args={[3.6, 3.6, 4]} color="#141218" wireColor="#ffd166" wireOpacity={0.95} />
        {/* Rotating Triple-Ring 24k Gold Halo */}
        <group ref={ringRef} position={[0, 17.2, 0]}>
          <mesh>
            <torusGeometry args={[2.1, 0.14, 10, 28]} />
            <meshBasicMaterial color="#ffd166" />
          </mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[1.6, 0.1, 10, 28]} />
            <meshBasicMaterial color="#ffe599" />
          </mesh>
          <mesh>
            <octahedronGeometry args={[0.9, 0]} />
            <meshBasicMaterial color="#ffd166" />
          </mesh>
        </group>
        <SpriteText position={[0, 20.4, 0]} fontSize={near ? 0.78 : 0.48} color="#ffd166" outlineWidth={0.045} outlineColor="#09080c">
          {label.toUpperCase()}
        </SpriteText>
      </CurvedNode>
    );
  }

  // ── 11. SOLARPUNK (White Marble & Terracotta Terraces, Brass-Ribbed Crystal Biodomes & Wind Turbines) ──
  if (look === 'solarpunk') {
    return (
      <CurvedNode position={position} playerPos={playerPos} near={near}>
        {/* Stepped Sunlit Limestone & Terracotta Ziggurat Plinth */}
        <FramedCylinder position={[0, 0.6, 0]} args={[5.8, 6.2, 1.2, 12]} color="#f4f1de" wireColor="#d4a373" wireOpacity={0.75} />
        <FramedCylinder position={[0, 2.2, 0]} args={[4.8, 5.2, 2.0, 12]} color="#e9edc9" wireColor="#d4a373" wireOpacity={0.75} />
        {/* Lush Hanging-Garden Foliage Clusters on the Terrace Rim */}
        {[0, 1, 2, 3, 4, 5].map((i) => {
          const ang = (i * Math.PI) / 3;
          return (
            <mesh key={i} position={[Math.cos(ang) * 4.8, 3.4, Math.sin(ang) * 4.8]}>
              <icosahedronGeometry args={[1.05, 1]} />
              <meshLambertMaterial color="#52b788" />
            </mesh>
          );
        })}
        {/* Brass-Ribbed Emerald Crystal Conservatory Biodome */}
        <mesh position={[0, 5.2, 0]}>
          <sphereGeometry args={[4.6, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.62]} />
          <meshLambertMaterial color="#52b788" transparent opacity={0.82} />
        </mesh>
        <mesh position={[0, 5.25, 0]} scale={1.02}>
          <sphereGeometry args={[4.6, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.62]} />
          <meshBasicMaterial color="#ffd166" wireframe />
        </mesh>
        {/* Brass Heliostat Spire & Spinning 6-Blade Solar Wind-Catcher */}
        <FramedCylinder position={[0, 11.2, 0]} args={[0.25, 0.45, 4.2, 8]} color="#d4a373" wireColor="#ffd166" wireOpacity={0.9} />
        <group ref={spinRef} position={[0, 13.8, 0]}>
          <mesh>
            <torusGeometry args={[2.4, 0.1, 8, 24]} />
            <meshBasicMaterial color="#d4a373" />
          </mesh>
          {[0, 1, 2].map((i) => (
            <mesh key={i} rotation={[0, 0, (i * Math.PI) / 3]}>
              <boxGeometry args={[0.48, 4.8, 0.12]} />
              <meshBasicMaterial color="#ffd166" />
            </mesh>
          ))}
        </group>
        <SpriteText position={[0, 17.8, 0]} fontSize={near ? 0.78 : 0.48} color="#ffffff" outlineWidth={0.045} outlineColor="#163020">
          {label.toUpperCase()}
        </SpriteText>
      </CurvedNode>
    );
  }

  // ── 12. NOIR (1940s Gotham Art-Deco Setback Skyscrapers, Clocktower Dials & Crimson Neon Signs) ──
  if (look === 'noir') {
    return (
      <CurvedNode position={position} playerPos={playerPos} near={near}>
        <FramedBox position={[0, 0.5, 0]} args={[8.6, 1.0, 8.6]} color="#0c0c10" wireColor="#cbd5e1" wireOpacity={0.75} />
        {/* Tier 1 Art-Deco Basalt Tower with Silver Fluted Wireframe Trim */}
        <FramedBox position={[0, 5.5, 0]} args={[6.8, 9.6, 6.8]} color="#0c0c10" wireColor="#cbd5e1" wireOpacity={0.75} />
        {/* Tier 2 Setback Tower */}
        <FramedBox position={[0, 12.4, 0]} args={[4.8, 4.8, 4.8]} color="#16161d" wireColor="#cbd5e1" wireOpacity={0.82} />
        {/* Tier 3 Art-Deco Crown Spire */}
        <FramedCone position={[0, 16.6, 0]} rotation={[0, Math.PI / 4, 0]} args={[3.2, 4.2, 4]} color="#20202a" wireColor="#e6193c" wireOpacity={0.92} />
        {/* Horizontal Venetian-Blind Slit Windows */}
        {[2.8, 5.0, 7.2, 9.4].map((wy) => (
          <mesh key={wy} position={[0, wy, 3.46]}>
            <planeGeometry args={[4.6, 0.42]} />
            <meshBasicMaterial color="#f8fafc" />
          </mesh>
        ))}
        {/* Illuminated Clocktower Dial on Upper Setback */}
        <mesh position={[0, 12.4, 2.46]}>
          <circleGeometry args={[1.35, 20]} />
          <meshBasicMaterial color="#f8fafc" />
        </mesh>
        <mesh position={[0, 12.4, 2.49]}>
          <ringGeometry args={[1.15, 1.4, 20]} />
          <meshBasicMaterial color="#e6193c" />
        </mesh>
        {/* Blazing Vertical Crimson Neon Marquee Sign on Side */}
        <FramedBox position={[3.65, 7.5, 2.0]} args={[0.45, 8.8, 1.4]} color="#e6193c" wireColor="#ffffff" wireOpacity={0.9} />
        <SpriteText position={[0, 20.5, 0]} fontSize={near ? 0.78 : 0.48} color="#ff2a4b" outlineWidth={0.045} outlineColor="#050508">
          {label.toUpperCase()}
        </SpriteText>
      </CurvedNode>
    );
  }

  // ── 13. MINIMAL (4 Distinct Museum-Grade Alabaster Sculptures in R=2000 Void) ──
  if (look === 'minimal') {
    return (
      <CurvedNode position={position} playerPos={playerPos} near={near}>
        <FramedBox position={[0, 0.3, 0]} args={[6.8, 0.6, 6.8]} color="#ffffff" wireColor="#222228" wireOpacity={0.35} />
        {role === 'mindmap' && (
          <>
            <FramedBox position={[-2.6, 6.0, 0]} args={[0.9, 11.4, 2.4]} color="#ffffff" wireColor="#111115" wireOpacity={0.35} />
            <FramedBox position={[2.6, 6.0, 0]} args={[0.9, 11.4, 2.4]} color="#ffffff" wireColor="#111115" wireOpacity={0.35} />
            <FramedBox position={[0, 11.8, 0]} args={[6.2, 0.9, 2.6]} color="#ffffff" wireColor="#111115" wireOpacity={0.35} />
            <group ref={spinRef} position={[0, 6.2, 0]}>
              <mesh>
                <sphereGeometry args={[1.65, 20, 16]} />
                <meshBasicMaterial color="#ffffff" />
              </mesh>
              <mesh rotation={[Math.PI / 3, 0, 0]}>
                <torusGeometry args={[2.35, 0.06, 8, 32]} />
                <meshBasicMaterial color="#ffffff" />
              </mesh>
            </group>
          </>
        )}
        {role === 'vault' && (
          <>
            <FramedBox position={[-1.45, 5.8, 0]} args={[2.5, 11.0, 5.4]} color="#ffffff" wireColor="#111115" wireOpacity={0.35} />
            <FramedBox position={[1.45, 5.8, 0]} args={[2.5, 11.0, 5.4]} color="#ffffff" wireColor="#111115" wireOpacity={0.35} />
            <FramedBox position={[0, 9.2, 0]} args={[6.4, 1.4, 3.2]} color="#ffffff" wireColor="#111115" wireOpacity={0.35} />
          </>
        )}
        {role === 'post' && (
          <>
            <FramedBox position={[-1.9, 7.2, 0]} args={[1.1, 13.8, 1.1]} color="#ffffff" wireColor="#111115" wireOpacity={0.35} />
            <FramedBox position={[1.9, 7.2, 0]} args={[1.1, 13.8, 1.1]} color="#ffffff" wireColor="#111115" wireOpacity={0.35} />
            <group ref={spinRef} position={[0, 8.5, 0]}>
              <mesh>
                <octahedronGeometry args={[1.35, 0]} />
                <meshBasicMaterial color="#ffffff" />
              </mesh>
            </group>
          </>
        )}
        {role === 'terminal' && (
          <>
            {[0, 1, 2].map((i) => (
              <mesh key={i} position={[0, 5.5 + i * 1.2, -i * 1.6]}>
                <boxGeometry args={[6.0 - i * 1.1, 10.5 + i * 2.0, 0.8]} />
                <meshBasicMaterial color="#ffffff" wireframe={i === 1} />
              </mesh>
            ))}
          </>
        )}
        <SpriteText position={[0, 16.2, 0]} fontSize={near ? 0.78 : 0.48} color="#ffffff" outlineWidth={0.04} outlineColor="#000000">
          {label.toUpperCase()}
        </SpriteText>
      </CurvedNode>
    );
  }

  // ── 14 & 15. CRT (Vector Phosphor Mainframe) & UKIYO-E (Multi-Tiered Edo Woodblock Pagodas) ──
  const signY = role === 'terminal' ? 20.5 : role === 'mindmap' ? 19.5 : 17.5;
  return (
    <CurvedNode position={position} playerPos={playerPos} near={near}>
      <FramedBox position={[0, 0.45, 0]} args={[8.8, 0.9, 8.8]} color={t.core} wireColor={t.wire} wireOpacity={t.wireOpacity} flat={t.flat} />
      <FramedBox position={[0, 1.05, 0]} args={[7.8, 0.4, 7.8]} color={t.secondary} wireColor={t.wire} wireOpacity={t.wireOpacity} flat={t.flat} />

      {role === 'mindmap' && (
        <>
          <FramedCylinder position={[0, 4.0, 0]} args={[4.2, 4.5, 5.6, 8]} color={t.core} wireColor={t.wire} wireOpacity={t.wireOpacity} flat={t.flat} />
          <FramedCylinder position={[0, 7.0, 0]} args={[5.6, 4.2, 0.7, 8]} color={t.roof} wireColor={t.wire} wireOpacity={0.9} flat={t.flat} />
          <FramedCylinder position={[0, 10.0, 0]} args={[3.1, 3.4, 5.2, 8]} color={t.secondary} wireColor={t.wire} wireOpacity={t.wireOpacity} flat={t.flat} />
          <FramedCylinder position={[0, 12.8, 0]} args={[4.5, 3.1, 0.65, 8]} color={t.roof} wireColor={t.wire} wireOpacity={0.9} flat={t.flat} />
          <FramedCone position={[0, 15.0, 0]} args={[3.2, 3.8, 8]} color={t.accent} wireColor={t.wire} wireOpacity={0.92} flat={t.flat} />
          {[0, Math.PI / 2, Math.PI, -Math.PI / 2].map((ang, i) => (
            <mesh key={i} position={[Math.sin(ang) * 4.38, 3.8, Math.cos(ang) * 4.38]} rotation={[0, ang, 0]}>
              <planeGeometry args={[2.2, 2.6]} />
              <meshBasicMaterial color={t.window} side={THREE.DoubleSide} />
            </mesh>
          ))}
          <group ref={ringRef} position={[0, 17.6, 0]}>
            <mesh>
              <octahedronGeometry args={[0.95, 0]} />
              <meshBasicMaterial color={t.window} />
            </mesh>
            <mesh scale={1.25}>
              <octahedronGeometry args={[0.95, 0]} />
              <meshBasicMaterial color={t.wire} wireframe />
            </mesh>
            <mesh>
              <torusGeometry args={[2.1, 0.09, 8, 28]} />
              <meshBasicMaterial color={t.wire} />
            </mesh>
          </group>
        </>
      )}

      {role === 'vault' && (
        <>
          <FramedBox position={[0, 3.8, 0]} args={[6.8, 5.4, 6.8]} color={t.core} wireColor={t.wire} wireOpacity={t.wireOpacity} flat={t.flat} />
          {[-3.8, 3.8].map((bx) => (
            <FramedBox key={bx} position={[bx, 4.2, 0]} args={[0.95, 6.8, 5.2]} color={t.secondary} wireColor={t.wire} wireOpacity={0.85} flat={t.flat} />
          ))}
          <FramedBox position={[0, 6.8, 0]} args={[9.2, 0.55, 8.8]} color={t.roof} wireColor={t.wire} wireOpacity={0.9} flat={t.flat} />
          <FramedCone position={[0, 9.2, 0]} rotation={[0, Math.PI / 4, 0]} args={[5.6, 4.2, 4]} color={t.roof} wireColor={t.wire} wireOpacity={0.9} flat={t.flat} />
          <mesh position={[0, 3.8, 3.48]}>
            <circleGeometry args={[1.75, 24]} />
            <meshBasicMaterial color={t.window} />
          </mesh>
          <mesh position={[0, 3.8, 3.52]}>
            <ringGeometry args={[1.55, 1.85, 24]} />
            <meshBasicMaterial color={t.wire} />
          </mesh>
          <group ref={spinRef} position={[0, 13.0, 0]}>
            <mesh>
              <icosahedronGeometry args={[1.2, 0]} />
              <meshBasicMaterial color={t.accent} wireframe />
            </mesh>
          </group>
        </>
      )}

      {role === 'post' && (
        <>
          <FramedBox position={[0, 3.4, 0]} args={[7.2, 4.6, 6.2]} color={t.core} wireColor={t.wire} wireOpacity={t.wireOpacity} flat={t.flat} />
          <FramedBox position={[0, 5.9, 0]} args={[9.0, 0.45, 8.0]} color={t.roof} wireColor={t.wire} wireOpacity={0.88} flat={t.flat} />
          <FramedBox position={[0, 9.4, -0.6]} args={[3.6, 6.8, 3.6]} color={t.secondary} wireColor={t.wire} wireOpacity={0.9} flat={t.flat} />
          {[-1.8, 1.8].map((wx) => (
            <mesh key={wx} position={[wx, 3.2, 3.16]}>
              <planeGeometry args={[1.8, 2.2]} />
              <meshBasicMaterial color={t.window} />
            </mesh>
          ))}
          <group ref={spinRef} position={[0, 14.2, -0.6]}>
            <mesh>
              <torusGeometry args={[1.85, 0.1, 8, 24]} />
              <meshBasicMaterial color={t.wire} />
            </mesh>
          </group>
        </>
      )}

      {role === 'terminal' && (
        <>
          <FramedBox position={[0, 4.0, 0]} args={[7.8, 5.8, 7.4]} color={t.core} wireColor={t.wire} wireOpacity={t.wireOpacity} flat={t.flat} />
          {[-4.2, 4.2].map((tx) => (
            <React.Fragment key={tx}>
              <FramedBox position={[tx, 6.8, 0.4]} args={[2.2, 11.4, 2.2]} color={t.secondary} wireColor={t.wire} wireOpacity={0.9} flat={t.flat} />
              <FramedCone position={[tx, 14.2, 0.4]} rotation={[0, Math.PI / 4, 0]} args={[1.8, 3.4, 4]} color={t.roof} wireColor={t.wire} wireOpacity={0.92} flat={t.flat} />
            </React.Fragment>
          ))}
          <FramedBox position={[0, 7.1, 0]} args={[10.6, 0.5, 9.6]} color={t.roof} wireColor={t.wire} wireOpacity={0.9} flat={t.flat} />
          <FramedBox position={[0, 10.2, 0]} args={[5.4, 5.4, 5.4]} color={t.secondary} wireColor={t.wire} wireOpacity={0.88} flat={t.flat} />
          <FramedBox position={[0, 13.1, 0]} args={[8.0, 0.45, 8.0]} color={t.roof} wireColor={t.wire} wireOpacity={0.9} flat={t.flat} />
          <FramedCone position={[0, 15.2, 0]} rotation={[0, Math.PI / 4, 0]} args={[4.8, 3.8, 4]} color={t.accent} wireColor={t.wire} wireOpacity={0.92} flat={t.flat} />
          <group ref={spinRef} position={[0, 18.2, 0]}>
            <mesh>
              <octahedronGeometry args={[0.95, 0]} />
              <meshBasicMaterial color={t.window} />
            </mesh>
            <mesh scale={1.3}>
              <octahedronGeometry args={[0.95, 0]} />
              <meshBasicMaterial color={t.wire} wireframe />
            </mesh>
          </group>
        </>
      )}

      <SpriteText
        position={[0, signY, 0]}
        fontSize={near ? 0.78 : 0.48}
        color={near ? '#ffffff' : t.sign}
        outlineWidth={0.045}
        outlineColor="#05020a"
      >
        {label.toUpperCase()}
      </SpriteText>
    </CurvedNode>
  );
}

/* ──────────────────────  FLANKING WING STRUCTURES (EAST & WEST COURTS)  ────────────────────── */

function MindscapeWingPavilion({
  look,
  position,
  idx,
  playerPos,
}: {
  look: Exclude<WorldLookId, 'wireframe'>;
  position: [number, number, number];
  idx: number;
  playerPos: React.MutableRefObject<THREE.Vector3>;
}) {
  const t = LOOK_THEMES[look];
  return (
    <CurvedNode position={position} playerPos={playerPos}>
      <FramedBox position={[0, 0.35, 0]} args={[6.2, 0.7, 6.2]} color={t.core} wireColor={t.wire} wireOpacity={t.wireOpacity} flat={t.flat} />
      <FramedBox
        position={[0, 2.6, 0]}
        args={[5.2, 4.2, 5.2]}
        color={idx % 2 === 0 ? t.core : t.secondary}
        wireColor={t.wire}
        wireOpacity={t.wireOpacity}
        flat={t.flat}
        inkOutline={t.inkOutline}
      />
      <FramedBox position={[0, 4.9, 0]} args={[6.8, 0.38, 6.8]} color={t.roof} wireColor={t.wire} wireOpacity={0.85} flat={t.flat} />
      <FramedCone
        position={[0, 6.3, 0]}
        rotation={[0, Math.PI / 4, 0]}
        args={[4.2, 2.4, 4]}
        color={idx % 2 === 0 ? t.roof : t.accent}
        wireColor={t.wire}
        wireOpacity={0.9}
        flat={t.flat}
        inkOutline={t.inkOutline}
      />
      <mesh position={[0, 2.6, 2.65]}>
        <planeGeometry args={[2.2, 1.8]} />
        <meshBasicMaterial color={t.window} side={THREE.DoubleSide} />
      </mesh>
    </CurvedNode>
  );
}

/* ──────────────────────  16 AVENUE STREET LAMPS & 8 PLAZA LANTERNS  ────────────────────── */

function MindscapeStreetLamp({
  look,
  position,
  playerPos,
}: {
  look: Exclude<WorldLookId, 'wireframe'>;
  position: [number, number, number];
  playerPos: React.MutableRefObject<THREE.Vector3>;
}) {
  const t = LOOK_THEMES[look];
  return (
    <CurvedNode position={position} playerPos={playerPos}>
      <FramedBox position={[0, 0.25, 0]} args={[0.75, 0.5, 0.75]} color={t.core} wireColor={t.wire} wireOpacity={0.8} />
      <FramedCylinder position={[0, 3.2, 0]} args={[0.12, 0.18, 5.8, 4]} color={t.secondary} wireColor={t.wire} wireOpacity={0.8} />
      <FramedBox position={[0.45, 6.0, 0]} rotation={[0, 0, -0.25]} args={[1.25, 0.14, 0.14]} color={t.roof} wireColor={t.wire} wireOpacity={0.85} />
      <mesh position={[0.95, 5.65, 0]}>
        <octahedronGeometry args={[0.32, 0]} />
        <meshBasicMaterial color={t.window} />
      </mesh>
      <mesh position={[0.95, 5.65, 0]} scale={1.35}>
        <octahedronGeometry args={[0.32, 0]} />
        <meshBasicMaterial color={t.wire} wireframe />
      </mesh>
    </CurvedNode>
  );
}

function MindscapePlazaLantern({
  look,
  position,
  playerPos,
}: {
  look: Exclude<WorldLookId, 'wireframe'>;
  position: [number, number, number];
  playerPos: React.MutableRefObject<THREE.Vector3>;
}) {
  const t = LOOK_THEMES[look];
  return (
    <CurvedNode position={position} playerPos={playerPos}>
      <FramedBox position={[0, 0.18, 0]} args={[0.8, 0.36, 0.8]} color={t.core} wireColor={t.wire} wireOpacity={0.8} />
      <FramedCylinder position={[0, 0.75, 0]} args={[0.18, 0.22, 0.85, 6]} color={t.secondary} wireColor={t.wire} wireOpacity={0.75} />
      <FramedCylinder position={[0, 1.25, 0]} args={[0.58, 0.36, 0.22, 6]} color={t.roof} wireColor={t.wire} wireOpacity={0.85} />
      <mesh position={[0, 1.6, 0]}>
        <boxGeometry args={[0.48, 0.48, 0.48]} />
        <meshBasicMaterial color={t.window} />
      </mesh>
      <mesh position={[0, 1.6, 0]} scale={1.08}>
        <boxGeometry args={[0.48, 0.48, 0.48]} />
        <meshBasicMaterial color={t.wire} wireframe />
      </mesh>
      <FramedCone position={[0, 2.0, 0]} args={[0.82, 0.42, 6]} color={t.roof} wireColor={t.wire} wireOpacity={0.9} />
      <mesh position={[0, 2.32, 0]}>
        <octahedronGeometry args={[0.15, 0]} />
        <meshBasicMaterial color={t.accent} />
      </mesh>
    </CurvedNode>
  );
}

/* ──────────────────────  4 MONUMENTAL CARDINAL THRESHOLD GATES  ────────────────────── */

function MindscapeGate({
  look,
  position,
  rotation,
  playerPos,
}: {
  look: Exclude<WorldLookId, 'wireframe'>;
  position: [number, number, number];
  rotation: number;
  playerPos: React.MutableRefObject<THREE.Vector3>;
}) {
  const t = LOOK_THEMES[look];
  return (
    <CurvedNode position={position} rotation={rotation} playerPos={playerPos}>
      {[-3.8, 3.8].map((px) => (
        <React.Fragment key={px}>
          <FramedBox position={[px, 0.45, 0]} args={[1.4, 0.9, 1.4]} color={t.secondary} wireColor={t.wire} wireOpacity={0.85} inkOutline={t.inkOutline} />
          <FramedBox position={[px, 5.8, 0]} args={[0.72, 10.8, 0.72]} color={t.core} wireColor={t.wire} wireOpacity={0.88} flat={t.flat} inkOutline={t.inkOutline} />
        </React.Fragment>
      ))}
      <FramedBox position={[0, 9.4, 0]} args={[8.8, 0.5, 0.55]} color={t.secondary} wireColor={t.wire} wireOpacity={0.9} flat={t.flat} inkOutline={t.inkOutline} />
      <FramedBox position={[0, 11.2, 0]} args={[10.4, 0.75, 0.85]} color={t.roof} wireColor={t.wire} wireOpacity={0.92} flat={t.flat} inkOutline={t.inkOutline} />
      <FramedBox position={[0, 10.3, 0]} args={[0.55, 1.4, 0.55]} color={t.accent} wireColor={t.wire} wireOpacity={0.9} />
      <mesh position={[0, 12.1, 0]}>
        <octahedronGeometry args={[0.55, 0]} />
        <meshBasicMaterial color={t.window} />
      </mesh>
      <mesh position={[0, 12.1, 0]} scale={1.28}>
        <octahedronGeometry args={[0.55, 0]} />
        <meshBasicMaterial color={t.wire} wireframe />
      </mesh>
      {[-2.6, 2.6].map((lx) => (
        <mesh key={lx} position={[lx, 8.6, 0]}>
          <octahedronGeometry args={[0.3, 0]} />
          <meshBasicMaterial color={t.window} />
        </mesh>
      ))}
    </CurvedNode>
  );
}

/* ──────────────────────  OVERWORLD BIOME CLUSTERS (48 MULTI-PART DIORAMAS)  ────────────────────── */

interface BiomeNode {
  x: number;
  z: number;
  scale: number;
  rot: number;
  variant: number;
}

function generateBiomeNodes(seedOffset: number): BiomeNode[] {
  const nodes: BiomeNode[] = [];
  const rings = [
    { count: 14, rMin: 24, rMax: 44 },
    { count: 18, rMin: 50, rMax: 84 },
    { count: 16, rMin: 90, rMax: 138 },
  ];
  let idx = 0;
  for (const ring of rings) {
    for (let i = 0; i < ring.count; i++) {
      const hash = Math.sin((idx + 1) * 127.1 + seedOffset * 311.7) * 43758.5453;
      const frac = hash - Math.floor(hash);
      const angle = (i / ring.count) * Math.PI * 2 + (frac - 0.5) * 0.28;
      const r = ring.rMin + frac * (ring.rMax - ring.rMin);
      const x = Math.cos(angle) * r;
      const z = Math.sin(angle) * r;
      if (Math.abs(x) < 7.5 || Math.abs(z) < 7.5) continue;
      if (Math.hypot(x - 0, z + 34) < 12) continue;
      if (Math.hypot(x + 36, z + 34) < 12) continue;
      if (Math.hypot(x - 36, z + 34) < 12) continue;
      if (Math.hypot(x - 0, z + 68) < 12) continue;
      if (Math.hypot(x + 36, z + 22) < 9 || Math.hypot(x + 36, z + 46) < 9) continue;
      if (Math.hypot(x - 36, z + 22) < 9 || Math.hypot(x - 36, z + 46) < 9) continue;
      nodes.push({
        x,
        z,
        scale: 0.88 + (idx % 4) * 0.2,
        rot: frac * Math.PI * 2,
        variant: idx % 3,
      });
      idx++;
    }
  }
  return nodes;
}

function MindscapeOverworldNode({
  look,
  node,
  playerPos,
}: {
  look: Exclude<WorldLookId, 'wireframe'>;
  node: BiomeNode;
  playerPos: React.MutableRefObject<THREE.Vector3>;
}) {
  const t = LOOK_THEMES[look];

  // 1. WESTERN: Monument Valley Mesas, Multi-Arm Saguaro Cacti & Frontier Water Towers
  if (look === 'western') {
    return (
      <CurvedNode position={[node.x, 0, node.z]} rotation={node.rot} playerPos={playerPos}>
        <group scale={node.scale}>
          {node.variant === 0 ? (
            <>
              <FramedCylinder position={[0, 3.2, 0]} args={[4.4, 6.5, 6.4, 7]} color="#8c4a27" wireColor="#d4a373" wireOpacity={0.38} flat />
              <FramedCylinder position={[0, 7.4, 0]} args={[2.8, 3.8, 3.6, 6]} color="#a35830" wireColor="#faedcd" wireOpacity={0.38} flat />
            </>
          ) : node.variant === 1 ? (
            <group>
              <mesh position={[0, 2.6, 0]}>
                <cylinderGeometry args={[0.32, 0.38, 5.2, 7]} />
                <meshLambertMaterial color="#4f5d2f" />
              </mesh>
              <mesh position={[-0.65, 2.8, 0]}>
                <boxGeometry args={[1.1, 0.35, 0.35]} />
                <meshLambertMaterial color="#4f5d2f" />
              </mesh>
              <mesh position={[-1.05, 3.6, 0]}>
                <cylinderGeometry args={[0.24, 0.24, 1.8, 6]} />
                <meshLambertMaterial color="#4f5d2f" />
              </mesh>
              <mesh position={[0.65, 2.1, 0]}>
                <boxGeometry args={[1.0, 0.32, 0.32]} />
                <meshLambertMaterial color="#4f5d2f" />
              </mesh>
              <mesh position={[1.0, 2.8, 0]}>
                <cylinderGeometry args={[0.22, 0.22, 1.5, 6]} />
                <meshLambertMaterial color="#4f5d2f" />
              </mesh>
            </group>
          ) : (
            <group>
              {[-1.1, 1.1].map((lx) =>
                [-1.1, 1.1].map((lz) => (
                  <mesh key={`${lx}-${lz}`} position={[lx, 2.8, lz]}>
                    <cylinderGeometry args={[0.14, 0.18, 5.6, 5]} />
                    <meshLambertMaterial color="#5c3d24" />
                  </mesh>
                )),
              )}
              <FramedCylinder position={[0, 6.8, 0]} args={[1.8, 1.8, 2.8, 8]} color="#8c5e36" wireColor="#d4a373" wireOpacity={0.55} />
              <FramedCone position={[0, 8.8, 0]} args={[2.1, 1.4, 8]} color="#4a301c" wireColor="#faedcd" wireOpacity={0.45} />
            </group>
          )}
        </group>
      </CurvedNode>
    );
  }

  // 2. DREAM: Pastel Cypress Groves, Storybook Hillside Towers & Cloud Puff Trees
  if (look === 'dream') {
    return (
      <CurvedNode position={[node.x, 0, node.z]} rotation={node.rot} playerPos={playerPos}>
        <group scale={node.scale}>
          {node.variant === 0 ? (
            <>
              <mesh position={[0, 1.2, 0]}>
                <cylinderGeometry args={[0.22, 0.35, 2.4, 6]} />
                <meshLambertMaterial color="#6d4c41" />
              </mesh>
              <mesh position={[0, 4.0, 0]} scale={[1.45, 2.6, 1.45]}>
                <icosahedronGeometry args={[1, 1]} />
                <meshLambertMaterial color="#7cb342" />
              </mesh>
              <mesh position={[0.2, 6.2, 0.1]} scale={[1.05, 1.8, 1.05]}>
                <icosahedronGeometry args={[1, 1]} />
                <meshLambertMaterial color="#f48fb1" />
              </mesh>
            </>
          ) : node.variant === 1 ? (
            <>
              <FramedCylinder position={[0, 2.4, 0]} args={[1.6, 1.9, 4.8, 8]} color="#f5dcc4" wireColor="#ffffff" wireOpacity={0.4} />
              <FramedCone position={[0, 5.8, 0]} args={[2.2, 2.4, 8]} color="#8e6b9e" wireColor="#fbe4ee" wireOpacity={0.45} />
              <mesh position={[0, 2.5, 1.78]}>
                <circleGeometry args={[0.55, 12]} />
                <meshBasicMaterial color="#fff3b0" />
              </mesh>
            </>
          ) : (
            <>
              {[-1.2, 1.2].map((tx, idx) => (
                <group key={tx} position={[tx, 0, idx * 0.8]}>
                  <mesh position={[0, 1.0, 0]}>
                    <cylinderGeometry args={[0.18, 0.26, 2.0, 6]} />
                    <meshLambertMaterial color="#6d4c41" />
                  </mesh>
                  <mesh position={[0, 3.2, 0]} scale={[1.3, 1.9, 1.3]}>
                    <icosahedronGeometry args={[1, 1]} />
                    <meshLambertMaterial color={idx === 0 ? '#9575cd' : '#9cd654'} />
                  </mesh>
                </group>
              ))}
            </>
          )}
        </group>
      </CurvedNode>
    );
  }

  // 3. ACID: Multi-Cap Bioluminescent Mushroom Rings, Crystal Geode Spires & Sacred Lotus Towers
  if (look === 'acid') {
    return (
      <CurvedNode position={[node.x, 0, node.z]} rotation={node.rot} playerPos={playerPos}>
        <group scale={node.scale}>
          {node.variant === 0 ? (
            /* 3-Mushroom Fairy Ring with Wireframe Gill Exoskeletons */
            <>
              {[
                { x: 0, z: 0, h: 6.2, r: 2.3, col: '#ff007f' },
                { x: -1.8, z: 1.2, h: 4.0, r: 1.5, col: '#00f0ff' },
                { x: 1.7, z: -1.0, h: 4.6, r: 1.7, col: '#39ff14' },
              ].map((m, i) => (
                <group key={i} position={[m.x, 0, m.z]}>
                  <FramedCylinder position={[0, m.h * 0.5, 0]} args={[0.32, 0.58, m.h, 8]} color="#2d0647" wireColor="#00f0ff" wireOpacity={0.85} />
                  <mesh position={[0, m.h, 0]} scale={[1.3, 0.7, 1.3]}>
                    <sphereGeometry args={[m.r, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.58]} />
                    <meshLambertMaterial color={m.col} />
                  </mesh>
                  <mesh position={[0, m.h + 0.04, 0]} scale={[1.34, 0.74, 1.34]}>
                    <sphereGeometry args={[m.r, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.58]} />
                    <meshBasicMaterial color="#ffe600" wireframe />
                  </mesh>
                </group>
              ))}
            </>
          ) : node.variant === 1 ? (
            /* Angled Neon Quartz Crystal Cluster */
            <>
              {[
                { x: 0, rot: 0, h: 8.5, col: '#00f0ff' },
                { x: -1.2, rot: 0.28, h: 6.2, col: '#ff007f' },
                { x: 1.2, rot: -0.28, h: 6.6, col: '#39ff14' },
              ].map((c, i) => (
                <group key={i} position={[c.x, 0, 0]} rotation={[0, 0, c.rot]}>
                  <FramedCylinder position={[0, c.h * 0.5, 0]} args={[0.65, 0.9, c.h, 6]} color="#19052c" wireColor={c.col} wireOpacity={0.95} />
                  <FramedCone position={[0, c.h + 0.9, 0]} args={[0.7, 1.8, 6]} color={c.col} wireColor="#ffffff" wireOpacity={0.9} />
                </group>
              ))}
            </>
          ) : (
            /* Wireframe Merkaba & Torus Shrine */
            <>
              <FramedCylinder position={[0, 2.5, 0]} args={[1.2, 1.8, 5.0, 6]} color="#19052c" wireColor="#ff007f" wireOpacity={0.9} />
              <mesh position={[0, 6.8, 0]}>
                <torusGeometry args={[2.0, 0.14, 8, 24]} />
                <meshBasicMaterial color="#00f0ff" wireframe />
              </mesh>
              <mesh position={[0, 6.8, 0]}>
                <octahedronGeometry args={[1.2, 0]} />
                <meshBasicMaterial color="#39ff14" wireframe />
              </mesh>
            </>
          )}
        </group>
      </CurvedNode>
    );
  }

  // 4. INDUSTRIAL: Hyperbolic Cooling Towers, Spherical Gas Tanks on Legs & Oil Derricks
  if (look === 'industrial') {
    return (
      <CurvedNode position={[node.x, 0, node.z]} rotation={node.rot} playerPos={playerPos}>
        <group scale={node.scale}>
          {node.variant === 0 ? (
            /* Hyperbolic Cooling Tower with Steel Truss Cage & Glowing Rim */
            <>
              <FramedCylinder position={[0, 4.2, 0]} args={[1.8, 3.0, 8.4, 12]} color="#1d2128" wireColor="#d97706" wireOpacity={0.8} />
              <FramedCylinder position={[0, 9.2, 0]} args={[2.3, 1.8, 2.2, 12]} color="#2b303a" wireColor="#ff6b00" wireOpacity={0.85} />
              <mesh position={[0, 10.35, 0]} rotation={[Math.PI / 2, 0, 0]}>
                <torusGeometry args={[2.25, 0.15, 6, 20]} />
                <meshBasicMaterial color="#ff6b00" />
              </mesh>
            </>
          ) : node.variant === 1 ? (
            /* Spherical Pressurized Refinery Gas Tank on 4 Steel Legs */
            <>
              {[-1.3, 1.3].map((lx) =>
                [-1.3, 1.3].map((lz) => (
                  <mesh key={`${lx}-${lz}`} position={[lx, 2.5, lz]}>
                    <boxGeometry args={[0.3, 5.0, 0.3]} />
                    <meshLambertMaterial color="#2b303a" />
                  </mesh>
                )),
              )}
              <mesh position={[0, 5.8, 0]}>
                <sphereGeometry args={[2.6, 14, 12]} />
                <meshLambertMaterial color="#3b2618" />
              </mesh>
              <mesh position={[0, 5.8, 0]} scale={1.02}>
                <sphereGeometry args={[2.6, 10, 8]} />
                <meshBasicMaterial color="#d97706" wireframe />
              </mesh>
            </>
          ) : (
            /* Steel Lattice Oil/Crane Derrick with Hazard Beacon */
            <>
              <FramedBox position={[0, 0.5, 0]} args={[3.6, 1.0, 3.6]} color="#d97706" wireColor="#1d2128" wireOpacity={0.85} />
              <FramedCone position={[0, 6.5, 0]} rotation={[0, Math.PI / 4, 0]} args={[2.2, 11.5, 4]} color="#1d2128" wireColor="#ff9e00" wireOpacity={0.9} />
              <mesh position={[0, 12.6, 0]}>
                <octahedronGeometry args={[0.45, 0]} />
                <meshBasicMaterial color="#ff6b00" />
              </mesh>
            </>
          )}
        </group>
      </CurvedNode>
    );
  }

  // 5. PAPERCRAFT: Multi-Tier Accordion Paper Pines, Snow-Capped Folded Mountains & Origami Pagodas
  if (look === 'papercraft') {
    return (
      <CurvedNode position={[node.x, 0, node.z]} rotation={node.rot} playerPos={playerPos}>
        <group scale={node.scale}>
          {node.variant === 0 ? (
            /* 4-Tier Accordion Folded Origami Pine Tree */
            <>
              <FramedCylinder position={[0, 1.2, 0]} args={[0.3, 0.45, 2.4, 5]} color="#b08968" wireColor="#8a5a44" wireOpacity={0.7} flat />
              {[0, 1, 2, 3].map((tier) => (
                <FramedCone
                  key={tier}
                  position={[0, 2.6 + tier * 1.45, 0]}
                  rotation={[0, (tier * Math.PI) / 4, 0]}
                  args={[2.4 - tier * 0.42, 2.1, 4]}
                  color={tier % 2 === 0 ? '#81b29a' : '#6b9080'}
                  wireColor="#8a5a44"
                  wireOpacity={0.75}
                  flat
                />
              ))}
            </>
          ) : node.variant === 1 ? (
            /* Twin-Peak Snow-Capped Folded Paper Mountain */
            <>
              <FramedCone position={[-1.2, 3.8, 0]} rotation={[0, Math.PI / 4, 0]} args={[3.6, 7.6, 4]} color="#e07a5f" wireColor="#8a5a44" wireOpacity={0.75} flat />
              <FramedCone position={[-1.2, 6.4, 0]} rotation={[0, Math.PI / 4, 0]} args={[1.35, 2.6, 4]} color="#fdf8ee" wireColor="#8a5a44" wireOpacity={0.75} flat />
              <FramedCone position={[1.6, 2.8, 0.8]} rotation={[0, Math.PI / 6, 0]} args={[2.8, 5.6, 4]} color="#f2cc8f" wireColor="#8a5a44" wireOpacity={0.75} flat />
            </>
          ) : (
            /* Pop-Up Origami Lantern Shrine */
            <>
              <FramedBox position={[0, 2.4, 0]} args={[2.8, 4.8, 2.8]} color="#f6ead4" wireColor="#8a5a44" wireOpacity={0.75} flat />
              <FramedCone position={[0, 5.8, 0]} rotation={[0, Math.PI / 4, 0]} args={[3.0, 2.4, 4]} color="#e07a5f" wireColor="#8a5a44" wireOpacity={0.8} flat />
            </>
          )}
        </group>
      </CurvedNode>
    );
  }

  // 6. ALL OTHER 10 LOOKS: 3 DISTINCT MULTI-PART DIORAMA CLUSTERS PER WORLD
  return (
    <CurvedNode position={[node.x, 0, node.z]} rotation={node.rot} playerPos={playerPos}>
      <group scale={node.scale}>
        {node.variant === 0 && (
          <>
            <FramedBox position={[0, 0.35, 0]} args={[4.4, 0.7, 4.4]} color={t.secondary} wireColor={t.wire} wireOpacity={t.wireOpacity} flat={t.flat} inkOutline={t.inkOutline} />
            <FramedBox position={[0, 3.4, 0]} args={[3.4, 5.4, 3.4]} color={t.core} wireColor={t.wire} wireOpacity={t.wireOpacity} flat={t.flat} inkOutline={t.inkOutline} />
            <FramedBox position={[0, 6.3, 0]} args={[4.6, 0.4, 4.6]} color={t.roof} wireColor={t.wire} wireOpacity={0.9} flat={t.flat} inkOutline={t.inkOutline} />
            <FramedBox position={[0, 8.4, 0]} args={[2.4, 3.8, 2.4]} color={t.secondary} wireColor={t.wire} wireOpacity={t.wireOpacity} flat={t.flat} inkOutline={t.inkOutline} />
            <FramedCone position={[0, 11.4, 0]} rotation={[0, Math.PI / 4, 0]} args={[2.4, 2.6, 4]} color={t.roof} wireColor={t.wire} wireOpacity={0.92} flat={t.flat} inkOutline={t.inkOutline} />
            <mesh position={[0, 3.4, 1.74]}>
              <planeGeometry args={[1.5, 2.2]} />
              <meshBasicMaterial color={t.window} />
            </mesh>
            <mesh position={[0, 13.2, 0]}>
              <octahedronGeometry args={[0.5, 0]} />
              <meshBasicMaterial color={t.accent} />
            </mesh>
          </>
        )}

        {node.variant === 1 && (
          <>
            {[
              { x: 0, z: 0, h: 7.5, r: 1.1 },
              { x: -1.8, z: 1.1, h: 5.2, r: 0.85 },
              { x: 1.7, z: -0.9, h: 6.0, r: 0.95 },
            ].map((s, idx) => (
              <group key={idx} position={[s.x, 0, s.z]}>
                <FramedCylinder
                  position={[0, s.h * 0.5, 0]}
                  args={[s.r * 0.45, s.r * 0.65, s.h, 6]}
                  color={idx % 2 === 0 ? t.core : t.secondary}
                  wireColor={t.wire}
                  wireOpacity={t.wireOpacity}
                  flat={t.flat}
                  inkOutline={t.inkOutline}
                />
                <FramedCone
                  position={[0, s.h + 0.8, 0]}
                  args={[s.r * 1.65, 2.0, 6]}
                  color={idx === 0 ? t.roof : t.accent}
                  wireColor={t.wire}
                  wireOpacity={0.9}
                  flat={t.flat}
                  inkOutline={t.inkOutline}
                />
              </group>
            ))}
          </>
        )}

        {node.variant === 2 && (
          <>
            <FramedBox position={[0, 0.3, 0]} args={[4.8, 0.6, 2.2]} color={t.secondary} wireColor={t.wire} wireOpacity={0.85} />
            {[-1.6, 1.6].map((px) => (
              <FramedCylinder
                key={px}
                position={[px, 3.6, 0]}
                args={[0.38, 0.48, 6.2, 6]}
                color={t.core}
                wireColor={t.wire}
                wireOpacity={0.88}
                flat={t.flat}
                inkOutline={t.inkOutline}
              />
            ))}
            <FramedBox position={[0, 7.0, 0]} args={[5.2, 0.75, 1.4]} color={t.roof} wireColor={t.wire} wireOpacity={0.92} flat={t.flat} inkOutline={t.inkOutline} />
            <mesh position={[0, 4.2, 0]}>
              <octahedronGeometry args={[0.95, 0]} />
              <meshBasicMaterial color={t.window} />
            </mesh>
            <mesh position={[0, 4.2, 0]} scale={1.35}>
              <octahedronGeometry args={[0.95, 0]} />
              <meshBasicMaterial color={t.wire} wireframe />
            </mesh>
          </>
        )}
      </group>
    </CurvedNode>
  );
}

/* ──────────────────────  MAIN MINDSCAPE ARCHITECTURE ENSEMBLE  ────────────────────── */

export function MindscapeArchitecture({
  playerPos,
  nearNoticeBoard = false,
  nearMapTable = false,
  nearLibrary = false,
  nearMoodStone = false,
  nearBottlePost = false,
}: MindscapeArchitectureProps) {
  const look = useWorldLook((s) => s.look);

  const biomeNodes = useMemo(() => {
    if (look === 'wireframe' || look === 'minimal') return [];
    const seed = look.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
    return generateBiomeNodes(seed);
  }, [look]);

  if (look === 'wireframe') return null;

  return (
    <group userData={OWN_TAG}>
      {/* 1. Four Role-Differentiated Interactive Hub Landmarks */}
      <HubLandmark
        look={look}
        role="mindmap"
        position={HUB_COORDS.mindmap}
        label="Mind Map"
        near={nearMapTable}
        playerPos={playerPos}
      />
      <HubLandmark
        look={look}
        role="vault"
        position={HUB_COORDS.vault}
        label="Synaptic Vault"
        near={nearMoodStone}
        playerPos={playerPos}
      />
      <HubLandmark
        look={look}
        role="post"
        position={HUB_COORDS.post}
        label="Post"
        near={nearBottlePost}
        playerPos={playerPos}
      />
      <HubLandmark
        look={look}
        role="terminal"
        position={HUB_COORDS.terminal}
        label="Terminal"
        near={nearLibrary || nearNoticeBoard}
        playerPos={playerPos}
      />

      {look !== 'minimal' && (
        <>
          {/* 2. Four Flanking Wing Pavilions (East & West Courts) */}
          {WING_COORDS.map((pos, idx) => (
            <MindscapeWingPavilion key={`wing-${idx}`} look={look} position={pos} idx={idx} playerPos={playerPos} />
          ))}

          {/* 3. Sixteen Avenue Street Lamps Lining the Four Cardinal Roads */}
          {STREET_LAMP_COORDS.map((pos, idx) => (
            <MindscapeStreetLamp key={`lamp-${idx}`} look={look} position={pos} playerPos={playerPos} />
          ))}

          {/* 4. Eight Forecourt Plaza Lanterns Framing the Central Inscription Tree */}
          {PLAZA_LANTERN_COORDS.map((pos, idx) => (
            <MindscapePlazaLantern key={`lantern-${idx}`} look={look} position={pos} playerPos={playerPos} />
          ))}

          {/* 5. Four Monumental Cardinal Threshold Gates */}
          {GATE_COORDS.map((g, idx) => (
            <MindscapeGate key={`mind-gate-${idx}`} look={look} position={g.pos} rotation={g.rot} playerPos={playerPos} />
          ))}

          {/* 6. Forty-Eight Multi-Part Overworld Biome Diorama Clusters */}
          {biomeNodes.map((node, idx) => (
            <MindscapeOverworldNode key={`mind-biome-${look}-${idx}`} look={look} node={node} playerPos={playerPos} />
          ))}
        </>
      )}
    </group>
  );
}
