import type React from 'react';
import { Chamber, GridIdentity } from './types';
import {
  getCalendarFocusLabel,
  getMonthIndexFromChamber,
  getMonthThoughtCount,
  parseLocalDateFromChamber,
} from './calendarChamberUtils';
import { computeTreeGrowthMetrics } from './world/InscriptionTree';
import {
  computeAliveness,
  computeFoliageCount,
  countMonthJournalMetrics,
  getMonthFoliageState,
} from './fractalCalendarModel';
import { useFoliageDebugStore } from '@/core/state/foliageDebugStore';
import { useVillageTunerStore } from '@/core/state/villageTunerStore';
import { useWorldLook } from './looks/worldLook';
import { Z } from './ZRegistry';

const cardStyle: React.CSSProperties = {
  background: 'rgba(7, 3, 16, 0.84)',
  border: '1px solid rgba(139, 184, 255, 0.14)',
  borderRadius: '14px',
  backdropFilter: 'blur(12px)',
  boxShadow: '0 18px 42px rgba(0, 0, 0, 0.32)',
};

type Props = {
  chamber: Chamber;
  chambers: Record<number, Chamber>;
  identity: GridIdentity;
  inputMode?: 'world' | 'typing' | 'ui';
  nearAltar?: boolean;
  nearTermite?: boolean;
  nearPortal?: number | null;
  nearNoticeBoard?: boolean;
  nearMapTable?: boolean;
  nearLibrary?: boolean;
  nearMoodStone?: boolean;
  nearBottlePost?: boolean;
};

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[9px] uppercase tracking-[0.24em] text-cyan-200/38">{label}</span>
      <span className="text-[12px] tracking-[0.06em] text-white/86">{value}</span>
    </div>
  );
}

function ObjectiveLine({ text }: { text: string }) {
  return (
    <p className="text-[11px] leading-relaxed text-white/78">
      {text}
    </p>
  );
}

function PromptCluster({ chamber, nearPortal, chambers, inputMode = 'world', nearAltar, nearTermite, nearNoticeBoard, nearMapTable, nearLibrary, nearMoodStone, nearBottlePost }: Omit<Props, 'identity'>) {
  const nearbyPrompt =
    nearNoticeBoard ? 'Notice board: review marked chambers.'
      : nearMapTable ? 'Mind Map Lighthouse: press Enter or Space to open the 3D Mind Map.'
      : nearLibrary ? 'Archive Monolith: search history, pair companion device, or transfer cold stones.'
      : nearMoodStone ? 'Synaptic Vault Pavilion: press Enter or Space to open the Synaptic Vault.'
      : nearBottlePost ? 'Bottle post: send messages forward.'
      : nearTermite ? 'Station 02 · Sigma Pyramid: Commune & Awaken Generative Voice (Opt-in download).'
      : nearAltar ? 'Station 01 · Journal Altar: Living Crucible (Inscribe or Seal Day into Immutable Log).'
      : typeof nearPortal === 'number' && chambers[nearPortal]
        ? `Traverse to ${chambers[nearPortal].name}.`
        : chamber.id === 0
          ? 'Root hub: follow the roads to town services or return to today.'
          : parseLocalDateFromChamber(chamber)
            ? 'Today room: move between week and neighboring days.'
            : 'Calendar chamber: move deeper or return to the root hub.';

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[10px] uppercase tracking-[0.18em] text-cyan-200/70">
        {inputMode === 'typing'
          ? 'Typing UI active: text keys go to focused input. Press ESC to return to world control.'
          : inputMode === 'ui'
            ? 'Menu/UI active: close overlays to restore full world movement controls.'
            : 'World control active: WASD move, Q/E rotate, Enter interact.'}
      </p>
      <ObjectiveLine text={nearbyPrompt} />
      <div className="flex flex-wrap items-center gap-3 text-[10px] uppercase tracking-[0.16em] text-white/62">
        <span>WASD / ARROWS MOVE</span>
        <span>Q / E ROTATE</span>
        <span>ENTER INTERACT</span>
        <span>R JOURNAL ALTAR</span>
        <span>M MIND MAP</span>
        <span>K LEDGER</span>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-cyan-200/40">
        <span className="mr-2 text-cyan-200/55">Controller:</span>
        <span>Root Hub</span>
      </div>
    </div>
  );
}

