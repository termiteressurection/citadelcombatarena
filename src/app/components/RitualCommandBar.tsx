import { useEffect, useCallback } from 'react';
import type { RitualStatus } from '@/core/rules/ritualEngine';
import { useCitadelStore } from '@/core/state/citadelStore';
import { tokens } from '../styles';

interface Props {
  ritual: RitualStatus;
  onNavigatePrev?: () => void;
  onNavigateNext?: () => void;
}

/**
 * RitualCommandBar — keyboard + controller parity command strip.
 *
 * Keyboard shortcuts:
 *   M  — complete morning ritual
 *   E  — complete evening ritual
 *   [  — navigate to previous day
 *   ]  — navigate to next day
 */
export function RitualCommandBar({ ritual, onNavigatePrev, onNavigateNext }: Props) {
  const completeRitualStep = useCitadelStore((s) => s.completeRitualStep);

  const completeMorning = useCallback(() => {
    if (ritual.morningDone) return;
    completeRitualStep('morning');
  }, [ritual.morningDone, completeRitualStep]);

  const completeEvening = useCallback(() => {
    if (!ritual.morningDone || ritual.eveningDone) return;
    completeRitualStep('evening');
  }, [ritual.morningDone, ritual.eveningDone, completeRitualStep]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      switch (e.key.toLowerCase()) {
        case 'm': completeMorning(); break;
        case 'e': completeEvening(); break;
        case '[': onNavigatePrev?.(); break;
        case ']': onNavigateNext?.(); break;
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [completeMorning, completeEvening, onNavigatePrev, onNavigateNext]);

  const commands = [
    { cmdKey: 'M', label: 'Morning', action: completeMorning, active: !ritual.morningDone, done: ritual.morningDone },
    { cmdKey: 'E', label: 'Evening', action: completeEvening, active: ritual.morningDone && !ritual.eveningDone, done: ritual.eveningDone },
    { cmdKey: '[', label: 'Prev day', action: () => onNavigatePrev?.(), active: !!onNavigatePrev, done: false },
    { cmdKey: ']', label: 'Next day', action: () => onNavigateNext?.(), active: !!onNavigateNext, done: false },
  ];

  return (
    <div
      role="toolbar"
      aria-label="Ritual commands"
      style={{
        display: 'flex',
        gap: 4,
        padding: '6px 20px',
        borderBottom: `1px solid ${tokens.border}`,
        background: tokens.surface,
        flexWrap: 'wrap',
      }}
    >
      {commands.map((cmd) => (
        <CommandChip key={cmd.cmdKey} {...cmd} />
      ))}
    </div>
  );
}

function CommandChip({ cmdKey, label, action, active, done }: {
  cmdKey: string;
  label: string;
  action: () => void;
  active: boolean;
  done: boolean;
}) {
  return (
    <button
      onClick={action}
      disabled={!active && !done}
      title={`${label} (keyboard: ${cmdKey})`}
      aria-label={label}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        fontFamily: tokens.fontMono,
        fontSize: tokens.fontSizeXs,
        color: done ? tokens.textDim : active ? tokens.text : tokens.textDim,
        background: 'transparent',
        border: `1px solid ${done ? tokens.textDim : active ? tokens.border : tokens.textDim}`,
        borderRadius: tokens.radius,
        padding: '3px 10px',
        cursor: active ? 'pointer' : 'default',
        opacity: active ? 1 : 0.4,
        letterSpacing: '0.03em',
        textDecoration: done ? 'line-through' : 'none',
      }}
    >
      <kbd style={{ fontFamily: tokens.fontMono, fontSize: tokens.fontSizeXs, color: tokens.accent, background: 'transparent', border: 'none', padding: 0 }}>
        {cmdKey}
      </kbd>
      {label}
      {done && <span style={{ color: tokens.commune, fontSize: tokens.fontSizeXs }}>done</span>}
    </button>
  );
}
