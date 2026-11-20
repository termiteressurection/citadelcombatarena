import { useEffect, useRef } from 'react';

/**
 * MatrixRain — Imperative Termitesse glyph stream.
 * Restored from the Arboretum [V.1.0.4].
 */
const GLYPH_SET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/.:';
const GLYPH_COUNT = GLYPH_SET.length;
const CELL_SIZE = 20;

export function MatrixRain() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = 0;
    let height = 0;
    let columns: number[] = [];
    let rafId: number;

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width * window.devicePixelRatio;
      canvas.height = height * window.devicePixelRatio;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

      const columnCount = Math.floor(width / CELL_SIZE) + 1;
      columns = Array.from({ length: columnCount }, () => Math.random() * -height);
    };

    const draw = () => {
      ctx.fillStyle = 'rgba(6, 2, 14, 0.1)'; // Fade tail
      ctx.fillRect(0, 0, width, height);

      ctx.font = `${CELL_SIZE - 4}px "Termitesse", monospace`;
      
      columns.forEach((y, i) => {
        const char = GLYPH_SET[Math.floor(Math.random() * GLYPH_COUNT)];
        const x = i * CELL_SIZE;

        // Glow effect
        ctx.shadowBlur = 8;
        ctx.shadowColor = 'rgba(168, 85, 247, 0.5)';
        ctx.fillStyle = 'rgba(216, 180, 254, 0.9)'; // violet-300
        ctx.fillText(char, x, y);

        if (y > height + Math.random() * 500) {
          columns[i] = -20;
        } else {
          columns[i] = y + 14;
        }
      });

      rafId = requestAnimationFrame(draw);
    };

    resize();
    window.addEventListener('resize', resize);
    draw();

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 0,
        opacity: 0.35,
        pointerEvents: 'none',
      }}
    />
  );
}
