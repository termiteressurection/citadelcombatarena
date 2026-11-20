import { useCallback, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import SpriteText from '../three/SpriteText';
import { Chamber, GridIdentity, Thought, FurnitureItem, NamePlate, BottleMessage, FutureLetter } from './types';
import { PlayerController } from './world/PlayerController';
import { TheBit } from './world/TheBit';
import { SigmaSkull } from './AresGodhead';
import { ProximityGlyph, getTimeOfDay, getTimePalette, sphereDrop, livePlayerWorldPos } from './RebuiltWorldShared';
import { MoodOrb, ThoughtGem, ThoughtMonolith, ThoughtScroll, getThoughtCategory } from './RebuiltWorldThoughts';
import { resolveBitAvatar } from './world/bitProfile';
import { InscriptionTree } from './world/InscriptionTree';
import { useWorldLook } from './looks/worldLook';
import { MindscapeArchitecture } from './looks/MindscapeArchitecture';
import { MinimalPlayerLight } from './looks/minimal/MinimalEnvironment';
import { LodgeEtchings } from './world/LodgeEtchings';
import { LighthouseBeacons } from './world/LighthouseBeacons';
import { RebuiltPortal, CurvedVoidSphere, WormholePortal, DigitalAlarmHaloRing, SeasonalToriiPortal } from './world/PortalSystems';
import { perfEnabled, perfTick } from './devPerf';
import { InstancedGarden } from './world/InstancedGarden';
import { lodgeFragmentShader, lodgeVertexShader } from './world/lodgeShaders';
import { HubObjects } from './world/HubObjects';
import { SuccessionFlora } from './world/SuccessionFlora';
import { resolveBitLoreProfile } from './world/bitLore';
import { getSeason, SEASON_PALETTES } from './seasonalPalette';
import { getJournalSourceThoughts, getMonthIndexFromChamber, getMonthThoughtCount, summarizeThoughtText } from './calendarChamberUtils';
import { localDateISO } from './localDate';
import { CodeTree, AmbientLife, DigitalGrass as CityDigitalGrass, InstancedCodeForest, JapaneseTownhouse, OsakaCastle, SigmaNPCBit } from './world/CityAssets';
import { computeVillageColliders } from './world/village/villageColliders';
import { DispersedOverworld, computeDispersedColliders } from './world/village/DispersedOverworld';
import { useVillageTunerStore } from '@/core/state/villageTunerStore';
import { ClassicalColumnsColonnade } from './world/village/ClassicalColumns';
import { VillageBambooGroves } from './world/village/VillageBambooGroves';
import { BitSocietyNPCs } from './world/village/BitSocietyNPCs';
import { VillageDebugRings } from './world/village/VillageDebugRings';
import { RuneCube } from './world/RuneCube';
import { WobblyObsidian } from './world/WobblyObsidian';
import { Html } from '@react-three/drei';
import { DigitalGrass, LodgeFloor, WeatherParticles } from './world/components/EnvironmentSystem';
import { ColumnSet, WireframeTorii, LanternField, Altar, BreathingPulse, GrowthRings, UpgradeAura } from './world/components/HubArchitecture';
export type { WorldVFXEvent };
import { EchoThoughts, MilestoneEffect, TownSquareThoughts, ConstellationStories, CommandVFX, WorldVFXEvent } from './world/components/ThoughtEffects';
import { ChamberDecor, ChamberEvolution, AchievementMonuments, FloatingIslands, TidePools, WorldRuins, FurnitureRenderer, NamePlateRenderer } from './world/components/WorldProps';
import { AmbientCreatures, ThoughtCreatures, EchoSelves, WanderingThoughts, EnhancedWildlife, NPCWanderers, LoreTerminals } from './world/components/CreaturesAndNPCs';
import { PlayerNavHalo, PlayerTrail, BottleMessages, FutureLetterMonoliths, GhostTrails, FireworksBurst } from './world/components/PlayerEffects';
import { useCitadelStore as useNotebookStore } from '@/core/state/citadelStore';
import { getNumericId } from './hooks/useCitadelState';
import { OpenYearGlassPyramid, SealedYearArchivePyramid } from './world/GlassPyramid';
import { FractalChamberAtmosphere, getChamberAesthetic } from './world/FractalChamberEnvironments';
import {
  getYearChamberId,
  getSeasonChamberId,
  getMonthChamberId,
  isCalendarYearId,
  isCalendarSeasonId,
  isCalendarMonthId,
  countMonthJournalMetrics,
  getPeriodWritability,
} from './fractalCalendarModel';

const PORTAL_X = 11;

// TODAY portal anchor. Deliberately placed off the Sigma axis ((0,*,-32)) in
// the left-forward quadrant so it reads as a distinct landmark from spawn
// (0,2,12) rather than visually merging with Sigma's glow column.
const TODAY_PORTAL_POS: [number, number, number] = [-14, 2.4, -10];


export interface RebuiltWorldProps {
  chamber: Chamber;
  chambers: Record<number, Chamber>;
  onEnterChamber: (id: number) => void;
  onOpenModal: () => void;
  onCreateBranch: () => void;
  onGoBack: () => void;
  onOpenTerminal: () => void;
  onRequestReset: () => void;
  onOpenAltar?: () => void;
  onOpenTermite?: () => void;
  onOpenNoticeBoard?: () => void;
  onNearNoticeBoard?: (near: boolean) => void;
  onOpenMapTable?: () => void;
  onNearMapTable?: (near: boolean) => void;
  onOpenLibraryPillar?: () => void;
  onNearLibraryPillar?: (near: boolean) => void;
  onOpenMoodStone?: () => void;
  onNearMoodStone?: (near: boolean) => void;
  onOpenBottlePost?: () => void;
  onNearBottlePost?: (near: boolean) => void;
  nearNoticeBoard?: boolean;
  nearMapTable?: boolean;
  nearLibrary?: boolean;
  nearMoodStone?: boolean;
  nearBottlePost?: boolean;
  // △ Triangle tap — context-aware daily ritual. Host wires this via
  // useRitualRouter (keyboard parity: KeyR in PlayerController).
  onRitual?: () => void;
  // Options — opens a ritual ledger. Optional; falls back to reset in the
  // PlayerController if unbound.
  onOpenLedger?: () => void;
  onOpenSigma?: () => void;
  onNearSigma?: (near: boolean) => void;
  onUndo?: () => void;
  onRedo?: () => void;
  playerWorldPos: React.MutableRefObject<THREE.Vector3>;
  playerYaw: React.MutableRefObject<number>;
  uiOpen: boolean;
  identity?: GridIdentity;
  vfxEvents?: WorldVFXEvent[];
  trailStyle?: string;
  fireworksActive?: boolean;
  weatherMode?: string;
  footstepsOn?: boolean;
  ghostTrailsOn?: boolean;
  photoMode?: boolean;
  onNearAltar?: (near: boolean) => void;
  onNearTermite?: (near: boolean) => void;
  onNearPortal?: (id: number | null) => void;
  onGoRoot?: () => void;
}

const safeText = (v: unknown, fb = '…') => (typeof v === 'string' && v.length > 0) ? v : fb;






// RebuiltPortal, CurvedVoidSphere, WormholePortal extracted to ./world/PortalSystems

/** [23] Weather — ambient particle system (rain/snow/pollen depending on depth) */

/** [25] Breathing world — subtle pulsing ring around the altar */

/** [28] Ambient creatures — small floating entities that drift through the space */

/** [5] Time-of-day lighting controller — adjusts fog and background color based on real clock */

/** [29] Growth rings — concentric rings on the floor showing how many thoughts exist */

/** [30] Echo thoughts — faint floating text of old thoughts drifting through the space */


/** [33] Milestone markers — celebratory effect at thought milestones */

/* ═══════════════════════════════════════════════════
   LIVING WORLD — Thought Garden
   Plants grow next to thoughts based on age
   ═══════════════════════════════════════════════════ */
// ThoughtGarden removed in CLE Phase 2 — replaced by InstancedGarden
// (world/InstancedGarden.tsx). The old per-thought `<group>` tree created
// up to 3 meshes × N thoughts draw calls; the new path batches into 2
// InstancedMeshes regardless of thought count.

/* ═══════════════════════════════════════════════════
   ChamberDecor — procedural decorative assets (bamboo, lanterns, rocks)
   that grow as the chamber accumulates thoughts
   ═══════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════
   LIVING WORLD — Chamber Evolution
   Environment transforms with thought count
   ═══════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════
   LIVING WORLD — Thought Creatures
   Mood-based creatures hatched from thoughts
   ═══════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════
   LIVING WORLD — Ambient Thought Effects
   ═══════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════
   LIVING WORLD — Echo Selves (ghost NPCs)
   Phantom figures at locations of past writings
   ═══════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════
   LIVING WORLD — Wandering Thoughts
   Random thoughts from other chambers drift through
   ═══════════════════════════════════════════════════ */


/* ═══════════════════════════════════════════════════
   LIVING WORLD — Constellation Stories
   Wormhole connections drawn as star patterns on the sky
   ═══════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════
   LIVING WORLD — Achievement Monuments
   Trophy structures for unlocked achievements
   ═══════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════
   LIVING WORLD — Upgrade Visuals
   Enhanced altar/columns based on upgrade levels
   ═══════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════
   FloatingIslands — sky platforms connected by light bridges
   ═══════════════════════════════════════════════════ */


/* ═══════════════════════════════════════════════════
   TidePool — void pools that rise and recede
   ═══════════════════════════════════════════════════ */


/* ═══════════════════════════════════════════════════
   WorldRuins — ancient monument structures (Stonehenge, obelisks, etc.)
   ═══════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════
   EnhancedWildlife — fireflies, shadow birds, geometric fish
   ═══════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════
   PlayerTrail — footprints/particles/ink that follow the player
   ═══════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════
   FurnitureRenderer — placed furniture items in the chamber
   ═══════════════════════════════════════════════════ */


/* ═══════════════════════════════════════════════════
   NamePlateRenderer — floating text signs in the chamber
   ═══════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════
   BottleMessages — glowing bottles that drift in from the void
   ═══════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════
   FutureLetterMonoliths — sealed letters that glow when revealed
   ═══════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════
   GhostTrails — enhanced echo selves that show past walking paths
   ═══════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════
   FireworksBurst — celebratory particle explosion
   ═══════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════
   NPC Wanderers — mysterious figures that roam the chamber
   ═══════════════════════════════════════════════════ */


/* ═══════════════════════════════════════════════════
   LoreTerminal — discoverable lore objects scattered in the world
   ═══════════════════════════════════════════════════ */


/* ═══════════════════════════════════════════════════
   CommandVFX — transient visual effects for terminal commands
   Each command type produces a distinct burst at the altar
   ═══════════════════════════════════════════════════ */


export default function RebuiltWorld({
  chamber,
  chambers,
  onEnterChamber,
  onOpenModal,
  onCreateBranch,
  onGoBack,
  onOpenTerminal,
  onOpenAltar,
  onRequestReset,
  onOpenTermite,
  onOpenNoticeBoard,
  onNearNoticeBoard,
  onOpenMapTable,
  onNearMapTable,
  onOpenLibraryPillar,
  onNearLibraryPillar,
  onOpenMoodStone,
  onNearMoodStone,
  onOpenBottlePost,
  onNearBottlePost,
  nearNoticeBoard,
  nearMapTable,
  nearLibrary,
  nearMoodStone,
  nearBottlePost,
  onRitual,
  onOpenLedger,
  playerWorldPos,
  playerYaw,
  uiOpen,
  identity,
  vfxEvents,
  trailStyle,
  onNearAltar,
  onNearTermite,
  onNearPortal,
  onGoRoot,
}: RebuiltWorldProps) {
  const isPupil = chamber.id === 0;
  const [nearFolderLocal, setNearFolderLocal] = useState<number | null>(null);
  const [nearTermiteLocal, setNearTermiteLocal] = useState(false);

  const globalMindMap = useNotebookStore(s => s.state.globalMindMap);
  const mindMapRootId = useMemo(() => {
    const firstNode = globalMindMap.nodes?.[0];
    return firstNode ? getNumericId(firstNode.id) : -999;
  }, [globalMindMap.nodes]);

  const mindMapChamberIds = useMemo(() => {
    return new Set((globalMindMap.nodes || []).map(n => getNumericId(n.id)));
  }, [globalMindMap.nodes]);

  const today = localDateISO();
  const currentMonthIndex = useMemo(() => new Date().getMonth(), [today]);
  const currentMonthThoughtCount = useMemo(
    () => getMonthThoughtCount(chambers, currentMonthIndex),
    [chambers, currentMonthIndex],
  );
  const activeChamberMonthIndex = useMemo(() => getMonthIndexFromChamber(chamber), [chamber]);
  const activeChamberMonthThoughtCount = useMemo(
    () => (activeChamberMonthIndex !== null ? getMonthThoughtCount(chambers, activeChamberMonthIndex) : 0),
    [chambers, activeChamberMonthIndex],
  );

  const currentYear = useMemo(() => new Date().getFullYear(), []);
  const currentYearChamberId = useMemo(() => getYearChamberId(currentYear), [currentYear]);

  const chamberAesthetic = useMemo(() => getChamberAesthetic(chamber), [chamber]);
  const isCustomFractalChamber = chamberAesthetic.category !== 'sanctuary';

  const visibleDoors = useMemo<number[]>(() => [], []);

  const portalPositions = useMemo<[number, number, number][]>(() => [], []);

  const extraPortals = useMemo<{ id: number; pos: [number, number, number] }[]>(() => [], []);

  const sourceThoughtEntries = useMemo(() => {
    const entries: Array<{ chamber: import('./types').Chamber; thought: import('./types').Thought }> = [];
    const targetIds = new Set<number>();
    
    // If in the Hub, pull from everything. 
    // Otherwise, pull from self + direct children to create the "bleed" effect.
    if (chamber.id === 0) {
      Object.values(chambers).forEach(ch => targetIds.add(ch.id));
    } else {
      targetIds.add(chamber.id);
      chamber.doors.forEach(id => { if (id !== 0) targetIds.add(id); });
    }

    targetIds.forEach(id => {
      const ch = chambers[id];
      if (!ch) return;
      ch.thoughts.forEach(thought => {
        if (!thought.derived && !thought.tags?.includes('daily-anchor')) {
          entries.push({ chamber: ch, thought });
        }
      });
    });
    return entries;
  }, [chambers, chamber.id, chamber.doors]);
  const rootHubThoughtCount = sourceThoughtEntries.length;
  const activityThoughtCount = isPupil ? rootHubThoughtCount : chamber.thoughts.length;
  const isDormantHub = isPupil && rootHubThoughtCount === 0;
  const activeLook = useWorldLook((s) => s.look);
  const isWireframe = activeLook === 'wireframe';
  // Minimal world look: a void with only the altar + interactables (no tree, no decor).
  const minimal = activeLook === 'minimal';
  const rich = !minimal;

  const thoughtPositions = useMemo(
    () => chamber.thoughts.map((_, i) => {
      const angle = (i / Math.max(chamber.thoughts.length, 1)) * Math.PI * 2;
      const baseRadius = isPupil ? 14 : 4.5;
      const radius = baseRadius + (i % 3) * 2.2;
      return [
        Math.cos(angle) * radius,
        1.6 + (i % 2) * 0.5,
        Math.sin(angle) * radius,
      ] as [number, number, number];
    }),
    [chamber.thoughts, isPupil],
  );

  const wormholePositions = useMemo(
    () => [],
    [],
  );

  // Live Hub Village performance monitor (FPS & draw calls) + keep livePlayerWorldPos synced in all looks
  const { gl } = useThree();
  const perfFrameRef = useRef(0);
  useFrame((_, delta) => {
    livePlayerWorldPos.copy(playerWorldPos.current);
    perfFrameRef.current++;
    if (perfFrameRef.current % 30 === 0) {
      const fps = Math.round(1 / Math.max(0.001, delta));
      const drawCalls = gl.info.render.calls;
      useVillageTunerStore.getState().setPerformanceMetrics(fps, drawCalls);
    }
  });

  const villageObstacles = useMemo<{ pos: [number, number, number]; scale: [number, number, number] }[]>(() => [], []);

  return (
    <>
      {rich && <PlayerNavHalo playerPos={playerWorldPos} playerYaw={playerYaw} />}
      {minimal && <MinimalPlayerLight playerPos={playerWorldPos} />}

      {/* ── 17 UNIQUE FRACTAL CALENDAR CHAMBERS (Year, 4 Seasons, 12 Months) ── */}
      {isCustomFractalChamber && (
        <FractalChamberAtmosphere chamber={chamber} playerPos={playerWorldPos} />
      )}

      {/* ── SANCTUARY HUB & DAY CHAMBER SACRED LODGE ARCHITECTURE ── */}
      {!isCustomFractalChamber && (
        <>
          {isWireframe && <LodgeFloor playerPos={playerWorldPos} />}
          {isWireframe && !isDormantHub && chamber.id === 0 && <ClassicalColumnsColonnade playerPos={playerWorldPos} />}
          <ProximityGlyph glyph="✎" position={[0, 4.5, 0]} active={nearFolderLocal === -999} playerPos={playerWorldPos} />
          <Altar active={nearFolderLocal === -999} playerPos={playerWorldPos} />
          {isWireframe && !isDormantHub && <LodgeEtchings identity={identity} playerPos={playerWorldPos} />}
          {rich && !isDormantHub && <WeatherParticles depth={chamber.depth} playerPos={playerWorldPos} streak={identity?.streak} />}
          {rich && !isDormantHub && <BreathingPulse playerPos={playerWorldPos} />}
          {rich && !isDormantHub && <AmbientCreatures playerPos={playerWorldPos} />}
        </>
      )}

      {/* QUANTUM ARBORETUM: Rendered via InstancedCodeForest in isPupil block below */}

      {/* Prominent Overhead Chamber Title Halo Ring */}
      {rich && chamber.name && (
        <group position={[0, 6.2, 0]}>
          <DigitalAlarmHaloRing text={chamber.name} radius={3.2} colorScheme="amber" />
        </group>
      )}
      {rich && <GrowthRings thoughtCount={activityThoughtCount} playerPos={playerWorldPos} />}
      {rich && chamber.depth > 0 && <EchoThoughts thoughts={chamber.thoughts} playerPos={playerWorldPos} />}
      {rich && <MilestoneEffect thoughtCount={activityThoughtCount} playerPos={playerWorldPos} />}
      {rich && <InstancedGarden thoughts={chamber.thoughts} positions={thoughtPositions} playerPos={playerWorldPos} />}
      {/* Sanctuary Mind Palace Architecture — Wireframe uses canonical village; other 15 worlds mount bespoke MindscapeArchitecture */}
      {isWireframe && isPupil && !isDormantHub && <ChamberEvolution thoughtCount={activityThoughtCount} playerPos={playerWorldPos} />}
      {isWireframe && isPupil && !isDormantHub && <ChamberDecor thoughtCount={activityThoughtCount} playerPos={playerWorldPos} chamber={chamber} />}
      {isWireframe && isPupil && !isDormantHub && <SuccessionFlora chamber={chamber} playerPos={playerWorldPos} />}
      {/* Village Bamboo Groves: Natural perimeter clusters using gold-standard AestheticBamboo */}
      {isWireframe && isPupil && !isDormantHub && <VillageBambooGroves playerPos={playerWorldPos} />}
      {/* Dispersed Overworld: Reverse gradient wild landscape fading to barren rim */}
      {isWireframe && chamber.id === 0 && <DispersedOverworld playerPos={playerWorldPos} />}
      {/* Bespoke 3D Mindscape Architecture for all 15 non-wireframe personality worlds */}
      {!isWireframe && chamber.id === 0 && (
        <MindscapeArchitecture
          playerPos={playerWorldPos}
          nearNoticeBoard={nearNoticeBoard}
          nearMapTable={nearMapTable}
          nearLibrary={nearLibrary}
          nearMoodStone={nearMoodStone}
          nearBottlePost={nearBottlePost}
        />
      )}
      {/* Bit Society NPCs: In-world citizens (1 per entry/node, typed by chamber, non-extradimensional) */}
      {rich && chamber.id === 0 && <BitSocietyNPCs playerPos={playerWorldPos} />}
      {/* Village Tuner: In-world visual collider & keep-clear debug rings */}
      {rich && chamber.id === 0 && <VillageDebugRings />}
      {rich && isPupil && !isDormantHub && (
        <group>
          {/* Subtle ambient life accentuating the stillness */}
          <AmbientLife playerPos={playerWorldPos} />
          <SigmaNPCBit key="npc-bit-guide" playerPos={playerWorldPos} seed={500} />
        </group>
      )}
      {rich && <EchoSelves thoughts={chamber.thoughts} positions={thoughtPositions} playerPos={playerWorldPos} />}
      {rich && !isPupil && <WanderingThoughts chambers={chambers} currentChamberId={chamber.id} playerPos={playerWorldPos} />}
      {rich && !isPupil && <ConstellationStories chambers={chambers} playerPos={playerWorldPos} />}
      {rich && <AchievementMonuments achievements={identity?.achievements || []} playerPos={playerWorldPos} />}
      {rich && <UpgradeAura upgrades={identity?.upgrades || {}} playerPos={playerWorldPos} />}
      {/* ── Sub-chamber world features ── */}
      {rich && !isPupil && <FloatingIslands playerPos={playerWorldPos} />}
      {rich && !isPupil && <TidePools playerPos={playerWorldPos} />}
      {rich && <GhostTrails playerPos={playerWorldPos} />}
      <PlayerTrail playerPos={playerWorldPos} style={trailStyle || identity?.avatar?.trailStyle || 'none'} />
      {rich && (chamber.furniture || []).length > 0 && (
        <FurnitureRenderer items={chamber.furniture!} playerPos={playerWorldPos} />
      )}
      {rich && (chamber.namePlates || []).length > 0 && (
        <NamePlateRenderer plates={chamber.namePlates!} playerPos={playerWorldPos} />
      )}
      {rich && (chamber.bottles || []).length > 0 && (
        <BottleMessages bottles={chamber.bottles!} playerPos={playerWorldPos} />
      )}
      {rich && (chamber.letters || []).length > 0 && (
        <FutureLetterMonoliths letters={chamber.letters!} playerPos={playerWorldPos} />
      )}
      {rich && (chamber.depth === 0 || activeChamberMonthIndex !== null) && (
        <InscriptionTree
          thoughtCount={chamber.depth === 0 ? currentMonthThoughtCount : activeChamberMonthThoughtCount}
          monthIndex={chamber.depth === 0 ? currentMonthIndex : (activeChamberMonthIndex ?? currentMonthIndex)}
          playerPos={playerWorldPos}
        />
      )}
      {isWireframe && chamber.depth === 0 && (
        <LighthouseBeacons
          chambers={chambers}
          playerPos={playerWorldPos}
        />
      )}
      {isWireframe && chamber.id === 0 && (
        <HubObjects
          nearNoticeBoard={nearNoticeBoard}
          nearMapTable={nearMapTable}
          nearLibrary={nearLibrary}
          nearMoodStone={nearMoodStone}
          nearBottlePost={nearBottlePost}
          playerPos={playerWorldPos}
          dormant={isDormantHub}
          minimal={minimal}
        />
      )}

      <TheBit playerPos={playerWorldPos} playerYaw={playerYaw} visible variant="rebuilt" avatar={resolveBitAvatar(identity?.avatar)} emitTrail={false} />
      {(vfxEvents ?? []).map(evt => (
        <CommandVFX key={evt.id} event={evt} playerPos={playerWorldPos} />
      ))}
      <PlayerController
        visibleDoors={visibleDoors}
        doorPositions={portalPositions}
        extraPortals={extraPortals}
        onNearFolder={(id) => {
          setNearFolderLocal(id);
          onNearAltar?.(id === -999);
          onNearPortal?.(id !== -999 ? id : null);
        }}
        chamber={chamber}
        obstacles={villageObstacles}
        onEnterChamber={onEnterChamber}
        onOpenModal={onOpenModal}
        onCreateBranch={onCreateBranch}
        onGoBack={onGoBack}
        onOpenTerminal={onOpenTerminal}
        onOpenAltar={onOpenAltar}
        onRequestReset={onRequestReset}
        onOpenAres={onOpenTermite}
        onNearAres={onNearTermite}
        onOpenNoticeBoard={onOpenNoticeBoard}
        onNearNoticeBoard={onNearNoticeBoard}
        onOpenMapTable={onOpenMapTable}
        onNearMapTable={onNearMapTable}
        onOpenLibraryPillar={onOpenLibraryPillar}
        onNearLibraryPillar={onNearLibraryPillar}
        onOpenMoodStone={onOpenMoodStone}
        onNearMoodStone={onNearMoodStone}
        onOpenBottlePost={onOpenBottlePost}
        onNearBottlePost={onNearBottlePost}
        onOpenTermite={onOpenTermite}
        onNearTermite={onNearTermite}
        onRitual={onRitual}
        onOpenSigma={onOpenTermite}
        onOpenLedger={onOpenLedger}
        onGoRoot={onGoRoot}
        playerWorldPos={playerWorldPos}
        playerYaw={playerYaw}
        uiOpen={uiOpen}
      />
    </>
  );
}
