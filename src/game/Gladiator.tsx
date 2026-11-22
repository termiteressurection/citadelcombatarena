import { forwardRef, useRef, useImperativeHandle, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { Atk, LimbKey, StanceHeight, State } from './arena/combat';
import { moveOf, type ArmorKey, type MoveMotion, type StyleId } from './arena/styles';
import { gearFromStyle, type GearVisuals } from './rpg/items';
import { makeCurvedBasicMaterial } from './art/curvature';
import { getPs1Texture, makePs1Material } from './art/ps1Textures';

export type LimbPose = Record<LimbKey, { ratio: number; severed: boolean }>;

export interface Pose {
  state: State;
  atk: Atk | null;
  motion?: MoveMotion;
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
  /** active parry deflect stance (0..1) */
  parryReady?: number;
  /** incoming enemy strike inside final parry window flash (0..1) */
  parryFlash?: number;
  /** riposte empowerment ready/active (0..1) */
  riposte?: number;
  /** seconds remaining in execution-ready dazed state */
  dazed?: number;
  /** Nidhogg high / mid / low guard stance */
  guardHeight?: StanceHeight;
  /** true when weapon has been thrown or beat-disarmed */
  weaponDisarmed?: boolean;
  /** vertical launch / jump height offset above floor */
  airY?: number;
  /** true during airborne flying dive-kick */
  diveKicking?: boolean;
  /** seconds remaining in Tekken wall-splat state */
  wallSplat?: number;
}

export interface GladiatorHandle { group: THREE.Group; pose: Pose; setMoving: (speed01: number) => void }

const smooth = (cur: number, target: number, rate: number, dt: number) =>
  THREE.MathUtils.lerp(cur, target, 1 - Math.exp(-rate * dt));

const CIVILIAN_VISUALS: GearVisuals = { weapon: 'gladius', offhand: 'none', helm: 'none', body: 'tunic', cape: 'scarf' };

/** Articulated low-poly PS1 triangle & polygon TRON deleted-file fighter driven by modular hard-light gear. */
export const Gladiator = forwardRef<GladiatorHandle, {
  color: string;
  accent?: string;
  scale?: number;
  style?: StyleId;
  gear?: GearVisuals;
  civilian?: boolean;
  sheathed?: boolean;
}>(
  function Gladiator({ color, accent = '#ffc95c', scale = 1, style = 'murmillo', gear, civilian = false, sheathed = false }, ref) {
    const armed = !civilian && !sheathed;
    const v = civilian ? CIVILIAN_VISUALS : (gear ?? gearFromStyle(style).visuals);
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
    const shieldTrim = useRef<THREE.Group>(null!);
    const weaponGroupL = useRef<THREE.Group>(null!);
    const weaponGroupR = useRef<THREE.Group>(null!);
    const snareMesh = useRef<THREE.Mesh>(null!);
    const glintMesh = useRef<THREE.Mesh>(null!);
    const cape0 = useRef<THREE.Group>(null!), cape1 = useRef<THREE.Group>(null!), cape2 = useRef<THREE.Group>(null!);

    const speed = useRef(0);
    const phase = useRef(0);
    const pose = useRef<Pose>({
      state: 'idle', atk: null, progress: 0,
      block: 0, telegraph: 0, hurt: 0, stance: 0,
      localVx: 0, localVz: 0, dodgeLocalX: 0, dodgeLocalZ: 0,
    });

    const colors = useMemo(() => ({
      base: new THREE.Color(color).lerp(new THREE.Color('#282442'), 0.58),
      gear: new THREE.Color(color),
      trim: new THREE.Color(accent),
      metal: new THREE.Color('#8e9ab8'),
      amber: new THREE.Color('#ffae33'),
      crimson: new THREE.Color('#ff2e4c'),
      warn: new THREE.Color('#ff4433'),
      white: new THREE.Color('#ffffff'),
      black: new THREE.Color('#000000'),
    }), [color, accent]);

    const mats = useMemo(() => {
      const tunicTex = getPs1Texture('tunic');
      const bronzeTex = getPs1Texture('bronze');
      const woodTex = getPs1Texture('wood');
      const bannerTex = getPs1Texture('banner');
      return {
        head: makePs1Material({ color: colors.base, map: tunicTex, emissive: '#141226', emissiveIntensity: 0.25 }),
        torso: makePs1Material({ color: colors.base, map: tunicTex, emissive: '#141226', emissiveIntensity: 0.25 }),
        armL: makePs1Material({ color: colors.base, map: tunicTex, emissive: '#141226', emissiveIntensity: 0.25 }),
        armR: makePs1Material({ color: colors.base, map: tunicTex, emissive: '#141226', emissiveIntensity: 0.25 }),
        legL: makePs1Material({ color: colors.base, map: tunicTex, emissive: '#141226', emissiveIntensity: 0.25 }),
        legR: makePs1Material({ color: colors.base, map: tunicTex, emissive: '#141226', emissiveIntensity: 0.25 }),
        leather: makePs1Material({ color: '#2b2442', map: woodTex }),
        bronze: makePs1Material({ color: '#ffd06b', map: bronzeTex, emissive: '#7a5218', emissiveIntensity: 0.22 }),
        iron: makePs1Material({ color: colors.metal, map: bronzeTex, emissive: '#1d2238', emissiveIntensity: 0.2 }),
        wood: makePs1Material({ color: '#383254', map: woodTex }),
        blade: makePs1Material({ color: '#e8fbff', map: bronzeTex, emissive: colors.gear, emissiveIntensity: 0.55 }),
        gearPaint: makePs1Material({ color: colors.gear, map: bronzeTex, emissive: colors.gear, emissiveIntensity: 0.28 }),
        trim: makePs1Material({ color: colors.trim, map: bronzeTex, emissive: colors.trim, emissiveIntensity: 0.3 }),
        cape: makePs1Material({ color: '#ffffff', map: bannerTex, side: THREE.DoubleSide, emissive: colors.gear, emissiveIntensity: 0.15 }),
        eye: makeCurvedBasicMaterial({ color: colors.gear }),
        net: makeCurvedBasicMaterial({ color: '#3ff0ff', wireframe: true, transparent: true, opacity: 0.72 }),
        glint: makeCurvedBasicMaterial({ color: '#fff5c0' }),
        shadow: makeCurvedBasicMaterial({ color: '#04020a', transparent: true, opacity: 0.62 }),
        ring: makeCurvedBasicMaterial({ color: colors.gear, transparent: true, opacity: 0.68 }),
      };
    }, [colors]);

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
      if (weaponGroupL.current) weaponGroupL.current.visible = !p.weaponDisarmed;
      if (weaponGroupR.current) weaponGroupR.current.visible = !p.weaponDisarmed;

      if (snareMesh.current) {
        const snared = (p.snared ?? 0) > 0;
        snareMesh.current.visible = snared;
        if (snared) {
          snareMesh.current.rotation.y = clock.elapsedTime * 2.5;
          snareMesh.current.scale.setScalar(1 + Math.sin(clock.elapsedTime * 16) * 0.06);
        }
      }

      if (glintMesh.current) {
        const pf = p.parryFlash ?? 0;
        const dazed = (p.dazed ?? 0) > 0;
        const showGlint = dazed || pf > 0.05 || p.telegraph > 0.08;
        glintMesh.current.visible = showGlint;
        if (showGlint) {
          const s = dazed
            ? 1.35 + Math.sin(clock.elapsedTime * 24) * 0.38
            : pf > 0.05
              ? 1.2 + pf * 1.45 + Math.sin(clock.elapsedTime * 48) * 0.35
              : 0.65 + p.telegraph * 1.15 + Math.sin(clock.elapsedTime * 36) * 0.25;
          mats.glint.color.set(
            dazed ? (Math.sin(clock.elapsedTime * 18) > 0 ? '#ff3b5c' : '#ffe780') : pf > 0.05 ? '#ffe780' : '#ff8a5c',
          );
          glintMesh.current.scale.setScalar(s);
          glintMesh.current.rotation.y = clock.elapsedTime * 12;
          glintMesh.current.rotation.z = clock.elapsedTime * 9;
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
      const parryStance = p.state === 'idle' ? (p.parryReady ?? 0) : 0;
      let shLX = THREE.MathUtils.lerp(-0.32 * st + sw * 0.3, -0.92, p.block);
      let shLY = THREE.MathUtils.lerp(0, -0.35, p.block);
      let shLZ = THREE.MathUtils.lerp(0.18, 0.05, p.block);
      let elLX = THREE.MathUtils.lerp(-0.45 - 0.45 * st, -1.25, p.block);
      if (parryStance > 0.1) {
        shLX = THREE.MathUtils.lerp(shLX, -1.22, parryStance);
        shLY = THREE.MathUtils.lerp(shLY, -0.58, parryStance);
        elLX = THREE.MathUtils.lerp(elLX, -0.92, parryStance);
      }

      // Right arm (-X)
      let shRX = -0.38 * st - sw * 0.35;
      let shRY = 0;
      let shRZ = -0.18 - 0.08 * st;
      let elRX = -0.45 - 0.35 * st;

      if (st > 0.3 && p.state === 'idle') {
        const gh = p.guardHeight ?? 'mid';
        if (gh === 'high') {
          shRX -= 0.72; shRZ += 0.12; elRX -= 0.25; upperX -= 0.08;
          if (v.weapon === 'twinSica') { shLX -= 0.68; shLZ -= 0.12; }
        } else if (gh === 'low') {
          pelvisY -= 0.24; kneeLX += 0.38; kneeRX += 0.38; upperX += 0.26; shRX += 0.36;
          if (v.weapon === 'twinSica') { shLX += 0.34; }
        }
      }

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

      let blend = parryStance > 0.1 ? 26 : 14;
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
      } else if (p.diveKicking) {
        rootPitch = -0.95;
        hipRX = -1.35; kneeRX = 0.05;
        hipLX = 0.55; kneeLX = 1.15;
        shLX = -0.5; shRX = 0.45;
        blend = 26;
      } else if ((p.airY ?? 0) > 0.12 && p.state === 'stagger') {
        rootPitch = -0.75;
        upperX = -0.35;
        shLZ = 0.9; shRZ = -0.9;
        hipLX = -0.55; hipRX = -0.3;
        kneeLX = 0.8; kneeRX = 0.9;
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
        const motion = p.motion ?? moveOf(style, p.atk).motion;
        blend = p.state === 'strike' ? 30 : 18;
        switch (motion) {
          case 'thrust': {
            const hvy = p.atk === 'heavy';
            if (p.state === 'windup') {
              pelvisY -= (hvy ? 0.18 : 0.08) * k;
              upperY = THREE.MathUtils.lerp(-0.28, -1.08, k);
              upperX = THREE.MathUtils.lerp(0.14, hvy ? -0.15 : 0.05, k);
              shRX = THREE.MathUtils.lerp(-0.38, 0.58, k);
              shRZ = -0.14;
              elRX = THREE.MathUtils.lerp(-0.6, -1.65, k);
              shLX = THREE.MathUtils.lerp(-0.35, -0.85, k);
            } else if (p.state === 'strike') {
              pelvisY -= hvy ? 0.16 : 0.08;
              upperY = THREE.MathUtils.lerp(-1.08, 0.62, k);
              upperX = hvy ? 0.48 : 0.32;
              shRX = THREE.MathUtils.lerp(0.58, -1.55, k);
              shRZ = THREE.MathUtils.lerp(-0.14, 0.08, k);
              elRX = THREE.MathUtils.lerp(-1.65, -0.02, k);
              shLX = 0.25;
            } else {
              upperX = THREE.MathUtils.lerp(hvy ? 0.48 : 0.32, 0.14, k);
              upperY = THREE.MathUtils.lerp(0.62, -0.28, k);
              shRX = THREE.MathUtils.lerp(-1.55, -0.38, k);
              elRX = THREE.MathUtils.lerp(-0.02, -0.78, k);
            }
            break;
          }
          case 'sweep': {
            if (p.state === 'windup') {
              pelvisY -= 0.12 * k;
              upperY = THREE.MathUtils.lerp(-0.28, -1.35, k);
              shRX = -1.25;
              shRZ = THREE.MathUtils.lerp(-0.3, -1.35, k);
              elRX = -0.35;
              shLX = -1.05; shLZ = -0.45;
            } else if (p.state === 'strike') {
              upperY = THREE.MathUtils.lerp(-1.35, 1.35, k);
              upperX = 0.36;
              shRX = -1.35;
              shRZ = THREE.MathUtils.lerp(-1.35, 1.15, k);
              elRX = -0.12;
              shLX = -0.9; shLZ = 0.65;
            } else {
              upperY = THREE.MathUtils.lerp(1.35, -0.28, k);
              shRX = THREE.MathUtils.lerp(-1.35, -0.38, k);
              shRZ = THREE.MathUtils.lerp(1.15, -0.26, k);
              elRX = THREE.MathUtils.lerp(-0.12, -0.8, k);
            }
            break;
          }
          case 'crush': {
            if (p.state === 'windup') {
              pelvisY += 0.06 * k;
              upperX = THREE.MathUtils.lerp(0.14, -0.35, k);
              upperY = THREE.MathUtils.lerp(-0.28, -0.3, k);
              shRX = THREE.MathUtils.lerp(-0.4, -3.0, k);
              shLX = THREE.MathUtils.lerp(-0.35, -2.65, k);
              shRZ = -0.1; shLZ = 0.25;
              elRX = -0.28; elLX = -0.35;
            } else if (p.state === 'strike') {
              pelvisY -= 0.24 * k;
              upperX = THREE.MathUtils.lerp(-0.35, 0.62, k);
              upperY = THREE.MathUtils.lerp(-0.3, 0.25, k);
              shRX = THREE.MathUtils.lerp(-3.0, 0.25, k);
              shLX = THREE.MathUtils.lerp(-2.65, 0.15, k);
              elRX = -0.08; elLX = -0.15;
            } else {
              pelvisY -= 0.24 * (1 - k);
              upperX = THREE.MathUtils.lerp(0.62, 0.14, k);
              upperY = THREE.MathUtils.lerp(0.25, -0.28, k);
              shRX = THREE.MathUtils.lerp(0.25, -0.38, k);
              elRX = THREE.MathUtils.lerp(-0.08, -0.8, k);
            }
            break;
          }
          case 'twinCross': {
            if (p.state === 'windup') {
              pelvisY -= 0.14 * k;
              shRX = -1.25; shLX = -1.25;
              shRZ = THREE.MathUtils.lerp(-0.3, -1.25, k);
              shLZ = THREE.MathUtils.lerp(0.3, 1.25, k);
              elRX = -0.25; elLX = -0.25;
            } else if (p.state === 'strike') {
              pelvisY -= 0.08 * (1 - k);
              upperX = 0.42;
              shRX = -1.35; shLX = -1.35;
              shRZ = THREE.MathUtils.lerp(-1.25, 0.9, k);
              shLZ = THREE.MathUtils.lerp(1.25, -0.9, k);
              elRX = -0.15; elLX = -0.15;
            } else {
              upperX = THREE.MathUtils.lerp(0.42, 0.14, k);
              shRX = THREE.MathUtils.lerp(-1.35, -0.38, k);
              shLX = THREE.MathUtils.lerp(-1.35, -0.32, k);
              shRZ = THREE.MathUtils.lerp(0.9, -0.26, k);
              shLZ = THREE.MathUtils.lerp(-0.9, 0.18, k);
            }
            break;
          }
          case 'twinSlash': {
            if (p.state === 'windup') {
              upperX = THREE.MathUtils.lerp(0.14, -0.22, k);
              shRX = THREE.MathUtils.lerp(-0.4, -2.75, k);
              shLX = THREE.MathUtils.lerp(-0.35, -2.7, k);
              shRZ = -0.45; shLZ = 0.5;
              elRX = -0.35; elLX = -0.35;
            } else if (p.state === 'strike') {
              pelvisY -= 0.16 * k;
              upperX = THREE.MathUtils.lerp(-0.22, 0.5, k);
              shRX = THREE.MathUtils.lerp(-2.75, -0.15, k);
              shLX = THREE.MathUtils.lerp(-2.7, -0.15, k);
              shRZ = 0.35; shLZ = -0.45;
              elRX = -0.1; elLX = -0.1;
            } else {
              pelvisY -= 0.16 * (1 - k);
              upperX = THREE.MathUtils.lerp(0.5, 0.14, k);
              shRX = THREE.MathUtils.lerp(-0.15, -0.38, k);
              shLX = THREE.MathUtils.lerp(-0.15, -0.32, k);
            }
            break;
          }
          case 'netThrow': {
            if (p.state === 'windup') {
              upperY = THREE.MathUtils.lerp(-0.28, 1.05, k);
              shLX = THREE.MathUtils.lerp(-0.4, -1.65, k);
              shLZ = THREE.MathUtils.lerp(0.2, 1.15, k);
              elLX = -0.55;
            } else if (p.state === 'strike') {
              upperY = THREE.MathUtils.lerp(1.05, -1.05, k);
              upperX = 0.34;
              shLX = -1.25;
              shLZ = THREE.MathUtils.lerp(1.15, -0.75, k);
              elLX = -0.15;
            } else {
              upperY = THREE.MathUtils.lerp(-1.05, -0.28, k);
              shLX = THREE.MathUtils.lerp(-1.25, -0.32, k);
              shLZ = THREE.MathUtils.lerp(-0.75, 0.18, k);
            }
            break;
          }
          case 'backhand': {
            if (p.state === 'windup') {
              upperY = THREE.MathUtils.lerp(0.45, 0.88, k);
              shRX = -1.15;
              shRZ = THREE.MathUtils.lerp(0.4, 0.9, k);
              elRX = -0.5;
              if (v.weapon === 'twinSica') { shLX = -1.1; shLZ = 0.85; elLX = -0.4; }
            } else if (p.state === 'strike') {
              upperY = THREE.MathUtils.lerp(0.88, -0.88, k);
              upperX = 0.28;
              shRX = -1.35;
              shRZ = THREE.MathUtils.lerp(0.9, -1.05, k);
              elRX = -0.2;
              if (v.weapon === 'twinSica') { shLX = -1.35; shLZ = THREE.MathUtils.lerp(0.85, -0.95, k); elLX = -0.2; }
            } else {
              upperY = THREE.MathUtils.lerp(-0.88, -0.28, k);
              shRX = THREE.MathUtils.lerp(-1.35, -0.38, k);
              shRZ = THREE.MathUtils.lerp(-1.05, -0.26, k);
              elRX = THREE.MathUtils.lerp(-0.2, -0.8, k);
            }
            break;
          }
          case 'overhead': {
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
            break;
          }
          case 'bash': {
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
            break;
          }
          default: {
            // slash
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
          }
        }
      }

      if ((p.dazed ?? 0) > 0 && p.state === 'idle') {
        upperX = 0.34;
        upperZ = Math.sin(clock.elapsedTime * 7.5) * 0.22;
        headX = 0.3;
        shLX = -0.18; shRX = -0.18;
      }
      if ((p.wallSplat ?? 0) > 0) {
        upperX = 0.48;
        headX = 0.35;
        shLX = -0.25; shRX = -0.25;
      }

      // Apply smooth damping to every joint (including vertical airY for jumps, dive-kicks & Tekken juggles)
      root.current.position.y = smooth(root.current.position.y, pelvisY + (p.airY ?? 0), blend, dt);
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

      // Per-limb colors & emissive damage hints (intact -> amber -> pulsing crimson) + telegraph/hurt
      const pulse = 0.5 + 0.5 * Math.sin(clock.elapsedTime * 22);
      const tint = (mat: THREE.MeshLambertMaterial, ratio: number) => {
        if (ratio > 0.65) {
          mat.color.copy(colors.base);
          mat.emissive.copy(colors.black);
          mat.emissiveIntensity = 0;
        } else if (ratio > 0.30) {
          mat.color.copy(colors.amber);
          mat.emissive.copy(colors.amber);
          mat.emissiveIntensity = 0.35;
        } else {
          mat.color.copy(colors.crimson);
          mat.emissive.copy(colors.crimson);
          mat.emissiveIntensity = ratio <= 0 ? 0.45 + pulse * 0.45 : 0.4;
        }
        if (p.telegraph > 0.01) {
          mat.emissive.lerp(colors.warn, p.telegraph);
          mat.emissiveIntensity = Math.max(mat.emissiveIntensity, p.telegraph * 0.7);
        }
        if (p.hurt > 0.01) {
          mat.color.lerp(colors.white, p.hurt);
          mat.emissive.lerp(colors.white, p.hurt);
          mat.emissiveIntensity = Math.max(mat.emissiveIntensity, p.hurt > 0.35 ? 0.92 : p.hurt * 0.85);
        }
      };
      tint(mats.head, limbs?.head.ratio ?? 1);
      tint(mats.torso, limbs?.torso.ratio ?? 1);
      tint(mats.armL, limbs?.armL.ratio ?? 1);
      tint(mats.armR, limbs?.armR.ratio ?? 1);
      tint(mats.legL, limbs?.legL.ratio ?? 1);
      tint(mats.legR, limbs?.legR.ratio ?? 1);

      const gold = colors.amber;
      const rip = p.riposte ?? 0;
      mats.blade.color.copy(colors.white).lerp(colors.warn, p.telegraph).lerp(gold, rip * 0.85);
      mats.blade.emissive.copy(p.telegraph > 0.1 ? colors.warn : rip > 0.1 ? gold : colors.gear);
      mats.blade.emissiveIntensity = Math.max(0.28 + p.telegraph * 0.8, rip * 1.15);

      mats.gearPaint.color.copy(colors.gear).lerp(colors.warn, p.telegraph).lerp(gold, parryStance * 0.7).lerp(colors.white, p.hurt);
      mats.gearPaint.emissive.copy(parryStance > 0.1 ? gold : colors.gear).lerp(colors.warn, p.telegraph);
      mats.gearPaint.emissiveIntensity = Math.max(p.telegraph * 0.6 + p.hurt * 0.5, parryStance * 0.85);

      mats.trim.color.copy(colors.trim).lerp(colors.warn, p.telegraph).lerp(gold, Math.max(parryStance, rip)).lerp(colors.white, p.hurt);
      mats.trim.emissive.copy(parryStance > 0.1 || rip > 0.1 ? gold : colors.trim);
      mats.trim.emissiveIntensity = Math.max(0.14 + p.telegraph * 0.5 + p.hurt * 0.4, parryStance * 0.95, rip * 0.75);
    });

    return (
      <group ref={group} scale={scale}>
        {/* Grounded low-poly PS1 drop shadow */}
        <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]} material={mats.shadow}>
          <circleGeometry args={[0.52, 8]} />
        </mesh>

        <group ref={root} position={[0, 0.92, 0]}>
          {/* Pelvis + bronze waist belt */}
          <mesh position={[0, -0.02, 0]} scale={[1, 1, 0.72]} material={mats.leather}>
            <cylinderGeometry args={[0.16, 0.14, 0.16, 6]} />
          </mesh>
          <mesh position={[0, 0.03, 0]} scale={[1, 1, 0.74]} material={mats.bronze}>
            <cylinderGeometry args={[0.175, 0.175, 0.07, 6]} />
          </mesh>

          {/* Left leg (+X): faceted thigh, knee guard, shin greave, chunky boot */}
          <group ref={hipL} position={[0.11, 0, 0]}>
            <mesh position={[0, -0.21, 0]} material={mats.legL}>
              <cylinderGeometry args={[0.09, 0.068, 0.42, 5]} />
            </mesh>
            <group ref={kneeL} position={[0, -0.44, 0]}>
              <mesh position={[0, -0.20, 0]} material={mats.legL}>
                <cylinderGeometry args={[0.072, 0.052, 0.40, 5]} />
              </mesh>
              <mesh position={[0, -0.18, 0.038]} material={mats.bronze}>
                <boxGeometry args={[0.088, 0.25, 0.05]} />
              </mesh>
              <mesh position={[0, -0.42, 0.035]} material={mats.leather}>
                <boxGeometry args={[0.10, 0.09, 0.17]} />
              </mesh>
            </group>
          </group>

          {/* Right leg (-X): faceted thigh, shin greave, chunky boot */}
          <group ref={hipR} position={[-0.11, 0, 0]}>
            <mesh position={[0, -0.21, 0]} material={mats.legR}>
              <cylinderGeometry args={[0.09, 0.068, 0.42, 5]} />
            </mesh>
            <group ref={kneeR} position={[0, -0.44, 0]}>
              <mesh position={[0, -0.20, 0]} material={mats.legR}>
                <cylinderGeometry args={[0.072, 0.052, 0.40, 5]} />
              </mesh>
              <mesh position={[0, -0.18, 0.038]} material={mats.bronze}>
                <boxGeometry args={[0.088, 0.25, 0.05]} />
              </mesh>
              <mesh position={[0, -0.42, 0.035]} material={mats.leather}>
                <boxGeometry args={[0.10, 0.09, 0.17]} />
              </mesh>
            </group>
          </group>

          {/* Retiarius energy net snare cage */}
          <mesh ref={snareMesh} position={[0, 0.15, 0]} visible={false} material={mats.net}>
            <cylinderGeometry args={[0.52, 0.62, 1.85, 8, 3, true]} />
          </mesh>

          {/* Upper torso + faceted armor & weapons */}
          <group ref={upper} position={[0, 0.05, 0]}>
            {/* Pleated gladiatorial kilt */}
            <mesh position={[0, 0.02, 0]} scale={[1, 1, 0.72]} material={mats.leather}>
              <cylinderGeometry args={[0.17, 0.23, 0.24, 6]} />
            </mesh>
            {/* Tapered 6-sided chest */}
            <mesh position={[0, 0.34, 0]} scale={[1.05, 1, 0.66]} material={mats.torso}>
              <cylinderGeometry args={[0.23, 0.15, 0.48, 6]} />
            </mesh>
            {/* Diagonal bronze harness strap */}
            <mesh position={[0, 0.34, 0.01]} rotation={[0, 0, 0.56]} material={mats.bronze}>
              <boxGeometry args={[0.055, 0.52, 0.24]} />
            </mesh>

            {/* Layer 2: Low-Poly Angular Head + Pixel Eyes + Breakable Style Helm */}
            <group ref={head} position={[0, 0.60, 0]}>
              <mesh position={[0, 0.05, 0]} material={mats.head}>
                <cylinderGeometry args={[0.06, 0.072, 0.11, 5]} />
              </mesh>
              <mesh position={[0, 0.20, 0]} material={mats.head}>
                <cylinderGeometry args={[0.11, 0.085, 0.21, 6]} />
              </mesh>
              {/* Chin wedge */}
              <mesh position={[0, 0.095, 0.025]} rotation={[Math.PI, Math.PI / 4, 0]} material={mats.head}>
                <coneGeometry args={[0.075, 0.1, 4]} />
              </mesh>
              {/* Brow band & glowing eye slits */}
              <mesh position={[0, 0.235, 0.075]} material={mats.leather}>
                <boxGeometry args={[0.16, 0.036, 0.06]} />
              </mesh>
              <mesh position={[0.036, 0.205, 0.095]} material={mats.eye}><boxGeometry args={[0.038, 0.024, 0.02]} /></mesh>
              <mesh position={[-0.036, 0.205, 0.095]} material={mats.eye}><boxGeometry args={[0.038, 0.024, 0.02]} /></mesh>

              {/* Headband when unhelmeted */}
              {v.helm === 'none' && (
                <mesh position={[0, 0.25, 0]} material={mats.trim}>
                  <cylinderGeometry args={[0.116, 0.116, 0.045, 6]} />
                </mesh>
              )}

              <group ref={helmGroup}>
                {v.helm === 'leather' && (
                  <group position={[0, 0.22, 0]}>
                    <mesh material={mats.leather}><cylinderGeometry args={[0.125, 0.135, 0.17, 6]} /></mesh>
                    <mesh position={[0, -0.05, 0.11]} material={mats.bronze}><boxGeometry args={[0.14, 0.04, 0.05]} /></mesh>
                  </group>
                )}
                {v.helm === 'galea' && (
                  <group position={[0, 0.21, 0]}>
                    <mesh material={mats.iron}><cylinderGeometry args={[0.13, 0.145, 0.24, 6]} /></mesh>
                    <mesh position={[0, -0.02, 0.12]} material={mats.bronze}><boxGeometry args={[0.14, 0.14, 0.06]} /></mesh>
                    <mesh position={[0, 0.19, -0.02]} material={mats.gearPaint}><boxGeometry args={[0.06, 0.17, 0.34]} /></mesh>
                  </group>
                )}
                {v.helm === 'horned' && (
                  <group position={[0, 0.20, 0]}>
                    <mesh position={[0, 0.02, 0.02]} material={mats.iron}><boxGeometry args={[0.20, 0.11, 0.18]} /></mesh>
                    <mesh position={[0.11, 0.16, 0.02]} rotation={[0, 0, -0.45]} material={mats.gearPaint}><coneGeometry args={[0.045, 0.26, 4]} /></mesh>
                    <mesh position={[-0.11, 0.16, 0.02]} rotation={[0, 0, 0.45]} material={mats.gearPaint}><coneGeometry args={[0.045, 0.26, 4]} /></mesh>
                  </group>
                )}
                {v.helm === 'cage' && (
                  <group position={[0, 0.22, 0]}>
                    <mesh material={mats.iron}><cylinderGeometry args={[0.15, 0.165, 0.28, 6]} /></mesh>
                    <mesh position={[0, 0.01, 0.13]} material={mats.trim}><boxGeometry args={[0.18, 0.04, 0.04]} /></mesh>
                    <mesh position={[0, 0.15, 0]} material={mats.gearPaint}><coneGeometry args={[0.12, 0.14, 6]} /></mesh>
                  </group>
                )}
                {v.helm === 'corinthian' && (
                  <group position={[0, 0.22, 0]}>
                    <mesh material={mats.bronze}><cylinderGeometry args={[0.135, 0.15, 0.25, 6]} /></mesh>
                    <mesh position={[0.09, -0.06, 0.07]} material={mats.bronze}><boxGeometry args={[0.05, 0.12, 0.09]} /></mesh>
                    <mesh position={[-0.09, -0.06, 0.07]} material={mats.bronze}><boxGeometry args={[0.05, 0.12, 0.09]} /></mesh>
                    <mesh position={[0, 0.20, -0.02]} material={mats.gearPaint}><boxGeometry args={[0.055, 0.21, 0.36]} /></mesh>
                  </group>
                )}
              </group>
            </group>

            {/* Layer 3: Breakable Solid Faceted Pauldrons / Cuirass */}
            <group ref={pauldronGroup}>
              {v.body === 'manica' && (
                <group position={[0.23, 0.56, 0]}>
                  <mesh rotation={[0, 0, -0.35]} material={mats.bronze}><cylinderGeometry args={[0.11, 0.13, 0.18, 5]} /></mesh>
                </group>
              )}
              {v.body === 'spiked' && (
                <group>
                  {([0.29, -0.29] as const).map((x) => (
                    <group key={x} position={[x, 0.58, 0]}>
                      <mesh material={mats.iron}><icosahedronGeometry args={[0.17, 0]} /></mesh>
                      <mesh position={[x > 0 ? 0.06 : -0.06, 0.20, 0]} rotation={[0, 0, x > 0 ? -0.32 : 0.32]} material={mats.gearPaint}>
                        <coneGeometry args={[0.055, 0.24, 4]} />
                      </mesh>
                    </group>
                  ))}
                </group>
              )}
              {v.body === 'galerus' && (
                <group position={[0.26, 0.64, 0]} rotation={[0, 0, -0.22]}>
                  <mesh material={mats.bronze}><boxGeometry args={[0.06, 0.42, 0.28]} /></mesh>
                  <mesh position={[0.02, 0.04, 0]} material={mats.gearPaint}><boxGeometry args={[0.04, 0.34, 0.20]} /></mesh>
                </group>
              )}
              {v.body === 'cuirass' && (
                <group>
                  <mesh position={[0, 0.35, 0.02]} scale={[1.08, 1, 0.72]} material={mats.bronze}>
                    <cylinderGeometry args={[0.24, 0.17, 0.44, 6]} />
                  </mesh>
                  <mesh position={[0.24, 0.58, 0]} material={mats.bronze}><boxGeometry args={[0.18, 0.12, 0.22]} /></mesh>
                  <mesh position={[-0.24, 0.58, 0]} material={mats.bronze}><boxGeometry args={[0.18, 0.12, 0.22]} /></mesh>
                </group>
              )}
            </group>

            {/* Layer 4: Flowing Textured Capes */}
            {v.cape === 'scarf' && (
              <group ref={cape0} position={[0, 0.54, -0.12]}>
                <mesh position={[0, -0.20, 0]} material={mats.cape}><boxGeometry args={[0.32, 0.38, 0.02]} /></mesh>
              </group>
            )}
            {(v.cape === 'cloak' || v.cape === 'mantle') && (
              <group ref={cape0} position={[0, 0.54, -0.11]}>
                <mesh position={[0, -0.18, 0]} material={v.cape === 'mantle' ? mats.bronze : mats.cape}>
                  <boxGeometry args={[v.cape === 'mantle' ? 0.5 : 0.42, 0.36, 0.02]} />
                </mesh>
                <group ref={cape1} position={[0, -0.36, 0]}>
                  <mesh position={[0, -0.18, 0]} material={mats.cape}>
                    <boxGeometry args={[v.cape === 'mantle' ? 0.58 : 0.48, 0.36, 0.02]} />
                  </mesh>
                  <group ref={cape2} position={[0, -0.36, 0]}>
                    <mesh position={[0, -0.18, 0]} material={v.cape === 'mantle' ? mats.trim : mats.cape}>
                      <boxGeometry args={[v.cape === 'mantle' ? 0.64 : 0.54, 0.36, 0.02]} />
                    </mesh>
                  </group>
                </group>
              </group>
            )}

            {/* Left arm (+X) + Shield / Off-hand weapon */}
            <group ref={shL} position={[0.23, 0.54, 0]} rotation={[0, 0, 0.18]}>
              <mesh material={mats.armL}><cylinderGeometry args={[0.082, 0.074, 0.1, 5]} /></mesh>
              <mesh position={[0, -0.17, 0]} material={mats.armL}><cylinderGeometry args={[0.072, 0.058, 0.34, 5]} /></mesh>
              <group ref={elL} position={[0, -0.34, 0]}>
                <mesh position={[0, -0.15, 0]} material={mats.armL}><cylinderGeometry args={[0.062, 0.048, 0.30, 5]} /></mesh>
                <mesh position={[0, -0.22, 0]} material={mats.bronze}><cylinderGeometry args={[0.068, 0.058, 0.14, 5]} /></mesh>
                <mesh position={[0, -0.32, 0]} material={mats.leather}><boxGeometry args={[0.08, 0.09, 0.09]} /></mesh>
                {armed && v.offhand === 'scutum' && (
                  <group position={[0.08, -0.22, 0.14]}>
                    <group ref={shieldTrim}>
                      <mesh material={mats.wood}><boxGeometry args={[0.06, 0.84, 0.50]} /></mesh>
                      <mesh position={[0.02, 0, 0]} material={mats.gearPaint}><boxGeometry args={[0.04, 0.72, 0.38]} /></mesh>
                      <mesh position={[0.045, 0, 0]} rotation={[0, 0, -Math.PI / 2]} material={mats.bronze}><coneGeometry args={[0.11, 0.09, 6]} /></mesh>
                    </group>
                  </group>
                )}
                {armed && v.offhand === 'buckler' && (
                  <group position={[0.08, -0.26, 0.12]} rotation={[0, 0, Math.PI / 2]}>
                    <group ref={shieldTrim}>
                      <mesh material={mats.bronze}><cylinderGeometry args={[0.31, 0.31, 0.06, 10]} /></mesh>
                      <mesh position={[0, -0.02, 0]} material={mats.gearPaint}><cylinderGeometry args={[0.23, 0.23, 0.05, 8]} /></mesh>
                      <mesh position={[0, -0.05, 0]} rotation={[Math.PI, 0, 0]} material={mats.bronze}><coneGeometry args={[0.09, 0.07, 6]} /></mesh>
                    </group>
                  </group>
                )}
                {armed && v.weapon === 'twinSica' && (
                  <group ref={weaponGroupL} position={[0, -0.32, 0]} rotation={[-0.4, 0, 0]}>
                    <mesh position={[0, -0.05, 0]} material={mats.bronze}><boxGeometry args={[0.16, 0.04, 0.06]} /></mesh>
                    <mesh position={[0, -0.36, 0]} material={mats.blade}><boxGeometry args={[0.045, 0.76, 0.065]} /></mesh>
                    <mesh position={[0, -0.78, 0.05]} rotation={[0.35, 0, 0]} material={mats.blade}><coneGeometry args={[0.05, 0.28, 4]} /></mesh>
                  </group>
                )}
                {armed && v.offhand === 'net' && v.weapon !== 'twinSica' && (
                  <mesh position={[0.04, -0.32, 0.08]} material={mats.net}><icosahedronGeometry args={[0.22, 1]} /></mesh>
                )}
              </group>
            </group>

            {/* Right arm (-X) + Main Polygon Weapon + Telegraph Glint */}
            <group ref={shR} position={[-0.23, 0.54, 0]} rotation={[0, 0, -0.18]}>
              <mesh material={mats.armR}><cylinderGeometry args={[0.082, 0.074, 0.1, 5]} /></mesh>
              <mesh position={[0, -0.17, 0]} material={mats.armR}><cylinderGeometry args={[0.072, 0.058, 0.34, 5]} /></mesh>
              <group ref={elR} position={[0, -0.34, 0]}>
                <mesh position={[0, -0.15, 0]} material={mats.armR}><cylinderGeometry args={[0.062, 0.048, 0.30, 5]} /></mesh>
                <mesh position={[0, -0.22, 0]} material={mats.bronze}><cylinderGeometry args={[0.068, 0.058, 0.14, 5]} /></mesh>
                <mesh position={[0, -0.32, 0]} material={mats.leather}><boxGeometry args={[0.08, 0.09, 0.09]} /></mesh>
                <group ref={weaponGroupR}>
                  {armed && v.weapon === 'gladius' && (
                    <group position={[0, -0.32, 0]} rotation={[-0.4, 0, 0]}>
                      <mesh position={[0, -0.05, 0]} material={mats.bronze}><boxGeometry args={[0.20, 0.045, 0.07]} /></mesh>
                      <mesh position={[0, -0.44, 0]} material={mats.blade}><boxGeometry args={[0.06, 0.72, 0.075]} /></mesh>
                      <mesh position={[0, -0.88, 0]} rotation={[Math.PI, 0, 0]} material={mats.blade}><coneGeometry args={[0.065, 0.22, 4]} /></mesh>
                    </group>
                  )}
                  {armed && v.weapon === 'twinSica' && (
                    <group position={[0, -0.32, 0]} rotation={[-0.4, 0, 0]}>
                      <mesh position={[0, -0.05, 0]} material={mats.bronze}><boxGeometry args={[0.16, 0.04, 0.06]} /></mesh>
                      <mesh position={[0, -0.36, 0]} material={mats.blade}><boxGeometry args={[0.045, 0.76, 0.065]} /></mesh>
                      <mesh position={[0, -0.78, 0.05]} rotation={[0.35, 0, 0]} material={mats.blade}><coneGeometry args={[0.05, 0.28, 4]} /></mesh>
                    </group>
                  )}
                  {armed && v.weapon === 'warhammer' && (
                    <group position={[0, -0.32, 0]} rotation={[-0.35, 0, 0]}>
                      <mesh position={[0, -0.58, 0]} material={mats.wood}><cylinderGeometry args={[0.04, 0.04, 1.38, 5]} /></mesh>
                      <mesh position={[0, -1.24, 0]} material={mats.iron}><boxGeometry args={[0.28, 0.24, 0.48]} /></mesh>
                      <mesh position={[0, -1.24, 0]} material={mats.gearPaint}><boxGeometry args={[0.31, 0.14, 0.28]} /></mesh>
                      <mesh position={[0, -1.42, 0]} rotation={[Math.PI, 0, 0]} material={mats.blade}><coneGeometry args={[0.09, 0.22, 4]} /></mesh>
                    </group>
                  )}
                  {armed && v.weapon === 'trident' && (
                    <group position={[0, -0.32, 0]} rotation={[-0.45, 0, 0]}>
                      <mesh position={[0, -0.52, 0]} material={mats.wood}><cylinderGeometry args={[0.032, 0.032, 1.56, 5]} /></mesh>
                      <mesh position={[0, -1.28, 0]} material={mats.bronze}><boxGeometry args={[0.34, 0.06, 0.06]} /></mesh>
                      {([-0.14, 0, 0.14] as const).map((x) => (
                        <mesh key={x} position={[x, -1.46, 0]} rotation={[Math.PI, 0, 0]} material={mats.blade}><coneGeometry args={[0.045, 0.36, 4]} /></mesh>
                      ))}
                    </group>
                  )}
                  {armed && v.weapon === 'spear' && (
                    <group position={[0, -0.32, 0]} rotation={[-0.48, 0, 0]}>
                      <mesh position={[0, -0.50, 0]} material={mats.wood}><cylinderGeometry args={[0.032, 0.032, 1.65, 5]} /></mesh>
                      <mesh position={[0, -1.42, 0]} rotation={[Math.PI, 0, 0]} material={mats.blade}><coneGeometry args={[0.085, 0.30, 4]} /></mesh>
                    </group>
                  )}
                </group>
                <mesh
                  ref={glintMesh}
                  position={[0, v.weapon === 'warhammer' || v.weapon === 'trident' || v.weapon === 'spear' ? -1.42 : -0.88, 0]}
                  visible={false}
                  material={mats.glint}
                >
                  <octahedronGeometry args={[0.16, 0]} />
                </mesh>
              </group>
            </group>
          </group>
        </group>

        {!civilian && (
          <mesh position={[0, 0.025, 0]} rotation={[-Math.PI / 2, 0, 0]} material={mats.ring}>
            <ringGeometry args={[0.48, 0.56, 12]} />
          </mesh>
        )}
      </group>
    );
  },
);
