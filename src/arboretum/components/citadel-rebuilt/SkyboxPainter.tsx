import { useCallback, useEffect, useRef, useState } from 'react';

const W = 700, H = 480;
const PALETTE = ['#0a0414', '#1e0d3a', '#7c3aed', '#a855f7', '#c084fc', '#ec4899', '#f472b6', '#34d399', '#22d3ee', '#fbbf24', '#f97316', '#ef4444', '#ffffff'];

export default function SkyboxPainter({ onExit, onSave }: { onExit: () => void; onSave: (data: string) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [color, setColor] = useState(4);
  const [brushSize, setBrushSize] = useState(8);
  const painting = useRef(false);
  const lastPos = useRef<{ x: number; y: number } | null>(null);

  // Init with gradient sky
  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#0a0414');
    grad.addColorStop(0.4, '#1e0d3a');
    grad.addColorStop(0.7, '#3b1d7a');
    grad.addColorStop(1, '#7c3aed');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
    // Scatter stars
    for (let i = 0; i < 120; i++) {
      const x = Math.random() * W, y = Math.random() * H * 0.6;
      ctx.fillStyle = `rgba(255,255,255,${0.2 + Math.random() * 0.6})`;
      ctx.beginPath();
      ctx.arc(x, y, 0.5 + Math.random() * 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }, []);

  const drawAt = useCallback((x: number, y: number) => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = PALETTE[color];
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.arc(x, y, brushSize, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }, [color, brushSize]);

  const drawLine = useCallback((x1: number, y1: number, x2: number, y2: number) => {
    const dist = Math.hypot(x2 - x1, y2 - y1);
    const steps = Math.max(1, Math.floor(dist / (brushSize / 2)));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      drawAt(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t);
    }
  }, [drawAt, brushSize]);

  const handleMouse = (e: React.MouseEvent) => {
    if (!painting.current) return;
    const rect = canvasRef.current!.getBoundingClientRect();
    const x = e.clientX - rect.left, y = e.clientY - rect.top;
    if (lastPos.current) {
      drawLine(lastPos.current.x, lastPos.current.y, x, y);
    } else {
      drawAt(x, y);
    }
    lastPos.current = { x, y };
  };

  const save = () => onSave(canvasRef.current!.toDataURL('image/png', 0.8));

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/95">
      <div className="flex flex-col items-center gap-3">
        <div className="text-purple-300 font-mono text-sm">SKYBOX PAINTER</div>
        <div className="flex gap-1 flex-wrap">
          {PALETTE.map((c, i) => (
            <div key={i} onClick={() => setColor(i)} className="w-5 h-5 cursor-pointer border"
              style={{ background: c, borderColor: color === i ? '#fff' : '#1e0d3a' }} />
          ))}
        </div>
        <div className="flex gap-2 items-center">
          <span className="text-purple-600 font-mono text-[10px]">BRUSH</span>
          {[4, 8, 16, 32].map(s => (
            <button key={s} onClick={() => setBrushSize(s)}
              className={`px-2 py-0.5 text-[10px] font-mono border ${brushSize === s ? 'border-purple-400 text-purple-300' : 'border-purple-900 text-purple-600'}`}>
              {s}px
            </button>
          ))}
        </div>
        <canvas ref={canvasRef} width={W} height={H}
          onMouseDown={() => { painting.current = true; lastPos.current = null; }}
          onMouseUp={() => { painting.current = false; lastPos.current = null; }}
          onMouseLeave={() => { painting.current = false; lastPos.current = null; }}
          onMouseMove={handleMouse}
          className="border border-purple-900 cursor-crosshair" />
        <div className="flex gap-2">
          <button onClick={save} className="px-4 py-1 text-xs font-mono text-emerald-400 border border-emerald-800 hover:bg-emerald-900/30">SAVE SKYBOX</button>
          <button onClick={onExit} className="px-4 py-1 text-xs font-mono text-purple-400 border border-purple-800 hover:bg-purple-900/30">EXIT</button>
        </div>
      </div>
    </div>
  );
}
