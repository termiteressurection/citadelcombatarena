import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { sphereDrop, applyGlobeCurvature } from '../RebuiltWorldShared';
import type { Chamber } from '../types';
import {
  isCalendarYearId,
  isCalendarSeasonId,
  isCalendarMonthId,
  parseCalendarChamberId,
  SEASONS,
} from '../fractalCalendarModel';
import { getMonthIndexFromChamber } from '../calendarChamberUtils';

export type ChamberAestheticCategory =
  | 'sanctuary' // Day Chamber & Hub: Lodge floor, sanctuary columns, altar, wireframe torii
  | 'year'      // Year Chamber: Chronos Orrery & Celestial Astrolabe
  | 'season'    // 4 Seasons: Winter, Spring, Summer, Autumn
  | 'month';    // 12 Months: Dedicated monthly architectural chambers

export function getChamberAesthetic(chamber: Chamber): {
  category: ChamberAestheticCategory;
  seasonIndex?: number;
  monthIndex?: number;
} {
  if (chamber.id === 0 || chamber.template === 'day' || chamber.template === 'sanctuary') {
    return { category: 'sanctuary' };
  }

  if (chamber.template === 'calendar-root' || isCalendarYearId(chamber.id)) {
    return { category: 'year' };
  }

  if (chamber.template === 'season' || isCalendarSeasonId(chamber.id)) {
    let sIdx = 0;
    const parsed = parseCalendarChamberId(chamber.id);
    if (parsed.type === 'season' && parsed.seasonIndex !== undefined) {
      sIdx = parsed.seasonIndex;
    } else {
      const upper = chamber.name.toUpperCase();
      const found = SEASONS.findIndex((s) => upper.includes(s.name));
      if (found >= 0) sIdx = found;
    }
    return { category: 'season', seasonIndex: sIdx };
  }

  if (chamber.template === 'month' || isCalendarMonthId(chamber.id)) {
    let mIdx = getMonthIndexFromChamber(chamber);
    if (mIdx === null) {
      const parsed = parseCalendarChamberId(chamber.id);
      if (parsed.type === 'month' && parsed.month !== undefined) {
        mIdx = parsed.month - 1;
      } else {
        mIdx = 0;
      }
    }
    return { category: 'month', monthIndex: mIdx };
  }

  return { category: 'sanctuary' };
}

// ─────────────────────────────────────────────────────────────────────────────
// PLANETARY CURVATURE VERTEX SHADER & SHARED GEOMETRY
// ─────────────────────────────────────────────────────────────────────────────

export const planetaryCurvedVertexShader = `
  varying vec2 vWorldXZ;
  varying vec2 vLocalXZ;
  void main() {
    vec3 localPos = position;
    vLocalXZ = localPos.xz;
    float sphereRadius = 120.0;
    float radial = length(localPos.xz);
    float sagitta = (radial * radial) / (2.0 * sphereRadius);
    localPos.y -= sagitta;
    vec4 worldPos = modelMatrix * vec4(localPos, 1.0);
    vWorldXZ = worldPos.xz;
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

// Shared subdivided plane geometry (100x100 segments across 320 units)
const curvedPlaneGeo = new THREE.PlaneGeometry(320, 320, 96, 96);
curvedPlaneGeo.rotateX(-Math.PI / 2);

// ─────────────────────────────────────────────────────────────────────────────
// 1. YEAR CHAMBER: The Chronos Orrery & Celestial Astrolabe
// ─────────────────────────────────────────────────────────────────────────────

const astrolabeFragmentShader = `
  varying vec2 vWorldXZ;
  varying vec2 vLocalXZ;
  uniform float uTime;

  void main() {
    float dist = length(vWorldXZ);
    float fade = 1.0 - smoothstep(70.0, 160.0, dist);

    // Golden concentric orbital tracks
    float track8  = smoothstep(0.35, 0.0, abs(dist - 10.0));
    float track18 = smoothstep(0.4, 0.0, abs(dist - 20.0));
    float track28 = smoothstep(0.45, 0.0, abs(dist - 32.0));
    float track40 = smoothstep(0.5, 0.0, abs(dist - 48.0));
    float tracks = track8 + track18 + track28 + track40;

    // Radial 12-hour / 24-sector astrolabe rays
    float angle = atan(vWorldXZ.y, vWorldXZ.x);
    float ray = smoothstep(0.02, 0.0, abs(fract((angle + uTime * 0.01) * 3.8197) - 0.5));

    // Astrolabe golden tick ring
    float ticks = smoothstep(0.2, 0.0, abs(fract(dist * 0.5) - 0.5)) * smoothstep(18.0, 20.0, dist) * smoothstep(34.0, 32.0, dist);

    vec3 baseColor = vec3(0.015, 0.008, 0.04);
    vec3 gold = vec3(0.98, 0.78, 0.22);
    vec3 cyan = vec3(0.22, 0.83, 0.95);

    vec3 color = baseColor;
    color += gold * tracks * 0.85;
    color += cyan * ray * 0.35;
    color += gold * ticks * 0.45;

    float alpha = fade * (0.85 + tracks * 0.15);
    gl_FragColor = vec4(color, alpha);
  }
