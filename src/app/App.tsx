import { Suspense, lazy, useEffect, useState } from 'react';
import { useCitadelStore } from '@/core/state/citadelStore';
import { WelcomeLandingScreen } from '@/features/monad/WelcomeLandingScreen';
import { WorldAestheticSelector } from '@/features/monad/WorldAestheticSelector';
import { SynapticVaultModal } from '@/features/synaptic-vault/SynapticVaultModal';
import { resolveWritableDay } from '@/arboretum/components/citadel-rebuilt/writablePath';
import { tokens } from './styles';

const RebuiltApp = lazy(() => import('@/arboretum/components/citadel-rebuilt/RebuiltApp'));

const IS_DEV = Boolean((import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV);

export function App() {
  const hydrated = useCitadelStore((s) => s.hydrated);
  const state = useCitadelStore((s) => s.state);
  const submitAnchor = useCitadelStore((s) => s.submitAnchor);
  const writeToday = useCitadelStore((s) => s.writeToday);

  const todayCell = state.days[state.today];
  const isAnchorComplete = todayCell?.dailyAnchorComplete ?? false;

  const [mode, setMode] = useState<'monad' | 'worldSelect' | 'desktopWorld'>('monad');
  const [activePortal, setActivePortal] = useState<'none' | 'mindmap' | 'synaptic'>('none');
  const [dissolvingWorld, setDissolvingWorld] = useState(false);

  const dissolveToMonad = () => {
    setDissolvingWorld(true);
    window.setTimeout(() => {
      setMode('monad');
      setDissolvingWorld(false);
    }, 420);
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F11') {
        e.preventDefault();
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch(() => {});
        } else {
          document.exitFullscreen().catch(() => {});
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Midnight rollover watcher without restart
  useEffect(() => {
    if (!hydrated) return;

    const checkRollover = () => {
      const canonicalStore = useCitadelStore.getState();
      const writableToday = resolveWritableDay();
      if (canonicalStore.state.today !== writableToday) {
        canonicalStore.rollover();
      }
    };

    const interval = setInterval(checkRollover, 5000);
    window.addEventListener('focus', checkRollover);
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') checkRollover();
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', checkRollover);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [hydrated]);

  // Default initial mode after hydration is Monad
  useEffect(() => {
    if (hydrated) {
      setMode('monad');
    }
  }, [hydrated]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!hydrated) {
    return (
      <div
        style={{
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 24,
          fontFamily: tokens.fontMono,
          background: tokens.appBg,
          color: tokens.text,
        }}
      >
        <div
          style={{
            width: 64,
            height: 64,
            border: `1px solid ${tokens.accent}`,
            transform: 'rotate(45deg)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div style={{ width: 12, height: 12, background: tokens.accent }} />
        </div>
        <div style={{ textAlign: 'center' }}>
          <span
            style={{
              fontSize: tokens.fontSizeXs,
              color: tokens.textDim,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              display: 'block',
              marginBottom: 8,
            }}
          >
            Loading sanctuary
          </span>
          <span
            style={{
              fontSize: '1.4rem',
              color: tokens.text,
              letterSpacing: '0.08em',
              fontWeight: 300,
              textTransform: 'uppercase',
            }}
          >
            [The_Citadel]
          </span>
        </div>
      </div>
    );
  }

  if (mode === 'monad') {
    return (
      <WelcomeLandingScreen
        onEnterWorld={() => setMode('worldSelect')}
      />
    );
  }

  if (mode === 'worldSelect') {
    return (
      <WorldAestheticSelector
        onEnterArboretum={() => setMode('desktopWorld')}
        onBack={() => setMode('monad')}
      />
    );
  }

  if (mode === 'desktopWorld') {
    return (
      <>
        <Suspense fallback={<div style={{ height: '100vh', background: tokens.appBg }} />}>
          <RebuiltApp
            onExit={dissolveToMonad}
            onOpenSynapticVault={() => setActivePortal('synaptic')}
          />
        </Suspense>
        {dissolvingWorld && (
          <div
            aria-hidden="true"
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 1000,
              pointerEvents: 'none',
              background: 'linear-gradient(135deg, #020006, #0a0414, #020006)',
              animation: 'citadel-world-dissolve 420ms ease-in forwards',
            }}
          />
        )}
        <style>{`@keyframes citadel-world-dissolve { from { opacity: 0; filter: contrast(1); } to { opacity: 1; filter: contrast(1.8); } }`}</style>
        {activePortal === 'synaptic' && <SynapticVaultModal onClose={() => setActivePortal('none')} />}
      </>
    );
  }
}

