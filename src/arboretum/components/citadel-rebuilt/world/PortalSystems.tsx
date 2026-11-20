import { useEffect, useRef, useState, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { sphereDrop, applyGlobeCurvature } from '../RebuiltWorldShared';
import { applyTermiteseGlitch } from '@/features/sigma/termiteseGlitch';

const PORTAL_UPDATE_RADIUS_SQ = 40 * 40;
const TEXT_NEAR_RADIUS_SQ = 20 * 20;

export function DigitalAlarmHaloRing({
  text,
  active = false,
  stale = false,
  radius = 2.1,
  colorScheme = 'amber',
}: {
  text: string;
  active?: boolean;
  stale?: boolean;
  radius?: number;
  colorScheme?: 'amber' | 'cyan';
}) {
  const haloGroupRef = useRef<THREE.Group>(null);

  // Digital alarm clock palette
  const primaryColor = colorScheme === 'cyan' ? '#22d3ee' : active ? '#fbbf24' : '#f59e0b';
  const neonHex = colorScheme === 'cyan' ? 0x06b6d4 : active ? 0xfbbf24 : 0xd97706;
  const tickColor = colorScheme === 'cyan' ? '#a5f3fc' : '#fef08a';

  const ribbonHeight = Math.max(0.38, radius * 0.16);

  // Dynamic seamless 360-degree cylindrical text texture where the text IS the ring
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 2048;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    if (!ctx) return new THREE.CanvasTexture(canvas);

    // 1. Dark tinted translucent visor backing ribbon
    ctx.fillStyle = 'rgba(6, 4, 14, 0.78)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 2. Top and bottom digital alarm clock neon rail borders
    ctx.strokeStyle = primaryColor;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, 5);
    ctx.lineTo(canvas.width, 5);
    ctx.moveTo(0, canvas.height - 5);
    ctx.lineTo(canvas.width, canvas.height - 5);
    ctx.stroke();

    // 3. Segmented LED clock ticks along rails
    ctx.fillStyle = tickColor;
    for (let x = 0; x < canvas.width; x += 32) {
      ctx.fillRect(x, 9, 8, 2.5);
      ctx.fillRect(x, canvas.height - 11.5, 8, 2.5);
    }

    // 4. Repeating literal text continuous around the circumference
    const displayText = text.toUpperCase().trim();
    const unitText = active
      ? `✦ ${displayText} · [ENTER] ✦ `
      : `✦ ${displayText} ✦ `;

    ctx.font = "900 50px 'SFMono-Regular', Menlo, Monaco, Consolas, 'Courier New', monospace";
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';

    const measuredWidth = ctx.measureText(unitText).width;
    const repeatCount = Math.max(2, Math.round(canvas.width / Math.max(measuredWidth + 40, 220)));
    const step = canvas.width / repeatCount;

    for (let i = 0; i < repeatCount; i++) {
      const cx = i * step + step / 2;

      // Glow halo
      ctx.shadowColor = primaryColor;
      ctx.shadowBlur = 12;
      ctx.fillStyle = primaryColor;
      ctx.fillText(unitText, cx, canvas.height / 2);

      // White-hot digital core
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#ffffff';
      ctx.fillText(unitText, cx, canvas.height / 2);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    return tex;
  }, [text, active, colorScheme, primaryColor, tickColor]);

  useEffect(() => {
    return () => {
      texture.dispose();
    };
  }, [texture]);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (haloGroupRef.current) {
      // Smooth 360-degree physical rotation of the cylindrical text ring
      haloGroupRef.current.rotation.y = t * (active ? 0.48 : 0.28);
    }
  });

  return (
    <group position={[0, 3.45, 0]}>
      {/* Slightly pitched horizontal halo for optimal 3D perspective */}
      <group rotation={[0.16, 0, 0]}>
        <group ref={haloGroupRef}>
          {/* The literal text lives directly on this curved cylindrical ribbon */}
          <mesh rotation={[0, 0, 0]}>
            <cylinderGeometry args={[radius, radius, ribbonHeight, 64, 1, true]} />
            <meshBasicMaterial
              map={texture}
              transparent
              opacity={stale ? 0.35 : 0.95}
              side={THREE.DoubleSide}
              depthWrite={false}
            />
          </mesh>

          {/* Top bezel rim */}
          <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, ribbonHeight / 2, 0]}>
            <torusGeometry args={[radius, 0.02, 6, 48]} />
            <meshBasicMaterial color={neonHex} transparent opacity={stale ? 0.25 : 0.9} />
          </mesh>

          {/* Bottom bezel rim */}
          <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, -ribbonHeight / 2, 0]}>
            <torusGeometry args={[radius, 0.02, 6, 48]} />
            <meshBasicMaterial color={neonHex} transparent opacity={stale ? 0.25 : 0.9} />
          </mesh>
        </group>

        {/* Ambient interior core glow disc */}
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, -ribbonHeight / 2 - 0.01, 0]}>
          <ringGeometry args={[radius * 0.15, radius * 0.96, 24]} />
          <meshBasicMaterial color={neonHex} transparent opacity={stale ? 0.02 : 0.07} side={THREE.DoubleSide} />
        </mesh>
      </group>
    </group>
  );
}

