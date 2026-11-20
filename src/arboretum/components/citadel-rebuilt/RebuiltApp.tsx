import { Component, useEffect, useState } from 'react';
import { migrateLegacySave, ensureCanonicalSlotMigration, CANONICAL_SLOT_ID } from './saveSlots';
import { installAllocationWatchdog, perfEnabled } from './devPerf';
// Import ttiProbe as early as possible so `citadel:boot` is marked before
// any menu/module work. The TTI figure v6 verification v1 compares against
// is measured from this point to menu:paint.
import './ttiProbe';

if (perfEnabled) {
  installAllocationWatchdog();
}

import RebuiltGame from './RebuiltGame';

class RebuiltErrorBoundary extends Component<
  { children: React.ReactNode; onReset?: () => void },
  { hasError: boolean; message: string; stack?: string }
> {
  private static readonly AUTO_RECOVER_KEY = 'citadel.rebuilt.autoRecoverV1';

  constructor(props: { children: React.ReactNode; onReset?: () => void }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error) {
    return {
      hasError: true,
      message: error?.message || 'Unknown runtime error',
      stack: error?.stack,
    };
  }

  componentDidCatch(error: Error) {
    console.error('[RebuiltApp] Runtime crash', error);

    const message = String(error?.message || '');
    if (/ReferenceError:\s*chamber is not defined|chamber is not defined/i.test(message)) {
      try {
        const alreadyRetried = sessionStorage.getItem(RebuiltErrorBoundary.AUTO_RECOVER_KEY) === '1';
        if (!alreadyRetried) {
          sessionStorage.setItem(RebuiltErrorBoundary.AUTO_RECOVER_KEY, '1');
          window.location.reload();
          return;
        }
      } catch {
        // If sessionStorage is unavailable, fall through to the error screen.
      }
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 z-[999] bg-[#030611] flex flex-col items-center justify-center text-red-300 font-mono p-8 select-text">
          <div className="text-sm uppercase tracking-[0.2em] mb-3 text-red-400 font-bold">Runtime Error</div>
          <div className="text-xs text-red-200/90 max-w-[720px] text-center break-words bg-red-950/40 p-3 rounded-lg border border-red-500/30">
            {this.state.message}
          </div>
          {this.state.stack && (
            <pre className="mt-3 p-3 bg-black/60 rounded border border-red-500/20 text-[10px] text-red-200/70 max-w-2xl max-h-48 overflow-auto whitespace-pre-wrap font-mono">
              {this.state.stack}
            </pre>
          )}
          <div className="flex items-center gap-3 mt-4">
            <button
              type="button"
              onClick={() => {
                this.setState({ hasError: false, message: '', stack: undefined });
                this.props.onReset?.();
              }}
              className="px-4 py-1.5 rounded-lg border border-cyan-500/40 bg-cyan-950/60 text-cyan-200 text-xs hover:border-cyan-400 cursor-pointer"
            >
              Retry Mount
            </button>
            <div className="text-[10px] text-red-200/50">Restart app if this persists.</div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

type RebuiltAppProps = {
  onExit?: () => void;
  onOpenMindMap?: () => void;
  onOpenSynapticVault?: () => void;
};

export default function RebuiltApp({ onExit, onOpenMindMap, onOpenSynapticVault }: RebuiltAppProps) {
  const [activeSlot, setActiveSlot] = useState<string | null>(CANONICAL_SLOT_ID);

  useEffect(() => {
    void ensureCanonicalSlotMigration();
    migrateLegacySave().then(migrated => {
      if (migrated) setActiveSlot(CANONICAL_SLOT_ID);
    });
  }, []);

  return (
    <div className="relative w-full h-full min-h-[100dvh] overflow-hidden">
      <RebuiltErrorBoundary>
        <RebuiltGame
          key={activeSlot ?? CANONICAL_SLOT_ID}
          slotId={activeSlot ?? CANONICAL_SLOT_ID}
          onReturnToMenu={onExit ?? (() => setActiveSlot(null))}
          onOpenMindMap={onOpenMindMap}
          onOpenSynapticVault={onOpenSynapticVault}
        />
      </RebuiltErrorBoundary>
    </div>
  );
}