`;

export function YearChamberEnvironment({
  playerPos,
}: {
  playerPos: React.MutableRefObject<THREE.Vector3>;
}) {
  const gyroRef = useRef<THREE.Group>(null);
  const ring1Ref = useRef<THREE.Group>(null);
  const ring2Ref = useRef<THREE.Group>(null);
  const floorRef = useRef<THREE.Mesh>(null);

  const floorMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader: planetaryCurvedVertexShader,
      fragmentShader: astrolabeFragmentShader,
      uniforms: { uTime: { value: 0 } },
      transparent: true,
      depthWrite: true,
      side: THREE.DoubleSide,
    });
  }, []);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    floorMaterial.uniforms.uTime.value = t;

    const pp = playerPos.current;
    if (floorRef.current) {
      floorRef.current.position.set(pp.x, -0.01, pp.z);
    }
    if (gyroRef.current) {
      applyGlobeCurvature(gyroRef.current, 0, 4.6 + Math.sin(t * 0.8) * 0.25, 0, pp);
    }
    if (ring1Ref.current) ring1Ref.current.rotation.y = t * 0.15;
    if (ring2Ref.current) ring2Ref.current.rotation.x = t * 0.22;
  });

  return (
    <group>
      {/* ── Planetary Curved Astrolabe Floor ── */}
      <mesh ref={floorRef} geometry={curvedPlaneGeo} material={floorMaterial} />

      {/* ── Grand Central Chronos Orrery Gyroscope ── */}
      <group ref={gyroRef} position={[0, 4.6, 0]}>
        <mesh>
          <octahedronGeometry args={[1.8, 0]} />
          <meshBasicMaterial color="#fbbf24" wireframe />
        </mesh>
        <mesh>
          <octahedronGeometry args={[1.0, 0]} />
          <meshStandardMaterial
            color="#fef08a"
            emissive="#facc15"
            emissiveIntensity={0.85}
            roughness={0.1}
          />
        </mesh>

        <group ref={ring1Ref}>
          <mesh>
            <torusGeometry args={[3.8, 0.08, 6, 36]} />
            <meshBasicMaterial color="#67e8f9" wireframe />
          </mesh>
        </group>
        <group ref={ring2Ref}>
          <mesh>
            <torusGeometry args={[5.2, 0.08, 6, 36]} />
            <meshBasicMaterial color="#fbbf24" wireframe />
          </mesh>
        </group>
      </group>

      {/* Four Chronos Meridian Obelisks */}
      {[
        [0, 0, -32],
        [32, 0, 0],
        [0, 0, 32],
        [-32, 0, 0],
      ].map(([x, y, z], idx) => (
        <ChronosObelisk key={`obelisk-${idx}`} position={[x, y, z]} playerPos={playerPos} />
      ))}
    </group>
  );
}

function ChronosObelisk({
  position,
  playerPos,
}: {
  position: [number, number, number];
  playerPos: React.MutableRefObject<THREE.Vector3>;
}) {
  const ref = useRef<THREE.Group>(null);
  useFrame(() => {
    if (ref.current) {
      applyGlobeCurvature(ref.current, position[0], 0, position[2], playerPos.current);
    }
  });

  return (
    <group ref={ref}>
      <mesh position={[0, 5, 0]}>
        <boxGeometry args={[1.2, 10, 1.2]} />
        <meshStandardMaterial
          color="#0d0524"
          metalness={0.85}
          roughness={0.18}
          emissive="#fbbf24"
          emissiveIntensity={0.3}
        />
      </mesh>
      <mesh position={[0, 5, 0]}>
        <boxGeometry args={[1.22, 10.02, 1.22]} />
        <meshBasicMaterial color="#facc15" wireframe transparent opacity={0.7} />
      </mesh>
      <mesh position={[0, 10.8, 0]}>
        <octahedronGeometry args={[0.75, 0]} />
        <meshBasicMaterial color="#67e8f9" wireframe />
      </mesh>
    </group>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. THE 4 SEASONS CHAMBERS (HIGH-COMPLEXITY BESPOKE BIOMES)
// ─────────────────────────────────────────────────────────────────────────────

// ── 2A: Winter Season Chamber (Boreal Glacial Spire & Aurora) ──
const glacialFragmentShader = `
  varying vec2 vWorldXZ;
  varying vec2 vLocalXZ;
  uniform float uTime;

  void main() {
    float dist = length(vWorldXZ);
    float fade = 1.0 - smoothstep(70.0, 160.0, dist);

    // Cyan frost lattice fissures
    vec2 frostCoord = vWorldXZ * 0.18;
    vec2 fGrid = abs(fract(frostCoord - 0.5) - 0.5);
    float fissure = smoothstep(0.04, 0.0, min(fGrid.x, fGrid.y));

    // Hexagonal frost crystals
    float hex = smoothstep(0.4, 0.0, abs(fract(dist * 0.08 + uTime * 0.02) - 0.5));

    vec3 iceDeep = vec3(0.01, 0.06, 0.15);
    vec3 iceCyan = vec3(0.22, 0.83, 0.95);
    vec3 frostWhite = vec3(0.85, 0.95, 1.0);

    vec3 color = iceDeep;
    color += iceCyan * fissure * 0.85;
    color += frostWhite * hex * 0.35;

    gl_FragColor = vec4(color, fade * 0.92);
  }
