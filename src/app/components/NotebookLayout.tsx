import { useState, useCallback, lazy, Suspense } from 'react';
import type { LocalDay } from '@/core/model/types';
import { getRitualStatus } from '@/core/rules/ritualEngine';
import { useCitadelStore } from '@/core/state/citadelStore';
import { prevDay, nextDay, canGoBack, canGoForward } from '@/features/chrono-dial/chronoDial';
import { ChronoDial } from '@/features/chrono-dial/ChronoDialWidget';
import { calcHubDensity } from '@/features/world/hubDensity';
import { WorldStatusPanel } from '@/features/world/WorldStatusPanel';
import { DaySidebar } from './DaySidebar';
import { DayPage } from './DayPage';
import { RitualBanner } from './RitualBanner';
import { RitualCommandBar } from './RitualCommandBar';
import { AetherBackground } from './AetherBackground';
import { WindowControls } from './WindowControls';
import { FloppyPanel } from './FloppyPanel';
import { SigmaSkull } from './SigmaSkull';
const MindmapShell = lazy(() => import('@/features/world/mindmap3d/MindmapShell').then(m => ({ default: m.MindmapShell })));
import { tokens } from '../styles';
import { SigmaChatPanel } from '@/features/sigma/SigmaChatPanel';
import { SynapticVaultModal } from '@/features/synaptic-vault/SynapticVaultModal';

type NotebookLayoutProps = {
  onOpenDesktopWorld?: () => void;
  onOpenMonad?: () => void;
};

export function NotebookLayout({ onOpenDesktopWorld, onOpenMonad }: NotebookLayoutProps) {
  const state = useCitadelStore((s) => s.state);
  const ritual = getRitualStatus({ today: state.today, ritual: state.ritual });
  const density = calcHubDensity(state);

  const allDays = Object.keys(state.days) as LocalDay[];
  const oldest = allDays.length > 0
    ? allDays.reduce((a, b) => (a < b ? a : b))
    : state.today;

  const [selectedDay, setSelectedDay] = useState<LocalDay>(state.today);
  const [activeChamber, setActiveChamber] = useState<'none' | 'floppy' | 'mindmap' | 'sigma' | 'synaptic'>('none');

  const handlePrev = useCallback(() => {
    if (canGoBack(selectedDay, oldest)) setSelectedDay(prevDay(selectedDay));
  }, [selectedDay, oldest]);

  const handleNext = useCallback(() => {
    if (canGoForward(selectedDay, state.today)) setSelectedDay(nextDay(selectedDay, state.today));
  }, [selectedDay, state.today]);

  const dayCell = state.days[selectedDay];

  return (
    <AetherBackground>
      <div
        className="citadel-sanctuary"
        data-phase={ritual.phase}
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: '100vh',
          color: tokens.text,
          fontFamily: tokens.fontSans,
          fontSize: tokens.fontSizeBase,
        }}
      >
        {/* Top bar — Drag Region */}
        <header
          data-tauri-drag-region
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: `0 ${tokens.gap}px`,
            height: 48,
            borderBottom: `1px solid ${tokens.border}`,
            background: tokens.surface,
            flexShrink: 0,
             gap: tokens.gap,
            cursor: 'default',
          }}
        >
          <SigmaSkull />
          <span
            className="citadel-glow-accent"
            style={{
              fontFamily: tokens.fontMono,
              fontSize: tokens.fontSizeSm,
              color: tokens.accent,
              letterSpacing: '0.06em',
              fontWeight: 600,
              pointerEvents: 'none',
            }}
          >
            CITADEL
          </span>
          <span
            style={{
              fontFamily: tokens.fontMono,
              fontSize: tokens.fontSizeXs,
              color: tokens.textDim,
              pointerEvents: 'none',
            }}
          >
            {state.identity.name}
          </span>

          <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
            <ChronoDial
              current={selectedDay}
              today={state.today}
              oldest={oldest}
              onNavigate={setSelectedDay}
            />
          </div>

          <span
            style={{
              fontFamily: tokens.fontMono,
              fontSize: tokens.fontSizeXs,
              color: tokens.textDim,
              pointerEvents: 'none',
            }}
          >
            streak {state.identity.streak}
          </span>

          {onOpenMonad && (
            <button
              onClick={onOpenMonad}
              title="Open Monad Psychospiritual Priming Altar"
              style={{
                background: 'rgba(168, 85, 247, 0.15)',
                border: '1px solid rgba(168, 85, 247, 0.5)',
                color: '#d8b4fe',
                padding: '4px 10px',
                borderRadius: tokens.radius,
                fontFamily: tokens.fontMono,
                fontSize: tokens.fontSizeXs,
                cursor: 'pointer',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}
            >
              ✦ MONAD
            </button>
          )}

          <button
            onClick={() => setActiveChamber('sigma')}
            style={{
              background: 'transparent',
              border: `1px solid ${tokens.accent}`,
              color: tokens.accent,
              padding: '4px 8px',
              borderRadius: tokens.radius,
              fontFamily: tokens.fontMono,
              fontSize: tokens.fontSizeXs,
              cursor: 'pointer',
              marginLeft: tokens.gap,
            }}
          >
            COMMUNE
          </button>

          <WindowControls />
        </header>
        <RitualBanner ritual={ritual} />

        {/* Command bar */}
        <RitualCommandBar
          ritual={ritual}
          onNavigatePrev={canGoBack(selectedDay, oldest) ? handlePrev : undefined}
          onNavigateNext={canGoForward(selectedDay, state.today) ? handleNext : undefined}
        />

        {/* Body */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          <DaySidebar
            days={allDays}
            today={state.today}
            selected={selectedDay}
            onSelect={setSelectedDay}
          />
          <main
            style={{
              flex: 1,
              overflowY: 'auto',
              background: tokens.appBg,
              padding: tokens.gap,
            }}
          >
            <DayPage dayCell={dayCell} day={selectedDay} today={state.today} onReturnToHub={() => setSelectedDay(state.today)} />
          </main>
          <WorldStatusPanel 
            state={state} 
            ritual={ritual} 
            density={density} 
            onOpenFloppy={() => setActiveChamber('floppy')}
            onOpenMindMap={() => setActiveChamber('mindmap')}
            onOpenSynapticVault={() => setActiveChamber('synaptic')}
            onOpenDesktopWorld={onOpenDesktopWorld}
            onTeleport={(day) => {
              setSelectedDay(day);
              setActiveChamber('none');
            }}
          />
        </div>

        {activeChamber === 'floppy' && <FloppyPanel onClose={() => setActiveChamber('none')} />}
        {activeChamber === 'sigma' && <SigmaChatPanel onClose={() => setActiveChamber('none')} />}
        {activeChamber === 'synaptic' && <SynapticVaultModal onClose={() => setActiveChamber('none')} />}
          <MindmapShell
            open={activeChamber === 'mindmap'}
            onClose={() => setActiveChamber('none')}
          />
        <div className="crt-overlay-2d" />
      </div>
    </AetherBackground>
  );
}
