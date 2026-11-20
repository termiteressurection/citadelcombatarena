import type React from 'react';
import { useFoliageDebugStore } from '@/core/state/foliageDebugStore';
import {
  computeAliveness,
  computeFoliageCount,
  getMonthFoliageState,
} from '../fractalCalendarModel';

interface CanopyTunerOverlayProps {
  realEntries: number;
  realActiveDays: number;
}

export default function CanopyTunerOverlay({
  realEntries,
  realActiveDays,
}: CanopyTunerOverlayProps) {
  const {
    enabled,
    overrideE,
    overrideD,
    tunerOverlayOpen,
    setOverrideE,
    setOverrideD,
    setOverrides,
    setEnabled,
    setTunerOverlayOpen,
    resetOverrides,
  } = useFoliageDebugStore();

  if (!tunerOverlayOpen) return null;

  const realA = computeAliveness(realEntries, realActiveDays);
  const realF = computeFoliageCount(realA);
  const realState = getMonthFoliageState(realA, false);

  const simE = enabled ? overrideE : realEntries;
  const simD = enabled ? overrideD : realActiveDays;
  const simA = computeAliveness(simE, simD);
  const simF = computeFoliageCount(simA);
  const simState = getMonthFoliageState(simA, false);

  return (
    <aside
      aria-label="Canopy Tuner Real-Time Simulator"
      data-testid="canopy-tuner-overlay"
      className="fixed bottom-24 right-5 z-[150] w-[380px] max-w-[92vw] rounded-2xl border border-amber-400/50 bg-[#090416]/95 p-5 font-mono text-purple-100 shadow-[0_0_50px_rgba(245,158,11,0.35)] backdrop-blur-xl select-none"
      style={{ animation: 'citadelFadeIn 140ms ease-out' }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-amber-500/25 pb-3">
        <div className="flex items-center gap-2.5">
          <span className="relative flex h-2.5 w-2.5">
            <span
              className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${
                enabled ? 'animate-ping bg-amber-400' : 'bg-purple-500'
              }`}
            />
            <span
              className={`relative inline-flex h-2.5 w-2.5 rounded-full ${
                enabled ? 'bg-amber-400 shadow-[0_0_8px_#f59e0b]' : 'bg-purple-400'
              }`}
            />
          </span>
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-amber-300">
              Canopy Tuner · Live Foliage
            </h3>
            <p className="text-[9px] uppercase tracking-widest text-amber-200/60">
              Real-Time Foliage Scrub (Key: T)
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setTunerOverlayOpen(false)}
          className="rounded-lg border border-purple-500/30 bg-purple-950/40 px-2 py-1 text-xs text-purple-300 hover:border-amber-400 hover:text-amber-200 transition-colors"
          title="Close Tuner (Key: T)"
        >
          ✕
        </button>
      </div>

      {/* Sliders Area */}
      <div className="mt-4 space-y-3.5">
        <div>
          <div className="flex items-center justify-between text-[11px] mb-1">
            <label htmlFor="canopy-tuner-slider-e" className="uppercase font-bold tracking-wider text-cyan-200">
              Entries (E)
            </label>
            <span className="font-mono font-bold text-amber-300 bg-black/60 px-2 py-0.5 rounded border border-amber-500/30">
              {simE}
            </span>
          </div>
          <input
            id="canopy-tuner-slider-e"
            type="range"
            min={0}
            max={60}
            step={1}
            value={simE}
            data-testid="tuner-slider-e"
            onChange={(e) => {
              const val = Number(e.target.value);
              setOverrideE(val);
              if (!enabled) setEnabled(true);
            }}
            className="w-full accent-amber-400 cursor-pointer"
          />
        </div>

        <div>
          <div className="flex items-center justify-between text-[11px] mb-1">
            <label htmlFor="canopy-tuner-slider-d" className="uppercase font-bold tracking-wider text-cyan-200">
              Active Ritual Days (D)
            </label>
            <span className="font-mono font-bold text-amber-300 bg-black/60 px-2 py-0.5 rounded border border-amber-500/30">
              {simD}
            </span>
          </div>
          <input
            id="canopy-tuner-slider-d"
            type="range"
            min={0}
            max={31}
            step={1}
            value={simD}
            data-testid="tuner-slider-d"
            onChange={(e) => {
              const val = Number(e.target.value);
              setOverrideD(val);
              if (!enabled) setEnabled(true);
            }}
            className="w-full accent-amber-400 cursor-pointer"
          />
        </div>
      </div>

      {/* Presets */}
      <div className="mt-3.5 flex flex-wrap gap-1.5 text-[9px] uppercase tracking-wider">
        <button
          type="button"
          onClick={() => setOverrides(0, 0)}
          className="rounded border border-purple-500/30 bg-purple-950/40 px-2 py-1 text-purple-200 hover:border-amber-400 hover:text-amber-200"
        >
          Bare (0)
        </button>
        <button
          type="button"
          onClick={() => setOverrides(3, 2)}
          className="rounded border border-purple-500/30 bg-purple-950/40 px-2 py-1 text-purple-200 hover:border-amber-400 hover:text-amber-200"
        >
          Tip Germination
        </button>
        <button
          type="button"
          onClick={() => setOverrides(12, 8)}
          className="rounded border border-purple-500/30 bg-purple-950/40 px-2 py-1 text-purple-200 hover:border-amber-400 hover:text-amber-200"
        >
          Flourishing
        </button>
        <button
          type="button"
          onClick={() => setOverrides(60, 30)}
          className="rounded border border-purple-500/30 bg-purple-950/40 px-2 py-1 text-purple-200 hover:border-amber-400 hover:text-amber-200"
        >
          Full Canopy (180)
        </button>
      </div>

      {/* Dual Column Telemetry: Reality vs Simulation */}
      <div className="mt-4 grid grid-cols-2 gap-2 text-[10px] rounded-xl border border-purple-500/25 bg-black/60 p-3">
        <div className="border-r border-purple-500/20 pr-2">
          <div className="text-[9px] uppercase tracking-widest text-purple-400 font-bold mb-1">
            Actual Reality
          </div>
          <div className="text-purple-200/80">E: <span className="text-white font-bold">{realEntries}</span> · D: <span className="text-white font-bold">{realActiveDays}</span></div>
          <div className="text-purple-200/80">Aliveness: <span className="text-white font-bold">{realA}</span></div>
          <div className="text-purple-200/80">Foliage: <span className="text-cyan-300 font-bold">{realF}/180</span></div>
          <div className="text-[9px] text-purple-400 uppercase mt-0.5">{realState}</div>
        </div>

        <div className="pl-1">
          <div className="text-[9px] uppercase tracking-widest text-amber-400 font-bold mb-1 flex items-center justify-between">
            <span>Simulation</span>
            {enabled && <span className="text-[8px] px-1 py-0.2 rounded bg-amber-500/30 text-amber-300">ACTIVE</span>}
          </div>
          <div className="text-amber-100/90">E: <span className="text-white font-bold">{simE}</span> · D: <span className="text-white font-bold">{simD}</span></div>
          <div className="text-amber-100/90">Aliveness: <span className="text-white font-bold">{simA}</span></div>
          <div className="text-amber-100/90">Foliage: <span className="text-amber-300 font-bold">{simF}/180</span></div>
          <div className="text-[9px] text-amber-300 uppercase mt-0.5 font-bold">{simState}</div>
        </div>
      </div>

      {/* Footer Controls */}
      <div className="mt-4 flex items-center justify-between gap-2 pt-2 border-t border-purple-500/20">
        <button
          type="button"
          onClick={() => {
            resetOverrides();
            setOverrides(realEntries, realActiveDays);
          }}
          data-testid="tuner-restore-btn"
          className="flex-1 py-1.5 px-2.5 rounded-lg border border-purple-400/40 bg-purple-950/40 text-[10px] uppercase font-bold tracking-wider text-purple-200 hover:border-cyan-400 hover:text-cyan-200 transition-colors"
        >
          Restore Real
        </button>
        <button
          type="button"
          onClick={() => resetOverrides()}
          data-testid="tuner-disable-btn"
          className="flex-1 py-1.5 px-2.5 rounded-lg border border-rose-500/40 bg-rose-950/30 text-[10px] uppercase font-bold tracking-wider text-rose-300 hover:border-rose-400 hover:text-rose-100 transition-colors"
        >
          Disable Overrides
        </button>
      </div>
    </aside>
  );
}
