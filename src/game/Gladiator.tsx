import { forwardRef, useRef, useImperativeHandle, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export interface Pose {
  /** right shoulder angle (rad). 0 = arm hangs, negative = swung forward/up. Windup ~ -2.4, strike ends ~ -0.6 */
  swing: number;
  /** 0..1, shield arm raised */
  block: number;
  /** 0..1 enemy attack telegraph glow */
  telegraph: number;
  /** 0..1 hit flash */
  hurt: number;
}
export interface GladiatorHandle { group: THREE.Group; pose: Pose; setMoving: (speed01: number) => void }

const THICK = 0.075;
const GAP = 0.05;

/** One bright dash with a gap at each end, like the Last Hero's customization rig. */
function Dash({ len, w = THICK, y = 0, mat }: { len: number; w?: number; y?: number; mat: THREE.Material }) {
  return <mesh position={[0, y - len / 2, 0]} material={mat}><boxGeometry args={[w, Math.max(0.05, len - GAP * 2), w]} /></mesh>;
}

/** Stick-figure gladiator: nine bright dashes on black, a sword dash and a shield ring. */
export const Gladiator = forwardRef<GladiatorHandle, { color: string; accent?: string; scale?: number }>(
  function Gladiator({ color, scale = 1 }, ref) {
    const group = useRef<THREE.Group>(null!);
    const root = useRef<THREE.Group>(null!);
    const hipL = useRef<THREE.Group>(null!), hipR = useRef<THREE.Group>(null!), kneeL = useRef<THREE.Group>(null!), kneeR = useRef<THREE.Group>(null!);
    const shL = useRef<THREE.Group>(null!), shR = useRef<THREE.Group>(null!), elL = useRef<THREE.Group>(null!), elR = useRef<THREE.Group>(null!);
    const speed = useRef(0);
    const phase = useRef(0);
    const pose = useRef<Pose>({ swing: -0.2, block: 0, telegraph: 0, hurt: 0 });
    const base = useMemo(() => new THREE.Color(color).lerp(new THREE.Color('#ffffff'), 0.72), [color]);
    const mat = useMemo(() => new THREE.MeshBasicMaterial({ color: base }), [base]);
    const swordMat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#ffffff' }), []);
    const warn = useMemo(() => new THREE.Color('#ff3b3b'), []);
    const white = useMemo(() => new THREE.Color('#ffffff'), []);
    useImperativeHandle(ref, () => ({ group: group.current, pose: pose.current, setMoving: (s) => { speed.current = s; } }), []);

    useFrame((_, dt) => {
      const s = speed.current, p = pose.current;
      phase.current += dt * (4 + s * 7);
      const sw = Math.sin(phase.current) * s;
      hipL.current.rotation.x = sw * 0.75; hipR.current.rotation.x = -sw * 0.75;
      kneeL.current.rotation.x = Math.max(0, -Math.cos(phase.current)) * 0.9 * s;
      kneeR.current.rotation.x = Math.max(0, Math.cos(phase.current)) * 0.9 * s;
      root.current.position.y = Math.abs(Math.cos(phase.current)) * 0.06 * s;
      root.current.rotation.x = 0.1 * s - p.hurt * 0.35;
      // sword arm
      shR.current.rotation.x = p.swing + (Math.abs(p.swing + 0.2) < 0.05 ? -sw * 0.5 : 0);
      elR.current.rotation.x = p.swing < -0.4 ? -0.2 : -0.5;
      // shield arm
      shL.current.rotation.x = THREE.MathUtils.lerp(0.35 * sw + 0.1, -0.95, p.block);
      elL.current.rotation.x = THREE.MathUtils.lerp(-0.3, -1.5, p.block);
      const c = mat.color.copy(base).lerp(warn, p.telegraph).lerp(white, p.hurt);
      swordMat.color.copy(white).lerp(warn, p.telegraph);
      void c;
    });

    return (
      <group ref={group} scale={scale}>
        <group ref={root}>
          {/* head, torso */}
          <mesh position={[0, 1.88, 0]} material={mat}><boxGeometry args={[THICK, 0.2, THICK]} /></mesh>
          <mesh position={[0, 1.27, 0]} material={mat}><boxGeometry args={[THICK * 1.3, 0.56, THICK * 1.3]} /></mesh>
          {/* legs */}
          {[['L', -0.11, hipL, kneeL], ['R', 0.11, hipR, kneeR]].map(([k, x, hip, knee]) => (
            <group key={k as string} ref={hip as React.RefObject<THREE.Group>} position={[x as number, 0.92, 0]}>
              <Dash len={0.46} w={THICK * 1.5} mat={mat} />
              <group ref={knee as React.RefObject<THREE.Group>} position={[0, -0.46, 0]}>
                <Dash len={0.46} w={THICK * 1.3} mat={mat} />
              </group>
            </group>
          ))}
          {/* left arm + shield */}
          <group ref={shL} position={[-0.2, 1.52, 0]} rotation={[0, 0, 0.18]}>
            <Dash len={0.34} mat={mat} />
            <group ref={elL} position={[0, -0.34, 0]}>
              <Dash len={0.32} mat={mat} />
              <mesh position={[-0.05, -0.34, 0.1]} rotation={[0, Math.PI / 2, 0]} material={mat}><ringGeometry args={[0.2, 0.26, 8]} /></mesh>
            </group>
          </group>
          {/* right arm + sword */}
          <group ref={shR} position={[0.2, 1.52, 0]} rotation={[0, 0, -0.18]}>
            <Dash len={0.34} mat={mat} />
            <group ref={elR} position={[0, -0.34, 0]}>
              <Dash len={0.32} mat={mat} />
              <mesh position={[0, -0.78, 0]} material={swordMat}><boxGeometry args={[0.05, 0.9, 0.05]} /></mesh>
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
