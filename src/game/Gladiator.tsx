import { forwardRef, useRef, useImperativeHandle, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { Atk, LimbKey, State } from './arena/combat';
import type { ArmorKey, StyleId } from './arena/styles';

export type LimbPose = Record<LimbKey, { ratio: number; severed: boolean }>;

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
  /** per-limb health ratio & severed flags (optional; defaults intact) */
  limbs?: LimbPose;
  /** intact armor flags (optional; defaults all true) */
  armor?: Record<ArmorKey, boolean>;
  /** seconds remaining in energy net snare */
  snared?: number;
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

/** Articulated stick-figure gladiator with 5 modular Spartacus weapon & armor styles. */
export const Gladiator = forwardRef<GladiatorHandle, { color: string; accent?: string; scale?: number; style?: StyleId }>(
  function Gladiator({ color, accent = '#ffc95c', scale = 1, style = 'murmillo' }, ref) {
    const group = useRef<THREE.Group>(null!);
    const root = useRef<THREE.Group>(null!);
    const upper = useRef<THREE.Group>(null!);
    const head = useRef<THREE.Group>(null!);
    const hipL = useRef<THREE.Group>(null!), hipR = useRef<THREE.Group>(null!);
    const kneeL = useRef<THREE.Group>(null!), kneeR = useRef<THREE.Group>(null!);
    const shL = useRef<THREE.Group>(null!), shR = useRef<THREE.Group>(null!);
    const elL = useRef<THREE.Group>(null!), elR = useRef<THREE.Group>(null!);
    const helmGroup = useRef<THREE.Group>(null!);
    const pauldronGroup = useRef<THREE.Group>(null!);
    const shieldTrim = useRef<THREE.Mesh>(null!);
    const snareMesh = useRef<THREE.Mesh>(null!);
    const cape0 = useRef<THREE.Group>(null!), cape1 = useRef<THREE.Group>(null!), cape2 = useRef<THREE.Group>(null!);

    const speed = useRef(0);
    const phase = useRef(0);
    const pose = useRef<Pose>({
      state: 'idle', atk: null, progress: 0,
      block: 0, telegraph: 0, hurt: 0, stance: 0,
      localVx: 0, localVz: 0, dodgeLocalX: 0, dodgeLocalZ: 0,
    });

    const colors = useMemo(() => ({
      base: new THREE.Color(color).lerp(new THREE.Color('#ffffff'), 0.72),
      gear: new THREE.Color(color),
      trim: new THREE.Color(accent),
      amber: new THREE.Color('#ffc95c'),
      crimson: new THREE.Color('#ff3b5c'),
      warn: new THREE.Color('#ff3b3b'),
      white: new THREE.Color('#ffffff'),
    }), [color, accent]);

    const mats = useMemo(() => ({
      head: new THREE.MeshBasicMaterial({ color: colors.base }),
      torso: new THREE.MeshBasicMaterial({ color: colors.base }),
      armL: new THREE.MeshBasicMaterial({ color: colors.base }),
      armR: new THREE.MeshBasicMaterial({ color: colors.base }),
      legL: new THREE.MeshBasicMaterial({ color: colors.base }),
      legR: new THREE.MeshBasicMaterial({ color: colors.base }),
      sword: new THREE.MeshBasicMaterial({ color: '#ffffff' }),
      gearSolid: new THREE.MeshBasicMaterial({ color: '#0b051b' }),
      gearWire: new THREE.MeshBasicMaterial({ color: colors.gear, wireframe: true, transparent: true, opacity: 0.9 }),
      trimWire: new THREE.MeshBasicMaterial({ color: colors.trim, wireframe: true, transparent: true, opacity: 0.95 }),
      net: new THREE.MeshBasicMaterial({ color: '#3ff0ff', wireframe: true, transparent: true, opacity: 0.65 }),
    }), [colors]);

    useImperativeHandle(ref, () => ({ group: group.current, pose: pose.current, setMoving: (s) => { speed.current = s; } }), []);

    useFrame(({ clock }, delta) => {
      const dt = Math.min(delta, 0.05);
      const p = pose.current;
      const st = p.stance;
      const limbs = p.limbs;
      const armor = p.armor;

      // Visibility of severable limbs & breakable armor
      head.current.visible = !(limbs?.head.severed);
      shL.current.visible = !(limbs?.armL.severed);
      shR.current.visible = !(limbs?.armR.severed);
      kneeL.current.visible = !(limbs?.legL.severed);
      kneeR.current.visible = !(limbs?.legR.severed);
      if (helmGroup.current) helmGroup.current.visible = armor?.helm !== false;
      if (pauldronGroup.current) pauldronGroup.current.visible = armor?.pauldron !== false;
      if (shieldTrim.current) shieldTrim.current.visible = armor?.shield !== false;

      if (snareMesh.current) {
        const snared = (p.snared ?? 0) > 0;
        snareMesh.current.visible = snared;
        if (snared) {
          snareMesh.current.rotation.y = clock.elapsedTime * 2.5;
          snareMesh.current.scale.setScalar(1 + Math.sin(clock.elapsedTime * 16) * 0.06);
        }
      }

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

      // Left arm (+X)
      let shLX = THREE.MathUtils.lerp(-0.32 * st + sw * 0.3, -0.92, p.block);
      let shLY = THREE.MathUtils.lerp(0, -0.35, p.block);
      let shLZ = THREE.MathUtils.lerp(0.18, 0.05, p.block);
      let elLX = THREE.MathUtils.lerp(-0.45 - 0.45 * st, -1.25, p.block);

      // Right arm (-X)
      let shRX = -0.38 * st - sw * 0.35;
      let shRY = 0;
      let shRZ = -0.18 - 0.08 * st;
      let elRX = -0.45 - 0.35 * st;

      const legLBroken = (limbs?.legL.ratio ?? 1) <= 0;
      const legRBroken = (limbs?.legR.ratio ?? 1) <= 0;
      const armRCrippled = (limbs?.armR.ratio ?? 1) <= 0 && !(limbs?.armR.severed);

      if (legLBroken || legRBroken) {
        if (legLBroken && !legRBroken) rootRoll += 0.16;
        else if (legRBroken && !legLBroken) rootRoll -= 0.16;
        pelvisY -= 0.12 * Math.max(0, Math.sin(phase.current));
        if (legLBroken) { hipLX *= 0.38; kneeLX = 0.18; }
        if (legRBroken) { hipRX *= 0.38; kneeRX = 0.18; }
      }
      if (armRCrippled && p.state === 'idle') {
        shRX += 0.32 + Math.sin(clock.elapsedTime * 18) * 0.04;
        elRX += 0.25;
      }

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
            if (style === 'dimachaerus') { shLX = -1.1; shLZ = 0.85; elLX = -0.4; }
          } else if (p.state === 'strike') {
            upperY = THREE.MathUtils.lerp(0.88, -0.88, k);
            upperX = 0.28;
            shRX = -1.35;
            shRZ = THREE.MathUtils.lerp(0.9, -1.05, k);
            elRX = -0.2;
            if (style === 'dimachaerus') { shLX = -1.35; shLZ = THREE.MathUtils.lerp(0.85, -0.95, k); elLX = -0.2; }
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
            if (style === 'dimachaerus') { shLX = -2.2; shLZ = 0.58; elLX = -0.4; }
          } else if (p.state === 'strike') {
            pelvisY -= 0.08 * (1 - k);
            upperX = 0.42;
            upperY = THREE.MathUtils.lerp(-0.98, 1.05, k);
            shRX = THREE.MathUtils.lerp(-2.25, -0.32, k);
            shRZ = THREE.MathUtils.lerp(-0.58, 0.72, k);
            elRX = -0.14;
            if (style === 'dimachaerus') { shLX = THREE.MathUtils.lerp(-2.2, -0.32, k); shLZ = THREE.MathUtils.lerp(0.58, -0.72, k); elLX = -0.14; }
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
            if (style === 'dimachaerus') { shLX = -2.7; shLZ = 0.5; elLX = -0.35; }
            if (style === 'retiarius') { shLX = -1.6; shLZ = 0.5; elLX = -0.6; }
          } else if (p.state === 'strike') {
            pelvisY -= 0.16 * k;
            upperX = THREE.MathUtils.lerp(-0.22, 0.48, k);
            upperY = THREE.MathUtils.lerp(-0.45, 0.35, k);
            shRX = THREE.MathUtils.lerp(-2.85, -0.15, k);
            elRX = -0.1;
            if (style === 'dimachaerus') { shLX = THREE.MathUtils.lerp(-2.7, -0.15, k); shLZ = -0.45; elLX = -0.1; }
            if (style === 'retiarius') { shLX = -1.1; shLZ = -0.35; elLX = -0.2; }
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

      // Flowing Hoplomachus cape flutter
      if (cape0.current && cape1.current && cape2.current) {
        const flow = 0.22 + Math.max(0, lvz) * 0.55 + (p.state === 'dodge' ? 0.6 : 0);
        const flutter = Math.sin(clock.elapsedTime * 7 + moveMag * 4) * (0.08 + moveMag * 0.16);
        cape0.current.rotation.x = smooth(cape0.current.rotation.x, flow + flutter, 10, dt);
        cape1.current.rotation.x = smooth(cape1.current.rotation.x, flow * 0.45 - flutter * 0.8, 10, dt);
        cape2.current.rotation.x = smooth(cape2.current.rotation.x, flow * 0.25 + flutter * 1.1, 10, dt);
        cape0.current.rotation.z = smooth(cape0.current.rotation.z, -lvx * 0.25 - upper.current.rotation.y * 0.3, 10, dt);
      }

      // Per-limb colors: intact -> amber -> crimson (pulsing when broken) + telegraph/hurt blend
      const pulse = 0.5 + 0.5 * Math.sin(clock.elapsedTime * 22);
      const tint = (mat: THREE.MeshBasicMaterial, ratio: number) => {
        if (ratio > 0.65) mat.color.copy(colors.base);
        else if (ratio > 0.30) mat.color.copy(colors.amber);
        else {
          mat.color.copy(colors.crimson);
          if (ratio <= 0) mat.color.lerp(colors.white, pulse * 0.35);
        }
        mat.color.lerp(colors.warn, p.telegraph).lerp(colors.white, p.hurt);
      };
      tint(mats.head, limbs?.head.ratio ?? 1);
      tint(mats.torso, limbs?.torso.ratio ?? 1);
      tint(mats.armL, limbs?.armL.ratio ?? 1);
      tint(mats.armR, limbs?.armR.ratio ?? 1);
      tint(mats.legL, limbs?.legL.ratio ?? 1);
      tint(mats.legR, limbs?.legR.ratio ?? 1);
      mats.sword.color.copy(colors.white).lerp(colors.warn, p.telegraph);
      mats.gearWire.color.copy(colors.gear).lerp(colors.warn, p.telegraph).lerp(colors.white, p.hurt);
      mats.trimWire.color.copy(colors.trim).lerp(colors.warn, p.telegraph).lerp(colors.white, p.hurt);
    });

    return (
      <group ref={group} scale={scale}>
        <group ref={root} position={[0, 0.92, 0]}>
          {/* legs hanging from pelvis origin (0, 0.92, 0) */}
          <group ref={hipL} position={[0.11, 0, 0]}>
            <Dash len={0.46} w={THICK * 1.5} mat={mats.legL} />
            <group ref={kneeL} position={[0, -0.46, 0]}>
              <Dash len={0.46} w={THICK * 1.3} mat={mats.legL} />
            </group>
          </group>
          <group ref={hipR} position={[-0.11, 0, 0]}>
            <Dash len={0.46} w={THICK * 1.5} mat={mats.legR} />
            <group ref={kneeR} position={[0, -0.46, 0]}>
              <Dash len={0.46} w={THICK * 1.3} mat={mats.legR} />
            </group>
          </group>

          {/* Retiarius energy net snare cage */}
          <mesh ref={snareMesh} position={[0, 0.15, 0]} visible={false} material={mats.net}>
            <cylinderGeometry args={[0.52, 0.62, 1.85, 8, 3, true]} />
          </mesh>

          {/* articulated torso + head + arms + modular neon gear */}
          <group ref={upper} position={[0, 0.04, 0]}>
            <mesh position={[0, 0.30, 0]} material={mats.torso}><boxGeometry args={[THICK * 1.3, 0.56, THICK * 1.3]} /></mesh>

            {/* Layer 2: Head + Style Helm */}
            <group ref={head} position={[0, 0.72, 0]}>
              <mesh position={[0, 0.18, 0]} material={mats.head}><boxGeometry args={[THICK, 0.22, THICK]} /></mesh>
              <group ref={helmGroup}>
                {style === 'murmillo' && (
                  <group position={[0, 0.2, 0]}>
                    <mesh material={mats.gearSolid}><boxGeometry args={[0.18, 0.24, 0.2]} /></mesh>
                    <mesh material={mats.gearWire}><boxGeometry args={[0.19, 0.25, 0.21]} /></mesh>
                    <mesh position={[0, 0.21, -0.02]} material={mats.trimWire}><boxGeometry args={[0.06, 0.18, 0.34]} /></mesh>
                  </group>
                )}
                {style === 'dimachaerus' && (
                  <group position={[0, 0.2, 0]}>
                    <mesh position={[0, 0.02, 0.03]} material={mats.gearWire}><boxGeometry args={[0.2, 0.1, 0.18]} /></mesh>
                    <mesh position={[0.12, 0.16, 0.02]} rotation={[0, 0, -0.42]} material={mats.trimWire}><coneGeometry args={[0.045, 0.28, 4]} /></mesh>
                    <mesh position={[-0.12, 0.16, 0.02]} rotation={[0, 0, 0.42]} material={mats.trimWire}><coneGeometry args={[0.045, 0.28, 4]} /></mesh>
                  </group>
                )}
                {style === 'executioner' && (
                  <group position={[0, 0.21, 0]}>
                    <mesh material={mats.gearSolid}><boxGeometry args={[0.24, 0.28, 0.24]} /></mesh>
                    <mesh material={mats.trimWire}><boxGeometry args={[0.25, 0.29, 0.25]} /></mesh>
                    <mesh position={[0, 0.03, 0.13]} material={mats.sword}><boxGeometry args={[0.18, 0.035, 0.02]} /></mesh>
                  </group>
                )}
                {style === 'hoplomachus' && (
                  <group position={[0, 0.21, 0]}>
                    <mesh material={mats.gearSolid}><cylinderGeometry args={[0.13, 0.15, 0.25, 8]} /></mesh>
                    <mesh material={mats.gearWire}><cylinderGeometry args={[0.14, 0.16, 0.26, 8]} /></mesh>
                    <mesh position={[0, 0.22, -0.01]} material={mats.trimWire}><boxGeometry args={[0.05, 0.22, 0.36]} /></mesh>
                  </group>
                )}
              </group>
            </group>

            {/* Layer 3: Breakable Pauldrons */}
            <group ref={pauldronGroup}>
              {style === 'murmillo' && (
                <group position={[-0.22, 0.56, 0]}>
                  <mesh rotation={[0, 0, -0.3]} material={mats.trimWire}><cylinderGeometry args={[0.12, 0.13, 0.18, 6]} /></mesh>
                </group>
              )}
              {style === 'dimachaerus' && (
                <group>
                  <mesh position={[0.24, 0.66, 0]} rotation={[0, 0, -0.65]} material={mats.trimWire}><coneGeometry args={[0.06, 0.26, 4]} /></mesh>
                  <mesh position={[-0.24, 0.66, 0]} rotation={[0, 0, 0.65]} material={mats.trimWire}><coneGeometry args={[0.06, 0.26, 4]} /></mesh>
                </group>
              )}
              {style === 'executioner' && (
                <group>
                  {([0.29, -0.29] as const).map((x) => (
                    <group key={x} position={[x, 0.60, 0]}>
                      <mesh material={mats.gearSolid}><icosahedronGeometry args={[0.18, 0]} /></mesh>
                      <mesh material={mats.trimWire}><icosahedronGeometry args={[0.2, 0]} /></mesh>
                      <mesh position={[x > 0 ? 0.05 : -0.05, 0.23, 0]} rotation={[0, 0, x > 0 ? -0.3 : 0.3]} material={mats.trimWire}>
                        <coneGeometry args={[0.055, 0.28, 4]} />
                      </mesh>
                    </group>
                  ))}
                </group>
              )}
              {style === 'retiarius' && (
                <group position={[0.26, 0.66, 0]} rotation={[0, 0, -0.25]}>
                  <mesh material={mats.gearSolid}><boxGeometry args={[0.06, 0.42, 0.28]} /></mesh>
                  <mesh material={mats.trimWire}><boxGeometry args={[0.07, 0.44, 0.30]} /></mesh>
                </group>
              )}
              {style === 'hoplomachus' && (
                <group>
                  <mesh position={[0.23, 0.60, 0]} material={mats.trimWire}><boxGeometry args={[0.15, 0.1, 0.18]} /></mesh>
                  <mesh position={[-0.23, 0.60, 0]} material={mats.trimWire}><boxGeometry args={[0.15, 0.1, 0.18]} /></mesh>
                </group>
              )}
            </group>

            {/* Hoplomachus 3-segment flowing wireframe cape */}
            {style === 'hoplomachus' && (
              <group ref={cape0} position={[0, 0.58, -0.09]}>
                <mesh position={[0, -0.18, 0]} material={mats.trimWire}><boxGeometry args={[0.42, 0.36, 0.02]} /></mesh>
                <group ref={cape1} position={[0, -0.36, 0]}>
                  <mesh position={[0, -0.18, 0]} material={mats.trimWire}><boxGeometry args={[0.48, 0.36, 0.02]} /></mesh>
                  <group ref={cape2} position={[0, -0.36, 0]}>
                    <mesh position={[0, -0.18, 0]} material={mats.gearWire}><boxGeometry args={[0.54, 0.36, 0.02]} /></mesh>
                  </group>
                </group>
              </group>
            )}

            {/* Left arm (+X) + Shield / Off-hand weapon */}
            <group ref={shL} position={[0.22, 0.58, 0]} rotation={[0, 0, 0.18]}>
              <Dash len={0.34} mat={mats.armL} />
              <group ref={elL} position={[0, -0.34, 0]}>
                <Dash len={0.32} mat={mats.armL} />
                {style === 'murmillo' && (
                  <group position={[0.08, -0.22, 0.14]}>
                    <mesh material={mats.gearSolid}><boxGeometry args={[0.06, 0.84, 0.50]} /></mesh>
                    <mesh material={mats.gearWire}><boxGeometry args={[0.07, 0.86, 0.52]} /></mesh>
                    <mesh ref={shieldTrim} material={mats.trimWire}><boxGeometry args={[0.085, 0.92, 0.56]} /></mesh>
                  </group>
                )}
                {style === 'hoplomachus' && (
                  <group position={[0.08, -0.26, 0.12]} rotation={[0, 0, Math.PI / 2]}>
                    <mesh material={mats.gearSolid}><cylinderGeometry args={[0.28, 0.28, 0.05, 12]} /></mesh>
                    <mesh material={mats.gearWire}><cylinderGeometry args={[0.29, 0.29, 0.055, 12]} /></mesh>
                    <mesh ref={shieldTrim} material={mats.trimWire}><cylinderGeometry args={[0.33, 0.33, 0.06, 12]} /></mesh>
                  </group>
                )}
                {style === 'dimachaerus' && (
                  <group position={[0, -0.32, 0]} rotation={[-0.4, 0, 0]}>
                    <mesh position={[0, -0.36, 0]} material={mats.sword}><boxGeometry args={[0.05, 0.78, 0.06]} /></mesh>
                    <mesh position={[0, -0.78, 0.05]} rotation={[0.35, 0, 0]} material={mats.sword}><boxGeometry args={[0.045, 0.26, 0.05]} /></mesh>
                  </group>
                )}
                {style === 'retiarius' && (
                  <mesh position={[0.04, -0.32, 0.08]} material={mats.net}><icosahedronGeometry args={[0.22, 1]} /></mesh>
                )}
              </group>
            </group>

            {/* Right arm (-X) + Main weapon */}
            <group ref={shR} position={[-0.22, 0.58, 0]} rotation={[0, 0, -0.18]}>
              <Dash len={0.34} mat={mats.armR} />
              <group ref={elR} position={[0, -0.34, 0]}>
                <Dash len={0.32} mat={mats.armR} />
                {style === 'murmillo' && (
                  <group position={[0, -0.32, 0]} rotation={[-0.4, 0, 0]}>
                    <mesh position={[0, -0.05, 0]} material={mats.trimWire}><boxGeometry args={[0.20, 0.04, 0.06]} /></mesh>
                    <mesh position={[0, -0.44, 0]} material={mats.sword}><boxGeometry args={[0.055, 0.88, 0.06]} /></mesh>
                  </group>
                )}
                {style === 'dimachaerus' && (
                  <group position={[0, -0.32, 0]} rotation={[-0.4, 0, 0]}>
                    <mesh position={[0, -0.36, 0]} material={mats.sword}><boxGeometry args={[0.05, 0.78, 0.06]} /></mesh>
                    <mesh position={[0, -0.78, 0.05]} rotation={[0.35, 0, 0]} material={mats.sword}><boxGeometry args={[0.045, 0.26, 0.05]} /></mesh>
                  </group>
                )}
                {style === 'executioner' && (
                  <group position={[0, -0.32, 0]} rotation={[-0.35, 0, 0]}>
                    <mesh position={[0, -0.58, 0]} material={mats.gearWire}><boxGeometry args={[0.055, 1.38, 0.055]} /></mesh>
                    <mesh position={[0, -1.24, 0]} material={mats.gearSolid}><boxGeometry args={[0.28, 0.24, 0.46]} /></mesh>
                    <mesh position={[0, -1.24, 0]} material={mats.trimWire}><boxGeometry args={[0.30, 0.26, 0.48]} /></mesh>
                    <mesh position={[0, -1.42, 0]} rotation={[Math.PI, 0, 0]} material={mats.sword}><coneGeometry args={[0.08, 0.18, 4]} /></mesh>
                  </group>
                )}
                {style === 'retiarius' && (
                  <group position={[0, -0.32, 0]} rotation={[-0.45, 0, 0]}>
                    <mesh position={[0, -0.52, 0]} material={mats.gearWire}><boxGeometry args={[0.045, 1.56, 0.045]} /></mesh>
                    <mesh position={[0, -1.28, 0]} material={mats.trimWire}><boxGeometry args={[0.34, 0.05, 0.05]} /></mesh>
                    {([-0.14, 0, 0.14] as const).map((x) => (
                      <mesh key={x} position={[x, -1.46, 0]} material={mats.sword}><boxGeometry args={[0.035, 0.36, 0.035]} /></mesh>
                    ))}
                  </group>
                )}
                {style === 'hoplomachus' && (
                  <group position={[0, -0.32, 0]} rotation={[-0.48, 0, 0]}>
                    <mesh position={[0, -0.50, 0]} material={mats.gearWire}><boxGeometry args={[0.045, 1.65, 0.045]} /></mesh>
                    <mesh position={[0, -1.42, 0]} rotation={[Math.PI, 0, 0]} material={mats.sword}><coneGeometry args={[0.08, 0.28, 4]} /></mesh>
                  </group>
                )}
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
