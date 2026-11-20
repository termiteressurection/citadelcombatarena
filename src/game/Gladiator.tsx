import { forwardRef, useRef, useImperativeHandle, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { Atk, State } from './arena/combat';

export interface Pose {
  state: State;
  atk: Atk | null;
  progress: number;
  /** 0..1, shield arm raised */
  block: number;
  /** 0..1 enemy attack telegraph glow */
  telegraph: number;
  /** 0..1 hit flash / stagger */
  hurt: number;
  /** 0 = calm walk (Ludus), 1 = crouched combat stance (Arena) */
  stance: number;
  /** normalized fighter-local velocity (-1..1) */
  localVx: number;
  localVz: number;
  /** normalized fighter-local dodge vector */
  dodgeLocalX: number;
  dodgeLocalZ: number;
}

export interface GladiatorHandle { group: THREE.Group; pose: Pose; setMoving: (speed01: number) => void }

const THICK = 0.075;
const GAP = 0.05;

/** One bright dash with a gap at each end, like the Last Hero's customization rig. */
function Dash({ len, w = THICK, y = 0, mat }: { len: number; w?: number; y?: number; mat: THREE.Material }) {
  return <mesh position={[0, y - len / 2, 0]} material={mat}><boxGeometry args={[w, Math.max(0.05, len - GAP * 2), w]} /></mesh>;
}

const smooth = (cur: number, target: number, rate: number, dt: number) =>
  THREE.MathUtils.lerp(cur, target, 1 - Math.exp(-rate * dt));

/** Articulated stick-figure gladiator: stark Nostalgaia dashes with full-body combat choreography. */
export const Gladiator = forwardRef<GladiatorHandle, { color: string; accent?: string; scale?: number }>(
  function Gladiator({ color, scale = 1 }, ref) {
    const group = useRef<THREE.Group>(null!);
    const root = useRef<THREE.Group>(null!);
    const upper = useRef<THREE.Group>(null!);
    const head = useRef<THREE.Group>(null!);
    const hipL = useRef<THREE.Group>(null!), hipR = useRef<THREE.Group>(null!);
    const kneeL = useRef<THREE.Group>(null!), kneeR = useRef<THREE.Group>(null!);
    const shL = useRef<THREE.Group>(null!), shR = useRef<THREE.Group>(null!);
    const elL = useRef<THREE.Group>(null!), elR = useRef<THREE.Group>(null!);

    const speed = useRef(0);
    const phase = useRef(0);
    const pose = useRef<Pose>({
      state: 'idle', atk: null, progress: 0,
      block: 0, telegraph: 0, hurt: 0, stance: 0,
      localVx: 0, localVz: 0, dodgeLocalX: 0, dodgeLocalZ: 0,
    });

    const base = useMemo(() => new THREE.Color(color).lerp(new THREE.Color('#ffffff'), 0.72), [color]);
    const mat = useMemo(() => new THREE.MeshBasicMaterial({ color: base }), [base]);
    const swordMat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#ffffff' }), []);
    const warn = useMemo(() => new THREE.Color('#ff3b3b'), []);
    const white = useMemo(() => new THREE.Color('#ffffff'), []);

    useImperativeHandle(ref, () => ({ group: group.current, pose: pose.current, setMoving: (s) => { speed.current = s; } }), []);

    useFrame((_, delta) => {
      const dt = Math.min(delta, 0.05);
      const p = pose.current;
      const st = p.stance;

      // Movement vector in fighter-local space (fallback to speed.current in Ludus)
      let lvx = p.localVx;
      let lvz = p.localVz;
      if (st < 0.05 && Math.hypot(lvx, lvz) < 0.01 && speed.current > 0.01) {
        lvz = speed.current;
      }
      const moveMag = Math.min(1, Math.hypot(lvx, lvz));
      phase.current += dt * (3.5 + moveMag * 8.5);
      const sw = Math.sin(phase.current) * moveMag;
      const cs = Math.cos(phase.current);

      // Base ready stance targets
      let pelvisY = 0.92 - 0.11 * st + Math.abs(cs) * 0.05 * moveMag;
      let rootPitch = 0.08 * lvz;
      let rootRoll = -lvx * 0.14;

      let upperX = 0.14 * st + 0.12 * lvz;
      let upperY = -0.28 * st;
      let upperZ = 0;
      let headX = -upperX * 0.5;

      // Left leg (+X), Right leg (-X); orthodox guard has left foot forward
      let hipLX = -0.22 * st + sw * 0.72;
      let hipRX = 0.20 * st - sw * 0.72;
      let hipLZ = 0.08 * st + Math.sin(phase.current) * Math.abs(lvx) * 0.32;
      let hipRZ = -0.08 * st - Math.sin(phase.current) * Math.abs(lvx) * 0.32;
      let kneeLX = 0.34 * st + Math.max(0, -cs) * 0.85 * moveMag;
      let kneeRX = 0.26 * st + Math.max(0, cs) * 0.85 * moveMag;

      // Shield arm (left, +X)
      let shLX = THREE.MathUtils.lerp(-0.32 * st + sw * 0.3, -0.92, p.block);
      let shLY = THREE.MathUtils.lerp(0, -0.35, p.block);
      let shLZ = THREE.MathUtils.lerp(0.18, 0.05, p.block);
      let elLX = THREE.MathUtils.lerp(-0.45 - 0.45 * st, -1.25, p.block);

      // Sword arm (right, -X)
      let shRX = -0.38 * st - sw * 0.35;
      let shRY = 0;
      let shRZ = -0.18 - 0.08 * st;
      let elRX = -0.45 - 0.35 * st;

      let blend = 14;
      const k = Math.max(0, Math.min(1, p.progress));

      if (p.state === 'dodge') {
        const arc = Math.sin(Math.PI * k);
        pelvisY = 0.92 - 0.36 * arc;
        rootRoll = -p.dodgeLocalX * 0.55 * arc;
        rootPitch = p.dodgeLocalZ * 0.65 * arc;
        upperX = 0.48 * arc;
        hipLX = -0.82 * arc; hipRX = -0.82 * arc;
        kneeLX = 1.25 * arc; kneeRX = 1.25 * arc;
        shLX = -0.85; elLX = -1.45;
        shRX = -0.85; elRX = -1.45;
        blend = 22;
      } else if (p.state === 'stagger') {
        const h = p.hurt;
        upperX = -0.42 * h;
        headX = -0.35 * h;
        shLZ = 0.65 * h + 0.18;
        shRZ = -0.65 * h - 0.18;
        shLX = -0.2; shRX = -0.2;
        blend = 20;
      } else if (p.atk && (p.state === 'windup' || p.state === 'strike' || p.state === 'recover')) {
        blend = p.state === 'strike' ? 28 : 18;
        if (p.atk === 'light') {
          if (p.state === 'windup') {
            upperY = THREE.MathUtils.lerp(-0.28, -0.78, k);
            shRX = THREE.MathUtils.lerp(-0.38, -1.12, k);
            shRZ = THREE.MathUtils.lerp(-0.26, -0.95, k);
            elRX = -0.75;
          } else if (p.state === 'strike') {
            upperY = THREE.MathUtils.lerp(-0.78, 0.85, k);
            upperX = 0.28;
            shRX = THREE.MathUtils.lerp(-1.12, -1.35, k);
            shRZ = THREE.MathUtils.lerp(-0.95, 0.92, k);
            elRX = -0.22;
          } else {
            upperY = THREE.MathUtils.lerp(0.85, -0.28, k);
            shRX = THREE.MathUtils.lerp(-1.35, -0.38, k);
            shRZ = THREE.MathUtils.lerp(0.92, -0.26, k);
            elRX = THREE.MathUtils.lerp(-0.22, -0.8, k);
          }
        } else if (p.atk === 'light2') {
          if (p.state === 'windup') {
            upperY = THREE.MathUtils.lerp(0.45, 0.88, k);
            shRX = -1.15;
            shRZ = THREE.MathUtils.lerp(0.4, 0.9, k);
            elRX = -0.5;
          } else if (p.state === 'strike') {
            upperY = THREE.MathUtils.lerp(0.88, -0.88, k);
            upperX = 0.28;
            shRX = -1.35;
            shRZ = THREE.MathUtils.lerp(0.9, -1.05, k);
            elRX = -0.2;
          } else {
            upperY = THREE.MathUtils.lerp(-0.88, -0.28, k);
            shRX = THREE.MathUtils.lerp(-1.35, -0.38, k);
            shRZ = THREE.MathUtils.lerp(-1.05, -0.26, k);
            elRX = THREE.MathUtils.lerp(-0.2, -0.8, k);
          }
        } else if (p.atk === 'light3') {
          if (p.state === 'windup') {
            pelvisY -= 0.14 * k;
            upperY = THREE.MathUtils.lerp(-0.4, -0.98, k);
            shRX = THREE.MathUtils.lerp(-0.5, -2.25, k);
            shRZ = -0.58;
            elRX = -0.42;
          } else if (p.state === 'strike') {
            pelvisY -= 0.08 * (1 - k);
            upperX = 0.42;
            upperY = THREE.MathUtils.lerp(-0.98, 1.05, k);
            shRX = THREE.MathUtils.lerp(-2.25, -0.32, k);
            shRZ = THREE.MathUtils.lerp(-0.58, 0.72, k);
            elRX = -0.14;
          } else {
            upperX = THREE.MathUtils.lerp(0.42, 0.14, k);
            upperY = THREE.MathUtils.lerp(1.05, -0.28, k);
            shRX = THREE.MathUtils.lerp(-0.32, -0.38, k);
            shRZ = THREE.MathUtils.lerp(0.72, -0.26, k);
            elRX = THREE.MathUtils.lerp(-0.14, -0.8, k);
          }
        } else if (p.atk === 'heavy') {
          if (p.state === 'windup') {
            upperX = THREE.MathUtils.lerp(0.14, -0.22, k);
            upperY = THREE.MathUtils.lerp(-0.28, -0.45, k);
            shRX = THREE.MathUtils.lerp(-0.4, -2.85, k);
            shRZ = -0.1;
            elRX = -0.35;
          } else if (p.state === 'strike') {
            pelvisY -= 0.16 * k;
            upperX = THREE.MathUtils.lerp(-0.22, 0.48, k);
            upperY = THREE.MathUtils.lerp(-0.45, 0.35, k);
            shRX = THREE.MathUtils.lerp(-2.85, -0.15, k);
            elRX = -0.1;
          } else {
            pelvisY -= 0.16 * (1 - k);
            upperX = THREE.MathUtils.lerp(0.48, 0.14, k);
            upperY = THREE.MathUtils.lerp(0.35, -0.28, k);
            shRX = THREE.MathUtils.lerp(-0.15, -0.38, k);
            elRX = THREE.MathUtils.lerp(-0.1, -0.8, k);
          }
        } else if (p.atk === 'bash') {
          if (p.state === 'windup') {
            upperY = THREE.MathUtils.lerp(-0.28, 0.45, k);
            shLX = -0.65; shLY = 0.2; elLX = -1.45;
          } else if (p.state === 'strike') {
            upperY = THREE.MathUtils.lerp(0.45, -0.82, k);
            upperX = 0.34;
            shLX = -1.45; shLY = -0.25; elLX = -0.38;
            shRX = 0.45;
          } else {
            upperY = THREE.MathUtils.lerp(-0.82, -0.28, k);
            upperX = THREE.MathUtils.lerp(0.34, 0.14, k);
            shLX = THREE.MathUtils.lerp(-1.45, -0.32, k);
            elLX = THREE.MathUtils.lerp(-0.38, -0.9, k);
          }
        }
      }

      // Apply smooth damping to every joint
      root.current.position.y = smooth(root.current.position.y, pelvisY, blend, dt);
      root.current.rotation.x = smooth(root.current.rotation.x, rootPitch, blend, dt);
      root.current.rotation.z = smooth(root.current.rotation.z, rootRoll, blend, dt);

      upper.current.rotation.x = smooth(upper.current.rotation.x, upperX, blend, dt);
      upper.current.rotation.y = smooth(upper.current.rotation.y, upperY, blend, dt);
      upper.current.rotation.z = smooth(upper.current.rotation.z, upperZ, blend, dt);

      head.current.rotation.y = -upper.current.rotation.y * 0.55;
      head.current.rotation.x = smooth(head.current.rotation.x, headX, blend, dt);

      hipL.current.rotation.x = smooth(hipL.current.rotation.x, hipLX, blend, dt);
      hipR.current.rotation.x = smooth(hipR.current.rotation.x, hipRX, blend, dt);
      hipL.current.rotation.z = smooth(hipL.current.rotation.z, hipLZ, blend, dt);
      hipR.current.rotation.z = smooth(hipR.current.rotation.z, hipRZ, blend, dt);
      kneeL.current.rotation.x = smooth(kneeL.current.rotation.x, kneeLX, blend, dt);
      kneeR.current.rotation.x = smooth(kneeR.current.rotation.x, kneeRX, blend, dt);

      shL.current.rotation.x = smooth(shL.current.rotation.x, shLX, blend, dt);
      shL.current.rotation.y = smooth(shL.current.rotation.y, shLY, blend, dt);
      shL.current.rotation.z = smooth(shL.current.rotation.z, shLZ, blend, dt);
      elL.current.rotation.x = smooth(elL.current.rotation.x, elLX, blend, dt);

      shR.current.rotation.x = smooth(shR.current.rotation.x, shRX, blend, dt);
      shR.current.rotation.y = smooth(shR.current.rotation.y, shRY, blend, dt);
      shR.current.rotation.z = smooth(shR.current.rotation.z, shRZ, blend, dt);
      elR.current.rotation.x = smooth(elR.current.rotation.x, elRX, blend, dt);

      mat.color.copy(base).lerp(warn, p.telegraph).lerp(white, p.hurt);
      swordMat.color.copy(white).lerp(warn, p.telegraph);
    });

    return (
      <group ref={group} scale={scale}>
        <group ref={root} position={[0, 0.92, 0]}>
          {/* legs hanging from pelvis origin (0, 0.92, 0) */}
          {[['L', 0.11, hipL, kneeL], ['R', -0.11, hipR, kneeR]].map(([k, x, hip, knee]) => (
            <group key={k as string} ref={hip as React.RefObject<THREE.Group>} position={[x as number, 0, 0]}>
              <Dash len={0.46} w={THICK * 1.5} mat={mat} />
              <group ref={knee as React.RefObject<THREE.Group>} position={[0, -0.46, 0]}>
                <Dash len={0.46} w={THICK * 1.3} mat={mat} />
              </group>
            </group>
          ))}
          {/* articulated torso + head + arms */}
          <group ref={upper} position={[0, 0.04, 0]}>
            <mesh position={[0, 0.30, 0]} material={mat}><boxGeometry args={[THICK * 1.3, 0.56, THICK * 1.3]} /></mesh>
            <group ref={head} position={[0, 0.72, 0]}>
              <mesh position={[0, 0.18, 0]} material={mat}><boxGeometry args={[THICK, 0.22, THICK]} /></mesh>
            </group>
            {/* left arm (+X) + shield */}
            <group ref={shL} position={[0.22, 0.58, 0]} rotation={[0, 0, 0.18]}>
              <Dash len={0.34} mat={mat} />
              <group ref={elL} position={[0, -0.34, 0]}>
                <Dash len={0.32} mat={mat} />
                <mesh position={[0.06, -0.26, 0.12]} rotation={[0, Math.PI / 2, 0]} material={mat}>
                  <ringGeometry args={[0.22, 0.29, 10]} />
                </mesh>
              </group>
            </group>
            {/* right arm (-X) + sword */}
            <group ref={shR} position={[-0.22, 0.58, 0]} rotation={[0, 0, -0.18]}>
              <Dash len={0.34} mat={mat} />
              <group ref={elR} position={[0, -0.34, 0]}>
                <Dash len={0.32} mat={mat} />
                <group position={[0, -0.32, 0]} rotation={[-0.4, 0, 0]}>
                  <mesh position={[0, -0.44, 0]} material={swordMat}><boxGeometry args={[0.055, 0.92, 0.055]} /></mesh>
                </group>
              </group>
            </group>
          </group>
        </group>
        <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.45, 0.52, 20]} />
          <meshBasicMaterial color={color} transparent opacity={0.55} />
        </mesh>
      </group>
    );
  },
);
