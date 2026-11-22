import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { Gladiator, type GladiatorHandle, type LimbPose } from './Gladiator';
import { Stations } from './Stations';
import { StaticBatch } from './art/StaticBatch';
import { Brazier, Ps1Sky } from './art/Ps1Sky';
import { LightCycle, type CycleRenderState } from './art/LightCycle';
import { CITY_CURVE_RADIUS, makeCurvedBasicMaterial, setCurvature } from './art/curvature';
import { cloneTex, getPs1Texture, makePs1Material } from './art/ps1Textures';
import { sfx } from './art/sfx';
import { SurrealSpores } from './art/SurrealSpores';
import Starfield from './art/Starfield';
import SpriteText from './art/SpriteText';
import { CorinthianColumn, DoricColumn, IonicColumn } from './art/ClassicalColumns';
import {
  ATTACKS, DODGE_TIME, LIMB_KEYS, NO_INTENT, aiIntent, canExecuteTarget, defaultMods, drinkFlask,
  gearOf, makeFighter, parryWindowOf, resolveStrike, spawnDroppedWeapon, startAttack, stepFighter,
  stepWeaponProps, throwFighterWeapon, tryExecute, tryPickupWeapon, windupOf,
  type ArenaWeaponProp, type Fighter, type HitEvent, type Intent, type StanceHeight,
} from './arena/combat';
import { DashGhosts, GhostPool, ShardPool, SlashPool, SlashRibbons } from './arena/effects';
import { lookColor } from './arena/run';
import { type ArmorKey } from './arena/styles';
import { buildPlayerMods } from './rpg/stats';
import { gearFromStyle, resolveLoadout } from './rpg/items';
import { COMPANIONS, nearestStoryStage, type CompanionDef } from './rpg/stories';
import { clampBounds, resolveCircles } from './world/colliders';
import {
  AQUEDUCT_PIERS, AQUEDUCT_YAW, BASIN, CITY_TOWERS, COLUMNS, JAIL_CELL,
  nearestStation,
} from './world/layout';
import {
  biomeAt, collidersNear, isSanctuaryPosition, nearestColosseum, nearestSettlement,
  nearestSettlementTerminal, nearestWorldColosseumGate, regionDisplayName, WORLD_BOUNDS,
} from './world/universe';
import { boostRingsNear, nearestMemoryEcho } from './world/MemoryWoods';
import { nearestPropertyDeed } from './world/properties';
import { InfiniteCurvedFloor, NearestColosseumBeacon, StreamingSettlements } from './world/WorldRenderer';
import {
  advanceNpcSchedule, antagonizeNpc, createCityPopulation, createRegionNpcs, greetNpc, pickCityPoint,
  stepNpcTrafficYield, triggerStreetEvent, type CityNpc,
} from './world/citizens';
import { consumeMouseLook, keys, pressed } from './input';
import { useGame } from './store';

const PLAYER_R = 0.55;
const UNARMED_JOG_SPEED = 14.5;
const UNARMED_SPRINT_SPEED = 21.5;
const PLAYER_COMBAT_SPEED = 7.8;
const CYCLE_SPEED = 46;
const CYCLE_TURBO_SPEED = 68;
const CYCLE_BOOST_SPEED = 78;
const KB_YAW_SENS = 0.06;
const CAMERA_SOCKET_DISTANCE = 5.6;
const CAMERA_SOCKET_HEIGHT = 3.55;
const CAMERA_LOOK_AHEAD = 9.0;
const CAMERA_LOOK_HEIGHT = 1.55;
const CAMERA_MOVE_LEAD = 0.9;
const CAMERA_LERP = 0.18;
const EYE_Y = 1.6;

type PosRef = React.MutableRefObject<THREE.Vector3>;

function Colonnade({ playerPos }: { playerPos: PosRef }) {
  return (
    <group>
      {COLUMNS.map((c, i) => {
        const P = c.order === 'doric' ? DoricColumn : c.order === 'ionic' ? IonicColumn : CorinthianColumn;
        return <P key={i} position={c.pos} scale={c.scale} playerPos={playerPos} />;
      })}
    </group>
  );
}

/** Subdivided obsidian circuit-grid city ground, illuminated neon avenues, and central Memory Core Fountain. */
function NeonCityFloor() {
  const waterRef = useRef<THREE.Mesh>(null!);
  const waterfallRef = useRef<THREE.Mesh>(null!);
  const mats = useMemo(() => {
    const waterTex = cloneTex(getPs1Texture('water'), 2, 4);
    const waterMat = makePs1Material({ color: '#ffffff', map: waterTex, emissive: '#22c8e8', emissiveIntensity: 0.65 });
    return {
      plaza: makePs1Material({ color: '#c2f0ff', map: cloneTex(getPs1Texture('grid'), 22, 22), emissive: '#133a57', emissiveIntensity: 0.55 }),
      avenue: makePs1Material({ color: '#8ce2ff', map: cloneTex(getPs1Texture('conduit'), 2, 28), emissive: '#164566', emissiveIntensity: 0.55 }),
      cross: makePs1Material({ color: '#7ccaff', map: cloneTex(getPs1Texture('conduit'), 16, 1), emissive: '#123654', emissiveIntensity: 0.48 }),
      cyanStrip: makeCurvedBasicMaterial({ color: '#3ff0ff' }),
      magStrip: makeCurvedBasicMaterial({ color: '#ff4fd8' }),
      conduit: makePs1Material({ color: '#273054', map: cloneTex(getPs1Texture('conduit'), 4, 1), emissive: '#10293d', emissiveIntensity: 0.35 }),
      gold: makePs1Material({ color: '#ffd480', map: getPs1Texture('bronze'), emissive: '#785212', emissiveIntensity: 0.35 }),
      water: waterMat,
      waterTex,
    };
  }, []);

  useFrame(({ clock }) => {
    if (mats.waterTex) {
      mats.waterTex.offset.y = -clock.elapsedTime * 0.45;
      mats.waterTex.offset.x = Math.sin(clock.elapsedTime * 0.6) * 0.04;
    }
    if (waterRef.current) waterRef.current.position.y = 1.44 + Math.sin(clock.elapsedTime * 2.2) * 0.03;
    if (waterfallRef.current) waterfallRef.current.rotation.y = clock.elapsedTime * 1.1;
  });

  return (
    <group>
      {/* Central Cache Plaza Market Floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, -4]} material={mats.plaza} frustumCulled={false}>
        <planeGeometry args={[76, 82, 24, 24]} />
      </mesh>
      {/* Processional Purge Grid Boulevard (Z = +84 down to -102) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.024, -9]} material={mats.avenue} frustumCulled={false}>
        <planeGeometry args={[6.8, 186, 2, 52]} />
      </mesh>
      <mesh position={[-3.45, 0.045, -9]} material={mats.cyanStrip} frustumCulled={false}>
        <boxGeometry args={[0.18, 0.05, 186, 1, 1, 52]} />
      </mesh>
      <mesh position={[3.45, 0.045, -9]} material={mats.magStrip} frustumCulled={false}>
        <boxGeometry args={[0.18, 0.05, 186, 1, 1, 52]} />
      </mesh>
      {/* Cross-street neon data corridors */}
      {([32, 12, -12, -30] as const).map((z) => (
        <mesh key={z} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, z]} material={mats.cross} frustumCulled={false}>
          <planeGeometry args={[84, 4.4, 24, 1]} />
        </mesh>
      ))}

      {/* Memory Core Fountain + Data Waterfall from Overhead Aqueduct */}
      <group position={[BASIN.x, 0, BASIN.z]}>
        <mesh position={[0, 0.16, 0]} material={mats.conduit}><cylinderGeometry args={[3.6, 3.8, 0.32, 8]} /></mesh>
        <mesh position={[0, 0.85, 0]} material={mats.conduit}><cylinderGeometry args={[3.0, 2.7, 1.1, 8]} /></mesh>
        <mesh position={[0, 1.44, 0]} rotation={[Math.PI / 2, 0, Math.PI / 8]} material={mats.gold}><torusGeometry args={[2.95, 0.16, 6, 8]} /></mesh>
        <mesh ref={waterRef} position={[0, 1.44, 0]} rotation={[-Math.PI / 2, 0, 0]} material={mats.water}><circleGeometry args={[2.82, 8]} /></mesh>
        <mesh ref={waterfallRef} position={[0, 7.3, 0]} material={mats.water}>
          <cylinderGeometry args={[0.42, 0.72, 12.2, 6, 8]} />
        </mesh>
      </group>
    </group>
  );
}

/** Monumental Double-Tiered Roman × TRON Data-Aqueduct sweeping across the curved skyline. */
function NeonDataAqueduct() {
  const mats = useMemo(() => {
    const streamTex = cloneTex(getPs1Texture('water'), 22, 1);
    return {
      pier: makePs1Material({ color: '#242b4f', map: cloneTex(getPs1Texture('conduit'), 1, 4), emissive: '#0b2236', emissiveIntensity: 0.4 }),
      deck: makePs1Material({ color: '#2e3866', map: cloneTex(getPs1Texture('conduit'), 6, 1), emissive: '#10314a', emissiveIntensity: 0.4 }),
      trim: makeCurvedBasicMaterial({ color: '#3ff0ff' }),
      mag: makeCurvedBasicMaterial({ color: '#ff4fd8' }),
      stream: makePs1Material({ color: '#9cf6ff', map: streamTex, emissive: '#22d8ff', emissiveIntensity: 0.75 }),
      streamTex,
    };
  }, []);

  useFrame(({ clock }) => {
    if (mats.streamTex) mats.streamTex.offset.x = clock.elapsedTime * 0.25;
  });

  // Span definitions connecting adjacent piers along diagonal Aqueduct axis
  const spans = useMemo(() => {
    const out: { cx: number; cz: number; len: number }[] = [];
    for (let i = 0; i < AQUEDUCT_PIERS.length - 1; i++) {
      const a = AQUEDUCT_PIERS[i];
      const b = AQUEDUCT_PIERS[i + 1];
      out.push({ cx: (a.x + b.x) / 2, cz: (a.z + b.z) / 2, len: Math.hypot(b.x - a.x, b.z - a.z) });
    }
    return out;
  }, []);

  return (
    <group>
      {/* Massive Support Piers */}
      {AQUEDUCT_PIERS.map((p, i) => (
        <group key={`pier-${i}`} position={[p.x, 0, p.z]} rotation={[0, p.rotY, 0]}>
          <mesh position={[0, 0.45, 0]} material={mats.pier} frustumCulled={false}><boxGeometry args={[2.8, 0.9, 2.8]} /></mesh>
          <mesh position={[0, 7.1, 0]} material={mats.pier} frustumCulled={false}><boxGeometry args={[2.0, 12.6, 2.0]} /></mesh>
          <mesh position={[0, 7.4, 0]} material={mats.trim} frustumCulled={false}><boxGeometry args={[2.22, 0.22, 2.22]} /></mesh>
          <mesh position={[0, 11.4, 0]} material={mats.trim} frustumCulled={false}><boxGeometry args={[2.22, 0.22, 2.22]} /></mesh>
        </group>
      ))}

      {/* Vaulted Lower Arches + Upper Data Channel Spans */}
      {spans.map((sp, i) => (
        <group key={`span-${i}`} position={[sp.cx, 0, sp.cz]} rotation={[0, AQUEDUCT_YAW, 0]}>
          {/* Tier 1 Walkway Beam */}
          <mesh position={[0, 7.4, 0]} material={mats.deck} frustumCulled={false}><boxGeometry args={[sp.len, 1.15, 2.1, 10, 1, 1]} /></mesh>
          {/* Roman PS1 Angled Vault Haunches */}
          <mesh position={[-sp.len * 0.26, 5.75, 0]} rotation={[0, 0, 0.62]} material={mats.pier} frustumCulled={false}>
            <boxGeometry args={[4.4, 0.95, 1.7, 4, 1, 1]} />
          </mesh>
          <mesh position={[sp.len * 0.26, 5.75, 0]} rotation={[0, 0, -0.62]} material={mats.pier} frustumCulled={false}>
            <boxGeometry args={[4.4, 0.95, 1.7, 4, 1, 1]} />
          </mesh>
          {/* Tier 2 Repeating Mini-Arcades */}
          {([-sp.len * 0.25, sp.len * 0.25] as const).map((ux, ui) => (
            <mesh key={ui} position={[ux, 9.6, 0]} material={mats.pier} frustumCulled={false}>
              <boxGeometry args={[1.35, 3.4, 1.55]} />
            </mesh>
          ))}
          {/* Upper Aqueduct Crown + Glowing Neon Rails + Flowing Cyan Data River */}
          <mesh position={[0, 11.7, 0]} material={mats.deck} frustumCulled={false}><boxGeometry args={[sp.len, 1.35, 2.4, 10, 1, 1]} /></mesh>
          <mesh position={[0, 12.55, -1.05]} material={mats.trim} frustumCulled={false}><boxGeometry args={[sp.len, 0.3, 0.24, 10, 1, 1]} /></mesh>
          <mesh position={[0, 12.55, 1.05]} material={mats.mag} frustumCulled={false}><boxGeometry args={[sp.len, 0.3, 0.24, 10, 1, 1]} /></mesh>
          <mesh position={[0, 12.5, 0]} material={mats.stream} frustumCulled={false}><boxGeometry args={[sp.len, 0.26, 1.75, 10, 1, 1]} /></mesh>
        </group>
      ))}
    </group>
  );
}

