import { useEffect, useRef, type JSX } from 'react';
import { STATIONS } from './world/layout';
import { useGame } from './store';
import { useArena } from './arena/arenaStore';

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
    gate: <><p>The sand awaits. One bout. One opponent. Make it count.</p><button className="clickable btn" onClick={() => setScene('arena')}>WALK THROUGH</button></>,
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

function Bar({ v, max, color, w = 260 }: { v: number; max: number; color: string; w?: number }) {
  return (
    <div style={{ width: w, height: 12, border: `1px solid ${color}88`, background: '#06050dcc' }}>
      <div style={{ width: `${Math.max(0, Math.min(100, (v / max) * 100))}%`, height: '100%', background: color, boxShadow: `0 0 10px ${color}`, transition: 'width .08s' }} />
    </div>
  );
}

function ArenaHud() {
  const { scene, setScene } = useGame();
  const a = useArena();
  if (scene !== 'arena') return null;
  const leave = () => { a.set({ phase: 'intro', hp: 100, st: 100, enemies: [] }); setScene('ludus'); };
  return (
    <>
      <div style={{ position: 'absolute', top: 54, left: 22, display: 'grid', gap: 6 }}>
        <Bar v={a.hp} max={a.maxHp} color="#ff4f6d" />
        <Bar v={a.st} max={a.maxSt} color="#4dffa0" w={200} />
      </div>
      <div style={{ position: 'absolute', top: 54, left: '50%', transform: 'translateX(-50%)', display: 'grid', gap: 6, justifyItems: 'center' }}>
        {a.enemies.filter((e) => e.hp > 0).map((e) => (
          <div key={e.id} style={{ display: 'grid', gap: 4, justifyItems: 'center' }}>
            <div style={{ letterSpacing: '.3em', fontSize: 13, color: '#ff6b6b' }}>{e.name}</div>
            <Bar v={e.hp} max={e.max} color="#ff6b6b" w={320} />
          </div>
        ))}
      </div>
      {a.phase === 'intro' && <div className="panel" style={{ background: 'transparent' }}><h1>BOUT {a.bout}</h1></div>}
      {(a.phase === 'victory' || a.phase === 'defeat') && (
        <div className="panel">
          <h1 style={a.phase === 'defeat' ? { color: '#ff4f6d', textShadow: '0 0 20px #ff4f6d88' } : undefined}>{a.phase === 'victory' ? 'VICTORY' : 'YOU FELL'}</h1>
          <p>{a.phase === 'victory' ? '+25 GLORY' : 'Your name is carved on the Wall of the Fallen.'}</p>
          <button className="clickable btn" onClick={leave}>RETURN TO THE LUDUS</button>
        </div>
      )}
      <div className="controls">WASD move · J / click light · K / right-click heavy · hold SHIFT block (tap right before a hit to parry) · SPACE dodge</div>
    </>
  );
}

export function HUD() {
  const near = useGame((s) => s.near);
  const panel = useGame((s) => s.panel);
  const scene = useGame((s) => s.scene);
  const station = STATIONS.find((s) => s.id === near);
  return (
    <div className="hud">
      <div className="title">BONEYARD · {scene === 'ludus' ? 'THE LUDUS' : 'THE ARENA'}</div>
      <Fps />
      {station && !panel && <div className="hint" style={{ borderColor: station.color, color: station.color }}>[E] {station.verb}</div>}
      {scene === 'ludus' && <div className="controls">WASD move · drag / ← → turn camera · E interact</div>}
      <StationPanel />
      <ArenaHud />
    </div>
  );
}
