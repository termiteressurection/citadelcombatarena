import { useCallback, useEffect, useRef, useState } from 'react';
import { markMenuMount, markMenuPaint } from './ttiProbe';
import { hideMatrixRain, isMatrixRainEnabled, showMatrixRain } from './matrixRain';
import { isCitadelMicro } from './citadelBuildMode';
import { CitadelScanlineBanner } from './CitadelScanlineBanner';
import MonadSettingsModal from './settings/MonadSettingsModal';
import MonadWipeModal from './settings/MonadWipeModal';
import PurificationDossierModal from './settings/PurificationDossierModal';

interface RebuiltMainMenuProps {
  onPressStart: () => void;
  isTransition?: boolean;
  onTransitionComplete?: () => void;
}

const TERMITE_MATRIX_HAIKUS = [
  'ROOT LODGE BREATHES SOFT / NIGHT GLASS HOLDS OUR QUIET STEPS / NEW FORMS WAKE IN GLOW',
  'RUNE RAIN KEEPS THE WATCH / LOW KEYS SPARK THE OPEN GATE / THOUGHT STREAMS TURN TO LIGHT',
  'SIGMA TENDS THE GRID / STILL LINES DRIFT THROUGH VIOLET / WE WALK DEEPER IN',
];
const TERMITE_MATRIX_SOURCE = TERMITE_MATRIX_HAIKUS.join(' // ').replace(/\s+/g, ' ');
/** One column per track — spans full window width via CSS grid `1fr` columns. */
const MATRIX_RAIN_COLS = 32;
const LODGE_MATRIX_STRIP = TERMITE_MATRIX_SOURCE.slice(0, 72);

function CitadelEyeIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      className={className}
      aria-hidden
    >
      <path d="M32 16 L52 32 L32 48 L12 32 Z" stroke="#a855f7" strokeWidth="1.4" fill="none" opacity="0.72" />
      <circle cx="32" cy="32" r="8" stroke="#ec4899" strokeWidth="1" fill="none" opacity="0.85" />
      <circle cx="32" cy="32" r="3" fill="#fbbf24" opacity="0.65" />
      <path d="M32 8 L56 32 L32 56 L8 32 Z" stroke="#a855f7" strokeWidth="0.5" fill="none" opacity="0.22" />
    </svg>
  );
}

