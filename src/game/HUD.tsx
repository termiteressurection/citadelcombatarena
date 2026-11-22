import { useEffect, useMemo, useRef, useState, type JSX } from 'react';
import { STATIONS } from './world/layout';
import { useGame } from './store';
import { useArena, type LimbHud } from './arena/arenaStore';
import { boonById } from './arena/boons';
import { type LimbKey } from './arena/combat';
import { LADDER, LOOKS } from './arena/run';
import {
  BODIES, CAPES, HELMS, OFFHANDS, WEAPONS, itemById, resolveLoadout, type GearSlot,
} from './rpg/items';
import {
  CONSUMABLES, MAX_FLASKS, STAT_INFO, STAT_KEYS, fameRankOf, nextFameRankOf, xpForNextLevel,
} from './rpg/stats';
import { generateDailyQuests, generateFightCards } from './rpg/quests';

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

function TownStatusStrip() {
  const g = useGame();
  if (g.scene !== 'ludus') return null;
  const rank = fameRankOf(g.fame);
  const needXp = xpForNextLevel(g.level);
  const xpPct = Math.min(100, (g.xp / needXp) * 100);
  const gear = resolveLoadout(g.loadout);
  const showStreetBars = g.weaponDrawn || g.streetVitals.hp < g.streetVitals.maxHp;

  return (
    <>
      <div
        className="ps1-box clickable"
        style={{
          position: 'absolute', top: 44, left: 20, padding: '10px 14px',
          display: 'grid', gap: 6, width: 325,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, letterSpacing: '.14em' }}>
          <span style={{ color: g.timeOfDay === 'morning' ? '#3ff0ff' : '#ff4fd8' }}>
            CYCLE {g.day} · {g.timeOfDay === 'morning' ? 'BOOT CYCLE' : 'PURGE DUSK'}
          </span>
          <span style={{ color: rank.color }}>{rank.name} ({g.fame}S)</span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 12, color: '#e9e6ff', letterSpacing: '.12em' }}>LVL {g.level}</span>
          <div className="ps1-bar-track" style={{ flex: 1, height: 10 }}>
            <div className="ps1-bar-fill" style={{ width: `${xpPct}%`, backgroundColor: '#3ff0ff' }} />
          </div>
          <span style={{ fontSize: 10, color: '#a99dc4' }}>{g.xp}/{needXp}</span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, letterSpacing: '.1em' }}>
          <span style={{ color: '#ffc95c', fontWeight: 700 }}>{g.denarii} CYCLES</span>
          <span style={{ color: g.flasks > 0 ? '#4dffa0' : '#a99dc4' }}>
            [H] RESTORES {g.flasks}/{MAX_FLASKS}
          </span>
        </div>

        {showStreetBars && (
          <div style={{ display: 'grid', gap: 4, paddingTop: 2 }}>
            <Bar v={g.streetVitals.hp} max={g.streetVitals.maxHp} color="#ff4f6d" w={292} />
            <Bar v={g.streetVitals.st} max={g.streetVitals.maxSt} color="#4dffa0" w={220} />
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6, marginTop: 2 }}>
          <button
            className="clickable btn"
            style={{
              padding: '4px 8px', fontSize: 10, letterSpacing: '.08em',
              borderColor: g.weaponDrawn ? '#ff4f6d' : '#3ff0ff',
              color: g.weaponDrawn ? '#ff4f6d' : '#3ff0ff',
            }}
            onClick={() => g.toggleWeaponDrawn()}
          >
            [X] {g.weaponDrawn ? 'BLADE DRAWN' : 'SHEATHED'}
          </button>
          <button
            className="clickable btn"
            style={{
              padding: '4px 9px', fontSize: 10, letterSpacing: '.1em',
              borderColor: g.statPoints > 0 ? '#4dffa0' : '#c99b43',
              color: g.statPoints > 0 ? '#4dffa0' : '#ffc95c',
            }}
            onClick={() => g.openPanel(g.panel === 'locker' ? null : 'locker')}
          >
            {g.statPoints > 0 ? `[C] +${g.statPoints} SPECS!` : '[C] GEAR & SPECS'}
          </button>
        </div>

        {g.bounty > 0 && (
          <div
            style={{
              fontSize: 10, padding: '3px 8px', background: '#260814',
              border: '1px solid #ff3b5c', color: '#ff4f6d', letterSpacing: '.12em', textAlign: 'center',
            }}
          >
            SYSWATCH BOUNTY: {g.bounty} CYCLES
          </div>
        )}

        {g.dailyBuffs.length > 0 && (
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', paddingTop: 2 }}>
            {g.dailyBuffs.map((b) => {
              const def = CONSUMABLES.find((x) => x.id === b);
              return (
                <span
                  key={b}
                  style={{
                    fontSize: 9, padding: '2px 6px', border: `1px solid ${def?.color ?? '#ffc95c'}`,
                    color: def?.color ?? '#ffc95c', background: '#07050e', letterSpacing: '.08em',
                  }}
                >
                  {b === 'honey_bread' ? '+25 HP' : b === 'iron_wine' ? '+25% BW' : '+15% DMG'}
                </span>
              );
            })}
          </div>
        )}

        <div style={{ fontSize: 9, color: gear.color, opacity: 0.85, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          LOADOUT: {gear.name}
        </div>
      </div>

      {!g.panel && !g.arrestPrompt && (
        <div
          className="ps1-box"
          style={{
            position: 'absolute', top: 52, right: 18, padding: '8px 12px',
            display: 'grid', gap: 5, width: 256,
          }}
        >
          <div style={{ fontSize: 10, color: '#ffc95c', letterSpacing: '.18em', borderBottom: '1px solid #c99b4344', paddingBottom: 4 }}>
            SYS CONTRACTS ({g.activeQuests.length}/3)
          </div>
          {g.activeQuests.length === 0 ? (
            <div style={{ fontSize: 10, color: '#a99dc4', letterSpacing: '.06em' }}>
              Visit Bounty Terminal (-14, -30) for contracts.
            </div>
          ) : (
            g.activeQuests.map((q) => {
              const done = q.progress >= q.target;
              return (
                <div key={q.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 10, gap: 6 }}>
                  <span style={{ color: done ? '#4dffa0' : '#e9e6ff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {q.title}
                  </span>
                  <span style={{ color: done ? '#4dffa0' : '#ffc95c', flexShrink: 0 }}>
                    {done ? 'READY!' : `${q.progress}/${q.target}`}
                  </span>
                </div>
              );
            })
          )}
        </div>
      )}
    </>
  );
}

function StreetOverlays() {
  const g = useGame();
  const [showToast, setShowToast] = useState(false);

  useEffect(() => {
    if (!g.streetToast) { setShowToast(false); return; }
    setShowToast(true);
    const id = setTimeout(() => setShowToast(false), 5200);
    return () => clearTimeout(id);
  }, [g.streetToast?.id]);

  if (g.scene !== 'ludus') return null;

  return (
    <>
      {showToast && g.streetToast && (
        <div
          className="ps1-box"
          style={{
            position: 'absolute', top: 84, left: '50%', transform: 'translateX(-50%)',
            padding: '8px 16px', maxWidth: 460, textAlign: 'center',
            borderColor: g.streetToast.color, display: 'grid', gap: 3,
          }}
        >
          <div style={{ fontSize: 10, letterSpacing: '.16em', color: g.streetToast.color, fontWeight: 700 }}>
            {g.streetToast.speaker}
          </div>
          <div style={{ fontSize: 12, color: '#e9e6ff' }}>"{g.streetToast.text}"</div>
        </div>
      )}

      {g.nearNpc && !g.panel && !g.arrestPrompt && !g.inJail && (
        <div
          className="ps1-box"
          style={{
            position: 'absolute', bottom: g.near ? 104 : 56, left: '50%', transform: 'translateX(-50%)',
            padding: '8px 16px', minWidth: 320, textAlign: 'center', display: 'grid', gap: 5,
            borderColor: g.nearNpc.hostile ? '#ff4f6d' : '#3ff0ff',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 14, fontSize: 11 }}>
            <span style={{ color: g.nearNpc.hostile ? '#ff4f6d' : '#3ff0ff', fontWeight: 700 }}>{g.nearNpc.filename}</span>
            <span style={{ color: '#ffc95c', fontSize: 10, letterSpacing: '.12em' }}>
              {g.nearNpc.role.toUpperCase()} · {g.nearNpc.mood.toUpperCase()}
            </span>
          </div>
          {g.nearNpc.hostile && <Bar v={g.nearNpc.hp} max={g.nearNpc.maxHp} color="#ff4f6d" w={290} />}
          <div style={{ fontSize: 10, color: '#cfc6e8', letterSpacing: '.1em' }}>
            [T] GREET · [G] PROVOKE · {g.weaponDrawn ? '[LMB/J/K] STRIKE' : '[X] DRAW BLADE'}
          </div>
        </div>
      )}

      {g.inJail && (
        <div
          className="ps1-box clickable"
          style={{
            position: 'absolute', bottom: 64, left: '50%', transform: 'translateX(-50%)',
            padding: '14px 20px', width: 'min(480px, 90vw)', display: 'grid', gap: 10,
            borderColor: '#ff4f6d', textAlign: 'center',
          }}
        >
          <div style={{ fontSize: 15, color: '#ff4f6d', fontWeight: 700, letterSpacing: '.2em' }}>
            QUARANTINE CELL // CONTAINMENT LOCKED
          </div>
          <p style={{ fontSize: 11, color: '#cfc6e8' }}>
            Held by SysWatch under the Data-Aqueduct. Bounty: {g.bounty} Cycles. Serve one cycle to wipe your ledger cleanly, or bypass the laser grid right now.
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              className="clickable btn"
              style={{ borderColor: '#4dffa0', color: '#4dffa0', fontSize: 11, padding: '8px 14px' }}
              onClick={() => g.serveJailSentence()}
            >
              SERVE 1 CYCLE (CLEAR BOUNTY)
            </button>
            <button
              className="clickable btn"
              style={{ borderColor: '#ff4f6d', color: '#ff4f6d', fontSize: 11, padding: '8px 14px' }}
              onClick={() => g.breakOutOfJail()}
            >
              HACK LOCK & BREAK OUT! (+25 BOUNTY)
            </button>
          </div>
        </div>
      )}

      {g.arrestPrompt && (
        <div className="panel clickable">
          <div className="ps1-box" style={{ display: 'grid', gap: 14, width: 'min(480px, 92vw)', borderColor: '#ff3b5c', justifyItems: 'center' }}>
            <h1 style={{ color: '#ff3b5c', fontSize: 24, letterSpacing: '.24em' }}>SYSWATCH INTERCEPT</h1>
            <p style={{ color: '#e9e6ff' }}>
              Officer <span style={{ color: '#ff4f6d' }}>{g.arrestPrompt.officerName}</span> halts your runtime!
            </p>
            <div style={{ fontSize: 13, color: '#ffc95c', letterSpacing: '.14em' }}>
              CURRENT BOUNTY: {g.arrestPrompt.bounty} CYCLES (YOU: {g.denarii})
            </div>
            <div style={{ display: 'grid', gap: 8, width: '100%' }}>
              <button
                className="clickable btn"
                disabled={g.denarii < g.arrestPrompt.bounty}
                style={{
                  width: '100%', opacity: g.denarii < g.arrestPrompt.bounty ? 0.45 : 1,
                  borderColor: '#ffc95c', color: '#ffc95c',
                }}
                onClick={() => g.payBounty()}
              >
                PAY FINE ({g.arrestPrompt.bounty} CYCLES)
              </button>
              <button
                className="clickable btn"
                style={{ width: '100%', borderColor: '#a78bfa', color: '#a78bfa' }}
                onClick={() => g.enterJail()}
              >
                SUBMIT TO QUARANTINE CELL
              </button>
              <button
                className="clickable btn"
                style={{ width: '100%', borderColor: '#ff4f6d', color: '#ff4f6d' }}
                onClick={() => g.closeArrestPrompt()}
              >
                RESIST ARREST! (FIGHT SYSWATCH)
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function ownedForSlot(g: ReturnType<typeof useGame.getState>, slot: GearSlot): string[] {
  if (slot === 'weapon') return g.ownedWeapons;
  if (slot === 'offhand') return g.ownedOffhands;
  if (slot === 'helm') return g.ownedHelms;
  if (slot === 'body') return g.ownedBodies;
  return g.ownedCapes;
}

function equippedForSlot(g: ReturnType<typeof useGame.getState>, slot: GearSlot): string {
  if (slot === 'weapon') return g.loadout.weaponId;
  if (slot === 'offhand') return g.loadout.offhandId;
  if (slot === 'helm') return g.loadout.helmId;
  if (slot === 'body') return g.loadout.bodyId;
  return g.loadout.capeId;
}

function LockerDrawer() {
  const g = useGame();
  const [tab, setTab] = useState<'gear' | 'stats'>(g.statPoints > 0 ? 'stats' : 'gear');
  const gear = useMemo(() => resolveLoadout(g.loadout), [g.loadout]);
  const weaponDef = itemById(WEAPONS, g.loadout.weaponId);

  const slotGroups: { slot: GearSlot; label: string; items: { id: string; name: string; desc: string }[] }[] = [
    { slot: 'weapon', label: 'MAIN WEAPON (SETS MOVESET)', items: WEAPONS },
    { slot: 'offhand', label: weaponDef.twoHanded ? 'OFF-HAND (STORED WHILE WIELDING 2H)' : 'OFF-HAND / SHIELD / NET', items: OFFHANDS },
    { slot: 'helm', label: 'HEADER / VISOR', items: HELMS },
    { slot: 'body', label: 'SHELL ARMOR', items: BODIES },
    { slot: 'cape', label: 'DATA STREAMER / CAPE', items: CAPES },
  ];

  return (
    <div className="ps1-box ps1-armory-drawer clickable">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #c99b4355', paddingBottom: 8 }}>
        <h2 className="ps1-heading" style={{ color: '#ffc95c', fontSize: 19, letterSpacing: '.22em' }}>MEMORY LOCKER</h2>
        <button className="clickable btn" style={{ padding: '4px 10px', fontSize: 11 }} onClick={() => g.openPanel(null)}>CLOSE</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
        <button
          className="clickable btn"
          style={{
            padding: '7px 8px', fontSize: 11, letterSpacing: '.12em', width: '100%',
            borderColor: tab === 'gear' ? '#ffc95c' : '#4d3f66',
            color: tab === 'gear' ? '#ffc95c' : '#cfc6e8',
            background: tab === 'gear' ? '#1e1633' : '#0b0816',
          }}
          onClick={() => setTab('gear')}
        >
          LOADOUT
        </button>
        <button
          className="clickable btn"
          style={{
            padding: '7px 8px', fontSize: 11, letterSpacing: '.12em', width: '100%',
            borderColor: tab === 'stats' ? '#4dffa0' : g.statPoints > 0 ? '#4dffa088' : '#4d3f66',
            color: g.statPoints > 0 ? '#4dffa0' : tab === 'stats' ? '#3ff0ff' : '#cfc6e8',
            background: tab === 'stats' ? '#1e1633' : '#0b0816',
          }}
          onClick={() => setTab('stats')}
        >
          SYS SPECS {g.statPoints > 0 ? `(+${g.statPoints})` : ''}
        </button>
      </div>

      {tab === 'gear' ? (
        <div style={{ display: 'grid', gap: 10 }}>
          <div style={{ padding: '8px 10px', background: '#07050e', border: '1px solid #4d3f66', display: 'grid', gap: 3, fontSize: 10 }}>
            <div style={{ color: gear.color, fontSize: 12, fontWeight: 700 }}>{gear.name}</div>
            <div style={{ color: '#ffc95c' }}>Light: {gear.moves.light.name} · Heavy: {gear.moves.heavy.name}</div>
            <div style={{ color: '#cfc6e8' }}>
              Shell HP: H{gear.armor.helm} / B{gear.armor.pauldron} / S{gear.armor.shield} · Speed {Math.round(gear.speedMul * 100)}% · Signal ×{gear.fameMul.toFixed(2)}
            </div>
          </div>

          {slotGroups.map(({ slot, label, items }) => {
            const ownedIds = ownedForSlot(g, slot);
            const curId = equippedForSlot(g, slot);
            const ownedItems = items.filter((x) => ownedIds.includes(x.id));
            return (
              <div key={slot} style={{ display: 'grid', gap: 4 }}>
                <div style={{ fontSize: 10, color: '#ffc95c', letterSpacing: '.14em' }}>{label}</div>
                <div style={{ display: 'grid', gap: 4 }}>
                  {ownedItems.map((it) => {
                    const eq = curId === it.id;
                    return (
                      <button
                        key={it.id}
                        className="clickable btn"
                        style={{
                          width: '100%', textAlign: 'left', padding: '6px 9px',
                          display: 'grid', gap: 2, letterSpacing: '.06em',
                          borderColor: eq ? '#4dffa0' : '#4d3f66',
                          color: eq ? '#4dffa0' : '#e9e6ff',
                          background: eq ? '#162420' : '#0b0816',
                        }}
                        onClick={() => g.equipItem(slot, it.id)}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                          <span>{eq ? '▶ ' : ''}{it.name}</span>
                          {eq && <span style={{ fontSize: 9 }}>EQUIPPED</span>}
                        </div>
                        <div style={{ fontSize: 9, opacity: 0.78 }}>{it.desc}</div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}

          <div style={{ display: 'grid', gap: 5 }}>
            <div style={{ fontSize: 10, color: '#ffc95c', letterSpacing: '.14em' }}>NEON SHELL TINT</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {LOOKS.filter((l) => g.unlocks.includes(l.id)).map((l) => (
                <button
                  key={l.id}
                  className="clickable btn"
                  style={{
                    color: l.color, borderColor: g.look === l.id ? l.color : '#4d3f66',
                    padding: '5px 9px', fontSize: 10, letterSpacing: '.08em',
                  }}
                  onClick={() => g.equipLook(l.id)}
                >
                  {g.look === l.id ? '▶ ' : ''}{l.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 9 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#4dffa0' }}>
            <span>UNSPENT SPECS: {g.statPoints}</span>
            <span style={{ color: '#a99dc4' }}>LVL {g.level} ({g.xp}/{xpForNextLevel(g.level)} XP)</span>
          </div>
          {STAT_KEYS.map((k) => {
            const info = STAT_INFO[k];
            const val = g.stats[k];
            return (
              <div
                key={k}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                  padding: '8px 10px', background: '#07050e', border: '1px solid #4d3f66',
                }}
              >
                <div style={{ display: 'grid', gap: 2 }}>
                  <div style={{ fontSize: 12, color: info.color, letterSpacing: '.1em' }}>
                    {info.label}: {val}
                  </div>
                  <div style={{ fontSize: 9, color: '#cfc6e8' }}>{info.desc}</div>
                </div>
                <button
                  className="clickable btn"
                  disabled={g.statPoints <= 0}
                  style={{
                    padding: '5px 12px', fontSize: 13, letterSpacing: '.05em',
                    opacity: g.statPoints > 0 ? 1 : 0.3,
                    borderColor: info.color, color: info.color,
                  }}
                  onClick={() => g.upgradeStat(k)}
                >
                  +
                </button>
              </div>
            );
          })}
        </div>
      )}
      <div style={{ fontSize: 10, opacity: 0.55, textAlign: 'center', paddingTop: 4 }}>[C] or [ESC] to close</div>
    </div>
  );
}

function ShopDrawer({ kind }: { kind: 'smith' | 'armorer' }) {
  const g = useGame();
  const title = kind === 'smith' ? 'COMPILER FORGE' : 'SHELL CLINIC';
  const sections: { slot: GearSlot; label: string; items: { id: string; name: string; desc: string; cost: number; reqFame: number; color?: string; twoHanded?: boolean; netHeavy?: boolean }[] }[] =
    kind === 'smith'
      ? [
          { slot: 'weapon', label: 'HARD-LIGHT WEAPONS (SETS MOVESET)', items: WEAPONS },
          { slot: 'offhand', label: 'HOLO-SHIELDS & TRAP NETS', items: OFFHANDS.filter((o) => o.id !== 'none') },
        ]
      : [
          { slot: 'helm', label: 'HEADERS / VISORS', items: HELMS.filter((h) => h.id !== 'none') },
          { slot: 'body', label: 'SHELL ARMOR', items: BODIES },
          { slot: 'cape', label: 'STREAMERS & MANTLES', items: CAPES.filter((c) => c.id !== 'none') },
        ];

  return (
    <div className="ps1-box ps1-armory-drawer clickable">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #c99b4355', paddingBottom: 8 }}>
        <div>
          <h2 className="ps1-heading" style={{ color: kind === 'smith' ? '#ff8a3d' : '#3ff0ff', fontSize: 19, letterSpacing: '.22em' }}>{title}</h2>
          <div style={{ fontSize: 11, color: '#ffc95c', marginTop: 2 }}>{g.denarii} CYCLES · {g.fame} SIGNAL</div>
        </div>
        <button className="clickable btn" style={{ padding: '4px 10px', fontSize: 11 }} onClick={() => g.openPanel(null)}>CLOSE</button>
      </div>

      {sections.map(({ slot, label, items }) => {
        const ownedIds = ownedForSlot(g, slot);
        const curId = equippedForSlot(g, slot);
        return (
          <div key={slot} style={{ display: 'grid', gap: 5 }}>
            <div style={{ fontSize: 10, color: '#ffc95c', letterSpacing: '.14em', marginTop: 4 }}>{label}</div>
            {items.map((it) => {
              const owned = ownedIds.includes(it.id);
              const eq = curId === it.id;
              const lockedSignal = !owned && g.fame < it.reqFame;
              const cantAfford = !owned && !lockedSignal && g.denarii < it.cost;
              const col = it.color ?? '#ffc95c';
              return (
                <button
                  key={it.id}
                  className="clickable btn"
                  disabled={lockedSignal || cantAfford}
                  style={{
                    width: '100%', textAlign: 'left', padding: '7px 10px', display: 'grid', gap: 3, letterSpacing: '.05em',
                    borderColor: eq ? '#4dffa0' : owned ? '#3ff0ff' : col,
                    color: eq ? '#4dffa0' : lockedSignal || cantAfford ? '#8c81a8' : '#e9e6ff',
                    opacity: lockedSignal ? 0.52 : cantAfford ? 0.72 : 1,
                    background: eq ? '#162420' : '#0b0816',
                  }}
                  onClick={() => g.buyAndEquipItem(slot, it.id)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                    <span style={{ color: eq ? '#4dffa0' : col }}>
                      {eq ? '▶ ' : ''}{it.name}{it.twoHanded ? ' [2H]' : it.netHeavy ? ' [NET]' : ''}
                    </span>
                    <span style={{ fontSize: 10 }}>
                      {eq ? 'EQUIPPED' : owned ? 'OWNED · EQUIP' : lockedSignal ? `REQ ${it.reqFame} SIG` : `${it.cost}C · BUY`}
                    </span>
                  </div>
                  <div style={{ fontSize: 9, color: '#cfc6e8' }}>{it.desc}</div>
                </button>
              );
            })}
          </div>
        );
      })}
      <div style={{ fontSize: 10, opacity: 0.55, textAlign: 'center', paddingTop: 4 }}>[ESC] to close</div>
    </div>
  );
}

function StationPanel() {
  const g = useGame();
  if (!g.panel) return null;

  if (g.panel === 'locker') return <LockerDrawer />;
  if (g.panel === 'smith' || g.panel === 'armorer') return <ShopDrawer kind={g.panel} />;

  const s = STATIONS.find((x) => x.id === g.panel)!;
  const gear = resolveLoadout(g.loadout);
  const dailyQuests = generateDailyQuests(g.day);
  const fightCards = generateFightCards(g.day, g.fame);
  const rank = fameRankOf(g.fame);
  const nextRank = nextFameRankOf(g.fame);

  const body: Record<string, JSX.Element> = {
    apothecary: (
      <>
        <div style={{ display: 'flex', gap: 18, fontSize: 12, color: '#ffc95c' }}>
          <span>{g.denarii} CYCLES</span>
          <span style={{ color: '#4dffa0' }}>RESTORES: {g.flasks}/{MAX_FLASKS}</span>
        </div>
        <div style={{ display: 'grid', gap: 8, width: '100%' }}>
          {CONSUMABLES.map((c) => {
            const isFlask = c.kind === 'flask';
            const full = isFlask && g.flasks >= MAX_FLASKS;
            const active = !isFlask && g.dailyBuffs.includes(c.id as typeof g.dailyBuffs[number]);
            const disabled = full || active || g.denarii < c.cost;
            return (
              <button
                key={c.id}
                className="clickable btn"
                disabled={disabled}
                style={{
                  width: '100%', textAlign: 'left', padding: '9px 12px', display: 'grid', gap: 3, letterSpacing: '.06em',
                  borderColor: active ? '#4dffa0' : c.color, color: active ? '#4dffa0' : '#e9e6ff',
                  opacity: disabled && !active ? 0.55 : 1,
                }}
                onClick={() => g.buyConsumable(c.id)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                  <span style={{ color: c.color }}>{c.name}</span>
                  <span>{active ? 'ACTIVE CYCLE' : full ? 'SLOT FULL' : `${c.cost} CYCLES`}</span>
                </div>
                <div style={{ fontSize: 10, color: '#cfc6e8' }}>{c.desc}</div>
              </button>
            );
          })}
        </div>
        <p style={{ fontSize: 11 }}>Cycle stimms & rations persist until you Defrag in the Safe Sector Pod.</p>
      </>
    ),

    board: (
      <div style={{ display: 'grid', gap: 12, width: '100%' }}>
        <div style={{ display: 'grid', gap: 6 }}>
          <div style={{ fontSize: 11, color: '#ffc95c', letterSpacing: '.16em' }}>
            ACTIVE SYS CONTRACTS ({g.activeQuests.length}/3)
          </div>
          {g.activeQuests.length === 0 ? (
            <p>No active contracts. Accept up to 3 below.</p>
          ) : (
            g.activeQuests.map((q) => {
              const ready = q.progress >= q.target;
              return (
                <div
                  key={q.id}
                  style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10,
                    padding: '8px 12px', background: '#07050e', border: `1px solid ${ready ? '#4dffa0' : '#4d3f66'}`,
                  }}
                >
                  <div style={{ textAlign: 'left', display: 'grid', gap: 2 }}>
                    <div style={{ fontSize: 12, color: ready ? '#4dffa0' : '#ffc95c' }}>
                      {q.title} ({q.progress}/{q.target})
                    </div>
                    <div style={{ fontSize: 10, color: '#cfc6e8' }}>{q.desc}</div>
                    <div style={{ fontSize: 10, color: '#3ff0ff' }}>Reward: {q.denarii}C · {q.xp} XP · {q.fame} Signal</div>
                  </div>
                  {ready && (
                    <button
                      className="clickable btn"
                      style={{ padding: '6px 12px', fontSize: 11, borderColor: '#4dffa0', color: '#4dffa0' }}
                      onClick={() => g.claimQuest(q.id)}
                    >
                      CLAIM
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>

        <div style={{ display: 'grid', gap: 6 }}>
          <div style={{ fontSize: 11, color: '#ffc95c', letterSpacing: '.16em' }}>
            CYCLE {g.day} SYSTEM BOUNTIES
          </div>
          {dailyQuests.map((q) => {
            const accepted = g.activeQuests.some((x) => x.id === q.id);
            const completed = g.completedQuestIds.includes(q.id);
            const full = g.activeQuests.length >= 3;
            return (
              <div
                key={q.id}
                style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10,
                  padding: '8px 12px', background: '#0b0816', border: '1px solid #4d3f66',
                }}
              >
                <div style={{ textAlign: 'left', display: 'grid', gap: 2 }}>
                  <div style={{ fontSize: 12, color: '#e9e6ff' }}>{q.title}</div>
                  <div style={{ fontSize: 10, color: '#cfc6e8' }}>{q.desc}</div>
                  <div style={{ fontSize: 10, color: '#ffc95c' }}>Reward: {q.denarii}C · {q.xp} XP · {q.fame} Signal</div>
                </div>
                <button
                  className="clickable btn"
                  disabled={accepted || completed || full}
                  style={{ padding: '6px 12px', fontSize: 11, opacity: accepted || completed || full ? 0.45 : 1 }}
                  onClick={() => g.acceptQuest(q)}
                >
                  {completed ? 'DONE' : accepted ? 'ACTIVE' : 'ACCEPT'}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    ),

    bunk: (
      <>
        <p style={{ color: g.timeOfDay === 'morning' ? '#3ff0ff' : '#ff4fd8' }}>
          CYCLE {g.day} · {g.timeOfDay === 'morning' ? 'BOOT CYCLE' : 'PURGE DUSK'}
        </p>
        <p>Run a memory Defrag inside your Safe Sector Pod to restore full runtime for Cycle {g.day + 1}. Fresh Purge Cards and System Bounties rotate at boot.</p>
        <button
          className="clickable btn"
          style={{ borderColor: '#a78bfa', color: '#e9e6ff' }}
          onClick={() => { g.sleepNextDay(); g.openPanel(null); }}
        >
          DEFRAG TO CYCLE {g.day + 1}
        </button>
      </>
    ),

    yard: (
      <div style={{ display: 'grid', gap: 12, width: '100%' }}>
        <p>Synthetic holo-targets humming beside the simulation racks.</p>
        <button
          className="clickable btn"
          disabled={g.trainedToday}
          style={{ opacity: g.trainedToday ? 0.5 : 1, borderColor: '#ff6b6b', color: '#ffc95c' }}
          onClick={() => g.drillTraining()}
        >
          {g.trainedToday ? 'SIM DRILL COMPLETED THIS CYCLE' : 'RUN COMBAT BENCHMARK (+35 XP)'}
        </button>
        <div style={{ fontSize: 11, color: '#4dffa0', letterSpacing: '.14em' }}>
          QUICK SPEC UPGRADES · UNSPENT: {g.statPoints}
        </div>
        <div style={{ display: 'grid', gap: 5 }}>
          {STAT_KEYS.map((k) => {
            const info = STAT_INFO[k];
            return (
              <div
                key={k}
                style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '6px 10px', background: '#07050e', border: '1px solid #4d3f66', fontSize: 11,
                }}
              >
                <span style={{ color: info.color }}>{info.short}: {g.stats[k]}</span>
                <span style={{ color: '#cfc6e8', fontSize: 10 }}>{info.desc}</span>
                <button
                  className="clickable btn"
                  disabled={g.statPoints <= 0}
                  style={{ padding: '3px 10px', fontSize: 12, opacity: g.statPoints > 0 ? 1 : 0.3 }}
                  onClick={() => g.upgradeStat(k)}
                >
                  +
                </button>
              </div>
            );
          })}
        </div>
      </div>
    ),

    wall: (
      <div style={{ display: 'grid', gap: 10, width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-around', fontSize: 12, color: '#ffc95c' }}>
          <span>W/L: {g.wins}-{g.losses}</span>
          <span style={{ color: rank.color }}>{rank.name} ({g.fame} SIG)</span>
          <span>ROOT CLEARS: {g.champions}</span>
        </div>
        {nextRank && (
          <p style={{ fontSize: 11 }}>Next Tier: {nextRank.name} at {nextRank.min} Signal</p>
        )}
        <div style={{ fontSize: 11, color: '#ffc95c', letterSpacing: '.14em' }}>NEON SHELL TINTS</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
          {LOOKS.map((l) => {
            const unlocked = g.unlocks.includes(l.id);
            const eq = g.look === l.id;
            return (
              <button
                key={l.id}
                className="clickable btn"
                disabled={!unlocked && g.denarii < l.cost}
                style={{
                  color: l.color, borderColor: eq ? '#4dffa0' : l.color,
                  opacity: !unlocked && g.denarii < l.cost ? 0.4 : 1,
                  padding: '6px 10px', fontSize: 10,
                }}
                onClick={() => (unlocked ? g.equipLook(l.id) : g.buyLook(l.id))}
              >
                {eq ? '▶ ' : ''}{l.name}{!unlocked ? ` · ${l.cost}C` : ''}
              </button>
            );
          })}
        </div>
        <div style={{ fontSize: 11, color: '#a99dc4', letterSpacing: '.12em', marginTop: 4 }}>DELETION LOG</div>
        {g.fallen.length === 0 ? (
          <p>Zero de-rezzes recorded on your address block.</p>
        ) : (
          [...g.fallen].reverse().slice(0, 5).map((f, i) => (
            <p key={i} style={{ fontSize: 11 }}>{f.name} — {f.cause} ({f.date})</p>
          ))
        )}
      </div>
    ),

    gate: (
      <div style={{ display: 'grid', gap: 10, width: '100%' }}>
        <div style={{ fontSize: 11, color: gear.color }}>
          ACTIVE: {gear.name} · HEAVY: {gear.moves.heavy.name} · RESTORES: {g.flasks}/{MAX_FLASKS}
        </div>
        <div style={{ display: 'grid', gap: 8 }}>
          {fightCards.map((card) => {
            const locked = g.fame < card.reqFame;
            return (
              <div
                key={card.id}
                style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12,
                  padding: '10px 12px', background: '#07050e',
                  border: `1px solid ${locked ? '#4d3f66' : card.tier === 4 ? '#ff4fd8' : '#c99b43'}`,
                  opacity: locked ? 0.55 : 1,
                }}
              >
                <div style={{ textAlign: 'left', display: 'grid', gap: 3 }}>
                  <div style={{ fontSize: 12, color: card.tier === 4 ? '#ff4fd8' : '#ffc95c', fontWeight: 700 }}>
                    TIER {card.tier} · {card.title}
                  </div>
                  <div style={{ fontSize: 10, color: '#e9e6ff' }}>{card.subtitle}</div>
                  <div style={{ fontSize: 10, color: '#4dffa0' }}>
                    {locked ? `Requires ${card.reqFame} Signal (You: ${g.fame})` : `Payout: ${card.denarii}C · ${card.xp} XP · ${card.fame} Signal`}
                  </div>
                </div>
                <button
                  className="clickable btn"
                  disabled={locked}
                  style={{ padding: '7px 14px', fontSize: 11, flexShrink: 0 }}
                  onClick={() => {
                    useArena.getState().startRun();
                    g.startCardBout(card);
                  }}
                >
                  ENTER THE GRID
                </button>
              </div>
            );
          })}
        </div>
      </div>
    ),
  };

  return (
    <div className="panel clickable">
      <div className="ps1-box" style={{ display: 'grid', gap: 14, width: 'min(640px, 92vw)', maxHeight: '86vh', overflowY: 'auto', justifyItems: 'center' }}>
        <h1 style={{ color: s.color, fontSize: 26, textShadow: `2px 2px 0 #05030a, 0 0 18px ${s.color}77` }}>{s.label}</h1>
        {body[g.panel]}
        <p style={{ opacity: 0.55, fontSize: 11 }}>[ESC] to close</p>
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

/** Fate: three boons, take one, lose the other two. Used in legacy ?arena ladder mode. */
function Draft() {
  const a = useArena();
  useEffect(() => {
    const h = (e: KeyboardEvent) => { const i = ['Digit1', 'Digit2', 'Digit3'].indexOf(e.code); if (i >= 0 && a.draft[i]) a.pick(a.draft[i]); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [a]);
  return (
    <div className="panel clickable">
      <div className="ps1-box" style={{ display: 'grid', gap: 14, justifyItems: 'center' }}>
        <h1>OVERCLOCK</h1>
        <p>Bout {a.bout} cleared. +{a.earned} Signal. Pick one thread.</p>
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
  const { scene, setScene, loadout, flasks, dailyBuffs, selectedCard, lastResult, activeQuests } = useGame();
  const a = useArena();
  if (scene !== 'arena') return null;
  const gear = resolveLoadout(loadout);
  const readyQuests = activeQuests.filter((q) => q.progress >= q.target).length;
  const leave = () => {
    a.set({ phase: 'intro', hp: 100, st: 100, enemies: [], callout: null, combo: 0 });
    setScene('ludus');
  };

  const ended = a.phase === 'victory' || a.phase === 'defeat' || a.phase === 'champion';

  return (
    <>
      <div style={{ position: 'absolute', top: 52, left: 20, display: 'grid', gap: 6 }}>
        <div className="ps1-box" style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <LimbDoll limbs={a.playerLimbs} size={58} />
          <div style={{ display: 'grid', gap: 5 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, fontSize: 11, letterSpacing: '.14em' }}>
              <span style={{ color: gear.color }}>{gear.name}</span>
              <span style={{ color: '#ffc95c' }}>{selectedCard ? selectedCard.title : `BOUT ${a.bout}/${LADDER.length}`}</span>
            </div>
            <Bar v={a.hp} max={a.maxHp} color="#ff4f6d" w={190} />
            <Bar v={a.st} max={a.maxSt} color="#4dffa0" w={155} />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <div
            style={{
              fontSize: 11, letterSpacing: '.12em', padding: '3px 8px',
              border: `1px solid ${a.lockedName ? '#3ff0ff88' : '#c99b4366'}`,
              color: a.lockedName ? '#3ff0ff' : '#cfc6e8aa',
              background: '#0d0919cc',
            }}
          >
            {a.lockedName ? `LOCKED · ${a.lockedName} [TAB]` : 'FREE CAM · Q/E ORBIT [TAB]'}
          </div>
          <div
            style={{
              fontSize: 11, letterSpacing: '.12em', padding: '3px 8px',
              border: `1px solid ${flasks > 0 ? '#4dffa0' : '#4d3f66'}`,
              color: flasks > 0 ? '#4dffa0' : '#8c81a8',
              background: '#0d0919cc',
            }}
          >
            [H] RESTORE ×{flasks}
          </div>
          {dailyBuffs.map((b) => (
            <div
              key={b}
              style={{
                fontSize: 10, padding: '3px 7px', border: '1px solid #ffc95c88',
                color: '#ffc95c', background: '#0d0919cc',
              }}
            >
              {b === 'honey_bread' ? '+25 HP' : b === 'iron_wine' ? '+25% BW' : '+15% DMG'}
            </div>
          ))}
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
            <h1>{selectedCard ? selectedCard.title : `BOUT ${a.bout}`}</h1>
            <p style={{ marginTop: 6, color: '#e9e6ff' }}>ENTER THE PURGE GRID</p>
          </div>
        </div>
      )}
      {a.phase === 'draft' && <Draft />}
      {ended && (
        <div className="panel clickable">
          <div className="ps1-box" style={{ display: 'grid', gap: 12, justifyItems: 'center', minWidth: 380 }}>
            <h1 style={a.phase === 'defeat' ? { color: '#ff4f6d', textShadow: '2px 2px 0 #05030a, 0 0 20px #ff4f6d88' } : undefined}>
              {a.phase === 'champion' ? 'ROOT ACCESS SECURED' : a.phase === 'victory' ? 'PROCESS RETAINED' : 'DE-REZZED ON THE GRID'}
            </h1>
            {lastResult ? (
              <div style={{ display: 'grid', gap: 6, width: '100%', fontSize: 12, color: '#e9e6ff' }}>
                <div style={{ color: lastResult.denariiDelta >= 0 ? '#ffc95c' : '#ff6b6b' }}>
                  {lastResult.denariiDelta >= 0 ? `+${lastResult.denariiDelta} CYCLES SIPHONED` : `${lastResult.denariiDelta} CYCLES (RECOVERY TAX)`}
                </div>
                <div style={{ color: '#3ff0ff' }}>+{lastResult.xpEarned} XP COMPILED</div>
                {lastResult.levelsGained > 0 && (
                  <div style={{ color: '#4dffa0', fontWeight: 700, fontSize: 14, letterSpacing: '.12em' }}>
                    BUILD UPGRADED! +{lastResult.levelsGained * 3} SPEC POINTS [PRESS C IN CITY]
                  </div>
                )}
                <div style={{ color: lastResult.fameDelta >= 0 ? '#a78bfa' : '#ff6b6b' }}>
                  SIGNAL {lastResult.fameDelta >= 0 ? `+${lastResult.fameDelta}` : lastResult.fameDelta}
                </div>
                {readyQuests > 0 && (
                  <div style={{ color: '#4dffa0' }}>
                    {readyQuests} Contract{readyQuests > 1 ? 's' : ''} ready to claim at the Bounty Terminal!
                  </div>
                )}
                {!lastResult.victory && (
                  <p style={{ marginTop: 4 }}>Rebooted inside your Safe Sector Pod. All specs and hard-light gear preserved.</p>
                )}
              </div>
            ) : (
              <p>{a.phase === 'champion' ? `+${a.earned} SIGNAL. Your address remains allocated.` : `Bout ${a.bout} of ${LADDER.length}.`}</p>
            )}
            <button className="clickable btn" onClick={leave}>RETURN TO SECTOR</button>
          </div>
        </div>
      )}
      <div className="controls">
        <KeyCap k="WASD" label="Move" />
        <KeyCap k="LMB/J" label="Combo" />
        <KeyCap k="RMB/K" label="Heavy" />
        <KeyCap k="F" label="Bash" />
        <KeyCap k="SHIFT" label="Parry/Block" />
        <KeyCap k="SPACE" label="Dodge" />
        <KeyCap k="H" label="Restore" />
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
  const arrestPrompt = useGame((s) => s.arrestPrompt);
  const inJail = useGame((s) => s.inJail);
  const station = STATIONS.find((s) => s.id === near);
  return (
    <div className="hud">
      <div className="title">BONEYARD · {scene === 'ludus' ? 'SECTOR /DEV/NULL' : 'PURGE GRID'}</div>
      <TopRightControls />
      <TownStatusStrip />
      <StreetOverlays />
      {station && !panel && !arrestPrompt && !inJail && (
        <div className="hint" style={{ borderColor: station.color, color: station.color }}>[ENTER] {station.verb}</div>
      )}
      {scene === 'ludus' && (
        <div className="controls">
          <KeyCap k="WASD" label="Move" />
          <KeyCap k="T" label="Greet" />
          <KeyCap k="G" label="Provoke" />
          <KeyCap k="X" label="Blade" />
          <KeyCap k="J/K" label="Strike" />
          <KeyCap k="C" label="Gear/Specs" />
          <KeyCap k="ENTER" label="Terminal" />
          <KeyCap k="P" label="CRT" />
        </div>
      )}
      <StationPanel />
      <ArenaHud />
    </div>
  );
}
