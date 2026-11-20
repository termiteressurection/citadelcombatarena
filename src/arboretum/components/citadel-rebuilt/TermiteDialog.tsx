import { useState, useRef, useEffect, useCallback } from 'react';
import { renderTermiteseText } from '../../../features/sigma/termiteseGlitch';
import type { Chamber, GridIdentity, Thought } from './types';
import { useCitadelStore } from './store';
import {
  INITIAL_SIGMA_STATE,
  generateSigmaReplyAsync,
  type SigmaState,
} from './sigma/SigmaEngine';
import { localDateISO } from './localDate';
import { toLocalDay } from '@/core/time/localDay';
import { commitAtWipeEpoch, getWipeEpoch, isCurrentWipeEpoch, subscribeToWipeEpoch } from '@/core/security/wipeEpoch';
import { CitationChip } from '@/features/sigma/CitationChip';
import { WhatSigmaKnowsModal } from '@/features/sigma/WhatSigmaKnowsModal';
import { GrowthFeedModal } from '@/features/sigma/GrowthFeedModal';
import { isLearningPaused, setLearningPaused } from '@/core/player-model/playerModelStore';
import { sanitizeMessageBody, type CitationChipData } from '@/core/sigma/sigmaLeash';
import { runExtractionPass } from '@/core/player-model/playerModelExtractor';

const SESSION_STORAGE_KEY = 'citadel_sigma_chat_session';
const ARCHIVE_STORAGE_KEY = 'citadel_sigma_chat_archives';
const DEFAULT_WELCOME = "What are you working through today?";

const QUICK_PROMPTS = [
  'What stands out in my journal stones?',
  'Tell me a Zen or Stoic parable',
  'I need focus and discipline today',
  'Drop a lodge poem',
  'Why did we build the Citadel?',
];

interface SigmaSession {
  day: string;
  startedAt: number;
  updatedAt: number;
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
}

function loadDailySigmaSession(): Array<{ role: 'user' | 'assistant'; content: string }> {
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return [];
    const session: SigmaSession = JSON.parse(raw);
    const today = toLocalDay(new Date());
    const now = Date.now();
    const isSameDay = session.day === today;
    const isWithin24Hours = (now - (session.startedAt || now)) < 24 * 60 * 60 * 1000;

    if (isSameDay && isWithin24Hours && Array.isArray(session.messages)) {
      return session.messages
        .map((m) => ({
          role: m.role,
          content: sanitizeMessageBody(m.content),
        }))
        .filter((m) => m.content && !m.content.includes('Verified journal records'));
    }
    // Archive previous day's conversation log
    if (Array.isArray(session.messages) && session.messages.length > 0) {
      try {
        const archivesRaw = localStorage.getItem(ARCHIVE_STORAGE_KEY);
        const archives = archivesRaw ? JSON.parse(archivesRaw) : [];
        archives.push({
          day: session.day,
          archivedAt: now,
          messages: session.messages,
        });
        localStorage.setItem(ARCHIVE_STORAGE_KEY, JSON.stringify(archives.slice(-30)));
      } catch {}
    }
    return [];
  } catch {
    return [];
  }
}

function saveDailySigmaSession(messages: Array<{ role: 'user' | 'assistant'; content: string }>) {
  try {
    const today = toLocalDay(new Date());
    const now = Date.now();
    let startedAt = now;
    try {
      const existing = localStorage.getItem(SESSION_STORAGE_KEY);
      if (existing) {
        const parsed = JSON.parse(existing);
        if (parsed.day === today && parsed.startedAt) {
          startedAt = parsed.startedAt;
        }
      }
    } catch {}

    const session: SigmaSession = {
      day: today,
      startedAt,
      updatedAt: now,
      messages,
    };
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  } catch {}
}

function getTodayChamberId(chambers: Record<number, Chamber>): number | null {
  const today = localDateISO();
  const found = Object.values(chambers).find(
    (c) => c.template === 'day' && c.description?.includes(today),
  );
  return found ? found.id : null;
}

interface ChatLine {
  id: number;
  speaker: 'user' | 'termite';
  text: string;
  citations?: CitationChipData[];
}

