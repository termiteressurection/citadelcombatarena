import { useState, useMemo, useEffect } from 'react';
import {
  getCalendarTier,
  findDayDescendants,
  parseLocalDateFromChamber,
  type CalendarTier,
} from './calendarChamberUtils';
import { getPatternsForHorizon, type HorizonPatterns, type HorizonType, type PatternEvidence } from '@/core/semantic/patternClient';
import { FORENSIC_HORIZONS } from './forensicNotebookModel';

type Props = {
  open: boolean;
  onClose: () => void;
  state: any;
};

const TIER_META: Record<string, { label: string; span: string; lock: string; color: string; desc: string }> = {
  year:   { label: 'YEAR',   span: '365 DAYS', lock: 'YEARLY VISION LOCK',   color: '#fbbf24', desc: 'Read at the Year · 3D mindscape derived from this complete rollup' },
  season: { label: 'SEASON', span: '90 DAYS',  lock: 'SEASONAL GOAL LOCK',  color: '#f0abfc', desc: 'Seasonal targets · 90-day execution window' },
  month:  { label: 'MONTH',  span: '30 DAYS',  lock: 'MONTHLY TARGET LOCK', color: '#22d3ee', desc: 'Monthly tactical goals & progress markers' },
  week:   { label: 'WEEK',   span: '7 DAYS',   lock: 'WEEKLY GOAL LOCK',    color: '#a78bfa', desc: 'Weekly aims & sprints · 7-day focus window' },
  day:    { label: 'DAY',    span: '24 HOURS', lock: '24-HOUR JOURNAL LOCK', color: '#34d399', desc: 'Journal at the Day · Past days sealed, future days do not exist' },
};

