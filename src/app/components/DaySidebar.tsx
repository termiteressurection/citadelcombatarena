import type { LocalDay } from '@/core/model/types';
import { isToday, isPastDay } from '@/core/time/localDay';
import { tokens } from '../styles';

interface Props {
  days: LocalDay[];
  today: LocalDay;
  selected: LocalDay;
  onSelect: (day: LocalDay) => void;
}

export function DaySidebar({ days, today, selected, onSelect }: Props) {
  const sorted = [...days].sort((a, b) => (a > b ? -1 : a < b ? 1 : 0));

  return (
    <aside
      style={{
        width: 200,
        minWidth: 200,
        borderRight: `1px solid ${tokens.border}`,
        background: tokens.surface,
        display: 'flex',
        flexDirection: 'column',
        overflowY: 'auto',
      }}
    >
      <div
        style={{
          padding: '14px 16px 10px',
          fontFamily: tokens.fontMono,
          fontSize: tokens.fontSizeXs,
          color: tokens.textDim,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          borderBottom: `1px solid ${tokens.border}`,
        }}
      >
        Days
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {sorted.map((day) => {
          const isActive = day === selected;
          const isTodayDay = isToday(day, today);
          const isPast = isPastDay(day, today);

          return (
            <button
              key={day}
              onClick={() => onSelect(day)}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '9px 16px',
                fontFamily: tokens.fontMono,
                fontSize: tokens.fontSizeSm,
                background: isActive ? tokens.surfaceHover : 'transparent',
                color: isTodayDay
                  ? tokens.accent
                  : isPast
                  ? tokens.textMuted
                  : tokens.text,
                border: 'none',
                borderLeft: isActive
                  ? `2px solid ${isTodayDay ? tokens.accent : tokens.borderFocus}`
                  : '2px solid transparent',
                cursor: 'pointer',
                letterSpacing: '0.02em',
                transition: 'background 0.1s',
              }}
            >
              {formatDay(day)}
              {isTodayDay && (
                <span
                  style={{
                    marginLeft: 6,
                    fontSize: tokens.fontSizeXs,
                    color: tokens.accentDim,
                  }}
                >
                  today
                </span>
              )}
              {isPast && (
                <span
                  style={{
                    marginLeft: 6,
                    fontSize: tokens.fontSizeXs,
                    color: tokens.textDim,
                  }}
                >
                  ·
                </span>
              )}
            </button>
          );
        })}
      </div>
      <div style={{ padding: '12px 16px', borderTop: `1px solid ${tokens.border}`, display: 'flex', justifyContent: 'center', background: 'rgba(0,0,0,0.15)' }}>
        <img src="/bison_logo.png" alt="Silly Bison L3C" style={{ maxWidth: '100%', height: 'auto', opacity: 0.8, borderRadius: tokens.radius }} />
      </div>
    </aside>
  );
}

function formatDay(day: string): string {
  try {
    const [y, m, d] = day.split('-').map(Number);
    const date = new Date(y, m - 1, d, 12);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return day;
  }
}
