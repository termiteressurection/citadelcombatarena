import { useRef, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

/*
  Synthwave parallax horizon — surrounds the chamber on all sides.
  Mountains, sun, moon, planets, comets, aurora, infinite grid.
*/

const CYAN = 0x44ddff;
const HOT_PINK = 0xff44aa;
const PURPLE = 0xaa44ff;
const DEEP_BLUE = 0x0a0a2e;
const SUN_ORANGE = 0xff6633;
const SUN_PINK = 0xff4488;
const NEON_GREEN = 0x44ff88;
const CORAL = 0xff6677;
const GOLD = 0xffaa33;
const HILL_INK = 0x14203f;
const HILL_NEON = 0x2ad1ff;
const HILL_MAGENTA = 0xff4fd8;

// ─── Synthwave Sun ────────────────────────────────────────
function SynthwaveSun() {
  const ref = useRef<THREE.Group>(null);
  const haloRef = useRef<THREE.Mesh>(null);
  const coreRef = useRef<THREE.Mesh>(null);
  const { camera } = useThree();
  const slices = useMemo(() => {
    const geos: THREE.BufferGeometry[] = [];
    const r = 22;
    for (let i = 1; i <= 12; i++) {
      const y = -r + (i / 13) * 2 * r;
      const hw = Math.sqrt(Math.max(r * r - y * y, 0));
      geos.push(new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-hw, y, 0), new THREE.Vector3(hw, y, 0),
      ]));
    }
    return geos;
  }, []);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    ref.current.position.x = camera.position.x * 0.01;
    ref.current.position.z = camera.position.z * 0.01 - 220;
    ref.current.position.y = 18 + Math.sin(clock.elapsedTime * 0.11) * 1.4;
    if (haloRef.current) {
      haloRef.current.rotation.z = clock.elapsedTime * 0.08;
      haloRef.current.scale.setScalar(1 + Math.sin(clock.elapsedTime * 0.55) * 0.05);
      (haloRef.current.material as THREE.MeshBasicMaterial).opacity = 0.09 + Math.sin(clock.elapsedTime * 0.9) * 0.03;
    }
    if (coreRef.current) {
      coreRef.current.scale.setScalar(1 + Math.sin(clock.elapsedTime * 1.1) * 0.025);
    }
  });
  return (
    <group ref={ref} position={[0, 18, 0]}>
      <mesh ref={haloRef}><circleGeometry args={[30, 32]} /><meshBasicMaterial color={SUN_PINK} transparent opacity={0.08} side={THREE.DoubleSide} /></mesh>
      <mesh ref={coreRef} position={[0, 0, 0.1]}><circleGeometry args={[22, 32]} /><meshStandardMaterial color={0x110022} emissive={SUN_PINK} emissiveIntensity={0.9} transparent opacity={0.6} side={THREE.DoubleSide} /></mesh>
      <mesh position={[0, 0, 0.2]}><circleGeometry args={[14, 32]} /><meshStandardMaterial color={SUN_ORANGE} emissive={SUN_ORANGE} emissiveIntensity={1.8} transparent opacity={0.35} side={THREE.DoubleSide} /></mesh>
      {slices.map((geo, i) => (
        // @ts-expect-error R3F line
        <line key={i} geometry={geo} position={[0, 0, 0.3]}><lineBasicMaterial color={0x110022} transparent opacity={0.85} /></line>
      ))}
    </group>
  );
}

function SunPulseRing({ radius, width, color, offset, speed, parallax }: {
  radius: number;
  width: number;
  color: number;
  offset: number;
  speed: number;
  parallax: number;
}) {
  const ref = useRef<THREE.Mesh>(null);
  const { camera } = useThree();
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.elapsedTime * speed + offset;
    ref.current.position.x = camera.position.x * parallax;
    ref.current.position.y = 18 + Math.sin(clock.elapsedTime * 0.11) * 1.4;
    ref.current.position.z = camera.position.z * parallax - 219.5;
    ref.current.scale.setScalar(1 + Math.sin(t) * 0.08);
    ref.current.rotation.z = t * 0.22;
    (ref.current.material as THREE.MeshBasicMaterial).opacity = 0.16 + Math.sin(t * 1.35) * 0.06;
  });
  return (
    <mesh ref={ref}>
      <ringGeometry args={[radius, radius + width, 48]} />
      <meshBasicMaterial color={color} transparent opacity={0.18} side={THREE.DoubleSide} />
    </mesh>
  );
}

