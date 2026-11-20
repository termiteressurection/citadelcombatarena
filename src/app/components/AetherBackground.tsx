import { useCallback, useRef } from 'react';
import { MatrixRain } from './MatrixRain';
import { AetherParticles } from './AetherParticles';

let echoCounter = 0;

export function AetherBackground({ children }: { children: React.ReactNode }) {
  const containerRef = useRef<HTMLDivElement>(null);

  const spawnEcho = useCallback((x: number, y: number, interactive: boolean) => {
    const el = document.createElement('div');
    // Interactive elements get a smaller, subtler echo
    const size = interactive ? 2 : 3;
    const scale = interactive ? 10 : 16;
    el.style.cssText = `
      position: fixed;
      left: ${x}px;
      top: ${y}px;
      width: ${size}px;
      height: ${size}px;
      border-radius: 50%;
      background: rgba(200, 169, 110, 0.12);
      transform: translate(-50%, -50%) scale(1);
      pointer-events: none;
      z-index: 9999;
      transition: transform 0.5s cubic-bezier(0.2, 0, 0.8, 1), opacity 0.5s ease-out;
    `;
    document.body.appendChild(el);

    requestAnimationFrame(() => {
      el.style.transform = `translate(-50%, -50%) scale(${scale})`;
      el.style.opacity = '0';
    });

    setTimeout(() => el.remove(), 550);
  }, []);

  const handleClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const isInteractive =
      target.tagName === 'BUTTON' ||
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      !!target.closest('button') ||
      !!target.closest('input') ||
      !!target.closest('textarea');

    spawnEcho(e.clientX, e.clientY, isInteractive);
  }, [spawnEcho]);

  return (
    <div
      ref={containerRef}
      onClick={handleClick}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        background: '#000',
        overflow: 'hidden',
      }}
    >
      {/* Aether gradient drift */}
      <div
        style={{
          position: 'absolute',
          top: '-50%',
          left: '-50%',
          width: '200%',
          height: '200%',
          background: 'radial-gradient(circle at 50% 50%, #1a1a2a 0%, #000 70%)',
          opacity: 0.6,
          filter: 'blur(80px)',
          animation: 'aether-drift 20s ease-in-out infinite alternate',
          pointerEvents: 'none',
        }}
      />

      <AetherParticles />
      <div style={{ opacity: 0.12 }}>
        <MatrixRain />
      </div>

      <div
        style={{
          position: 'relative',
          zIndex: 1,
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {children}
      </div>

      <style>{`
        @keyframes aether-drift {
          from { transform: translate(-5%, -5%) scale(1); }
          to   { transform: translate(5%, 5%) scale(1.1); }
        }
        @media (prefers-reduced-motion: reduce) {
          * { animation: none !important; transition: none !important; }
        }
      `}</style>
    </div>
  );
}
