import { Suspense } from 'react';
import NamePromptOverlay from './NamePromptOverlay';
import { Z } from './ZRegistry';

type Props = {
  transitioning: boolean;
  transLabel: string;
  moshIntensity?: number;
  bookmarksOpen: boolean;
  setBookmarksOpen: React.Dispatch<React.SetStateAction<boolean>>;
  bookmarks: any[];
  state: any;
  scene: string;
  uiOpen: boolean;
  clipboardToast: boolean;
  snapshotFlash: boolean;
  namePromptOpen: boolean;
  setNamePromptOpen: React.Dispatch<React.SetStateAction<boolean>>;
  onEnterChamber: (id: number) => void;
};

export default function RebuiltGameUtilityOverlays({
  transitioning,
  transLabel,
  moshIntensity = 0,
  bookmarksOpen,
  setBookmarksOpen,
  bookmarks,
  state,
  uiOpen,
  clipboardToast,
  snapshotFlash,
  namePromptOpen,
  setNamePromptOpen,
  onEnterChamber,
}: Props) {
  const isMosh = moshIntensity > 0;

  return (
    <>
      {transitioning && (
        <div className="fixed inset-0 flex items-center justify-center pointer-events-none" style={{ zIndex: Z.TRANSITION_WIPE, animation: 'transWipe 980ms ease-in-out forwards' }}>
          <div className="absolute inset-0" style={{ background: isMosh ? '#000' : 'radial-gradient(ellipse at 50% 50%, hsl(270 40% 4%), #000)' }} />
          
          {/* Data-Mosh Fragments */}
          {isMosh && (
            <div className="absolute inset-0 overflow-hidden opacity-40">
              {[...Array(12)].map((_, i) => (
                <div
                  key={i}
                  className="absolute bg-white/20"
                  style={{
                    left: `${Math.random() * 100}%`,
                    top: `${Math.random() * 100}%`,
                    width: `${20 + Math.random() * 60}%`,
                    height: `${2 + Math.random() * 8}px`,
                    backgroundColor: i % 3 === 0 ? '#f43f5e' : i % 2 === 0 ? '#3b82f6' : '#a855f7',
                    animation: `moshFlicker ${100 + Math.random() * 200}ms steps(2) infinite`,
                    filter: 'blur(2px)',
                  }}
                />
              ))}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="grid grid-cols-8 gap-4 opacity-20">
                  {[...Array(64)].map((_, i) => (
                    <div key={i} className="h-4 w-4 bg-white animate-pulse" style={{ animationDelay: `${i * 10}ms` }} />
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="relative flex flex-col items-center gap-3">
            <p className="citadel-display text-[18px] uppercase tracking-[0.28em] [--display-color:rgba(243,240,255,0.92)]">
              {isMosh ? 'DATA_MOSH_PROTOCOL' : transLabel}
            </p>
            <p className="termite-16bit text-[10px] uppercase tracking-[0.36em]" style={{ color: isMosh ? '#f43f5e' : 'hsl(280 80% 72% / 0.72)', textShadow: isMosh ? '0 0 20px #f43f5e88' : '0 0 20px hsl(280 80% 72% / 0.3)' }}>
              {isMosh ? 'DEEP_GEOMETRY_STRAIN' : 'STABILIZING GEOMETRY'}
            </p>
            {isMosh && (
              <p className="mt-4 text-[8px] opacity-30 tracking-widest text-white font-mono">
                SEGMENT_FRAGMENTATION: {Math.floor(moshIntensity * 100)}%
              </p>
            )}
          </div>
        </div>
      )}

      {bookmarksOpen && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/70 font-mono" style={{ zIndex: Z.BOOKMARKS_MODAL }} onClick={() => setBookmarksOpen(false)}>
          <div className="w-[520px] max-w-[92vw] rounded-xl border border-purple-300/25 bg-[#0b0518]/95 p-5" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <p className="text-[10px] uppercase tracking-[0.25em] text-purple-200/70">Bookmarked Chambers</p>
              <button className="rounded border border-purple-300/20 px-2 py-1 text-[9px] uppercase tracking-[0.15em] text-purple-100/60" onClick={() => setBookmarksOpen(false)}>
                Esc
              </button>
            </div>
            <div className="max-h-[52vh] overflow-y-auto space-y-2 pr-1">
              {bookmarks.length === 0 && (
                <p className="text-[10px] uppercase tracking-[0.14em] text-purple-300/35">No bookmarks yet. Use terminal `bookmark` in a chamber.</p>
              )}
              {bookmarks.map((ch) => (
                <button
                  key={ch.id}
                  className="w-full rounded border border-purple-300/15 bg-purple-950/20 px-3 py-2 text-left transition-colors hover:bg-purple-800/20"
                  onClick={() => {
                    onEnterChamber(ch.id);
                    setBookmarksOpen(false);
                  }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] uppercase tracking-[0.14em] text-purple-100/80">{ch.name}</span>
                    <span className="text-[9px] uppercase tracking-[0.12em] text-purple-300/40">d{ch.depth}</span>
                  </div>
                  <div className="mt-1 text-[9px] uppercase tracking-[0.12em] text-purple-200/40">
                    {ch.thoughts.length} thoughts · {ch.doors.length} portals
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {clipboardToast && (
        <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 font-mono pointer-events-none" style={{ zIndex: Z.CENTER_TOAST, animation: 'citadelFadeIn 150ms ease-out' }}>
          <p className="text-[10px] uppercase tracking-[0.3em] text-purple-300/70 bg-black/70 px-4 py-2 rounded-lg">Copied to clipboard</p>
        </div>
      )}

      {snapshotFlash && <div className="fixed inset-0 pointer-events-none bg-white/20" style={{ zIndex: Z.FLASH_OVERLAY, animation: 'citadelFadeIn 50ms ease-out' }} />}

      {namePromptOpen && (
        <NamePromptOverlay
          onSetName={(name) => {
            state.setIdentity(name);
            setNamePromptOpen(false);
          }}
          onSkip={() => setNamePromptOpen(false)}
        />
      )}

      <style>{`
        @keyframes transWipe {
          0% { opacity: 0; }
          24% { opacity: 1; }
          78% { opacity: 1; }
          100% { opacity: 0; }
        }
        @keyframes moshFlicker {
          0% { transform: translateX(-10%) skewX(0deg); opacity: 0.8; }
          50% { transform: translateX(10%) skewX(15deg); opacity: 0.4; }
          100% { transform: translateX(-5%) skewX(-15deg); opacity: 0.9; }
        }
      `}</style>
    </>
  );
}
