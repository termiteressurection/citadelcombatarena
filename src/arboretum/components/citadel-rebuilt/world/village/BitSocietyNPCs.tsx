import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import SpriteText from '../../../three/SpriteText';
import { applyGlobeCurvature } from '../../RebuiltWorldShared';
import { useCitadelStore as useNotebookStore } from '@/core/state/citadelStore';
import {
  useVillageTunerStore,
  type SeasonVariant,
  getZoneName,
} from '@/core/state/villageTunerStore';
import { isInKeepClearZone } from './villageColliders';
import {
  resolveBitTraits,
  type BitTraits,
  CASTE_PREFERRED_GATHERING,
} from './bitTraits';
import {
  createYearGeometries,
  createSeasonGeometries,
  createMonthGeometries,
  createDayGeometries,
  createMindmapGeometries,
} from './villageGeometryCache';
import {
  YEAR_BASE_MAT,
  YEAR_FACET_MAT,
  YEAR_WIREFRAME_MAT,
  YEAR_RIVET_MAT,
  SEASON_MATERIALS,
  MONTH_BASE_MAT,
  MONTH_SEAMS_BRACKETS_MAT,
  MONTH_ACCENT_MATERIALS,
  DAY_ROCK_MAT,
  DAY_CREVICE_MAT,
  DAY_EMBER_CORE_MAT,
  DAY_VARIANT_MATS,
  MINDMAP_BASE_MAT,
  MINDMAP_EDGE_MAT,
  MINDMAP_GLINT_MAT,
  MINDMAP_VARIANT_MATS,
} from './villageMaterialCache';

interface WithPlayer {
  playerPos: React.MutableRefObject<THREE.Vector3>;
}

export type NpcCaste = 'year' | 'season' | 'month' | 'day' | 'mindmap';

export const CASTE_TURN_RATES: Record<NpcCaste, number> = {
  day: 2.2,     // slowest, deliberate heavy rock turning
  year: 2.8,    // stately noble
  month: 3.5,   // steady artisan
  season: 3.8,  // brisk district guardian
  mindmap: 5.0, // smoothest, fluid contemplation
};

export interface BitCitizenData {
  id: string;
  sourceType: 'entry' | 'node';
  caste: NpcCaste;
  referenceDateOrLabel: string;
  previewText: string;
  pos: [number, number, number];
  isSimulated?: boolean;
  seasonVariant?: SeasonVariant;
  monthVariant?: number; // 1 to 12
  traits?: BitTraits;
}

export const CITADEL_FLOAT_Y = 2.4;

export const NPC_SCALES: Record<NpcCaste, number> = {
  day: 0.88,
  month: 0.94,
  mindmap: 0.95,
  season: 1.01,
  year: 1.08,
};

export const TERMITESSE_RUNES = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export function generateTermitesseRunicString(seedStr: string, length = 4): string {
  let hash = 0;
  for (let i = 0; i < seedStr.length; i++) {
    hash = (hash * 31 + seedStr.charCodeAt(i)) & 0xffffffff;
  }
  let res = '';
  for (let i = 0; i < length; i++) {
    const idx = Math.abs((hash + i * 17) % TERMITESSE_RUNES.length);
    res += TERMITESSE_RUNES[idx];
  }
  return res;
}

// ─── RESOLVERS FOR VARIANTS ──────────────────────────────────────────────────

export function resolveSeasonVariant(data: BitCitizenData): SeasonVariant {
  if (data.seasonVariant) return data.seasonVariant;
  const str = data.referenceDateOrLabel.toLowerCase();
  if (str.includes('spring') || str.includes('-03') || str.includes('-04') || str.includes('-05')) return 'spring';
  if (str.includes('summer') || str.includes('-06') || str.includes('-07') || str.includes('-08')) return 'summer';
  if (str.includes('autumn') || str.includes('fall') || str.includes('-09') || str.includes('-10') || str.includes('-11')) return 'autumn';
  if (str.includes('winter') || str.includes('-12') || str.includes('-01') || str.includes('-02')) return 'winter';

  const hash = Math.abs(data.id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0));
  const variants: SeasonVariant[] = ['spring', 'summer', 'autumn', 'winter'];
  return variants[hash % 4];
}

export function resolveMonthVariant(data: BitCitizenData): number {
  if (data.monthVariant && data.monthVariant >= 1 && data.monthVariant <= 12) return data.monthVariant;
  const match = data.referenceDateOrLabel.match(/-(\d{2})/);
  if (match) {
    const m = parseInt(match[1], 10);
    if (m >= 1 && m <= 12) return m;
  }
  const hash = Math.abs(data.id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0));
  return (hash % 12) + 1;
}

// ─── LIVING ROAMING STATE STRUCTURE ──────────────────────────────────────────

export interface WaypointStep {
  x: number;
  z: number;
  poiName?: string;
}

