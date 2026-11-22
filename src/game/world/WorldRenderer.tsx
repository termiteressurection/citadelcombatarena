import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import SpriteText from '../art/SpriteText';
import { Brazier } from '../art/Ps1Sky';
import { CITY_CURVE_RADIUS, curveDrop, makeCurvedBasicMaterial } from '../art/curvature';
import { cloneTex, getPs1Texture, makePs1Material } from '../art/ps1Textures';
import { useGame } from '../store';
import { MemoryWoodsAndFlora } from './MemoryWoods';
import { PROPERTIES, propertyRentPayout, type PropertyDef } from './properties';
import {
  biomeAt, CAPITALS, nearestColosseum, SATELLITES, settlementBuildings,
  settlementTerminals, type BiomeId, type ColosseumDef, type Settlement,
} from './universe';

const BIOME_GRID_COLORS: Record<BiomeId, { color: string; emissive: string }> = {
  metropolis: { color: '#aaeaff', emissive: '#11324d' },
  bazaar: { color: '#ffd084', emissive: '#3b210c' },
  vault: { color: '#dcd2ff', emissive: '#221a4d' },
  frontier: { color: '#ff8593', emissive: '#3d0d16' },
  kernel: { color: '#fff0a8', emissive: '#3b3010' },
};

/** Endless R=200 curved TRON grid & abyss void that steps invisibly beneath the rider. */
export function InfiniteCurvedFloor({ playerPos }: { playerPos: React.MutableRefObject<THREE.Vector3> }) {
  const gridRef = useRef<THREE.Mesh>(null!);
  const abyssRef = useRef<THREE.Mesh>(null!);
  const tmpCol = useMemo(() => new THREE.Color(), []);
  const tmpEmi = useMemo(() => new THREE.Color(), []);

  const mats = useMemo(() => ({
    grid: makePs1Material({
      color: '#8ad8f0',
      map: cloneTex(getPs1Texture('grid'), 95, 95),
      emissive: '#071b2b',
      emissiveIntensity: 0.36,
    }),
    abyss: new THREE.MeshBasicMaterial({ color: '#03030a', fog: false }),
  }), []);

  useFrame((_, delta) => {
    const px = playerPos.current.x;
    const pz = playerPos.current.z;
    // Snap by 20u (= exact multiple of 4u grid tile) so grid lines never swim or pop
    const sx = Math.round(px / 20) * 20;
    const sz = Math.round(pz / 20) * 20;
    if (gridRef.current) gridRef.current.position.set(sx, -0.02, sz);
    if (abyssRef.current) abyssRef.current.position.set(px, -68, pz);

    const b = biomeAt(px, pz);
    const pal = BIOME_GRID_COLORS[b];
    tmpCol.set(pal.color);
    tmpEmi.set(pal.emissive);
    const k = Math.min(1, delta * 3.5);
    mats.grid.color.lerp(tmpCol, k);
    mats.grid.emissive.lerp(tmpEmi, k);
  });

  return (
    <group>
      <mesh ref={abyssRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, -68, 0]} material={mats.abyss} frustumCulled={false}>
        <circleGeometry args={[560, 24]} />
      </mesh>
      <mesh ref={gridRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} material={mats.grid} frustumCulled={false}>
        <planeGeometry args={[380, 380, 76, 76]} />
      </mesh>
    </group>
  );
}

