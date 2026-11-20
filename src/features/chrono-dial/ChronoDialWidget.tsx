import type { LocalDay } from '@/core/model/types';
import { canGoBack, canGoForward, prevDay, nextDay } from './chronoDial';
import { tokens } from '@/app/styles';

interface Props {
  current: LocalDay;
  today: LocalDay;
  oldest: LocalDay;
  onNavigate: (day: LocalDay) => void;
}

/**
 * ChronoDial — visual date navigation control.
 *
 * Renders prev/next arrows with the current day label.
 * Caps forward navigation at today; backward at oldest known day.
 */
export function ChronoDial({ current, today, oldest, onNavigate }: Props) {
  const canBack = canGoBack(current, oldest);
  const canForward = canGoForward(current, today);

  return (
    <div
      role="navigation"
      aria-label="Date navigation"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        fontFamily: tokens.fontMono,
        fontSize: tokens.fontSizeSm,
      }}
    >
      <NavButton
        label="←"
        title="Previous day  [ "
        enabled={canBack}
        onClick={() => onNavigate(prevDay(current))}
      />

      <span
        style={{
          color: current === today ? tokens.accent : tokens.textMuted,
          minWidth: 90,
          textAlign: 'center',
          letterSpacing: '0.04em',
        }}
      >
        {formatShort(current)}
        {current === today && (
          <span style={{ marginLeft: 4, fontSize: tokens.fontSizeXs, color: tokens.accentDim }}>
            today
          </span>
        )}
      </span>

      <NavButton
        label="→"
        title="Next day  ]"
        enabled={canForward}
        onClick={() => onNavigate(nextDay(current, today))}
      />
    </div>
  );
}

function NavButton({
  label,
  title,
  enabled,
  onClick,
}: {
  label: string;
  title: string;
  enabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={!enabled}
      title={title}
      aria-label={title}
      style={{
        fontFamily: tokens.fontMono,
        fontSize: tokens.fontSizeSm,
        color: enabled ? tokens.text : tokens.textDim,
        background: 'transparent',
        border: `1px solid ${enabled ? tokens.border : tokens.textDim}`,
        borderRadius: tokens.radius,
        width: 28,
        height: 28,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: enabled ? 'pointer' : 'default',
        opacity: enabled ? 1 : 0.3,
        transition: 'opacity 0.15s',
        flexShrink: 0,
      }}
    >
      {label}
    </button>
  );
}

function formatShort(day: string): string {
  try {
    const [y, m, d] = day.split('-').map(Number);
    const date = new Date(y, m - 1, d, 12);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return day;
  }
}