export default function ForensicNotebook({ open, onClose, state }: Props) {
  const chambers = (state as any).chambers || {};
  const initialTier = getCalendarTier(chambers[(state as any).currentChamberId]);
  const [activeTier, setActiveTier] = useState<string>(initialTier !== 'other' && initialTier !== 'root' ? initialTier : 'day');
  const [selectedChamberId, setSelectedChamberId] = useState<number>((state as any).currentChamberId);
  const [patterns, setPatterns] = useState<HorizonPatterns | null>(null);
  const [patternError, setPatternError] = useState(false);
  const [selectedEvidence, setSelectedEvidence] = useState<PatternEvidence | null>(null);
  const [expandedEvidence, setExpandedEvidence] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let current = true;
    setPatterns(null);
    setPatternError(false);
    getPatternsForHorizon(activeTier as HorizonType)
      .then(result => { if (current) setPatterns(result); })
      .catch(() => { if (current) setPatternError(true); });
    return () => { current = false; };
  }, [open, activeTier]);

  // Group chambers by fractal tier
  const tierChambers = useMemo(() => {
    return Object.values(chambers)
      .filter((c: any) => {
        const tier = getCalendarTier(c);
        return tier === activeTier;
      })
      .sort((a: any, b: any) => {
        const dateA = parseLocalDateFromChamber(a) || a.name;
        const dateB = parseLocalDateFromChamber(b) || b.name;
        return dateB.localeCompare(dateA);
      });
  }, [chambers, activeTier]);

  // Keep selected chamber aligned with tier
  const activeSelectedId = tierChambers.some((c: any) => c.id === selectedChamberId)
    ? selectedChamberId
    : (tierChambers[0] as any)?.id ?? (state as any).currentChamberId;

  const selectedChamber = chambers[activeSelectedId] || (state as any).currentChamber;
  const selectedTier = getCalendarTier(selectedChamber);

  // Payload B: Automatic children rollup (from days below)
  const rollupDays = useMemo(() => {
    if (selectedTier === 'day' || selectedTier === 'other') return [];
    return findDayDescendants(chambers, activeSelectedId);
  }, [chambers, activeSelectedId, selectedTier]);

  const rollupThoughts = useMemo(() => {
    return rollupDays.flatMap((d) =>
      d.thoughts.map((t) => ({ ...t, sourceDay: parseLocalDateFromChamber(d) || d.name }))
    );
  }, [rollupDays]);

  if (!open) return null;

  const currentMeta = TIER_META[activeTier] || TIER_META.day;

  return (
    <div className="fixed inset-0 z-[500] flex flex-col bg-[#030611]/95 backdrop-blur-2xl animate-citadelFadeIn text-purple-100 font-mono select-none">
      {/* ── 1. Top Sovereign Header ── */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-purple-500/20 px-6 bg-[#0a051a]/80">
        <div className="flex items-center gap-3">
          <div className="h-2.5 w-2.5 rounded-full bg-purple-400 animate-pulse shadow-[0_0_10px_#c084fc]" />
          <span className="text-[11px] uppercase tracking-[0.35em] font-extrabold text-purple-300">
            FRACTAL CALENDAR // FORENSIC NOTEBOOK
          </span>
        </div>

        {/* Tier Selector Navigation Bar */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-black/60 border border-purple-500/30">
          {FORENSIC_HORIZONS.map((tier) => {
            const meta = TIER_META[tier];
            const isActive = activeTier === tier;
            return (
              <button
                key={tier}
                onClick={() => {
                  setActiveTier(tier);
                }}
                className={`px-3 py-1 rounded-lg text-[10px] uppercase font-bold tracking-[0.2em] transition-all ${
                  isActive
                    ? 'bg-purple-600/30 border border-purple-400 text-white shadow-[0_0_12px_rgba(168,85,247,0.4)]'
                    : 'text-purple-400/60 hover:text-purple-200 hover:bg-white/5 border border-transparent'
                }`}
                style={{ borderColor: isActive ? meta.color : undefined, color: isActive ? meta.color : undefined }}
              >
                {meta.label} <span className="text-[8px] opacity-70">({meta.span})</span>
              </button>
            );
          })}
        </div>

        <button 
          onClick={onClose}
          className="text-[10px] uppercase tracking-widest text-purple-400 hover:text-purple-100 border border-purple-500/30 px-3 py-1 rounded-lg hover:border-purple-400 transition-all"
        >
          [CLOSE SANCTUARY]
        </button>
      </header>

      {/* ── 2. The One Rule Architecture Banner (Direct from Citadel Spec) ── */}
      <div className="px-6 py-2 bg-[#06020e] border-b border-purple-500/15 flex items-center justify-between text-[9px] uppercase tracking-[0.22em] text-purple-400/80">
        <div>
          <span className="text-cyan-400 font-bold">THE ONE RULE:</span> EVERY CHAMBER LOCKED TO ITS OWN SPAN · JOURNAL AT THE DAY · GOALS AT THEIR LEVEL · READ AT THE YEAR
        </div>
        <div className="text-[8px] text-purple-500/60">
          {currentMeta.desc}
        </div>
      </div>

      {/* ── 3. Main Workspace ── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar: Chamber Selector for Active Tier */}
        <aside className="w-72 border-r border-purple-500/15 overflow-y-auto bg-[#030611]/60 p-3 space-y-1.5">
          <div className="px-2 py-1.5 text-[9px] uppercase tracking-[0.2em] text-purple-400/50 font-bold border-b border-purple-500/10 mb-2">
            {currentMeta.label} CHAMBER REGISTRY ({tierChambers.length})
          </div>

          {tierChambers.length === 0 ? (
            <div className="p-4 text-center text-[10px] text-purple-400/40 uppercase tracking-widest italic">
              No chambers registered under {currentMeta.label} tier.
            </div>
          ) : (
            tierChambers.map((ch: any) => {
              const isSelected = ch.id === activeSelectedId;
              const date = parseLocalDateFromChamber(ch) || ch.name;
              return (
                <div
                  key={ch.id}
                  onClick={() => setSelectedChamberId(ch.id)}
                  className={`group cursor-pointer p-2.5 rounded-xl border transition-all ${
                    isSelected
                      ? 'bg-purple-600/20 border-purple-400 text-white shadow-[0_0_15px_rgba(168,85,247,0.25)]'
                      : 'border-purple-500/10 hover:border-purple-500/30 hover:bg-white/5 text-purple-200/60 hover:text-purple-100'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold tracking-wider uppercase truncate">{date}</span>
                    <span className="text-[8px] font-mono px-1.5 py-0.5 rounded bg-black/40 text-purple-300">
                      {ch.thoughts.length} {activeTier === 'day' ? 'entries' : 'goals'}
                    </span>
                  </div>
                  <div className="text-[8px] text-purple-400/50 uppercase tracking-wider mt-1 truncate">
                    {ch.description || `${currentMeta.label} chamber`}
                  </div>
                </div>
              );
            })
          )}
        </aside>

        {/* Main Feed: Dual Payloads (Stage 1 Level Goals vs Stage 2 Rollup) */}
        <main className="flex-1 overflow-y-auto p-10 bg-gradient-to-b from-transparent to-purple-950/10">
          <div className="max-w-3xl mx-auto space-y-10 pb-20">
            <section aria-label={`${currentMeta.label} discovered patterns`} className="rounded-2xl border border-cyan-400/20 bg-[#07111c]/80 p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-cyan-400/15 pb-3">
                <div>
                  <div className="text-[10px] font-extrabold uppercase tracking-[0.25em] text-cyan-300">PATTERN RECORD // {currentMeta.label}</div>
                  <div className="mt-1 text-[9px] uppercase tracking-widest text-cyan-100/45">Co-occurrence from signed journal stones · every line opens its source</div>
                </div>
                {patterns && <span className="text-[9px] uppercase tracking-widest text-cyan-200/60">{patterns.entriesRecorded} entries in this horizon</span>}
              </div>

              {patternError ? (
                <p role="status" className="text-[11px] text-amber-200/70">The signed pattern record is unavailable in this preview.</p>
              ) : !patterns ? (
                <p role="status" className="text-[11px] text-cyan-100/55">Reading the signed stones…</p>
              ) : patterns.entriesRecorded < 10 ? (
                <p role="status" className="text-[11px] text-cyan-100/65">Stone record still gathering — {patterns.entriesRecorded} entries recorded.</p>
              ) : patterns.patterns.length === 0 ? (
                <p role="status" className="text-[11px] text-cyan-100/55">
                  {patterns.stillGathering && <>Stone record still gathering — {patterns.entriesRecorded} entries recorded. </>}
                  No supported co-occurrence meets the display threshold in this horizon.
                </p>
              ) : (
                <div className="space-y-3">
                  {patterns.stillGathering && <p role="status" className="text-[10px] text-cyan-100/55">Stone record still gathering — {patterns.entriesRecorded} entries recorded.</p>}
                  {patterns.patterns.map(pattern => {
                    const expanded = expandedEvidence === pattern.id;
                    const supporting = expanded ? pattern.supportingEvidence : pattern.supportingEvidence.slice(0, 2);
                    const counterexamples = expanded ? pattern.counterexampleEvidence : pattern.counterexampleEvidence.slice(0, 2);
                    return (
                      <article key={pattern.id} className="rounded-xl border border-cyan-400/15 bg-black/30 p-3 space-y-2">
                        <p className="text-[11px] leading-relaxed text-cyan-50/90">{pattern.statement}</p>
                        <div className="grid gap-2 sm:grid-cols-2">
                          <div>
                            <div className="mb-1 text-[8px] uppercase tracking-widest text-emerald-300/70">Supporting stones · {pattern.supportingEventIds.length}</div>
                            {supporting.map(item => <EvidenceLink key={item.eventId} evidence={item} onOpen={setSelectedEvidence} />)}
                          </div>
                          <div>
                            <div className="mb-1 text-[8px] uppercase tracking-widest text-amber-200/70">Counterexamples · {pattern.counterexampleEventIds.length}</div>
                            {counterexamples.map(item => <EvidenceLink key={item.eventId} evidence={item} onOpen={setSelectedEvidence} />)}
                          </div>
                        </div>
                        {(pattern.supportingEvidence.length > 2 || pattern.counterexampleEvidence.length > 2) && (
                          <button className="text-[9px] uppercase tracking-wider text-cyan-300/75 underline underline-offset-2" onClick={() => setExpandedEvidence(expanded ? null : pattern.id)}>
                            {expanded ? 'Show fewer stones' : 'Show all evidence stones'}
                          </button>
                        )}
                      </article>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Header info */}
            <div className="space-y-3 border-b border-purple-500/20 pb-6">
              <div className="flex items-center justify-between">
                <span className="px-2.5 py-1 rounded text-[9px] font-extrabold uppercase tracking-[0.25em] border"
                  style={{ borderColor: currentMeta.color, color: currentMeta.color, backgroundColor: `${currentMeta.color}15` }}>
                  {currentMeta.lock} · {currentMeta.span}
                </span>
                <span className="text-[10px] text-purple-400/60 uppercase tracking-widest">
                  CHAMBER ID: #{selectedChamber.id}
                </span>
              </div>
              <h1 className="text-3xl font-light uppercase tracking-[0.18em] text-white">
                {selectedChamber.name}
              </h1>
              <p className="text-[11px] text-purple-300/70 uppercase tracking-widest leading-relaxed">
                {selectedChamber.description}
              </p>
            </div>

            {/* PAYLOAD A: LEVEL WRITTEN GOALS / JOURNAL */}
            <section className="space-y-4">
              <div className="flex items-center justify-between border-b border-purple-500/15 pb-2">
                <div className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
                  <span className="text-[11px] font-extrabold uppercase tracking-[0.25em] text-cyan-300">
                    PAYLOAD A // {activeTier === 'day' ? 'DAILY JOURNAL ENTRIES' : `${currentMeta.label} WRITTEN GOALS & TARGETS`}
                  </span>
                </div>
                <span className="text-[9px] text-purple-400/60">
                  {selectedChamber.thoughts.length} ITEMS SEALED
                </span>
              </div>

              {selectedChamber.thoughts.length === 0 ? (
                <div className="p-8 rounded-xl border border-dashed border-purple-500/20 text-center text-purple-400/40 text-[10px] uppercase tracking-widest">
                  No {activeTier === 'day' ? 'journal entries' : 'written goals'} sealed at this {activeTier} chamber level yet.
                </div>
              ) : (
                <div className="space-y-4">
                  {selectedChamber.thoughts.map((thought: any, i: number) => (
                    <div key={thought.id || i} className="p-4 rounded-xl border border-purple-500/20 bg-black/40 space-y-2">
                      <div className="flex items-center justify-between text-[9px] text-purple-400/60 uppercase tracking-wider">
                        <span>{new Date(thought.timestamp).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</span>
                        {thought.type && <span className="px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-200">{thought.type}</span>}
                      </div>
                      <p className="text-[14px] leading-relaxed text-purple-100 whitespace-pre-wrap">
                        {thought.text}
                      </p>
                      {thought.tags && thought.tags.length > 0 && (
                        <div className="flex gap-1.5 pt-1">
                          {thought.tags.map((tag: string) => (
                            <span key={tag} className="text-[9px] text-cyan-400/70">#{tag}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* PAYLOAD B: FRACTAL AGGREGATION ROLLUP (From children days below) */}
            {activeTier !== 'day' && (
              <section className="space-y-4 pt-6 border-t border-purple-500/20">
                <div className="flex items-center justify-between border-b border-purple-500/15 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    <span className="text-[11px] font-extrabold uppercase tracking-[0.25em] text-emerald-300">
                      PAYLOAD B // FRACTAL ROLLUP ({rollupThoughts.length} RECORDED ENTRIES ACROSS {rollupDays.length} DAYS)
                    </span>
                  </div>
                  <span className="text-[9px] text-purple-400/60">
                    AUTOMATIC UPWARD SYNAPSE
                  </span>
                </div>

                {rollupThoughts.length === 0 ? (
                  <div className="p-8 rounded-xl border border-dashed border-purple-500/20 text-center text-purple-400/40 text-[10px] uppercase tracking-widest">
                    No children day entries have rolled up into this {activeTier} window yet.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {rollupThoughts.slice(0, 40).map((t: any, i: number) => (
                      <div key={t.id || i} className="p-3 rounded-lg border border-purple-500/15 bg-white/[0.02] flex items-start justify-between gap-4">
                        <div className="flex-1 space-y-1">
                          <p className="text-[12px] text-purple-200/90 leading-snug">
                            {t.text}
                          </p>
                          <div className="text-[8px] text-purple-400/50 uppercase tracking-wider">
                            ORIGIN DAY: <span className="text-cyan-400">{t.sourceDay}</span> · {new Date(t.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                        {t.mood && <span className="text-sm">{t.mood}</span>}
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}
          </div>
        </main>
      </div>

      {/* ── 4. Tactical Teleport Footer ── */}
      <footer className="h-12 shrink-0 border-t border-purple-500/20 bg-black/60 px-6 flex items-center justify-between text-[10px] uppercase tracking-[0.2em] text-purple-400/80">
        <div className="flex items-center gap-2">
          <span className="text-cyan-400">ACTIVE TELEPORT DESTINATION:</span>
          <span className="text-white font-bold">{selectedChamber.name}</span>
        </div>
        <button 
          onClick={() => {
            (state as any).enterChamber(activeSelectedId);
            onClose();
          }}
          className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-gradient-to-r from-purple-600/40 to-cyan-500/40 border border-cyan-400 text-cyan-200 hover:text-white hover:shadow-[0_0_15px_rgba(0,240,255,0.4)] transition-all cursor-pointer"
        >
          <span>TELEPORT TO THIS CHAMBER</span>
          <span>➔</span>
        </button>
      </footer>

      {selectedEvidence && (
        <div className="fixed inset-0 z-[700] flex items-center justify-center bg-black/80 p-6" role="dialog" aria-modal="true" aria-label="Signed journal stone">
          <div className="w-full max-w-2xl rounded-2xl border border-cyan-300/40 bg-[#050b14] p-6 shadow-[0_0_40px_rgba(34,211,238,0.15)]">
            <div className="flex items-center justify-between border-b border-cyan-300/20 pb-3">
              <div className="text-[10px] uppercase tracking-[0.25em] text-cyan-200">STONE // {selectedEvidence.day}</div>
              <button onClick={() => setSelectedEvidence(null)} className="text-[10px] uppercase tracking-widest text-purple-200/65 hover:text-white">[CLOSE]</button>
            </div>
            <p className="whitespace-pre-wrap py-5 text-sm leading-relaxed text-purple-50">{selectedEvidence.text}</p>
            <div className="break-all border-t border-cyan-300/15 pt-3 text-[8px] uppercase tracking-wider text-cyan-100/45">
              ENTRY {selectedEvidence.entryId} · SIGNED EVENT {selectedEvidence.eventId}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function EvidenceLink({ evidence, onOpen }: { evidence: PatternEvidence; onOpen: (evidence: PatternEvidence) => void }) {
  return (
    <button
      title={`Open ${evidence.entryId} · ${evidence.eventId}`}
      onClick={() => onOpen(evidence)}
      className="block w-full truncate py-0.5 text-left text-[9px] text-cyan-100/65 underline decoration-cyan-300/25 underline-offset-2 hover:text-cyan-100"
    >
      {evidence.day} · {evidence.text}
    </button>
  );
}