/** Towering Hard-Light Sky Beacon pointing to whichever Capital Colosseum is currently closest. */
export function NearestColosseumBeacon({ playerPos }: { playerPos: React.MutableRefObject<THREE.Vector3> }) {
  const rootRef = useRef<THREE.Group>(null!);
  const ring1 = useRef<THREE.Mesh>(null!);
  const ring2 = useRef<THREE.Mesh>(null!);
  const ring3 = useRef<THREE.Mesh>(null!);

  const mats = useMemo(() => ({
    core: new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.78, fog: false, depthWrite: false }),
    aura: new THREE.MeshBasicMaterial({
      color: '#ff4fd8',
      transparent: true,
      opacity: 0.34,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      fog: false,
      depthWrite: false,
    }),
    ring: new THREE.MeshBasicMaterial({ color: '#ff4fd8', transparent: true, opacity: 0.85, side: THREE.DoubleSide, fog: false }),
  }), []);

  useFrame(({ clock }) => {
    const px = playerPos.current.x;
    const pz = playerPos.current.z;
    const { colosseum, dist } = nearestColosseum(px, pz);

    mats.aura.color.set(colosseum.color);
    mats.ring.color.set(colosseum.color);

    if (rootRef.current) {
      const dx = colosseum.x - px;
      const dz = colosseum.z - pz;
      const horizonRim = 165;
      if (dist <= horizonRim) {
        const drop = curveDrop(dx, dz, CITY_CURVE_RADIUS);
        rootRef.current.position.set(colosseum.x, -drop, colosseum.z);
        rootRef.current.scale.set(1, 1, 1);
      } else {
        const inv = 1 / (dist || 1);
        const bx = px + dx * inv * horizonRim;
        const bz = pz + dz * inv * horizonRim;
        const rimDrop = curveDrop(horizonRim, 0, CITY_CURVE_RADIUS);
        rootRef.current.position.set(bx, -rimDrop - 20, bz);
        rootRef.current.scale.set(1.45, 1.35, 1.45);
      }
    }

    const t = clock.elapsedTime;
    if (ring1.current) {
      ring1.current.rotation.z = t * 1.1;
      ring1.current.position.y = 26 + ((t * 14) % 145);
    }
    if (ring2.current) {
      ring2.current.rotation.z = -t * 0.9;
      ring2.current.position.y = 26 + (((t * 14) + 52) % 145);
    }
    if (ring3.current) {
      ring3.current.rotation.z = t * 0.7;
      ring3.current.position.y = 26 + (((t * 14) + 104) % 145);
    }
  });

  return (
    <group ref={rootRef}>
      <mesh position={[0, 125, 0]} material={mats.core} frustumCulled={false}>
        <cylinderGeometry args={[0.38, 0.75, 250, 6, 1, true]} />
      </mesh>
      <mesh position={[0, 125, 0]} material={mats.aura} frustumCulled={false}>
        <cylinderGeometry args={[1.6, 3.1, 250, 8, 1, true]} />
      </mesh>
      <mesh ref={ring1} position={[0, 40, 0]} rotation={[Math.PI / 2, 0, 0]} material={mats.ring} frustumCulled={false}>
        <ringGeometry args={[2.6, 3.6, 8]} />
      </mesh>
      <mesh ref={ring2} position={[0, 90, 0]} rotation={[Math.PI / 2, 0, 0]} material={mats.ring} frustumCulled={false}>
        <ringGeometry args={[3.2, 4.3, 8]} />
      </mesh>
      <mesh ref={ring3} position={[0, 140, 0]} rotation={[Math.PI / 2, 0, 0]} material={mats.ring} frustumCulled={false}>
        <ringGeometry args={[2.2, 3.1, 8]} />
      </mesh>
    </group>
  );
}

interface SharedMats {
  hull: THREE.MeshLambertMaterial;
  hullDark: THREE.MeshLambertMaterial;
  gold: THREE.MeshLambertMaterial;
  holo: THREE.MeshLambertMaterial;
  crystal: THREE.MeshLambertMaterial;
  wood: THREE.MeshLambertMaterial;
  rust: THREE.MeshLambertMaterial;
}

