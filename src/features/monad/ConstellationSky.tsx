import type { LocalDay } from '@/core/model/types';

export interface KeptNight {
  day: LocalDay;
  anchor: string;
}

interface Props {
  nights: KeptNight[];
  highlightDay: LocalDay;
  onEnterWorld: () => void;
}

/** Deterministic star position from the day string — the sky never rearranges itself. */
function starPos(day: string): { x: number; y: number } {
  let h = 2166136261;
  for (let i = 0; i < day.length; i++) {
    h ^= day.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const x = 10 + (((h >>> 0) % 800) / 10); // 10..90
  const y = 14 + (((h >>> 9) % 620) / 10); // 14..76
  return { x, y };
}

export function ConstellationSky({ nights, highlightDay, onEnterWorld }: Props) {
  const pts = nights.map((n) => ({ ...n, ...starPos(n.day) }));
  const filament = pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const newest = pts[pts.length - 1];

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center font-mono relative overflow-hidden"
      style={{ background: 'radial-gradient(ellipse at 50% 120%, #1a0b2e 0%, #050208 70%)' }}
    >
      <style>{`
        @keyframes citadel-ignite {
          0% { opacity: 0; transform: scale(0.2); }
          55% { opacity: 1; transform: scale(1.7); }
          100% { opacity: 0.9; transform: scale(1); }
        }
        @keyframes citadel-pulse {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
        }
        .citadel-ignite {
          transform-box: fill-box;
          transform-origin: center;
          animation: citadel-ignite 1.6s ease-out both;
        }
        .citadel-pulse { animation: citadel-pulse 3.2s ease-in-out infinite; }
      `}</style>

      {/* Sky */}
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="xMidYMid slice"
        className="absolute inset-0 w-full h-full"
        aria-label="Constellation of kept nights"
      >
        {/* filaments between consecutive kept nights */}
        {pts.length > 1 && (
          <polyline
            points={filament}
            fill="none"
            stroke="rgba(168,85,247,0.28)"
            strokeWidth={0.35}
          />
        )}
        {pts.map((p) => {
          const isNewest = p.day === highlightDay;
          return (
            <g key={p.day} className={isNewest ? 'citadel-ignite' : undefined}>
              <title>{`${p.day}${p.anchor ? ` — ${p.anchor}` : ''}`}</title>
              {isNewest && (
                <circle cx={p.x} cy={p.y} r={4.5} fill="none" stroke="#ffd700" strokeWidth={0.3} opacity={0.5} className="citadel-pulse" />
              )}
              <circle
                cx={p.x}
                cy={p.y}
                r={isNewest ? 1.7 : 1.05}
                fill={isNewest ? '#ffd700' : '#c4b5fd'}
                opacity={isNewest ? 1 : 0.75}
                className={isNewest ? undefined : 'citadel-pulse'}
              />
              <text
                x={p.x}
                y={p.y + 4.2}
                textAnchor="middle"
                fontSize={2.4}
                fill={isNewest ? '#fde68a' : 'rgba(196,181,253,0.45)'}
              >
                {p.day.slice(5)}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Overlay copy */}
      <div className="relative z-10 flex flex-col items-center text-center px-6 pointer-events-none">
        <p className="text-[10px] uppercase tracking-[0.5em] text-amber-200/70 mb-3">✦ the sky remembers ✦</p>
        <h1 className="text-2xl md:text-3xl tracking-[0.2em] text-purple-100 mb-2">
          NIGHT {nights.length} KEPT
        </h1>
        {newest?.anchor && (
          <p className="text-xs text-purple-200/70 italic max-w-md">“{newest.anchor}”</p>
        )}
        <p className="text-[10px] tracking-[0.2em] text-purple-300/40 mt-4">
          each night you close the loop, a star is set. the sky never forgets.
        </p>
      </div>

      <div className="relative z-10 mt-10">
        <button
          onClick={onEnterWorld}
          className="px-8 py-3 text-[11px] uppercase tracking-[0.3em] border border-amber-200/30 text-amber-100 hover:bg-amber-200/10 transition-colors"
        >
          ENTER THE WORLD →
        </button>
      </div>
    </div>
  );
}
