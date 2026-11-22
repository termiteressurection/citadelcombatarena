import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { Gladiator, type GladiatorHandle, type LimbPose } from './Gladiator';
import { Stations } from './Stations';
import { StaticBatch } from './art/StaticBatch';
import { Brazier, Ps1Sky } from './art/Ps1Sky';
import { CITY_CURVE_RADIUS, makeCurvedBasicMaterial, setCurvature } from './art/curvature';
import { cloneTex, getPs1Texture, makePs1Material } from './art/ps1Textures';
import { SurrealSpores } from './art/SurrealSpores';
import Starfield from './art/Starfield';
import SpriteText from './art/SpriteText';
import { CorinthianColumn, DoricColumn, IonicColumn } from './art/ClassicalColumns';
import {
  ATTACKS, DODGE_TIME, LIMB_KEYS, NO_INTENT, aiIntent, drinkFlask, gearOf, makeFighter,
  parryWindowOf, resolveStrike, stepFighter, windupOf,
  type Fighter, type HitEvent, type Intent,
} from './arena/combat';
import { DashGhosts, GhostPool, ShardPool, SlashPool, SlashRibbons } from './arena/effects';
import { lookColor } from './arena/run';
import { type ArmorKey } from './arena/styles';
import { buildPlayerMods } from './rpg/stats';
import { resolveLoadout } from './rpg/items';
import { clampBounds, resolveCircles } from './world/colliders';
import {
  AQUEDUCT_PIERS, AQUEDUCT_YAW, BASIN, BOUNDS, CITY_TOWERS, COLUMNS, JAIL_CELL,
  PLAYER_START, SOLIDS, nearestStation,
} from './world/layout';
import {
  antagonizeNpc, createCityPopulation, greetNpc, pickCityPoint, triggerStreetEvent,
  type CityNpc,
} from './world/citizens';
import { keys, pressed } from './input';
import { useGame } from './store';