`;

export function WinterSeasonEnvironment({
  playerPos,
}: {
  playerPos: React.MutableRefObject<THREE.Vector3>;
}) {
  const floorRef = useRef<THREE.Mesh>(null);
  const floorMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader: planetaryCurvedVertexShader,
      fragmentShader: glacialFragmentShader,
      uniforms: { uTime: { value: 0 } },
      transparent: true,
      depthWrite: true,
      side: THREE.DoubleSide,
    });
  }, []);

  useFrame(({ clock }) => {
    floorMaterial.uniforms.uTime.value = clock.elapsedTime;
    if (floorRef.current) {
      floorRef.current.position.set(playerPos.current.x, -0.01, playerPos.current.z);
    }
  });

  return (
    <group>
      <mesh ref={floorRef} geometry={curvedPlaneGeo} material={floorMaterial} />

      {/* 12 Towering Glacial Needle Crystals with Curved Alignment */}
      {[...Array(12)].map((_, i) => {
        const angle = (i / 12) * Math.PI * 2;
        const r = 28;
        return (
          <GlacialNeedleSpire
            key={i}
            position={[Math.cos(angle) * r, 0, Math.sin(angle) * r]}
            height={8 + (i % 3) * 3}
            playerPos={playerPos}
          />
        );
      })}
    </group>
  );
}

function GlacialNeedleSpire({
  position,
  height,
  playerPos,
}: {
  position: [number, number, number];
  height: number;
  playerPos: React.MutableRefObject<THREE.Vector3>;
}) {
  const ref = useRef<THREE.Group>(null);
  useFrame(() => {
    if (ref.current) {
      applyGlobeCurvature(ref.current, position[0], 0, position[2], playerPos.current);
    }
  });

  return (
    <group ref={ref}>
      <mesh position={[0, height * 0.5, 0]}>
        <cylinderGeometry args={[0.1, 0.9, height, 5]} />
        <meshStandardMaterial
          color="#042340"
          metalness={0.92}
          roughness={0.08}
          emissive="#0284c7"
          emissiveIntensity={0.55}
          transparent
          opacity={0.82}
        />
      </mesh>
      <mesh position={[0, height * 0.5, 0]}>
        <cylinderGeometry args={[0.12, 0.92, height + 0.02, 5]} />
        <meshBasicMaterial color="#7dd3fc" wireframe transparent opacity={0.65} />
      </mesh>
    </group>
  );
}

// ── 2B: Spring Season Chamber (Vernal Blossom & Bamboo Sanctum) ──
const vernalFragmentShader = `
  varying vec2 vWorldXZ;
  varying vec2 vLocalXZ;
  uniform float uTime;

  void main() {
    float dist = length(vWorldXZ);
    float fade = 1.0 - smoothstep(70.0, 160.0, dist);

    // Vernal ripples and moss mandala
    float ripple = smoothstep(0.4, 0.0, abs(fract(dist * 0.07 - uTime * 0.03) - 0.5));
    float spiral = smoothstep(0.04, 0.0, abs(fract(atan(vWorldXZ.y, vWorldXZ.x) * 1.91 - dist * 0.02) - 0.5));

    vec3 mossBase = vec3(0.01, 0.09, 0.04);
    vec3 emeraldMint = vec3(0.2, 0.83, 0.6);
    vec3 sakuraPink = vec3(0.96, 0.45, 0.71);

    vec3 color = mossBase;
    color += emeraldMint * ripple * 0.6;
    color += sakuraPink * spiral * 0.35;

    gl_FragColor = vec4(color, fade * 0.92);
  }
