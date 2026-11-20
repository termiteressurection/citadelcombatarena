import { useEffect, useRef, useState, type JSX } from 'react';
import { STATIONS } from './world/layout';
import { useGame } from './store';
import { useArena, type LimbHud } from './arena/arenaStore';
import { boonById } from './arena/boons';
import { type LimbKey } from './arena/combat';
import { LADDER, LOOKS } from './arena/run';
import { STYLE_IDS, STYLES } from './arena/styles';

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
  const { panel, setScene, glory, fallen, unlocks, look, style, champions, buyLook, equipLook, equipStyle } = useGame();
  if (!panel) return null;
  const s = STATIONS.find((x) => x.id === panel)!;
  const curStyle = STYLES[style];
  const cycleStyle = () => equipStyle(STYLE_IDS[(STYLE_IDS.indexOf(style) + 1) % STYLE_IDS.length]);
  const body: Record<string, JSX.Element> = {
    gate: (
      <>
        <p>{LADDER.length} bouts to the championship. Draw one Fate between each. Fall once and the run is over.</p>
        <p style={{ color: curStyle.color }}>EQUIPPED: {curStyle.name} — {curStyle.tagline}</p>
        <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button className="clickable btn" onClick={() => { useArena.getState().startRun(); setScene('arena'); }}>WALK THROUGH</button>
          <button className="clickable btn" style={{ color: curStyle.color, borderColor: curStyle.color }} onClick={cycleStyle}>SWAP STYLE</button>
        </div>
      </>
    ),
    armory: (
      <div style={{ display: 'flex', gap: 28, justifyContent: 'center', alignItems: 'flex-start', flexWrap: 'wrap', maxWidth: 820 }}>
        <div style={{ display: 'grid', gap: 8, justifyItems: 'center' }}>
          <p style={{ fontSize: 12, opacity: 0.75 }}>FIGHTING STYLE</p>
          {STYLE_IDS.map((id) => {
            const st = STYLES[id];
            const eq = style === id;
            return (
              <button
                key={id}
                className="clickable btn"
                style={{ color: st.color, borderColor: st.color, opacity: eq ? 1 : 0.65, width: 320, padding: '8px 14px', fontSize: 13 }}
                onClick={() => equipStyle(id)}
              >
                <div>{eq ? '▶ ' : ''}{st.name}</div>
                <div style={{ fontSize: 10, letterSpacing: '.06em', opacity: 0.85, color: '#e9e6ff', marginTop: 2 }}>{st.tagline}</div>
              </button>
            );
          })}
        </div>
        <div style={{ display: 'grid', gap: 8, justifyItems: 'center' }}>
          <p style={{ fontSize: 12, opacity: 0.75 }}>CREST COLOR (COSMETIC)</p>
          {LOOKS.filter((l) => unlocks.includes(l.id)).map((l) => (
            <button
              key={l.id}
              className="clickable btn"
              style={{ color: l.color, borderColor: l.color, opacity: look === l.id ? 1 : 0.6, width: 220, padding: '8px 14px', fontSize: 13 }}
              onClick={() => equipLook(l.id)}
            >
              {look === l.id ? '▶ ' : ''}{l.name}
            </button>
          ))}
        </div>
      </div>
    ),
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

function CalloutFlash() {
  const callout = useArena((s) => s.callout);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!callout) { setVisible(false); return; }
    setVisible(true);
    const id = setTimeout(() => setVisible(false), 650);
    return () => clearTimeout(id);
  }, [callout?.id]);
  if (!callout || !visible) return null;
  return (
    <div
      style={{
        position: 'absolute', top: '24%', left: '50%', transform: 'translateX(-50%)',
        fontSize: 24, letterSpacing: '.28em', color: callout.color, fontWeight: 700,
        textShadow: `0 0 22px ${callout.color}`, fontFamily: 'Menlo, "SF Mono", monospace',
        whiteSpace: 'nowrap',
      }}
    >
      {callout.text}
    </div>
  );
}

const DOLL_SEGMENTS: { key: LimbKey; x1: number; y1: number; x2: number; y2: number }[] = [
  { key: 'head',  x1: 22, y1: 4,  x2: 22, y2: 13 },
  { key: 'torso', x1: 22, y1: 16, x2: 22, y2: 34 },
  { key: 'armL',  x1: 17, y1: 17, x2: 10, y2: 32 },
  { key: 'armR',  x1: 27, y1: 17, x2: 34, y2: 32 },
  { key: 'legL',  x1: 19, y1: 37, x2: 14, y2: 59 },
  { key: 'legR',  x1: 25, y1: 37, x2: 30, y2: 59 },
];