let cachedShared: SharedMats | null = null;
function getSharedMats(): SharedMats {
  if (!cachedShared) {
    cachedShared = {
      hull: makePs1Material({ color: '#2b335c', map: cloneTex(getPs1Texture('circuit'), 2, 3), emissive: '#0c1c36', emissiveIntensity: 0.4 }),
      hullDark: makePs1Material({ color: '#161b34', map: cloneTex(getPs1Texture('conduit'), 2, 2), emissive: '#081224', emissiveIntensity: 0.3 }),
      gold: makePs1Material({ color: '#ffd478', map: getPs1Texture('bronze'), emissive: '#785012', emissiveIntensity: 0.42 }),
      holo: makePs1Material({ color: '#ffffff', map: getPs1Texture('holo'), emissive: '#ff4fd8', emissiveIntensity: 0.45 }),
      crystal: makePs1Material({ color: '#c8d6ff', map: getPs1Texture('rune'), emissive: '#4d46a8', emissiveIntensity: 0.5 }),
      wood: makePs1Material({ color: '#9c6c46', map: getPs1Texture('wood'), emissive: '#29160a', emissiveIntensity: 0.25 }),
      rust: makePs1Material({ color: '#471e26', map: getPs1Texture('stone'), emissive: '#29080e', emissiveIntensity: 0.35 }),
    };
  }
  return cachedShared;
}

/** Individual Fable Property building + Deed Post sign reflecting live ownership, mode, and renovation tier. */
function PropertyDeedView({ prop }: { prop: PropertyDef }) {
  const owned = useGame((s) => s.ownedProperties[prop.id]);
  const m = useMemo(getSharedMats, []);
  const gemRef = useRef<THREE.Mesh>(null!);

  const tier = owned?.tier ?? 1;
  const statusColor = !owned ? '#ffc95c' : owned.mode === 'live' ? '#3ff0ff' : '#4dffa0';
  const signLabel = !owned
    ? `${prop.name}\nFOR SALE · ${prop.price}C`
    : owned.mode === 'live'
      ? `${prop.name}\nYOUR HOME · T${tier}`
      : `${prop.name}\nRENTED · +${propertyRentPayout(prop, owned)}C`;

  const trimMat = useMemo(() => makeCurvedBasicMaterial({ color: statusColor }), [statusColor]);
  const accentMat = useMemo(() => makeCurvedBasicMaterial({ color: prop.accent }), [prop.accent]);
  const ringMat = useMemo(() => makeCurvedBasicMaterial({ color: statusColor, transparent: true, opacity: 0.45 }), [statusColor]);

  useFrame(({ clock }) => {
    if (gemRef.current) {
      gemRef.current.rotation.y = clock.elapsedTime * 1.8;
      gemRef.current.position.y = 1.85 + Math.sin(clock.elapsedTime * 2.5) * 0.12;
    }
  });

  const bodyH = prop.kind === 'estate' ? 4.4 : prop.kind === 'tavern' ? 3.8 : prop.kind === 'shop' ? 3.4 : 3.0;
  const bodyW = prop.kind === 'estate' ? 5.2 : 4.2;

  return (
    <group>
      {/* Main Building Footprint */}
      <group position={[prop.x, 0, prop.z]}>
        <mesh position={[0, 0.2, 0]} material={m.hullDark}><boxGeometry args={[bodyW + 0.8, 0.4, bodyW + 0.6]} /></mesh>
        <mesh position={[0, bodyH / 2 + 0.4, 0]} material={tier >= 2 ? m.hull : m.hullDark}>
          <boxGeometry args={[bodyW, bodyH, bodyW - 0.3]} />
        </mesh>
        {/* Pitched roof / Penthouse deck */}
        {prop.kind === 'estate' ? (
          <mesh position={[0, bodyH + 0.85, 0]} material={tier >= 3 ? m.gold : m.hull}>
            <boxGeometry args={[bodyW - 0.5, 0.9, bodyW - 0.8]} />
          </mesh>
        ) : (
          <mesh position={[0, bodyH + 1.15, 0]} rotation={[0, Math.PI / 4, 0]} material={tier >= 3 ? m.gold : m.hull}>
            <coneGeometry args={[bodyW * 0.78, 1.5, 4]} />
          </mesh>
        )}
        {/* Shop awning */}
        {(prop.kind === 'shop' || prop.kind === 'tavern') && (
          <mesh position={[0, 2.35, bodyW * 0.52]} rotation={[0.25, 0, 0]} material={m.holo}>
            <boxGeometry args={[bodyW * 0.86, 0.18, 1.1]} />
          </mesh>
        )}
        {/* Neon Ownership / Tier Trim */}
        <mesh position={[0, bodyH + 0.42, 0]} material={tier >= 2 ? trimMat : accentMat}>
          <boxGeometry args={[bodyW + 0.18, 0.16, bodyW - 0.12]} />
        </mesh>
        {tier >= 3 && (
          <mesh position={[0, bodyH + 2.35, 0]} material={m.gold}>
            <octahedronGeometry args={[0.42, 0]} />
          </mesh>
        )}
      </group>

      {/* Interactive Deed Signpost */}
      <group position={[prop.signX, 0, prop.signZ]}>
        <mesh position={[0, 0.75, 0]} material={m.hullDark}><cylinderGeometry args={[0.12, 0.16, 1.5, 6]} /></mesh>
        <mesh position={[0, 1.25, 0]} material={m.hull}><boxGeometry args={[0.85, 0.55, 0.12]} /></mesh>
        <mesh ref={gemRef} position={[0, 1.85, 0]} material={trimMat}><octahedronGeometry args={[0.26, 0]} /></mesh>
        <mesh position={[0, 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]} material={ringMat}>
          <ringGeometry args={[1.6, 1.85, 14]} />
        </mesh>
        <SpriteText position={[0, 2.75, 0]} fontSize={0.34} color={statusColor} outlineWidth={0.04} outlineColor="#05030a">
          {signLabel}
        </SpriteText>
      </group>
    </group>
  );
}

