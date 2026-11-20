import { useEffect, useRef, type JSX } from 'react';
import { STATIONS } from './world/layout';
import { useGame } from './store';
import { useArena } from './arena/arenaStore';
import { boonById } from './arena/boons';
import { LADDER, LOOKS } from './arena/run';

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
  const { panel, setScene, glory, fallen, unlocks, look, champions, buyLook, equipLook } = useGame();
  if (!panel) return null;
  const s = STATIONS.find((x) => x.id === panel)!;
  const body: Record<string, JSX.Element> = {
    gate: <><p>{LADDER.length} bouts to the championship. Draw one Fate between each. Fall once and the run is over.</p><button className="clickable btn" onClick={() => { useArena.getState().startRun(); setScene('arena'); }}>WALK THROUGH</button></>,
    armory: <>
      <p>Choose your crest. Looks only. No look ever hits harder.</p>
      <div style={{ display: 'grid', gap: 8, justifyItems: 'center' }}>
        {LOOKS.filter((l) => unlocks.includes(l.id)).map((l) => (
          <button key={l.id} className="clickable btn" style={{ color: l.color, borderColor: l.color, opacity: look === l.id ? 1 : 0.6 }} onClick={() => equipLook(l.id)}>{look === l.id ? '▶ ' : ''}{l.name}</button>
        ))}
      </div>
    </>,
    shrine: <>
      <p>Glory: {glory}</p>
      <p>Offerings unlock new crests. Never raw power.</p>
      <div style={{ display: 'grid', gap: 8, justifyItems: 'center' }}>
        {LOOKS.filter((l) => !unlocks.includes(l.id)).map((l) => (
          <button key={l.id} className="clickable btn" disabled={glory < l.cost} style={{ color: l.color, borderColor: l.color, opacity: glory < l.cost ? 0.35 : 1 }} onClick={() => buyLook(l.id)}>{l.name} · {l.cost} GLORY</button>
        ))}
        {LOOKS.every((l) => unlocks.includes(l.id)) && <p>Every offering made.</p>}
      </div>
    </>,
    yard: <p>Dummies are being hauled in. Sparring arrives in a later build.</p>,
    wall: <>
      {champions > 0 && <p style={{ color: '#ffc95c' }}>Championships won: {champions}</p>}
      {fallen.length === 0 ? <p>No one has fallen. Yet.</p> : [...fallen].reverse().slice(0, 8).map((f, i) => <p key={i}>{f.name} — bout {f.bouts}, {f.cause}</p>)}
    </>,
  };
  return (
    <div className="panel" style={{ background: '#06050dcc' }}>
      <h1 style={{ color: s.color, textShadow: `0 0 20px ${s.color}88` }}>{s.label}</h1>
      {body[panel]}
      <p style={{ opacity: 0.5 }}>[ENTER] or [ESC] to close</p>
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

function BoonList({ ids }: { ids: string[] }) {
  const counts = new Map<string, number>();
  ids.forEach((i) => counts.set(i, (counts.get(i) ?? 0) + 1));
  return (
    <div style={{ display: 'grid', gap: 2, fontSize: 11 }}>
      {[...counts].map(([id, n]) => { const b = boonById(id)!; return <div key={id} style={{ color: b.color }}>{b.name}{n > 1 ? ` ×${n}` : ''}</div>; })}
    </div>
  );
}

/** Fate: three boons, take one, lose the other two. No reroll. */
function Draft() {
  const a = useArena();
  useEffect(() => {
    const h = (e: KeyboardEvent) => { const i = ['Digit1', 'Digit2', 'Digit3'].indexOf(e.code); if (i >= 0 && a.draft[i]) a.pick(a.draft[i]); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [a]);
  return (
    <div className="panel">
      <h1>FATE</h1>
      <p>Bout {a.bout} won. +{a.earned} glory. Take one. The others are gone.</p>
      <div style={{ display: 'flex', gap: 18, justifyContent: 'center' }}>
        {a.draft.map((id, i) => { const b = boonById(id)!; return (
          <button key={id} className="clickable btn" style={{ color: b.color, borderColor: b.color, width: 220, padding: '22px 12px', display: 'grid', gap: 10 }} onClick={() => a.pick(id)}>
            <span style={{ fontSize: 12, opacity: 0.6 }}>[{i + 1}]</span>
            <span>{b.name}</span>
            <span style={{ fontSize: 12, letterSpacing: '.08em', color: '#e9e6ff' }}>{b.desc}</span>
          </button>
        ); })}
      </div>
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
        <div style={{ fontSize: 12, opacity: 0.7, letterSpacing: '.15em' }}>BOUT {a.bout} / {LADDER.length}</div>
        <BoonList ids={a.boons} />
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
      {a.phase === 'draft' && <Draft />}
      {(a.phase === 'defeat' || a.phase === 'champion') && (
        <div className="panel">
          <h1 style={a.phase === 'defeat' ? { color: '#ff4f6d', textShadow: '0 0 20px #ff4f6d88' } : undefined}>{a.phase === 'champion' ? 'CHAMPION OF THE SAND' : 'YOU FELL'}</h1>
          <p>{a.phase === 'champion' ? `+${a.earned} GLORY. Your name is sung in the stands.` : `Bout ${a.bout} of ${LADDER.length}. Your name is carved on the Wall of the Fallen.`}</p>
          <button className="clickable btn" onClick={leave}>RETURN TO THE LUDUS</button>
        </div>
      )}
      <div className="controls">WASD move · J / click light · K / right-click heavy · hold SHIFT block (tap right before a hit to parry) · SPACE dodge · Q E rotate camera</div>
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
      {station && !panel && <div className="hint" style={{ borderColor: station.color, color: station.color }}>[ENTER] {station.verb}</div>}
      {scene === 'ludus' && <div className="controls">WASD / arrows move · Q E rotate camera · R F tilt · ENTER interact</div>}
      <StationPanel />
      <ArenaHud />
    </div>
  );
}
