import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { makeCurvedBasicMaterial } from './curvature';
import { getPs1Texture, makePs1Material } from './ps1Textures';

export interface CycleRenderState {
  active: boolean;
  x: number;
  z: number;
  yaw: number;
  lean: number;
  speed: number;
  turbo: boolean;
}

const TRAIL_CAP = 24;
const SEG_COUNT = TRAIL_CAP * 2; // twin left + right light ribbons

interface TrailSample {
  x: number;
  z: number;
  yaw: number;
  life: number;
}

export function LightCycle({
  stateRef,
  color = '#3ff0ff',
}: {
  stateRef: React.MutableRefObject<CycleRenderState>;
  color?: string;
}) {
  const bikeGroup = useRef<THREE.Group>(null!);
  const bodyTilt = useRef<THREE.Group>(null!);
  const wheelF = useRef<THREE.Mesh>(null!);
  const wheelR = useRef<THREE.Mesh>(null!);
  const trailMesh = useRef<THREE.InstancedMesh>(null!);

  const mats = useMemo(() => ({
    hull: makePs1Material({ color: '#1a203d', map: getPs1Texture('conduit'), emissive: '#0c1c36', emissiveIntensity: 0.45 }),
    trim: makeCurvedBasicMaterial({ color }),
    accent: makeCurvedBasicMaterial({ color: '#ff4fd8' }),
    core: makeCurvedBasicMaterial({ color: '#e8fbff' }),
    trail: makeCurvedBasicMaterial({ color, transparent: true, opacity: 0.72, blending: THREE.AdditiveBlending, depthWrite: false }),
  }), [color]);

  const trail = useMemo(() => {
    const samples: TrailSample[] = Array.from({ length: TRAIL_CAP }, () => ({ x: 0, z: 0, yaw: 0, life: 0 }));
    return {
      samples,
      head: 0,
      lastX: 0,
      lastZ: 0,
      hasPrev: false,
      obj: new THREE.Object3D(),
    };
  }, []);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    const st = stateRef.current;

    if (bikeGroup.current) {
      bikeGroup.current.visible = st.active;
      if (st.active) {
        bikeGroup.current.position.set(st.x, 0, st.z);
        bikeGroup.current.rotation.y = st.yaw;
      }
    }
    if (bodyTilt.current && st.active) {
      bodyTilt.current.rotation.z = st.lean;
    }
    const spin = st.speed * dt * 1.45;
    if (wheelF.current && st.active) wheelF.current.rotation.x += spin;
    if (wheelR.current && st.active) wheelR.current.rotation.x += spin;

    // Update twin curved Hard-Light ribbon trail ring buffer
    const tm = trailMesh.current;
    if (!tm) return;

    if (st.active && st.speed > 4) {
      if (!trail.hasPrev) {
        trail.lastX = st.x;
        trail.lastZ = st.z;
        trail.hasPrev = true;
      } else if (Math.hypot(st.x - trail.lastX, st.z - trail.lastZ) >= 1.15) {
        const s = trail.samples[trail.head];
        s.x = st.x;
        s.z = st.z;
        s.yaw = st.yaw;
        s.life = st.turbo ? 1.1 : 0.85;
        trail.head = (trail.head + 1) % TRAIL_CAP;
        trail.lastX = st.x;
        trail.lastZ = st.z;
      }
    } else if (!st.active) {
      trail.hasPrev = false;
    }

    const o = trail.obj;
    let anyVisible = false;
    for (let i = 0; i < TRAIL_CAP; i++) {
      const s = trail.samples[i];
      if (s.life > 0) {
        s.life = Math.max(0, s.life - dt * 1.15);
      }
      const rx = Math.cos(s.yaw);
      const rz = -Math.sin(s.yaw);
      for (let side = 0; side < 2; side++) {
        const idx = i * 2 + side;
        if (s.life <= 0.02) {
          o.position.set(0, -100, 0);
          o.scale.set(0.001, 0.001, 0.001);
        } else {
          anyVisible = true;
          const lat = side === 0 ? -0.36 : 0.36;
          o.position.set(s.x + rx * lat, 0.28 * s.life, s.z + rz * lat);
          o.rotation.set(0, s.yaw, 0);
          o.scale.set(0.08, 0.44 * s.life, 1.35);
        }
        o.updateMatrix();
        tm.setMatrixAt(idx, o.matrix);
      }
    }
    tm.visible = anyVisible;
    if (anyVisible) tm.instanceMatrix.needsUpdate = true;
  });

  return (
    <group>
      <group ref={bikeGroup} visible={false}>
        <group ref={bodyTilt}>
          {/* Lower chassis keel */}
          <mesh position={[0, 0.44, 0]} material={mats.hull}>
            <boxGeometry args={[0.56, 0.36, 2.35]} />
          </mesh>
          {/* Upper angular fairing nose */}
          <mesh position={[0, 0.68, 0.42]} rotation={[0.24, 0, 0]} material={mats.hull}>
            <boxGeometry args={[0.52, 0.28, 1.15]} />
          </mesh>
          {/* Glowing front canopy visor */}
          <mesh position={[0, 0.82, 0.55]} rotation={[0.42, 0, 0]} material={mats.trim}>
            <boxGeometry args={[0.42, 0.14, 0.72]} />
          </mesh>
          {/* Rear cowling stabilizer & dual booster pods */}
          <mesh position={[0, 0.78, -0.78]} rotation={[-0.25, 0, 0]} material={mats.hull}>
            <boxGeometry args={[0.58, 0.32, 0.75]} />
          </mesh>
          {([-0.24, 0.24] as const).map((lx) => (
            <group key={lx}>
              <mesh position={[lx, 0.48, 0]} material={mats.trim}>
                <boxGeometry args={[0.09, 0.1, 2.2]} />
              </mesh>
              <mesh position={[lx, 0.62, -1.12]} material={mats.accent}>
                <boxGeometry args={[0.14, 0.14, 0.28]} />
              </mesh>
            </group>
          ))}
          {/* Twin Octagonal Hard-Light Wheels */}
          <mesh ref={wheelF} position={[0, 0.42, 1.05]} rotation={[0, 0, Math.PI / 2]} material={mats.trim}>
            <cylinderGeometry args={[0.42, 0.42, 0.24, 8]} />
          </mesh>
          <mesh position={[0, 0.42, 1.05]} rotation={[0, 0, Math.PI / 2]} material={mats.core}>
            <cylinderGeometry args={[0.2, 0.2, 0.26, 8]} />
          </mesh>
          <mesh ref={wheelR} position={[0, 0.42, -0.95]} rotation={[0, 0, Math.PI / 2]} material={mats.trim}>
            <cylinderGeometry args={[0.44, 0.44, 0.3, 8]} />
          </mesh>
          <mesh position={[0, 0.42, -0.95]} rotation={[0, 0, Math.PI / 2]} material={mats.core}>
            <cylinderGeometry args={[0.22, 0.22, 0.32, 8]} />
          </mesh>
        </group>
      </group>

      <instancedMesh ref={trailMesh} args={[undefined, undefined, SEG_COUNT]} material={mats.trail} frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
      </instancedMesh>
    </group>
  );
}