`;

export function SpringSeasonEnvironment({
  playerPos,
}: {
  playerPos: React.MutableRefObject<THREE.Vector3>;
}) {
  const floorRef = useRef<THREE.Mesh>(null);
  const floorMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader: planetaryCurvedVertexShader,
      fragmentShader: vernalFragmentShader,
      uniforms: { uTime: { value: 0 } },
      transparent: true,
      depthWrite: true,
      side: THREE.DoubleSide,
    });
  }, []);

  useFrame(({ clock }) => {
    floorMaterial.uniforms.uTime.value = clock.elapsedTime;
    if (floorRef.current) {
      floorRef.current.position.set(playerPos.current.x, -0.01, playerPos.current.z);
    }
  });

  return (
    <group>
      <mesh ref={floorRef} geometry={curvedPlaneGeo} material={floorMaterial} />

      {/* Arched Bamboo Pillars with Emerald Nodes */}
      {[...Array(12)].map((_, i) => {
        const angle = (i / 12) * Math.PI * 2;
        const r = 28;
        return (
          <BambooPavilionPillar
            key={i}
            position={[Math.cos(angle) * r, 0, Math.sin(angle) * r]}
            playerPos={playerPos}
          />
        );
      })}
    </group>
  );
}

function BambooPavilionPillar({
  position,
  playerPos,
}: {
  position: [number, number, number];
  playerPos: React.MutableRefObject<THREE.Vector3>;
}) {
  const ref = useRef<THREE.Group>(null);
  useFrame(() => {
    if (ref.current) {
      applyGlobeCurvature(ref.current, position[0], 0, position[2], playerPos.current);
    }
  });

  return (
    <group ref={ref}>
      <mesh position={[0, 6, 0]}>
        <cylinderGeometry args={[0.25, 0.4, 12, 6]} />
        <meshStandardMaterial
          color="#064e3b"
          emissive="#10b981"
          emissiveIntensity={0.45}
        />
      </mesh>
      <mesh position={[0, 6, 0]}>
        <cylinderGeometry args={[0.27, 0.42, 12.02, 6]} />
        <meshBasicMaterial color="#6ee7b7" wireframe transparent opacity={0.65} />
      </mesh>
      <mesh position={[0, 12.4, 0]}>
        <tetrahedronGeometry args={[0.6, 0]} />
        <meshBasicMaterial color="#f472b6" wireframe />
      </mesh>
    </group>
  );
}

// ── 2C: Summer Season Chamber (Solar Zenith & Sunstone Citadel) ──
const solarFragmentShader = `
  varying vec2 vWorldXZ;
  varying vec2 vLocalXZ;
  uniform float uTime;

  void main() {
    float dist = length(vWorldXZ);
    float fade = 1.0 - smoothstep(70.0, 160.0, dist);

    // Radiating 16-point geometric solar sunrays
    float angle = atan(vWorldXZ.y, vWorldXZ.x);
    float ray = smoothstep(0.03, 0.0, abs(fract(angle * 2.546 + uTime * 0.02) - 0.5));

    // Concentric solar rings
    float ring = smoothstep(0.35, 0.0, abs(fract(dist * 0.09) - 0.5));

    vec3 bronzeBase = vec3(0.09, 0.04, 0.01);
    vec3 gold = vec3(0.98, 0.8, 0.1);
    vec3 solarOrange = vec3(0.98, 0.45, 0.08);

    vec3 color = bronzeBase;
    color += gold * ray * 0.7;
    color += solarOrange * ring * 0.5;

    gl_FragColor = vec4(color, fade * 0.92);
  }