/** Dense Night City skyscrapers, neon holo-billboards, skybridges, street props & Outer Heap monoliths. */
function NightCityArchitecture() {
  const mats = useMemo(() => ({
    tower: makePs1Material({ color: '#2b335c', map: cloneTex(getPs1Texture('circuit'), 2, 6), emissive: '#0c1c36', emissiveIntensity: 0.45 }),
    podium: makePs1Material({ color: '#1b2140', map: cloneTex(getPs1Texture('conduit'), 2, 2), emissive: '#091529', emissiveIntensity: 0.3 }),
    holo: makePs1Material({ color: '#ffffff', map: getPs1Texture('holo'), emissive: '#d84cff', emissiveIntensity: 0.65 }),
    cyan: makeCurvedBasicMaterial({ color: '#3ff0ff' }),
    magenta: makeCurvedBasicMaterial({ color: '#ff4fd8' }),
    gold: makeCurvedBasicMaterial({ color: '#ffc95c' }),
    violet: makeCurvedBasicMaterial({ color: '#a78bfa' }),
    emerald: makeCurvedBasicMaterial({ color: '#4dffa0' }),
    crimson: makeCurvedBasicMaterial({ color: '#ff3b5c' }),
  }), []);

  const accentMat = (hex: string) =>
    hex === '#ff4fd8' ? mats.magenta : hex === '#ffc95c' ? mats.gold : hex === '#4dffa0' ? mats.emerald : hex === '#a78bfa' ? mats.violet : mats.cyan;

  const skybridges: { x: number; z: number; y: number; w: number }[] = [
    { x: -37, z: 34, y: 12.5, w: 26 },
    { x: 37, z: -25, y: 14.5, w: 26 },
    { x: -37, z: -50, y: 16.0, w: 26 },
    { x: 37, z: 46, y: 13.0, w: 26 },
  ];

  const heapMonoliths: [number, number][] = [
    [-82, 74], [82, 74], [-86, -74], [86, -74], [-64, 80], [64, 80], [0, 76], [0, -92],
  ];

  return (
    <group>
      {CITY_TOWERS.map((t, i) => {
        const edgeMat = accentMat(t.accent);
        const stripH = t.h;
        return (
          <group key={`tower-${i}`} position={[t.x, 0, t.z]}>
            <mesh position={[0, 2.2, 0]} material={mats.podium}><boxGeometry args={[t.w + 1.4, 4.4, t.d + 1.4]} /></mesh>
            <mesh position={[0, t.h / 2, 0]} material={mats.tower}><boxGeometry args={[t.w, t.h, t.d]} /></mesh>
            {/* Glowing vertical PS1 neon corner ribs */}
            {([[-1, -1], [1, -1], [-1, 1], [1, 1]] as const).map(([sx, sz], ci) => (
              <mesh key={ci} position={[sx * (t.w / 2 + 0.06), stripH / 2, sz * (t.d / 2 + 0.06)]} material={edgeMat}>
                <boxGeometry args={[0.26, stripH, 0.26]} />
              </mesh>
            ))}
            {/* Rooftop crown ring & antenna */}
            <mesh position={[0, t.h + 0.35, 0]} material={edgeMat}><boxGeometry args={[t.w * 0.72, 0.45, t.d * 0.72]} /></mesh>
            {i % 2 === 0 && (
              <mesh position={[0, t.h + 4.8, 0]} material={edgeMat}><cylinderGeometry args={[0.12, 0.35, 8.8, 4]} /></mesh>
            )}
            {/* Floating PS1 Cyberpunk Billboard */}
            {t.billboard && (
              <group position={[t.x < 0 ? t.w / 2 + 0.6 : -t.w / 2 - 0.6, Math.min(t.h - 4, 15), 0]} rotation={[0, t.x < 0 ? Math.PI / 2 : -Math.PI / 2, 0]}>
                <mesh material={mats.holo}><boxGeometry args={[7.4, 3.6, 0.32]} /></mesh>
                <mesh position={[0, 1.95, 0]} material={edgeMat}><boxGeometry args={[7.8, 0.24, 0.4]} /></mesh>
                <mesh position={[0, -1.95, 0]} material={edgeMat}><boxGeometry args={[7.8, 0.24, 0.4]} /></mesh>
              </group>
            )}
          </group>
        );
      })}

      {/* Overhead Neon Skybridges linking megablocks */}
      {skybridges.map((sb, i) => (
        <group key={`sb-${i}`} position={[sb.x, sb.y, sb.z]}>
          <mesh material={mats.podium}><boxGeometry args={[sb.w, 1.4, 3.6, 10, 1, 1]} /></mesh>
          <mesh position={[0, 0.85, 1.85]} material={mats.cyan}><boxGeometry args={[sb.w, 0.24, 0.2, 10, 1, 1]} /></mesh>
          <mesh position={[0, 0.85, -1.85]} material={mats.magenta}><boxGeometry args={[sb.w, 0.24, 0.2, 10, 1, 1]} /></mesh>
        </group>
      ))}

      {/* Street-level Data Kiosk Benches & Supply Crates around Plaza */}
      {([-10, 10] as const).map((x) => (
        <group key={`kiosk-${x}`} position={[x, 0, -2]}>
          <mesh position={[0, 0.42, 0]} material={mats.podium}><boxGeometry args={[1.6, 0.84, 1.6]} /></mesh>
          <mesh position={[0, 0.92, 0]} material={mats.holo}><boxGeometry args={[1.3, 0.24, 1.3]} /></mesh>
        </group>
      ))}

      {/* Outer Heap Corrupted Data Monoliths beyond city edge */}
      {heapMonoliths.map(([mx, mz], i) => (
        <group key={`heap-${i}`} position={[mx, 0, mz]} rotation={[0.12 * (i % 2 === 0 ? 1 : -1), i * 0.8, 0.08]}>
          <mesh position={[0, 3.8, 0]} material={mats.podium}><cylinderGeometry args={[0.9, 1.6, 7.6, 4]} /></mesh>
          <mesh position={[0, 8.2, 0]} material={mats.crimson}><octahedronGeometry args={[1.1, 0]} /></mesh>
        </group>
      ))}
    </group>
  );
}

const makeLimbPose = (): LimbPose => ({
  head: { ratio: 1, severed: false }, torso: { ratio: 1, severed: false },
  armL: { ratio: 1, severed: false }, armR: { ratio: 1, severed: false },
  legL: { ratio: 1, severed: false }, legR: { ratio: 1, severed: false },
});

function syncGladiatorView(h: GladiatorHandle, f: Fighter, stanceTarget: number, fgSpeedMul: number) {
  const fg = gearOf(f);
  h.group.visible = f.state !== 'dead';
  h.group.position.set(f.x, 0, f.z);
  h.group.rotation.set(0, f.yaw, 0);
  const p = h.pose;
  const at = f.atk ? ATTACKS[f.atk] : null;
  let progress = 0, tele = 0, parryFlash = 0;
  if (at && f.atk && f.state === 'windup') {
    const wt = windupOf(f, f.atk);
    progress = Math.min(1, f.t / wt);
    tele = f.team === 'e' ? 0.35 + progress * 0.65 : 0;
    if (f.team === 'e' && f.atk !== 'bash' && wt - f.t <= 0.30) {
      parryFlash = Math.min(1, Math.max(0, 1 - (wt - f.t) / 0.30));
    }
  } else if (at && f.state === 'strike') {
    progress = Math.min(1, f.t / at.strike);
  } else if (at && f.state === 'recover') {
    progress = Math.min(1, f.t / (at.recover * fg.recoverMul));
  } else if (f.state === 'dodge') {
    progress = Math.min(1, f.t / DODGE_TIME);
  } else if (f.state === 'stagger') {
    progress = Math.min(1, f.t / (f.stagger || 0.2));
  }
  p.state = f.state;
  p.atk = f.atk;
  p.motion = f.atk ? fg.moves[f.atk].motion : undefined;
  p.progress = progress;
  p.telegraph = tele;
  p.parryFlash = parryFlash;
  p.parryReady = f.blocking && f.blockT <= parryWindowOf(f) ? 1 : 0;
  p.riposte = f.riposte > 0 || f.riposteActive ? 1 : 0;
  p.dazed = f.dazed;
  p.guardHeight = f.guardHeight;
  p.weaponDisarmed = f.weaponDisarmed;
  p.airY = f.airY;
  p.diveKicking = f.diveKicking;
  p.wallSplat = f.wallSplat;
  p.hitReaction = f.hitReaction;
  p.hitReactionT = f.hitReactionT;
  p.finisherChoreo = f.finisherChoreo;
  p.finisherT = f.finisherT;
  p.coreColor = fg.coreColor;
  p.block += ((f.blocking ? 1 : 0) - p.block) * 0.35;
  p.hurt = f.state === 'stagger' ? Math.max(0, 1 - f.t / 0.25) : Math.max(0, p.hurt - 0.12);
  p.stance = THREE.MathUtils.lerp(p.stance, stanceTarget, 0.22);
  p.localVx = f.localVx;
  p.localVz = f.localVz;
  p.dodgeLocalX = f.dodgeLocalX;
  p.dodgeLocalZ = f.dodgeLocalZ;
  p.snared = f.snared;
  const sp = Math.hypot(f.vx, f.vz);
  h.setMoving(f.state === 'dodge' ? 1 : Math.min(1, sp / (Math.max(1, f.stats.speed * fgSpeedMul))));
}

function NpcActor({ npc }: { npc: CityNpc }) {
  const g = useRef<GladiatorHandle>(null!);
  const npcBikeRef = useRef<THREE.Group>(null!);
  const parkedBikeRef = useRef<THREE.Group>(null!);
  const wheelFRef = useRef<THREE.Mesh>(null!);
  const wheelRRef = useRef<THREE.Mesh>(null!);
  const labelGroup = useRef<THREE.Group>(null!);
  const limbPose = useRef<LimbPose>(makeLimbPose());
  const armorPose = useRef<Record<ArmorKey, boolean>>({ helm: true, pauldron: true, shield: true });
  const [labelInfo, setLabelInfo] = useState<{ visible: boolean; text: string; color: string }>({
    visible: false, text: npc.filename, color: npc.color,
  });

  const bikeMats = useMemo(() => ({
    hull: makePs1Material({ color: '#1e284d', map: getPs1Texture('conduit'), emissive: '#102446', emissiveIntensity: 0.45 }),
    trim: makeCurvedBasicMaterial({ color: npc.color }),
    core: makeCurvedBasicMaterial({ color: '#e8fbff' }),
  }), [npc.color]);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    const h = g.current;
    if (!h) return;
    for (const k of LIMB_KEYS) {
      limbPose.current[k].ratio = npc.fighter.limbs[k].hp / (npc.fighter.limbs[k].max || 1);
      limbPose.current[k].severed = npc.fighter.limbs[k].severed;
    }
    h.pose.limbs = limbPose.current;
    armorPose.current.helm = !npc.fighter.armor.helm.broken;
    armorPose.current.pauldron = !npc.fighter.armor.pauldron.broken;
    armorPose.current.shield = !npc.fighter.armor.shield.broken;
    h.pose.armor = armorPose.current;

    if (npc.mood === 'dead') {
      if (npcBikeRef.current) npcBikeRef.current.visible = false;
      const rem = npc.collapseT ?? 0;
      if (rem > 0) {
        h.group.visible = true;
        const fallRatio = Math.min(1, (1.35 - rem) / 0.35);
        h.group.position.set(npc.x, 0.24 * fallRatio, npc.z);
        h.group.rotation.set(-Math.PI * 0.48 * fallRatio, npc.yaw, 0.35 * fallRatio);
      } else {
        h.group.visible = false;
      }
      if (labelInfo.visible) setLabelInfo({ visible: false, text: npc.filename, color: npc.color });
      return;
    }
    const armed = npc.mood === 'hostile' || npc.role === 'corrupted';
    const riding = npc.onVehicle && npc.mood === 'calm';
    syncGladiatorView(h, npc.fighter, armed ? 1 : riding ? 0.65 : 0, npc.gear.speedMul);
    if (riding) h.group.position.y = 0.42;

    if (npcBikeRef.current) {
      npcBikeRef.current.visible = riding;
      if (riding) {
        npcBikeRef.current.position.set(npc.x, 0, npc.z);
        npcBikeRef.current.rotation.set(0, npc.yaw, npc.vehicleLean);
        const wSpin = Math.hypot(npc.fighter.vx, npc.fighter.vz) * dt * 1.45;
        if (wheelFRef.current) wheelFRef.current.rotation.x += wSpin;
        if (wheelRRef.current) wheelRRef.current.rotation.x += wSpin;
      }
    }
    if (parkedBikeRef.current) {
      const showParked = !riding && Boolean(npc.parkedCycle) && npc.mood === 'calm';
      parkedBikeRef.current.visible = showParked;
      if (showParked && npc.parkedCycle) {
        parkedBikeRef.current.position.set(npc.parkedCycle.x, 0, npc.parkedCycle.z);
        parkedBikeRef.current.rotation.set(0, npc.parkedCycle.yaw, 0.16);
      }
    }

    if (labelGroup.current) labelGroup.current.position.set(npc.x, riding ? 0.42 : 0, npc.z);
    const desiredVis = npc.barkT > 0 || armed || npc.role === 'enforcer' || npc.role === 'gladiator' || riding;
    const text = npc.barkT > 0
      ? `${npc.filename}\n"${npc.bark}"`
      : armed
        ? `${npc.filename} [!]`
        : `${npc.filename}\n[${riding ? 'CYCLE · ' : ''}${npc.activityLabel}]`;
    const col = armed ? '#ff4f6d' : npc.color;
    if (desiredVis !== labelInfo.visible || (desiredVis && (text !== labelInfo.text || col !== labelInfo.color))) {
      setLabelInfo({ visible: desiredVis, text, color: col });
    }
  });

  const armed = npc.mood === 'hostile' || npc.role === 'enforcer' || npc.role === 'corrupted';
  return (
    <group>
      <group ref={npcBikeRef} visible={false}>
        <mesh position={[0, 0.44, 0]} material={bikeMats.hull}><boxGeometry args={[0.52, 0.34, 2.2]} /></mesh>
        <mesh position={[0, 0.66, 0.42]} rotation={[0.24, 0, 0]} material={bikeMats.hull}><boxGeometry args={[0.48, 0.24, 1.05]} /></mesh>
        <mesh position={[0, 0.78, 0.55]} rotation={[0.42, 0, 0]} material={bikeMats.trim}><boxGeometry args={[0.38, 0.12, 0.68]} /></mesh>
        {([-0.22, 0.22] as const).map((lx) => (
          <mesh key={lx} position={[lx, 0.48, 0]} material={bikeMats.trim}><boxGeometry args={[0.08, 0.09, 2.05]} /></mesh>
        ))}
        <mesh ref={wheelFRef} position={[0, 0.4, 0.98]} rotation={[0, 0, Math.PI / 2]} material={bikeMats.trim}>
          <cylinderGeometry args={[0.4, 0.4, 0.22, 8]} />
        </mesh>
        <mesh position={[0, 0.4, 0.98]} rotation={[0, 0, Math.PI / 2]} material={bikeMats.core}>
          <cylinderGeometry args={[0.19, 0.19, 0.24, 8]} />
        </mesh>
        <mesh ref={wheelRRef} position={[0, 0.4, -0.92]} rotation={[0, 0, Math.PI / 2]} material={bikeMats.trim}>
          <cylinderGeometry args={[0.42, 0.42, 0.28, 8]} />
        </mesh>
        <mesh position={[0, 0.4, -0.92]} rotation={[0, 0, Math.PI / 2]} material={bikeMats.core}>
          <cylinderGeometry args={[0.2, 0.2, 0.3, 8]} />
        </mesh>
      </group>
      <group ref={parkedBikeRef} visible={false}>
        <mesh position={[0, 0.44, 0]} material={bikeMats.hull}><boxGeometry args={[0.48, 0.3, 2.0]} /></mesh>
        <mesh position={[0, 0.56, 0]} material={bikeMats.trim}><boxGeometry args={[0.14, 0.12, 1.9]} /></mesh>
        <mesh position={[0, 0.38, 0.9]} rotation={[0, 0, Math.PI / 2]} material={bikeMats.trim}><cylinderGeometry args={[0.38, 0.38, 0.2, 8]} /></mesh>
        <mesh position={[0, 0.38, -0.85]} rotation={[0, 0, Math.PI / 2]} material={bikeMats.trim}><cylinderGeometry args={[0.4, 0.4, 0.24, 8]} /></mesh>
      </group>
      <Gladiator
        key={`${npc.id}-${npc.civilian ? 'civ' : 'arm'}-${npc.role}`}
        ref={g}
        civilian={npc.civilian}
        sheathed={!armed}
        gear={npc.civilian ? undefined : npc.gear.visuals}
        color={npc.color}
        accent="#e9e6ff"
        scale={npc.civilian ? 0.96 : npc.gear.scale}
      />
      <group ref={labelGroup} visible={labelInfo.visible}>
        {labelInfo.visible && (
          <SpriteText position={[0, 2.55, 0]} fontSize={0.28} color={labelInfo.color} outlineWidth={0.04} outlineColor="#05030a">
            {labelInfo.text}
          </SpriteText>
        )}
      </group>
    </group>
  );
}