export function RebuiltPortal({
  position,
  targetName,
  active,
  onEnter,
  playerPos,
  bookmarked,
  stale,
  template,
}: {
  position: [number, number, number];
  targetName: string;
  active: boolean;
  onEnter: () => void;
  playerPos: React.MutableRefObject<THREE.Vector3>;
  bookmarked?: boolean;
  stale?: boolean;
  template?: string;
}) {
  const ref = useRef<THREE.Group>(null);
  const [isNear, setIsNear] = useState(false);

  // Precompute a stable Termitese variant for when far away
  const termiteseName = useMemo(() => applyTermiteseGlitch(targetName, 0), [targetName]);

  useEffect(() => {
    if (!ref.current) return;
    const pp = playerPos.current;
    // Ground alignment: floor threshold plate is at y = -2.1, so baseY = 2.1 places threshold flush on ground
    applyGlobeCurvature(ref.current, position[0], 2.1, position[2], pp);
  }, [position, playerPos]);

  useFrame(() => {
    if (!ref.current) return;
    const pp = playerPos.current;
    const dx = position[0] - pp.x;
    const dz = position[2] - pp.z;
    const distSq = dx * dx + dz * dz;

    // Check proximity for text
    const currentlyNear = distSq < TEXT_NEAR_RADIUS_SQ;
    if (currentlyNear !== isNear) {
      setIsNear(currentlyNear);
    }

    if (distSq > PORTAL_UPDATE_RADIUS_SQ) return;
    applyGlobeCurvature(ref.current, position[0], 2.1, position[2], pp);
  });

  const baseOpacity = stale ? 0.2 : 0.88;
  const portalColor = active ? 0xfbbf24 : bookmarked ? 0xfbbf24 : 0xa855f7;
  const displayText = isNear ? targetName : termiteseName;

  return (
    <group ref={ref} position={position} onClick={onEnter}>
      <mesh rotation={[0, Math.PI / 2, 0]}>
        <torusGeometry args={[1.9, 0.12, 3, 8]} />
        <meshBasicMaterial color={portalColor} wireframe transparent opacity={baseOpacity} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.8, 1.7, 6]} />
        <meshBasicMaterial color={0xec4899} transparent opacity={stale ? 0.08 : 0.2} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, -2.1, 0]}>
        <planeGeometry args={[2.8, 0.26]} />
        <meshBasicMaterial color={0x34d399} transparent opacity={stale ? 0.08 : 0.2} />
      </mesh>
      
      {/* Digital Alarm Clock Halo Ring */}
      <DigitalAlarmHaloRing
        text={displayText}
        active={active}
        stale={stale}
        radius={2.1}
        colorScheme={active ? 'amber' : 'cyan'}
      />
    </group>
  );
}

export function CurvedVoidSphere({
  position,
  playerPos,
}: {
  position: [number, number, number];
  playerPos: React.MutableRefObject<THREE.Vector3>;
}) {
  const ref = useRef<THREE.Mesh>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const groupRef = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (ref.current) {
      ref.current.rotation.x = t * 0.15;
      ref.current.rotation.y = t * 0.25;
      ref.current.scale.setScalar(1 + Math.sin(t * 0.5) * 0.08);
    }
    if (ringRef.current) {
      ringRef.current.rotation.z = t * 0.3;
      ringRef.current.rotation.x = Math.sin(t * 0.2) * 0.5;
    }
    if (groupRef.current) {
      const pp = playerPos.current;
      groupRef.current.position.y = position[1] - sphereDrop(position[0] - pp.x, position[2] - pp.z);
    }
  });
  return (
    <group ref={groupRef} position={position}>
      <mesh ref={ref}>
        <icosahedronGeometry args={[3, 0]} />
        <meshBasicMaterial color={0x7c3aed} wireframe transparent opacity={0.4} />
      </mesh>
      <mesh ref={ringRef}>
        <torusGeometry args={[4.5, 0.08, 4, 12]} />
        <meshBasicMaterial color={0xec4899} wireframe transparent opacity={0.5} />
      </mesh>
    </group>
  );
}

