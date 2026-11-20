/**
 * Fake CRT housing + subtle color grading over the 3D view (not the HUD).
 */
export function Ps1Bezel() {
  return (
    <div
      className="pointer-events-none absolute inset-0 z-[4]"
      aria-hidden
      style={{
        boxShadow: `
          inset 0 0 0 10px #0a0a0a,
          inset 0 0 0 12px #1a1525,
          inset 0 0 0 14px #0f3d2e,
          inset 0 0 120px rgba(0,0,0,0.55)
        `,
        borderRadius: '2px',
        mixBlendMode: 'normal',
      }}
    >
      <div
        className="absolute inset-0 opacity-[0.12]"
        style={{
          background: `
            repeating-linear-gradient(
              0deg,
              transparent 0px,
              transparent 1px,
              rgba(0,0,0,0.35) 1px,
              rgba(0,0,0,0.35) 2px
            )
          `,
        }}
      />
      <div
        className="absolute inset-0 opacity-[0.18]"
        style={{
          background: `repeating-conic-gradient(from 0deg at 50% 50%, transparent 0deg 90deg, rgba(0,255,160,0.03) 90deg 180deg)`,
          backgroundSize: '4px 4px',
          mixBlendMode: 'overlay',
        }}
      />
    </div>
  );
}