class StreetDebrisPool {
  static CAP = 24;
  private items: {
    x: number; y: number; z: number;
    vx: number; vy: number; vz: number;
    rx: number; ry: number; rz: number;
    vrx: number; vry: number;
    sx: number; sy: number; sz: number;
    t: number; life: number;
    color: THREE.Color;
  }[] = [];
  private tmpObj = new THREE.Object3D();

  spawn(x: number, y: number, z: number, color: string, scale: [number, number, number], dx = 0, dz = 0, count = 1) {
    for (let i = 0; i < count; i++) {
      if (this.items.length >= StreetDebrisPool.CAP) this.items.shift();
      const ang = Math.random() * Math.PI * 2;
      const spd = 2.4 + Math.random() * 4.2;
      this.items.push({
        x: x + (Math.random() - 0.5) * 0.25,
        y,
        z: z + (Math.random() - 0.5) * 0.25,
        vx: Math.cos(ang) * spd + dx * 3.8,
        vy: 3.4 + Math.random() * 3.6,
        vz: Math.sin(ang) * spd + dz * 3.8,
        rx: Math.random() * Math.PI,
        ry: Math.random() * Math.PI,
        rz: Math.random() * Math.PI,
        vrx: (Math.random() - 0.5) * 14,
        vry: (Math.random() - 0.5) * 14,
        sx: scale[0],
        sy: scale[1],
        sz: scale[2],
        t: 0,
        life: 3.2,
        color: new THREE.Color(color),
      });
    }
  }

  update(dt: number, mesh: THREE.InstancedMesh | null) {
    if (!mesh) return;
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      it.t += dt;
      if (it.t >= it.life) {
        this.items.splice(i, 1);
        continue;
      }
      it.vy -= 18 * dt;
      it.x += it.vx * dt;
      it.y += it.vy * dt;
      it.z += it.vz * dt;
      if (it.y <= it.sy * 0.5) {
        it.y = it.sy * 0.5;
        if (Math.abs(it.vy) > 1.2) {
          it.vy = -it.vy * 0.42;
          it.vx *= 0.65;
          it.vz *= 0.65;
        } else {
          it.vy = 0;
          it.vx *= 0.85;
          it.vz *= 0.85;
          it.vrx *= 0.85;
          it.vry *= 0.85;
        }
      }
      it.rx += it.vrx * dt;
      it.ry += it.vry * dt;
    }
    mesh.count = this.items.length;
    for (let i = 0; i < this.items.length; i++) {
      const it = this.items[i];
      const fade = it.t > it.life - 0.45 ? Math.max(0, (it.life - it.t) / 0.45) : 1;
      this.tmpObj.position.set(it.x, it.y, it.z);
      this.tmpObj.rotation.set(it.rx, it.ry, it.rz);
      this.tmpObj.scale.set(it.sx * fade, it.sy * fade, it.sz * fade);
      this.tmpObj.updateMatrix();
      mesh.setMatrixAt(i, this.tmpObj.matrix);
      mesh.setColorAt(i, it.color);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }
}

function StreetReticle({ targetRef }: { targetRef: { current: { visible: boolean; x: number; z: number; dazed: boolean } } }) {
  const grp = useRef<THREE.Group>(null!);
  const ringRef = useRef<THREE.Mesh>(null!);
  const ringMat = useMemo(() => makeCurvedBasicMaterial({ color: '#3ff0ff', transparent: true, opacity: 0.92, side: THREE.DoubleSide }), []);

  useFrame((state) => {
    const g = grp.current;
    const t = targetRef.current;
    if (!g) return;
    g.visible = t.visible;
    if (!t.visible) return;
    g.position.set(t.x, 0.06, t.z);
    g.rotation.y = state.clock.elapsedTime * (t.dazed ? 5.2 : 2.2);
    if (t.dazed) {
      const pulse = 0.5 + 0.5 * Math.sin(state.clock.elapsedTime * 14);
      ringMat.color.set(pulse > 0.5 ? '#ff3b5c' : '#ffc95c');
      const sc = 1.05 + pulse * 0.22;
      if (ringRef.current) ringRef.current.scale.set(sc, sc, 1);
    } else {
      ringMat.color.set('#3ff0ff');
      if (ringRef.current) ringRef.current.scale.set(1, 1, 1);
    }
  });

  return (
    <group ref={grp} visible={false}>
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} material={ringMat}>
        <ringGeometry args={[0.74, 0.98, 16]} />
      </mesh>
    </group>
  );
}

function StreetWeaponPropView({ prop }: { prop: ArenaWeaponProp }) {
  const grp = useRef<THREE.Group>(null!);
  const ring = useRef<THREE.Mesh>(null!);
  const mats = useMemo(() => ({
    wood: makePs1Material({ color: '#383254', map: getPs1Texture('wood') }),
    bronze: makePs1Material({ color: '#ffd06b', map: getPs1Texture('bronze'), emissive: '#7a5218', emissiveIntensity: 0.25 }),
    blade: makePs1Material({ color: '#e8fbff', map: getPs1Texture('bronze'), emissive: prop.color, emissiveIntensity: 0.65 }),
    ring: makeCurvedBasicMaterial({ color: '#3ff0ff', transparent: true, opacity: 0.85, side: THREE.DoubleSide }),
  }), [prop.color]);

  useFrame((state) => {
    const g = grp.current;
    if (!g) return;
    g.position.set(prop.x, prop.y, prop.z);
    g.rotation.set(prop.flying ? Math.PI / 2 : 0.18, prop.yaw, prop.flying ? prop.spin : state.clock.elapsedTime * 2.2);
    if (ring.current) {
      ring.current.visible = !prop.flying;
      ring.current.position.set(prop.x, 0.04, prop.z);
      const pulse = 1 + Math.sin(state.clock.elapsedTime * 8) * 0.14;
      ring.current.scale.set(pulse, pulse, 1);
    }
  });

  const fam = prop.gear?.visuals.weapon ?? (
    prop.style === 'executioner' ? 'warhammer'
    : prop.style === 'retiarius' ? 'trident'
    : prop.style === 'hoplomachus' ? 'spear'
    : prop.style === 'dimachaerus' ? 'twinSica'
    : 'gladius'
  );

  return (
    <group>
      <group ref={grp}>
        {fam === 'warhammer' ? (
          <group>
            <mesh material={mats.wood}><cylinderGeometry args={[0.04, 0.04, 1.32, 5]} /></mesh>
            <mesh position={[0, -0.62, 0]} material={mats.bronze}><boxGeometry args={[0.28, 0.24, 0.48]} /></mesh>
          </group>
        ) : fam === 'trident' ? (
          <group>
            <mesh material={mats.wood}><cylinderGeometry args={[0.032, 0.032, 1.5, 5]} /></mesh>
            <mesh position={[0, -0.74, 0]} material={mats.bronze}><boxGeometry args={[0.34, 0.06, 0.06]} /></mesh>
            <mesh position={[0, -0.88, 0]} rotation={[Math.PI, 0, 0]} material={mats.blade}><coneGeometry args={[0.06, 0.3, 4]} /></mesh>
          </group>
        ) : fam === 'spear' ? (
          <group>
            <mesh material={mats.wood}><cylinderGeometry args={[0.032, 0.032, 1.6, 5]} /></mesh>
            <mesh position={[0, -0.85, 0]} rotation={[Math.PI, 0, 0]} material={mats.blade}><coneGeometry args={[0.08, 0.28, 4]} /></mesh>
          </group>
        ) : (
          <group>
            <mesh position={[0, 0.25, 0]} material={mats.bronze}><boxGeometry args={[0.20, 0.045, 0.07]} /></mesh>
            <mesh position={[0, -0.15, 0]} material={mats.blade}><boxGeometry args={[0.06, 0.78, 0.075]} /></mesh>
          </group>
        )}
      </group>
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} material={mats.ring}>
        <ringGeometry args={[0.34, 0.48, 12]} />
      </mesh>
    </group>
  );
}

/** Recruitable Wingman Ally riding a synchronized Light-Cycle beside you and fighting alongside in street/frontier skirmishes. */
function WingmanActor({
  comp,
  playerRef,
  hostilesRef,
  fx,
}: {
  comp: CompanionDef;
  playerRef: React.MutableRefObject<Fighter | null>;
  hostilesRef: React.MutableRefObject<CityNpc[]>;
  fx: { shards: ShardPool; slashes: SlashPool };
}) {
  const g = useRef<GladiatorHandle>(null!);
  const limbPose = useRef<LimbPose>(makeLimbPose());
  const armorPose = useRef<Record<ArmorKey, boolean>>({ helm: true, pauldron: true, shield: true });
  const gear = useMemo(() => gearFromStyle(comp.style), [comp.style]);
  const fighter = useMemo(() => {
    const f = makeFighter(999, 'skirmisher', 2.6, 36, defaultMods(), comp.style, gear);
    f.team = 'p';
    f.hp = 160;
    f.maxHp = 160;
    f.stats = { ...f.stats, name: comp.name, color: comp.color, speed: 12.5 };
    return f;
  }, [comp, gear]);
  const cycleState = useRef<CycleRenderState>({ active: false, x: 2.6, z: 36, yaw: 0, lean: 0, speed: 0, turbo: false });
  const lastTeleportDist = useRef(0);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    const p = playerRef.current;
    const h = g.current;
    if (!p || !h) return;
    const gs = useGame.getState();

    // Snap if player fast-traveled far away
    const distP = Math.hypot(p.x - fighter.x, p.z - fighter.z);
    if (distP > 48 || lastTeleportDist.current > 48) {
      fighter.x = p.x + Math.cos(p.yaw) * 3.0;
      fighter.z = p.z - Math.sin(p.yaw) * 3.0;
      fighter.yaw = p.yaw;
    }
    lastTeleportDist.current = distP;

    const riding = gs.onCycle && !gs.inJail;
    const hostiles = hostilesRef.current.filter((n) => n.mood === 'hostile' && n.fighter.state !== 'dead' && Math.hypot(n.x - p.x, n.z - p.z) < 22);

    if (riding) {
      const formX = p.x + Math.cos(p.yaw) * 3.2 - Math.sin(p.yaw) * 2.2;
      const formZ = p.z - Math.sin(p.yaw) * 3.2 - Math.cos(p.yaw) * 2.2;
      const dx = formX - fighter.x;
      const dz = formZ - fighter.z;
      fighter.x += dx * Math.min(1, dt * 7.5);
      fighter.z += dz * Math.min(1, dt * 7.5);
      fighter.yaw = p.yaw;
      fighter.vx = p.vx;
      fighter.vz = p.vz;
      fighter.state = 'idle';
      fighter.atk = null;
      cycleState.current.active = true;
      cycleState.current.x = fighter.x;
      cycleState.current.z = fighter.z;
      cycleState.current.yaw = fighter.yaw;
      cycleState.current.speed = Math.hypot(p.vx, p.vz);
      cycleState.current.turbo = cycleState.current.speed > 48;
      cycleState.current.lean = THREE.MathUtils.lerp(cycleState.current.lean, 0, dt * 8);
    } else if (hostiles.length > 0 && !gs.inJail) {
      cycleState.current.active = false;
      const foe = hostiles[0];
      const intent = aiIntent(fighter, foe.fighter, dt);
      const strike = stepFighter(fighter, intent, dt, foe.fighter);
      if (strike && fighter.atk) {
        fx.slashes.spawn(fighter.x, fighter.z, fighter.yaw, fighter.atk, comp.color, fighter.style, gear.moves[fighter.atk].motion);
        for (const ev of resolveStrike(fighter, hostiles.map((n) => n.fighter))) {
          fx.shards.burst(ev.x, 1.3, ev.z, 12, 6, comp.color, ev.dx, ev.dz);
          if (ev.type === 'kill') {
            foe.mood = 'dead';
            foe.respawnT = 20;
            foe.collapseT = 1.35;
            gs.awardStreetReward(foe.bountyReward, 16, 8);
          }
        }
      }
    } else {
      cycleState.current.active = false;
      fighter.state = 'idle';
      fighter.atk = null;
      const followX = p.x - Math.cos(p.yaw) * 2.4 - Math.sin(p.yaw) * 2.2;
      const followZ = p.z + Math.sin(p.yaw) * 2.4 - Math.cos(p.yaw) * 2.2;
      const dx = followX - fighter.x;
      const dz = followZ - fighter.z;
      const d = Math.hypot(dx, dz);
      if (d > 0.65) {
        const spd = Math.min(20, d * 5.2);
        fighter.vx = (dx / d) * spd;
        fighter.vz = (dz / d) * spd;
        fighter.x += fighter.vx * dt;
        fighter.z += fighter.vz * dt;
        fighter.yaw = Math.atan2(dx, dz);
        fighter.localVz = Math.min(1, spd / 14);
      } else {
        fighter.vx = 0;
        fighter.vz = 0;
        fighter.localVz = 0;
      }
    }

    h.pose.limbs = limbPose.current;
    h.pose.armor = armorPose.current;
    syncGladiatorView(h, fighter, hostiles.length > 0 ? 1 : riding ? 0.65 : 0, gear.speedMul);
    if (riding) h.group.position.y = 0.42;
  });

  return (
    <group>
      <LightCycle stateRef={cycleState} color={comp.cycleColor} />
      <Gladiator ref={g} sheathed={false} gear={gear.visuals} color={comp.color} accent="#ffc95c" scale={gear.scale} />
      <SpriteText position={[fighter.x, 2.55, fighter.z]} fontSize={0.26} color={comp.color} outlineWidth={0.04} outlineColor="#05030a">
        {`${comp.name} · WINGMAN`}
      </SpriteText>
    </group>
  );
}

