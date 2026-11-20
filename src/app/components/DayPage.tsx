import type { DayCell, LocalDay } from '@/core/model/types';
import { isToday, isPastDay } from '@/core/time/localDay';
import { EntryComposer } from './EntryComposer';
import { DailyAnchorGate } from './DailyAnchorGate';
import { tokens } from '../styles';

interface Props {
  dayCell: DayCell | undefined;
  day: LocalDay;
  today: LocalDay;
  onReturnToHub?: () => void;
}

export function DayPage({ dayCell, day, today, onReturnToHub }: Props) {
  const isTodayDay = isToday(day, today);
  const isPast = isPastDay(day, today);

  const allEntries = dayCell?.entries ?? [];
  const anchorEntry = allEntries.find((e) => e.tags?.includes('daily-anchor'));
  const entries = allEntries.filter((e) => !e.tags?.includes('daily-anchor'));
  const anchorComplete = dayCell?.dailyAnchorComplete ?? false;

  return (
    <div
      style={{
        flex: 1,
        overflowY: 'auto',
        padding: '32px 40px',
        maxWidth: 720,
        width: '100%',
        margin: '0 auto',
        boxSizing: 'border-box',
      }}
    >
      {/* Day header */}
      <div style={{ marginBottom: 28 }}>
        <h2
          className={isTodayDay ? 'citadel-glow-accent' : ''}
          style={{
            fontFamily: tokens.fontMono,
            fontSize: tokens.fontSizeXl,
            color: isTodayDay ? tokens.accent : isPast ? tokens.textMuted : tokens.text,
            margin: 0,
            fontWeight: 500,
            letterSpacing: '-0.01em',
          }}
        >
          {formatFullDay(day)}
        </h2>
        <div
          style={{
            marginTop: 4,
            fontFamily: tokens.fontMono,
            fontSize: tokens.fontSizeXs,
            color: tokens.textDim,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
          }}
        >
          {isTodayDay ? 'today' : isPast ? 'locked' : 'future'}
          {entries.length > 0 &&
            ` · ${entries.length} ${entries.length === 1 ? 'entry' : 'entries'}`}
        </div>
      </div>

      {/* Daily Anchor — today only */}
      {isTodayDay && <DailyAnchorGate today={today} />}

      {/* Past anchor display */}
      {isPast && anchorEntry && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '10px 16px',
            background: tokens.surface,
            border: `1px solid ${tokens.border}`,
            borderRadius: tokens.radius,
            marginBottom: 20,
          }}
        >
          <span
            style={{
              fontFamily: tokens.fontMono,
              fontSize: tokens.fontSizeXs,
              color: tokens.commune,
              letterSpacing: '0.08em',
            }}
          >
            anchor
          </span>
          <span
            style={{
              fontFamily: tokens.fontMono,
              fontSize: tokens.fontSizeSm,
              color: tokens.textMuted,
              fontStyle: 'italic',
            }}
          >
            {anchorEntry.text}
          </span>
        </div>
      )}

      {/* Empty state */}
      {entries.length === 0 && (
        <p
          style={{
            fontFamily: tokens.fontMono,
            fontSize: tokens.fontSizeSm,
            color: tokens.textDim,
            fontStyle: 'italic',
            margin: '0 0 24px',
          }}
        >
          {isTodayDay
            ? anchorComplete
              ? 'Anchor set. Write your first entry.'
              : 'Set your anchor to begin.'
            : 'No entries recorded.'}
        </p>
      )}

      {/* Entries */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {entries.map((entry) => (
          <div
            key={entry.id}
            style={{
              padding: '16px 20px',
              background: tokens.surface,
              border: `1px solid ${tokens.border}`,
              borderRadius: tokens.radius,
            }}
          >
            {entry.migrationConflict && (
              <div
                role="status"
                style={{
                  marginBottom: 8,
                  fontFamily: tokens.fontMono,
                  fontSize: tokens.fontSizeXs,
                  color: tokens.textDim,
                }}
              >
                Legacy ID conflict preserved · original ID: {entry.originalId}
              </div>
            )}
            <p
              style={{
                fontFamily: tokens.fontMono,
                fontSize: tokens.fontSizeBase,
                color: tokens.text,
                margin: 0,
                lineHeight: 1.7,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {entry.text}
            </p>
            <div
              style={{
                marginTop: 10,
                fontFamily: tokens.fontMono,
                fontSize: tokens.fontSizeXs,
                color: tokens.textDim,
              }}
            >
              {formatTime(entry.createdAt)}
            </div>
          </div>
        ))}
      </div>

      {/* Composer — today only */}
      {isTodayDay && <EntryComposer today={today} />}

      {/* Locked notice */}
      {isPast && (
        <div
          style={{
            marginTop: 24,
            padding: '10px 16px',
            border: `1px solid ${tokens.border}`,
            borderRadius: tokens.radius,
            fontFamily: tokens.fontMono,
            fontSize: tokens.fontSizeXs,
            color: tokens.textDim,
            letterSpacing: '0.04em',
          }}
        >
          sealed — past entries are immutable
        </div>
      )}

      {/* Return to Hub — shown on past days */}
      {isPast && onReturnToHub && (
        <button
          onClick={onReturnToHub}
          style={{
            marginTop: 16,
            display: 'block',
            width: '100%',
            padding: '10px 16px',
            background: 'transparent',
            border: `1px solid ${tokens.border}`,
            borderRadius: tokens.radius,
            fontFamily: tokens.fontMono,
            fontSize: tokens.fontSizeXs,
            color: tokens.textDim,
            cursor: 'pointer',
            letterSpacing: '0.06em',
            textAlign: 'left',
            transition: 'border-color 0.15s, color 0.15s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = tokens.accent;
            e.currentTarget.style.color = tokens.accent;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = tokens.border;
            e.currentTarget.style.color = tokens.textDim;
          }}
        >
          return to hub
        </button>
      )}
    </div>
  );
}

function formatFullDay(day: string): string {
  try {
    const [y, m, d] = day.split('-').map(Number);
    const date = new Date(y, m - 1, d, 12);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return day;
  }
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}