const PLAYER_R = 0.55;
const MOVE_SPEED = 0.27 * 60;
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
      outerGrid: makePs1Material({ color: '#8ad8f0', map: cloneTex(getPs1Texture('grid'), 76, 76), emissive: '#071b2b', emissiveIntensity: 0.35 }),
      plaza: makePs1Material({ color: '#a8e6ff', map: cloneTex(getPs1Texture('grid'), 22, 22), emissive: '#0c273b', emissiveIntensity: 0.4 }),
      avenue: makePs1Material({ color: '#6fd8ff', map: cloneTex(getPs1Texture('conduit'), 2, 28), emissive: '#0e324a', emissiveIntensity: 0.4 }),
      cross: makePs1Material({ color: '#5fb6e8', map: cloneTex(getPs1Texture('conduit'), 16, 1), emissive: '#0c263a', emissiveIntensity: 0.35 }),
      cyanStrip: makeCurvedBasicMaterial({ color: '#3ff0ff' }),
      magStrip: makeCurvedBasicMaterial({ color: '#ff4fd8' }),
      conduit: makePs1Material({ color: '#273054', map: cloneTex(getPs1Texture('conduit'), 4, 1), emissive: '#10293d', emissiveIntensity: 0.35 }),
      gold: makePs1Material({ color: '#ffd480', map: getPs1Texture('bronze'), emissive: '#785212', emissiveIntensity: 0.35 }),
      water: waterMat,
      waterTex,
      abyss: new THREE.MeshBasicMaterial({ color: '#03030a' }),
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
      {/* Distant dark digital void below horizon drop */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -45, 0]} material={mats.abyss} frustumCulled={false}>
        <circleGeometry args={[480, 24]} />
      </mesh>
      {/* Continuous subdivided open TRON Grid extending smoothly over the R=200 horizon */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -10]} material={mats.outerGrid} frustumCulled={false}>
        <planeGeometry args={[280, 280, 76, 76]} />
      </mesh>
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
  h.group.rotation.y = f.yaw;
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
  const labelGroup = useRef<THREE.Group>(null!);
  const [labelInfo, setLabelInfo] = useState<{ visible: boolean; text: string; color: string }>({
    visible: false, text: npc.filename, color: npc.color,
  });

  useFrame(() => {
    const h = g.current;
    if (!h) return;
    if (npc.mood === 'dead') {
      h.group.visible = false;
      if (labelInfo.visible) setLabelInfo({ visible: false, text: npc.filename, color: npc.color });
      return;
    }
    const armed = npc.mood === 'hostile' || npc.role === 'corrupted';
    syncGladiatorView(h, npc.fighter, armed ? 1 : 0, npc.gear.speedMul);
    if (labelGroup.current) labelGroup.current.position.set(npc.x, 0, npc.z);
    const desiredVis = npc.barkT > 0 || armed || npc.role === 'enforcer' || npc.role === 'gladiator';
    const text = npc.barkT > 0 ? `${npc.filename}\n"${npc.bark}"` : armed ? `${npc.filename} [!]` : npc.filename;
    const col = armed ? '#ff4f6d' : npc.color;
    if (desiredVis !== labelInfo.visible || (desiredVis && (text !== labelInfo.text || col !== labelInfo.color))) {
      setLabelInfo({ visible: desiredVis, text, color: col });
    }
  });

  const armed = npc.mood === 'hostile' || npc.role === 'enforcer' || npc.role === 'corrupted';
  return (
    <group>
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

/** Interactive Curved TRON Megacity simulation: Player + 26 Unpredictable Living Deleted-File NPCs + SysWatch Law + Live Street Combat. */
function CityWorldSimulation({ playerPos }: { playerPos: PosRef }) {
  const g = useRef<GladiatorHandle>(null!);
  const shardMesh = useRef<THREE.InstancedMesh>(null!);
  const limbPose = useRef<LimbPose>(makeLimbPose());
  const armorPose = useRef<Record<ArmorKey, boolean>>({ helm: true, pauldron: true, shield: true });

  const camera = useThree((s) => s.camera);
  const look = useGame((s) => s.look);
  const loadout = useGame((s) => s.loadout);
  const stats = useGame((s) => s.stats);
  const dailyBuffs = useGame((s) => s.dailyBuffs);
  const style = useGame((s) => s.style);
  const weaponDrawn = useGame((s) => s.weaponDrawn);
  const inJail = useGame((s) => s.inJail);

  const playerGear = useMemo(() => resolveLoadout(loadout), [loadout]);
  const npcs = useMemo(() => createCityPopulation(), []);
  const fx = useMemo(() => ({
    shards: new ShardPool(),
    slashes: new SlashPool(),
    ghosts: new GhostPool(),
    shardMat: makeCurvedBasicMaterial({ color: '#ffffff' }),
  }), []);

  const sim = useRef<{
    player: Fighter;
    yaw: number;
    pitch: number;
    cam: THREE.Vector3;
    lookAt: THREE.Vector3;
    dCam: THREE.Vector3;
    dLook: THREE.Vector3;
    buf: { light: number; heavy: number; bash: number; dodge: number; parry: number };
    eventTimer: number;
    resistUntil: number;
    wasInJail: boolean;
    wasArrestOpen: boolean;
    vitalsTick: number;
    time: number;
  }>(null!);

  if (!sim.current) {
    const mods = buildPlayerMods(stats, playerGear, dailyBuffs);
    const p = makeFighter(0, 'player', PLAYER_START.x, PLAYER_START.z, mods, style, playerGear);
    p.stats = { ...p.stats, color: lookColor(look) };
    sim.current = {
      player: p,
      yaw: 0,
      pitch: 0,
      cam: new THREE.Vector3(PLAYER_START.x, EYE_Y + CAMERA_SOCKET_HEIGHT, PLAYER_START.z + CAMERA_SOCKET_DISTANCE),
      lookAt: new THREE.Vector3(PLAYER_START.x, EYE_Y + CAMERA_LOOK_HEIGHT, PLAYER_START.z - CAMERA_LOOK_AHEAD),
      dCam: new THREE.Vector3(),
      dLook: new THREE.Vector3(),
      buf: { light: 0, heavy: 0, bash: 0, dodge: 0, parry: 0 },
      eventTimer: 16,
      resistUntil: 0,
      wasInJail: false,
      wasArrestOpen: false,
      vitalsTick: 0,
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
    next.stats = { ...next.stats, color: lookColor(look) };
    s.player = next;
  }, [playerGear, stats, dailyBuffs, look, style]);

  // Reset global horizon curvature when leaving the city scene
  useEffect(() => {
    setCurvature(CITY_CURVE_RADIUS, playerPos.current.x, playerPos.current.z);
    return () => setCurvature(0, 0, 0);
  }, [playerPos]);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    const s = sim.current;
    const game = useGame.getState();
    const p = s.player;
    s.time += dt;

    // Handle Quarantine transitions
    if (game.inJail && !s.wasInJail) {
      p.x = JAIL_CELL.x;
      p.z = JAIL_CELL.z;
      p.state = 'idle';
      for (const n of npcs) if (n.role === 'enforcer') n.mood = 'calm';
    }
    s.wasInJail = game.inJail;

    // Detect Resist Arrest (arrestPrompt dismissed without going to jail and bounty still > 0)
    if (s.wasArrestOpen && !game.arrestPrompt && !game.inJail && game.bounty > 0) {
      s.resistUntil = s.time + 14;
      for (const n of npcs) {
        if (n.role === 'enforcer' && Math.hypot(n.x - p.x, n.z - p.z) < 28) n.mood = 'hostile';
      }
      game.setStreetToast({ speaker: 'SysWatch', text: 'SUSPECT RESISTING DELETION! ENGAGE FORCE!', color: '#ff3b5c' });
    }
    s.wasArrestOpen = Boolean(game.arrestPrompt);

    const frozen = game.panel !== null || game.arrestPrompt !== null;

    if (game.panel && pressed('Escape')) game.openPanel(null);
    if (!game.arrestPrompt && pressed('KeyC')) {
      if (game.panel === 'locker') game.openPanel(null);
      else if (game.panel === null) game.openPanel('locker');
    }
    if (!frozen && pressed('KeyX')) game.toggleWeaponDrawn();

    // Camera Q/E orbit & R/F tilt
    let orbit = 0;
    if (keys.has('KeyQ')) orbit += 1;
    if (keys.has('KeyE')) orbit -= 1;
    if (orbit) s.yaw += orbit * KB_YAW_SENS * dt * 60;
    let tilt = 0;
    if (keys.has('KeyR')) tilt += 1;
    if (keys.has('KeyF') && !game.weaponDrawn) tilt -= 1;
    if (tilt) s.pitch = Math.max(-1.3, Math.min(1.4, s.pitch + tilt * KB_YAW_SENS * dt * 60));

    const fxDir = -Math.sin(s.yaw), fzDir = -Math.cos(s.yaw);
    const rxDir = Math.cos(s.yaw), rzDir = -Math.sin(s.yaw);

    // Input buffering when weapon is drawn (or quick attack key pressed)
    const b = s.buf;
    if (!frozen) {
      if (pressed('KeyJ') || (game.weaponDrawn && pressed('Mouse0'))) {
        if (!game.weaponDrawn) game.setWeaponDrawn(true);
        b.light = 0.2;
      }
      if (pressed('KeyK') || (game.weaponDrawn && pressed('Mouse2'))) {
        if (!game.weaponDrawn) game.setWeaponDrawn(true);
        b.heavy = 0.2;
      }
      if (game.weaponDrawn && pressed('KeyF')) b.bash = 0.2;
      if (pressed('Space')) b.dodge = 0.16;
      if (game.weaponDrawn && (pressed('ShiftLeft') || pressed('ShiftRight') || pressed('KeyL'))) b.parry = 0.16;
      if (pressed('KeyH') && game.flasks > 0 && drinkFlask(p)) {
        game.consumeFlaskInBout();
        fx.shards.burst(p.x, 1.35, p.z, 22, 7.5, '#4dffa0');
        game.setStreetToast({ speaker: 'RESTORE', text: 'Integrity Flask patched +45% HP.', color: '#4dffa0' });
      }
    }

    // Nearest NPC discovery for RDR2 [T] Greet / [G] Antagonize
    let closestNpc: CityNpc | null = null;
    let closestDist = 4.6;
    for (const n of npcs) {
      if (n.mood === 'dead') continue;
      const d = Math.hypot(n.x - p.x, n.z - p.z);
      if (d < closestDist) { closestDist = d; closestNpc = n; }
    }

    if (!frozen && closestNpc) {
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
        const out = antagonizeNpc(closestNpc, game.weaponDrawn);
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

    // Live movement & combat stepping
    const liveHostiles: Fighter[] = [];
    for (const n of npcs) {
      if (n.mood === 'hostile' && n.fighter.state !== 'dead') liveHostiles.push(n.fighter);
    }

    let fwd = 0, side = 0;
    if (!frozen) {
      if (keys.has('KeyW') || keys.has('ArrowUp')) fwd += 1;
      if (keys.has('KeyS') || keys.has('ArrowDown')) fwd -= 1;
      if (keys.has('KeyD') || keys.has('ArrowRight')) side += 1;
      if (keys.has('KeyA') || keys.has('ArrowLeft')) side -= 1;
    }
    const moveLen = Math.hypot(fwd, side);
    const moveX = moveLen > 0 ? (fxDir * fwd + rxDir * side) / moveLen : 0;
    const moveZ = moveLen > 0 ? (fzDir * fwd + rzDir * side) / moveLen : 0;

    if (game.weaponDrawn && !frozen) {
      const intent: Intent = {
        moveX, moveZ,
        light: b.light > 0,
        heavy: b.heavy > 0,
        bash: b.bash > 0,
        block: keys.has('ShiftLeft') || keys.has('ShiftRight') || keys.has('KeyL'),
        parry: b.parry > 0,
        dodge: b.dodge > 0,
      };
      const prev = p.state;
      const prevQ = p.queuedAtk;
      const aimTarget = liveHostiles.length > 0
        ? liveHostiles.sort((a, b2) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b2.x - p.x, b2.z - p.z))[0]
        : null;
      const strike = stepFighter(p, intent, dt, aimTarget && Math.hypot(aimTarget.x - p.x, aimTarget.z - p.z) < 7 ? aimTarget : null);
      if (p.state !== 'idle' && prev === 'idle') { b.light = 0; b.heavy = 0; b.bash = 0; b.dodge = 0; }
      if (p.parryHold > 0 || p.blocking) b.parry = 0;
      if (p.queuedAtk && p.queuedAtk !== prevQ) { b.light = 0; b.heavy = 0; b.bash = 0; }
      if (p.state === 'dodge') {
        const startG = prev !== 'dodge';
        const stepG = Math.floor(p.t / 0.09) > Math.floor(Math.max(0, p.t - dt) / 0.09);
        if (startG || stepG) fx.ghosts.spawn(p.x, p.z, p.yaw, p.stats.color, p.dodgeLocalZ * 0.45, -p.dodgeLocalX * 0.45);
      }
      if (strike && p.atk) {
        const fg = gearOf(p);
        const motion = fg.moves[p.atk].motion;
        const slashColor = p.atk === 'light3' ? '#ffc95c' : motion === 'netThrow' ? '#3ff0ff' : p.stats.color;
        fx.slashes.spawn(p.x, p.z, p.yaw, p.atk, slashColor, p.style, motion);
        const allCombatants = [p, ...npcs.filter((n) => n.mood !== 'dead').map((n) => n.fighter)];
        for (const ev of resolveStrike(p, allCombatants) as HitEvent[]) {
          const hitNpc = npcs.find((n) => n.fighter.id === ev.victim);
          if (!hitNpc) continue;
          fx.shards.burst(hitNpc.x, 1.3, hitNpc.z, ev.type === 'kill' ? 28 : 12, ev.type === 'kill' ? 9.5 : 5, hitNpc.color, ev.dx, ev.dz);
          if (ev.type === 'kill') {
            hitNpc.mood = 'dead';
            hitNpc.respawnT = 20;
            const unlawful = hitNpc.role === 'citizen' || hitNpc.role === 'enforcer';
            game.awardStreetReward(hitNpc.bountyReward, hitNpc.role === 'corrupted' ? 30 : 18, unlawful ? 0 : 12);
            if (unlawful) {
              game.addBounty(hitNpc.role === 'enforcer' ? 50 : 30);
              game.setStreetToast({ speaker: 'SYSWATCH ALERT', text: `Process ${hitNpc.filename} de-rezzed! Bounty raised!`, color: '#ff3b5c' });
            } else {
              game.setStreetToast({ speaker: 'DE-REZ', text: `${hitNpc.filename} wiped! +${hitNpc.bountyReward} Cycles`, color: '#4dffa0' });
            }
          } else if (hitNpc.mood !== 'hostile') {
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
        }
      }
    } else {
      // Unarmed fast sprint navigation across the open TRON megacity
      p.state = 'idle';
      p.atk = null;
      p.blocking = false;
      p.vx = moveX * MOVE_SPEED;
      p.vz = moveZ * MOVE_SPEED;
      p.x += p.vx * dt;
      p.z += p.vz * dt;
      p.stamina = Math.min(p.maxStamina, p.stamina + 30 * dt);
      p.hp = Math.min(p.maxHp, p.hp + 2.5 * dt);
      const sp = Math.hypot(p.vx, p.vz);
      const showcaseOpen = game.panel === 'locker' || game.panel === 'smith' || game.panel === 'armorer';
      const targetYaw = showcaseOpen
        ? Math.atan2(-fxDir, -fzDir) + 0.32
        : sp > 0.4 ? Math.atan2(p.vx, p.vz) : Math.atan2(fxDir, fzDir);
      const d = Math.atan2(Math.sin(targetYaw - p.yaw), Math.cos(targetYaw - p.yaw));
      p.yaw += d * (1 - Math.exp(-16 * dt));
      p.localVz = Math.min(1, sp / MOVE_SPEED);
      p.localVx = 0;
    }

    // Enforce world bounds & quarantine containment if trapped inside Quarantine Cell
    const posTmp = { x: p.x, z: p.z };
    resolveCircles(posTmp, PLAYER_R, SOLIDS);
    clampBounds(posTmp, PLAYER_R, BOUNDS);
    if (game.inJail) {
      posTmp.x = THREE.MathUtils.clamp(posTmp.x, JAIL_CELL.x - 2.3, JAIL_CELL.x + 2.3);
      posTmp.z = THREE.MathUtils.clamp(posTmp.z, JAIL_CELL.z - 2.3, JAIL_CELL.z + 2.3);
    }
    p.x = posTmp.x;
    p.z = posTmp.z;

    b.light = Math.max(0, b.light - dt);
    b.heavy = Math.max(0, b.heavy - dt);
    b.bash = Math.max(0, b.bash - dt);
    b.dodge = Math.max(0, b.dodge - dt);
    b.parry = Math.max(0, b.parry - dt);

    // Step all 26 Deleted-File NPCs (wander / flee / hunt bounty / live combat)
    for (const n of npcs) {
      if (n.barkT > 0) n.barkT = Math.max(0, n.barkT - dt);
      if (n.mood === 'dead') {
        n.respawnT -= dt;
        if (n.respawnT <= 0) {
          const spot = pickCityPoint(n.role === 'corrupted' ? 'heap' : 'plaza');
          n.x = spot.x; n.z = spot.z;
          n.mood = n.role === 'corrupted' ? 'hostile' : 'calm';
          n.civilian = n.role === 'citizen';
          n.greeted = false; n.antagonized = 0;
          n.fighter.state = 'idle';
          n.fighter.hp = n.fighter.maxHp;
          n.fighter.x = spot.x; n.fighter.z = spot.z;
        }
        continue;
      }

      const f = n.fighter;
      f.x = n.x; f.z = n.z;

      // SysWatch Enforcer arrest patrol logic
      const dToPlayer = Math.hypot(p.x - n.x, p.z - n.z);
      if (n.role === 'enforcer' && game.bounty > 0 && !game.inJail && !frozen && s.time >= s.resistUntil && dToPlayer < 24) {
        if (dToPlayer < 4.4) {
          game.openArrestPrompt(n.filename);
        } else {
          n.targetX = p.x;
          n.targetZ = p.z;
          n.wait = 0;
        }
      }

      // Auto-aggro corrupted heap files when player enters close proximity outside safe plaza
      const restorePlayerAtPod = () => {
        p.x = -14; p.z = 32; p.state = 'idle'; p.hp = p.maxHp; p.stamina = p.maxStamina;
        for (const k of LIMB_KEYS) { p.limbs[k].hp = p.limbs[k].max; p.limbs[k].severed = false; }
        p.armor.helm.hp = p.armor.helm.max; p.armor.helm.broken = p.armor.helm.max <= 0;
        p.armor.pauldron.hp = p.armor.pauldron.max; p.armor.pauldron.broken = p.armor.pauldron.max <= 0;
        p.armor.shield.hp = p.armor.shield.max; p.armor.shield.broken = p.armor.shield.max <= 0;
        game.setStreetToast({ speaker: 'SAFE SECTOR POD', text: 'Rebooted at Safe Sector Pod. All specs and hard-light gear preserved.', color: '#a78bfa' });
      };
      if (n.role === 'corrupted' && n.mood === 'hostile' && !frozen && dToPlayer < 13 && !game.inJail) {
        const intent = aiIntent(f, p, dt, liveHostiles);
        const strike = stepFighter(f, intent, dt, p);
        if (strike && f.atk) {
          const fg = gearOf(f);
          fx.slashes.spawn(f.x, f.z, f.yaw, f.atk, '#ff3b5c', f.style, fg.moves[f.atk].motion);
          for (const ev of resolveStrike(f, [p]) as HitEvent[]) {
            fx.shards.burst(p.x, 1.3, p.z, 14, 6, ev.type === 'parry' ? '#ffc95c' : '#ff3b5c', ev.dx, ev.dz);
            if (p.state === 'dead' || p.hp <= 0) {
              game.handleStreetDefeat(`de-rezzed by ${n.filename}`);
              restorePlayerAtPod();
              n.mood = 'calm';
            }
          }
        }
      } else if (n.mood === 'hostile' && !frozen && dToPlayer < 26 && !game.inJail) {
        const intent = aiIntent(f, p, dt, liveHostiles);
        const strike = stepFighter(f, intent, dt, p);
        if (strike && f.atk) {
          const fg = gearOf(f);
          fx.slashes.spawn(f.x, f.z, f.yaw, f.atk, '#ff4f6d', f.style, fg.moves[f.atk].motion);
          for (const ev of resolveStrike(f, [p]) as HitEvent[]) {
            fx.shards.burst(p.x, 1.3, p.z, 14, 6, ev.type === 'parry' ? '#ffc95c' : '#ff4f6d', ev.dx, ev.dz);
            if (p.state === 'dead' || p.hp <= 0) {
              game.handleStreetDefeat(`de-rezzed by ${n.filename}`);
              restorePlayerAtPod();
              for (const allN of npcs) if (allN.mood === 'hostile' && allN.role !== 'corrupted') allN.mood = 'calm';
            }
          }
        }
      } else {
        // Peaceful wander or panic flee away from player
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
          f.vx = 0; f.vz = 0; f.localVz = 0;
        } else {
          const dx = n.targetX - f.x, dz = n.targetZ - f.z;
          const dist = Math.hypot(dx, dz);
          if (dist < 0.9) {
            if (n.mood === 'fleeing' && dToPlayer > 22) n.mood = 'calm';
            const nextPt = pickCityPoint(n.role === 'corrupted' ? 'heap' : n.role === 'hustler' ? 'alley' : 'plaza');
            n.targetX = nextPt.x; n.targetZ = nextPt.z;
            n.wait = 1 + Math.random() * 4;
            f.vx = 0; f.vz = 0; f.localVz = 0;
          } else {
            f.vx = (dx / dist) * spd;
            f.vz = (dz / dist) * spd;
            f.x += f.vx * dt;
            f.z += f.vz * dt;
            f.yaw = Math.atan2(dx, dz);
            f.localVz = n.mood === 'fleeing' ? 0.9 : 0.35;
          }
        }
      }

      const np = { x: f.x, z: f.z };
      resolveCircles(np, 0.55, SOLIDS);
      clampBounds(np, 0.55, BOUNDS);
      if (Math.hypot(np.x - n.x, np.z - n.z) < 0.008 && n.wait <= 0 && n.mood !== 'hostile') {
        const nextPt = pickCityPoint(n.role === 'corrupted' ? 'heap' : 'plaza');
        n.targetX = nextPt.x; n.targetZ = nextPt.z;
      }
      f.x = np.x; f.z = np.z;
      n.x = np.x; n.z = np.z;
      n.yaw = f.yaw;
    }

    // Periodic Unscripted RDR2 Street Event every ~22s
    if (!frozen && !game.inJail) {
      s.eventTimer -= dt;
      if (s.eventTimer <= 0) {
        s.eventTimer = 22 + Math.random() * 12;
        const ev = triggerStreetEvent(npcs, p.x, p.z);
        if (ev) game.setStreetToast({ speaker: `${ev.title} · ${ev.speaker}`, text: ev.bark, color: ev.color });
      }
    }

    // Sync VFX & Horizon Curvature around player's live world position
    playerPos.current.set(p.x, 0, p.z);
    setCurvature(CITY_CURVE_RADIUS, p.x, p.z);
    fx.shards.update(dt, shardMesh.current);
    fx.slashes.update(dt);
    fx.ghosts.update(dt);

    // Sync Player 3D rig
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
      const showcaseOpen = game.panel === 'locker' || game.panel === 'smith' || game.panel === 'armorer';
      syncGladiatorView(g.current, p, game.weaponDrawn ? 1 : showcaseOpen ? 0.85 : 0, playerGear.speedMul);
    }

    // Camera rig: 3D showcase drawer or Citadel third-person curved socket cam
    const showcaseOpen = game.panel === 'locker' || game.panel === 'smith' || game.panel === 'armorer';
    if (showcaseOpen) {
      s.dCam.set(p.x - fxDir * 3.05 + rxDir * 0.65, 1.78, p.z - fzDir * 3.05 + rzDir * 0.65);
      s.dLook.set(p.x + rxDir * 0.72, 1.15, p.z + rzDir * 0.72);
    } else {
      const lead = Math.min(Math.hypot(p.vx, p.vz) / 60, 0.27 * 1.5) * CAMERA_MOVE_LEAD;
      const cp = Math.cos(s.pitch), sn = Math.sin(s.pitch);
      const lookDist = CAMERA_LOOK_AHEAD + lead;
      s.dLook.set(p.x + fxDir * lookDist * cp, EYE_Y + CAMERA_LOOK_HEIGHT + lookDist * sn * 2.2, p.z + fzDir * lookDist * cp);
      s.dCam.set(p.x - fxDir * CAMERA_SOCKET_DISTANCE, EYE_Y + CAMERA_SOCKET_HEIGHT, p.z - fzDir * CAMERA_SOCKET_DISTANCE);
    }
    const alpha = 1 - Math.pow(1 - CAMERA_LERP, dt * 60);
    s.cam.lerp(s.dCam, alpha);
    s.lookAt.lerp(s.dLook, alpha);
    camera.position.copy(s.cam);
    camera.lookAt(s.lookAt);

    // Stations + HUD nearNpc/vitals sync (throttled lightly for vitals)
    const near = game.inJail ? null : nearestStation(p.x, p.z);
    game.setNear(frozen ? game.near : near?.id ?? null);
    if (!frozen && near && (pressed('Enter') || pressed('Space'))) game.openPanel(near.id);

    s.vitalsTick += dt;
    if (s.vitalsTick > 0.1) {
      s.vitalsTick = 0;
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
      {npcs.map((n) => <NpcActor key={n.id} npc={n} />)}
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
      <instancedMesh ref={shardMesh} args={[undefined, undefined, ShardPool.CAP]} material={fx.shardMat} frustumCulled={false}>
        <octahedronGeometry args={[1, 0]} />
      </instancedMesh>
    </group>
  );
}