export default function RebuiltMainMenu({
  onPressStart,
  isTransition = false,
  onTransitionComplete,
}: RebuiltMainMenuProps) {
  const canvasRainEnabled = useRef(isMatrixRainEnabled()).current;
  const [menuShellReady, setMenuShellReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const fallbackTimer = window.setTimeout(() => {
      if (!cancelled) setMenuShellReady(true);
    }, 180);
    const ready = document.fonts?.ready ?? Promise.resolve();
    void ready.then(() => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (!cancelled) setMenuShellReady(true);
        });
      });
    });
    return () => {
      cancelled = true;
      window.clearTimeout(fallbackTimer);
    };
  }, []);

  useEffect(() => {
    markMenuMount();
    const raf = requestAnimationFrame(markMenuPaint);
    let rainT: number | undefined;
    if (canvasRainEnabled) {
      rainT = window.setTimeout(() => showMatrixRain(), 120);
    }
    return () => {
      cancelAnimationFrame(raf);
      if (rainT != null) window.clearTimeout(rainT);
      if (canvasRainEnabled) hideMatrixRain();
    };
  }, [canvasRainEnabled]);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [wipeModalOpen, setWipeModalOpen] = useState(false);

  const start = useCallback(() => {
    if (settingsOpen || wipeModalOpen) return;
    onPressStart();
  }, [onPressStart, settingsOpen, wipeModalOpen]);

  // In transition mode, auto-complete after the cinematic stream duration
  useEffect(() => {
    if (!isTransition) return;
    const timer = window.setTimeout(() => {
      onTransitionComplete ? onTransitionComplete() : start();
    }, 1500);
    return () => window.clearTimeout(timer);
  }, [isTransition, onTransitionComplete, start]);

  useEffect(() => {
    if (settingsOpen || wipeModalOpen) return;
    const any = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'Escape') return;
      start();
    };
    window.addEventListener('keydown', any, { once: true });
    return () => window.removeEventListener('keydown', any);
  }, [start, settingsOpen, wipeModalOpen]);

  const gridTemplate = { gridTemplateColumns: `repeat(${MATRIX_RAIN_COLS}, minmax(0, 1fr))` } as const;

  return (
    <div
      className={`relative flex min-h-0 h-full w-full min-h-[100dvh] overflow-hidden text-purple-100 ${
        canvasRainEnabled ? 'bg-transparent' : 'bg-[#030611]'
      }`}
    >
      {isCitadelMicro() && (
        <div
          className="pointer-events-none absolute left-1/2 top-3 z-20 -translate-x-1/2 rounded-full border border-amber-400/40 bg-black/70 px-4 py-1 font-mono text-[9px] uppercase tracking-[0.35em] text-amber-200/90"
          aria-hidden
        >
          Catacombs · VITE_CITADEL_MICRO
        </div>
      )}
      <div
        className="pointer-events-none absolute left-1/2 top-10 z-20 -translate-x-1/2 font-mono text-[10px] uppercase tracking-[0.5em] text-purple-400/60"
        aria-hidden
      >
        [V.1.0.4-ARBORETUM]
      </div>
      {/* Full-bleed matrix rain (CSS fallback when canvas rain is off) */}
      {!canvasRainEnabled && (
        <div
          className="pointer-events-none absolute inset-0 z-0 grid h-full w-full gap-px opacity-[0.34]"
          style={gridTemplate}
          aria-hidden
        >
          {Array.from({ length: MATRIX_RAIN_COLS }).map((_, col) => (
            <div key={col} className="relative min-h-0 overflow-hidden">
              <div
                className="absolute left-0 right-0 top-0 flex flex-col items-center text-[clamp(9px,1.45vw,16px)] leading-[1.12] [font-synthesis:none] [font-feature-settings:'liga'_0] [text-rendering:optimizeSpeed] [-webkit-font-smoothing:none] [font-smooth:none]"
                style={{
                  fontFamily: 'Termitesse, var(--citadel-ui-font)',
                  color: `hsl(${260 + (col % 7) * 4}, 58%, ${50 + (col % 3) * 3}%)`,
                  textShadow: '0 0 10px rgba(196, 181, 253, 0.4), 0 0 1px rgba(88, 28, 135, 0.5)',
                  filter: 'drop-shadow(0 0 3px rgba(124, 58, 237, 0.3))',
                  animation: `matrixFall ${88 + (col % 10) * 7}s linear infinite`,
                  animationDelay: `${-(col * 0.85)}s`,
                }}
              >
                {LODGE_MATRIX_STRIP.repeat(64).split('').map((ch, i) => (
                  <span key={i}>{ch}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <div
        className={
          canvasRainEnabled
            ? 'pointer-events-none absolute inset-0 z-[1] bg-gradient-to-b from-[#030611]/50 via-[#030611]/15 to-[#030611]/80'
            : 'pointer-events-none absolute inset-0 z-[1] bg-gradient-to-b from-[#030611]/20 via-transparent to-[#030611]/85'
        }
        aria-hidden
      />

      <style>{`
        @keyframes matrixFall {
          0% { transform: translateY(-52%); }
          100% { transform: translateY(52%); }
        }
        @keyframes citadelMatrixProgress {
          0% { transform: translateX(-100%); }
          50% { transform: translateX(50%); }
          100% { transform: translateX(200%); }
        }
      `}</style>

      <div
        className={
          'relative z-10 flex h-full min-h-[100dvh] w-full flex-col items-center justify-center px-6 py-16 transition-opacity duration-150 ease-out' +
          (menuShellReady ? ' opacity-100' : ' opacity-0')
        }
      >
        <div
          className="pointer-events-auto flex cursor-pointer select-none flex-col items-center"
          onClick={start}
          onKeyDown={e => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              start();
            }
          }}
          tabIndex={0}
          role="button"
          aria-label={isTransition ? 'Descending into Citadel' : 'Press any button to start'}
        >
          <CitadelEyeIcon className="h-[min(28vw,160px)] w-[min(28vw,160px)] shrink-0 animate-pulse opacity-90 drop-shadow-[0_0_28px_rgba(168,85,247,0.35)]" />
          <div className="mt-6 flex justify-center">
            <CitadelScanlineBanner />
          </div>
          {isTransition ? (
            <div className="mt-6 flex flex-col items-center gap-2">
              <p className="termite-16bit text-center text-[clamp(11px,1.3vw,14px)] tracking-[0.25em] text-cyan-200 uppercase font-mono animate-pulse">
                [ DESCENDING INTO THE CITADEL ]
              </p>
              <div className="w-40 h-0.5 bg-purple-900/60 rounded-full overflow-hidden mt-1.5">
                <div
                  className="h-full bg-gradient-to-r from-transparent via-cyan-400 to-transparent w-full"
                  style={{ animation: 'citadelMatrixProgress 1.4s ease-in-out infinite' }}
                />
              </div>
            </div>
          ) : (
            <p className="termite-16bit mt-6 text-center text-[clamp(12px,1.5vw,15px)] tracking-wide text-purple-200/85">
              press any key to start (or any controller button)
            </p>
          )}
        </div>
      </div>

      {!isTransition && (
        <>
          {/* Settings gear icon in the bottom left of the Monad */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setSettingsOpen(true);
            }}
            className="pointer-events-auto fixed bottom-5 left-5 z-40 flex items-center gap-2 rounded-xl border border-purple-500/40 bg-[#080414]/90 px-3.5 py-2.5 font-mono text-xs uppercase tracking-widest text-purple-200 shadow-[0_0_20px_rgba(168,85,247,0.25)] backdrop-blur-md transition-all hover:scale-105 hover:border-amber-400 hover:text-amber-200"
            title="Open Monad Settings"
            aria-label="Monad Settings"
          >
            <span className="text-base leading-none">⚙</span>
            <span className="text-[10px] hidden sm:inline font-bold">Settings</span>
          </button>

          {/* First-class Wipe Sanctuary action on the Monad menu screen */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setWipeModalOpen(true);
            }}
            data-testid="monad-menu-wipe-btn"
            className="pointer-events-auto fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-xl border border-rose-500/50 bg-[#16040a]/90 px-3.5 py-2.5 font-mono text-xs uppercase tracking-widest text-rose-200 shadow-[0_0_25px_rgba(244,63,94,0.3)] backdrop-blur-md transition-all hover:scale-105 hover:border-rose-400 hover:text-white hover:bg-rose-950/80"
            title="Universal Wipe: Reset Sanctuary to First-Run State"
            aria-label="Wipe Sanctuary"
          >
            <span className="text-base leading-none text-rose-400">⚠</span>
            <span className="text-[10px] font-bold tracking-wider">Wipe Sanctuary</span>
          </button>

          <MonadSettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
          <MonadWipeModal open={wipeModalOpen} onClose={() => setWipeModalOpen(false)} />
          <PurificationDossierModal />
        </>
      )}
    </div>
  );
}
