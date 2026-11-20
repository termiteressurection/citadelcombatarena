import { useState, useEffect, useRef } from 'react';
import { useCitadelStore } from '@/core/state/citadelStore';
import type { LocalDay } from '@/core/model/types';
import { getDayStatus } from '@/core/semantic/crystallizationClient';
import { useCitadelStore as useWorldStore } from './store';
import { findDayChamberIdByLocalDate } from './calendarChamberUtils';
import { getChamberIdForDate, syncSigmaEngineChambers } from './hooks/useCitadelState';
import {
  getPeriodWritability,
  resolveWritablePeriod,
  assertPeriodWritable,
  type JournalLevel,
} from './writablePath';
import { resolveAltarDestination, type AltarDestination } from './altarRouter';
import { useMindmap } from '@/features/world/mindmap3d/store';

interface Props {
  open: boolean;
  onClose: () => void;
  destination?: AltarDestination;
  day?: string;
  level?: JournalLevel;
  period?: string;
  onNavigateToDay?: (day: string) => void;
  onInscribed?: (text: string, period: string) => void;
}

export default function JournalAltarModal({
  open,
  onClose,
  destination,
  day,
  level: propLevel,
  period: propPeriod,
  onInscribed,
}: Props) {
  const store = useCitadelStore();
  const worldStore = useWorldStore();
  const currentChamber = worldStore.chambers[worldStore.currentChamberId];

  // Resolve destination: either passed explicitly or derived from world chamber context
  const resolvedDestination: AltarDestination =
    destination ??
    resolveAltarDestination(currentChamber, {
      level: propLevel,
      period: propPeriod,
      day,
    });

  const isNodeDestination = resolvedDestination.kind === 'node';
  const isErrorDestination = resolvedDestination.kind === 'error';

  const targetLevel: JournalLevel =
    resolvedDestination.kind === 'journal' ? resolvedDestination.level : propLevel || 'day';
  const initialPeriod =
    resolvedDestination.kind === 'journal'
      ? resolvedDestination.period
      : propPeriod || day || resolveWritablePeriod(targetLevel);

  const [activePeriod, setActivePeriod] = useState<string>(initialPeriod);
  const [rolloverNotice, setRolloverNotice] = useState<string | null>(null);

  // Sync activePeriod when opening or props change
  useEffect(() => {
    if (resolvedDestination.kind === 'journal') {
      setActivePeriod(resolvedDestination.period);
    } else {
      setActivePeriod(propPeriod || day || resolveWritablePeriod(targetLevel));
    }
  }, [propPeriod, day, targetLevel, open, resolvedDestination]);

  // Rollover watcher across Day, Month, Season, and Year with draft preservation (Journal only)
  useEffect(() => {
    if (!open || isNodeDestination || isErrorDestination) return;
    const checkRollover = () => {
      const freshWritable = resolveWritablePeriod(targetLevel);
      if (activePeriod !== freshWritable) {
        const prevWritability = getPeriodWritability(targetLevel, activePeriod);
        if (prevWritability.status === 'past' || prevWritability.status === 'dormant') {
          setActivePeriod(freshWritable);
          setRolloverNotice(
            `${targetLevel.toUpperCase()} period rolled over to ${freshWritable}. Your draft has been preserved and retargeted to the active crucible.`,
          );
        }
      }
    };

    const interval = setInterval(checkRollover, 1000);
    window.addEventListener('focus', checkRollover);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', checkRollover);
    };
  }, [open, activePeriod, targetLevel, isNodeDestination, isErrorDestination]);

  // Mind map node subscription
  const mindmapNode = useMindmap((s) =>
    isNodeDestination ? s.nodes[resolvedDestination.nodeId] : undefined,
  );
  const nodeTitle =
    mindmapNode?.title || (isNodeDestination ? resolvedDestination.title : 'Thought');
  const nodeBullets = mindmapNode?.bullets || [];

  // Writability computation
  const writability = isNodeDestination
    ? { isWritable: true, status: 'open' as const, label: 'Mind Map Node Crucible · Timelock Immune' }
    : isErrorDestination
    ? { isWritable: false, status: 'past' as const, label: 'Refusal · Ambiguous Mindmap Context' }
    : getPeriodWritability(targetLevel, activePeriod);

  // Fetch entries according to tier
  const dayCell =
    !isNodeDestination && !isErrorDestination && targetLevel === 'day'
      ? store.state.days[activePeriod as LocalDay]
      : undefined;
  const entries =
    !isNodeDestination && !isErrorDestination
      ? targetLevel === 'day'
        ? dayCell?.entries ?? []
        : store.state.hierarchicalEntries?.[activePeriod] ?? []
      : [];

  const isCrystallized =
    !isNodeDestination &&
    !isErrorDestination &&
    (Boolean(dayCell?.crystallized) || writability.status === 'past');
  const isWritable = isNodeDestination
    ? true
    : isErrorDestination
    ? false
    : writability.isWritable && !dayCell?.crystallized;

  const [inputText, setInputText] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [isSealing, setIsSealing] = useState(false);
  const [backendStatus, setBackendStatus] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Sync backend crystallization status for day level
  useEffect(() => {
    if (open && !isNodeDestination && !isErrorDestination && targetLevel === 'day') {
      getDayStatus(activePeriod)
        .then((status) => {
          if (status.isCrystallized && !dayCell?.crystallized) {
            store.crystallizeDay(activePeriod as LocalDay);
          }
          setBackendStatus(status.isCrystallized ? 'Sealed in immutable log' : 'Living crucible active');
        })
        .catch(console.error);
    }
  }, [open, activePeriod, targetLevel, dayCell?.crystallized, store, isNodeDestination, isErrorDestination]);

  useEffect(() => {
    if (open && isWritable) {
      inputRef.current?.focus();
    }
  }, [open, isWritable]);

  // Handle ESC
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  const handleAddThought = () => {
    const text = inputText.trim();
    if (!text) return;

    if (isErrorDestination) {
      console.error(`[CITADEL_ERROR] ${resolvedDestination.message}`);
      return;
    }

    // ── Mind Map Node Context: Immune to calendar timelock ──────────────────
    if (isNodeDestination) {
      // 1. Append bullet point to node's cell (immune to timelock)
      useMindmap.getState().addBullet(resolvedDestination.nodeId, text);

      // 2. Write-through to 3D World Chamber so reflections are immediate in world
      const nowIso = new Date().toISOString();
      worldStore.updateChamber(
        resolvedDestination.chamberId,
        (c) => {
          c.thoughts.push({
            id: Date.now() + Math.random(),
            text,
            timestamp: nowIso,
            chamberId: resolvedDestination.chamberId,
            sourceChamberId: resolvedDestination.chamberId,
            type: 'monolith',
            tags: ['derived-mindmap', 'mindmap-bullet'],
          });
        },
        true,
      );

      // 3. Keep canonical globalMindMap synchronized if present
      const canonical = useCitadelStore.getState();
      const existingNode = canonical.state.globalMindMap?.nodes?.find(
        (n) => n.id === resolvedDestination.nodeId,
      );
      if (existingNode) {
        canonical.updateGlobalNode(resolvedDestination.nodeId, {
          bullets: [...(existingNode.bullets || []), text],
        });
      }

      onInscribed?.(text, resolvedDestination.nodeId);
      setInputText('');
      setRolloverNotice(null);
      return;
    }

    // ── Journal Level: Enforce writability at lowest entry point ─────────────
    assertPeriodWritable(targetLevel, activePeriod);

    // 1. Write to canonical store for level and period
    store.writeToPeriod(targetLevel, activePeriod, text, [
      'altar-thought',
      'user-inscription',
      targetLevel,
      activePeriod,
    ]);

    // 2. Write-through to 3D World Chamber so reflections are immediate in world
    const currentChamberId = worldStore.currentChamberId;

    if (targetLevel === 'day') {
      const dayChamberId =
        findDayChamberIdByLocalDate(worldStore.chambers, activePeriod) ??
        getChamberIdForDate(activePeriod);

      if (!worldStore.chambers[dayChamberId]) {
        const seeded = {
          ...worldStore.chambers,
          [dayChamberId]: {
            id: dayChamberId,
            name: 'TODAY',
            description: `The day of ${activePeriod}.`,
            depth: 1,
            parent: 0,
            template: 'day' as const,
            doors: [0],
            thoughts: [],
          },
        };
        const { chambers: synced } = syncSigmaEngineChambers(seeded);
        worldStore.setChambers(synced, true);
      }

      const nowIso = new Date().toISOString();
      worldStore.updateChamber(
        dayChamberId,
        (c) => {
          c.thoughts.push({
            id: Date.now() + Math.random(),
            text,
            timestamp: nowIso,
            sourceDate: activePeriod,
            chamberId: dayChamberId,
            type: 'gem',
            tags: ['altar-thought', 'user-inscription', activePeriod],
          });
        },
        true,
      );
    } else {
      // Inscribe to currently open Month, Season, or Year chamber
      if (worldStore.chambers[currentChamberId]) {
        const nowIso = new Date().toISOString();
        worldStore.updateChamber(
          currentChamberId,
          (c) => {
            c.thoughts.push({
              id: Date.now() + Math.random(),
              text,
              timestamp: nowIso,
              sourceDate: activePeriod,
              chamberId: currentChamberId,
              type: 'gem',
              tags: ['altar-thought', 'user-inscription', targetLevel, activePeriod],
            });
          },
          true,
        );
      }
    }

    onInscribed?.(text, activePeriod);
    setInputText('');
    setRolloverNotice(null);
  };

  const handleCrystallize = async () => {
    if (isNodeDestination || isErrorDestination) return;
    try {
      setIsSealing(true);
      await store.crystallizeDay(activePeriod as LocalDay);
      setShowConfirm(false);
      setBackendStatus('Sealed in immutable log');
    } catch (e: any) {
      console.error('Crystallization failed:', e);
    } finally {
      setIsSealing(false);
    }
  };

  const stationTitle = isErrorDestination
    ? 'Station // Refusal Error'
    : isNodeDestination
    ? `Thought Crucible // ${nodeTitle}`
    : targetLevel === 'year'
    ? 'Station 04 // Year Crucible'
    : targetLevel === 'season'
    ? 'Station 03 // Season Crucible'
    : targetLevel === 'month'
    ? 'Station 02 // Month Crucible'
    : 'Station 01 // Day Crucible';

  const shiftActiveDay = (deltaDays: number) => {
    const parts = activePeriod.split('-').map(Number);
    if (parts.length !== 3 || parts.some(isNaN)) return;
    const d = new Date(parts[0], parts[1] - 1, parts[2], 12, 0, 0);
    d.setDate(d.getDate() + deltaDays);
    const nextIso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    setActivePeriod(nextIso);
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[450] flex flex-col items-center justify-center font-mono p-4"
      style={{ background: 'rgba(5,2,12,0.96)', animation: 'citadelFadeIn 150ms ease-out' }}
    >
      <div
        className={`w-full max-w-3xl max-h-[90vh] flex flex-col rounded-2xl border shadow-2xl overflow-hidden transition-all duration-300 ${
          isErrorDestination
            ? 'border-red-500/40 bg-gradient-to-b from-[#190606] to-[#0a0202] shadow-[0_0_50px_rgba(239,68,68,0.2)]'
            : isNodeDestination
            ? 'border-[#3ff0ff]/40 bg-gradient-to-b from-[#081524] to-[#04060d] shadow-[0_0_50px_rgba(63,240,255,0.2)]'
            : writability.status === 'future'
            ? 'border-indigo-500/40 bg-gradient-to-b from-[#0c0d1e] to-[#04050d] shadow-[0_0_50px_rgba(99,102,241,0.2)]'
            : writability.status === 'dormant'
            ? 'border-sky-500/40 bg-gradient-to-b from-[#061524] to-[#020912] shadow-[0_0_50px_rgba(14,165,233,0.2)]'
            : isCrystallized
            ? 'border-cyan-500/40 bg-gradient-to-b from-[#0a101f] to-[#04060d] shadow-[0_0_50px_rgba(6,182,212,0.2)]'
            : 'border-amber-500/40 bg-gradient-to-b from-[#180e04] to-[#0a0502] shadow-[0_0_50px_rgba(245,158,11,0.2)]'
        }`}
      >
        {/* Altar Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4 bg-black/40">
          <div className="flex items-center gap-3">
            <span
              className={`text-xl ${
                isErrorDestination
                  ? 'text-red-400'
                  : isNodeDestination
                  ? 'text-[#3ff0ff]'
                  : writability.status === 'future'
                  ? 'text-indigo-400'
                  : writability.status === 'dormant'
                  ? 'text-sky-400'
                  : isCrystallized
                  ? 'text-cyan-400'
                  : 'text-amber-400'
              }`}
            >
              {isErrorDestination
                ? '⚠'
                : isNodeDestination
                ? '✦'
                : writability.status === 'future'
                ? '⏳'
                : writability.status === 'dormant'
                ? '❄'
                : isCrystallized
                ? '⬡'
                : '🜂'}
            </span>
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-[0.25em] text-white">
                {stationTitle}
              </h2>
              <p className="text-[10px] tracking-[0.15em] text-white/50">
                {writability.label}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!isNodeDestination && !isErrorDestination && targetLevel === 'day' && (
              <div className="flex items-center gap-1 rounded border border-white/15 bg-black/50 px-2 py-1 text-[10px]">
                <button
                  type="button"
                  onClick={() => shiftActiveDay(-1)}
                  className="px-1.5 py-0.5 text-white/70 hover:text-amber-300 transition-colors"
                  title="Previous Day"
                >
                  ◀
                </button>
                <input
                  type="date"
                  value={activePeriod}
                  onChange={(e) => {
                    if (e.target.value) setActivePeriod(e.target.value);
                  }}
                  className="bg-transparent text-amber-200 font-mono text-[10px] outline-none cursor-pointer"
                />
                <button
                  type="button"
                  onClick={() => shiftActiveDay(1)}
                  className="px-1.5 py-0.5 text-white/70 hover:text-amber-300 transition-colors"
                  title="Next Day"
                >
                  ▶
                </button>
                <button
                  type="button"
                  onClick={() => setActivePeriod(resolveWritablePeriod('day'))}
                  className="ml-1 rounded border border-amber-400/40 bg-amber-500/20 px-2 py-0.5 text-[9px] uppercase tracking-wider text-amber-200 hover:border-amber-300 transition-colors"
                >
                  Today
                </button>
              </div>
            )}
            <button
              onClick={onClose}
              className="rounded border border-white/20 px-2.5 py-1 text-xs text-white/70 hover:bg-white/10 transition-colors"
            >
              ESC ✕
            </button>
          </div>
        </div>

        {/* State Banner */}
        <div
          className={`px-6 py-2.5 flex items-center justify-between border-b ${
            isErrorDestination
              ? 'bg-red-950/30 border-red-500/20 text-red-300'
              : isNodeDestination
              ? 'bg-cyan-950/30 border-[#3ff0ff]/20 text-[#3ff0ff]'
              : writability.status === 'future'
              ? 'bg-indigo-950/30 border-indigo-500/20 text-indigo-300'
              : writability.status === 'dormant'
              ? 'bg-sky-950/30 border-sky-500/20 text-sky-300'
              : isCrystallized
              ? 'bg-cyan-950/30 border-cyan-500/20 text-cyan-300'
              : 'bg-amber-950/30 border-amber-500/20 text-amber-300'
          }`}
        >
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] font-bold">
            <span
              className={`inline-block w-2 h-2 rounded-full ${
                isErrorDestination
                  ? 'bg-red-400'
                  : isNodeDestination
                  ? 'bg-[#3ff0ff] animate-pulse'
                  : writability.status === 'future'
                  ? 'bg-indigo-400'
                  : writability.status === 'dormant'
                  ? 'bg-sky-400'
                  : isCrystallized
                  ? 'bg-cyan-400'
                  : 'bg-amber-400 animate-pulse'
              }`}
            />
            <span>
              {isErrorDestination
                ? 'Inscription Refusal · Context Ambiguous'
                : isNodeDestination
                ? 'Active Node Crucible Open'
                : writability.status === 'future'
                ? `Future ${targetLevel} · Has Not Arrived Yet`
                : writability.status === 'dormant'
                ? 'Winter Sleeps · Crucible Wakes in December'
                : isCrystallized
                ? `${targetLevel} Sealed Into Stone`
                : `Active ${targetLevel} Crucible Open`}
            </span>
          </div>
          <span className="text-[10px] tracking-[0.12em] opacity-70">
            {isErrorDestination
              ? 'Day Fallback Blocked'
              : isNodeDestination
              ? 'Living Mindscape Chamber · Always Editable'
              : `${activePeriod} · ${writability.status === 'future' ? 'Unwritten' : writability.status === 'dormant' ? 'Sleeps until December' : backendStatus || 'Ready'}`}
          </span>
        </div>

        {/* Rollover Draft Preservation Notice */}
        {rolloverNotice && (
          <div className="mx-6 mt-4 p-3 rounded-lg border border-cyan-400/60 bg-cyan-950/70 text-cyan-200 text-xs flex items-center gap-2 shadow-lg animate-fadeIn">
            <span className="text-sm">⏳</span>
            <span className="leading-snug">{rolloverNotice}</span>
          </div>
        )}

        {/* Altar Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* 1. Explicit Error Screen (No silent fallback to Day) */}
          {isErrorDestination ? (
            <div className="p-6 rounded-xl border border-red-500/30 bg-red-950/20 text-center space-y-2">
              <span className="text-2xl text-red-400 block mb-1">⚠</span>
              <h3 className="text-xs uppercase tracking-[0.2em] text-red-200 font-bold">
                Inscription Refused
              </h3>
              <p className="text-xs text-red-300/80 max-w-md mx-auto leading-relaxed">
                {resolvedDestination.message}
              </p>
              <p className="text-[10px] text-white/40 mt-2 font-mono">
                To protect the cryptographic integrity of the Journal, unresolvable mindmap context will never silently fall back to the Day chamber.
              </p>
            </div>
          ) : isNodeDestination ? (
            /* 2. Mind Map Node Inscription Section */
            <>
              <div className="space-y-3 p-4 rounded-xl border border-[#3ff0ff]/30 bg-black/40">
                <label className="text-[10px] uppercase tracking-[0.2em] text-[#3ff0ff]/80 block">
                  Inscribe into {nodeTitle}’s NOTES & INQUIRY
                </label>
                <textarea
                  ref={inputRef}
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault();
                      handleAddThought();
                    }
                  }}
                  placeholder="Inscribe a thought into this node… (⌘+Enter to inscribe)"
                  className="w-full h-24 bg-black/60 border border-[#3ff0ff]/20 rounded-lg p-3 text-xs text-[#e6e6ea] placeholder-[#3ff0ff]/30 focus:outline-none focus:border-[#3ff0ff] transition-colors resize-none"
                />
                <div className="flex justify-between items-center pt-1">
                  <span className="text-[9px] text-[#3ff0ff]/50">⌘+Enter to inscribe thought bullet</span>
                  <button
                    onClick={handleAddThought}
                    disabled={!inputText.trim()}
                    className="px-4 py-1.5 rounded border border-[#3ff0ff]/50 bg-[#3ff0ff]/20 text-[#3ff0ff] text-xs font-semibold uppercase tracking-[0.15em] hover:bg-[#3ff0ff]/30 hover:border-[#3ff0ff] disabled:opacity-30 transition-colors"
                  >
                    Inscribe Thought
                  </button>
                </div>
              </div>

              {/* Node Bullets List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs uppercase tracking-[0.2em] text-white/80 font-bold">
                    Inscribed Thoughts & Bullets ({nodeBullets.length})
                  </h3>
                  <span className="text-[10px] text-[#3ff0ff]/70 border border-[#3ff0ff]/30 px-2 py-0.5 rounded bg-cyan-950/40">
                    TIMELOCK IMMUNE · CELL LIVING
                  </span>
                </div>

                {nodeBullets.length === 0 ? (
                  <div className="text-center py-10 rounded-xl border border-white/5 bg-black/20 text-xs text-white/30 tracking-[0.15em]">
                    NO INSCRIPTIONS RECORDED FOR THIS NODE YET — INSCRIBE ABOVE
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[35vh] overflow-y-auto pr-1">
                    {nodeBullets.map((bullet, idx) => (
                      <div
                        key={idx}
                        className="p-3 rounded-lg border border-[#3ff0ff]/20 bg-[#3ff0ff]/5 text-[#e6e6ea]"
                      >
                        <div className="flex justify-between items-center text-[10px] text-[#3ff0ff]/70 mb-1 font-mono">
                          <span>#{idx + 1} BULLET POINT · NOTES & INQUIRY</span>
                          <span>● INSCRIBED</span>
                        </div>
                        <p className="text-xs leading-relaxed whitespace-pre-wrap">{bullet}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            /* 3. Calendar Journal Inscription Section */
            <>
              {isWritable ? (
                <div className="space-y-3 p-4 rounded-xl border border-amber-500/30 bg-black/40">
                  <label className="text-[10px] uppercase tracking-[0.2em] text-amber-400/80 block">
                    Inscribe into {targetLevel.toUpperCase()}’s Crucible ({activePeriod})
                  </label>
                  <textarea
                    ref={inputRef}
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                        e.preventDefault();
                        handleAddThought();
                      }
                    }}
                    placeholder={`What reflection or synthesis enters your ${targetLevel}? (⌘+Enter to inscribe)`}
                    className="w-full h-24 bg-black/60 border border-amber-500/20 rounded-lg p-3 text-xs text-amber-100 placeholder-amber-500/30 focus:outline-none focus:border-amber-400 transition-colors resize-none"
                  />
                  <div className="flex justify-between items-center pt-1">
                    <span className="text-[9px] text-amber-500/50">⌘+Enter to save to active {targetLevel}</span>
                    <button
                      onClick={handleAddThought}
                      disabled={!inputText.trim()}
                      className="px-4 py-1.5 rounded border border-amber-500/50 bg-amber-500/20 text-amber-200 text-xs font-semibold uppercase tracking-[0.15em] hover:bg-amber-500/30 hover:border-amber-400 disabled:opacity-30 transition-colors"
                    >
                      Inscribe Thought
                    </button>
                  </div>
                </div>
              ) : writability.status === 'future' ? (
                <div className="p-6 rounded-xl border border-indigo-500/30 bg-indigo-950/20 text-center space-y-2">
                  <span className="text-2xl text-indigo-400 block mb-1">⏳</span>
                  <h3 className="text-xs uppercase tracking-[0.2em] text-indigo-200 font-bold">
                    Time Has Not Dawned
                  </h3>
                  <p className="text-xs text-indigo-300/70 max-w-md mx-auto leading-relaxed">
                    This chamber represents a {targetLevel} that has not arrived yet ({activePeriod}). Time only moves forward. You cannot write into the future.
                  </p>
                </div>
              ) : writability.status === 'dormant' ? (
                <div className="p-6 rounded-xl border border-sky-500/30 bg-sky-950/20 text-center space-y-2">
                  <span className="text-2xl text-sky-400 block mb-1">❄</span>
                  <h3 className="text-xs uppercase tracking-[0.2em] text-sky-200 font-bold">
                    Winter Sleeps
                  </h3>
                  <p className="text-xs text-sky-300/70 max-w-md mx-auto leading-relaxed">
                    Winter sleeps until December. This crucible wakes in December to conclude the year. Prior winter reflections remain readable and searchable.
                  </p>
                </div>
              ) : (
                <div className="p-6 rounded-xl border border-cyan-500/30 bg-cyan-950/20 text-center space-y-2">
                  <span className="text-2xl text-cyan-400 block mb-1">⬡</span>
                  <h3 className="text-xs uppercase tracking-[0.2em] text-cyan-200 font-bold">
                    The Past Is Stone
                  </h3>
                  <p className="text-xs text-cyan-300/70 max-w-md mx-auto leading-relaxed">
                    {targetLevel.toUpperCase()} {activePeriod} is sealed. Historical entries are permanent and cryptographically immutable. To inscribe new reflections, return to the living {targetLevel}.
                  </p>
                </div>
              )}

              {/* Journal Entries / Stones */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs uppercase tracking-[0.2em] text-white/80 font-bold">
                    {writability.status === 'future'
                      ? `Unwritten ${targetLevel} Record`
                      : writability.status === 'dormant'
                      ? `Dormant Winter Inscriptions`
                      : isCrystallized
                      ? `Crystallized ${targetLevel} Inscriptions`
                      : `Living ${targetLevel} Record`} ({entries.length})
                  </h3>
                  {writability.status === 'dormant' && (
                    <span className="text-[10px] text-sky-400/70 border border-sky-500/30 px-2 py-0.5 rounded bg-sky-950/40">
                      DORMANT · WAKES IN DEC
                    </span>
                  )}
                  {writability.status === 'past' && (
                    <span className="text-[10px] text-cyan-400/70 border border-cyan-500/30 px-2 py-0.5 rounded bg-cyan-950/40">
                      LOCKED · IMMUTABLE
                    </span>
                  )}
                  {writability.status === 'future' && (
                    <span className="text-[10px] text-indigo-400/70 border border-indigo-500/30 px-2 py-0.5 rounded bg-indigo-950/40">
                      FUTURE · NOT ARRIVED
                    </span>
                  )}
                </div>

                {entries.length === 0 ? (
                  <div className="text-center py-10 rounded-xl border border-white/5 bg-black/20 text-xs text-white/30 tracking-[0.15em]">
                    {writability.status === 'future'
                      ? `NO INSCRIPTIONS EXIST YET — FUTURE ${targetLevel.toUpperCase()} IS UNWRITTEN`
                      : writability.status === 'dormant'
                      ? 'NO INSCRIPTIONS RECORDED BEFORE WINTER ENTERED DORMANCY'
                      : `NO INSCRIPTIONS RECORDED FOR THIS ${targetLevel.toUpperCase()} YET`}
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[35vh] overflow-y-auto pr-1">
                    {entries.map((entry, idx) => (
                      <div
                        key={entry.id}
                        className={`p-3 rounded-lg border transition-all ${
                          writability.status === 'dormant'
                            ? 'border-sky-500/20 bg-sky-950/10 text-sky-100'
                            : isCrystallized
                            ? 'border-cyan-500/20 bg-cyan-950/10 text-cyan-100'
                            : 'border-amber-500/20 bg-amber-950/10 text-amber-100'
                        }`}
                      >
                        <div className="flex justify-between items-center text-[10px] opacity-60 mb-1">
                          <span>
                            #{idx + 1}{' '}
                            {entry.tags?.includes('daily-anchor')
                              ? '⚓ DAILY ANCHOR'
                              : `${targetLevel.toUpperCase()} INSCRIPTION`}
                          </span>
                          <span>{new Date(entry.createdAt).toLocaleTimeString()}</span>
                        </div>
                        <p className="text-xs leading-relaxed whitespace-pre-wrap">{entry.text}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Crystallize Button / Ritual Section (Only for active living day) */}
              {targetLevel === 'day' && isWritable && (
                <div className="pt-2 border-t border-amber-500/20">
                  {!showConfirm ? (
                    <button
                      onClick={() => setShowConfirm(true)}
                      className="w-full py-3 rounded-xl border border-cyan-500/40 bg-gradient-to-r from-cyan-950/40 via-amber-950/30 to-cyan-950/40 text-cyan-200 text-xs font-bold uppercase tracking-[0.22em] hover:border-cyan-400 hover:bg-cyan-900/30 transition-all shadow-lg"
                    >
                      ❄ Crystallize Day Into Stone (Seal Today)
                    </button>
                  ) : (
                    <div className="p-4 rounded-xl border border-cyan-400 bg-cyan-950/50 space-y-3 animate-fadeIn">
                      <p className="text-xs font-bold text-cyan-200 uppercase tracking-[0.15em]">
                        Confirm Midnight Crystallization Ritual
                      </p>
                      <p className="text-[11px] text-cyan-300/80 leading-relaxed">
                        Once crystallized, today’s entries will be permanently written to the append-only cryptographic log.
                        You will no longer be able to edit or delete today’s record. The past becomes stone.
                      </p>
                      <div className="flex gap-3 justify-end pt-1">
                        <button
                          onClick={() => setShowConfirm(false)}
                          className="px-4 py-1.5 rounded border border-white/20 text-xs text-white/60 hover:text-white transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleCrystallize}
                          disabled={isSealing}
                          className="px-5 py-1.5 rounded border border-cyan-400 bg-cyan-500/30 text-cyan-100 text-xs font-bold uppercase tracking-[0.18em] hover:bg-cyan-500/50 transition-colors shadow-[0_0_15px_rgba(6,182,212,0.4)]"
                        >
                          {isSealing ? 'Sealing Stone...' : 'Confirm Seal'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
