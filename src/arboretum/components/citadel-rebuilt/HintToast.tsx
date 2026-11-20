import { useState, useEffect, useCallback, useRef } from 'react';

/* ═══════════════════════════════════════════════════════
   Hint Toast — Contextual feature discovery
   Small floating notification at bottom-center.
   Icon + short phrase, auto-dismisses.
   ═══════════════════════════════════════════════════════ */

interface HintDef {
  id: string;
  icon: string;
  text: string;
  actionLabel?: string;
}

const HINTS: { check: (ctx: HintContext) => boolean; hint: HintDef }[] = [
  { check: c => c.thoughtCount === 1, hint: { id: 'inscribe', icon: '✎', text: 'Capture another thought while the thread is warm', actionLabel: 'Inscribe' } },
  { check: c => c.thoughtCount === 3, hint: { id: 'map', icon: '🗺', text: 'See your memory shape in the constellation map', actionLabel: 'Open Map' } },
  { check: c => c.portalCount === 1, hint: { id: 'portal-walk', icon: '◇', text: 'Walk through your first portal', actionLabel: 'Create Path' } },
  { check: c => c.thoughtCount >= 4 && c.portalCount >= 1, hint: { id: 'terminal', icon: '⌘', text: 'Open terminal to unlock deeper commands', actionLabel: 'Open Terminal' } },
  { check: c => c.sessionMinutes >= 8 && c.thoughtCount >= 3, hint: { id: 'sigma', icon: 'Σ', text: 'The Sigma is ready for reflection', actionLabel: 'Talk to Sigma' } },
  { check: c => c.sessionMinutes >= 10 && c.thoughtCount >= 4, hint: { id: 'termite', icon: '✧', text: 'Consult The Architect for pattern insight', actionLabel: 'Talk to Termite' } },
  { check: c => c.thoughtCount >= 6 && c.portalCount >= 2, hint: { id: 'mirror', icon: '🪞', text: 'Reveal your recurring language pattern', actionLabel: 'Open Mirror' } },
  { check: c => c.thoughtCount >= 5 && c.portalCount >= 2, hint: { id: 'graph', icon: '◈', text: 'View your chamber graph topology', actionLabel: 'Open Graph' } },
];

interface HintContext {
  thoughtCount: number;
  portalCount: number;
  sessionMinutes: number;
  dismissedHints: string[];
}

interface HintToastProps {
  thoughtCount: number;
  portalCount: number;
  sessionStart: number;
  onAction?: (hintId: string) => void;
}

export default function HintToast({ thoughtCount, portalCount, sessionStart, onAction }: HintToastProps) {
  const [visible, setVisible] = useState(false);
  const [current, setCurrent] = useState<HintDef | null>(null);
  const dismissed = useRef<Set<string>>(new Set());
  const lastCheck = useRef(0);

  const checkHints = useCallback(() => {
    const now = Date.now();
    if (now - lastCheck.current < 5000) return; // Don't check more than once per 5s
    lastCheck.current = now;

    const ctx: HintContext = {
      thoughtCount,
      portalCount,
      sessionMinutes: Math.floor((now - sessionStart) / 60000),
      dismissedHints: [...dismissed.current],
    };

    for (const { check, hint } of HINTS) {
      if (dismissed.current.has(hint.id)) continue;
      if (check(ctx)) {
        dismissed.current.add(hint.id);
        setCurrent(hint);
        setVisible(true);
        // Auto-dismiss after 5 seconds
        setTimeout(() => setVisible(false), 5000);
        return;
      }
    }
  }, [thoughtCount, portalCount, sessionStart]);

  useEffect(() => {
    checkHints();
  }, [thoughtCount, portalCount, checkHints]);

  // Also check periodically for time-based hints
  useEffect(() => {
    const interval = setInterval(checkHints, 10000);
    return () => clearInterval(interval);
  }, [checkHints]);

  if (!visible || !current) return null;

  return (
    <div
      className="fixed z-[80] left-1/2 -translate-x-1/2 pointer-events-none"
      style={{
        bottom: '90px',
        animation: 'slideUp 400ms ease-out',
      }}
    >
      <div
        className="flex items-center gap-3 px-5 py-3 rounded-xl pointer-events-auto"
        style={{
          background: 'rgba(10, 4, 20, 0.85)',
          border: '1px solid rgba(168, 85, 247, 0.2)',
          boxShadow: '0 0 20px rgba(168, 85, 247, 0.06)',
          backdropFilter: 'blur(8px)',
          opacity: visible ? 1 : 0,
          transition: 'opacity 400ms ease',
        }}
      >
        <span className="text-lg" style={{ filter: 'drop-shadow(0 0 4px rgba(168,85,247,0.4))' }}>
          {current.icon}
        </span>
        <span className="text-[10px] font-mono tracking-[0.12em] text-purple-200/70 uppercase flex-1">
          {current.text}
        </span>
        {current.actionLabel && onAction && (
          <button
            className="rounded border border-purple-300/25 px-2 py-1 text-[9px] font-mono uppercase tracking-[0.12em] text-purple-100/80 hover:bg-purple-700/20"
            onClick={() => {
              onAction(current.id);
              setVisible(false);
            }}
          >
            {current.actionLabel}
          </button>
        )}
        <button
          className="rounded border border-purple-300/10 px-2 py-1 text-[9px] font-mono uppercase tracking-[0.12em] text-purple-300/45 hover:text-purple-200/70"
          onClick={() => setVisible(false)}
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