/** Interactive Curved R=200 TRON Continent simulation: Player + Light-Cycle + Living Towns + Sky Beacon + Properties. */
function CityWorldSimulation({ playerPos }: { playerPos: PosRef }) {
  const g = useRef<GladiatorHandle>(null!);
  const shardMesh = useRef<THREE.InstancedMesh>(null!);
  const debrisMesh = useRef<THREE.InstancedMesh>(null!);
  const cacheNpcGroup = useRef<THREE.Group>(null!);
  const limbPose = useRef<LimbPose>(makeLimbPose());
  const armorPose = useRef<Record<ArmorKey, boolean>>({ helm: true, pauldron: true, shield: true });
  const reticleTarget = useRef({ visible: false, x: 0, z: 0, dazed: false });

  const camera = useThree((s) => s.camera);
  const look = useGame((s) => s.look);
  const loadout = useGame((s) => s.loadout);
  const stats = useGame((s) => s.stats);
  const dailyBuffs = useGame((s) => s.dailyBuffs);
  const style = useGame((s) => s.style);
  const weaponDrawn = useGame((s) => s.weaponDrawn);
  const inJail = useGame((s) => s.inJail);
  const activeCompanionId = useGame((s) => s.activeCompanionId);
  const activeCompanion = useMemo(() => COMPANIONS.find((c) => c.id === activeCompanionId) ?? null, [activeCompanionId]);
  const playerRef = useRef<Fighter | null>(null);
  const hostilesRef = useRef<CityNpc[]>([]);

  const playerGear = useMemo(() => resolveLoadout(loadout), [loadout]);
  const cacheNpcs = useMemo(() => createCityPopulation(), []);
  const [regionNpcs, setRegionNpcs] = useState<{ settlementId: string | null; x: number; z: number; list: CityNpc[] }>({
    settlementId: null,
    x: 0,
    z: 0,
    list: [],
  });
  const [propVer, setPropVer] = useState(0);
  const regionRef = useRef(regionNpcs);
  regionRef.current = regionNpcs;

  const cycleState = useRef<CycleRenderState>({
    active: false, x: 0, z: 34, yaw: 0, lean: 0, speed: 0, turbo: false,
  });

  const fx = useMemo(() => ({
    shards: new ShardPool(),
    slashes: new SlashPool(),
    ghosts: new GhostPool(),
    debris: new StreetDebrisPool(),
    shardMat: makeCurvedBasicMaterial({ color: '#ffffff' }),
    debrisMat: makeCurvedBasicMaterial({ color: '#ffffff' }),
  }), []);

  const sim = useRef<{
    player: Fighter;
    yaw: number;
    pitch: number;
    cam: THREE.Vector3;
    lookAt: THREE.Vector3;
    dCam: THREE.Vector3;
    dLook: THREE.Vector3;
    buf: { light: number; heavy: number; bash: number; dodge: number; parry: number; jump: number };
    eventTimer: number;
    rentTimer: number;
    discoveryTick: number;
    resistUntil: number;
    wasInJail: boolean;
    wasArrestOpen: boolean;
    vitalsTick: number;
    cycleSpeed: number;
    lastMoveSpeed: number;
    sprintHold: number;
    sprintBlend: number;
    turnRate: number;
    wasInAir: boolean;
    landSquash: number;
    boostT: number;
    driftT: number;
    cycleBoostT: number;
    hitstop: number;
    slowMo: number;
    shake: number;
    fovKick: number;
    lockedId: number | null;
    lastLockName: string | null;
    lastExecReady: boolean;
    lastStance: StanceHeight;
    lastArmed: boolean;
    weaponProps: ArenaWeaponProp[];
    nextPropId: number;
    propVersion: number;
    sideCamDir: THREE.Vector2;
    lastTapA: number;
    lastTapD: number;
    lastRingId: string | null;
    ringCd: number;
    time: number;
  }>(null!);

  if (!sim.current) {
    const start = useGame.getState().lastWorldPos;
    const mods = buildPlayerMods(stats, playerGear, dailyBuffs);
    const p = makeFighter(0, 'player', start.x, start.z, mods, style, playerGear);
    p.stats = { ...p.stats, speed: PLAYER_COMBAT_SPEED, color: lookColor(look) };
    playerPos.current.set(start.x, 0, start.z);
    cycleState.current.x = start.x;
    cycleState.current.z = start.z;
    sim.current = {
      player: p,
      yaw: 0,
      pitch: 0,
      cam: new THREE.Vector3(start.x, EYE_Y + CAMERA_SOCKET_HEIGHT, start.z + CAMERA_SOCKET_DISTANCE),
      lookAt: new THREE.Vector3(start.x, EYE_Y + CAMERA_LOOK_HEIGHT, start.z - CAMERA_LOOK_AHEAD),
      dCam: new THREE.Vector3(),
      dLook: new THREE.Vector3(),
      buf: { light: 0, heavy: 0, bash: 0, dodge: 0, parry: 0, jump: 0 },
      eventTimer: 16,
      rentTimer: 45,
      discoveryTick: 0,
      resistUntil: 0,
      wasInJail: false,
      wasArrestOpen: false,
      vitalsTick: 0,
      cycleSpeed: 0,
      lastMoveSpeed: 0,
      sprintHold: 0,
      sprintBlend: 0,
      turnRate: 0,
      wasInAir: false,
      landSquash: 0,
      boostT: 0,
      driftT: 0,
      cycleBoostT: 0,
      hitstop: 0,
      slowMo: 0,
      shake: 0,
      fovKick: 0,
      lockedId: null,
      lastLockName: null,
      lastExecReady: false,
      lastStance: 'mid',
      lastArmed: true,
      weaponProps: [],
      nextPropId: 500,
      propVersion: 0,
      sideCamDir: new THREE.Vector2(1, 0),
      lastTapA: -9,
      lastTapD: -9,
      lastRingId: null,
      ringCd: 0,
      time: 0,
    };
  }

  // Keep player Fighter stats/gear live-updated whenever player buys/upgrades in Locker/Shops
  useEffect(() => {
    const s = sim.current;
    if (!s) return;
    const prevRatio = s.player.maxHp > 0 ? s.player.hp / s.player.maxHp : 1;
    const mods = buildPlayerMods(stats, playerGear, dailyBuffs);
    const next = makeFighter(0, 'player', s.player.x, s.player.z, mods, style, playerGear);
    next.hp = Math.max(10, Math.round(next.maxHp * prevRatio));
    next.yaw = s.player.yaw;
    next.stats = { ...next.stats, speed: PLAYER_COMBAT_SPEED, color: lookColor(look) };
    s.player = next;
  }, [playerGear, stats, dailyBuffs, look, style]);

  // Reset global horizon curvature & camera FOV when leaving open-world scene
  useEffect(() => {
    setCurvature(CITY_CURVE_RADIUS, playerPos.current.x, playerPos.current.z);
    return () => {
      setCurvature(0, 0, 0);
      if (camera instanceof THREE.PerspectiveCamera && camera.fov !== 66) {
        camera.fov = 66;
        camera.updateProjectionMatrix();
      }
    };
  }, [playerPos, camera]);

  useFrame((_, delta) => {
    const rawDt = Math.min(delta, 0.05);
    const s = sim.current;
    const game = useGame.getState();
    const p = s.player;
    s.time += rawDt;
    if (s.shake > 0) s.shake = Math.max(0, s.shake - rawDt * 2.8);
    if (s.fovKick > 0) s.fovKick = Math.max(0, s.fovKick - rawDt * 18);

    let simDt = rawDt;
    if (s.hitstop > 0) {
      s.hitstop = Math.max(0, s.hitstop - rawDt);
      simDt = 0;
    } else if (s.slowMo > 0) {
      s.slowMo = Math.max(0, s.slowMo - rawDt);
      simDt = rawDt * 0.36;
    }
    const dt = simDt;

    // Handle Fast-Travel / World Teleport
    if (game.pendingTeleport) {
      const tp = game.pendingTeleport;
      p.x = tp.x;
      p.z = tp.z;
      p.vx = 0;
      p.vz = 0;
      p.state = 'idle';
      s.cycleSpeed = 0;
      s.lastMoveSpeed = 0;
      s.lockedId = null;
      const fxDirSnap = -Math.sin(s.yaw);
      const fzDirSnap = -Math.cos(s.yaw);
      s.cam.set(p.x - fxDirSnap * CAMERA_SOCKET_DISTANCE, EYE_Y + CAMERA_SOCKET_HEIGHT, p.z - fzDirSnap * CAMERA_SOCKET_DISTANCE);
      s.lookAt.set(p.x + fxDirSnap * CAMERA_LOOK_AHEAD, EYE_Y + CAMERA_LOOK_HEIGHT, p.z + fzDirSnap * CAMERA_LOOK_AHEAD);
      playerPos.current.set(p.x, 0, p.z);
      setCurvature(CITY_CURVE_RADIUS, p.x, p.z);
      fx.shards.burst(p.x, 1.4, p.z, 24, 9, '#3ff0ff');
      game.clearPendingTeleport();
    }

    // Handle Home Sanctuary Heal
    if (game.pendingHealFull) {
      p.hp = p.maxHp;
      p.stamina = p.maxStamina;
      for (const k of LIMB_KEYS) { p.limbs[k].hp = p.limbs[k].max; p.limbs[k].severed = false; }
      p.armor.helm.hp = p.armor.helm.max; p.armor.helm.broken = p.armor.helm.max <= 0;
      p.armor.pauldron.hp = p.armor.pauldron.max; p.armor.pauldron.broken = p.armor.pauldron.max <= 0;
      p.armor.shield.hp = p.armor.shield.max; p.armor.shield.broken = p.armor.shield.max <= 0;
      fx.shards.burst(p.x, 1.35, p.z, 22, 7.5, '#4dffa0');
      game.consumePendingHeal();
    }

    const activeNpcs = Math.hypot(p.x, p.z) < 185 ? cacheNpcs : regionRef.current.list;
    if (cacheNpcGroup.current) cacheNpcGroup.current.visible = Math.hypot(p.x, p.z) < 185;

    // Handle Quarantine transitions
    if (game.inJail && !s.wasInJail) {
      p.x = JAIL_CELL.x;
      p.z = JAIL_CELL.z;
      p.state = 'idle';
      s.lockedId = null;
      game.setOnCycle(false);
      for (const n of cacheNpcs) if (n.role === 'enforcer') n.mood = 'calm';
    }
    s.wasInJail = game.inJail;

    // Detect Resist Arrest (arrestPrompt dismissed without going to jail and bounty still > 0)
    if (s.wasArrestOpen && !game.arrestPrompt && !game.inJail && game.bounty > 0) {
      s.resistUntil = s.time + 14;
      for (const n of activeNpcs) {
        if (n.role === 'enforcer' && Math.hypot(n.x - p.x, n.z - p.z) < 28) n.mood = 'hostile';
      }
      game.setStreetToast({ speaker: 'SysWatch', text: 'SUSPECT RESISTING DELETION! ENGAGE FORCE!', color: '#ff3b5c' });
    }
    s.wasArrestOpen = Boolean(game.arrestPrompt);

    // Panel / Modal Toggles ([ESC], [C], [M], [V], [X], [B])
    if (pressed('Escape') || (game.activeEchoId && pressed('Enter'))) {
      if (game.activeEchoId) game.closeEchoModal();
      else if (game.activeStoryId) game.openStoryModal(null);
      else if (game.activeSpecialModal && game.activeSpecialModal !== 'restore_choice') game.openSpecialModal(null);
      else if (game.activePropertyId) game.openPropertyPanel(null);
      else if (game.atlasOpen) game.setAtlasOpen(false);
      else if (game.panel) game.openPanel(null);
    }
    if (!game.arrestPrompt && !game.activeEchoId && !game.activeStoryId && !game.activeSpecialModal && pressed('KeyC')) {
      if (game.panel === 'locker') game.openPanel(null);
      else if (!game.panel && !game.atlasOpen && !game.activePropertyId) game.openPanel('locker');
    }
    if (!game.arrestPrompt && !game.activeEchoId && !game.activeStoryId && !game.activeSpecialModal && pressed('KeyM')) {
      if (game.atlasOpen) game.setAtlasOpen(false);
      else if (!game.panel && !game.activePropertyId) game.setAtlasOpen(true);
    }

    const frozen = game.panel !== null || game.arrestPrompt !== null || game.atlasOpen || game.activePropertyId !== null || game.activeEchoId !== null || game.activeStoryId !== null || game.activeSpecialModal !== null;
    if (!frozen && pressed('KeyB')) {
      game.toggleCompanion();
    }
    if (!frozen && pressed('KeyV')) {
      game.toggleCycle();
      const nowCycle = useGame.getState().onCycle;
      sfx.cycle(nowCycle);
      if (nowCycle) {
        s.lockedId = null;
        s.boostT = 0;
      } else {
        s.driftT = 0;
        s.cycleBoostT = 0;
      }
    }
    if (!frozen && pressed('KeyX')) game.toggleWeaponDrawn();

    // Nearest NPC discovery for RDR2 [T] Greet / [G] Antagonize
    let closestNpc: CityNpc | null = null;
    let closestDist = 4.6;
    for (const n of activeNpcs) {
      if (n.mood === 'dead') continue;
      const d = Math.hypot(n.x - p.x, n.z - p.z);
      if (d < closestDist) { closestDist = d; closestNpc = n; }
    }

    const liveHostiles: Fighter[] = [];
    for (const n of activeNpcs) {
      if (n.mood === 'hostile' && n.fighter.state !== 'dead') liveHostiles.push(n.fighter);
    }

    // [Tab] Street Lock-on toggle / cycle among hostiles (or nearest NPC within 16m)
    if (!frozen && !useGame.getState().onCycle && pressed('Tab')) {
      const hostileCandidates = activeNpcs
        .filter((n) => n.mood !== 'dead' && (n.mood === 'hostile' || n.role === 'corrupted') && Math.hypot(n.x - p.x, n.z - p.z) < 18)
        .sort((a, b2) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b2.x - p.x, b2.z - p.z));
      const pool = hostileCandidates.length > 0
        ? hostileCandidates
        : activeNpcs
            .filter((n) => n.mood !== 'dead' && Math.hypot(n.x - p.x, n.z - p.z) < 16)
            .sort((a, b2) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b2.x - p.x, b2.z - p.z));
      if (pool.length === 0) {
        s.lockedId = null;
      } else if (s.lockedId === null) {
        s.lockedId = pool[0].fighter.id;
      } else {
        const idx = pool.findIndex((n) => n.fighter.id === s.lockedId);
        s.lockedId = idx >= 0 && idx < pool.length - 1 ? pool[idx + 1].fighter.id : null;
      }
    }

    let lockedNpc: CityNpc | null = s.lockedId !== null && !useGame.getState().onCycle
      ? activeNpcs.find((n) => n.fighter.id === s.lockedId && n.mood !== 'dead' && Math.hypot(n.x - p.x, n.z - p.z) < 22) ?? null
      : null;
    if (!lockedNpc) s.lockedId = null;

    const curGamePre = useGame.getState();
    const duelNpc: CityNpc | null = curGamePre.weaponDrawn && !curGamePre.onCycle
      ? lockedNpc ?? activeNpcs
          .filter((n) => n.mood === 'hostile' && n.fighter.state !== 'dead' && Math.hypot(n.x - p.x, n.z - p.z) < 14)
          .sort((a, b2) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b2.x - p.x, b2.z - p.z))[0] ?? null
      : null;
    const execReady = curGamePre.weaponDrawn && !curGamePre.onCycle && liveHostiles.some((h) => canExecuteTarget(h) && Math.hypot(h.x - p.x, h.z - p.z) < 3.6);

    const triggerHitFeedback = (ev: HitEvent, victimColor: string, isPlayerVictim: boolean, hitNpc?: CityNpc) => {
      const yfx = 1.32 + (isPlayerVictim ? p.airY : hitNpc?.fighter.airY ?? 0);
      const color = ev.type === 'parry' ? '#ffc95c' : ev.type === 'guardBreak' ? '#ff9f43' : ev.riposte ? '#ffc95c' : victimColor;
      fx.shards.burst(ev.x, yfx, ev.z, ev.type === 'kill' || ev.decap ? 30 : ev.type === 'parry' ? 22 : 12, ev.type === 'kill' ? 10 : 6.2, color, ev.dx, ev.dz);
      if (ev.weaponDropped) {
        const dropId = ev.type === 'parry' ? ev.attacker : ev.victim;
        const dropFighter = dropId === p.id ? p : activeNpcs.find((n) => n.fighter.id === dropId)?.fighter;
        if (dropFighter) {
          s.weaponProps.push(spawnDroppedWeapon(dropFighter, ev.dx, ev.dz, ++s.nextPropId));
          s.propVersion++;
        }
      }
      if (ev.type === 'parry') {
        sfx.parry();
        s.hitstop = Math.max(s.hitstop, 0.08);
        s.slowMo = Math.max(s.slowMo, 0.24);
        s.shake = Math.max(s.shake, 0.42);
        s.fovKick = Math.max(s.fovKick, 4.5);
        game.triggerStreetCallout(
          ev.weaponDropped ? 'BEAT DISARM!' : ev.thrownHit ? 'THROW DEFLECTED!' : isPlayerVictim ? 'PARRIED!' : 'PARRY! RIPOSTE!',
          ev.weaponDropped ? '#ff4fd8' : '#ffc95c',
        );
        return;
      }
      if (ev.type === 'guardBreak') {
        sfx.guardBreak();
        s.hitstop = Math.max(s.hitstop, 0.07);
        s.shake = Math.max(s.shake, 0.45);
        s.fovKick = Math.max(s.fovKick, 4.0);
        game.triggerStreetCallout(ev.diveKick ? 'DIVE CRUSH!' : 'GUARD CRUSHED!', '#ff9f43');
      } else if (ev.type === 'block') {
        sfx.block();
        s.hitstop = Math.max(s.hitstop, 0.03);
        s.shake = Math.max(s.shake, 0.14);
      } else if (ev.severed || ev.decap) {
        sfx.sever();
        s.hitstop = Math.max(s.hitstop, 0.085);
        s.slowMo = Math.max(s.slowMo, 0.22);
        s.shake = Math.max(s.shake, 0.52);
        s.fovKick = Math.max(s.fovKick, 5.2);
        game.triggerStreetCallout(ev.decap ? 'DECAPITATED!' : `${ev.severed?.toUpperCase()} SEVERED!`, '#ff4f6d');
      } else {
        sfx.hit(ev.heavy, Boolean(ev.riposte));
        s.hitstop = Math.max(s.hitstop, ev.riposte || ev.launched ? 0.085 : ev.heavy ? 0.055 : 0.035);
        s.shake = Math.max(s.shake, ev.riposte ? 0.5 : ev.heavy ? 0.34 : 0.18);
        if (ev.riposte || ev.heavy || ev.launched) s.fovKick = Math.max(s.fovKick, ev.riposte ? 5.0 : 3.2);
        if (ev.launched) {
          s.slowMo = Math.max(s.slowMo, 0.2);
          game.triggerStreetCallout('LAUNCHED!', '#3ff0ff');
        } else if (ev.juggled) {
          game.triggerStreetCallout(`AIR JUGGLE ×${hitNpc?.fighter.juggleCount ?? 1}!`, '#ffc95c');
        } else if (ev.diveKick) {
          game.triggerStreetCallout(ev.weaponDropped ? 'DIVE-KICK DISARM!' : 'FLYING DIVE KICK!', '#3ff0ff');
        } else if (ev.thrownHit) {
          game.triggerStreetCallout('IMPALED!', '#ff3b5c');
        } else if (ev.riposte) {
          game.triggerStreetCallout('RIPOSTE CRIT!', '#ffc95c');
        }
      }
      if (ev.armorBroken) {
        fx.debris.spawn(ev.x, 1.5, ev.z, ev.armorBroken === 'helm' ? '#ffc95c' : victimColor, [0.22, 0.22, 0.22], ev.dx, ev.dz, 2);
        if (!ev.riposte) game.triggerStreetCallout(`${ev.armorBroken.toUpperCase()} SHATTERED!`, '#ffc95c');
      }
      if (ev.severed || ev.decap) {
        fx.debris.spawn(ev.x, 1.45, ev.z, victimColor, [0.2, 0.34, 0.2], ev.dx, ev.dz, ev.decap ? 2 : 1);
      }
      if (ev.type === 'kill' && hitNpc) {
        fx.debris.spawn(hitNpc.x, 1.4, hitNpc.z, hitNpc.color, [0.22, 0.3, 0.2], ev.dx, ev.dz, 3);
        hitNpc.mood = 'dead';
        hitNpc.respawnT = 20;
        hitNpc.collapseT = 1.35;
        hitNpc.collapseDx = ev.dx;
        hitNpc.collapseDz = ev.dz;
        const unlawful = hitNpc.role === 'citizen' || hitNpc.role === 'enforcer';
        game.awardStreetReward(hitNpc.bountyReward, hitNpc.role === 'corrupted' ? 30 : 18, unlawful ? 0 : 12);
        if (unlawful) {
          game.addBounty(hitNpc.role === 'enforcer' ? 50 : 30);
          game.setStreetToast({ speaker: 'SYSWATCH ALERT', text: `Process ${hitNpc.filename} de-rezzed! Bounty raised!`, color: '#ff3b5c' });
        } else {
          game.setStreetToast({ speaker: 'DE-REZ', text: `${hitNpc.filename} wiped! +${hitNpc.bountyReward} Cycles`, color: '#4dffa0' });
        }
      }
    };

    // [E] Execution Finisher against Dazed enemy
    if (!frozen && !curGamePre.onCycle && curGamePre.weaponDrawn && execReady && pressed('KeyE')) {
      const execEv = tryExecute(p, liveHostiles);
      if (execEv) {
        sfx.execute();
        s.hitstop = 0.11;
        s.slowMo = 0.28;
        s.shake = 0.65;
        s.fovKick = 6.5;
        const hitNpc = activeNpcs.find((n) => n.fighter.id === execEv.victim);
        if (hitNpc) {
          fx.shards.burst(hitNpc.x, 1.45, hitNpc.z, 34, 10.5, '#ffc95c', execEv.dx, execEv.dz);
          fx.debris.spawn(hitNpc.x, 1.75, hitNpc.z, hitNpc.color, [0.24, 0.24, 0.24], execEv.dx, execEv.dz, 2);
          hitNpc.mood = 'dead';
          hitNpc.respawnT = 20;
          hitNpc.collapseT = 1.35;
          hitNpc.collapseDx = execEv.dx;
          hitNpc.collapseDz = execEv.dz;
          const unlawful = hitNpc.role === 'citizen' || hitNpc.role === 'enforcer';
          game.awardStreetReward(hitNpc.bountyReward + 15, hitNpc.role === 'corrupted' ? 40 : 25, unlawful ? 0 : 16);
          if (unlawful) game.addBounty(hitNpc.role === 'enforcer' ? 50 : 30);
        }
        game.triggerStreetCallout('EXECUTED! +22% HP', '#ffc95c');
      }
    }

    // Mouse look + 2.5D Side-Duel tracking (with stationary 3D lane rotation) / Q-E orbit / R tilt
    const showcaseOpen = curGamePre.panel === 'locker' || curGamePre.panel === 'smith' || curGamePre.panel === 'armorer';
    const ml = consumeMouseLook();
    let pivotLocalVx = 0;
    const rawSideInput = !frozen ? ((keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0)) : 0;
    if (!frozen && !showcaseOpen) {
      if (duelNpc) {
        if (rawSideInput === 0 && p.state === 'idle') {
          const upK = keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0;
          const dnK = keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0;
          const laneRotate = THREE.MathUtils.clamp((upK - dnK) + (keys.has('KeyQ') ? 1 : 0) - (keys.has('KeyE') ? 1 : 0) - ml.dx * 0.08, -1.6, 1.6);
          if (Math.abs(laneRotate) > 0.01) {
            const relX = p.x - duelNpc.x;
            const relZ = p.z - duelNpc.z;
            const dOpp = Math.hypot(relX, relZ);
            if (dOpp > 0.4) {
              const ang = laneRotate * 1.55 * rawDt;
              const c = Math.cos(ang), sn = Math.sin(ang);
              const cand = { x: duelNpc.x + relX * c - relZ * sn, z: duelNpc.z + relX * sn + relZ * c };
              resolveCircles(cand, PLAYER_R, collidersNear(cand.x, cand.z));
              p.x = cand.x;
              p.z = cand.z;
              pivotLocalVx = THREE.MathUtils.clamp(laneRotate * 0.7, -1, 1);
            }
          }
        }
        const dxD = duelNpc.x - p.x, dzD = duelNpc.z - p.z;
        const dD = Math.hypot(dxD, dzD) || 1;
        const n1x = -dzD / dD, n1z = dxD / dD;
        const dot = n1x * s.sideCamDir.x + n1z * s.sideCamDir.y;
        const gx = dot >= 0 ? n1x : -n1x;
        const gz = dot >= 0 ? n1z : -n1z;
        s.sideCamDir.x += (gx - s.sideCamDir.x) * (1 - Math.exp(-8 * rawDt));
        s.sideCamDir.y += (gz - s.sideCamDir.y) * (1 - Math.exp(-8 * rawDt));
        s.sideCamDir.normalize();
      } else {
        s.yaw -= ml.dx * 0.0055;
        s.pitch = THREE.MathUtils.clamp(s.pitch - ml.dy * 0.0042, -0.75, 1.15);
      }
    }
    if (!duelNpc && lockedNpc && curGamePre.weaponDrawn && !curGamePre.onCycle && !showcaseOpen) {
      const desiredCamYaw = Math.atan2(-(lockedNpc.x - p.x), -(lockedNpc.z - p.z));
      const yawErr = Math.atan2(Math.sin(desiredCamYaw - s.yaw), Math.cos(desiredCamYaw - s.yaw));
      s.yaw += yawErr * (1 - Math.exp(-7 * rawDt));
    }

    let orbit = 0;
    if (!duelNpc && keys.has('KeyQ')) orbit += 1;
    if (!duelNpc && keys.has('KeyE') && !lockedNpc && !execReady) orbit -= 1;
    if (orbit) s.yaw += orbit * KB_YAW_SENS * rawDt * 60;
    let tilt = 0;
    if (!duelNpc && keys.has('KeyR')) tilt += 1;
    if (tilt) s.pitch = Math.max(-0.75, Math.min(1.15, s.pitch + tilt * KB_YAW_SENS * rawDt * 60));

    const fxDir = -Math.sin(s.yaw), fzDir = -Math.cos(s.yaw);
    const rxDir = Math.cos(s.yaw), rzDir = -Math.sin(s.yaw);

    // Input direction (2.5D Tekken x Nidhogg lane when duelNpc active, else standard 3D)
    const upHeld = keys.has('KeyW') || keys.has('ArrowUp');
    const downHeld = keys.has('KeyS') || keys.has('ArrowDown');
    const stance: StanceHeight = curGamePre.weaponDrawn && !curGamePre.onCycle
      ? (upHeld && !downHeld ? 'high' : downHeld && !upHeld ? 'low' : 'mid')
      : 'mid';

    let fwd = 0, side = 0;
    if (!frozen) {
      if (upHeld) fwd += 1;
      if (downHeld) fwd -= 1;
      if (keys.has('KeyD') || keys.has('ArrowRight')) side += 1;
      if (keys.has('KeyA') || keys.has('ArrowLeft')) side -= 1;
    }
    const moveLen = duelNpc ? Math.abs(side) : Math.hypot(fwd, side);
    const screenRightX = s.sideCamDir.y, screenRightZ = -s.sideCamDir.x;
    const fwdCamX = -s.sideCamDir.x, fwdCamZ = -s.sideCamDir.y;
    const moveX = duelNpc
      ? screenRightX * side
      : (moveLen > 0 ? (fxDir * fwd + rxDir * side) / moveLen : 0);
    const moveZ = duelNpc
      ? screenRightZ * side
      : (moveLen > 0 ? (fzDir * fwd + rzDir * side) / moveLen : 0);

    // Proximity interactables check (needed before Space jump/interact arbitration)
    const isNearCache = Math.hypot(p.x, p.z) < 185;
    const nearEchoHit = curGamePre.inJail ? null : nearestMemoryEcho(p.x, p.z, curGamePre.claimedEchoes, 4.5);
    const nearStoryHit = curGamePre.inJail ? null : nearestStoryStage(p.x, p.z, curGamePre.storyProgress, 5.2);
    const nearSpecial: 'v01' | 'restore_spire' | null = curGamePre.inJail
      ? null
      : Math.hypot(p.x - 1480, p.z + 920) < 5.2
        ? 'v01'
        : Math.hypot(p.x - 0, p.z + 1405) < 5.4
          ? 'restore_spire'
          : null;
    const nearColGate = curGamePre.inJail ? null : nearestWorldColosseumGate(p.x, p.z);
    const nearProp = curGamePre.inJail ? null : nearestPropertyDeed(p.x, p.z);
    const nearCacheStation = !curGamePre.inJail && isNearCache ? nearestStation(p.x, p.z) : null;
    const nearCapTerm = !curGamePre.inJail && !isNearCache ? nearestSettlementTerminal(p.x, p.z) : null;
    const hasInteractPrompt = Boolean(nearEchoHit || nearStoryHit || nearSpecial || nearColGate || nearProp || nearCacheStation || nearCapTerm);

    // Handle Pending Story Duel Challenger
    if (curGamePre.pendingStoryDuel && activeNpcs.length > 0) {
      const sd = curGamePre.pendingStoryDuel;
      const host = activeNpcs.find((n) => n.mood !== 'dead' && n.role !== 'enforcer') ?? activeNpcs[0];
      host.filename = sd.name;
      host.style = sd.style;
      host.color = sd.color;
      host.gear = gearFromStyle(sd.style);
      host.mood = 'hostile';
      host.civilian = false;
      host.onVehicle = false;
      host.bountyReward = sd.rewardCycles;
      host.x = p.x + Math.sin(p.yaw) * 4.5;
      host.z = p.z + Math.cos(p.yaw) * 4.5;
      host.fighter.hp = 125;
      host.fighter.maxHp = 125;
      host.fighter.x = host.x;
      host.fighter.z = host.z;
      host.fighter.stats = { ...host.fighter.stats, name: sd.name, color: sd.color };
      host.bark = `${sd.name} challenges you!`;
      host.barkT = 5.0;
      game.setWeaponDrawn(true);
      game.clearPendingStoryDuel();
    }

    // Input buffering + Flying Dismount Cleave + Weapon Throw / Pickup + Jump / Sidestep
    const b = s.buf;
    if (!frozen && !curGamePre.inJail) {
      const atkLight = pressed('KeyJ') || (pressed('Mouse0') && !showcaseOpen);
      const atkHeavy = pressed('KeyK') || (pressed('Mouse2') && !showcaseOpen);

      if (curGamePre.onCycle && (atkLight || atkHeavy)) {
        // Flying Dismount Cleave straight out of the Light-Cycle saddle!
        game.setOnCycle(false);
        game.setWeaponDrawn(true);
        sfx.cycle(false);
        s.driftT = 0;
        s.cycleBoostT = 0;
        s.cycleSpeed = 0;
        p.stamina = Math.max(p.stamina, 32);
        p.state = 'idle';
        p.atk = null;
        startAttack(p, 'heavy');
        p.kx += Math.sin(p.yaw) * 20;
        p.kz += Math.cos(p.yaw) * 20;
        sfx.swing(true);
        fx.ghosts.spawn(p.x, p.z, p.yaw, '#3ff0ff', -Math.sin(p.yaw) * 0.45, -Math.cos(p.yaw) * 0.45);
        game.triggerStreetCallout('FLYING DISMOUNT CLEAVE!', '#3ff0ff');
      } else if (atkLight || atkHeavy) {
        if (!curGamePre.weaponDrawn) {
          game.setWeaponDrawn(true);
          if ((keys.has('ShiftLeft') || keys.has('ShiftRight')) && moveLen > 0) {
            p.kx += Math.sin(p.yaw) * 14;
            p.kz += Math.cos(p.yaw) * 14;
            sfx.dodge();
          }
        }
        if (atkLight) b.light = 0.2;
        if (atkHeavy) b.heavy = 0.2;
      }

      if (useGame.getState().weaponDrawn && !useGame.getState().onCycle) {
        if (pressed('KeyF')) {
          if (!p.weaponDisarmed) {
            const thrown = throwFighterWeapon(p, ++s.nextPropId);
            if (thrown) {
              s.weaponProps.push(thrown);
              s.propVersion++;
              sfx.swing(true);
              game.triggerStreetCallout('WEAPON HURLED!', '#ffc95c');
            }
          } else {
            const picked = tryPickupWeapon(p, s.weaponProps, 2.6);
            if (picked) {
              s.propVersion++;
              sfx.parry();
              game.triggerStreetCallout('WEAPON RECLAIMED!', '#3ff0ff');
            } else {
              b.bash = 0.2;
            }
          }
        }
        if (duelNpc) {
          if (pressed('KeyA') || pressed('ArrowLeft')) {
            if (s.time - s.lastTapA < 0.24) b.dodge = 0.16;
            s.lastTapA = s.time;
          }
          if (pressed('KeyD') || pressed('ArrowRight')) {
            if (s.time - s.lastTapD < 0.24) b.dodge = 0.16;
            s.lastTapD = s.time;
          }
          const shiftHeld = keys.has('ShiftLeft') || keys.has('ShiftRight');
          if (shiftHeld && (pressed('KeyW') || pressed('ArrowUp') || pressed('KeyS') || pressed('ArrowDown'))) {
            b.dodge = 0.16;
          }
          if (pressed('Space')) {
            if (upHeld || downHeld) b.dodge = 0.16;
            else b.jump = 0.16;
          }
        } else if (pressed('Space')) {
          b.dodge = 0.16;
        }
      }

      if (useGame.getState().weaponDrawn && (pressed('ShiftLeft') || pressed('ShiftRight') || pressed('KeyL'))) b.parry = 0.16;
      if (pressed('KeyH') && game.flasks > 0 && drinkFlask(p)) {
        game.consumeFlaskInBout();
        fx.shards.burst(p.x, 1.35, p.z, 22, 7.5, '#4dffa0');
        game.setStreetToast({ speaker: 'RESTORE', text: 'Integrity Flask patched +45% HP.', color: '#4dffa0' });
      }
    }

    // Nearest NPC discovery for RDR2 [T] Greet / [G] Antagonize
    if (!frozen && !useGame.getState().onCycle && closestNpc) {
      if (pressed('KeyT')) {
        const out = greetNpc(closestNpc, game.fame);
        closestNpc.bark = out.bark;
        closestNpc.barkT = 5.5;
        game.setStreetToast({ speaker: closestNpc.filename, text: out.bark, color: out.turnHostile ? '#ff4f6d' : closestNpc.color });
        if (out.cyclesDelta > 0 || out.xpDelta > 0 || out.signalDelta > 0) {
          game.awardStreetReward(out.cyclesDelta, out.xpDelta, out.signalDelta);
        }
        if (out.healPct > 0) p.hp = Math.min(p.maxHp, p.hp + p.maxHp * out.healPct);
      } else if (pressed('KeyG')) {
        const out = antagonizeNpc(closestNpc, useGame.getState().weaponDrawn);
        closestNpc.bark = out.bark;
        closestNpc.barkT = 5.5;
        game.setStreetToast({
          speaker: closestNpc.filename,
          text: out.bark,
          color: out.turnHostile ? '#ff4f6d' : '#ffc95c',
        });
        if (out.cyclesDelta > 0) game.awardStreetReward(out.cyclesDelta, 8, 0);
        if (out.addBounty > 0) game.addBounty(out.addBounty);
      }
    }

    const curGame = useGame.getState();
    const turbo = curGame.onCycle && !frozen && (keys.has('ShiftLeft') || keys.has('ShiftRight'));
    const holdingDrift = curGame.onCycle && !frozen && keys.has('Space');

    if (curGame.onCycle && !frozen && !curGame.inJail) {
      // High-speed carving Hard-Light Cycle + [Space] Power-Drift & Drift-Boost
      p.state = 'idle';
      p.atk = null;
      p.blocking = false;
      s.lastMoveSpeed = 0;
      if (s.cycleBoostT > 0) s.cycleBoostT = Math.max(0, s.cycleBoostT - dt);
      const boostActive = s.cycleBoostT > 0;
      const targetSpd = moveLen > 0
        ? (boostActive ? CYCLE_BOOST_SPEED : turbo ? CYCLE_TURBO_SPEED : holdingDrift ? CYCLE_SPEED * 0.88 : CYCLE_SPEED)
        : (boostActive ? CYCLE_BOOST_SPEED * 0.72 : 0);
      s.cycleSpeed = THREE.MathUtils.lerp(s.cycleSpeed, targetSpd, 1 - Math.exp(-(boostActive ? 14 : 7.5) * dt));

      let leanTarget = 0;
      if (moveLen > 0) {
        const targetYaw = Math.atan2(moveX, moveZ);
        const turnDelta = Math.atan2(Math.sin(targetYaw - p.yaw), Math.cos(targetYaw - p.yaw));
        const maxTurn = (holdingDrift ? 7.6 : 4.6) * dt;
        p.yaw += THREE.MathUtils.clamp(turnDelta, -maxTurn, maxTurn);
        const maxLean = holdingDrift ? 0.54 : 0.38;
        leanTarget = THREE.MathUtils.clamp(-turnDelta * (holdingDrift ? 0.85 : 0.55), -maxLean, maxLean);
        if (holdingDrift && s.cycleSpeed > 16) {
          s.driftT += dt;
          if (Math.random() < 0.5) {
            fx.shards.burst(p.x - Math.sin(p.yaw) * 1.1, 0.24, p.z - Math.cos(p.yaw) * 1.1, 2, 4.4, s.driftT >= 0.24 ? '#ffc95c' : '#3ff0ff', -Math.sin(p.yaw), -Math.cos(p.yaw));
          }
        }
      }
      if (!holdingDrift && s.driftT > 0) {
        if (s.driftT >= 0.24) {
          s.cycleBoostT = 0.65;
          s.cycleSpeed = CYCLE_BOOST_SPEED;
          s.fovKick = 5.5;
          sfx.boost();
          fx.shards.burst(p.x - Math.sin(p.yaw) * 1.2, 0.36, p.z - Math.cos(p.yaw) * 1.2, 16, 8, '#3ff0ff', -Math.sin(p.yaw), -Math.cos(p.yaw));
          game.triggerStreetCallout('DRIFT BOOST!', '#3ff0ff');
        }
        s.driftT = 0;
      }

      const dirX = Math.sin(p.yaw);
      const dirZ = Math.cos(p.yaw);
      p.vx = dirX * s.cycleSpeed;
      p.vz = dirZ * s.cycleSpeed;
      p.x += p.vx * dt;
      p.z += p.vz * dt;
      p.stamina = Math.min(p.maxStamina, p.stamina + 30 * dt);
      p.hp = Math.min(p.maxHp, p.hp + 3.0 * dt);
      p.localVz = 0;
      p.localVx = 0;
      cycleState.current.lean = THREE.MathUtils.lerp(cycleState.current.lean, leanTarget, 1 - Math.exp(-12 * rawDt));
    } else if (curGame.weaponDrawn && !frozen) {
      s.cycleSpeed = 0;
      s.lastMoveSpeed = 0;
      const holdingShift = keys.has('ShiftLeft') || keys.has('ShiftRight');
      const threatWindupNear = liveHostiles.some((h) => h.state === 'windup' && Math.hypot(h.x - p.x, h.z - p.z) < 4);
      if (holdingShift && moveLen > 0.2 && !threatWindupNear && !duelNpc) s.sprintHold += dt;
      else s.sprintHold = 0;
      const combatSprinting = s.sprintHold >= 0.22 && p.state === 'idle' && b.parry <= 0;
      p.stats = {
        ...p.stats,
        speed: combatSprinting ? PLAYER_COMBAT_SPEED * 1.55 : PLAYER_COMBAT_SPEED,
        color: lookColor(look),
      };

      const depthInput = stance === 'high' ? 1 : stance === 'low' ? -1 : 0;
      let combatMoveX = moveX;
      let combatMoveZ = moveZ;
      if (duelNpc && b.dodge > 0 && depthInput !== 0 && side === 0) {
        combatMoveX = fwdCamX * depthInput;
        combatMoveZ = fwdCamZ * depthInput;
      }

      const intent: Intent = {
        moveX: combatMoveX, moveZ: combatMoveZ,
        light: b.light > 0,
        heavy: b.heavy > 0,
        bash: b.bash > 0,
        block: !combatSprinting && (holdingShift || keys.has('KeyL')),
        parry: b.parry > 0,
        dodge: b.dodge > 0,
        jump: b.jump > 0,
        stance,
      };
      const prev = p.state;
      const prevQ = p.queuedAtk;
      const aimTarget = duelNpc && duelNpc.fighter.state !== 'dead'
        ? duelNpc.fighter
        : liveHostiles.length > 0
          ? liveHostiles.sort((a, b2) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b2.x - p.x, b2.z - p.z))[0]
          : null;
      const strike = stepFighter(p, intent, dt, aimTarget && Math.hypot(aimTarget.x - p.x, aimTarget.z - p.z) < 12 ? aimTarget : null);
      if (pivotLocalVx !== 0) p.localVx = pivotLocalVx;
      if (p.state !== 'idle' && prev === 'idle') { b.light = 0; b.heavy = 0; b.bash = 0; b.dodge = 0; b.jump = 0; }
      if (p.airY > 0) b.jump = 0;
      if (p.parryHold > 0 || p.blocking) b.parry = 0;
      if (p.queuedAtk && p.queuedAtk !== prevQ) { b.light = 0; b.heavy = 0; b.bash = 0; }
      if (p.weaponDisarmed && p.state === 'idle' && p.airY === 0 && tryPickupWeapon(p, s.weaponProps, 1.35)) {
        s.propVersion++;
        sfx.parry();
        game.triggerStreetCallout('WEAPON RECLAIMED!', '#3ff0ff');
      }
      if (p.state === 'dodge') {
        const startG = prev !== 'dodge';
        if (startG) sfx.dodge();
        const stepG = Math.floor(p.t / 0.09) > Math.floor(Math.max(0, p.t - dt) / 0.09);
        if (startG || stepG) fx.ghosts.spawn(p.x, p.z, p.yaw, p.stats.color, p.dodgeLocalZ * 0.45, -p.dodgeLocalX * 0.45);
      }
      if (strike && p.atk) {
        sfx.swing(p.atk === 'heavy' || p.atk === 'light3');
        const fg = gearOf(p);
        const motion = fg.moves[p.atk].motion;
        const slashColor = p.atk === 'light3' || p.riposteActive ? '#ffc95c' : motion === 'netThrow' ? '#3ff0ff' : p.stats.color;
        fx.slashes.spawn(p.x, p.z, p.yaw, p.atk, slashColor, p.style, motion);
        const allCombatants = [p, ...activeNpcs.filter((n) => n.mood !== 'dead').map((n) => n.fighter)];
        for (const ev of resolveStrike(p, allCombatants) as HitEvent[]) {
          const hitNpc = activeNpcs.find((n) => n.fighter.id === ev.victim);
          if (!hitNpc) continue;
          if (ev.type !== 'kill' && hitNpc.mood !== 'hostile') {
            if (hitNpc.role === 'citizen' && hitNpc.temperament === 'timid') {
              hitNpc.mood = 'fleeing';
              hitNpc.civilian = true;
              game.addBounty(20);
              game.setStreetToast({ speaker: hitNpc.filename, text: 'SysWatch! Help! Rogue blade in the plaza!', color: '#ffc95c' });
            } else {
              hitNpc.mood = 'hostile';
              hitNpc.civilian = false;
              if (hitNpc.role !== 'corrupted') game.addBounty(15);
            }
          }
          triggerHitFeedback(ev, hitNpc.color, false, hitNpc);
        }
      }
    } else {
      // Grounded Knee/Ankle Unarmed Locomotion + Smooth Sprint + Athletic Jump
      s.cycleSpeed = 0;
      p.state = 'idle';
      p.atk = null;
      p.blocking = false;
      p.stats = { ...p.stats, speed: PLAYER_COMBAT_SPEED, color: lookColor(look) };
      s.landSquash = Math.max(0, s.landSquash - dt * 5.4);
      s.boostT = Math.max(0, s.boostT - dt);

      if (!frozen && !curGame.inJail && pressed('Space') && !hasInteractPrompt && p.airY <= 0.01) {
        p.airVy = 8.2;
        p.airY = 0.04;
        sfx.dodge();
      }

      if (p.airY > 0 || p.airVy !== 0) {
        p.airVy -= 21 * dt;
        p.airY += p.airVy * dt;
        if (p.airY <= 0) {
          p.airY = 0;
          p.airVy = 0;
          if (s.wasInAir) {
            s.landSquash = 1.0;
            fx.shards.burst(p.x, 0.12, p.z, 6, 3.2, lookColor(look));
          }
        }
      }
      s.wasInAir = p.airY > 0.04;

      const sprintingUnarmed = !frozen && (keys.has('ShiftLeft') || keys.has('ShiftRight')) && moveLen > 0;
      s.sprintBlend = THREE.MathUtils.lerp(s.sprintBlend, sprintingUnarmed ? 1 : 0, 1 - Math.exp(-9 * dt));
      const baseTarget = !frozen && moveLen > 0 ? THREE.MathUtils.lerp(UNARMED_JOG_SPEED, UNARMED_SPRINT_SPEED, s.sprintBlend) : 0;
      const targetSpd = s.boostT > 0 ? Math.max(baseTarget, 28) : baseTarget;
      const accel = moveLen > 0 ? 12 : 16;
      s.lastMoveSpeed = THREE.MathUtils.lerp(s.lastMoveSpeed, targetSpd, 1 - Math.exp(-accel * dt));
      p.vx = moveX * s.lastMoveSpeed;
      p.vz = moveZ * s.lastMoveSpeed;
      p.localVz = Math.min(1, s.lastMoveSpeed / UNARMED_JOG_SPEED);
      if (sprintingUnarmed && p.airY === 0 && Math.random() < 0.22) {
        fx.shards.burst(p.x, 0.14, p.z, 1, 2.4, lookColor(look), -moveX, -moveZ);
      }

      p.x += (p.vx + p.kx) * dt;
      p.z += (p.vz + p.kz) * dt;
      p.kx *= Math.exp(-10 * dt);
      p.kz *= Math.exp(-10 * dt);
      p.stamina = Math.min(p.maxStamina, p.stamina + 30 * dt);
      p.hp = Math.min(p.maxHp, p.hp + 2.5 * dt);
      const sp = Math.hypot(p.vx, p.vz);
      const targetYaw = showcaseOpen
        ? Math.atan2(-fxDir, -fzDir) + 0.32
        : sp > 0.4 ? Math.atan2(p.vx, p.vz) : Math.atan2(fxDir, fzDir);
      const d = Math.atan2(Math.sin(targetYaw - p.yaw), Math.cos(targetYaw - p.yaw));
      const yawStep = d * (1 - Math.exp(-15 * rawDt));
      p.yaw += yawStep;
      const rawTurn = rawDt > 0 ? THREE.MathUtils.clamp((yawStep / rawDt) / 7.5, -1.2, 1.2) : 0;
      s.turnRate = THREE.MathUtils.lerp(s.turnRate, rawTurn, 1 - Math.exp(-14 * rawDt));
      p.localVx = 0;
    }

    // Enforce world bounds (-2000..2000) & dynamic nearby colliders
    const nearbySolids = collidersNear(p.x, p.z);
    const posTmp = { x: p.x, z: p.z };
    resolveCircles(posTmp, PLAYER_R, nearbySolids);
    clampBounds(posTmp, PLAYER_R, WORLD_BOUNDS);
    if (curGame.inJail) {
      posTmp.x = THREE.MathUtils.clamp(posTmp.x, JAIL_CELL.x - 2.3, JAIL_CELL.x + 2.3);
      posTmp.z = THREE.MathUtils.clamp(posTmp.z, JAIL_CELL.z - 2.3, JAIL_CELL.z + 2.3);
    }
    p.x = posTmp.x;
    p.z = posTmp.z;

    // Wilderness Overclock Boost-Archways
    if (s.ringCd > 0) s.ringCd = Math.max(0, s.ringCd - rawDt);
    else s.lastRingId = null;
    if (!curGame.inJail) {
      for (const rg of boostRingsNear(p.x, p.z, 24)) {
        if (Math.hypot(p.x - rg.x, p.z - rg.z) < 2.8 && s.lastRingId !== rg.id) {
          s.lastRingId = rg.id;
          s.ringCd = 1.6;
          p.stamina = p.maxStamina;
          if (curGame.onCycle) {
            s.cycleBoostT = 1.8;
            s.cycleSpeed = CYCLE_BOOST_SPEED;
          } else {
            s.boostT = 0.85;
            s.lastMoveSpeed = 28;
            p.kx += Math.sin(p.yaw) * 14;
            p.kz += Math.cos(p.yaw) * 14;
          }
          s.fovKick = 6.0;
          sfx.boost();
          fx.shards.burst(rg.x, 2.2, rg.z, 24, 9.5, rg.color);
          game.triggerStreetCallout('OVERCLOCK ARCHWAY! +SPEED', rg.color);
          break;
        }
      }
    }

    cycleState.current.active = curGame.onCycle && !curGame.inJail;
    cycleState.current.x = p.x;
    cycleState.current.z = p.z;
    cycleState.current.yaw = p.yaw;
    cycleState.current.speed = s.cycleSpeed;
    cycleState.current.turbo = turbo || s.cycleBoostT > 0;

    b.light = Math.max(0, b.light - rawDt);
    b.heavy = Math.max(0, b.heavy - rawDt);
    b.bash = Math.max(0, b.bash - rawDt);
    b.dodge = Math.max(0, b.dodge - rawDt);
    b.parry = Math.max(0, b.parry - rawDt);
    b.jump = Math.max(0, b.jump - rawDt);

    // Step thrown & fallen street weapons
    const streetFighters = [p, ...activeNpcs.filter((n) => n.mood !== 'dead').map((n) => n.fighter)];
    for (const ev of stepWeaponProps(s.weaponProps, streetFighters, dt, 4000)) {
      const hitNpc = activeNpcs.find((n) => n.fighter.id === ev.victim);
      if (hitNpc) {
        if (ev.type !== 'kill' && hitNpc.mood !== 'hostile') {
          hitNpc.mood = 'hostile';
          hitNpc.civilian = false;
          if (hitNpc.role !== 'corrupted') game.addBounty(15);
        }
        triggerHitFeedback(ev, hitNpc.color, false, hitNpc);
      } else if (ev.victim === p.id) {
        triggerHitFeedback(ev, p.stats.color, true);
      }
    }

    // Step active NPCs (Cache City when near origin, or local settlement NPCs)
    const playerInSanctuary = isSanctuaryPosition(p.x, p.z);
    const restorePlayerAtPod = () => {
      const nearest = nearestSettlement(p.x, p.z).settlement;
      const rx = nearest.id === 'cache_city' ? -14 : nearest.spawnX;
      const rz = nearest.id === 'cache_city' ? 32 : nearest.spawnZ;
      p.x = rx; p.z = rz; p.state = 'idle'; p.hp = p.maxHp; p.stamina = p.maxStamina;
      p.dazed = 0; p.weaponDisarmed = false; p.airY = 0; p.airVy = 0; p.guardHeight = 'mid'; p.diveKicking = false; p.wallSplat = 0;
      game.setOnCycle(false);
      for (const k of LIMB_KEYS) { p.limbs[k].hp = p.limbs[k].max; p.limbs[k].severed = false; }
      p.armor.helm.hp = p.armor.helm.max; p.armor.helm.broken = p.armor.helm.max <= 0;
      p.armor.pauldron.hp = p.armor.pauldron.max; p.armor.pauldron.broken = p.armor.pauldron.max <= 0;
      p.armor.shield.hp = p.armor.shield.max; p.armor.shield.broken = p.armor.shield.max <= 0;
      game.setStreetToast({ speaker: 'SAFE SECTOR POD', text: 'Rebooted safely. All specs, properties & hard-light gear preserved.', color: '#a78bfa' });
    };

    for (const n of activeNpcs) {
      if (n.barkT > 0) n.barkT = Math.max(0, n.barkT - rawDt);
      if (n.mood === 'dead') {
        if (n.collapseT && n.collapseT > 0) {
          n.collapseT = Math.max(0, n.collapseT - rawDt);
          if (n.collapseT === 0) fx.shards.burst(n.x, 0.45, n.z, 18, 6.5, n.color);
        }
        n.respawnT -= rawDt;
        if (n.respawnT <= 0) {
          const spot = isNearCache
            ? pickCityPoint(n.role === 'corrupted' ? 'heap' : 'plaza')
            : { x: regionRef.current.x + (Math.random() - 0.5) * 24, z: regionRef.current.z + (Math.random() - 0.5) * 24 };
          n.x = spot.x; n.z = spot.z;
          n.mood = n.role === 'corrupted' ? 'hostile' : 'calm';
          n.civilian = n.role === 'citizen';
          n.greeted = false; n.antagonized = 0;
          n.collapseT = 0;
          n.fighter.state = 'idle';
          n.fighter.hp = n.fighter.maxHp;
          n.fighter.dazed = 0;
          n.fighter.weaponDisarmed = false;
          n.fighter.airY = 0; n.fighter.airVy = 0; n.fighter.juggleCount = 0;
          n.fighter.diveKicking = false; n.fighter.wallSplat = 0; n.fighter.guardHeight = 'mid';
          for (const k of LIMB_KEYS) { n.fighter.limbs[k].hp = n.fighter.limbs[k].max; n.fighter.limbs[k].severed = false; }
          n.fighter.armor.helm.hp = n.fighter.armor.helm.max; n.fighter.armor.helm.broken = n.fighter.armor.helm.max <= 0;
          n.fighter.armor.pauldron.hp = n.fighter.armor.pauldron.max; n.fighter.armor.pauldron.broken = n.fighter.armor.pauldron.max <= 0;
          n.fighter.armor.shield.hp = n.fighter.armor.shield.max; n.fighter.armor.shield.broken = n.fighter.armor.shield.max <= 0;
          n.fighter.x = spot.x; n.fighter.z = spot.z;
        }
        continue;
      }

      const f = n.fighter;
      f.x = n.x; f.z = n.z;
      if (f.weaponDisarmed && f.state === 'idle' && f.airY === 0 && tryPickupWeapon(f, s.weaponProps, 1.35)) {
        s.propVersion++;
      }

      const dToPlayer = Math.hypot(p.x - n.x, p.z - n.z);
      if (n.role === 'enforcer' && game.bounty > 0 && !curGame.inJail && !frozen && s.time >= s.resistUntil && dToPlayer < 24) {
        if (dToPlayer < 4.4) {
          game.openArrestPrompt(n.filename);
        } else {
          n.targetX = p.x;
          n.targetZ = p.z;
          n.wait = 0;
        }
      }

      // Strictly block spontaneous corrupted auto-aggro whenever player stands inside ANY Sanctuary hub!
      if (n.role === 'corrupted' && n.mood === 'hostile' && !playerInSanctuary && !frozen && dToPlayer < 13 && !curGame.inJail) {
        const intent = aiIntent(f, p, dt, liveHostiles);
        const strike = stepFighter(f, intent, dt, p);
        if (strike && f.atk) {
          if (dToPlayer < 12) sfx.swing(f.atk === 'heavy' || f.atk === 'light3');
          const fg = gearOf(f);
          fx.slashes.spawn(f.x, f.z, f.yaw, f.atk, '#ff3b5c', f.style, fg.moves[f.atk].motion);
          for (const ev of resolveStrike(f, [p]) as HitEvent[]) {
            triggerHitFeedback(ev, p.stats.color, true);
            if (p.state === 'dead' || p.hp <= 0) {
              game.handleStreetDefeat(`de-rezzed by ${n.filename}`);
              restorePlayerAtPod();
              n.mood = 'calm';
            }
          }
        }
      } else if (n.mood === 'hostile' && n.role !== 'corrupted' && !frozen && dToPlayer < 26 && !curGame.inJail) {
        const intent = aiIntent(f, p, dt, liveHostiles);
        const strike = stepFighter(f, intent, dt, p);
        if (strike && f.atk) {
          if (dToPlayer < 12) sfx.swing(f.atk === 'heavy' || f.atk === 'light3');
          const fg = gearOf(f);
          fx.slashes.spawn(f.x, f.z, f.yaw, f.atk, '#ff4f6d', f.style, fg.moves[f.atk].motion);
          for (const ev of resolveStrike(f, [p]) as HitEvent[]) {
            triggerHitFeedback(ev, p.stats.color, true);
            if (p.state === 'dead' || p.hp <= 0) {
              game.handleStreetDefeat(`de-rezzed by ${n.filename}`);
              restorePlayerAtPod();
              for (const allN of activeNpcs) if (allN.mood === 'hostile' && allN.role !== 'corrupted') allN.mood = 'calm';
            }
          }
        }
      } else {
        if (n.mood !== 'calm') n.onVehicle = false;
        f.state = 'idle'; f.atk = null; f.blocking = false;
        let spd = n.civilian ? 1.85 : n.role === 'enforcer' ? 3.2 : 2.35;
        if (n.mood === 'fleeing' && dToPlayer < 22) {
          const ang = Math.atan2(n.x - p.x, n.z - p.z);
          n.targetX = n.x + Math.sin(ang) * 14;
          n.targetZ = n.z + Math.cos(ang) * 14;
          spd = 4.9;
        }
        if (n.wait > 0 && n.mood !== 'fleeing') {
          n.wait -= dt;
          n.onVehicle = false;
          n.vehicleLean = 0;
          f.vx = 0; f.vz = 0; f.localVz = 0;
        } else {
          const dx = n.targetX - f.x, dz = n.targetZ - f.z;
          const dist = Math.hypot(dx, dz);
          const arriveR = n.onVehicle ? 2.2 : 0.9;
          if (dist < arriveR) {
            if (n.mood === 'fleeing' && dToPlayer > 22) n.mood = 'calm';
            const nextPt = isNearCache
              ? pickCityPoint(n.role === 'corrupted' ? 'heap' : n.role === 'hustler' ? 'alley' : 'plaza')
              : { x: regionRef.current.x + (Math.random() - 0.5) * 60, z: regionRef.current.z + (Math.random() - 0.5) * 60 };
            n.onVehicle = false;
            n.vehicleLean = 0;
            advanceNpcSchedule(n, nextPt);
            n.wait = 1.4 + Math.random() * 4;
            f.vx = 0; f.vz = 0; f.localVz = 0;
          } else {
            if (n.hasVehicle && n.mood === 'calm' && dist > 16) n.onVehicle = true;
            const traffic = stepNpcTrafficYield(n, p.x, p.z, activeNpcs);
            if (n.onVehicle) spd = (n.role === 'enforcer' ? 12.5 : 10.5) * traffic.speedMul;
            const desiredYaw = Math.atan2(dx, dz);
            const dyaw = Math.atan2(Math.sin(desiredYaw - f.yaw), Math.cos(desiredYaw - f.yaw));
            if (n.onVehicle) {
              const turnStep = THREE.MathUtils.clamp(dyaw, -4.2 * dt, 4.2 * dt);
              f.yaw += turnStep;
              n.vehicleLean = THREE.MathUtils.lerp(n.vehicleLean, THREE.MathUtils.clamp(-dyaw * 0.45, -0.35, 0.35), 1 - Math.exp(-8 * dt));
              f.vx = Math.sin(f.yaw) * spd + Math.cos(f.yaw) * traffic.laneOffset * 0.25;
              f.vz = Math.cos(f.yaw) * spd - Math.sin(f.yaw) * traffic.laneOffset * 0.25;
            } else {
              n.vehicleLean = 0;
              f.vx = (dx / dist) * spd;
              f.vz = (dz / dist) * spd;
              f.yaw = desiredYaw;
            }
            f.x += f.vx * dt;
            f.z += f.vz * dt;
            f.localVz = n.onVehicle ? 0.5 : n.mood === 'fleeing' ? 0.9 : 0.35;
          }
        }
      }

      const np = { x: f.x, z: f.z };
      const preX = np.x, preZ = np.z;
      resolveCircles(np, 0.55, nearbySolids);
      if (f.state === 'stagger' && f.wallSplat <= 0 && Math.hypot(f.kx, f.kz) > 4.2 && Math.hypot(np.x - preX, np.z - preZ) > 0.04) {
        f.wallSplat = 1.6;
        f.dazed = 2.8;
        f.hp = Math.max(1, f.hp - 8);
        f.stagger = Math.max(f.stagger, 1.35);
        sfx.guardBreak();
        s.hitstop = Math.max(s.hitstop, 0.09);
        s.shake = Math.max(s.shake, 0.55);
        fx.shards.burst(np.x, 1.35, np.z, 18, 7.5, '#ff4fd8');
        game.triggerStreetCallout('WALL SPLAT!', '#ff4fd8');
      }
      clampBounds(np, 0.55, WORLD_BOUNDS);
      if (Math.hypot(np.x - n.x, np.z - n.z) < 0.008 && n.wait <= 0 && n.mood !== 'hostile') {
        const nextPt = isNearCache
          ? pickCityPoint(n.role === 'corrupted' ? 'heap' : 'plaza')
          : { x: regionRef.current.x + (Math.random() - 0.5) * 48, z: regionRef.current.z + (Math.random() - 0.5) * 48 };
        advanceNpcSchedule(n, nextPt);
      }
      f.x = np.x; f.z = np.z;
      n.x = np.x; n.z = np.z;
      n.yaw = f.yaw;
    }

    // Periodic World Event (safe chatter inside Sanctuary hubs; wild encounters in frontiers!)
    if (!frozen && !curGame.inJail) {
      s.eventTimer -= rawDt;
      if (s.eventTimer <= 0) {
        s.eventTimer = 24 + Math.random() * 12;
        const ev = triggerStreetEvent(activeNpcs, p.x, p.z);
        if (ev) game.setStreetToast({ speaker: `${ev.title} · ${ev.speaker}`, text: ev.bark, color: ev.color });
      }
    }

    // Real-time Fable Property Rent collection every 45s of exploration
    if (!frozen && !curGame.inJail) {
      s.rentTimer -= rawDt;
      if (s.rentTimer <= 0) {
        s.rentTimer = 45;
        game.collectPropertyRent();
      }
    }

    // Settlement discovery + regional NPC pool swap + world telemetry
    s.discoveryTick += rawDt;
    if (s.discoveryTick >= 0.25) {
      s.discoveryTick = 0;
      const nearSet = nearestSettlement(p.x, p.z);
      if (nearSet.dist < 120) game.discoverSettlement(nearSet.settlement.id);
      if (nearSet.settlement.id !== 'cache_city' && nearSet.dist < 175) {
        if (regionRef.current.settlementId !== nearSet.settlement.id) {
          setRegionNpcs({
            settlementId: nearSet.settlement.id,
            x: nearSet.settlement.x,
            z: nearSet.settlement.z,
            list: createRegionNpcs(nearSet.settlement),
          });
        }
      } else if (regionRef.current.settlementId !== null && (isNearCache || nearSet.dist > 195)) {
        setRegionNpcs({ settlementId: null, x: 0, z: 0, list: [] });
      }
    }

    // Sync VFX, Debris, Lock-On Reticle & Horizon Curvature around player's live world position
    const vfxDt = s.hitstop > 0 ? rawDt * 0.12 : rawDt * (s.slowMo > 0 ? 0.36 : 1);
    playerPos.current.set(p.x, 0, p.z);
    setCurvature(CITY_CURVE_RADIUS, p.x, p.z);
    fx.shards.update(vfxDt, shardMesh.current);
    fx.debris.update(vfxDt, debrisMesh.current);
    fx.slashes.update(vfxDt);
    fx.ghosts.update(vfxDt);

    if (propVer !== s.propVersion) setPropVer(s.propVersion);

    reticleTarget.current = duelNpc
      ? { visible: true, x: duelNpc.x, z: duelNpc.z, dazed: duelNpc.fighter.dazed > 0 }
      : { visible: false, x: 0, z: 0, dazed: false };

    const lockName = duelNpc ? duelNpc.filename : null;
    const armed = !p.weaponDisarmed;
    if (lockName !== s.lastLockName || execReady !== s.lastExecReady || p.guardHeight !== s.lastStance || armed !== s.lastArmed) {
      s.lastLockName = lockName;
      s.lastExecReady = execReady;
      s.lastStance = p.guardHeight;
      s.lastArmed = armed;
      game.setStreetCombatHud({ lockName, executeReady: execReady, stance: p.guardHeight, armed });
    }

    // Sync Player 3D rig (raised slightly on saddle when riding Hard-Light Cycle)
    if (g.current) {
      for (const k of LIMB_KEYS) {
        limbPose.current[k].ratio = p.limbs[k].hp / (p.limbs[k].max || 1);
        limbPose.current[k].severed = p.limbs[k].severed;
      }
      g.current.pose.limbs = limbPose.current;
      armorPose.current.helm = !p.armor.helm.broken;
      armorPose.current.pauldron = !p.armor.pauldron.broken;
      armorPose.current.shield = !p.armor.shield.broken;
      g.current.pose.armor = armorPose.current;
      syncGladiatorView(g.current, p, curGame.weaponDrawn ? 1 : curGame.onCycle ? 0.65 : showcaseOpen ? 0.85 : 0, playerGear.speedMul);
      g.current.pose.sprint = curGame.weaponDrawn || curGame.onCycle ? 0 : s.sprintBlend;
      g.current.pose.turnRate = curGame.weaponDrawn || curGame.onCycle ? 0 : s.turnRate;
      g.current.pose.landSquash = s.landSquash;
      if (curGame.onCycle && !curGame.inJail) {
        g.current.group.position.y = 0.42;
      }
    }

    // Camera rig: Showcase drawer / 2.5D Tekken x Nidhogg Side-Duel / Light-Cycle chase / 3D follow cam
    if (showcaseOpen) {
      s.dCam.set(p.x - fxDir * 3.05 + rxDir * 0.65, 1.78, p.z - fzDir * 3.05 + rzDir * 0.65);
      s.dLook.set(p.x + rxDir * 0.72, 1.15, p.z + rzDir * 0.72);
    } else if (!curGame.onCycle && curGame.weaponDrawn && duelNpc) {
      const midX = (p.x + duelNpc.x) * 0.5;
      const midZ = (p.z + duelNpc.z) * 0.5;
      const dist = Math.hypot(duelNpc.x - p.x, duelNpc.z - p.z);
      const camPull = THREE.MathUtils.clamp(5.8 + dist * 0.58, 6.2, 11.8);
      const midAirY = (p.airY + duelNpc.fighter.airY) * 0.5;
      s.dCam.set(midX + s.sideCamDir.x * camPull, 2.35 + midAirY * 0.35, midZ + s.sideCamDir.y * camPull);
      s.dLook.set(midX, 1.32 + midAirY * 0.38, midZ);
    } else {
      const cyclePull = curGame.onCycle ? (s.cycleBoostT > 0 ? 3.4 : turbo ? 2.8 : 2.0) : 0;
      const cycleLift = curGame.onCycle ? 0.55 : 0;
      const lead = Math.min(Math.hypot(p.vx, p.vz) / 60, 0.45) * CAMERA_MOVE_LEAD;
      const cp = Math.cos(s.pitch), sn = Math.sin(s.pitch);
      const lookDist = CAMERA_LOOK_AHEAD + lead + (curGame.onCycle ? 3.0 : 0);
      s.dLook.set(p.x + fxDir * lookDist * cp, EYE_Y + CAMERA_LOOK_HEIGHT + lookDist * sn * 2.2, p.z + fzDir * lookDist * cp);
      s.dCam.set(
        p.x - fxDir * (CAMERA_SOCKET_DISTANCE + cyclePull),
        EYE_Y + CAMERA_SOCKET_HEIGHT + cycleLift,
        p.z - fzDir * (CAMERA_SOCKET_DISTANCE + cyclePull),
      );
    }
    const alpha = 1 - Math.pow(1 - CAMERA_LERP, rawDt * 60);
    s.cam.lerp(s.dCam, alpha);
    s.lookAt.lerp(s.dLook, alpha);
    camera.position.copy(s.cam);
    if (s.shake > 0.01) {
      camera.position.x += (Math.random() - 0.5) * s.shake * 0.45;
      camera.position.y += (Math.random() - 0.5) * s.shake * 0.35;
    }
    camera.lookAt(s.lookAt);

    if (camera instanceof THREE.PerspectiveCamera) {
      const baseFov = curGame.onCycle ? (s.cycleBoostT > 0 ? 78 : turbo ? 74 : 70) : 66;
      const targetFov = baseFov + s.fovKick;
      if (Math.abs(camera.fov - targetFov) > 0.05) {
        camera.fov = THREE.MathUtils.lerp(camera.fov, targetFov, 1 - Math.exp(-9 * rawDt));
        camera.updateProjectionMatrix();
      }
    }

    // Sync Wingman refs & Adaptive Synthwave Score
    playerRef.current = p;
    hostilesRef.current = activeNpcs;
    if (!frozen && !curGame.inJail) {
      sfx.stepMusic({
        biome: biomeAt(p.x, p.z),
        combat: Boolean(duelNpc) || liveHostiles.some((h) => Math.hypot(h.x - p.x, h.z - p.z) < 16),
        onCycle: curGame.onCycle,
        dt: rawDt,
      });
    }

    // Interactions: Memory Echo > Story Contact > Special Shrine > Colosseum Gate > Property Deed > Station / Capital Terminal
    if (!frozen) {
      game.setNearEcho(nearEchoHit?.echo.id ?? null);
      game.setNearStory(nearStoryHit?.story.id ?? null);
      game.setNearSpecialShrine(nearSpecial);
      game.setNearColosseum(nearColGate?.id ?? null);
      game.setNearProperty(nearProp?.id ?? null);
      const stationId = nearCacheStation ? nearCacheStation.id : nearCapTerm ? nearCapTerm.kind : null;
      game.setNear(stationId);

      const interactPressed = pressed('Enter') || (!curGame.onCycle && !curGame.weaponDrawn && hasInteractPrompt && pressed('Space'));
      if (interactPressed) {
        if (nearEchoHit && game.claimMemoryEcho(nearEchoHit.echo.id)) {
          sfx.execute();
          fx.shards.burst(nearEchoHit.echo.x, 2.2, nearEchoHit.echo.z, 32, 9.5, nearEchoHit.echo.color);
        } else if (nearStoryHit) {
          game.openStoryModal(nearStoryHit.story.id);
        } else if (nearSpecial) {
          game.openSpecialModal(nearSpecial);
        } else if (nearColGate) {
          game.setLastWorldPos(p.x, p.z);
          game.openColosseumGate(nearColGate.id);
        } else if (nearProp) {
          game.openPropertyPanel(nearProp.id);
        } else if (nearCacheStation) {
          if (nearCacheStation.id === 'gate') {
            game.setLastWorldPos(p.x, p.z);
            game.openColosseumGate('cache_city');
          } else {
            game.openPanel(nearCacheStation.id);
          }
        } else if (nearCapTerm) {
          game.openPanel(nearCapTerm.kind);
        }
      }
    }

    s.vitalsTick += rawDt;
    if (s.vitalsTick > 0.14) {
      s.vitalsTick = 0;
      const nc = nearestColosseum(p.x, p.z);
      const ne = nearestMemoryEcho(p.x, p.z, curGame.claimedEchoes);
      game.setWorldTelemetry({
        beacon: {
          id: nc.colosseum.id,
          name: nc.colosseum.name,
          cityLabel: nc.colosseum.cityLabel,
          color: nc.colosseum.color,
          dist: nc.dist,
          bearing: nc.bearing,
        },
        regionName: regionDisplayName(p.x, p.z),
        x: p.x,
        z: p.z,
        nearestEcho: ne
          ? { id: ne.echo.id, title: ne.echo.title, color: ne.echo.color, dist: ne.dist, bearing: ne.bearing }
          : null,
      });
      game.setStreetVitals({ hp: Math.ceil(p.hp), maxHp: p.maxHp, st: Math.floor(p.stamina), maxSt: p.maxStamina });
      game.setNearNpc(
        closestNpc
          ? {
              id: closestNpc.id,
              filename: closestNpc.filename,
              role: closestNpc.role,
              mood: closestNpc.mood,
              hostile: closestNpc.mood === 'hostile',
              hp: Math.ceil(closestNpc.fighter.hp),
              maxHp: closestNpc.fighter.maxHp,
              bark: closestNpc.barkT > 0 ? closestNpc.bark : undefined,
            }
          : null,
      );
    }
  });

  return (
    <group>
      <group ref={cacheNpcGroup}>
        {cacheNpcs.map((n) => <NpcActor key={n.id} npc={n} />)}
      </group>
      {regionNpcs.list.map((n) => <NpcActor key={`${regionNpcs.settlementId}-${n.id}`} npc={n} />)}
      {activeCompanion && <WingmanActor comp={activeCompanion} playerRef={playerRef} hostilesRef={hostilesRef} fx={fx} />}
      <StreetReticle targetRef={reticleTarget} />
      <LightCycle stateRef={cycleState} color={lookColor(look)} />
      <Gladiator
        key={`${look}-${loadout.weaponId}-${loadout.offhandId}-${loadout.helmId}-${loadout.bodyId}-${loadout.capeId}`}
        ref={g}
        sheathed={!weaponDrawn || inJail}
        gear={playerGear.visuals}
        color={lookColor(look)}
        scale={playerGear.scale}
      />
      <SlashRibbons pool={fx.slashes} />
      <DashGhosts pool={fx.ghosts} />
      {sim.current?.weaponProps.map((pr) => <StreetWeaponPropView key={pr.id} prop={pr} />)}
      <instancedMesh ref={shardMesh} args={[undefined, undefined, ShardPool.CAP]} material={fx.shardMat} frustumCulled={false}>
        <octahedronGeometry args={[1, 0]} />
      </instancedMesh>
      <instancedMesh ref={debrisMesh} args={[undefined, undefined, StreetDebrisPool.CAP]} material={fx.debrisMat} frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
      </instancedMesh>
    </group>
  );
}

