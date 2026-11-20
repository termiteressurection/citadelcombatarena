import { useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { AvatarConfig, HatStyle, WeaponStyle } from '../types';
import { perfBegin, perfEnd, perfEnabled } from '../devPerf';
import { Hexadecachoron16Cell } from './components/Hexadecachoron16Cell';
import { useWorldLook } from '../looks/worldLook';

const SPLIT_SHADER = {
  vertexShader: /* glsl */ `
    varying vec3 vLocalPos;
    void main() {
      vLocalPos = position;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    precision mediump float;
    varying vec3 vLocalPos;
    uniform vec3 u_colorLeft;
    uniform vec3 u_colorRight;
    uniform float u_opacity;
    void main() {
      float t = smoothstep(-0.02, 0.02, vLocalPos.x);
      vec3 col = mix(u_colorLeft, u_colorRight, t);
      gl_FragColor = vec4(col, u_opacity);
    }
  `
};

function parseColor(c: any, defaultVal: number): number {
  if (!c) return defaultVal;
  if (typeof c === 'string') {
    if (c === '#split') return 0x777777;
    return parseInt(c.replace('#', ''), 16);
  }
  return c;
}


interface TheBitProps {
  playerPos: React.MutableRefObject<THREE.Vector3>;
  playerYaw: React.MutableRefObject<number>;
  visible: boolean;
  variant?: 'main' | 'rebuilt';
  avatar?: AvatarConfig;
  centerFloat?: boolean;
  mode?: 'follow' | 'anchored';
  emitTrail?: boolean;
  anchorLift?: number;
  showGear?: boolean;
}

function HatMesh({ hat, color, scale = 1 }: { hat: HatStyle; color: number; scale?: number }) {
  const s = scale;
  const mat = <meshBasicMaterial color={color} wireframe transparent opacity={0.85} />;

  switch (hat) {
    case 'wizard':
      // Conical cap with orbital star ring.
      return (
        <group>
          <mesh position={[0, 0.18 * s, 0]}>
            <coneGeometry args={[0.24 * s, 0.52 * s, 6]} />
            {mat}
          </mesh>
          <mesh position={[0, -0.04 * s, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.16 * s, 0.32 * s, 6]} />
            <meshBasicMaterial color={color} wireframe transparent opacity={0.55} side={THREE.DoubleSide} />
          </mesh>
          {[0, 1, 2, 3].map(i => (
            <mesh
              key={i}
              position={[
                Math.sin(i * Math.PI / 2) * 0.14 * s,
                0.26 * s + (i % 2) * 0.08 * s,
                Math.cos(i * Math.PI / 2) * 0.14 * s,
              ]}
            >
              <octahedronGeometry args={[0.018 * s, 0]} />
              <meshBasicMaterial color={0xfbbf24} wireframe />
            </mesh>
          ))}
        </group>
      );
    case 'crown':
      // Five-spiked pentagonal band with gemstones.
      return (
        <group>
          <mesh>
            <cylinderGeometry args={[0.22 * s, 0.2 * s, 0.22 * s, 5]} />
            {mat}
          </mesh>
          {[0, 1, 2, 3, 4].map(i => {
            const angle = (i * Math.PI * 2) / 5;
            return (
              <mesh
                key={i}
                position={[Math.sin(angle) * 0.2 * s, 0.14 * s, Math.cos(angle) * 0.2 * s]}
              >
                <coneGeometry args={[0.04 * s, 0.12 * s, 3]} />
                {mat}
              </mesh>
            );
          })}
          {[0xef4444, 0x22d3ee, 0x34d399, 0xec4899, 0xa855f7].map((c, i) => {
            const angle = (i * Math.PI * 2) / 5 + Math.PI / 5;
            return (
              <mesh
                key={i}
                position={[Math.sin(angle) * 0.19 * s, 0, Math.cos(angle) * 0.19 * s]}
              >
                <octahedronGeometry args={[0.028 * s, 0]} />
                <meshBasicMaterial color={c} wireframe />
              </mesh>
            );
          })}
        </group>
      );
    case 'halo':
      // Concentric golden torus with pale inner aura.
      return (
        <group position={[0, 0.08 * s, 0]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.26 * s, 0.03 * s, 3, 6]} />
            <meshBasicMaterial color={color} wireframe transparent opacity={0.9} />
          </mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.32 * s, 0.02 * s, 3, 6]} />
            <meshBasicMaterial color={0xffffff} wireframe transparent opacity={0.35} />
          </mesh>
        </group>
      );
    default:
      return null;
  }
}

