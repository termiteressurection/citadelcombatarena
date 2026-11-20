import { useEffect, useRef, useState, type JSX } from 'react';
import { STATIONS } from './world/layout';
import { useGame } from './store';
import { useArena, type LimbHud } from './arena/arenaStore';
import { boonById } from './arena/boons';
import { type LimbKey } from './arena/combat';
import { LADDER, LOOKS } from './arena/run';
import { STYLE_IDS, STYLES, type StyleDef } from './arena/styles';

function TopRightControls() {
  const el = useRef<HTMLDivElement>(null);
  const { ps1Mode, togglePs1Mode } = useGame();
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
  return (
    <div style={{ position: 'absolute', top: 14, right: 18, display: 'flex', gap: 10, alignItems: 'center' }}>
      <button
        className="clickable btn"
        style={{ padding: '4px 10px', fontSize: 11, letterSpacing: '.12em', color: ps1Mode ? '#4dffa0' : '#a78bfa', borderColor: ps1Mode ? '#4dffa0' : '#6e5a88' }}
        onClick={togglePs1Mode}
        title="Toggle PS1 retro resolution & CRT lines [P]"
      >
        PS1 CRT: {ps1Mode ? 'ON' : 'OFF'}
      </button>
      <div ref={el} style={{ fontSize: 12, opacity: 0.65, minWidth: 52, textAlign: 'right' }} />
    </div>
  );
}

function MiniStat({ label, pct, color }: { label: string; pct: number; color: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, letterSpacing: '.08em' }}>
      <span style={{ width: 38, color: '#a99dc4' }}>{label}</span>
      <div style={{ flex: 1, height: 6, background: '#07050e', border: '1px solid #4d3f66' }}>
        <div style={{ width: `${Math.max(8, Math.min(100, pct))}%`, height: '100%', background: color }} />
      </div>
    </div>
  );
}

function styleBars(st: StyleDef) {
  const armorSum = st.armor.helm + st.armor.pauldron + st.armor.shield;
  return {
    dmg: ((st.dmgMul - 0.7) / 0.7) * 100,
    reach: ((st.reachMul - 0.8) / 0.6) * 100,
    spd: ((st.speedMul - 0.75) / 0.42) * 100,
    arm: (armorSum / 88) * 100,
  };
}