function ColosseumGateView({ col }: { col: ColosseumDef }) {
  const m = useMemo(getSharedMats, []);
  const ring = useRef<THREE.Mesh>(null!);
  const ringMat = useMemo(() => makeCurvedBasicMaterial({ color: col.color }), [col.color]);
  const portalMat = useMemo(
    () => makeCurvedBasicMaterial({ color: col.color, transparent: true, opacity: 0.28, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }),
    [col.color],
  );
  const floorMat = useMemo(() => makeCurvedBasicMaterial({ color: col.color, transparent: true, opacity: 0.45 }), [col.color]);

  useFrame(({ clock }) => {
    if (ring.current) ring.current.rotation.z = clock.elapsedTime * 0.9;
  });

  return (
    <group position={[col.x, 0, col.z]}>
      {([-2.6, 2.6] as const).map((x) => (
        <group key={x} position={[x, 0, 0]}>
          <mesh position={[0, 0.25, 0]} material={m.hullDark}><boxGeometry args={[1.7, 0.5, 1.7]} /></mesh>
          <mesh position={[0, 3.4, 0]} material={m.hull}><boxGeometry args={[1.35, 6.4, 1.35]} /></mesh>
          <mesh position={[0, 6.65, 0]} material={m.gold}><boxGeometry args={[1.55, 0.32, 1.55]} /></mesh>
        </group>
      ))}
      <mesh position={[0, 7.1, 0]} material={m.hull}><boxGeometry args={[7.4, 0.95, 1.65]} /></mesh>
      <mesh position={[0, 7.8, 0]} material={m.gold}><boxGeometry args={[7.8, 0.34, 1.85]} /></mesh>
      <mesh ref={ring} position={[0, 3.3, 0]} material={ringMat}><torusGeometry args={[2.1, 0.12, 6, 20]} /></mesh>
      <mesh position={[0, 3.3, 0]} material={portalMat}><circleGeometry args={[2.05, 16]} /></mesh>
      <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]} material={floorMat}>
        <ringGeometry args={[3.9, 4.2, 16]} />
      </mesh>
      <Brazier position={[-3.9, 0, 1.4]} scale={0.95} color={col.color} light />
      <Brazier position={[3.9, 0, 1.4]} scale={0.95} color={col.secondary} />
      <SpriteText position={[0, 9.4, 0]} fontSize={0.56} color={col.color} letterSpacing={0.1} outlineWidth={0.04} outlineColor="#05030a">
        {col.name}
      </SpriteText>
    </group>
  );
}