`;

export function SummerSeasonEnvironment({
  playerPos,
}: {
  playerPos: React.MutableRefObject<THREE.Vector3>;
}) {
  const floorRef = useRef<THREE.Mesh>(null);
  const floorMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader: planetaryCurvedVertexShader,
      fragmentShader: solarFragmentShader,
      uniforms: { uTime: { value: 0 } },
      transparent: true,
      depthWrite: true,
      side: THREE.DoubleSide,
    });
  }, []);

  useFrame(({ clock }) => {
    floorMaterial.uniforms.uTime.value = clock.elapsedTime;
    if (floorRef.current) {
      floorRef.current.position.set(playerPos.current.x, -0.01, playerPos.current.z);
    }
  });

  return (
    <group>
      <mesh ref={floorRef} geometry={curvedPlaneGeo} material={floorMaterial} />

      {/* 8 Sunstone Obelisks with Rotating Solar Shields */}
      {[...Array(8)].map((_, i) => {
        const angle = (i / 8) * Math.PI * 2;
        const r = 28;
        return (
          <SunstoneObelisk
            key={i}
            position={[Math.cos(angle) * r, 0, Math.sin(angle) * r]}
            playerPos={playerPos}
          />
        );
      })}
    </group>
  );
}

function SunstoneObelisk({
  position,
  playerPos,
}: {
  position: [number, number, number];
  playerPos: React.MutableRefObject<THREE.Vector3>;
}) {
  const ref = useRef<THREE.Group>(null);
  const shieldRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (ref.current) {
      applyGlobeCurvature(ref.current, position[0], 0, position[2], playerPos.current);
    }
    if (shieldRef.current) {
      shieldRef.current.rotation.z = clock.elapsedTime * 0.35;
    }
  });

  return (
    <group ref={ref}>
      <mesh position={[0, 5.5, 0]}>
        <cylinderGeometry args={[0.35, 0.85, 11, 4]} />
        <meshStandardMaterial
          color="#3d1502"
          emissive="#f59e0b"
          emissiveIntensity={0.55}
          roughness={0.15}
        />
      </mesh>
      <mesh position={[0, 5.5, 0]}>
        <cylinderGeometry args={[0.37, 0.87, 11.02, 4]} />
        <meshBasicMaterial color="#fbbf24" wireframe transparent opacity={0.7} />
      </mesh>
      <mesh ref={shieldRef} position={[0, 11.2, 0]}>
        <dodecahedronGeometry args={[0.75, 0]} />
        <meshBasicMaterial color="#fde047" wireframe />
      </mesh>
    </group>
  );
}

// ── 2D: Autumn Season Chamber (Obsidian Harvest Henge & Witchfire) ──
const autumnFragmentShader = `
  varying vec2 vWorldXZ;
  varying vec2 vLocalXZ;
  uniform float uTime;

  void main() {
    float dist = length(vWorldXZ);
    float fade = 1.0 - smoothstep(70.0, 160.0, dist);

    // Obsidian basalt polygonal cracks
    vec2 bCoord = vWorldXZ * 0.12;
    vec2 bGrid = abs(fract(bCoord - 0.5) - 0.5);
    float lavaVein = smoothstep(0.04, 0.0, min(bGrid.x, bGrid.y));

    // Runic concentric rings
    float rune = smoothstep(0.4, 0.0, abs(fract(dist * 0.08) - 0.5));

    vec3 obsidianBase = vec3(0.06, 0.01, 0.09);
    vec3 amethyst = vec3(0.75, 0.52, 0.98);
    vec3 copperOrange = vec3(0.96, 0.45, 0.1);

    vec3 color = obsidianBase;
    color += copperOrange * lavaVein * 0.8;
    color += amethyst * rune * 0.45;

    gl_FragColor = vec4(color, fade * 0.92);
  }