// ─── Crescent Moon ────────────────────────────────────────
function CrescentMoon() {
  const ref = useRef<THREE.Group>(null);
  const { camera } = useThree();
  useFrame(({ clock }) => {
    if (!ref.current) return;
    ref.current.position.x = camera.position.x * 0.03 + 60;
    ref.current.position.z = camera.position.z * 0.03 - 200;
    ref.current.position.y = 45 + Math.sin(clock.elapsedTime * 0.1) * 2;
  });
  return (
    <group ref={ref}>
      <mesh><circleGeometry args={[4, 24]} /><meshStandardMaterial color={0xeeeeff} emissive={0xccccff} emissiveIntensity={1.2} side={THREE.DoubleSide} /></mesh>
      <mesh position={[1.8, 0.8, 0.1]}><circleGeometry args={[3.5, 24]} /><meshBasicMaterial color={0x060812} side={THREE.DoubleSide} /></mesh>
    </group>
  );
}

// ─── Neon Planet ──────────────────────────────────────────
function NeonPlanet({ basePos, radius, color, emissive, ringColor, parallax, orbitSpeed }: {
  basePos: [number, number, number]; radius: number; color: number; emissive: number;
  ringColor?: number; parallax: number; orbitSpeed: number;
}) {
  const ref = useRef<THREE.Group>(null);
  const { camera } = useThree();
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.elapsedTime * orbitSpeed;
    ref.current.position.x = camera.position.x * parallax + basePos[0] + Math.sin(t) * 3;
    ref.current.position.y = basePos[1] + Math.cos(t * 0.7) * 2;
    ref.current.position.z = camera.position.z * parallax + basePos[2];
    ref.current.rotation.z = t * 0.3;
    ref.current.rotation.y = t * 0.14;
  });
  return (
    <group ref={ref}>
      <mesh><sphereGeometry args={[radius, 12, 12]} /><meshStandardMaterial color={color} emissive={emissive} emissiveIntensity={0.6} wireframe /></mesh>
      {[0.3, 0.5, 0.7].map((frac) => {
        const y = (frac - 0.5) * 2 * radius;
        const rr = Math.sqrt(Math.max(radius * radius - y * y, 0));
        return (
          <mesh key={frac} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <ringGeometry args={[rr - 0.05, rr + 0.05, 16]} />
            <meshBasicMaterial color={emissive} transparent opacity={0.4} side={THREE.DoubleSide} />
          </mesh>
        );
      })}
      {ringColor && (
        <mesh rotation={[1.2, 0.3, 0]}><torusGeometry args={[radius * 1.6, 0.12, 6, 32]} /><meshStandardMaterial color={ringColor} emissive={ringColor} emissiveIntensity={1.0} wireframe transparent opacity={0.7} /></mesh>
      )}
    </group>
  );
}