export default function TermiteDialog({
  open,
  onClose,
  chamber,
  identity,
  journalThoughts = [],
  mbti,
  mbtiConsent = false,
  onOpenMBTI,
  onOpenSigmaMap,
}: {
  open: boolean;
  onClose: () => void;
  chamber: Chamber;
  identity: GridIdentity;
  journalThoughts?: Thought[];
  mbti?: string;
  mbtiConsent?: boolean;
  onOpenMBTI?: () => void;
  onOpenSigmaMap?: () => void;
}) {
  const [log, setLog] = useState<ChatLine[]>([]);
  const [input, setInput] = useState('');
  const [sigmaState, setSigmaState] = useState<SigmaState>(INITIAL_SIGMA_STATE);
  const [isReplying, setIsReplying] = useState(false);
  const [showWhatKnows, setShowWhatKnows] = useState(false);
  const [showGrowthFeed, setShowGrowthFeed] = useState(false);
  const [paused, setPaused] = useState(() => isLearningPaused());
  const idRef = useRef(1);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => subscribeToWipeEpoch(() => {
    idRef.current = 1;
    setInput('');
    setSigmaState(INITIAL_SIGMA_STATE);
    setIsReplying(false);
    setLog([{ id: 0, speaker: 'termite', text: DEFAULT_WELCOME }]);
  }), []);

  const handleToggleLearning = async () => {
    const next = !paused;
    setPaused(next);
    await setLearningPaused(next);
  };

  useEffect(() => {
    if (!open) return;
    setSigmaState(INITIAL_SIGMA_STATE);

    const saved = loadDailySigmaSession();
    if (saved.length > 0) {
      let currentId = 1;
      const loadedLines: ChatLine[] = saved.map((msg) => ({
        id: currentId++,
        speaker: msg.role === 'user' ? 'user' : 'termite',
        text: sanitizeMessageBody(msg.content),
      }));
      idRef.current = currentId;
      setLog(loadedLines);
    } else {
      idRef.current = 1;
      setLog([
        {
          id: 0,
          speaker: 'termite',
          text: DEFAULT_WELCOME,
        },
      ]);
    }
    setInput('');

    // Track dialogue session initiation
    useCitadelStore.getState().updateIdentity((id) => {
      id.sessionCount = (id.sessionCount || 0) + 1;
      id.corruption = Math.max(0, (id.corruption ?? 100.0) - 0.001);
    });

    setTimeout(() => {
      inputRef.current?.focus();
      if (document.pointerLockElement) document.exitPointerLock();
    }, 150);
  }, [open, identity.name]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [log, isReplying]);

  const handleArchiveAndReset = useCallback(() => {
    try {
      const existing = localStorage.getItem(SESSION_STORAGE_KEY);
      if (existing) {
        const session = JSON.parse(existing);
        if (session.messages?.length > 0) {
          const archivesRaw = localStorage.getItem(ARCHIVE_STORAGE_KEY);
          const archives = archivesRaw ? JSON.parse(archivesRaw) : [];
          archives.push({ day: session.day, archivedAt: Date.now(), messages: session.messages });
          localStorage.setItem(ARCHIVE_STORAGE_KEY, JSON.stringify(archives.slice(-30)));
        }
      }
      localStorage.removeItem(SESSION_STORAGE_KEY);
    } catch {}
    idRef.current = 1;
    setSigmaState(INITIAL_SIGMA_STATE);
    const initialLine: ChatLine = {
      id: 0,
      speaker: 'termite',
      text: DEFAULT_WELCOME,
    };
    setLog([initialLine]);
  }, []);

  const transmitMessage = useCallback((rawMessage: string) => {
    const trimmed = rawMessage.trim();
    if (!trimmed || isReplying) return;
    const wipeEpoch = getWipeEpoch();
    setInput('');
    setIsReplying(true);
    const userId = idRef.current++;
    const responseId = idRef.current++;
    const userLine: ChatLine = { id: userId, speaker: 'user', text: trimmed };
    setLog(prev => [...prev, userLine]);

    // Trigger extraction pass on user input
    void runExtractionPass({
      text: trimmed,
      sourceId: `termite_${userId}`,
      sourceDate: toLocalDay(new Date()),
      sourceType: 'chat',
    });

    // Keep this dialogue turn out of the journal retrieval pool.
    const store = useCitadelStore.getState();
    const todayChamberId = getTodayChamberId(store.chambers) ?? chamber.id;
    if (todayChamberId !== null) {
      store.updateChamber(todayChamberId, ch => {
        ch.thoughts.push({
          id: Date.now() + Math.random(),
          text: '[User]: ' + trimmed,
          timestamp: new Date().toISOString(),
          chamberId: todayChamberId,
          tags: ['sigma-chat', 'non-inscription'],
        });
      });
    }

    const history: Array<{ role: 'user' | 'assistant'; content: string }> = [
      ...log,
      userLine,
    ]
      .slice(-12)
      .map(line => ({
        role: line.speaker === 'user' ? 'user' : 'assistant',
        content: line.text,
      }));

    void generateSigmaReplyAsync(
      trimmed,
      chamber,
      identity,
      chamber.thoughts,
      sigmaState,
      history,
      journalThoughts,
    )
      .then(({ reply, newState, citations }) => {
        commitAtWipeEpoch(wipeEpoch, () => {
          setSigmaState(newState);
          const cleanReply = sanitizeMessageBody(reply);
          const replyLine: ChatLine = {
            id: responseId,
            speaker: 'termite',
            text: cleanReply,
            citations,
          };
          const updated = [...log, userLine, replyLine];
          setLog(updated);
          saveDailySigmaSession(
            updated.map(line => ({
              role: line.speaker === 'user' ? 'user' : 'assistant',
              content: line.text,
            })),
          );

          if (todayChamberId !== null) {
            store.updateChamber(todayChamberId, ch => {
              if (!ch.commandLog) ch.commandLog = [];
              ch.commandLog.push('[Sigma Chat] User: ' + trimmed + ' | Sigma: ' + cleanReply);
              ch.thoughts.push({
                id: Date.now() + Math.random(),
                text: '[Sigma]: ' + cleanReply,
                timestamp: new Date().toISOString(),
                chamberId: todayChamberId,
                tags: ['sigma-chat', 'non-inscription'],
              });
            });
          }
        });
      })
      .finally(() => {
        if (isCurrentWipeEpoch(wipeEpoch)) {
          setIsReplying(false);
          setTimeout(() => inputRef.current?.focus(), 40);
        }
      });
  }, [isReplying, chamber, identity, sigmaState, log, journalThoughts]);

  const handleSubmit = useCallback(() => {
    transmitMessage(input);
  }, [input, transmitMessage]);

  const onKey = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') { e.preventDefault(); handleSubmit(); }
      if (e.key === 'Escape') onClose();
    },
    [handleSubmit, onClose],
  );

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center font-mono"
      style={{ animation: 'citadelFadeIn 220ms ease-out' }}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse at 50% 30%, hsl(280 40% 6% / 0.95), hsl(280 40% 2% / 0.97))',
          backdropFilter: 'blur(6px)',
        }}
        onClick={onClose}
      />

      {/* Grid overlay */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.05]"
        style={{
          backgroundImage:
            'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(168, 85, 247, 0.4) 2px, rgba(168, 85, 247, 0.4) 4px)',
        }}
      />

      {/* Panel */}
      <div
        className="relative flex flex-col w-[720px] max-w-[92vw] h-[590px] max-h-[86vh] overflow-hidden"
        style={{
          textRendering: 'geometricPrecision',
          background: 'hsl(280 35% 4% / 0.96)',
          border: '1px solid hsl(280 50% 30% / 0.4)',
          borderRadius: '4px',
          boxShadow: '0 0 80px hsl(280 60% 20% / 0.25), inset 0 0 60px hsl(280 40% 4% / 0.5)',
          animation: 'citadelPanelIn 260ms ease-out',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-3 shrink-0"
          style={{ borderBottom: '1px solid hsl(280 40% 25% / 0.35)' }}
        >
          <div className="flex items-center gap-2.5 flex-wrap">
            <div
              className="h-2.5 w-2.5 rounded-full"
              style={{
                background: '#c084fc',
                boxShadow: '0 0 12px #c084fc, 0 0 24px #a855f7',
                animation: 'termitePulse 1.8s ease-in-out infinite',
              }}
            />
            <span
              className="text-[11px] font-bold tracking-[0.2em]"
              style={{ color: 'hsl(320 80% 70%)' }}
            >
              Σ
            </span>
            <button
              onClick={() => onOpenMBTI?.()}
              className="text-[8px] uppercase tracking-[0.2em] px-2 py-0.5 rounded-full hover:brightness-125 transition-all"
              style={{
                color: 'hsl(190 80% 72%)',
                border: '1px solid hsl(190 60% 38% / 0.45)',
                background: 'hsl(190 40% 10% / 0.7)',
              }}
            >
              MBTI
            </button>
            <button
              onClick={() => onOpenSigmaMap?.()}
              className="text-[8px] uppercase tracking-[0.2em] px-2 py-0.5 rounded-full hover:brightness-125 transition-all"
              style={{
                color: 'hsl(45 90% 72%)',
                border: '1px solid hsl(45 60% 38% / 0.45)',
                background: 'hsl(45 40% 10% / 0.7)',
              }}
              title="View the growth mind map of your sessions generated by Sigma"
            >
              SIGMA MAP
            </button>
            <span
              className="text-[9px] font-mono uppercase tracking-[0.14em] px-2.5 py-0.5 rounded font-bold"
              style={{
                color: '#c084fc',
                border: '1px solid rgba(192, 132, 252, 0.45)',
                background: 'rgba(88, 28, 135, 0.28)',
              }}
              title="Layer 2 in-process Metal voice engine is active and grounded to Citadel memory."
            >
              ● SIGMA VOICE
            </span>
            <button
              onClick={() => setShowWhatKnows(true)}
              className="text-[9px] font-mono uppercase tracking-[0.15em] px-2.5 py-0.5 rounded transition-all hover:bg-purple-900/40"
              style={{
                color: '#e879f9',
                border: '1px solid rgba(232, 121, 249, 0.4)',
                background: 'rgba(88, 28, 135, 0.2)',
              }}
              title="Inspect and audit the structured Player Model records"
            >
              WHAT SIGMA KNOWS
            </button>
            <button
              onClick={() => setShowGrowthFeed(true)}
              className="text-[9px] font-mono uppercase tracking-[0.15em] px-2.5 py-0.5 rounded transition-all hover:bg-purple-900/40"
              style={{
                color: '#a78bfa',
                border: '1px solid rgba(167, 139, 250, 0.4)',
                background: 'rgba(88, 28, 135, 0.2)',
              }}
              title="View the chronological growth feed of updates to your model"
            >
              GROWTH FEED
            </button>
            <button
              onClick={handleToggleLearning}
              className={`text-[9px] font-mono uppercase tracking-[0.15em] px-2.5 py-0.5 rounded transition-all ${
                paused
                  ? 'border border-amber-500/50 text-amber-300 bg-amber-950/40'
                  : 'border border-emerald-500/50 text-emerald-300 bg-emerald-950/40'
              }`}
              title={paused ? 'Learning is paused' : 'Learning is active'}
            >
              LEARN: {paused ? 'PAUSED' : 'ACTIVE'}
            </button>
            <button
              onClick={handleArchiveAndReset}
              className="text-[9px] font-mono uppercase tracking-[0.15em] px-2.5 py-0.5 rounded transition-all hover:bg-purple-900/40"
              style={{
                color: '#d8b4fe',
                border: '1px solid rgba(168, 85, 247, 0.4)',
                background: 'rgba(88, 28, 135, 0.2)',
              }}
              title="Archive current day's chat and start a fresh session"
            >
              ARCHIVE & NEW SESSION
            </button>
            {(mbti || mbtiConsent) && (
              <span
                className="text-[8px] uppercase tracking-[0.2em] px-2 py-0.5 rounded-full"
                style={{
                  color: 'hsl(160 75% 70%)',
                  border: '1px solid hsl(160 60% 35% / 0.45)',
                  background: 'hsl(160 40% 10% / 0.7)',
                }}
              >
                {mbti ? `${mbti}${mbtiConsent ? ' • ON' : ' • OFF'}` : mbtiConsent ? 'PERSONALIZE ON' : 'PERSONALIZE OFF'}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-[10px] uppercase tracking-[0.3em] px-3 py-1 hover:brightness-125 transition-all"
            style={{
              color: 'hsl(280 40% 60%)',
              border: '1px solid hsl(280 40% 35% / 0.3)',
              borderRadius: '2px',
            }}
          >
            ○ Disconnect
          </button>
        </div>

        <style>{`
          @keyframes termitePulse {
            0%, 100% { opacity: 0.7; box-shadow: 0 0 12px #c084fc; }
            50% { opacity: 1; box-shadow: 0 0 24px #a855f7, 0 0 40px #7c3aed; }
          }
          @keyframes termiteDot {
            0%, 60%, 100% { opacity: 0.15; transform: scale(0.8); }
            30% { opacity: 1; transform: scale(1.2); }
          }
        `}</style>

        {/* Chat log */}
        <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-3">
          {log.map(entry => (
            <div
              key={entry.id}
              className="px-4 py-3"
              style={{
                borderRadius: '3px',
                border:
                  entry.speaker === 'termite'
                    ? '1px solid hsl(280 40% 30% / 0.35)'
                    : '1px solid hsl(320 50% 30% / 0.25)',
                background:
                  entry.speaker === 'termite'
                    ? 'hsl(280 20% 6% / 0.5)'
                    : 'hsl(320 30% 6% / 0.35)',
              }}
            >
              <div
                className="text-[11px] font-bold uppercase tracking-[0.3em] mb-1.5"
                style={{
                  color:
                    entry.speaker === 'termite' ? 'hsl(320 80% 70%)' : 'hsl(320 80% 60%)',
                }}
              >
                {entry.speaker === 'termite' ? 'Σ' : '/:'}
              </div>
              <ChatMessage entry={entry} />
            </div>
          ))}

          {isReplying && (
            <div
              className="px-4 py-2.5 text-[13px] italic"
              style={{
                color: 'hsl(280 65% 72%)',
                border: '1px dashed hsl(280 40% 30% / 0.35)',
                background: 'hsl(280 25% 6% / 0.35)',
                borderRadius: '3px',
              }}
            >
              Σ is contemplating the lodge stones...
            </div>
          )}
        </div>

        {/* Quick-commune prompts when starting a session */}
        {log.length <= 2 && !isReplying && (
          <div
            className="px-5 py-2 flex flex-wrap gap-1.5 shrink-0"
            style={{ borderTop: '1px solid hsl(280 40% 25% / 0.15)' }}
          >
            {QUICK_PROMPTS.map(prompt => (
              <button
                key={prompt}
                type="button"
                onClick={() => transmitMessage(prompt)}
                className="text-[10px] px-2.5 py-1 rounded transition-all hover:brightness-125"
                style={{
                  color: 'hsl(280 70% 80%)',
                  background: 'hsl(280 35% 12% / 0.55)',
                  border: '1px solid hsl(280 50% 38% / 0.35)',
                }}
              >
                {prompt}
              </button>
            ))}
          </div>
        )}

        {/* Input */}
        <div
          className="shrink-0 px-5 pb-4 pt-2.5"
          style={{ borderTop: '1px solid hsl(280 40% 25% / 0.25)' }}
        >
          <div className="flex items-center gap-3">
            <span
              className="text-[14px] font-bold shrink-0"
              style={{ color: 'hsl(320 60% 55%)' }}
            >
              /:
            </span>
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={onKey}
              placeholder="Talk to Sigma..."
              className="flex-1 bg-transparent text-[18px] outline-none"
              style={{
                color: 'hsl(320 50% 75%)',
                fontFamily: '"IBM Plex Mono", "Menlo", "Monaco", monospace',
              }}
            />
            <button
              onClick={handleSubmit}
              disabled={!input.trim() || isReplying}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] rounded transition-all hover:brightness-125 disabled:opacity-40"
              style={{
                color: 'hsl(320 90% 85%)',
                background: 'hsl(280 45% 18% / 0.8)',
                border: '1px solid hsl(320 60% 45% / 0.5)',
              }}
              aria-label="Transmit message"
            >
              TRANSMIT ↵
            </button>
          </div>
        </div>
      </div>

      {showWhatKnows && <WhatSigmaKnowsModal onClose={() => setShowWhatKnows(false)} />}
      {showGrowthFeed && <GrowthFeedModal onClose={() => setShowGrowthFeed(false)} />}
    </div>
  );
}

function ChatMessage({ entry }: { entry: ChatLine }) {
  const sigmaLine = entry.speaker === 'termite';

  return (
    <div className="flex flex-col gap-1.5">
      <div
        className={sigmaLine ? 'text-[17px] leading-[1.5] whitespace-pre-wrap tracking-[0.02em]' : 'text-[17px] leading-[1.5] whitespace-pre-wrap'}
        style={{
          color: sigmaLine ? 'hsl(320 80% 75%)' : 'hsl(320 30% 80%)',
          fontFamily: '"IBM Plex Mono", "Menlo", "Monaco", monospace',
        }}
      >
        {sigmaLine ? renderTermiteseText(entry.text) : entry.text}
      </div>

      {sigmaLine && entry.citations && entry.citations.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {entry.citations.map((c) => (
            <CitationChip key={c.id} citation={c} />
          ))}
        </div>
      )}
    </div>
  );
}
