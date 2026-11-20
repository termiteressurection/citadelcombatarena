import React, { useMemo } from 'react';
import {
  useVillageTunerStore,
  type NpcTypeFilter,
  type SeasonVariant,
} from '@/core/state/villageTunerStore';
import { useCitadelStore as useNotebookStore } from '@/core/state/citadelStore';
import { VILLAGE_TELEPORT_TARGETS, computeVillageColliders } from '../world/village/villageColliders';
import {
  NPC_SCALES,
  resolveSeasonVariant,
  resolveMonthVariant,
  type BitCitizenData,
} from '../world/village/BitSocietyNPCs';
import {
  type BitTempo,
  type BitSociability,
  type BitHomeRange,
  type BitMood,
  type BitQuirk,
  resolveBitTraits,
} from '../world/village/bitTraits';
import { LOAD_RADIUS, UNLOAD_RADIUS, CHUNK_SIZE } from '../world/village/DispersedOverworld';

const SIM_COUNT_STEPS = [0, 1, 5, 10, 25, 50, 100, 180, 500];

export default function VillageTunerOverlay() {
  const {
    enabled,
    simulatedNpcCount,
    typeFilter,
    collidersVisible,
    collidersEnabled,
    hedgeDensity,
    bambooDensity,
    tunerOpen,
    fps,
    drawCalls,
    densityCurve,
    playerZoneInfo,
    curvatureRadius,
    traitFilters,
    atlasGridVisible,
    loadedChunkCount,
    chunksLoadedPerTick,
    excursionProbability,
    inspectedBitTelemetry,
    setSimulatedNpcCount,
    setTypeFilter,
    setCollidersVisible,
    setCollidersEnabled,
    setHedgeDensity,
    setBambooDensity,
    setTunerOpen,
    setCurvatureRadius,
    setDensityCurve,
    resetDensityCurve,
    setEdgeModalOpen,
    setAtlasGridVisible,
    setExcursionProbability,
    triggerScatterBitsWorldWide,
    setTraitFilter,
    clearTraitFilters,
    resetVillageOverrides,
  } = useVillageTunerStore();

  const notebookStore = useNotebookStore((s) => s.state);

  // Compute real and simulated variant counts & trait tallies
  const metrics = useMemo(() => {
    let dayCount = 0;
    let hierarchicalCount = 0;
    const days = notebookStore.days || {};
    for (const d of Object.values(days)) {
      dayCount += (d.entries || []).length;
    }
    const hier = notebookStore.hierarchicalEntries || {};
    for (const entries of Object.values(hier)) {
      hierarchicalCount += (entries || []).length;
    }
    const mindmapNodesCount = (notebookStore.globalMindMap?.nodes || []).length;
    const totalRealEntries = dayCount + hierarchicalCount;

    const realCasteCounts = {
      day: dayCount,
      mindmap: mindmapNodesCount,
      month: 0,
      season: 0,
      year: 0,
    };
    for (const entries of Object.values(hier)) {
      for (const e of entries || []) {
        const caste = (e.level as any) || 'month';
        if (caste === 'year') realCasteCounts.year++;
        else if (caste === 'season') realCasteCounts.season++;
        else realCasteCounts.month++;
      }
    }

    // Build the rendered citizen list to get exact variant tallies
    const list: BitCitizenData[] = [];
    if (enabled && simulatedNpcCount !== null) {
      // 80%+ Day + Mindmap heavy distribution reflecting actual personal journal usage
      const types = [
        'day', 'mindmap', 'day', 'day', 'mindmap',
        'day', 'month', 'day', 'mindmap', 'day',
        'mindmap', 'day', 'month', 'day', 'season',
        'mindmap', 'day', 'day', 'mindmap', 'year',
      ];
      for (let i = 0; i < simulatedNpcCount; i++) {
        const caste = types[i % types.length] as any;
        const simId = `sim-${i + 1}`;
        list.push({
          id: simId,
          sourceType: 'entry',
          caste,
          seasonVariant: caste === 'season' ? (['spring', 'summer', 'autumn', 'winter'][i % 4] as SeasonVariant) : undefined,
          monthVariant: caste === 'month' ? ((i % 12) + 1) : undefined,
          referenceDateOrLabel: `SIM-${i + 1}`,
          previewText: '',
          pos: [0, 0, 0],
          isSimulated: true,
          traits: resolveBitTraits(simId, caste),
        });
      }
    } else {
      for (const [dayKey, dayCell] of Object.entries(days)) {
        for (const entry of dayCell.entries || []) {
          const caste = (entry.level as any) || 'day';
          list.push({
            id: entry.id,
            sourceType: 'entry',
            caste,
            referenceDateOrLabel: entry.day || dayKey,
            previewText: '',
            pos: [0, 0, 0],
            traits: resolveBitTraits(entry.id, caste),
          });
        }
      }
      for (const [periodKey, entries] of Object.entries(hier)) {
        for (const entry of entries || []) {
          const caste = (entry.level as any) || 'month';
          list.push({
            id: entry.id,
            sourceType: 'entry',
            caste,
            referenceDateOrLabel: periodKey,
            previewText: '',
            pos: [0, 0, 0],
            traits: resolveBitTraits(entry.id, caste),
          });
        }
      }
      for (const node of notebookStore.globalMindMap?.nodes || []) {
        list.push({
          id: node.id,
          sourceType: 'node',
          caste: 'mindmap',
          referenceDateOrLabel: node.label || 'Node',
          previewText: '',
          pos: [0, 0, 0],
          traits: resolveBitTraits(node.id, 'mindmap'),
        });
      }
    }

    const sCounts: Record<SeasonVariant, number> = { spring: 0, summer: 0, autumn: 0, winter: 0 };
    const mCounts: Record<number, number> = {};
    for (let m = 1; m <= 12; m++) mCounts[m] = 0;

    const traitTallies = {
      tempo: { Slow: 0, Steady: 0, Brisk: 0, Darting: 0 } as Record<BitTempo, number>,
      sociability: { Loner: 0, Friendly: 0, Social: 0, Greeter: 0 } as Record<BitSociability, number>,
      homeRange: { Homebody: 0, Neighbourhood: 0, Commuter: 0, Roamer: 0 } as Record<BitHomeRange, number>,
      mood: { Calm: 0, Cheerful: 0, Curious: 0, Shy: 0, Grumpy: 0 } as Record<BitMood, number>,
      quirk: { Stargazer: 0, Gardener: 0, Napper: 0, Fidgeter: 0, Dancer: 0, Collector: 0 } as Record<BitQuirk, number>,
    };

    const activeCasteCounts: Record<string, number> = {
      day: 0,
      mindmap: 0,
      month: 0,
      season: 0,
      year: 0,
    };

    list.forEach((c) => {
      activeCasteCounts[c.caste] = (activeCasteCounts[c.caste] || 0) + 1;
      if (c.caste === 'season') {
        const sv = resolveSeasonVariant(c);
        sCounts[sv] = (sCounts[sv] || 0) + 1;
      } else if (c.caste === 'month') {
        const mv = resolveMonthVariant(c);
        mCounts[mv] = (mCounts[mv] || 0) + 1;
      }

      const tr = c.traits || resolveBitTraits(c.id, c.caste);
      traitTallies.tempo[tr.tempo] = (traitTallies.tempo[tr.tempo] || 0) + 1;
      traitTallies.sociability[tr.sociability] = (traitTallies.sociability[tr.sociability] || 0) + 1;
      traitTallies.homeRange[tr.homeRange] = (traitTallies.homeRange[tr.homeRange] || 0) + 1;
      traitTallies.mood[tr.mood] = (traitTallies.mood[tr.mood] || 0) + 1;
      traitTallies.quirk[tr.quirk] = (traitTallies.quirk[tr.quirk] || 0) + 1;
    });

    return {
      totalRealEntries,
      mindmapNodesCount,
      totalRealCitizens: totalRealEntries + mindmapNodesCount,
      realCasteCounts,
      activeCasteCounts,
      seasonCounts: sCounts,
      monthCounts: mCounts,
      traitTallies,
      totalActiveRendered: list.length || (totalRealEntries + mindmapNodesCount),
    };
  }, [notebookStore, enabled, simulatedNpcCount]);

  const villageColliders = useMemo(() => computeVillageColliders(), []);

  if (!tunerOpen) return null;

  const handleTeleport = (x: number, y: number, z: number, yaw: number) => {
    if (typeof window !== 'undefined' && (window as any).__CITADEL_TELEPORT__) {
      (window as any).__CITADEL_TELEPORT__(x, y, z, yaw);
    }
  };

  return (
    <aside
      aria-label="Village Tuner Real-Time Simulator"
      data-testid="village-tuner-overlay"
      className="fixed bottom-24 right-5 z-[150] w-[460px] max-w-[94vw] max-h-[82vh] overflow-y-auto rounded-2xl border border-cyan-400/50 bg-[#090416]/95 p-5 font-mono text-purple-100 shadow-[0_0_50px_rgba(34,211,238,0.35)] backdrop-blur-xl select-none"
      style={{ animation: 'citadelFadeIn 140ms ease-out' }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-cyan-500/25 pb-3">
        <div className="flex items-center gap-2.5">
          <span className="relative flex h-2.5 w-2.5">
            <span
              className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${
                enabled ? 'animate-ping bg-cyan-400' : 'bg-purple-500'
              }`}
            />
            <span
              className={`relative inline-flex h-2.5 w-2.5 rounded-full ${
                enabled ? 'bg-cyan-400 shadow-[0_0_8px_#22d3ee]' : 'bg-purple-400'
              }`}
            />
          </span>
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-300">
              Village Tuner · Overworld Debug
            </h3>
            <p className="text-[9px] uppercase tracking-widest text-cyan-200/60">
              Living World &amp; Player Atlas (Key: V)
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setTunerOpen(false)}
          className="rounded-lg border border-purple-500/30 bg-purple-950/40 px-2 py-1 text-xs text-purple-300 hover:border-cyan-400 hover:text-cyan-200 transition-colors"
          title="Close Tuner (Key: V)"
        >
          ✕
        </button>
      </div>

      {/* 0. Live Zone & Edge Boundary Telemetry */}
      <div className="mt-3 rounded-xl border border-rose-500/30 bg-rose-950/20 p-3 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-rose-300">
            Player Zone &amp; Boundary:
          </span>
          <span className="text-[10px] font-bold text-cyan-300 px-2 py-0.5 rounded bg-cyan-950/60 border border-cyan-500/30">
            {playerZoneInfo.zoneName}
          </span>
        </div>
        <div className="flex items-center justify-between text-[10px] text-purple-300/80">
          <span>Radius: {playerZoneInfo.r.toFixed(1)} / {densityCurve.rMax}</span>
          <span>Normalized (t): {playerZoneInfo.t.toFixed(3)}</span>
        </div>
        <div className="pt-1">
          <button
            type="button"
            onClick={() => setEdgeModalOpen(true)}
            className="w-full py-1.5 px-3 rounded-lg border border-rose-500/40 bg-rose-950/50 text-[10px] font-bold text-rose-200 hover:bg-rose-900/60 hover:border-rose-300 transition-all shadow"
          >
            Preview Edge Modal: Error [null]
          </button>
        </div>
      </div>

      {/* Planetary Curvature Live Judging Tool */}
      {(() => {
        const activeR = curvatureRadius || 120.0;
        const isFlat = activeR <= 0 || activeR >= 50000;
        const dropAt90 = isFlat ? '0.0' : (activeR - Math.sqrt(Math.max(activeR * activeR - 90 * 90, 0))).toFixed(1);
        const tiltAt90Deg = isFlat ? '0.0' : (Math.asin(Math.min(90 / activeR, 1.0)) * (180 / Math.PI)).toFixed(1);

        return (
          <div className="mt-3 rounded-xl border border-amber-500/30 bg-amber-950/20 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-300">
                Planetary Curvature (Live Judging):
              </span>
              <span className="text-[10px] font-bold text-amber-300 px-2 py-0.5 rounded bg-amber-950/60 border border-amber-500/30">
                {isFlat ? 'Flat (0)' : `R = ${activeR.toFixed(0)}u`}
              </span>
            </div>
            <div className="flex items-center justify-between text-[10px] text-amber-200/80">
              <span>Drop at 90u: {dropAt90}u</span>
              <span>Normal Tilt at 90u: {tiltAt90Deg}°</span>
            </div>
            <div className="grid grid-cols-6 gap-1 pt-1">
              <button
                type="button"
                onClick={() => setCurvatureRadius(60)}
                className={`py-1 text-[9px] font-bold rounded border transition-all ${
                  activeR === 60
                    ? 'bg-amber-400 text-black border-amber-300'
                    : 'bg-black/40 text-amber-300 border-amber-500/30 hover:border-amber-400'
                }`}
              >
                Acid (60)
              </button>
              <button
                type="button"
                onClick={() => setCurvatureRadius(120)}
                className={`py-1 text-[9px] font-bold rounded border transition-all ${
                  activeR === 120
                    ? 'bg-amber-400 text-black border-amber-300'
                    : 'bg-black/40 text-amber-300 border-amber-500/30 hover:border-amber-400'
                }`}
              >
                Orig (120)
              </button>
              <button
                type="button"
                onClick={() => setCurvatureRadius(300)}
                className={`py-1 text-[9px] font-bold rounded border transition-all ${
                  activeR === 300
                    ? 'bg-amber-400 text-black border-amber-300'
                    : 'bg-black/40 text-amber-300 border-amber-500/30 hover:border-amber-400'
                }`}
              >
                300
              </button>
              <button
                type="button"
                onClick={() => setCurvatureRadius(600)}
                className={`py-1 text-[9px] font-bold rounded border transition-all ${
                  activeR === 600
                    ? 'bg-amber-400 text-black border-amber-300'
                    : 'bg-black/40 text-amber-300 border-amber-500/30 hover:border-amber-400'
                }`}
              >
                600
              </button>
              <button
                type="button"
                onClick={() => setCurvatureRadius(2000)}
                className={`py-1 text-[9px] font-bold rounded border transition-all ${
                  activeR === 2000
                    ? 'bg-amber-400 text-black border-amber-300'
                    : 'bg-black/40 text-amber-300 border-amber-500/30 hover:border-amber-400'
                }`}
              >
                Min (2k)
              </button>
              <button
                type="button"
                onClick={() => setCurvatureRadius(0)}
                className={`py-1 text-[9px] font-bold rounded border transition-all ${
                  isFlat
                    ? 'bg-amber-400 text-black border-amber-300'
                    : 'bg-black/40 text-amber-300 border-amber-500/30 hover:border-amber-400'
                }`}
              >
                Flat
              </button>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <input
                type="range"
                min="60"
                max="2000"
                step="10"
                value={isFlat ? 2000 : activeR}
                onChange={(e) => setCurvatureRadius(Number(e.target.value))}
                className="w-full accent-amber-400 cursor-pointer"
              />
            </div>
          </div>
        );
      })()}

      {/* 1. Player Atlas Continuous Chunk Streaming */}
      <div className="mt-3 rounded-xl border border-cyan-500/30 bg-cyan-950/20 p-3 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-300">
            Player Atlas (Continuous Chunks):
          </span>
          <span className="text-[10px] text-purple-300">
            Chunk: {CHUNK_SIZE}×{CHUNK_SIZE}u · Gen: {LOAD_RADIUS}u / Unload: {UNLOAD_RADIUS}u
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 text-[10px]">
          <div className="rounded bg-black/40 p-2 border border-purple-500/20">
            <span className="block text-[9px] uppercase text-purple-400">Loaded Chunks</span>
            <span className="text-sm font-bold text-cyan-300">{loadedChunkCount} active</span>
          </div>
          <div className="rounded bg-black/40 p-2 border border-purple-500/20">
            <span className="block text-[9px] uppercase text-purple-400">Streaming Budget</span>
            <span className="text-sm font-bold text-amber-300">{chunksLoadedPerTick} / tick</span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setAtlasGridVisible(!atlasGridVisible)}
          className={`w-full py-2 px-3 rounded-xl border text-[10px] font-bold flex items-center justify-between transition-all ${
            atlasGridVisible
              ? 'border-cyan-400 bg-cyan-950/80 text-cyan-200 shadow-[0_0_15px_rgba(34,211,238,0.4)]'
              : 'border-purple-500/30 bg-purple-950/40 text-purple-300 hover:border-cyan-400'
          }`}
        >
          <span>Player Atlas Grid Overlay (Chunk Outlines)</span>
          <span>{atlasGridVisible ? 'VISIBLE' : 'HIDDEN'}</span>
        </button>
      </div>

      {/* 2. Curiosity Excursions & Inspected Bit Live Telemetry */}
      <div className="mt-3 rounded-xl border border-purple-500/30 bg-purple-950/20 p-3 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-purple-300">
            Bits Free-Roam &amp; Excursions:
          </span>
          <div className="flex items-center gap-1.5 text-[10px]">
            <span className="text-purple-400">Excursion Rate:</span>
            <button
              type="button"
              onClick={() => setExcursionProbability(Math.max(0.1, excursionProbability - 0.1))}
              className="px-1.5 py-0.5 rounded bg-black/40 hover:bg-purple-900"
            >
              -
            </button>
            <span className="font-bold text-cyan-300">{Math.round(excursionProbability * 100)}%</span>
            <button
              type="button"
              onClick={() => setExcursionProbability(Math.min(0.9, excursionProbability + 0.1))}
              className="px-1.5 py-0.5 rounded bg-black/40 hover:bg-purple-900"
            >
              +
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={triggerScatterBitsWorldWide}
          className="w-full py-2 px-3 rounded-xl border border-amber-500/40 bg-amber-950/40 text-[10px] font-bold text-amber-200 hover:bg-amber-900/60 hover:border-amber-300 transition-all shadow"
        >
          ⚡ Scatter Bits World-Wide (Test All Zones Instantly)
        </button>

        {inspectedBitTelemetry && (
          <div className="mt-2 rounded-lg border border-cyan-500/25 bg-black/60 p-2 text-[10px] space-y-1">
            <div className="flex items-center justify-between font-bold text-cyan-200">
              <span>Inspected: [{inspectedBitTelemetry.caste.toUpperCase()}] {inspectedBitTelemetry.id}</span>
              <span className="text-amber-300">{inspectedBitTelemetry.state}</span>
            </div>
            <div className="text-purple-300/90 flex justify-between">
              <span>Zone: {inspectedBitTelemetry.currentZone}</span>
              <span>Speed: {inspectedBitTelemetry.speed} u/s</span>
            </div>
            <div className="text-purple-300/90 flex justify-between">
              <span>Preferred: {inspectedBitTelemetry.preferredArea}</span>
              <span>Dist from Spawn: {inspectedBitTelemetry.distFromSpawn.toFixed(1)}u</span>
            </div>
            <div className="text-cyan-400 text-[9px]">
              Target Waypoint: [{inspectedBitTelemetry.waypoint[0]}, {inspectedBitTelemetry.waypoint[1]}]
            </div>
          </div>
        )}
      </div>

      {/* 3. Population Simulator (Scale to 500) */}
      <div className="mt-4 border-t border-purple-500/20 pt-3">
        <div className="flex items-center justify-between mb-2">
          <label className="text-[11px] font-bold uppercase tracking-wider text-cyan-200">
            Citizen Population (Real or Simulated):
          </label>
          <span className="text-[10px] text-purple-300 font-semibold">
            {simulatedNpcCount !== null ? `${simulatedNpcCount} simulated` : `Real data (${metrics.totalRealCitizens})`}
          </span>
        </div>
        <div className="grid grid-cols-5 gap-1.5">
          {SIM_COUNT_STEPS.map((cnt) => {
            const isSelected = simulatedNpcCount === (cnt === 0 ? null : cnt);
            return (
              <button
                key={cnt}
                type="button"
                onClick={() => setSimulatedNpcCount(cnt === 0 ? null : cnt)}
                className={`py-1.5 rounded-lg border text-[11px] font-bold transition-all ${
                  isSelected
                    ? 'border-cyan-400 bg-cyan-950/80 text-cyan-200 shadow-[0_0_12px_rgba(34,211,238,0.4)]'
                    : 'border-purple-500/30 bg-purple-950/30 text-purple-300 hover:border-purple-400'
                }`}
              >
                {cnt === 0 ? 'REAL' : cnt}
              </button>
            );
          })}
        </div>

        {/* Real vs Active Caste Breakdown (Skewed Village Reality) */}
        <div className="mt-2.5 rounded-lg border border-purple-500/20 bg-black/40 p-2 text-[10px] space-y-1">
          <div className="flex items-center justify-between text-purple-300 font-semibold">
            <span>Real Journal Data:</span>
            <span className="text-cyan-300">
              Day: {metrics.realCasteCounts.day} · Mind: {metrics.realCasteCounts.mindmap} · Mon: {metrics.realCasteCounts.month} · Seas: {metrics.realCasteCounts.season} · Yr: {metrics.realCasteCounts.year}
            </span>
          </div>
          <div className="flex items-center justify-between text-purple-300 font-semibold">
            <span>Rendered Village:</span>
            <span className="text-cyan-300">
              Day: {metrics.activeCasteCounts.day} · Mind: {metrics.activeCasteCounts.mindmap} · Mon: {metrics.activeCasteCounts.month} · Seas: {metrics.activeCasteCounts.season} · Yr: {metrics.activeCasteCounts.year}
            </span>
          </div>
          <div className="text-[9px] text-purple-400">
            Day + Mindmap Bulk Mix: {Math.round(((metrics.activeCasteCounts.day + metrics.activeCasteCounts.mindmap) / (metrics.totalActiveRendered || 1)) * 100)}% of population
          </div>
        </div>
      </div>

      {/* 4. Density Curve Character Steppers (Town-Distance Curve) */}
      <div className="mt-4 border-t border-purple-500/20 pt-3 space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-[11px] font-bold uppercase tracking-wider text-cyan-200">
            Town-Distance Density Bands (r in [0, {densityCurve.rMax}]):
          </label>
          <button
            type="button"
            onClick={resetDensityCurve}
            className="text-[9px] text-purple-300 underline hover:text-cyan-300"
          >
            Reset Curve
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2 text-[10px]">
          <div className="flex items-center justify-between rounded bg-purple-950/30 p-1.5 border border-purple-500/20">
            <span className="text-purple-300">Town Core (r &le;):</span>
            <div className="flex items-center gap-1 font-bold text-cyan-300">
              <button
                type="button"
                onClick={() => setDensityCurve({ coreMax: Math.max(40, densityCurve.coreMax - 10) })}
                className="px-1.5 py-0.5 rounded bg-black/40 hover:bg-cyan-900/60"
              >
                -
              </button>
              <span>{densityCurve.coreMax}</span>
              <button
                type="button"
                onClick={() => setDensityCurve({ coreMax: Math.min(densityCurve.rampMax - 20, densityCurve.coreMax + 10) })}
                className="px-1.5 py-0.5 rounded bg-black/40 hover:bg-cyan-900/60"
              >
                +
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between rounded bg-purple-950/30 p-1.5 border border-purple-500/20">
            <span className="text-purple-300">Ramp Max:</span>
            <div className="flex items-center gap-1 font-bold text-cyan-300">
              <button
                type="button"
                onClick={() => setDensityCurve({ rampMax: Math.max(densityCurve.coreMax + 20, densityCurve.rampMax - 15) })}
                className="px-1.5 py-0.5 rounded bg-black/40 hover:bg-cyan-900/60"
              >
                -
              </button>
              <span>{densityCurve.rampMax}</span>
              <button
                type="button"
                onClick={() => setDensityCurve({ rampMax: Math.min(densityCurve.plateauMax - 20, densityCurve.rampMax + 15) })}
                className="px-1.5 py-0.5 rounded bg-black/40 hover:bg-cyan-900/60"
              >
                +
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between rounded bg-purple-950/30 p-1.5 border border-purple-500/20">
            <span className="text-purple-300">Plateau Max:</span>
            <div className="flex items-center gap-1 font-bold text-cyan-300">
              <button
                type="button"
                onClick={() => setDensityCurve({ plateauMax: Math.max(densityCurve.rampMax + 20, densityCurve.plateauMax - 20) })}
                className="px-1.5 py-0.5 rounded bg-black/40 hover:bg-cyan-900/60"
              >
                -
              </button>
              <span>{densityCurve.plateauMax}</span>
              <button
                type="button"
                onClick={() => setDensityCurve({ plateauMax: Math.min(densityCurve.fadeMax - 20, densityCurve.plateauMax + 20) })}
                className="px-1.5 py-0.5 rounded bg-black/40 hover:bg-cyan-900/60"
              >
                +
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between rounded bg-purple-950/30 p-1.5 border border-purple-500/20">
            <span className="text-purple-300">Fade Max (Barren &ge;):</span>
            <div className="flex items-center gap-1 font-bold text-cyan-300">
              <button
                type="button"
                onClick={() => setDensityCurve({ fadeMax: Math.max(densityCurve.plateauMax + 20, densityCurve.fadeMax - 25) })}
                className="px-1.5 py-0.5 rounded bg-black/40 hover:bg-cyan-900/60"
              >
                -
              </button>
              <span>{densityCurve.fadeMax}</span>
              <button
                type="button"
                onClick={() => setDensityCurve({ fadeMax: Math.min(densityCurve.rMax - 20, densityCurve.fadeMax + 25) })}
                className="px-1.5 py-0.5 rounded bg-black/40 hover:bg-cyan-900/60"
              >
                +
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 5. Animal Crossing Trait Filters & Tallies */}
      <div className="mt-4 border-t border-purple-500/20 pt-3 space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-[11px] font-bold uppercase tracking-wider text-cyan-200">
            Animal Crossing Trait Filters:
          </label>
          <button
            type="button"
            onClick={clearTraitFilters}
            className="text-[9px] text-purple-300 underline hover:text-cyan-300"
          >
            Clear Trait Filters
          </button>
        </div>

        {/* Tempo filter */}
        <div className="space-y-1">
          <span className="text-[10px] text-purple-300/80">Tempo (Caste Pace Multiplier):</span>
          <div className="grid grid-cols-5 gap-1 text-[9px]">
            {(['all', 'Slow', 'Steady', 'Brisk', 'Darting'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTraitFilter('tempo', t)}
                className={`py-1 rounded border ${
                  traitFilters.tempo === t
                    ? 'border-cyan-400 bg-cyan-950/80 text-cyan-200 font-bold'
                    : 'border-purple-500/25 bg-black/40 text-purple-300'
                }`}
              >
                {t} {t !== 'all' ? `(${metrics.traitTallies.tempo[t] || 0})` : ''}
              </button>
            ))}
          </div>
        </div>

        {/* Preferred Area filter */}
        <div className="space-y-1">
          <span className="text-[10px] text-purple-300/80">Preferred Area (Bias, Not Boundary):</span>
          <div className="grid grid-cols-5 gap-1 text-[9px]">
            {(['all', 'Homebody', 'Neighbourhood', 'Commuter', 'Roamer'] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setTraitFilter('homeRange', r)}
                className={`py-1 rounded border ${
                  traitFilters.homeRange === r
                    ? 'border-cyan-400 bg-cyan-950/80 text-cyan-200 font-bold'
                    : 'border-purple-500/25 bg-black/40 text-purple-300'
                }`}
              >
                {r.slice(0, 5)} {r !== 'all' ? `(${metrics.traitTallies.homeRange[r] || 0})` : ''}
              </button>
            ))}
          </div>
        </div>

        {/* Mood filter */}
        <div className="space-y-1">
          <span className="text-[10px] text-purple-300/80">Mood:</span>
          <div className="grid grid-cols-6 gap-1 text-[9px]">
            {(['all', 'Calm', 'Cheerful', 'Curious', 'Shy', 'Grumpy'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setTraitFilter('mood', m)}
                className={`py-1 rounded border ${
                  traitFilters.mood === m
                    ? 'border-cyan-400 bg-cyan-950/80 text-cyan-200 font-bold'
                    : 'border-purple-500/25 bg-black/40 text-purple-300'
                }`}
              >
                {m} {m !== 'all' ? `(${metrics.traitTallies.mood[m] || 0})` : ''}
              </button>
            ))}
          </div>
        </div>

        {/* Quirk filter */}
        <div className="space-y-1">
          <span className="text-[10px] text-purple-300/80">Idle Quirk:</span>
          <div className="grid grid-cols-7 gap-1 text-[8px]">
            {(['all', 'Stargazer', 'Gardener', 'Napper', 'Fidgeter', 'Dancer', 'Collector'] as const).map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => setTraitFilter('quirk', q)}
                className={`py-1 rounded border truncate ${
                  traitFilters.quirk === q
                    ? 'border-cyan-400 bg-cyan-950/80 text-cyan-200 font-bold'
                    : 'border-purple-500/25 bg-black/40 text-purple-300'
                }`}
                title={q}
              >
                {q.slice(0, 4)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 6. Physical Architecture & Collider Toggles */}
      <div className="mt-4 border-t border-purple-500/20 pt-3">
        <label className="block text-[11px] font-bold uppercase tracking-wider text-cyan-200 mb-2">
          Architecture &amp; Colliders ({villageColliders.length} in Core):
        </label>
        <div className="grid grid-cols-2 gap-2 text-[10px]">
          <button
            type="button"
            onClick={() => setCollidersEnabled(!collidersEnabled)}
            className={`py-2 px-3 rounded-xl border flex items-center justify-between transition-all ${
              collidersEnabled
                ? 'border-emerald-500/50 bg-emerald-950/40 text-emerald-200'
                : 'border-amber-500/50 bg-amber-950/40 text-amber-200'
            }`}
          >
            <span>Physical Collisions</span>
            <span className="font-bold">{collidersEnabled ? 'SOLID' : 'PASS-THRU'}</span>
          </button>

          <button
            type="button"
            onClick={() => setCollidersVisible(!collidersVisible)}
            className={`py-2 px-3 rounded-xl border flex items-center justify-between transition-all ${
              collidersVisible
                ? 'border-cyan-400 bg-cyan-950/60 text-cyan-200 font-bold'
                : 'border-purple-500/30 bg-purple-950/30 text-purple-300'
            }`}
          >
            <span>Debug Colliders</span>
            <span>{collidersVisible ? 'SHOWN' : 'HIDDEN'}</span>
          </button>
        </div>
      </div>

      {/* 7. Teleport Hotspots */}
      <div className="mt-4 border-t border-purple-500/20 pt-3">
        <label className="block text-[11px] font-bold uppercase tracking-wider text-cyan-200 mb-2">
          Teleport to Landmarks (Walkable Ground):
        </label>
        <div className="grid grid-cols-2 gap-1.5 text-[10px]">
          {VILLAGE_TELEPORT_TARGETS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => handleTeleport(t.pos[0], t.pos[1], t.pos[2], t.yaw)}
              className="py-1 px-2 rounded border border-cyan-500/30 bg-cyan-950/30 text-cyan-200 hover:border-cyan-400 hover:bg-cyan-900/50 transition-all text-left truncate"
              title={`Teleport to ${t.name}`}
            >
              → {t.name}
            </button>
          ))}
        </div>
      </div>

      {/* Footer: Restore Reality Button */}
      <div className="mt-5 border-t border-cyan-500/30 pt-3 flex gap-2">
        <button
          type="button"
          onClick={() => {
            resetVillageOverrides();
            setTunerOpen(false);
          }}
          className="flex-1 py-2 rounded-xl border border-cyan-400 bg-cyan-950/60 text-xs font-bold text-cyan-200 hover:bg-cyan-900/80 transition-colors uppercase tracking-wider"
        >
          Restore Reality / Clear Overrides
        </button>
      </div>
    </aside>
  );
}