// ─── Shooting Comet ───────────────────────────────────────
function Comet({ startX, startY, speed, angle, color }: {
  startX: number; startY: number; speed: number; angle: number; color: number;
}) {
  const ref = useRef<THREE.Group>(null);
  const { camera } = useThree();
  const tailGeo = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 20; i++) pts.push(new THREE.Vector3(-i / 20 * 12, 0, 0));
    return new THREE.BufferGeometry().setFromPoints(pts);
  }, []);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const cycle = (clock.elapsedTime * speed) % 120;
    ref.current.position.x = camera.position.x * 0.02 + startX + Math.cos(angle) * cycle;
    ref.current.position.y = startY + Math.sin(angle) * cycle;
    ref.current.position.z = camera.position.z * 0.02 - 190;
    ref.current.rotation.z = angle;
    ref.current.scale.setScalar(0.88 + Math.sin(clock.elapsedTime * speed * 0.25 + startX) * 0.08);
  });
  return (
    <group ref={ref}>
      <mesh><sphereGeometry args={[0.5, 6, 6]} /><meshStandardMaterial color={color} emissive={color} emissiveIntensity={2} /></mesh>
      {/* @ts-expect-error R3F line */}
      <line geometry={tailGeo}><lineBasicMaterial color={color} transparent opacity={0.6} /></line>
    </group>
  );
}

function RollingHillBand({ distance, parallax, yOffset, height, color, emissive, seed, facing }: {
  distance: number;
  parallax: number;
  yOffset: number;
  height: number;
  color: number;
  emissive: number;
  seed: number;
  facing: 'north' | 'south' | 'east' | 'west';
}) {
  const ref = useRef<THREE.Group>(null);
  const { camera } = useThree();
  const { shape, outlineGeo } = useMemo(() => {
    const points: THREE.Vector2[] = [];
    const width = 360;
    const segments = 28;
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const x = (t - 0.5) * width;
      const swellA = Math.sin(t * Math.PI * 2 + seed) * 0.18;
      const swellB = Math.sin(t * Math.PI * 5 + seed * 0.7) * 0.08;
      const base = Math.sin(t * Math.PI) ** 0.8;
      const y = height * (0.62 + swellA + swellB) * base + 5;
      points.push(new THREE.Vector2(x, y));
    }
    points.push(new THREE.Vector2(width / 2, -12));
    points.push(new THREE.Vector2(-width / 2, -12));
    const hillShape = new THREE.Shape(points);
    const outline = new THREE.BufferGeometry().setFromPoints(points.slice(0, -2).map(p => new THREE.Vector3(p.x, p.y, 0)));
    return { shape: hillShape, outlineGeo: outline };
  }, [height, seed]);

  const rotation = useMemo((): [number, number, number] => {
    switch (facing) {
      case 'north': return [0, 0, 0];
      case 'south': return [0, Math.PI, 0];
      case 'east': return [0, -Math.PI / 2, 0];
      case 'west': return [0, Math.PI / 2, 0];
    }
  }, [facing]);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const px = camera.position.x * parallax;
    const pz = camera.position.z * parallax;
    const drift = Math.sin(clock.elapsedTime * 0.14 + seed) * 5.5;
    const lift = Math.sin(clock.elapsedTime * 0.22 + seed * 1.7) * 1.8;
    switch (facing) {
      case 'north': ref.current.position.set(px + drift, yOffset + lift, pz - distance); break;
      case 'south': ref.current.position.set(px - drift, yOffset + lift, pz + distance); break;
      case 'east': ref.current.position.set(px + distance, yOffset + lift, pz + drift); break;
      case 'west': ref.current.position.set(px - distance, yOffset + lift, pz - drift); break;
    }
  });

  return (
    <group ref={ref} rotation={rotation}>
      <mesh>
        <shapeGeometry args={[shape]} />
        <meshStandardMaterial color={color} emissive={emissive} emissiveIntensity={0.2} transparent opacity={0.92} side={THREE.DoubleSide} />
      </mesh>
      {/* @ts-expect-error R3F line */}
      <line geometry={outlineGeo}>
        <lineBasicMaterial color={emissive} transparent opacity={0.55} />
      </line>
    </group>
  );
}