`;

export function AutumnSeasonEnvironment({
  playerPos,
}: {
  playerPos: React.MutableRefObject<THREE.Vector3>;
}) {
  const floorRef = useRef<THREE.Mesh>(null);
  const floorMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader: planetaryCurvedVertexShader,
      fragmentShader: autumnFragmentShader,
      uniforms: { uTime: { value: 0 } },
      transparent: true,
      depthWrite: true,
      side: THREE.DoubleSide,
    });
  }, []);

  useFrame(({ clock }) => {
    floorMaterial.uniforms.uTime.value = clock.elapsedTime;
    if (floorRef.current) {
      floorRef.current.position.set(playerPos.current.x, -0.01, playerPos.current.z);
    }
  });

  return (
    <group>
      <mesh ref={floorRef} geometry={curvedPlaneGeo} material={floorMaterial} />

      {/* 10 Weathered Obsidian Dolmens (Stonehenge-style Runic Henge) */}
      {[...Array(10)].map((_, i) => {
        const angle = (i / 10) * Math.PI * 2;
        const r = 28;
        return (
          <ObsidianDolmen
            key={i}
            position={[Math.cos(angle) * r, 0, Math.sin(angle) * r]}
            playerPos={playerPos}
          />
        );
      })}
    </group>
  );
}

function ObsidianDolmen({
  position,
  playerPos,
}: {
  position: [number, number, number];
  playerPos: React.MutableRefObject<THREE.Vector3>;
}) {
  const ref = useRef<THREE.Group>(null);
  useFrame(() => {
    if (ref.current) {
      applyGlobeCurvature(ref.current, position[0], 0, position[2], playerPos.current);
    }
  });

  return (
    <group ref={ref}>
      <mesh position={[0, 5, 0]}>
        <boxGeometry args={[1.3, 10, 1.3]} />
        <meshStandardMaterial
          color="#220b3b"
          emissive="#7c3aed"
          emissiveIntensity={0.4}
          roughness={0.25}
        />
      </mesh>
      <mesh position={[0, 5, 0]}>
        <boxGeometry args={[1.32, 10.02, 1.32]} />
        <meshBasicMaterial color="#e879f9" wireframe transparent opacity={0.6} />
      </mesh>
      <mesh position={[0, 10.6, 0]}>
        <icosahedronGeometry args={[0.7, 0]} />
        <meshBasicMaterial color="#fb923c" wireframe />
      </mesh>
    </group>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. THE 12 MONTH CHAMBERS (EXPANDED SCALE WITH PLANETARY CURVED FLOORS)
// ─────────────────────────────────────────────────────────────────────────────

interface MonthPaletteDef {
  bg: string;
  fog: string;
  primary: string;
  accent: string;
  floorTile: string;
}

export const MONTH_AESTHETICS: MonthPaletteDef[] = [
  // 0: JAN — Boreal Frost Crystal
  { bg: '#020817', fog: '#031a38', primary: '#38bdf8', accent: '#bae6fd', floorTile: '#03122b' },
  // 1: FEB — Amethyst Thaw
  { bg: '#160228', fog: '#2a054d', primary: '#c084fc', accent: '#f472b6', floorTile: '#1d0436' },
  // 2: MAR — Vernal Mist
  { bg: '#021a12', fog: '#053324', primary: '#34d399', accent: '#fde047', floorTile: '#04261b' },
  // 3: APR — Sakura Quartz
  { bg: '#1f0418', fog: '#3b082e', primary: '#f472b6', accent: '#fbcfe8', floorTile: '#26061e' },
  // 4: MAY — Emerald Canopy
  { bg: '#011f0c', fog: '#043b17', primary: '#22c55e', accent: '#86efac', floorTile: '#02260f' },
  // 5: JUN — Solstice Amber
  { bg: '#211300', fog: '#422600', primary: '#facc15', accent: '#fb923c', floorTile: '#2e1b00' },
  // 6: JUL — Heliotrope Sun
  { bg: '#1a0033', fog: '#360069', primary: '#a855f7', accent: '#22d3ee', floorTile: '#240047' },
  // 7: AUG — Late Summer Copper
  { bg: '#240a02', fog: '#451405', primary: '#ea580c', accent: '#fde047', floorTile: '#300e04' },
  // 8: SEP — Equinox Indigo
  { bg: '#0b0e2b', fog: '#171c54', primary: '#818cf8', accent: '#fbbf24', floorTile: '#10143d' },
  // 9: OCT — Obsidian Harvest
  { bg: '#14011c', fog: '#2c033d', primary: '#c084fc', accent: '#fb923c', floorTile: '#1c0226' },
  // 10: NOV — Frostfire Crimson
  { bg: '#240303', fog: '#470707', primary: '#dc2626', accent: '#fca5a5', floorTile: '#300505' },
  // 11: DEC — Starlight Evergreen
  { bg: '#011714', fog: '#032e28', primary: '#14b8a6', accent: '#ffffff', floorTile: '#02211d' },
];

const monthFragmentShader = `
  varying vec2 vWorldXZ;
  varying vec2 vLocalXZ;
  uniform float uTime;
  uniform vec3 uPrimary;
  uniform vec3 uAccent;
  uniform vec3 uBase;

  void main() {
    float dist = length(vWorldXZ);
    float fade = 1.0 - smoothstep(80.0, 160.0, dist);

    // Expanded Day Portal Guide Halo Ring at R = 28.0
    float dayHalo = smoothstep(0.45, 0.0, abs(dist - 28.0));

    // Outer & Inner concentric rhythm rings
    float ring14 = smoothstep(0.35, 0.0, abs(dist - 14.0));
    float ring42 = smoothstep(0.4, 0.0, abs(dist - 42.0));

    // Radial 31-day tick marks
    float angle = atan(vWorldXZ.y, vWorldXZ.x);
    float tick = smoothstep(0.02, 0.0, abs(fract(angle * 4.9338) - 0.5)) * smoothstep(26.0, 27.5, dist) * smoothstep(30.0, 28.5, dist);

    vec3 color = uBase;
    color += uPrimary * dayHalo * 0.85;
    color += uAccent * (ring14 + ring42) * 0.4;
    color += uPrimary * tick * 0.7;

    gl_FragColor = vec4(color, fade * 0.9);
  }
