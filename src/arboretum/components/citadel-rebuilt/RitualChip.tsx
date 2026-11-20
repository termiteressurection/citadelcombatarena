import { useRitualStatus, type RitualMode } from './hooks/useRitualRouter';
import { Z } from './ZRegistry';

const MODE_STYLE: Record<RitualMode, { accent: string; dot: string; glyph: string }> = {
  'transport-day': { accent: '#38bdf8', dot: '#22d3ee', glyph: '△' },
  'focus-altar':   { accent: '#fbbf24', dot: '#f59e0b', glyph: '🜂' },
};

interface RitualChipProps {
  onTrigger?: () => void;
}

export default function RitualChip({ onTrigger }: RitualChipProps) {
  const status = useRitualStatus();
  const style = MODE_STYLE[status.mode];

  return (
    <button
      type="button"
      onClick={onTrigger}
      data-testid="ritual-hud-chip"
      aria-label={`Ritual: ${status.label}`}
      title={status.longLabel}
      className="fixed bottom-28 right-5 pointer-events-auto font-mono group cursor-pointer"
      style={{
        zIndex: Z.HUD_ELEVATED,
      }}
    >
      <div
        className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl hover:scale-[1.03] transition-all"
        style={{
          background: 'rgba(10, 4, 20, 0.88)',
          border: `1px solid ${style.accent}66`,
          backdropFilter: 'blur(12px)',
          boxShadow: `0 8px 32px rgba(0,0,0,0.45), 0 0 18px ${style.accent}33`,
        }}
      >
        <span
          className="text-xs font-bold"
          style={{
            color: style.accent,
            animation: 'ritualChipPulse 2.4s ease-in-out infinite',
          }}
        >
          {style.glyph}
        </span>

        <span
          className="text-[10px] tracking-[0.18em] uppercase font-bold"
          style={{ color: style.accent }}
        >
          {status.label}
        </span>

        <span
          className="rounded-full px-1.5 py-0.5 text-[9px] font-bold"
          style={{
            background: `${style.accent}22`,
            color: style.accent,
            border: `1px solid ${style.accent}55`,
          }}
        >
          {status.todayEntryCount}
        </span>
      </div>

      <style>{`
        @keyframes ritualChipPulse {
          0%, 100% { transform: scale(1); filter: brightness(1); }
          50%       { transform: scale(1.08); filter: brightness(1.25); }
        }
      `}</style>
    </button>
  );
}