// ─── Mountain Range ───────────────────────────────────────
function makeMountainProfile(width: number, peaks: number, maxH: number, jaggedness: number, seed: number): THREE.Vector2[] {
  const pts: THREE.Vector2[] = [];
  const segs = peaks * 8;
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const x = (t - 0.5) * width;
    const s1 = Math.sin(t * peaks * Math.PI + seed) * 0.5 + 0.5;
    const s2 = Math.sin(t * peaks * 2.7 * Math.PI + seed * 1.3) * 0.3;
    const s3 = Math.sin(t * peaks * 5.1 * Math.PI + seed * 2.1) * jaggedness;
    const envelope = Math.sin(t * Math.PI) ** 0.4;
    const y = (s1 + s2 + s3) * maxH * envelope;
    pts.push(new THREE.Vector2(x, Math.max(y, 0)));
  }
  pts.push(new THREE.Vector2(width / 2, 0));
  pts.push(new THREE.Vector2(-width / 2, 0));
  return pts;
}

function MountainRange({ distance, parallax, width, peaks, maxHeight, jaggedness, seed, emissive, yOffset, facing }: {
  distance: number; parallax: number; width: number; peaks: number;
  maxHeight: number; jaggedness: number; seed: number;
  emissive: number; yOffset: number; facing: 'north' | 'south' | 'east' | 'west';
}) {
  const ref = useRef<THREE.Group>(null);
  const { camera } = useThree();
  const { shape, outlineGeo } = useMemo(() => {
    const pts = makeMountainProfile(width, peaks, maxHeight, jaggedness, seed);
    const s = new THREE.Shape();
    s.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) s.lineTo(pts[i].x, pts[i].y);
    s.closePath();
    const vecs = pts.slice(0, -2).map(p => new THREE.Vector3(p.x, p.y, 0));
    return { shape: s, outlineGeo: new THREE.BufferGeometry().setFromPoints(vecs) };
  }, [width, peaks, maxHeight, jaggedness, seed]);

  const rot = useMemo((): [number, number, number] => {
    switch (facing) {
      case 'north': return [0, 0, 0];
      case 'south': return [0, Math.PI, 0];
      case 'east': return [0, -Math.PI / 2, 0];
      case 'west': return [0, Math.PI / 2, 0];
    }
  }, [facing]);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const px = camera.position.x * parallax;
    const pz = camera.position.z * parallax;
    const wave = Math.sin(clock.elapsedTime * 0.1 + seed * 0.8) * 1.6;
    switch (facing) {
      case 'north': ref.current.position.set(px, yOffset + wave, pz - distance); break;
      case 'south': ref.current.position.set(px, yOffset + wave, pz + distance); break;
      case 'east':  ref.current.position.set(px + distance, yOffset + wave, pz); break;
      case 'west':  ref.current.position.set(px - distance, yOffset + wave, pz); break;
    }
  });

  return (
    <group ref={ref} rotation={rot}>
      <mesh>
        <shapeGeometry args={[shape]} />
        <meshStandardMaterial color={DEEP_BLUE} emissive={emissive} emissiveIntensity={0.25} transparent opacity={0.7} side={THREE.DoubleSide} />
      </mesh>
      {/* @ts-expect-error R3F line */}
      <line geometry={outlineGeo}><lineBasicMaterial color={emissive} transparent opacity={0.8} /></line>
    </group>
  );
}

// ─── Dark Pyramids ────────────────────────────────────────
function NeonPyramid({ position, scale, edgeColor, parallax, facing }: {
  position: [number, number, number]; scale: number; edgeColor: number; parallax: number;
  facing: 'north' | 'south' | 'east' | 'west';
}) {
  const ref = useRef<THREE.Group>(null);
  const { camera } = useThree();
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const px = camera.position.x * parallax;
    const pz = camera.position.z * parallax;
    const d = 140;
    ref.current.rotation.y = Math.sin(clock.elapsedTime * 0.16 + scale) * 0.08;
    switch (facing) {
      case 'north': ref.current.position.set(px + position[0], position[1], pz - d + position[2]); break;
      case 'south': ref.current.position.set(px + position[0], position[1], pz + d + position[2]); break;
      case 'east':  ref.current.position.set(px + d + position[0], position[1], pz + position[2]); break;
      case 'west':  ref.current.position.set(px - d + position[0], position[1], pz + position[2]); break;
    }
  });
  return (
    <group ref={ref}>
      <mesh scale={[scale, scale * 1.8, scale]}><coneGeometry args={[1, 2, 4]} /><meshStandardMaterial color={0x0a0a1e} emissive={edgeColor} emissiveIntensity={0.15} /></mesh>
      <mesh scale={[scale, scale * 1.8, scale]}><coneGeometry args={[1, 2, 4]} /><meshBasicMaterial color={edgeColor} wireframe transparent opacity={0.5} /></mesh>
    </group>
  );
}