`;

export function MonthChamberEnvironment({
  monthIndex,
  playerPos,
}: {
  monthIndex: number;
  playerPos: React.MutableRefObject<THREE.Vector3>;
}) {
  const normM = ((monthIndex % 12) + 12) % 12;
  const p = MONTH_AESTHETICS[normM];
  const floorRef = useRef<THREE.Mesh>(null);

  const floorMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader: planetaryCurvedVertexShader,
      fragmentShader: monthFragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uPrimary: { value: new THREE.Color(p.primary) },
        uAccent: { value: new THREE.Color(p.accent) },
        uBase: { value: new THREE.Color(p.floorTile) },
      },
      transparent: true,
      depthWrite: true,
      side: THREE.DoubleSide,
    });
  }, [p]);

  useFrame(({ clock }) => {
    floorMaterial.uniforms.uTime.value = clock.elapsedTime;
    if (floorRef.current) {
      floorRef.current.position.set(playerPos.current.x, -0.01, playerPos.current.z);
    }
  });

  return (
    <group>
      {/* ── Planetary Curved Month Floor ── */}
      <mesh ref={floorRef} geometry={curvedPlaneGeo} material={floorMaterial} />

      {/* 8 Expanded Perimeter Spires at R = 36.0 (Framing Day Portal Ring at R = 28.0) */}
      {[...Array(8)].map((_, i) => {
        const angle = (i / 8) * Math.PI * 2;
        const r = 36;
        return (
          <MonthPerimeterSpire
            key={i}
            position={[Math.cos(angle) * r, 0, Math.sin(angle) * r]}
            primaryColor={p.primary}
            accentColor={p.accent}
            baseColor={p.floorTile}
            playerPos={playerPos}
          />
        );
      })}
    </group>
  );
}

function MonthPerimeterSpire({
  position,
  primaryColor,
  accentColor,
  baseColor,
  playerPos,
}: {
  position: [number, number, number];
  primaryColor: string;
  accentColor: string;
  baseColor: string;
  playerPos: React.MutableRefObject<THREE.Vector3>;
}) {
  const ref = useRef<THREE.Group>(null);
  useFrame(() => {
    if (ref.current) {
      applyGlobeCurvature(ref.current, position[0], 0, position[2], playerPos.current);
    }
  });

  return (
    <group ref={ref}>
      <mesh position={[0, 4.5, 0]}>
        <cylinderGeometry args={[0.3, 0.55, 9, 6]} />
        <meshStandardMaterial
          color={baseColor}
          emissive={primaryColor}
          emissiveIntensity={0.4}
        />
      </mesh>
      <mesh position={[0, 4.5, 0]}>
        <cylinderGeometry args={[0.32, 0.57, 9.02, 6]} />
        <meshBasicMaterial color={accentColor} wireframe transparent opacity={0.65} />
      </mesh>
      <mesh position={[0, 9.4, 0]}>
        <octahedronGeometry args={[0.55, 0]} />
        <meshBasicMaterial color={primaryColor} wireframe />
      </mesh>
    </group>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MASTER FRACTAL CHAMBER ENVIRONMENT SWITCHER
// ─────────────────────────────────────────────────────────────────────────────

export function FractalChamberAtmosphere({
  chamber,
  playerPos,
}: {
  chamber: Chamber;
  playerPos: React.MutableRefObject<THREE.Vector3>;
}) {
  const aesthetic = useMemo(() => getChamberAesthetic(chamber), [chamber]);

  if (aesthetic.category === 'year') {
    return <YearChamberEnvironment playerPos={playerPos} />;
  }

  if (aesthetic.category === 'season') {
    const s = aesthetic.seasonIndex ?? 0;
    if (s === 0) return <WinterSeasonEnvironment playerPos={playerPos} />;
    if (s === 1) return <SpringSeasonEnvironment playerPos={playerPos} />;
    if (s === 2) return <SummerSeasonEnvironment playerPos={playerPos} />;
    return <AutumnSeasonEnvironment playerPos={playerPos} />;
  }

  if (aesthetic.category === 'month') {
    return (
      <MonthChamberEnvironment
        monthIndex={aesthetic.monthIndex ?? 0}
        playerPos={playerPos}
      />
    );
  }

  // 'sanctuary' (Day Chamber & Hub) returns null so RebuiltWorld's default sanctuary architecture renders!
  return null;
}