export interface CitizenLiveAgent {
  data: BitCitizenData;
  traits: BitTraits;
  x: number;
  z: number;
  spawnX: number;
  spawnZ: number;
  targetX: number;
  targetZ: number;
  heading: number;
  turnRate: number;
  phaseOffset: number;
  pitch: number;
  extraY: number;
  speed: number;
  state: 'roaming' | 'interacting' | 'gathering' | 'quirk' | 'cooldown';
  roamMode: 'preferred' | 'excursion';
  excursionWaypoints: WaypointStep[];
  excursionIndex: number;
  waypointsCompleted: number;
  curiosityThreshold: number;
  interactTimer: number;
  quirkTimer: number;
  speechText: string | null;
  speechTimer: number;
  greetingCooldown: number;
}

// ─── COMPONENT IMPLEMENTATION ───────────────────────────────────────────────

export function BitSocietyNPCs({ playerPos }: WithPlayer) {
  const notebookStore = useNotebookStore((s) => s.state);
  const debugEnabled = useVillageTunerStore((state) => state.enabled);
  const simulatedNpcCount = useVillageTunerStore((state) => state.simulatedNpcCount);
  const typeFilter = useVillageTunerStore((state) => state.typeFilter);
  const traitFilters = useVillageTunerStore((state) => state.traitFilters);
  const inspectedNpcId = useVillageTunerStore((state) => state.inspectedNpcId);
  const densityCurve = useVillageTunerStore((state) => state.densityCurve);
  const excursionProbability = useVillageTunerStore((state) => state.excursionProbability);
  const scatterBitsTrigger = useVillageTunerStore((state) => state.scatterBitsTrigger);
  const setInspectedBitTelemetry = useVillageTunerStore((state) => state.setInspectedBitTelemetry);

  // Pre-cached static geometries (instantiated once)
  const yearGeoms = useMemo(() => createYearGeometries(), []);
  const seasonGeoms = useMemo(() => createSeasonGeometries(), []);
  const monthGeoms = useMemo(() => createMonthGeometries(), []);
  const dayGeoms = useMemo(() => createDayGeometries(), []);
  const mindmapGeoms = useMemo(() => createMindmapGeometries(), []);

  // 1. Harvest real entries from canonical store
  const realCitizens = useMemo(() => {
    const list: BitCitizenData[] = [];

    const days = notebookStore.days || {};
    for (const [dayKey, dayCell] of Object.entries(days)) {
      for (const entry of dayCell.entries || []) {
        const caste: NpcCaste = (entry.level as NpcCaste) || 'day';
        list.push({
          id: entry.id,
          sourceType: 'entry',
          caste,
          referenceDateOrLabel: entry.day || dayKey,
          previewText: (entry.text || '').slice(0, 75) + '…',
          pos: [0, 0, 0],
          traits: resolveBitTraits(entry.id, caste),
        });
      }
    }

    const hierarchical = notebookStore.hierarchicalEntries || {};
    for (const [periodKey, entries] of Object.entries(hierarchical)) {
      for (const entry of entries || []) {
        const caste: NpcCaste = (entry.level as NpcCaste) || 'month';
        list.push({
          id: entry.id,
          sourceType: 'entry',
          caste,
          referenceDateOrLabel: periodKey,
          previewText: (entry.text || '').slice(0, 75) + '…',
          pos: [0, 0, 0],
          seasonVariant: caste === 'season' ? resolveSeasonVariant({ ...entry, id: entry.id, sourceType: 'entry', caste: 'season', referenceDateOrLabel: periodKey, previewText: '', pos: [0, 0, 0] }) : undefined,
          monthVariant: caste === 'month' ? resolveMonthVariant({ ...entry, id: entry.id, sourceType: 'entry', caste: 'month', referenceDateOrLabel: periodKey, previewText: '', pos: [0, 0, 0] }) : undefined,
          traits: resolveBitTraits(entry.id, caste),
        });
      }
    }

    const nodes = notebookStore.globalMindMap?.nodes || [];
    for (const node of nodes) {
      list.push({
        id: node.id,
        sourceType: 'node',
        caste: 'mindmap',
        referenceDateOrLabel: node.label || 'Mind Cell',
        previewText: node.label || 'Mindmap Thought Node',
        pos: [0, 0, 0],
        traits: resolveBitTraits(node.id, 'mindmap'),
      });
    }

    list.forEach((c, idx) => {
      const angle = (idx * 2.39996) % (Math.PI * 2);
      const pref = CASTE_PREFERRED_GATHERING[c.caste];
      const r = pref.minR + ((idx * 7) % (pref.maxR - pref.minR));

      let x = Math.cos(angle) * r;
      let z = Math.sin(angle) * r;
      if (isInKeepClearZone(x, z, 2.0)) {
        x += 6 * Math.cos(angle);
        z += 6 * Math.sin(angle);
      }
      c.pos = [x, 0, z];
    });

    return list;
  }, [notebookStore]);

  // 2. Generate simulated citizens if Tuner simulation is active + Apply Filters
  const citizensToRender = useMemo(() => {
    let sourceList = realCitizens;

    if (debugEnabled && simulatedNpcCount !== null) {
      const simList: BitCitizenData[] = [];
      const seasonVariants: SeasonVariant[] = ['spring', 'summer', 'autumn', 'winter'];
      // 80%+ Day + Mindmap heavy distribution reflecting actual personal journal usage
      const types: NpcCaste[] = [
        'day', 'mindmap', 'day', 'day', 'mindmap',
        'day', 'month', 'day', 'mindmap', 'day',
        'mindmap', 'day', 'month', 'day', 'season',
        'mindmap', 'day', 'day', 'mindmap', 'year',
      ];

      for (let i = 0; i < simulatedNpcCount; i++) {
        const caste = types[i % types.length];
        const sVariant = seasonVariants[i % 4];
        const mVariant = (i % 12) + 1;
        const simId = `sim-${i + 1}`;

        const angle = (i * 2.39996) % (Math.PI * 2);
        const pref = CASTE_PREFERRED_GATHERING[caste];
        const r = pref.minR + ((i * 5) % (pref.maxR - pref.minR));

        let x = Math.cos(angle) * r;
        let z = Math.sin(angle) * r;
        if (isInKeepClearZone(x, z, 2.0)) {
          x += 6 * Math.cos(angle);
          z += 6 * Math.sin(angle);
        }

        simList.push({
          id: simId,
          sourceType: 'entry',
          caste,
          seasonVariant: caste === 'season' ? sVariant : undefined,
          monthVariant: caste === 'month' ? mVariant : undefined,
          referenceDateOrLabel:
            caste === 'month' ? `2026-${String(mVariant).padStart(2, '0')}` :
            caste === 'season' ? `2026-${sVariant.toUpperCase()}` :
            `SIM-${i + 1}`,
          previewText: `[SIMULATED] Entry payload #${i + 1}`,
          pos: [x, 0, z],
          isSimulated: true,
          traits: resolveBitTraits(simId, caste),
        });
      }
      sourceList = simList;
    }

    // Apply Caste / Variant Filter
    let filteredList = sourceList;
    if (typeFilter !== 'all') {
      if (typeFilter.startsWith('season-')) {
        const v = typeFilter.replace('season-', '') as SeasonVariant;
        filteredList = filteredList.filter((c) => c.caste === 'season' && resolveSeasonVariant(c) === v);
      } else if (typeFilter.startsWith('month-')) {
        const m = parseInt(typeFilter.replace('month-', ''), 10);
        filteredList = filteredList.filter((c) => c.caste === 'month' && resolveMonthVariant(c) === m);
      } else {
        filteredList = filteredList.filter((c) => c.caste === typeFilter);
      }
    }

    // Apply Trait Filters
    if (traitFilters.tempo !== 'all') {
      filteredList = filteredList.filter((c) => (c.traits || resolveBitTraits(c.id, c.caste)).tempo === traitFilters.tempo);
    }
    if (traitFilters.sociability !== 'all') {
      filteredList = filteredList.filter((c) => (c.traits || resolveBitTraits(c.id, c.caste)).sociability === traitFilters.sociability);
    }
    if (traitFilters.homeRange !== 'all') {
      filteredList = filteredList.filter((c) => (c.traits || resolveBitTraits(c.id, c.caste)).homeRange === traitFilters.homeRange);
    }
    if (traitFilters.mood !== 'all') {
      filteredList = filteredList.filter((c) => (c.traits || resolveBitTraits(c.id, c.caste)).mood === traitFilters.mood);
    }
    if (traitFilters.quirk !== 'all') {
      filteredList = filteredList.filter((c) => (c.traits || resolveBitTraits(c.id, c.caste)).quirk === traitFilters.quirk);
    }

    return filteredList;
  }, [debugEnabled, simulatedNpcCount, typeFilter, traitFilters, realCitizens]);

  // 3. Autonomous Roaming & Interaction Simulation State
  const liveAgents = useRef<Map<string, CitizenLiveAgent>>(new Map());

  // Helper to plan an excursion waypoint chain
  const planExcursionChain = (fromX: number, fromZ: number, seed: number): WaypointStep[] => {
    // Pick destination anywhere walkable with r in [90, 560] (safe margin < 580, no edge modal)
    const angle = ((seed * 37) % 628) / 100;
    const destR = 90 + ((seed * 73) % 470);
    const destX = Math.cos(angle) * destR;
    const destZ = Math.sin(angle) * destR;

    const dx = destX - fromX;
    const dz = destZ - fromZ;
    const totalDist = Math.sqrt(dx * dx + dz * dz);
    const stepsCount = Math.max(2, Math.round(totalDist / 40)); // 30-45 units per step

    const chain: WaypointStep[] = [];
    for (let s = 1; s <= stepsCount; s++) {
      const frac = s / stepsCount;
      let stepX = fromX + dx * frac + (((seed + s * 13) % 15) - 7);
      let stepZ = fromZ + dz * frac + (((seed + s * 17) % 15) - 7);

      // Clamp radius inside 575 safety bound
      const stepR = Math.sqrt(stepX * stepX + stepZ * stepZ);
      if (stepR > 575) {
        stepX = (stepX / stepR) * 570;
        stepZ = (stepZ / stepR) * 570;
      }

      // Avoid keep clear zones
      if (isInKeepClearZone(stepX, stepZ, 2.5)) {
        stepX += 6 * Math.cos(frac * Math.PI * 2);
        stepZ += 6 * Math.sin(frac * Math.PI * 2);
      }

      chain.push({ x: stepX, z: stepZ });
    }

    return chain;
  };

  // Helper to pick next waypoint
  const pickNextAgentWaypoint = (a: CitizenLiveAgent) => {
    a.waypointsCompleted++;

    // Curiosity Excursion Check (~30% of time or every 2-4 waypoints)
    const shouldStartExcursion =
      a.roamMode === 'preferred' &&
      (a.waypointsCompleted >= a.curiosityThreshold || Math.random() < excursionProbability);

    if (shouldStartExcursion) {
      a.roamMode = 'excursion';
      a.excursionWaypoints = planExcursionChain(a.x, a.z, a.traits.seed + a.waypointsCompleted * 101);
      a.excursionIndex = 0;
      const firstWp = a.excursionWaypoints[0];
      a.targetX = firstWp.x;
      a.targetZ = firstWp.z;
      // Heading steers smoothly towards targetX/Z via per-frame lerp (no instant snap)
      return;
    }

    // In-progress excursion stepping
    if (a.roamMode === 'excursion') {
      a.excursionIndex++;
      if (a.excursionIndex < a.excursionWaypoints.length) {
        const nextWp = a.excursionWaypoints[a.excursionIndex];
        a.targetX = nextWp.x;
        a.targetZ = nextWp.z;
        // Smooth steering to next waypoint
        return;
      } else {
        // Excursion reached destination: wander back towards preferred area
        a.roamMode = 'preferred';
        a.waypointsCompleted = 0;
      }
    }

    // Preferred Area gathering wander (~70% of time)
    const pref = CASTE_PREFERRED_GATHERING[a.data.caste];
    const angle = ((a.x * 13 + a.z * 19 + a.traits.seed) % 628) / 100;
    const r = pref.minR + Math.abs((a.x * 7 + a.z * 11) % (pref.maxR - pref.minR));

    let wx = Math.cos(angle) * r;
    let wz = Math.sin(angle) * r;
    if (isInKeepClearZone(wx, wz, 2.5)) {
      wx += 6 * Math.cos(angle);
      wz += 6 * Math.sin(angle);
    }
    a.targetX = wx;
    a.targetZ = wz;
    // Smooth steering to new target waypoint
  };

  // Initialize or reconcile live agents map (PERSISTENT IN SESSION MEMORY)
  useEffect(() => {
    const map = liveAgents.current;
    const currentIds = new Set(citizensToRender.map((c) => c.id));

    // Remove old agents
    for (const id of map.keys()) {
      if (!currentIds.has(id)) map.delete(id);
    }

    // Add new agents (starts in preferred area with curiosity queued)
    citizensToRender.forEach((c) => {
      if (!map.has(c.id)) {
        const traits = c.traits || resolveBitTraits(c.id, c.caste);
        // Visibly faster base speeds (Year 2.0, Day 2.4 * 0.85 = 2.04, Season 3.2, Month 3.6, Mindmap 4.5)
        const speed = traits.effectiveSpeed;
        const heading = (traits.seed % 628) / 100;
        const turnRate = CASTE_TURN_RATES[c.caste];
        const phaseOffset = (traits.seed % 1000) * 0.00628;

        const agent: CitizenLiveAgent = {
          data: c,
          traits,
          x: c.pos[0],
          z: c.pos[2],
          spawnX: c.pos[0],
          spawnZ: c.pos[2],
          targetX: c.pos[0] + Math.cos(heading) * 12,
          targetZ: c.pos[2] + Math.sin(heading) * 12,
          heading,
          turnRate,
          phaseOffset,
          pitch: 0,
          extraY: 0,
          speed,
          state: 'roaming',
          roamMode: 'preferred',
          excursionWaypoints: [],
          excursionIndex: 0,
          waypointsCompleted: 1, // Ready to embark on excursion soon
          curiosityThreshold: 2 + (traits.seed % 3),
          interactTimer: 0,
          quirkTimer: 0,
          speechText: null,
          speechTimer: 0,
          greetingCooldown: 0,
        };

        map.set(c.id, agent);
      }
    });
  }, [citizensToRender]);

  // Tuner Test Action: "Scatter Bits world-wide" (Disperses bits instantly across all zones)
  const lastScatterTrigger = useRef(0);
  useEffect(() => {
    if (scatterBitsTrigger > lastScatterTrigger.current) {
      lastScatterTrigger.current = scatterBitsTrigger;
      const zones = [
        { minR: 15, maxR: 75 },   // Town Core
        { minR: 95, maxR: 215 },  // Ramp-up
        { minR: 225, maxR: 345 }, // Dense Plateau
        { minR: 355, maxR: 490 }, // Fade-out
        { minR: 505, maxR: 565 }, // Barren Rim
      ];

      let idx = 0;
      for (const agent of liveAgents.current.values()) {
        const zone = zones[idx % zones.length];
        const angle = (idx * 2.39996) % (Math.PI * 2);
        const r = zone.minR + ((idx * 17) % (zone.maxR - zone.minR));
        agent.x = Math.cos(angle) * r;
        agent.z = Math.sin(angle) * r;
        agent.targetX = Math.cos(angle + 0.4) * (r + 25);
        agent.targetZ = Math.sin(angle + 0.4) * (r + 25);
        agent.heading = Math.atan2(agent.targetZ - agent.z, agent.targetX - agent.x);
        agent.roamMode = 'excursion';
        idx++;
      }
    }
  }, [scatterBitsTrigger]);

  // Expose Space-Key Interaction Trigger to window
  useEffect(() => {
    if (typeof window === 'undefined') return;
    (window as any).__CITADEL_TOGGLE_INSPECT_NPC__ = () => {
      const pp = playerPos.current;
      let nearestId: string | null = null;
      let minDist = 3.5; // 3.5 units interaction range

      for (const agent of liveAgents.current.values()) {
        const dx = agent.x - pp.x;
        const dz = agent.z - pp.z;
        const d = Math.sqrt(dx * dx + dz * dz);
        if (d < minDist) {
          minDist = d;
          nearestId = agent.data.id;
        }
      }

      if (nearestId) {
        useVillageTunerStore.getState().toggleInspectNpc(nearestId);
        return true;
      }
      return false;
    };

    return () => {
      delete (window as any).__CITADEL_TOGGLE_INSPECT_NPC__;
    };
  }, [playerPos]);

  // Simulation Tick (Runs at 15Hz for ALL agents, fully separated from render cull)
  const tickAcc = useRef(0);
  const meshGroupRefs = useRef<Map<string, THREE.Group>>(new Map());

  useFrame(({ clock }, delta) => {
    tickAcc.current += delta;
    const shouldTickPhysics = tickAcc.current >= 0.066;
    if (shouldTickPhysics) tickAcc.current = 0;

    const pp = playerPos.current;
    const t = clock.elapsedTime;
    const agents = Array.from(liveAgents.current.values());

    // 1. MOVEMENT & HEADING LERP: Runs continuously on EVERY frame delta (smooth 60fps)
    for (let i = 0; i < agents.length; i++) {
      const a = agents[i];

      // Update Speech Timer & Greeting Cooldown
      if (a.speechTimer > 0) {
        a.speechTimer -= delta;
        if (a.speechTimer <= 0) a.speechText = null;
      }
      if (a.greetingCooldown > 0) {
        a.greetingCooldown -= delta;
      }

      // Proximity to Player: Greeting or Shy Avoidance
      const distToPlayer = Math.hypot(a.x - pp.x, a.z - pp.z);
      if (distToPlayer <= 3.5) {
        if (a.traits.sociability === 'Greeter' || a.traits.mood === 'Cheerful') {
          if (a.state === 'roaming' && a.greetingCooldown <= 0) {
            a.heading = Math.atan2(pp.z - a.z, pp.x - a.x);
            a.speechText = generateTermitesseRunicString(a.data.id + ':hi', 3);
            a.speechTimer = 2.0;
            a.greetingCooldown = 12.0;
          }
        } else if (a.traits.mood === 'Shy' && a.state === 'roaming') {
          const awayAngle = Math.atan2(a.z - pp.z, a.x - pp.x);
          a.heading = awayAngle;
          a.targetX = a.x + Math.cos(awayAngle) * 8;
          a.targetZ = a.z + Math.sin(awayAngle) * 8;
        }
      }

      // Smooth Frame-by-Frame Movement (Continuous traversal, no 66ms steps)
      if (a.state === 'roaming' || a.state === 'cooldown') {
        const dxT = a.targetX - a.x;
        const dzT = a.targetZ - a.z;
        const distT = Math.sqrt(dxT * dxT + dzT * dzT);

        if (distT < 1.0) {
          // Arrived at waypoint: enter short Quirk pause
          if (a.state === 'roaming') {
            a.state = 'quirk';
            a.quirkTimer = 1.6 + (a.traits.seed % 10) * 0.08;
          } else {
            pickNextAgentWaypoint(a);
          }
        } else {
          // Smooth heading turn towards target (capped turn rate, no instant snapping)
          const desiredHeading = Math.atan2(dzT, dxT);
          let diff = (desiredHeading - a.heading) % (Math.PI * 2);
          if (diff > Math.PI) diff -= Math.PI * 2;
          if (diff < -Math.PI) diff += Math.PI * 2;
          const maxTurn = a.turnRate * delta;
          if (Math.abs(diff) <= maxTurn) {
            a.heading = desiredHeading;
          } else {
            a.heading += Math.sign(diff) * maxTurn;
          }

          // Gentle speed easing approaching waypoint
          const easeFactor = distT < 3.0 ? Math.max(0.35, distT / 3.0) : 1.0;
          const step = a.speed * easeFactor * delta;
          a.x += Math.cos(a.heading) * step;
          a.z += Math.sin(a.heading) * step;
        }
      }

      // Continuous harmonic bobbing (seeded phase, independent of stepped position)
      const bob = Math.sin(t * 1.8 + a.phaseOffset) * 0.05 + a.extraY;

      // 3D Object Transform & RENDER CULLING ONLY (Simulation never stops)
      const grp = meshGroupRefs.current.get(a.data.id);
      if (grp) {
        if (distToPlayer < 110) {
          grp.visible = true;
          applyGlobeCurvature(grp, a.x, CITADEL_FLOAT_Y + bob, a.z, pp);
          grp.rotation.y = a.heading;
          grp.rotation.x = a.pitch;
        } else {
          grp.visible = false;
        }
      }
    }

    // 2. LOGIC TICK: Runs at 15Hz (spatial binning, collision, pair interaction, quirks)
    if (shouldTickPhysics) {
      // Spatial Binning (cell size: 4.0 units) for anti-stacking and world-wide gatherings
      const grid = new Map<string, CitizenLiveAgent[]>();
      for (const a of agents) {
        const cellX = Math.floor(a.x / 4.0);
        const cellZ = Math.floor(a.z / 4.0);
        const key = `${cellX},${cellZ}`;
        let bucket = grid.get(key);
        if (!bucket) {
          bucket = [];
          grid.set(key, bucket);
        }
        bucket.push(a);
      }

      for (let i = 0; i < agents.length; i++) {
        const a = agents[i];

        // State A: Interacting / Gathering
        if (a.state === 'interacting' || a.state === 'gathering') {
          a.interactTimer -= 0.066;
          if (a.interactTimer <= 0) {
            a.state = 'cooldown';
            a.interactTimer = 8.0;
            a.heading += Math.PI * 0.75 + (a.traits.seed % 10) * 0.1;
            a.targetX = a.x + Math.cos(a.heading) * 14;
            a.targetZ = a.z + Math.sin(a.heading) * 14;
          }
        } else if (a.state === 'cooldown') {
          a.interactTimer -= 0.066;
          if (a.interactTimer <= 0) a.state = 'roaming';
        } else if (a.state === 'quirk') {
          // State B: Idle Quirk Execution (Short, interruptible pause)
          a.quirkTimer -= 0.066;
          if (a.traits.quirk === 'Stargazer') {
            a.pitch = -0.35;
          } else if (a.traits.quirk === 'Gardener') {
            a.pitch = 0.25;
            a.extraY = -0.22;
          } else if (a.traits.quirk === 'Napper') {
            a.extraY = -0.3;
            a.pitch = 0.1;
          } else if (a.traits.quirk === 'Fidgeter') {
            a.heading += Math.sin(t * 14) * 0.12;
          } else if (a.traits.quirk === 'Dancer') {
            a.heading += 0.12; // Gentle reduced-motion spin
          } else if (a.traits.quirk === 'Collector') {
            a.extraY = -0.15;
            a.heading += 0.08;
          }

          if (a.quirkTimer <= 0) {
            a.pitch = 0;
            a.extraY = 0;
            a.state = 'roaming';
            pickNextAgentWaypoint(a);
          }
        }

        // Keep within safety margin r < 575 (never trigger edge modal)
        const currentR = Math.hypot(a.x, a.z);
        if (currentR >= 575) {
          a.x = (a.x / currentR) * 570;
          a.z = (a.z / currentR) * 570;
          const inward = Math.atan2(-a.z, -a.x);
          a.targetX = a.x + Math.cos(inward) * 30;
          a.targetZ = a.z + Math.sin(inward) * 30;
        }

        // Keep-clear barrier repulsion
        if (isInKeepClearZone(a.x, a.z, 2.2)) {
          const rad = Math.atan2(a.z, a.x);
          a.x += Math.cos(rad) * 1.5;
          a.z += Math.sin(rad) * 1.5;
          a.targetX = a.x + Math.cos(rad) * 12;
          a.targetZ = a.z + Math.sin(rad) * 12;
        }

        // Spatial grid checks (Anti-stacking, Pair interaction, & 3-Bit Gatherings)
        if (a.state === 'roaming') {
          const cellX = Math.floor(a.x / 4.0);
          const cellZ = Math.floor(a.z / 4.0);

          for (let ox = -1; ox <= 1; ox++) {
            for (let oz = -1; oz <= 1; oz++) {
              const neighborKey = `${cellX + ox},${cellZ + oz}`;
              const neighbors = grid.get(neighborKey);
              if (!neighbors) continue;

              for (const b of neighbors) {
                if (b === a) continue;
                const ndx = b.x - a.x;
                const ndz = b.z - a.z;
                const nd = Math.sqrt(ndx * ndx + ndz * ndz);

                // 1. Anti-Stacking Repulsion
                if (nd < 1.8 && nd > 0.001) {
                  const push = (1.8 - nd) * 0.5;
                  a.x -= (ndx / nd) * push;
                  a.z -= (ndz / nd) * push;
                }

                // 2. Pair Interaction Trigger
                if (nd >= 1.8 && nd <= 2.6) {
                  if (b.state === 'roaming') {
                    a.state = 'interacting';
                    b.state = 'interacting';
                    a.interactTimer = 3.2;
                    b.interactTimer = 3.2;

                    a.heading = Math.atan2(ndz, ndx);
                    b.heading = Math.atan2(-ndz, -ndx);

                    const runeText = generateTermitesseRunicString(a.data.id + b.data.id, 4);
                    a.speechText = runeText;
                    a.speechTimer = 2.6;
                  } else if (b.state === 'interacting') {
                    // 3. Gathering of up to 3 Bits anywhere in the overworld
                    if (a.traits.sociability === 'Social' || a.traits.sociability === 'Greeter') {
                      a.state = 'gathering';
                      a.interactTimer = 3.2;
                      a.heading = Math.atan2(b.z - a.z, b.x - a.x);
                      a.speechText = generateTermitesseRunicString(a.data.id + ':trio', 4);
                      a.speechTimer = 2.6;
                    }
                  }
                }
              }
            }
          }
        }

        // Update Inspected Telemetry if currently inspected
        if (inspectedNpcId === a.data.id) {
          const curR = Math.hypot(a.x, a.z);
          const distFromSpawn = Math.hypot(a.x - a.spawnX, a.z - a.spawnZ);
          setInspectedBitTelemetry({
            id: a.data.id,
            caste: a.data.caste,
            preferredArea: a.traits.preferredArea,
            currentZone: getZoneName(curR, densityCurve),
            distFromSpawn,
            state:
              a.state === 'gathering' ? 'Gathering' :
              a.state === 'quirk' ? 'Quirk' :
              a.roamMode === 'excursion' ? 'Curious Excursion' :
              distFromSpawn > 20 ? 'Travelling' : 'Preferred',
            waypoint: [Math.round(a.targetX), Math.round(a.targetZ)],
            speed: Math.round(a.speed * 100) / 100,
          });
        }
      }
    }
  });

  return (
    <group name="bit-society-citizens">
      {citizensToRender.map((c) => {
        const agent = liveAgents.current.get(c.id);
        const scale = NPC_SCALES[c.caste];
        const isInspected = inspectedNpcId === c.id;
        const speech = agent?.speechText;
        const traits = agent?.traits || c.traits || resolveBitTraits(c.id, c.caste);

        const sVariant = resolveSeasonVariant(c);
        const mVariant = resolveMonthVariant(c);

        return (
          <group
            key={c.id}
            ref={(el) => {
              if (el) meshGroupRefs.current.set(c.id, el);
              else meshGroupRefs.current.delete(c.id);
            }}
            scale={scale}
          >
            {/* 1. YEAR ARCHON (Batched, zero point-lights) */}
            {c.caste === 'year' && (
              <group>
                <mesh geometry={yearGeoms.baseGeom} material={YEAR_BASE_MAT} />
                <mesh geometry={yearGeoms.mergedFacets} material={YEAR_FACET_MAT} />
                <mesh geometry={yearGeoms.wireframeGeom} material={YEAR_WIREFRAME_MAT} />
                <mesh geometry={yearGeoms.mergedRivets} material={YEAR_RIVET_MAT} />
              </group>
            )}

            {/* 2. SEASON WARDEN (4 Distinct Variants, Batched) */}
            {c.caste === 'season' && (
              <group>
                <mesh geometry={seasonGeoms.baseGeom} material={SEASON_MATERIALS[sVariant].base} />
                <mesh geometry={seasonGeoms.mergedSpikes} material={SEASON_MATERIALS[sVariant].spike} />
                {sVariant === 'spring' && <mesh geometry={seasonGeoms.springTrim} material={SEASON_MATERIALS.spring.trim} />}
                {sVariant === 'summer' && <mesh geometry={seasonGeoms.summerTrim} material={SEASON_MATERIALS.summer.trim} />}
                {sVariant === 'autumn' && <mesh geometry={seasonGeoms.autumnTrim} material={SEASON_MATERIALS.autumn.trim} />}
                {sVariant === 'winter' && <mesh geometry={seasonGeoms.winterTrim} material={SEASON_MATERIALS.winter.trim} />}
              </group>
            )}

            {/* 3. MONTH ARTISAN (12 Distinct Calendar Variants, Batched) */}
            {c.caste === 'month' && (
              <group>
                <mesh geometry={monthGeoms.baseCubeGeom} material={MONTH_BASE_MAT} />
                <mesh geometry={monthGeoms.mergedSeamsAndBrackets} material={MONTH_SEAMS_BRACKETS_MAT} />
                <mesh geometry={monthGeoms.monthMotifs[mVariant]} material={MONTH_ACCENT_MATERIALS[mVariant]} />
              </group>
            )}

            {/* 4. DAY TOILER (6 Seeded Variants, Shared Batched Geometries & Materials) */}
            {c.caste === 'day' && (() => {
              const vIdx = (traits.variantIndex || 0) % dayGeoms.variants.length;
              const dVar = dayGeoms.variants[vIdx];
              const dMat = DAY_VARIANT_MATS[vIdx % DAY_VARIANT_MATS.length];
              return (
                <group>
                  <mesh geometry={dVar.rockGeom} material={dMat.rock} />
                  <mesh geometry={dVar.rockGeom} scale={1.008} material={dMat.crevice} />
                  <mesh geometry={dVar.mergedFlakes} material={dMat.rock} />
                  <mesh geometry={dVar.emberCoreGeom} material={dMat.emberCore} />
                </group>
              );
            })()}

            {/* 5. MINDMAP ZEN WANDERER (4 Seeded Variants, Shared Batched Geometries & Materials) */}
            {c.caste === 'mindmap' && (() => {
              const vIdx = (traits.variantIndex || 0) % mindmapGeoms.variants.length;
              const mmVar = mindmapGeoms.variants[vIdx];
              const mmMat = MINDMAP_VARIANT_MATS[vIdx % MINDMAP_VARIANT_MATS.length];
              return (
                <group>
                  <mesh geometry={mmVar.baseOctahedron} material={mmMat.base} />
                  <mesh geometry={mmVar.baseOctahedron} scale={1.008} material={mmMat.edge} />
                  <mesh geometry={mmVar.mergedGlintsAndCore} material={mmMat.glint} />
                </group>
              );
            })()}

            {/* TRANSIENT TERMITESSE SPEECH BUBBLE */}
            {speech && (
              <group position={[0, 0.95, 0]}>
                <SpriteText
                  fontSize={0.28}
                  fontFamily="'Termitesse', 'Wyattesse', monospace"
                  color="#e0e7ff"
                  outlineWidth={0.025}
                  outlineColor="#0f172a"
                >
                  {speech}
                </SpriteText>
              </group>
            )}

            {/* ON-DEMAND SPACE INSPECTION CARD (Animal Crossing Style Trait Readout) */}
            {isInspected && (
              <group position={[0, 1.45, 0]}>
                {/* Line 1: Caste & Reference Date */}
                <SpriteText
                  position={[0, 0.46, 0]}
                  fontSize={0.32}
                  color={
                    c.caste === 'year' ? '#fde047' :
                    c.caste === 'season' ? '#2dd4bf' :
                    c.caste === 'month' ? '#f59e0b' :
                    c.caste === 'day' ? '#9ca3af' : '#67e8f9'
                  }
                  outlineWidth={0.03}
                  outlineColor="#000000"
                >
                  {`[${c.caste.toUpperCase()}] ${traits.variantId} · ${c.referenceDateOrLabel} ${c.isSimulated ? '· [SIMULATED]' : ''}`}
                </SpriteText>

                {/* Line 2: Tempo, Speed, Mood, Quirk */}
                <SpriteText
                  position={[0, 0.18, 0]}
                  fontSize={0.18}
                  color="#f1f5f9"
                  outlineWidth={0.025}
                  outlineColor="#000000"
                >
                  {`Tempo: ${traits.tempo} (${traits.effectiveSpeed.toFixed(2)} u/s) · Mood: ${traits.mood} · Quirk: ${traits.quirk}`}
                </SpriteText>

                {/* Line 3: Sociability, Preferred Area (No Boundary Fence) */}
                <SpriteText
                  position={[0, -0.08, 0]}
                  fontSize={0.17}
                  color="#94a3b8"
                  outlineWidth={0.02}
                  outlineColor="#000000"
                >
                  {`Social: ${traits.sociability} · Preferred Area: ${traits.preferredArea}`}
                </SpriteText>

                {/* Line 4: Travel Status & Excursion Target */}
                <SpriteText
                  position={[0, -0.32, 0]}
                  fontSize={0.16}
                  color="#38bdf8"
                  outlineWidth={0.02}
                  outlineColor="#000000"
                >
                  {agent?.roamMode === 'excursion'
                    ? `Curious Excursion -> [${Math.round(agent.targetX)}, ${Math.round(agent.targetZ)}] (${Math.round(Math.sqrt((agent.x - agent.spawnX) ** 2 + (agent.z - agent.spawnZ) ** 2))}u from spawn)`
                    : `Gathering in ${traits.preferredArea} -> [${Math.round(agent?.targetX || 0)}, ${Math.round(agent?.targetZ || 0)}]`}
                </SpriteText>

                {/* Line 5: Preview Text */}
                <SpriteText
                  position={[0, -0.56, 0]}
                  fontSize={0.15}
                  color="#cbd5e1"
                  outlineWidth={0.02}
                  outlineColor="#000000"
                >
                  {c.previewText}
                </SpriteText>
              </group>
            )}
          </group>
        );
      })}
    </group>
  );
}