// ─── Aurora Glow Bands ────────────────────────────────────
function AuroraBand({ yPos, distance, color, width, height, parallax, speed }: {
  yPos: number; distance: number; color: number; width: number; height: number; parallax: number; speed: number;
}) {
  const ref = useRef<THREE.Mesh>(null);
  const { camera } = useThree();
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.elapsedTime;
    ref.current.position.x = camera.position.x * parallax + Math.sin(t * speed) * 10;
    ref.current.position.y = yPos + Math.sin(t * speed * 0.7 + 1) * 3;
    ref.current.position.z = camera.position.z * parallax - distance;
    ref.current.rotation.z = Math.sin(t * speed * 0.45 + yPos) * 0.06;
    (ref.current.material as THREE.MeshBasicMaterial).opacity = 0.08 + Math.sin(t * speed * 1.5) * 0.04;
  });
  return (
    <mesh ref={ref}>
      <planeGeometry args={[width, height]} />
      <meshBasicMaterial color={color} transparent opacity={0.1} side={THREE.DoubleSide} />
    </mesh>
  );
}

// ─── Horizon Grid (sparse, above floor) ───────────────────
function HorizonGrid() {
  const ref = useRef<THREE.Group>(null);
  const materialRef = useRef<THREE.LineBasicMaterial>(null);
  const { camera } = useThree();
  const gridGeo = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    const w = 400, d = 400, sp = 12;
    for (let z = -d / 2; z <= d / 2; z += sp)
      pts.push(new THREE.Vector3(-w / 2, 0, z), new THREE.Vector3(w / 2, 0, z));
    for (let x = -w / 2; x <= w / 2; x += sp)
      pts.push(new THREE.Vector3(x, 0, -d / 2), new THREE.Vector3(x, 0, d / 2));
    return new THREE.BufferGeometry().setFromPoints(pts);
  }, []);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    ref.current.position.x = camera.position.x;
    ref.current.position.z = camera.position.z;
    ref.current.rotation.y = Math.sin(clock.elapsedTime * 0.06) * 0.04;
    if (materialRef.current) {
      materialRef.current.opacity = 0.08 + Math.sin(clock.elapsedTime * 0.45) * 0.025;
    }
  });
  return (
    <group ref={ref} position={[0, 0.05, 0]}>
      <lineSegments geometry={gridGeo}><lineBasicMaterial ref={materialRef} color={CYAN} transparent opacity={0.08} /></lineSegments>
    </group>
  );
}

