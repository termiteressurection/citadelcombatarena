import { useEffect, useRef, type JSX } from 'react';
import { STATIONS } from './world/layout';
import { useGame } from './store';

function Fps() {
  const el = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let frames = 0, last = performance.now(), raf = 0;
    const loop = (now: number) => {
      frames++;
      if (now - last >= 500) {
        if (el.current) el.current.textContent = `${Math.round((frames * 1000) / (now - last))} FPS`;
        frames = 0; last = now;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
  return <div ref={el} style={{ position: 'absolute', top: 18, right: 22, fontSize: 12, opacity: 0.5 }} />;
}

function StationPanel() {
  const { panel, openPanel, setScene, glory, fallen, unlocks } = useGame();
  useEffect(() => {
    if (!panel) return;
    const h = (e: KeyboardEvent) => { if (e.code === 'Escape' || e.code === 'KeyE') openPanel(null); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [panel, openPanel]);
  if (!panel) return null;
  const s = STATIONS.find((x) => x.id === panel)!;
  const body: Record<string, JSX.Element> = {
    gate: <><p>The sand awaits. The arena opens in the next build.</p><button className="clickable btn" onClick={() => setScene('arena')}>WALK THROUGH</button></>,
    armory: <><p>Unlocked: {unlocks.join(' · ')}</p><p>More weapons are earned in the arena.</p></>,
    shrine: <><p>Glory: {glory}</p><p>Offerings unlock new boons, arenas and looks. Never raw power.</p></>,
    yard: <p>Dummies are being hauled in. Sparring arrives with the combat build.</p>,
    wall: fallen.length === 0
      ? <p>No one has fallen. Yet.</p>
      : <>{[...fallen].reverse().slice(0, 8).map((f, i) => <p key={i}>{f.name} — bout {f.bouts}, {f.cause}</p>)}</>,
  };
  return (
    <div className="panel" style={{ background: '#06050dcc' }}>
      <h1 style={{ color: s.color, textShadow: `0 0 20px ${s.color}88` }}>{s.label}</h1>
      {body[panel]}
      <p style={{ opacity: 0.5 }}>[E] or [ESC] to close</p>
    </div>
  );
}

function ArenaStub() {
  const { scene, setScene } = useGame();
  if (scene !== 'arena') return null;
  return (
    <div className="panel">
      <h1>THE ARENA</h1>
      <p>Coming in Phase 3: sword, shield, and the first ragdoll.</p>
      <button className="clickable btn" onClick={() => setScene('ludus')}>RETURN TO THE LUDUS</button>
    </div>
  );
}

export function HUD() {
  const near = useGame((s) => s.near);
  const panel = useGame((s) => s.panel);
  const station = STATIONS.find((s) => s.id === near);
  return (
    <div className="hud">
      <div className="title">BONEYARD · THE LUDUS</div>
      <Fps />
      {station && !panel && <div className="hint" style={{ borderColor: station.color, color: station.color }}>[E] {station.verb}</div>}
      <div className="controls">WASD move · drag / ← → turn camera · E interact</div>
      <StationPanel />
      <ArenaStub />
    </div>
  );
}