function CacheCityDistrict({ playerPos }: { playerPos: PosRef }) {
  const grp = useRef<THREE.Group>(null!);
  useFrame(() => {
    if (grp.current) {
      grp.current.visible = Math.hypot(playerPos.current.x, playerPos.current.z) < 250;
    }
  });
  return (
    <group ref={grp}>
      <NeonCityFloor />
      <SurrealSpores />
      <NeonDataAqueduct />
      <StaticBatch>
        <Colonnade playerPos={playerPos} />
        <NightCityArchitecture />
      </StaticBatch>
      <Brazier position={[-16, 0, -2]} scale={0.95} color="#3ff0ff" light />
      <Brazier position={[16, 0, -2]} scale={0.95} color="#ff4fd8" />
      <Brazier position={[-16, 0, -20]} scale={0.95} color="#ffc95c" />
      <Brazier position={[16, 0, -20]} scale={0.95} color="#3ff0ff" />
      <Brazier position={[-7.5, 0, 22]} scale={0.9} color="#a78bfa" />
      <Brazier position={[7.5, 0, 22]} scale={0.9} color="#3ff0ff" />
      <Stations />
    </group>
  );
}

export function Ludus() {
  const start = useGame.getState().lastWorldPos;
  const playerPos = useRef(new THREE.Vector3(start.x, 0, start.z));
  const timeOfDay = useGame((s) => s.timeOfDay);
  const currentRegionName = useGame((s) => s.currentRegionName);
  const morning = timeOfDay === 'morning';
  const curBiome = biomeAt(playerPos.current.x, playerPos.current.z);
  const fogHex =
    curBiome === 'bazaar' ? '#28170d'
    : curBiome === 'vault' ? '#161a42'
    : curBiome === 'frontier' ? '#300c14'
    : curBiome === 'kernel' ? '#2a2410'
    : morning ? '#14264f' : '#2b0e42';
  void currentRegionName;

  return (
    <>
      <color attach="background" args={[morning ? '#0e1530' : '#1c0a2b']} />
      <fog attach="fog" args={[fogHex, morning ? 68 : 54, morning ? 240 : 215]} />
      <hemisphereLight args={morning ? ['#6ee2ff', '#28204a', 1.38] : ['#ff7ac6', '#261240', 1.22]} />
      <directionalLight
        position={morning ? [28, 42, 22] : [-26, 22, -24]}
        intensity={morning ? 1.82 : 1.68}
        color={morning ? '#d0f8ff' : '#ff9475'}
      />
      <directionalLight
        position={morning ? [-22, 18, -26] : [22, 18, 22]}
        intensity={0.88}
        color={morning ? '#ff85df' : '#5ef2ff'}
      />
      <Ps1Sky mood={morning ? 'city_cycle' : 'city_purge'} playerPosRef={playerPos} openWorld />
      <Starfield playerPosRef={playerPos} />
      <InfiniteCurvedFloor playerPos={playerPos} />
      <CacheCityDistrict playerPos={playerPos} />
      <StreamingSettlements playerPos={playerPos} />
      <NearestColosseumBeacon playerPos={playerPos} />
      <CityWorldSimulation playerPos={playerPos} />
    </>
  );
}
