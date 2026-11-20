import React, { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import SpriteText from '../../three/SpriteText';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { sphereDrop, applyGlobeCurvature } from '../RebuiltWorldShared';
// Extracted modules
import {
  getPalmTreeTexture, getGrassTexture, getFloppyDiskTexture, getCRTMonitorTextures,
  getHeartTexture, getHypercubeTexture, getGlitchCloudTextures, getWatcherEyeTexture,
  getPigeonTexture, getBisonTexture,
} from './assets/pixelArtTextures';
import {
  DoomFloppy, DoomMonitor, DoomHeart, DoomHypercube, DoomGlitchCloud,
  DoomWatcherEye, DoomTree, DoomGrass, DoomPigeon, DoomBison,
} from './assets/RetroBillboards';
import { AestheticTorii, AestheticColumn, AestheticPyramid, AestheticBamboo } from './assets/AestheticConstructs';
// Re-export DoomBison so existing consumers (AresGodhead.tsx) don't need path changes
export { DoomBison } from './assets/RetroBillboards';

const MATRIX_VERTEX = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const MATRIX_FRAGMENT = `
  uniform float time;
  uniform vec3 color;
  varying vec2 vUv;
  
  float random(vec2 st) {
    return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
  }

  void main() {
    vec2 grid = vUv * vec2(10.0, 50.0);
    float column = floor(grid.x);
    float offset = random(vec2(column, 0.0)) * 10.0;
    float speed = 0.5 + random(vec2(column, 1.0)) * 2.0;
    float drop = fract(grid.y - time * speed + offset);
    
    float rain = step(0.95, drop);
    float tail = pow(drop, 4.0);
    
    vec3 finalColor = color * (rain + tail * 0.4);
    gl_FragColor = vec4(finalColor, (rain + tail) * 0.8);
  }
`;

function VoidBeam({ position }: { position: [number, number, number] }) {
  const mesh = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (mesh.current) {
      mesh.current.scale.x = 0.5 + Math.sin(clock.elapsedTime * 10) * 0.2;
      (mesh.current.material as any).opacity = 0.4 + Math.sin(clock.elapsedTime * 15) * 0.3;
    }
  });
  return (
    <mesh position={[position[0], 50, position[2]]} ref={mesh}>
      <cylinderGeometry args={[0.2, 0.8, 100, 6]} />
      <meshBasicMaterial color="#7c3aed" transparent opacity={0.6} />
    </mesh>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TYPES & CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

export type BitSpecies = 'SPIRE' | 'ECHO' | 'CLUSTER' | 'PRISM';

const HUB_TARGETS: [number, number, number][] = [
  [0, 0, -110],  // Osaka Castle
  [-35, 0, -45],  // West Townhouse
  [35, 0, -45],   // East Townhouse
  [0, 3, 0],      // Altar
  [60, 3, 40],    // Customization
  [0, 3, -80],    // Sigma Skull
  [-52, 0, -38],  // Library/Terminal
  [52, 0, -38],   // Archive
  [-52, 0, 38],   // Mood Building
  [52, 0, 38],    // Post Office
];

const SPECIES_PALETTES: Record<BitSpecies, number[]> = {
  SPIRE: [0x22d3ee, 0x06b6d4, 0x0891b2], // Cyan/Teal
  ECHO: [0xec4899, 0xd946ef, 0x7c3aed],   // Pink/Purple
  CLUSTER: [0xfbbf24, 0xf59e0b, 0xd97706], // Gold/Amber
  PRISM: [0x34d399, 0x10b981, 0x059669],  // Emerald
};

const HAIKUS = [
  "VOK RIT ZAL / QUN LOR KIN / NEX VOR TAN",
  "SOL MIR KAN / ZOT RUX VEL / MOR TIN DAL",
  "FEN LUR ZIN / GOR PAX NIM / KEL VOR ZAN",
  "YOT MIN KOR / ZEV RUX TAN / NIL MOR DAL",
];

const TERMITESSE_GLITCH = ["A", "X", "Z", "V", "Q", "R", "K", "L", "M", "N", "T"];

// ═══════════════════════════════════════════════════════════════════════════
// JAPANESE TOWNHOUSE (Varied Architecture)
// ═══════════════════════════════════════════════════════════════════════════

export function JapaneseTownhouse({
  position,
  rotation = [0, 0, 0],
  scale = 1,
  playerPos,
  seed = 0,
}: {
  position: [number, number, number];
  rotation?: [number, number, number];
  scale?: number;
  playerPos: React.MutableRefObject<THREE.Vector3>;
  seed?: number;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const design = useMemo(() => {
    const r = (n: number) => Math.sin(seed * 123.456 + n * 78.9) * 0.5 + 0.5;
    return {
      height: 2 + r(1) * 3,
      width: 3 + r(2) * 2,
      depth: 2.5 + r(3) * 1.5,
      roofType: r(4) > 0.5 ? 'GABLED' : 'PIRAMIDAL',
      color: r(5) > 0.5 ? 0x1e1b4b : 0x111827,
      accent: r(6) > 0.5 ? 0xec4899 : 0xa855f7,
    };
  }, [seed]);

  useFrame(() => {
    if (!groupRef.current) return;
    const pp = playerPos.current;
    applyGlobeCurvature(groupRef.current, position[0], position[1], position[2], pp, rotation ? rotation[1] : 0);
  });

  return (
    <group ref={groupRef} position={position} scale={scale}>
      <mesh position={[0, design.height / 2, 0]}>
        <boxGeometry args={[design.width, design.height, design.depth]} />
        <meshBasicMaterial color={design.color} wireframe transparent opacity={0.4} />
      </mesh>
      <mesh position={[0, design.height + 0.5, 0]}>
        {design.roofType === 'GABLED' ? (
          <cylinderGeometry args={[0, design.width * 0.7, 1.2, 4, 1]} />
        ) : (
          <octahedronGeometry args={[design.width * 0.6, 0]} />
        )}
        <meshBasicMaterial color={design.accent} wireframe transparent opacity={0.5} />
      </mesh>
      <mesh position={[design.width / 2 + 0.2, design.height * 0.8, design.depth / 2]}>
        <tetrahedronGeometry args={[0.15, 0]} />
        <meshBasicMaterial color={0xfbbf24} transparent opacity={0.8} />
      </mesh>
    </group>
  );
}

export function OsakaCastle({
  position,
  scale = 1,
  playerPos,
  tiers = 3,
}: {
  position: [number, number, number];
  scale?: number;
  playerPos: React.MutableRefObject<THREE.Vector3>;
  tiers?: number;
}) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame(() => {
    if (!groupRef.current) return;
    const pp = playerPos.current;
    applyGlobeCurvature(groupRef.current, position[0], position[1], position[2], pp);
  });

  return (
    <group ref={groupRef} position={position} scale={scale}>
      {[...Array(tiers)].map((_, i) => (
        <group key={i}>
          <mesh position={[0, i * 8 + 4, 0]}>
            <boxGeometry args={[12 - i * 3, 8, 12 - i * 3]} />
            <meshBasicMaterial color={0x0a0514} />
          </mesh>
          <mesh position={[0, i * 8 + 4, 0]}>
            <boxGeometry args={[12.05 - i * 3, 8.05, 12.05 - i * 3]} />
            <meshBasicMaterial color={0x312e81} wireframe />
          </mesh>
        </group>
      ))}
      <mesh position={[0, tiers * 8 + 2, 0]}>
        <octahedronGeometry args={[6, 0]} />
        <meshBasicMaterial color={0x0a0514} />
      </mesh>
      <mesh position={[0, tiers * 8 + 2, 0]}>
        <octahedronGeometry args={[6.1, 0]} />
        <meshBasicMaterial color={0xec4899} wireframe />
      </mesh>
      {[...Array(4)].map((_, i) => (
        <mesh key={i} position={[Math.cos(i * Math.PI / 2) * 5, 12, Math.sin(i * Math.PI / 2) * 5]}>
          <boxGeometry args={[0.8, 0.8, 0.8]} />
          <meshBasicMaterial color={0xfbbf24} />
        </mesh>
      ))}
    </group>
  );
}

// CODE TREE (Replaces Buildings)
// ═══════════════════════════════════════════════════════════════════════════

export function CodeTree({ position, playerPos, seed = 0 }: { 
  position: [number, number, number], 
  playerPos: React.MutableRefObject<THREE.Vector3>,
  seed?: number
}) {
  const group = useRef<THREE.Group>(null);
  const uniforms = useMemo(() => {
    const palette = [0x22d3ee, 0x10b981, 0xfbbf24, 0x3b82f6]; // Starry Night: Cyan, Green, Gold, Blue
    const r = (n: number) => (Math.sin(seed * 78.9 + n * 12.3) * 0.5 + 0.5);
    return {
      time: { value: 0 },
      color: { value: new THREE.Color(palette[Math.floor(r(1) * palette.length)]) }
    };
  }, [seed]);

  useFrame(({ clock }) => {
    if (!group.current) return;
    const t = clock.elapsedTime;
    uniforms.time.value = t;
    
    const pp = playerPos.current;
    applyGlobeCurvature(group.current, position[0], -5, position[2], pp);
  });

  return (
    <group ref={group}>
      {/* HARD-EDGED TRUNK: Strictly Triangulated */}
      <mesh>
        <cylinderGeometry args={[0.2, 1.8, 50, 4]} />
        <meshBasicMaterial color={0x0a0f2c} />
      </mesh>
      
      {/* CONIFEROUS PRISMATIC BRANCHES: Stacked Data-Cones */}
      {[
        { seg: 6, y: 12, s: 8 }, // Hex Base
        { seg: 5, y: 22, s: 6 }, // Pent Mid
        { seg: 4, y: 32, s: 4 }, // Quad Top
        { seg: 3, y: 42, s: 2 }  // Tri Zenith
      ].map((layer, i) => (
        <group key={i} position={[0, layer.y, 0]} rotation={[0, i * 1.5, 0]}>
          <mesh scale={[layer.s, layer.s * 1.5, layer.s]}>
            <coneGeometry args={[1, 1, layer.seg]} />
            <shaderMaterial
              vertexShader={MATRIX_VERTEX}
              fragmentShader={MATRIX_FRAGMENT}
              uniforms={uniforms}
              transparent
              blending={THREE.AdditiveBlending}
              side={THREE.DoubleSide}
            />
          </mesh>
        </group>
      ))}

      {/* MATRIX SKIN (TRUNK) */}
      <mesh>
        <cylinderGeometry args={[0.25, 1.9, 50.5, 4]} />
        <shaderMaterial
          vertexShader={MATRIX_VERTEX}
          fragmentShader={MATRIX_FRAGMENT}
          uniforms={uniforms}
          transparent
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </group>
  );
}

export function InstancedCodeForest({
  playerPos,
  count = 280,
  radius = 135,
}: {
  playerPos: React.MutableRefObject<THREE.Vector3>;
  count?: number;
  radius?: number;
}) {
  const placements = useMemo(() => {
    const list: Array<{ x: number; z: number; type: 'bamboo' | 'torii' | 'column' | 'pyramid' | 'doomTree' | 'doomGrass' | 'doomFloppy' | 'doomMonitor' | 'doomHeart' | 'doomHypercube' | 'doomGlitchCloud' | 'doomWatcherEye' | 'doomPigeon'; scale: number; yaw: number }> = [];
    const pseudoRandom = (seed: number) => {
      const x = Math.sin(seed * 43758.5453) * 10000;
      return x - Math.floor(x);
    };
    for (let i = 0; i < count; i++) {
      const angle = (i * 2.39996) % (Math.PI * 2);
      const r = 24 + pseudoRandom(i * 12.3) * (radius - 24);
      const x = Math.cos(angle) * r;
      const z = Math.sin(angle) * r;
      if (Math.abs(x) < 9.5 || Math.abs(z) < 9.5) continue;

      let type: 'bamboo' | 'torii' | 'column' | 'pyramid' | 'doomTree' | 'doomGrass' | 'doomFloppy' | 'doomMonitor' | 'doomHeart' | 'doomHypercube' | 'doomGlitchCloud' | 'doomWatcherEye' | 'doomPigeon' = 'bamboo';
      const rand = i % 19;
      if (rand === 1) type = 'torii';
      else if (rand === 3) type = 'column';
      else if (rand === 5) type = 'pyramid';
      else if (rand === 7) type = 'doomTree';
      else if (rand === 8) type = 'doomGrass';
      else if (rand === 9) type = 'doomFloppy';
      else if (rand === 11) type = 'doomMonitor';
      else if (rand === 12) type = 'doomHeart';
      else if (rand === 14) type = 'doomHypercube';
      else if (rand === 15) type = 'doomGlitchCloud';
      else if (rand === 16) type = 'doomWatcherEye';
      else if (rand === 17) type = 'doomPigeon';

      list.push({
        x,
        z,
        type,
        scale: 0.75 + pseudoRandom(i * 91.7) * 0.5,
        yaw: pseudoRandom(i * 54.3) * Math.PI * 2,
      });
    }
    return list;
  }, [count, radius]);

  const bambooPlacements = useMemo(() => placements.filter(p => p.type === 'bamboo'), [placements]);
  const toriiPlacements = useMemo(() => placements.filter(p => p.type === 'torii'), [placements]);
  const columnPlacements = useMemo(() => placements.filter(p => p.type === 'column'), [placements]);
  const pyramidPlacements = useMemo(() => placements.filter(p => p.type === 'pyramid'), [placements]);
  const doomTreePlacements = useMemo(() => placements.filter(p => p.type === 'doomTree'), [placements]);
  const doomGrassPlacements = useMemo(() => placements.filter(p => p.type === 'doomGrass'), [placements]);
  const doomFloppyPlacements = useMemo(() => placements.filter(p => p.type === 'doomFloppy'), [placements]);
  const doomMonitorPlacements = useMemo(() => placements.filter(p => p.type === 'doomMonitor'), [placements]);
  const doomHeartPlacements = useMemo(() => placements.filter(p => p.type === 'doomHeart'), [placements]);
  const doomHypercubePlacements = useMemo(() => placements.filter(p => p.type === 'doomHypercube'), [placements]);
  const doomGlitchCloudPlacements = useMemo(() => placements.filter(p => p.type === 'doomGlitchCloud'), [placements]);
  const doomWatcherEyePlacements = useMemo(() => placements.filter(p => p.type === 'doomWatcherEye'), [placements]);
  const doomPigeonPlacements = useMemo(() => placements.filter(p => p.type === 'doomPigeon'), [placements]);

  return (
    <group>
      {bambooPlacements.map((t, idx) => (
        <AestheticBamboo
          key={`bamboo-${idx}`}
          position={[t.x, 0, t.z]}
          scale={t.scale}
          seed={idx}
          playerPos={playerPos}
        />
      ))}
      {toriiPlacements.map((t, idx) => (
        <AestheticTorii
          key={`torii-${idx}`}
          position={[t.x, 0, t.z]}
          scale={t.scale * 1.1}
          yaw={t.yaw}
          seed={idx}
          playerPos={playerPos}
        />
      ))}
      {columnPlacements.map((t, idx) => (
        <AestheticColumn
          key={`column-${idx}`}
          position={[t.x, 0, t.z]}
          scale={t.scale * 1.2}
          playerPos={playerPos}
        />
      ))}
      {pyramidPlacements.map((t, idx) => (
        <AestheticPyramid
          key={`pyramid-${idx}`}
          position={[t.x, 0, t.z]}
          scale={t.scale * 1.3}
          yaw={t.yaw}
          playerPos={playerPos}
        />
      ))}
      {doomTreePlacements.map((t, idx) => (
        <DoomTree
          key={`doomtree-${idx}`}
          position={[t.x, 0, t.z]}
          scale={t.scale}
          playerPos={playerPos}
        />
      ))}
      {doomGrassPlacements.map((t, idx) => (
        <DoomGrass
          key={`doomgrass-${idx}`}
          position={[t.x, 0, t.z]}
          scale={t.scale}
          playerPos={playerPos}
        />
      ))}
      {doomFloppyPlacements.map((t, idx) => (
        <DoomFloppy
          key={`doomfloppy-${idx}`}
          position={[t.x, 0, t.z]}
          scale={t.scale}
          playerPos={playerPos}
        />
      ))}
      {doomMonitorPlacements.map((t, idx) => (
        <DoomMonitor
          key={`doommonitor-${idx}`}
          position={[t.x, 0, t.z]}
          scale={t.scale}
          playerPos={playerPos}
        />
      ))}
      {doomHeartPlacements.map((t, idx) => (
        <DoomHeart
          key={`doomheart-${idx}`}
          position={[t.x, 0, t.z]}
          scale={t.scale}
          playerPos={playerPos}
        />
      ))}
      {doomHypercubePlacements.map((t, idx) => (
        <DoomHypercube
          key={`doomhypercube-${idx}`}
          position={[t.x, 0, t.z]}
          scale={t.scale}
          playerPos={playerPos}
        />
      ))}
      {doomGlitchCloudPlacements.map((t, idx) => (
        <DoomGlitchCloud
          key={`doomglitchcloud-${idx}`}
          position={[t.x, 0, t.z]}
          scale={t.scale}
          playerPos={playerPos}
        />
      ))}
      {doomWatcherEyePlacements.map((t, idx) => (
        <DoomWatcherEye
          key={`doomwatchereye-${idx}`}
          position={[t.x, 0, t.z]}
          scale={t.scale}
          playerPos={playerPos}
        />
      ))}
      {doomPigeonPlacements.map((t, idx) => (
        <DoomPigeon
          key={`doompigeon-${idx}`}
          position={[t.x, 0, t.z]}
          scale={t.scale}
          playerPos={playerPos}
        />
      ))}
    </group>
  );
}
export function DigitalGrass({
  playerPos,
}: {
  playerPos: React.MutableRefObject<THREE.Vector3>;
  count?: number;
  radius?: number;
}) {
  return null;
}

export function AmbientLife({ playerPos }: { playerPos: React.MutableRefObject<THREE.Vector3> }) {
  const group = useRef<THREE.Group>(null);
  const critters = useMemo(() => {
    return [...Array(40)].map((_, i) => ({
      type: i % 2 === 0 ? 'BUTTERFLY' : 'FIREFLY',
      pos: new THREE.Vector3((Math.random()-0.5)*150, 2+Math.random()*15, (Math.random()-0.5)*150),
      seed: Math.random() * 100,
      color: i % 2 === 0 ? 0x22d3ee : 0xfbbf24
    }));
  }, []);

  useFrame(({ clock }) => {
    if (!group.current) return;
    const t = clock.elapsedTime;
    const pp = playerPos.current;
    group.current.children.forEach((child, i) => {
      const c = critters[i];
      const x = c.pos.x + Math.sin(t * 0.4 + c.seed) * 8;
      const z = c.pos.z + Math.cos(t * 0.3 + c.seed) * 8;
      const y = c.pos.y + Math.sin(t * 1.5 + c.seed) * 2;
      const drop = sphereDrop(x - pp.x, z - pp.z);
      child.position.set(x, y - drop, z);
    });
  });

  return (
    <group ref={group}>
      {critters.map((c, i) => (
        <mesh key={i}>
          {c.type === 'BUTTERFLY' ? <planeGeometry args={[0.4, 0.4]} /> : <sphereGeometry args={[0.2, 4, 4]} />}
          <meshBasicMaterial color={c.color} transparent opacity={0.9} />
        </mesh>
      ))}
    </group>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SIGMA NPC BIT (Species & Mutators)
// ═══════════════════════════════════════════════════════════════════════════

export function SigmaNPCBit({ playerPos, seed = 0 }: { playerPos: React.MutableRefObject<THREE.Vector3>; seed?: number }) {
  const groupRef = useRef<THREE.Group>(null);
  const textTimer = useRef(0);
  const [currentText, setCurrentText] = React.useState("");
  const [visible, setVisible] = React.useState(false);

  // Advanced Spatial Reasoning State
  const state = useMemo(() => {
    const r = (n: number) => (Math.sin(seed * 456.789 + n * 12.3) * 0.5 + 0.5);
    const speciesArr: BitSpecies[] = ['SPIRE', 'ECHO', 'CLUSTER', 'PRISM'];
    const species = speciesArr[Math.floor(r(1) * 4)];
    const colors = SPECIES_PALETTES[species];
    
    return {
      species,
      color: colors[Math.floor(r(2) * colors.length)],
      // ASYNCHRONOUS FACES: Non-uniform scaling for distortion
      scaleX: 0.4 + r(3) * 1.8,
      scaleY: 0.6 + r(4) * 2.2,
      scaleZ: 0.4 + r(5) * 1.8,
      speed: 0.02 + r(6) * 0.04,
      targetIdx: Math.floor(r(7) * HUB_TARGETS.length),
      currentPos: new THREE.Vector3((r(8)-0.5)*100, 2, (r(9)-0.5)*100),
      velocity: new THREE.Vector3(),
      driftSeed: r(10) * 100,
      jitterSeed: r(11) * 1000,
      isRegistered: r(12) > 0.3,
      preyTarget: null as number | null,
      hp: species === 'ECHO' ? 2 : species === 'SPIRE' ? 4 : species === 'CLUSTER' ? 6 : 12,
    };
  }, [seed]);

  useFrame(({ clock }, delta) => {
    if (!groupRef.current) return;
    const t = clock.elapsedTime;
    const pp = playerPos.current;

    // 1. Target Seeking Math (Heavy Math)
    const target = HUB_TARGETS[state.targetIdx];
    const targetVec = new THREE.Vector3(target[0], target[1], target[2]);
    const dir = targetVec.clone().sub(state.currentPos).normalize();
    
    // Add "Life outside player" - switch targets occasionally
    if (state.currentPos.distanceTo(targetVec) < 5) {
      state.targetIdx = (state.targetIdx + 1) % HUB_TARGETS.length;
    }

    // 2. Species-Specific Movement & PREDATORY HP Math
    const speedMult = state.isRegistered ? 1 : 1.5;
    if (state.species === 'SPIRE' || state.species === 'PRISM') {
      const driftX = Math.sin(t * 0.3 + state.driftSeed) * 0.15;
      const driftZ = Math.cos(t * 0.2 + state.driftSeed) * 0.15;
      state.velocity.lerp(dir.add(new THREE.Vector3(driftX, 0, driftZ)), 0.03 * speedMult);
    } else if (state.species === 'ECHO') {
      // PREDATORY ECHO: 2 HP. Hunt the 6 HP Muskrats.
      const huntBias = new THREE.Vector3(Math.sin(t * 2), 0, Math.cos(t * 2)).multiplyScalar(0.4);
      state.velocity.lerp(dir.add(huntBias), 0.06 * speedMult);
    } else {
      // MUSKRAT FEAR: 6 HP. Jitter and flee. No fight back logic.
      const jitter = Math.sin(t * 30 + state.jitterSeed) * (state.isRegistered ? 0.08 : 0.25);
      const wave = Math.sin(t * 0.8 + state.driftSeed) * 0.05;
      state.velocity.lerp(dir.multiplyScalar(1 + wave + jitter), 0.05 * speedMult);
      
      // If "hunted" (Echo nearby), panic increase
      const fearFactor = Math.sin(t * 50) * 0.2;
      state.velocity.addScalar(fearFactor);
    }

    // 3. DEFLECTION: Avoid Altar and Landmarks
    const distToOrigin = state.currentPos.length();
    if (distToOrigin < 4) {
      state.velocity.add(state.currentPos.clone().normalize().multiplyScalar(0.05));
    }

    state.currentPos.add(state.velocity.clone().multiplyScalar(state.speed));

    // 3. Grounding & Curvature
    const x = state.currentPos.x;
    const z = state.currentPos.z;
    const drop = sphereDrop(x - pp.x, z - pp.z);
    
    // Vertical "Breathing"
    const hover = state.species === 'PRISM' ? 3.5 : 2.0;
    const y = hover + Math.sin(t * 1.5 + state.driftSeed) * 0.4;

    groupRef.current.position.set(x, y - drop, z);
    
    // Look at target or velocity
    if (state.velocity.lengthSq() > 0.01) {
      const lookTarget = state.currentPos.clone().add(state.velocity);
      groupRef.current.lookAt(lookTarget.x, y - drop, lookTarget.z);
    }

    // Speech display
    if (t > textTimer.current) {
      if (!visible) {
        if (state.species === 'CLUSTER') {
          // Solo Monolith glitched speech
          setCurrentText(TERMITESSE_GLITCH[Math.floor(Math.random() * TERMITESSE_GLITCH.length)]);
        } else {
          setCurrentText(HAIKUS[Math.floor(Math.random() * HAIKUS.length)]);
        }
        setVisible(true);
        textTimer.current = t + (state.species === 'CLUSTER' ? 1 : 5);
      } else {
        setVisible(false);
        textTimer.current = t + 5 + Math.random() * 15;
      }
    }
  });

  return (
    <group ref={groupRef}>
      {/* Species-Specific Geometry */}
      <group scale={[state.scaleX, state.scaleY, state.scaleZ]}>
        {state.species === 'SPIRE' && (
          <mesh>
            <tetrahedronGeometry args={[0.5, 0]} />
            <meshBasicMaterial color={state.color} wireframe transparent opacity={0.5} />
          </mesh>
        )}
        {state.species === 'ECHO' && (
          <mesh>
            <boxGeometry args={[1.2, 0.05, 0.6]} />
            <meshBasicMaterial color={state.color} transparent opacity={0.35} />
          </mesh>
        )}
        {state.species === 'CLUSTER' && (
          <group>
            {[...Array(3)].map((_, i) => (
              <mesh key={i} position={[Math.sin(i) * 0.15, Math.cos(i) * 0.15, 0]}>
                <boxGeometry args={[0.2, 0.2, 0.2]} />
                <meshBasicMaterial color={state.color} transparent opacity={0.55} />
              </mesh>
            ))}
          </group>
        )}
        {state.species === 'PRISM' && (
          <mesh>
            <dodecahedronGeometry args={[0.45, 0]} />
            <meshBasicMaterial color={state.color} wireframe transparent opacity={0.65} />
          </mesh>
        )}
      </group>

      {/* Blinking Dot (Conservative Octahedron) */}
      <mesh position={[0, 1.2, 0]}>
        <tetrahedronGeometry args={[0.08, 0]} />
        <meshBasicMaterial color={state.color} transparent opacity={0.9} />
      </mesh>

      {/* IDENTITY DISC: Registered status marker */}
      {state.isRegistered && (
        <mesh position={[0, 0.4, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.4, 0.5, 6]} />
          <meshBasicMaterial color={state.color} transparent opacity={0.4} side={THREE.DoubleSide} />
        </mesh>
      )}

      {/* Floating Text */}
      {visible && (
        <group position={[0, 2.2, 0]}>
          <SpriteText
            text={currentText.toUpperCase()}
            fontSize={0.4}
            color="#d9b3ff"
            fontFamily="'Termitesse', 'IBM Plex Mono', monospace"
            fontWeight={400}
            letterSpacing={0.04}
            outlineWidth={0.01}
            outlineColor="#12071c"
          />
        </group>
      )}

      {/* SIGMA'S WILL: Occasional Void Beam on "Damned" NPCs */}
      {state.species === 'PRISM' && visible && (
        <VoidBeam position={[0, 0, 0]} />
      )}
    </group>
  );
}