function normalizeHat(hat?: HatStyle): HatStyle {
  if (!hat) return 'none';
  return hat;
}

function WeaponGeometry({ weapon }: { weapon: WeaponStyle }) {
  switch (weapon) {
    case 'sword':
    case 'katana':
      return <boxGeometry args={[0.05, 0.45, 0.03]} />;
    case 'staff':
    case 'spear':
    case 'trident':
      return <cylinderGeometry args={[0.03, 0.03, 0.5, 6]} />;
    case 'axe':
    case 'hammer':
      return <boxGeometry args={[0.18, 0.28, 0.05]} />;
    default:
      return <octahedronGeometry args={[0.12, 0]} />;
  }
}

/**
 * TrailRibbon — a single-draw-call trail that replaces the old `trailV.map()`
 * pattern. Pulls positions directly from `trailRef` via `useFrame`; never
 * triggers a React re-render.
 *
 * Geometry: a ribbon of `MAX_POINTS` segments (two vertices per point), indexed
 * as a triangle list. We pre-allocate once and mutate position/color attributes
 * in place each frame. Old segments fade their RGB toward black — against the
 * lodge's black background this reads as the same glowing tail as the old
 * 120-group trail, at 1 draw call instead of ~120.
 */
const TRAIL_MAX_POINTS = 120;
const TRAIL_WIDTH = 0.12;
const TRAIL_Y_OFFSET = -0.58;

function TrailRibbon({
  trailRef,
  coreColor,
}: {
  trailRef: React.MutableRefObject<THREE.Vector3[]>;
  coreColor: number;
}) {
  const geomRef = useRef<THREE.BufferGeometry>(null);

  const { positions, colors, indices } = useMemo(() => {
    const pos = new Float32Array(TRAIL_MAX_POINTS * 2 * 3);
    const col = new Float32Array(TRAIL_MAX_POINTS * 2 * 3);
    const idx = new Uint16Array((TRAIL_MAX_POINTS - 1) * 6);
    for (let i = 0; i < TRAIL_MAX_POINTS - 1; i++) {
      const a = i * 2;
      const b = i * 6;
      idx[b + 0] = a;
      idx[b + 1] = a + 1;
      idx[b + 2] = a + 2;
      idx[b + 3] = a + 2;
      idx[b + 4] = a + 1;
      idx[b + 5] = a + 3;
    }
    return { positions: pos, colors: col, indices: idx };
  }, []);

  const tangent = useRef(new THREE.Vector3());
  const perp = useRef(new THREE.Vector3());
  const baseColor = useRef(new THREE.Color());

  useFrame(() => {
    const geom = geomRef.current;
    if (!geom) return;
    const trail = trailRef.current;
    const n = trail.length;
    if (n < 2) {
      // Collapse ribbon to origin (degenerate triangles render as nothing).
      for (let i = 0; i < positions.length; i++) positions[i] = 0;
      for (let i = 0; i < colors.length; i++) colors[i] = 0;
      geom.attributes.position.needsUpdate = true;
      geom.attributes.color.needsUpdate = true;
      return;
    }
    baseColor.current.set(coreColor);

    // Right-align trail in the buffer so the newest point is always at index
    // TRAIL_MAX_POINTS - 1. Older slots repeat the oldest real point, which
    // produces zero-area triangles that the GPU skips.
    const offset = TRAIL_MAX_POINTS - n;
    for (let i = 0; i < TRAIL_MAX_POINTS; i++) {
      const real = i - offset;
      const p = real >= 0 && real < n ? trail[real] : trail[0];
      const nextReal = Math.min(Math.max(real, 0) + 1, n - 1);
      const q = trail[nextReal] ?? p;

      tangent.current.set(q.x - p.x, 0, q.z - p.z);
      const len2 = tangent.current.lengthSq();
      if (len2 < 1e-6) {
        // Fall back to a fixed perpendicular when stationary, so the ribbon
        // stays visible rather than collapsing to a line.
        perp.current.set(TRAIL_WIDTH, 0, 0);
      } else {
        perp.current.set(-tangent.current.z, 0, tangent.current.x).normalize().multiplyScalar(TRAIL_WIDTH);
      }

      const posBase = i * 6;
      positions[posBase + 0] = p.x - perp.current.x;
      positions[posBase + 1] = p.y + TRAIL_Y_OFFSET;
      positions[posBase + 2] = p.z - perp.current.z;
      positions[posBase + 3] = p.x + perp.current.x;
      positions[posBase + 4] = p.y + TRAIL_Y_OFFSET;
      positions[posBase + 5] = p.z + perp.current.z;

      // Fade older → darker. `real` goes from (negative, empty) to n-1 (newest).
      const fade = real < 0 ? 0 : (real + 1) / n;
      const r = baseColor.current.r * fade;
      const g = baseColor.current.g * fade;
      const b = baseColor.current.b * fade;
      colors[posBase + 0] = r;
      colors[posBase + 1] = g;
      colors[posBase + 2] = b;
      colors[posBase + 3] = r;
      colors[posBase + 4] = g;
      colors[posBase + 5] = b;
    }
    geom.attributes.position.needsUpdate = true;
    geom.attributes.color.needsUpdate = true;
  });

  return (
    <mesh frustumCulled={false}>
      <bufferGeometry ref={geomRef}>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
        />
        <bufferAttribute
          attach="attributes-color"
          args={[colors, 3]}
        />
        <bufferAttribute attach="index" args={[indices, 1]} />
      </bufferGeometry>
      <meshBasicMaterial vertexColors transparent opacity={0.75} side={THREE.DoubleSide} depthWrite={false} />
    </mesh>
  );
}