export function WormholePortal({
  position,
  targetName,
  playerPos,
  rotation = [0, 0, 0],
  active = false,
  stale = false,
  thoughtCount,
  onEnter,
}: {
  position: [number, number, number];
  targetName: string;
  playerPos: React.MutableRefObject<THREE.Vector3>;
  rotation?: [number, number, number];
  active?: boolean;
  stale?: boolean;
  thoughtCount?: number;
  onEnter?: () => void;
}) {
  const ref = useRef<THREE.Group>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const [isNear, setIsNear] = useState(false);

  const termiteseName = useMemo(() => applyTermiteseGlitch(targetName, 0), [targetName]);

  useEffect(() => {
    if (!ref.current) return;
    const pp = playerPos.current;
    // Ring radius is 1.4: baseY = 1.45 grounds bottom of ring flush on floor deck
    applyGlobeCurvature(ref.current, position[0], 1.45, position[2], pp, rotation[1]);
  }, [position, playerPos, rotation]);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const pp = playerPos.current;
    const dx = position[0] - pp.x;
    const dz = position[2] - pp.z;
    const distSq = dx * dx + dz * dz;

    const currentlyNear = distSq < TEXT_NEAR_RADIUS_SQ;
    if (currentlyNear !== isNear) {
      setIsNear(currentlyNear);
    }

    if (distSq <= PORTAL_UPDATE_RADIUS_SQ) {
      applyGlobeCurvature(ref.current, position[0], 1.45, position[2], pp, rotation[1]);
    }
    
    if (ringRef.current) {
      const t = clock.elapsedTime;
      ringRef.current.rotation.z = t * (active ? 0.9 : 0.5);
      ringRef.current.rotation.x = Math.sin(t * 0.3) * 0.4;
    }
  });

  const displayText = isNear ? targetName : termiteseName;
  const primaryColor = active ? 0x67e8f9 : 0xfbbf24;

  return (
    <group
      ref={ref}
      position={position}
      rotation={rotation}
      onPointerDown={(e) => {
        e.stopPropagation();
        onEnter?.();
      }}
    >
      <mesh ref={ringRef} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1.4, active ? 0.08 : 0.06, 4, 16]} />
        <meshBasicMaterial color={primaryColor} transparent opacity={stale ? 0.4 : 0.85} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1.7, 0.04, 3, 16]} />
        <meshBasicMaterial color={primaryColor} transparent opacity={active ? 0.55 : 0.3} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.3, 1.35, 12]} />
        <meshBasicMaterial color={primaryColor} transparent opacity={active ? 0.18 : 0.08} side={THREE.DoubleSide} />
      </mesh>
      {thoughtCount !== undefined && thoughtCount > 0 && (
        <mesh position={[0, 0, 0]}>
          <icosahedronGeometry args={[0.28, 0]} />
          <meshBasicMaterial color={0xec4899} wireframe transparent opacity={0.75} />
        </mesh>
      )}
      <group position={[0, -0.6, 0]}>
        <DigitalAlarmHaloRing text={displayText} radius={1.4} colorScheme={active ? 'cyan' : 'amber'} />
      </group>
    </group>
  );
}

export function SeasonalToriiPortal({
  position,
  rotation = [0, 0, 0],
  scale = 1.3,
  targetName,
  active = false,
  onEnter,
  playerPos,
}: {
  position: [number, number, number];
  rotation?: [number, number, number];
  scale?: number;
  targetName: string;
  active?: boolean;
  onEnter?: () => void;
  playerPos: React.MutableRefObject<THREE.Vector3>;
}) {
  const ref = useRef<THREE.Group>(null);
  const [isNear, setIsNear] = useState(false);
  const termiteseName = useMemo(() => applyTermiteseGlitch(targetName, 0), [targetName]);

  useFrame(() => {
    if (!ref.current) return;
    const pp = playerPos.current;
    const dx = position[0] - pp.x;
    const dz = position[2] - pp.z;
    const distSq = dx * dx + dz * dz;

    const currentlyNear = distSq < TEXT_NEAR_RADIUS_SQ;
    if (currentlyNear !== isNear) {
      setIsNear(currentlyNear);
    }

    // Ground alignment: baseY = 0 pins Torii posts directly flush to curved floor deck
    applyGlobeCurvature(ref.current, position[0], 0, position[2], pp, rotation[1]);
  });

  const displayText = isNear ? targetName : termiteseName;

  return (
    <group
      ref={ref}
      scale={scale}
      onClick={onEnter}
      onPointerDown={(e) => {
        e.stopPropagation();
        onEnter?.();
      }}
    >
      {/* Torii Gate Structure — bottom of posts at y = 0 sits flush on curved floor */}
      <mesh position={[-1.55, 2.9, 0]}>
        <boxGeometry args={[0.34, 5.8, 0.34]} />
        <meshBasicMaterial color={active ? 0x67e8f9 : 0xa855f7} wireframe transparent opacity={0.65} />
      </mesh>
      <mesh position={[1.55, 2.9, 0]}>
        <boxGeometry args={[0.34, 5.8, 0.34]} />
        <meshBasicMaterial color={active ? 0x67e8f9 : 0xa855f7} wireframe transparent opacity={0.65} />
      </mesh>
      <mesh position={[0, 5.55, 0]}>
        <boxGeometry args={[4.8, 0.34, 0.38]} />
        <meshBasicMaterial color={active ? 0xfde047 : 0xfbbf24} wireframe transparent opacity={0.75} />
      </mesh>
      <mesh position={[0, 5.05, 0]}>
        <boxGeometry args={[4.1, 0.2, 0.28]} />
        <meshBasicMaterial color={active ? 0xf472b6 : 0xec4899} wireframe transparent opacity={0.6} />
      </mesh>

      {/* Digital Alarm Clock Halo Ring crowned right over gate crossbeam */}
      <group position={[0, 1.85, 0]}>
        <DigitalAlarmHaloRing
          text={displayText}
          radius={2.4}
          active={active}
          colorScheme={active ? 'cyan' : 'amber'}
        />
      </group>
    </group>
  );
}