export function Ludus() {
  const playerPos = useRef(new THREE.Vector3(PLAYER_START.x, 0, PLAYER_START.z));
  const timeOfDay = useGame((s) => s.timeOfDay);
  const morning = timeOfDay === 'morning';

  return (
    <>
      <color attach="background" args={[morning ? '#070a1c' : '#12051c']} />
      <fog attach="fog" args={[morning ? '#0d1936' : '#1e082e', morning ? 48 : 38, morning ? 175 : 155]} />
      <hemisphereLight args={morning ? ['#4fd8ff', '#16112b', 1.1] : ['#ff62b8', '#150826', 0.95]} />
      <directionalLight
        position={morning ? [28, 42, 22] : [-26, 22, -24]}
        intensity={morning ? 1.45 : 1.35}
        color={morning ? '#b8f4ff' : '#ff7a5c'}
      />
      <directionalLight
        position={morning ? [-22, 18, -26] : [22, 18, 22]}
        intensity={0.6}
        color={morning ? '#ff6ad5' : '#3ff0ff'}
      />
      <Ps1Sky mood={morning ? 'city_cycle' : 'city_purge'} />
      <Starfield playerPosRef={playerPos} />
      <NeonCityFloor />
      <SurrealSpores />
      <NeonDataAqueduct />
      <StaticBatch>
        <Colonnade playerPos={playerPos} />
        <NightCityArchitecture />
      </StaticBatch>
      {/* Street Plasma Pylons illuminating Plaza & Under-Conduit Alleys */}
      <Brazier position={[-16, 0, -2]} scale={0.95} color="#3ff0ff" light />
      <Brazier position={[16, 0, -2]} scale={0.95} color="#ff4fd8" />
      <Brazier position={[-16, 0, -20]} scale={0.95} color="#ffc95c" />
      <Brazier position={[16, 0, -20]} scale={0.95} color="#3ff0ff" />
      <Brazier position={[-7.5, 0, 22]} scale={0.9} color="#a78bfa" />
      <Brazier position={[7.5, 0, 22]} scale={0.9} color="#3ff0ff" />
      <Stations />
      <CityWorldSimulation playerPos={playerPos} />
    </>
  );
}