function CapitalView({ s }: { s: Settlement }) {
  const m = useMemo(getSharedMats, []);
  const buildings = useMemo(() => settlementBuildings(s), [s]);
  const terminals = useMemo(() => settlementTerminals(s), [s]);
  const accentMat = useMemo(() => makeCurvedBasicMaterial({ color: s.accent }), [s.accent]);
  const secMat = useMemo(() => makeCurvedBasicMaterial({ color: s.secondary }), [s.secondary]);
  const haloRef = useRef<THREE.Mesh>(null!);

  useFrame(({ clock }) => {
    if (haloRef.current) haloRef.current.rotation.z = clock.elapsedTime * 0.45;
  });

  const bodyMat =
    s.biome === 'bazaar' ? m.wood
    : s.biome === 'vault' ? m.crystal
    : s.biome === 'frontier' ? m.rust
    : s.biome === 'kernel' ? m.gold
    : m.hull;

  return (
    <group>
      {/* Central Town Plaza Disc */}
      <mesh position={[s.x, 0.03, s.z]} rotation={[-Math.PI / 2, 0, 0]} material={m.hullDark}>
        <circleGeometry args={[28, 16]} />
      </mesh>
      <mesh position={[s.x, 0.06, s.z]} rotation={[-Math.PI / 2, 0, 0]} material={accentMat}>
        <ringGeometry args={[27.2, 28, 16]} />
      </mesh>

      {/* Signature Capital Centerpiece */}
      {s.biome === 'kernel' ? (
        <group position={[s.x, 0, s.z - 22]}>
          <mesh position={[0, 48, 0]} material={m.gold}><cylinderGeometry args={[1.6, 5.4, 96, 8]} /></mesh>
          <mesh position={[0, 102, 0]} material={secMat}><octahedronGeometry args={[4.5, 0]} /></mesh>
          <mesh ref={haloRef} position={[0, 74, 0]} rotation={[Math.PI / 2.2, 0, 0]} material={accentMat}>
            <torusGeometry args={[12, 0.55, 6, 16]} />
          </mesh>
        </group>
      ) : s.biome === 'vault' ? (
        <group position={[s.x, 0, s.z]}>
          <mesh position={[0, 5.5, 0]} material={m.crystal}><octahedronGeometry args={[2.6, 0]} /></mesh>
          <mesh position={[0, 0.8, 0]} material={accentMat}><torusGeometry args={[3.4, 0.16, 6, 12]} /></mesh>
        </group>
      ) : s.biome === 'bazaar' ? (
        <group position={[s.x, 0, s.z]}>
          <mesh position={[0, 4.2, 0]} material={m.wood}><cylinderGeometry args={[0.5, 0.9, 8.4, 6]} /></mesh>
          <mesh position={[0, 8.6, 0]} material={accentMat}><octahedronGeometry args={[1.2, 0]} /></mesh>
          <mesh position={[0, 6.2, 0]} material={m.holo}><boxGeometry args={[7.4, 0.35, 0.35]} /></mesh>
        </group>
      ) : (
        <group position={[s.x, 0, s.z]}>
          <mesh position={[0, 4.6, 0]} rotation={[0.12, 0.4, 0.08]} material={m.rust}><cylinderGeometry args={[0.9, 2.2, 9.2, 4]} /></mesh>
          <mesh position={[0, 9.8, 0]} material={accentMat}><octahedronGeometry args={[1.3, 0]} /></mesh>
        </group>
      )}

      {/* Seeded Architecture Ring */}
      {buildings.map((b, i) => (
        <group key={i} position={[b.x, 0, b.z]}>
          <mesh position={[0, b.h / 2, 0]} material={bodyMat}><boxGeometry args={[b.w, b.h, b.d]} /></mesh>
          <mesh position={[0, b.h + 0.25, 0]} material={i % 2 === 0 ? accentMat : secMat}>
            <boxGeometry args={[b.w * 0.84, 0.35, b.d * 0.84]} />
          </mesh>
          {b.kind === 'spire' && (
            <mesh position={[0, b.h + 4.5, 0]} material={secMat}><coneGeometry args={[b.w * 0.42, 8.5, 4]} /></mesh>
          )}
        </group>
      ))}

      {/* Service Terminals (Pod / Forge / Clinic / Kiosk) */}
      {terminals.map((t) => (
        <group key={t.kind} position={[t.x, 0, t.z]}>
          <mesh position={[0, 0.2, 0]} material={m.hullDark}><boxGeometry args={[3.2, 0.4, 2.6]} /></mesh>
          <mesh position={[0, 1.3, 0]} material={m.hull}><boxGeometry args={[2.1, 1.8, 1.2]} /></mesh>
          <mesh position={[0, 2.4, 0]} material={t.kind === 'bunk' ? secMat : accentMat}><boxGeometry args={[2.3, 0.22, 1.4]} /></mesh>
          <SpriteText position={[0, 3.3, 0]} fontSize={0.38} color={t.color} outlineWidth={0.04} outlineColor="#05030a">
            {t.label}
          </SpriteText>
        </group>
      ))}

      {/* Capital Colosseum Gate */}
      {s.colosseum && <ColosseumGateView col={s.colosseum} />}

      <SpriteText position={[s.x, 12.5, s.z]} fontSize={0.9} color={s.accent} outlineWidth={0.05} outlineColor="#05030a">
        {`${s.name} · ${s.code}`}
      </SpriteText>
    </group>
  );
}

