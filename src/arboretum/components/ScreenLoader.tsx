interface ScreenLoaderProps {
  label: string;
  variant?: 'legacy' | 'rebuilt';
}

const THEMES = {
  legacy: {
    background: '#060812',
    color: '#66ffff',
    glow: '0 0 18px rgba(0, 200, 200, 0.35)',
  },
  rebuilt: {
    background: 'radial-gradient(ellipse at 30% 20%, #0c1a38 0%, #040710 55%, #010206 100%)',
    color: '#7df6ff',
    glow: '0 0 26px rgba(76, 246, 255, 0.28)',
  },
} as const;

export default function ScreenLoader({ label, variant = 'legacy' }: ScreenLoaderProps) {
  const theme = THEMES[variant];

  return (
    <div
      className="fixed inset-0 flex flex-col items-center justify-center gap-6"
      style={{ background: theme.background }}
      role="status"
      aria-label="Loading"
    >
      <p className="citadel-display text-[26px] uppercase tracking-[0.22em] [--display-color:rgba(243,240,255,0.92)]">
        THE CITADEL
      </p>
      <p
        className="termite-16bit text-[11px] uppercase tracking-[0.35em]"
        style={{ color: theme.color, textShadow: theme.glow }}
      >
        {label}
      </p>
      {/* Animated progress bar */}
      <div className="w-48 h-[2px] rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
        <div
          className="h-full rounded-full"
          style={{
            background: `linear-gradient(90deg, transparent, ${theme.color}, transparent)`,
            animation: 'loaderSlide 1.5s ease-in-out infinite',
            width: '40%',
          }}
        />
      </div>
      <p className="text-[8px] uppercase tracking-[0.25em] opacity-30" style={{ color: theme.color }}>
        Initializing inner lodge
      </p>
      <style>{`
        @keyframes loaderSlide {
          0% { transform: translateX(-120%); }
          100% { transform: translateX(350%); }
        }
      `}</style>
    </div>
  );
}
