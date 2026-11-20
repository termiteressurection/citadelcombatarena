import { useEffect } from 'react';
import { getCitadelSettings } from './settings/citadelSettings';

interface PauseMenuModalProps {
  open: boolean;
  onResume: () => void;
  onDissolveToMonad: () => void;
  sceneName?: string;
  onOpenSettings?: () => void;
  onOpenWipe?: () => void;
}

export default function PauseMenuModal({
  open,
  onResume,
  onDissolveToMonad,
  sceneName = 'Citadel Core',
  onOpenSettings,
  onOpenWipe,
}: PauseMenuModalProps) {
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onResume();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onResume]);

  if (!open) return null;

  const settings = getCitadelSettings();

  return (
    <div
      className="fixed inset-0 z-[290] flex items-center justify-center p-4 font-mono select-none"
      style={{
        background: 'rgba(3, 2, 8, 0.85)',
        backdropFilter: 'blur(10px)',
        animation: 'citadelFadeIn 160ms ease-out',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onResume();
      }}
    >
      <div
        className="relative flex flex-col items-center w-[440px] max-w-[92vw] rounded-2xl border border-purple-500/40 bg-[#070312]/95 px-8 py-8 text-purple-100 shadow-[0_0_80px_rgba(168,85,247,0.3)] text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="citadel-display text-[26px] uppercase tracking-[0.28em] text-amber-300 drop-shadow-[0_0_16px_rgba(251,191,36,0.5)]">
          PAUSED
        </div>

        <div className="mt-2 text-[10px] uppercase tracking-[0.24em] text-purple-300/60">
          GATEWAY TO MONAD · {sceneName}
        </div>

        <div className="mt-4 mb-6 px-4 py-2 rounded-lg border border-purple-500/20 bg-purple-950/20 text-xs text-purple-200/80">
          Active Traveler: <span className="font-bold text-amber-300">{settings.userName}</span>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-3 w-full">
          <button
            type="button"
            onClick={onResume}
            className="w-full py-3 rounded-xl border border-cyan-400/50 bg-gradient-to-r from-cyan-950/40 via-purple-950/30 to-cyan-950/40 font-bold text-xs uppercase tracking-[0.2em] text-cyan-200 shadow-lg shadow-cyan-950/40 hover:border-cyan-300 hover:text-cyan-50 hover:scale-[1.02] transition-all"
          >
            ▶ Resume Citadel
          </button>

          <button
            type="button"
            onClick={onDissolveToMonad}
            className="w-full py-3 rounded-xl border border-amber-500/50 bg-gradient-to-r from-amber-950/40 via-purple-950/30 to-amber-950/40 font-bold text-xs uppercase tracking-[0.2em] text-amber-200 shadow-lg shadow-amber-950/40 hover:border-amber-300 hover:text-amber-50 hover:scale-[1.02] transition-all"
          >
            ✦ Dissolve Back to Monad
          </button>

          {onOpenSettings && (
            <button
              type="button"
              onClick={onOpenSettings}
              className="w-full py-2.5 rounded-xl border border-purple-500/30 bg-purple-950/20 text-xs uppercase tracking-[0.16em] text-purple-300 hover:bg-purple-900/30 hover:text-purple-100 transition-colors"
            >
              ⚙ Monad Settings
            </button>
          )}

          {onOpenWipe && (
            <button
              type="button"
              onClick={onOpenWipe}
              data-testid="pause-open-wipe-btn"
              className="w-full py-2.5 rounded-xl border border-rose-500/35 bg-rose-950/25 text-xs uppercase tracking-[0.16em] text-rose-300 hover:bg-rose-900/35 hover:text-rose-100 transition-colors"
            >
              ⚠ Full Sanctuary Wipe
            </button>
          )}
        </div>

        <div className="mt-6 text-[10px] uppercase tracking-widest text-purple-400/40">
          Press ESC to resume
        </div>
      </div>
    </div>
  );
}