export function TheBit({
  playerPos,
  playerYaw,
  visible,
  variant = 'main',
  avatar,
  centerFloat = false,
  mode = 'follow',
  emitTrail = true,
  anchorLift,
  showGear = true,
}: TheBitProps) {
  const { camera } = useThree();
  const groupRef = useRef<THREE.Group>(null);
  const innerRef = useRef<THREE.Mesh>(null);
  const middleRef = useRef<THREE.Group>(null);
  const ring1Ref = useRef<THREE.Mesh>(null);
  const ring2Ref = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.PointLight>(null);
  const haloRef = useRef<THREE.Mesh>(null);
  const targetRef = useRef(new THREE.Vector3());
  const rightRef = useRef(new THREE.Vector3());
  const forwardRef = useRef(new THREE.Vector3());
  const trailRef = useRef<THREE.Vector3[]>([]);
  const [trailV, setTrailV] = useState<THREE.Vector3[]>([]);

  const isSplit = (avatar?.glowColor as any) === '#split' || avatar?.glowColor === 0x777777;
  const isMinimal = useWorldLook((s) => s.look) === 'minimal';

  useFrame(({ clock }, delta) => {
    if (perfEnabled) perfBegin('bit');
    if (!groupRef.current || !playerPos.current) {
      if (perfEnabled) perfEnd('bit');
      return;
    }
    const pos = playerPos.current;
    const yaw = playerYaw.current ?? 0;
    const mainMode = variant === 'main';
    rightRef.current.set(Math.cos(yaw), 0, -Math.sin(yaw));
    forwardRef.current.set(-Math.sin(yaw), 0, -Math.cos(yaw));
    if (centerFloat) {
      targetRef.current.copy(pos);
      targetRef.current.y = pos.y + 0.8 + Math.sin(clock.elapsedTime * 1.7) * 0.16;
    } else if (mode === 'anchored') {
      const lift = anchorLift ?? (mainMode ? 0.78 : 0.8);
      targetRef.current.copy(pos);
      targetRef.current.y = pos.y + lift + Math.sin(clock.elapsedTime * 1.7) * (mainMode ? 0.05 : 0.07);
    } else {
      targetRef.current
        .copy(pos)
        .addScaledVector(rightRef.current, mainMode ? 1.08 : 1.45)
        .addScaledVector(forwardRef.current, mainMode ? 0.68 : 0.95);
      targetRef.current.y = pos.y + 0.8 + Math.sin(clock.elapsedTime * 1.7) * (mainMode ? 0.1 : 0.14);
    }

    const followAlpha = 1 - Math.pow(1 - (centerFloat ? 0.3 : mainMode ? 0.26 : 0.22), delta * 60);
    if (mode === 'anchored' || centerFloat) {
      groupRef.current.position.copy(targetRef.current);
    } else {
      groupRef.current.position.lerp(targetRef.current, followAlpha);
    }
    groupRef.current.rotation.y = centerFloat || mode === 'anchored' ? yaw : yaw + (mainMode ? Math.PI * 0.9 : Math.PI * 0.82);

    if (emitTrail) {
      const p = groupRef.current.position.clone();
      trailRef.current.push(p);
      if (trailRef.current.length > TRAIL_MAX_POINTS) trailRef.current.shift();
      if (avatar?.trailStyle === 'duck_feather' && trailRef.current.length % 2 === 0) {
        setTrailV([...trailRef.current]);
      }
    } else if (trailRef.current.length > 0) {
      trailRef.current = [];
      if (trailV.length > 0) setTrailV([]);
    }

    const t = clock.elapsedTime;
    if (innerRef.current) {
      // Inverted inner pyramid rotation
      innerRef.current.rotation.x = t * 0.8;
      innerRef.current.rotation.y = t * 1.1;
      innerRef.current.rotation.z = t * 0.6;
    }
    if (middleRef.current) {
      middleRef.current.rotation.x = -t * 0.35;
      middleRef.current.rotation.y = -t * 0.45;
      if (avatar?.silhouette === 'ghost') {
        const scale = 1.0 + Math.sin(t * 2.0) * 0.12;
        middleRef.current.scale.setScalar(scale);
      } else {
        middleRef.current.scale.setScalar(1.0);
      }
    }
    if (ring1Ref.current) {
      ring1Ref.current.rotation.x = t * 0.5;
      ring1Ref.current.rotation.y = t * 0.25;
    }
    if (ring2Ref.current) {
      ring2Ref.current.rotation.y = t * 0.6;
      ring2Ref.current.rotation.z = t * 0.35;
    }

    if (glowRef.current) {
      glowRef.current.intensity = (mainMode ? 1.45 : 2) + Math.sin(clock.elapsedTime * 3) * (mainMode ? 0.28 : 0.55);
    }

    if (!mainMode && haloRef.current) {
      haloRef.current.lookAt(camera.position);
      (haloRef.current.material as THREE.MeshBasicMaterial).opacity = 0.24 + Math.sin(clock.elapsedTime * 2.4) * 0.06;
    }
    if (perfEnabled) perfEnd('bit');
  });

  const rawGlow = avatar?.glowColor;
  const rawCoreColor = parseColor(rawGlow, variant === 'main' ? 0xc084fc : 0xd946ef);
  const rawShellColor = parseColor(rawGlow, variant === 'main' ? 0xe9d5ff : 0xf0abfc);
  const rawRingColor = parseColor(rawGlow, variant === 'main' ? 0x34d399 : 0xec4899);

  // Fallback to neon cyan core in split mode for non-shader colors
  const coreColor = isSplit ? 0x22d3ee : rawCoreColor;
  const shellColor = isSplit ? 0x22d3ee : rawShellColor;
  const ringColor = isSplit ? 0x22d3ee : rawRingColor;

  const hat = showGear ? normalizeHat(avatar?.hat) : 'none';
  const weapon = 'none'; // Weapon artifact exorcised: focused on pure sacred geometry silhouette
  const hatColor = hat === 'crown' || hat === 'halo' ? 0xfbbf24 : coreColor;
  const mainHatY = hat === 'crown' ? 0.76 : hat === 'halo' ? 1.02 : 0.92;
  const rebuiltHatY = hat === 'crown' ? 0.86 : hat === 'halo' ? 1.14 : 1.02;
  const hatScale = hat === 'crown' ? 1.45 : 1;
  
  const slickerColor = avatar?.isSlicker ? 0xfacc15 : coreColor;
  const slickerOpacity = avatar?.isSlicker ? 0.9 : 0.96;

  const splitUniforms = useMemo(() => ({
    u_colorLeft: { value: new THREE.Color('#22d3ee') },
    u_colorRight: { value: new THREE.Color('#fbbf24') },
    u_opacity: { value: 0.7 }
  }), []);

  // Geometry dimensions
  const innerScale = variant === 'main' ? 0.42 : 0.48;
  const shellScale = variant === 'main' ? 0.68 : 0.82;
  const ringRadius1 = variant === 'main' ? 0.92 : 1.08;
  const ringRadius2 = variant === 'main' ? 1.06 : 1.25;

  const silhouette = avatar?.silhouette || 'default';

  // Materials depending on split color choice
  const wireframeMaterial = isSplit ? (
    <shaderMaterial
      attach="material"
      vertexShader={SPLIT_SHADER.vertexShader}
      fragmentShader={SPLIT_SHADER.fragmentShader}
      uniforms={splitUniforms}
      transparent
      depthWrite={false}
      wireframe
    />
  ) : (
    <meshBasicMaterial color={shellColor} wireframe transparent opacity={0.7} />
  );

  const solidOpacity = silhouette === 'shadow' ? 0.05 : avatar?.isSlicker ? 0.9 : 0.28;
  const solidColor = silhouette === 'shadow' ? 0x020202 : slickerColor;
  const solidMaterial = isSplit ? (
    <shaderMaterial
      attach="material"
      vertexShader={SPLIT_SHADER.vertexShader}
      fragmentShader={SPLIT_SHADER.fragmentShader}
      uniforms={splitUniforms}
      transparent
      depthWrite={false}
    />
  ) : (
    <meshBasicMaterial color={solidColor} transparent opacity={solidOpacity} />
  );

  return (
    <group ref={groupRef} visible={visible}>
      {/* Dynamic Trails */}
      {emitTrail && avatar?.trailStyle === 'duck_feather' && trailV.slice(1).map((p, i) => {
        const prev = trailV[i];
        const d = p.clone().sub(prev);
        const len = Math.sqrt(d.x * d.x + d.z * d.z);
        if (len < 0.01) return null;
        const mid = p.clone().add(prev).multiplyScalar(0.5);
        return (
          <group key={i} position={[mid.x, mid.y - 0.4, mid.z]} rotation={[0, Math.atan2(d.x, d.z), 0]}>
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <planeGeometry args={[variant === 'main' ? 0.2 : 0.24, variant === 'main' ? 0.4 : 0.48]} />
              <meshBasicMaterial color="#ffffff" transparent opacity={0.6} side={THREE.DoubleSide} />
            </mesh>
          </group>
        );
      })}
      {emitTrail && avatar?.trailStyle !== 'duck_feather' && (
        <TrailRibbon trailRef={trailRef} coreColor={coreColor} />
      )}

      {/* 1. SACRED AVATAR FORM: The Plash 24D Extradimensional 16-Cell with ABRACADABRA Sigil */}
      <group ref={middleRef}>
        <Hexadecachoron16Cell
          scale={variant === 'main' ? 0.62 : 0.72}
          color={isMinimal ? 0xffffff : silhouette === 'shadow' ? 0x050505 : silhouette === 'ghost' ? coreColor : coreColor}
          wireframeColor={isMinimal ? 0xffffff : shellColor}
          speed={2.4}
          faceOpacity={isMinimal ? 1.0 : silhouette === 'shadow' ? 0.12 : 0.72}
          showDust={false}
          showVertices={!isMinimal}
        />
      </group>

      {/* 3. OUTER RINGS: Spinning gyroscopic cage (suppressed in minimal for pure monolithic light) */}
      {!isMinimal && (
        <>
          <mesh ref={ring1Ref}>
            <torusGeometry args={[ringRadius1, 0.015, 4, 32]} />
            {isSplit ? (
              <shaderMaterial
                attach="material"
                vertexShader={SPLIT_SHADER.vertexShader}
                fragmentShader={SPLIT_SHADER.fragmentShader}
                uniforms={splitUniforms}
                transparent
                depthWrite={false}
              />
            ) : (
              <meshBasicMaterial color={ringColor} transparent opacity={0.6} />
            )}
          </mesh>
          <mesh ref={ring2Ref}>
            <torusGeometry args={[ringRadius2, 0.012, 4, 32]} />
            {isSplit ? (
              <shaderMaterial
                attach="material"
                vertexShader={SPLIT_SHADER.vertexShader}
                fragmentShader={SPLIT_SHADER.fragmentShader}
                uniforms={splitUniforms}
                transparent
                depthWrite={false}
              />
            ) : (
              <meshBasicMaterial color={ringColor} transparent opacity={0.4} />
            )}
          </mesh>
        </>
      )}

      {/* Hats and Gear (suppressed in minimal mode for pure sacred geometry silhouette) */}
      {!isMinimal && hat !== 'none' && (
        <group position={[0, variant === 'main' ? mainHatY : rebuiltHatY, 0]} scale={hatScale}>
          <HatMesh
            hat={hat}
            color={avatar?.hatColor ? parseInt(avatar.hatColor.replace('#', ''), 16) : hatColor}
          />
        </group>
      )}
      {!isMinimal && weapon !== 'none' && (
        <mesh position={[variant === 'main' ? 0.56 : 0.62, variant === 'main' ? 0.1 : 0.18, 0]} rotation={[0, 0, 0.3]}>
          <WeaponGeometry weapon={weapon} />
          <meshBasicMaterial color={coreColor} wireframe transparent opacity={0.78} />
        </mesh>
      )}

      {/* Light source */}
      <pointLight ref={glowRef} color={coreColor} intensity={variant === 'main' ? 1.45 : 1.8} distance={variant === 'main' ? 8 : 10} />
    </group>
  );
}