function StationPanel() {
  const { panel, openPanel, setScene, glory, fallen, unlocks, look, style, champions, buyLook, equipLook, equipStyle } = useGame();
  if (!panel) return null;
  const s = STATIONS.find((x) => x.id === panel)!;
  const curStyle = STYLES[style];
  const cycleStyle = () => equipStyle(STYLE_IDS[(STYLE_IDS.indexOf(style) + 1) % STYLE_IDS.length]);

  // Live docked 3D Armory drawer — keeps left viewport open for inspecting the close-up gladiator!
  if (panel === 'armory') {
    return (
      <div className="ps1-box ps1-armory-drawer">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #c99b4355', paddingBottom: 8 }}>
          <h2 className="ps1-heading" style={{ color: s.color, fontSize: 20, letterSpacing: '.25em' }}>THE ARMORY</h2>
          <button className="clickable btn" style={{ padding: '4px 10px', fontSize: 11 }} onClick={() => openPanel(null)}>CLOSE</button>
        </div>
        <div style={{ fontSize: 11, color: '#cfc6e8', letterSpacing: '.06em' }}>
          Preview live on the left. Pick your Fighting Style & Crest:
        </div>

        <div style={{ display: 'grid', gap: 7 }}>
          <div style={{ fontSize: 11, color: '#ffc95c', letterSpacing: '.18em' }}>FIGHTING STYLE</div>
          {STYLE_IDS.map((id) => {
            const st = STYLES[id];
            const eq = style === id;
            const bars = styleBars(st);
            return (
              <button
                key={id}
                className="clickable btn"
                style={{
                  color: st.color,
                  borderColor: eq ? st.color : '#4d3f66',
                  background: eq ? '#1e1633' : '#0b0816',
                  padding: '8px 10px',
                  textAlign: 'left',
                  display: 'grid',
                  gap: 4,
                  width: '100%',
                }}
                onClick={() => equipStyle(id)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span>{eq ? '▶ ' : ''}{st.name}</span>
                  {eq && <span style={{ fontSize: 10, color: '#4dffa0' }}>EQUIPPED</span>}
                </div>
                <div style={{ fontSize: 10, letterSpacing: '.04em', color: '#e9e6ff', opacity: 0.85 }}>{st.tagline}</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3px 10px', marginTop: 2 }}>
                  <MiniStat label="DMG" pct={bars.dmg} color={st.color} />
                  <MiniStat label="REACH" pct={bars.reach} color={st.color} />
                  <MiniStat label="SPD" pct={bars.spd} color={st.color} />
                  <MiniStat label="ARMOR" pct={bars.arm} color={st.color} />
                </div>
              </button>
            );
          })}
        </div>

        <div style={{ display: 'grid', gap: 6, marginTop: 4 }}>
          <div style={{ fontSize: 11, color: '#ffc95c', letterSpacing: '.18em' }}>CREST COLOR</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {LOOKS.filter((l) => unlocks.includes(l.id)).map((l) => (
              <button
                key={l.id}
                className="clickable btn"
                style={{
                  color: l.color,
                  borderColor: look === l.id ? l.color : '#4d3f66',
                  padding: '6px 10px',
                  fontSize: 11,
                  letterSpacing: '.1em',
                }}
                onClick={() => equipLook(l.id)}
              >
                {look === l.id ? '▶ ' : ''}{l.name}
              </button>
            ))}
          </div>
        </div>
        <div style={{ fontSize: 11, opacity: 0.55, textAlign: 'center', paddingTop: 4 }}>[ENTER] or [ESC] to return</div>
      </div>
    );
  }

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
    shrine: <>
      <p style={{ color: '#ffc95c', fontSize: 15 }}>GLORY: {glory}</p>
      <p>Offerings unlock new crests. Never raw power.</p>
      <div style={{ display: 'grid', gap: 8, justifyItems: 'center' }}>
        {LOOKS.filter((l) => !unlocks.includes(l.id)).map((l) => (
          <button key={l.id} className="clickable btn" disabled={glory < l.cost} style={{ color: l.color, borderColor: l.color, opacity: glory < l.cost ? 0.35 : 1 }} onClick={() => buyLook(l.id)}>{l.name} · {l.cost} GLORY</button>
        ))}
        {LOOKS.every((l) => unlocks.includes(l.id)) && <p>Every offering made.</p>}
      </div>
    </>,
    yard: <p>Wooden dummies stand ready in the sand. Live sparring arrives in a later build.</p>,
    wall: <>
      {champions > 0 && <p style={{ color: '#ffc95c' }}>Championships won: {champions}</p>}
      {fallen.length === 0 ? <p>No one has fallen. Yet.</p> : [...fallen].reverse().slice(0, 8).map((f, i) => <p key={i}>{f.name} — bout {f.bouts}, {f.cause}</p>)}
    </>,
  };

  return (
    <div className="panel">
      <div className="ps1-box" style={{ display: 'grid', gap: 14, maxWidth: 620, justifyItems: 'center' }}>
        <h1 style={{ color: s.color, textShadow: `2px 2px 0 #05030a, 0 0 18px ${s.color}77` }}>{s.label}</h1>
        {body[panel]}
        <p style={{ opacity: 0.55, fontSize: 11 }}>[ENTER] or [ESC] to close</p>
      </div>
    </div>
  );
}