function SatelliteView({ s }: { s: Settlement }) {
  const m = useMemo(getSharedMats, []);
  const buildings = useMemo(() => settlementBuildings(s), [s]);
  const accentMat = useMemo(() => makeCurvedBasicMaterial({ color: s.accent }), [s.accent]);
  const bodyMat = s.biome === 'vault' ? m.crystal : s.biome === 'bazaar' ? m.wood : s.biome === 'frontier' ? m.rust : m.hull;

  return (
    <group>
      <mesh position={[s.x, 0.025, s.z]} rotation={[-Math.PI / 2, 0, 0]} material={m.hullDark}>
        <circleGeometry args={[18, 12]} />
      </mesh>
      <mesh position={[s.x, 0.05, s.z]} rotation={[-Math.PI / 2, 0, 0]} material={accentMat}>
        <ringGeometry args={[17.4, 18, 12]} />
      </mesh>
      <Brazier position={[s.x, 0, s.z]} scale={1.05} color={s.accent} />
      {buildings.map((b, i) => (
        <group key={i} position={[b.x, 0, b.z]}>
          <mesh position={[0, b.h / 2, 0]} material={bodyMat}><boxGeometry args={[b.w, b.h, b.d]} /></mesh>
          <mesh position={[0, b.h + 0.2, 0]} material={accentMat}><boxGeometry args={[b.w * 0.8, 0.25, b.d * 0.8]} /></mesh>
        </group>
      ))}
      <SpriteText position={[s.x, 5.8, s.z]} fontSize={0.62} color={s.accent} outlineWidth={0.04} outlineColor="#05030a">
        {`${s.name} (${s.code})`}
      </SpriteText>
    </group>
  );
}

