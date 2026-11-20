import type { CSSProperties } from 'react';
import type { RitualStatus } from '@/core/rules/ritualEngine';
import { useCitadelStore } from '@/core/state/citadelStore';
import { tokens } from '../styles';

const PHASE_LABELS: Record<string, string> = {
  morning: 'Morning — complete your morning ritual to begin',
  midday: 'Midday — the day is open',
  reflect: 'Reflect — evening ritual awaits',
  commune: 'Commune — both rituals complete',
};

const PHASE_COLORS: Record<string, string> = {
  morning: tokens.morning,
  midday: tokens.midday,
  reflect: tokens.reflect,
  commune: tokens.commune,
};

interface Props {
  ritual: RitualStatus;
}

export function RitualBanner({ ritual }: Props) {
  const completeRitualStep = useCitadelStore((s) => s.completeRitualStep);
  const color = PHASE_COLORS[ritual.phase] ?? tokens.accent;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 20px',
        borderBottom: `1px solid ${tokens.border}`,
        background: tokens.surface,
        gap: 12,
      }}
    >
      <span
        style={{
          fontFamily: tokens.fontMono,
          fontSize: tokens.fontSizeSm,
          color,
          letterSpacing: '0.03em',
        }}
      >
        {PHASE_LABELS[ritual.phase]}
      </span>

      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
        {!ritual.morningDone && (
          <button
            onClick={() => completeRitualStep('morning')}
            style={btnStyle(tokens.morning)}
            title="Mark morning ritual complete"
          >
            Morning +
          </button>
        )}
        {ritual.morningDone && !ritual.eveningDone && (
          <button
            onClick={() => completeRitualStep('evening')}
            style={btnStyle(tokens.reflect)}
            title="Mark evening ritual complete"
          >
            Evening +
          </button>
        )}
        {ritual.sealed && (
          <span
            style={{
              fontFamily: tokens.fontMono,
              fontSize: tokens.fontSizeXs,
              color: tokens.commune,
              padding: '4px 10px',
              border: `1px solid ${tokens.commune}`,
              borderRadius: tokens.radius,
              opacity: 0.7,
            }}
          >
            sealed
          </span>
        )}
      </div>
    </div>
  );
}

function btnStyle(color: string): CSSProperties {
  return {
    fontFamily: tokens.fontMono,
    fontSize: tokens.fontSizeXs,
    color,
    background: 'transparent',
    border: `1px solid ${color}`,
    borderRadius: tokens.radius,
    padding: '4px 12px',
    cursor: 'pointer',
    letterSpacing: '0.04em',
    opacity: 0.85,
  };
}