export default function RebuiltHUD({
  chamber,
  chambers,
  identity,
  inputMode = 'world',
  nearAltar = false,
  nearTermite = false,
  nearPortal = null,
  nearNoticeBoard = false,
  nearMapTable = false,
  nearLibrary = false,
  nearMoodStone = false,
  nearBottlePost = false,
}: Props) {
  const focusLabel = getCalendarFocusLabel(chambers, chamber.id);
  const activeDay = parseLocalDateFromChamber(chamber) ?? identity.lastDailyAnchorLocalDate ?? 'UNSEALED';
  const activeDayLabel = activeDay === 'UNSEALED'
    ? activeDay
    : new Date(`${activeDay}T12:00:00`).toLocaleDateString(undefined, {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
      });

  const activeMonthIndex = getMonthIndexFromChamber(chamber) ?? new Date().getMonth();
  const currentYear = new Date().getFullYear();
  const monthMetrics = countMonthJournalMetrics(chambers, currentYear, activeMonthIndex + 1);

  const {
    enabled: debugActive,
    overrideE,
    overrideD,
    toggleTunerOverlay,
    resetOverrides,
  } = useFoliageDebugStore();

  const villageDebugActive = useVillageTunerStore((state) => state.enabled);
  const simulatedNpcCount = useVillageTunerStore((state) => state.simulatedNpcCount);
  const toggleVillageTuner = useVillageTunerStore((state) => state.toggleTunerOpen);
  const resetVillageOverrides = useVillageTunerStore((state) => state.resetVillageOverrides);
  const worldLook = useWorldLook((s) => s.look);
  const setWorldLook = useWorldLook((s) => s.setLook);

  const effectiveEntries = debugActive ? overrideE : monthMetrics.entryCount;
  const effectiveActiveDays = debugActive ? overrideD : monthMetrics.activeDays;
  const effectiveAliveness = debugActive
    ? computeAliveness(effectiveEntries, effectiveActiveDays)
    : monthMetrics.aliveness;
  const effectiveFoliageCount = computeFoliageCount(effectiveAliveness);
  const effectiveFoliageState = getMonthFoliageState(effectiveAliveness, false);
  const treeMetrics = computeTreeGrowthMetrics(effectiveEntries);

  return (
    <>
      <div className="absolute left-4 top-4 max-w-xl pointer-events-none select-none font-mono flex flex-col gap-2" style={{ zIndex: Z.HUD_ELEVATED }}>
        <div className="px-4 py-3.5" style={cardStyle}>
          <div className="flex items-start gap-4">
            <div className="mt-1 h-2.5 w-2.5 rounded-full bg-cyan-300 shadow-[0_0_10px_rgba(103,232,249,0.85)]" />
            <div className="flex flex-col gap-1">
              <p className="text-[10px] uppercase tracking-[0.32em] text-cyan-200/50">Calendar Focus</p>
              <p className="text-[15px] uppercase tracking-[0.08em] text-white/92">{focusLabel}</p>
              <p className="text-[11px] tracking-[0.06em] text-white/55">{activeDayLabel}</p>
            </div>
          </div>
        </div>

        <div
          data-testid="hud-tree-growth-metrics"
          className="px-3.5 py-2.5 text-[10px] tracking-[0.12em] text-purple-100/85"
          style={cardStyle}
        >
          <div className="flex items-center justify-between gap-4 text-amber-300/90 uppercase font-bold">
            <span className="flex items-center gap-1.5">
              <span>Memory Tree Foliage</span>
              {debugActive && (
                <span className="text-[8px] bg-amber-500/30 text-amber-300 px-1.5 py-0.2 rounded font-bold">
                  SIMULATION
                </span>
              )}
            </span>
            <span>{effectiveFoliageState.toUpperCase()} ({effectiveFoliageCount}/180)</span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[9px] text-cyan-200/75">
            <span>Entries: {effectiveEntries}</span>
            <span>Active Days: {effectiveActiveDays}</span>
            <span>Aliveness: {effectiveAliveness}</span>
            <span>Foliage: {effectiveFoliageCount}</span>
            <span>Stage: {treeMetrics.stage}</span>
          </div>
        </div>
      </div>

      <div className="absolute right-4 top-4 pointer-events-none select-none font-mono flex flex-col items-end gap-2" style={{ zIndex: Z.HUD_ELEVATED }}>
        <div className="grid grid-cols-2 gap-4 px-4 py-3.5 min-w-[280px]" style={cardStyle}>
          <Stat label="Traveler" value={identity.name} />
          <Stat label="Corruption" value={`${(identity.corruption ?? 100.0).toFixed(3)}%`} />
          <Stat label="Streak" value={identity.streak || 0} />
        </div>

        {/* Persistent In-World Canopy Debug Override Badge */}
        {debugActive && (
          <div
            data-testid="hud-debug-override-badge"
            className="pointer-events-auto flex items-center gap-2 rounded-xl border border-amber-400/80 bg-amber-950/90 px-3.5 py-1.5 text-[10px] uppercase font-bold tracking-wider text-amber-200 shadow-[0_0_20px_rgba(245,158,11,0.4)] backdrop-blur-md"
          >
            <span className="h-2 w-2 rounded-full bg-amber-400 animate-ping" />
            <span>DEBUG OVERRIDE ACTIVE: E={overrideE} D={overrideD} A={effectiveAliveness}</span>
            <button
              type="button"
              onClick={() => resetOverrides()}
              data-testid="hud-debug-restore-btn"
              className="ml-1 px-2 py-0.5 rounded bg-black/60 text-[9px] text-amber-300 hover:text-white border border-amber-400/40"
              title="Snap back to pure reality"
            >
              Restore
            </button>
          </div>
        )}

        {/* Persistent In-World Village Debug Override Badge */}
        {villageDebugActive && (
          <div
            data-testid="hud-village-debug-badge"
            className="pointer-events-auto flex items-center gap-2 rounded-xl border border-cyan-400/80 bg-cyan-950/90 px-3.5 py-1.5 text-[10px] uppercase font-bold tracking-wider text-cyan-200 shadow-[0_0_20px_rgba(34,211,238,0.4)] backdrop-blur-md"
          >
            <span className="h-2 w-2 rounded-full bg-cyan-400 animate-ping" />
            <span>DEBUG OVERRIDE ACTIVE: SIMULATED NPCS = {simulatedNpcCount ?? 0}</span>
            <button
              type="button"
              onClick={() => resetVillageOverrides()}
              data-testid="hud-village-restore-btn"
              className="ml-1 px-2 py-0.5 rounded bg-black/60 text-[9px] text-cyan-300 hover:text-white border border-cyan-400/40"
              title="Snap back to pure reality"
            >
              Restore
            </button>
          </div>
        )}

        <div className="flex items-center gap-2">
          {/* Village Tuner Debug Chip */}
          <button
            type="button"
            onClick={toggleVillageTuner}
            data-testid="hud-village-tuner-btn"
            className={`pointer-events-auto flex items-center gap-2 rounded-xl border px-3 py-1.5 text-[10px] uppercase tracking-[0.16em] shadow-[0_0_15px_rgba(34,211,238,0.25)] backdrop-blur-md transition-all ${
              villageDebugActive
                ? 'border-cyan-400 bg-cyan-950/80 text-cyan-200 font-bold'
                : 'border-purple-400/40 bg-[#080314]/90 text-purple-200 hover:border-cyan-400 hover:text-cyan-200'
            }`}
            title="Open Village Tuner Overlay (Key: V)"
          >
            <span className="text-cyan-400">❖</span>
            <span>Village Tuner [V]</span>
          </button>

          {/* Live World Aesthetic Toggle */}
          <button
            type="button"
            onClick={() => {
              const nextLook =
                worldLook === 'wireframe'
                  ? 'dream'
                  : worldLook === 'dream'
                    ? 'comic'
                    : worldLook === 'comic'
                      ? 'acid'
                      : worldLook === 'acid'
                        ? 'minimal'
                        : 'wireframe';
              setWorldLook(nextLook);
            }}
            data-testid="hud-world-look-btn"
            className={`pointer-events-auto flex items-center gap-2 rounded-xl border px-3 py-1.5 text-[10px] uppercase tracking-[0.16em] backdrop-blur-md transition-all cursor-pointer ${
              worldLook === 'dream'
                ? 'border-pink-300 bg-pink-950/80 text-pink-100 font-bold shadow-[0_0_15px_rgba(244,114,182,0.3)]'
                : worldLook === 'comic'
                  ? 'border-amber-300 bg-amber-950/80 text-amber-100 font-bold shadow-[0_0_15px_rgba(251,191,36,0.35)]'
                  : worldLook === 'acid'
                    ? 'border-fuchsia-400 bg-fuchsia-950/80 text-fuchsia-100 font-bold shadow-[0_0_18px_rgba(217,70,239,0.45)]'
                    : worldLook === 'minimal'
                      ? 'border-white/80 bg-black/90 text-white font-bold shadow-[0_0_18px_rgba(255,255,255,0.4)]'
                      : 'border-purple-400/40 bg-[#080314]/90 text-purple-200 hover:border-pink-300 hover:text-pink-200'
            }`}
            title="Switch World Aesthetic (Wireframe / Dream / Comic / Acid / Minimal)"
          >
            <span>{worldLook === 'dream' ? '🌸' : worldLook === 'comic' ? '💥' : worldLook === 'acid' ? '🍄' : worldLook === 'minimal' ? '○' : '🌌'}</span>
            <span>Look: {worldLook === 'dream' ? 'Dream' : worldLook === 'comic' ? 'Comic' : worldLook === 'acid' ? 'Acid' : worldLook === 'minimal' ? 'Minimal' : 'Wireframe'}</span>
          </button>

          {/* Canopy Tuner Debug Chip */}
          <button
            type="button"
            onClick={toggleTunerOverlay}
            data-testid="hud-canopy-tuner-btn"
            className={`pointer-events-auto flex items-center gap-2 rounded-xl border px-3 py-1.5 text-[10px] uppercase tracking-[0.16em] shadow-[0_0_15px_rgba(245,158,11,0.25)] backdrop-blur-md transition-all ${
              debugActive
                ? 'border-amber-400 bg-amber-950/80 text-amber-200 font-bold'
                : 'border-purple-400/40 bg-[#080314]/90 text-purple-200 hover:border-amber-400 hover:text-amber-200'
            }`}
            title="Open Canopy Tuner Overlay (Key: T)"
          >
            <span className="text-amber-400">⚡</span>
            <span>Canopy Tuner [T]</span>
          </button>

        </div>
      </div>

      <div className="absolute bottom-4 left-4 right-4 pointer-events-none select-none font-mono" style={{ zIndex: Z.HUD_ELEVATED }}>
        <div className="mx-auto max-w-5xl px-4 py-3.5" style={cardStyle}>
          <PromptCluster
            chamber={chamber}
            chambers={chambers}
            inputMode={inputMode}
            nearPortal={nearPortal}
            nearAltar={nearAltar}
            nearTermite={nearTermite}
            nearNoticeBoard={nearNoticeBoard}
            nearMapTable={nearMapTable}
            nearLibrary={nearLibrary}
            nearMoodStone={nearMoodStone}
            nearBottlePost={nearBottlePost}
          />
        </div>
      </div>
    </>
  );
}