/** Distant capital skyline markers projecting along the R=200 curved horizon rim so towers visibly rise & sink as you ride. */
function DistantCapitalHorizonSilhouette({
  cap,
  playerPos,
}: {
  cap: Settlement;
  playerPos: React.MutableRefObject<THREE.Vector3>;
}) {
  const grp = useRef<THREE.Group>(null!);
  const spireMat = useMemo(() => new THREE.MeshBasicMaterial({ color: cap.accent, transparent: true, opacity: 0.72, fog: false }), [cap.accent]);
  const bodyMat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#141936', fog: false }), []);
  const isKernel = cap.id === 'kernel_spire';
  const h = isKernel ? 120 : 68;

  useFrame(() => {
    if (!grp.current) return;
    const px = playerPos.current.x;
    const pz = playerPos.current.z;
    const dx = cap.x - px;
    const dz = cap.z - pz;
    const dist = Math.hypot(dx, dz) || 1;
    const rimDist = 185;
    const inv = 1 / dist;
    const rimDrop = curveDrop(rimDist, 0, CITY_CURVE_RADIUS);
    const maxRange = isKernel ? 2800 : 880;
    const t = THREE.MathUtils.clamp((dist - 270) / (maxRange - 270), 0, 1);
    const lift = isKernel ? 102 - t * 34 : 62 - t * 38;
    grp.current.position.set(px + dx * inv * rimDist, -rimDrop + lift, pz + dz * inv * rimDist);
    grp.current.visible = dist >= 265 && dist <= maxRange;
  });

  return (
    <group ref={grp}>
      <mesh position={[0, h / 2, 0]} material={bodyMat} frustumCulled={false}>
        <cylinderGeometry args={[isKernel ? 2.2 : 3.4, isKernel ? 7.5 : 5.8, h, 6]} />
      </mesh>
      <mesh position={[0, h + 10, 0]} material={spireMat} frustumCulled={false}>
        <octahedronGeometry args={[isKernel ? 8 : 4.2, 0]} />
      </mesh>
      {isKernel && (
        <mesh position={[0, h * 0.72, 0]} rotation={[Math.PI / 2.2, 0, 0]} material={spireMat} frustumCulled={false}>
          <torusGeometry args={[18, 0.95, 6, 16]} />
        </mesh>
      )}
    </group>
  );
}

/** Streams nearby Capitals, Satellites, Properties, and Distant Horizon Landmarks cleanly for 60 FPS. */
export function StreamingSettlements({ playerPos }: { playerPos: React.MutableRefObject<THREE.Vector3> }) {
  const [vis, setVis] = useState<{
    capitals: string[];
    satellites: string[];
    distant: string[];
    propSettlements: string[];
    key: string;
  }>({
    capitals: [],
    satellites: [],
    distant: ['kernel_spire'],
    propSettlements: ['cache_city'],
    key: 'init',
  });
  const checkTimer = useRef(0);

  useFrame((_, delta) => {
    checkTimer.current += delta;
    if (checkTimer.current < 0.28) return;
    checkTimer.current = 0;

    const px = playerPos.current.x;
    const pz = playerPos.current.z;

    const capitals: string[] = [];
    const distant: string[] = [];
    const propSettlements: string[] = [];

    for (const c of CAPITALS) {
      const d = Math.hypot(c.x - px, c.z - pz);
      if (d < 250) propSettlements.push(c.id);
      if (c.id !== 'cache_city' && d < 290) capitals.push(c.id);
      else if (d >= 265 && (d < 880 || c.id === 'kernel_spire')) distant.push(c.id);
    }

    const satellites: string[] = [];
    for (const s of SATELLITES) {
      const d = Math.hypot(s.x - px, s.z - pz);
      if (d < 240) {
        satellites.push(s.id);
        propSettlements.push(s.id);
      }
    }

    const key = `${capitals.join(',')}|${satellites.join(',')}|${distant.join(',')}|${propSettlements.join(',')}`;
    if (key !== vis.key) {
      setVis({ capitals, satellites, distant, propSettlements, key });
    }
  });

  // Dispose shared cache safely only if needed — module-level cachedShared persists cleanly for scene lifetime
  useEffect(() => () => { /* keep cachedShared pooled across scene switches */ }, []);

  const propSet = new Set(vis.propSettlements);
  const activeProps = PROPERTIES.filter((p) => propSet.has(p.settlementId));
  const claimedEchoes = useGame((s) => s.claimedEchoes);

  return (
    <group>
      {CAPITALS.filter((c) => vis.capitals.includes(c.id)).map((c) => <CapitalView key={c.id} s={c} />)}
      {SATELLITES.filter((s) => vis.satellites.includes(s.id)).map((s) => <SatelliteView key={s.id} s={s} />)}
      {CAPITALS.filter((c) => vis.distant.includes(c.id)).map((c) => (
        <DistantCapitalHorizonSilhouette key={`dist-${c.id}`} cap={c} playerPos={playerPos} />
      ))}
      {activeProps.map((p) => <PropertyDeedView key={p.id} prop={p} />)}
      <MemoryWoodsAndFlora playerPos={playerPos} claimedEchoes={claimedEchoes} />
    </group>
  );
}