/** Nostalgaia-style stick paper-doll showing live limb integrity and severed gaps. */
function LimbDoll({ limbs, size = 56 }: { limbs: LimbHud; size?: number }) {
  return (
    <svg
      width={Math.round((size * 44) / 64)}
      height={size}
      viewBox="0 0 44 64"
      style={{ background: '#06050dbb', border: '1px solid #e9e6ff28', padding: 2, flexShrink: 0 }}
    >
      {DOLL_SEGMENTS.map((seg) => {
        const l = limbs[seg.key];
        const severed = l.s;
        const crit = !severed && l.r <= 0.30;
        const color = severed ? '#e9e6ff' : crit ? '#ff3b5c' : l.r <= 0.65 ? '#ffc95c' : '#e9e6ff';
        return (
          <line
            key={seg.key}
            x1={seg.x1} y1={seg.y1} x2={seg.x2} y2={seg.y2}
            stroke={color}
            strokeWidth={severed ? 2 : 3}
            strokeLinecap="square"
            strokeDasharray={severed ? '2 2' : undefined}
            opacity={severed ? 0.18 : 1}
            className={crit ? 'limb-crit' : undefined}
          />
        );
      })}
    </svg>
  );
}

function ArenaHud() {
  const { scene, setScene } = useGame();
  const a = useArena();
  if (scene !== 'arena') return null;
  const leave = () => { a.set({ phase: 'intro', hp: 100, st: 100, enemies: [], callout: null, combo: 0 }); setScene('ludus'); };
  return (
    <>
      <div style={{ position: 'absolute', top: 54, left: 22, display: 'grid', gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <LimbDoll limbs={a.playerLimbs} size={58} />
          <div style={{ display: 'grid', gap: 6 }}>
            <Bar v={a.hp} max={a.maxHp} color="#ff4f6d" w={190} />
            <Bar v={a.st} max={a.maxSt} color="#4dffa0" w={150} />
            <div style={{ fontSize: 12, opacity: 0.7, letterSpacing: '.15em' }}>BOUT {a.bout} / {LADDER.length}</div>
          </div>
        </div>
        <div
          style={{
            display: 'inline-block', justifySelf: 'start', fontSize: 11, letterSpacing: '.14em',
            padding: '3px 8px',
            border: `1px solid ${a.lockedName ? '#3ff0ff88' : '#e9e6ff44'}`,
            color: a.lockedName ? '#3ff0ff' : '#e9e6ff88',
            background: '#06050daa',
          }}
        >
          {a.lockedName ? `LOCKED · ${a.lockedName} [TAB]` : 'FREE CAM · Q/E ORBIT [TAB]'}
        </div>
        {a.combo >= 2 && (
          <div style={{ fontSize: 18, letterSpacing: '.25em', color: '#ffc95c', textShadow: '0 0 14px #ffc95caa' }}>
            {a.combo} HIT
          </div>
        )}
        <BoonList ids={a.boons} />
      </div>
      <div style={{ position: 'absolute', top: 54, left: '50%', transform: 'translateX(-50%)', display: 'grid', gap: 8, justifyItems: 'center' }}>
        {a.enemies.filter((e) => e.hp > 0).map((e) => (
          <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ display: 'grid', gap: 4, justifyItems: 'center' }}>
              <div style={{ letterSpacing: '.26em', fontSize: 13, color: '#ff6b6b' }}>{e.name} · {e.styleName}</div>
              <Bar v={e.hp} max={e.max} color="#ff6b6b" w={210} />
            </div>
            <LimbDoll limbs={e.limbs} size={44} />
          </div>
        ))}
      </div>
      <CalloutFlash />
      {a.phase === 'intro' && <div className="panel" style={{ background: 'transparent' }}><h1>BOUT {a.bout}</h1></div>}
      {a.phase === 'draft' && <Draft />}
      {(a.phase === 'defeat' || a.phase === 'champion') && (
        <div className="panel">
          <h1 style={a.phase === 'defeat' ? { color: '#ff4f6d', textShadow: '0 0 20px #ff4f6d88' } : undefined}>{a.phase === 'champion' ? 'CHAMPION OF THE SAND' : 'YOU FELL'}</h1>
          <p>{a.phase === 'champion' ? `+${a.earned} GLORY. Your name is sung in the stands.` : `Bout ${a.bout} of ${LADDER.length}. Your name is carved on the Wall of the Fallen.`}</p>
          <button className="clickable btn" onClick={leave}>RETURN TO THE LUDUS</button>
        </div>
      )}
      <div className="controls">WASD move · J / click 3-hit combo · K / r-click heavy · F guard-break · SHIFT block/parry · SPACE dodge · TAB lock-on</div>
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