function RollingHorizonDisk() {
  const ref = useRef<THREE.Mesh>(null);
  const { camera } = useThree();
  useFrame(({ clock }) => {
    if (!ref.current) return;
    ref.current.position.x = camera.position.x;
    ref.current.position.z = camera.position.z;
    ref.current.rotation.z = Math.sin(clock.elapsedTime * 0.08) * 0.04;
    (ref.current.material as THREE.MeshBasicMaterial).opacity = 0.045 + Math.sin(clock.elapsedTime * 0.35) * 0.015;
  });
  return (
    <mesh ref={ref} position={[0, -0.4, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <circleGeometry args={[155, 64]} />
      <meshBasicMaterial color="#2a1b52" transparent opacity={0.045} side={THREE.DoubleSide} />
    </mesh>
  );
}

// ─── Main Export ──────────────────────────────────────────
export function SynthwaveHorizon() {
  return (
    <group>
      <SynthwaveSun />
      <SunPulseRing radius={26} width={0.55} color={HOT_PINK} offset={0.2} speed={0.7} parallax={0.01} />
      <SunPulseRing radius={32} width={0.45} color={CYAN} offset={1.4} speed={0.56} parallax={0.008} />
      <CrescentMoon />
      <RollingHorizonDisk />

      {/* Aurora — softer and lower so the horizon reads less harshly */}
      <AuroraBand yPos={30} distance={210} color={HOT_PINK} width={280} height={24} parallax={0.02} speed={0.1} />
      <AuroraBand yPos={34} distance={215} color={PURPLE} width={240} height={18} parallax={0.015} speed={0.08} />
      <AuroraBand yPos={25} distance={205} color={CYAN} width={260} height={16} parallax={0.025} speed={0.07} />

      {/* Comets — 2 only */}
      <Comet startX={-40} startY={50} speed={3} angle={-0.3} color={CYAN} />
      <Comet startX={50} startY={55} speed={2.2} angle={-0.4} color={NEON_GREEN} />

      {/* Planets — 2 only */}
      <NeonPlanet basePos={[-55, 32, -180]} radius={6} color={0x992244} emissive={CORAL} ringColor={GOLD} parallax={0.04} orbitSpeed={0.08} />
      <NeonPlanet basePos={[70, 25, -170]} radius={3.5} color={0x224466} emissive={CYAN} parallax={0.05} orbitSpeed={0.12} />

      {/* Rolling hill bands create the softer Animal Crossing-like horizon line */}
      {(['north', 'south', 'east', 'west'] as const).map((dir) => (
        <group key={`hills-${dir}`}>
          <RollingHillBand distance={120} parallax={0.09} yOffset={-2} height={24} color={HILL_INK} emissive={HILL_MAGENTA}
            seed={dir === 'north' ? 1.2 : dir === 'south' ? 2.8 : dir === 'east' ? 4.5 : 6.1} facing={dir} />
          <RollingHillBand distance={92} parallax={0.14} yOffset={-4} height={18} color={0x091120} emissive={HILL_NEON}
            seed={dir === 'north' ? 0.8 : dir === 'south' ? 3.6 : dir === 'east' ? 5.2 : 7.7} facing={dir} />
        </group>
      ))}

      {/* Mountains — pushed farther back so the hills dominate the silhouette */}
      {(['north', 'south', 'east', 'west'] as const).map((dir) => (
        <group key={dir}>
          <MountainRange distance={195} parallax={0.035} width={430} peaks={6} maxHeight={28} jaggedness={0.14}
            seed={dir === 'north' ? 1 : dir === 'south' ? 5 : dir === 'east' ? 9 : 13} emissive={PURPLE} yOffset={7} facing={dir} />
          <MountainRange distance={145} parallax={0.075} width={390} peaks={8} maxHeight={16} jaggedness={0.1}
            seed={dir === 'north' ? 2 : dir === 'south' ? 6 : dir === 'east' ? 10 : 14} emissive={CYAN} yOffset={5} facing={dir} />
        </group>
      ))}

      {/* Pyramids — all 4 sides, above floor */}
      <NeonPyramid position={[-30, 8, 0]} scale={8} edgeColor={NEON_GREEN} parallax={0.06} facing="north" />
      <NeonPyramid position={[20, 10, 10]} scale={12} edgeColor={PURPLE} parallax={0.05} facing="north" />
      <NeonPyramid position={[-15, 9, 5]} scale={10} edgeColor={HOT_PINK} parallax={0.06} facing="south" />
      <NeonPyramid position={[25, 7, -5]} scale={9} edgeColor={CYAN} parallax={0.055} facing="east" />
      <NeonPyramid position={[-20, 8, 0]} scale={7} edgeColor={NEON_GREEN} parallax={0.065} facing="west" />

      {/* Sparse horizon grid */}
      <HorizonGrid />
    </group>
  );
}