function Bar({ v, max, color, w = 260 }: { v: number; max: number; color: string; w?: number }) {
  return (
    <div className="ps1-bar-track" style={{ width: w }}>
      <div className="ps1-bar-fill" style={{ width: `${Math.max(0, Math.min(100, (v / max) * 100))}%`, backgroundColor: color, boxShadow: `0 0 8px ${color}88` }} />
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
      <div className="ps1-box" style={{ display: 'grid', gap: 14, justifyItems: 'center' }}>
        <h1>FATE</h1>
        <p>Bout {a.bout} won. +{a.earned} glory. Take one. The others are gone.</p>
        <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
          {a.draft.map((id, i) => {
            const b = boonById(id)!;
            return (
              <button key={id} className="clickable btn" style={{ color: b.color, borderColor: b.color, width: 210, padding: '18px 12px', display: 'grid', gap: 8 }} onClick={() => a.pick(id)}>
                <span style={{ fontSize: 11, opacity: 0.7 }}>[{i + 1}]</span>
                <span>{b.name}</span>
                <span style={{ fontSize: 11, letterSpacing: '.06em', color: '#e9e6ff' }}>{b.desc}</span>
              </button>
            );
          })}
        </div>
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
        fontSize: 24, letterSpacing: '.26em', color: callout.color, fontWeight: 700,
        textShadow: `2px 2px 0 #05030a, 0 0 18px ${callout.color}`, fontFamily: 'Menlo, "SF Mono", monospace',
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
      style={{ background: '#07050ee6', border: '2px solid #c99b4388', padding: 2, flexShrink: 0, boxShadow: '2px 2px 0 #040208' }}
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

function KeyCap({ k, label }: { k: string; label: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <span className="ps1-key">{k}</span>
      <span style={{ opacity: 0.78 }}>{label}</span>
    </span>
  );
}

function ArenaHud() {
  const { scene, setScene, style } = useGame();
  const a = useArena();
  if (scene !== 'arena') return null;
  const stDef = STYLES[style];
  const leave = () => { a.set({ phase: 'intro', hp: 100, st: 100, enemies: [], callout: null, combo: 0 }); setScene('ludus'); };
  return (
    <>
      <div style={{ position: 'absolute', top: 52, left: 20, display: 'grid', gap: 6 }}>
        <div className="ps1-box" style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <LimbDoll limbs={a.playerLimbs} size={58} />
          <div style={{ display: 'grid', gap: 5 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, fontSize: 11, letterSpacing: '.14em' }}>
              <span style={{ color: stDef.color }}>{stDef.name}</span>
              <span style={{ color: '#ffc95c' }}>BOUT {a.bout}/{LADDER.length}</span>
            </div>
            <Bar v={a.hp} max={a.maxHp} color="#ff4f6d" w={190} />
            <Bar v={a.st} max={a.maxSt} color="#4dffa0" w={155} />
          </div>
        </div>
        <div
          style={{
            display: 'inline-block', justifySelf: 'start', fontSize: 11, letterSpacing: '.14em',
            padding: '3px 8px',
            border: `1px solid ${a.lockedName ? '#3ff0ff88' : '#c99b4366'}`,
            color: a.lockedName ? '#3ff0ff' : '#cfc6e8aa',
            background: '#0d0919cc',
          }}
        >
          {a.lockedName ? `LOCKED · ${a.lockedName} [TAB]` : 'FREE CAM · Q/E ORBIT [TAB]'}
        </div>
        {a.combo >= 2 && (
          <div style={{ fontSize: 18, letterSpacing: '.25em', color: '#ffc95c', textShadow: '2px 2px 0 #05030a, 0 0 12px #ffc95caa' }}>
            {a.combo} HIT
          </div>
        )}
        <BoonList ids={a.boons} />
      </div>

      <div style={{ position: 'absolute', top: 52, left: '50%', transform: 'translateX(-50%)', display: 'grid', gap: 8, justifyItems: 'center' }}>
        {a.enemies.filter((e) => e.hp > 0).map((e) => (
          <div key={e.id} className="ps1-box" style={{ padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ display: 'grid', gap: 4, justifyItems: 'center' }}>
              <div style={{ letterSpacing: '.22em', fontSize: 12, color: '#ff6b6b' }}>{e.name} · {e.styleName}</div>
              <Bar v={e.hp} max={e.max} color="#ff6b6b" w={210} />
            </div>
            <LimbDoll limbs={e.limbs} size={44} />
          </div>
        ))}
      </div>

      <CalloutFlash />
      {a.phase === 'intro' && (
        <div className="panel" style={{ background: 'transparent' }}>
          <div className="ps1-box" style={{ padding: '16px 36px' }}>
            <h1>BOUT {a.bout}</h1>
            <p style={{ marginTop: 6, color: '#e9e6ff' }}>ENTER THE SAND</p>
          </div>
        </div>
      )}
      {a.phase === 'draft' && <Draft />}
      {(a.phase === 'defeat' || a.phase === 'champion') && (
        <div className="panel">
          <div className="ps1-box" style={{ display: 'grid', gap: 14, justifyItems: 'center' }}>
            <h1 style={a.phase === 'defeat' ? { color: '#ff4f6d', textShadow: '2px 2px 0 #05030a, 0 0 20px #ff4f6d88' } : undefined}>
              {a.phase === 'champion' ? 'CHAMPION OF THE SAND' : 'YOU FELL'}
            </h1>
            <p>{a.phase === 'champion' ? `+${a.earned} GLORY. Your name is sung in the stands.` : `Bout ${a.bout} of ${LADDER.length}. Your name is carved on the Wall of the Fallen.`}</p>
            <button className="clickable btn" onClick={leave}>RETURN TO THE LUDUS</button>
          </div>
        </div>
      )}
      <div className="controls">
        <KeyCap k="WASD" label="Move" />
        <KeyCap k="LMB/J" label="Combo" />
        <KeyCap k="RMB/K" label="Heavy" />
        <KeyCap k="F" label="Bash" />
        <KeyCap k="SHIFT" label="Guard" />
        <KeyCap k="SPACE" label="Dodge" />
        <KeyCap k="TAB" label="Lock" />
        <KeyCap k="P" label="CRT" />
      </div>
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
      <TopRightControls />
      {station && !panel && <div className="hint" style={{ borderColor: station.color, color: station.color }}>[ENTER] {station.verb}</div>}
      {scene === 'ludus' && (
        <div className="controls">
          <KeyCap k="WASD" label="Move" />
          <KeyCap k="Q/E" label="Orbit" />
          <KeyCap k="R/F" label="Tilt" />
          <KeyCap k="ENTER" label="Use" />
          <KeyCap k="P" label="CRT" />
        </div>
      )}
      <StationPanel />
      <ArenaHud />
    </div>
  );
}
