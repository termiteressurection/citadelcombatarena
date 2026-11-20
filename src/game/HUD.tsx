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

  return (
    <>
      <div
        className="ps1-box clickable"
        style={{
          position: 'absolute', top: 44, left: 20, padding: '10px 14px',
          display: 'grid', gap: 6, width: 310,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, letterSpacing: '.14em' }}>
          <span style={{ color: g.timeOfDay === 'morning' ? '#ffe57f' : '#ff9d5c' }}>
            DAY {g.day} · {g.timeOfDay === 'morning' ? 'MORNING' : 'DUSK'}
          </span>
          <span style={{ color: rank.color }}>{rank.name} ({g.fame}F)</span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 12, color: '#e9e6ff', letterSpacing: '.12em' }}>LVL {g.level}</span>
          <div className="ps1-bar-track" style={{ flex: 1, height: 10 }}>
            <div className="ps1-bar-fill" style={{ width: `${xpPct}%`, backgroundColor: '#3ff0ff' }} />
          </div>
          <span style={{ fontSize: 10, color: '#a99dc4' }}>{g.xp}/{needXp}</span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, letterSpacing: '.1em' }}>
          <span style={{ color: '#ffc95c', fontWeight: 700 }}>{g.denarii} DENARII</span>
          <span style={{ color: g.flasks > 0 ? '#4dffa0' : '#a99dc4' }}>
            [H] FLASKS {g.flasks}/{MAX_FLASKS}
          </span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginTop: 2 }}>
          <span style={{ fontSize: 10, color: gear.color, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {gear.name}
          </span>
          <button
            className="clickable btn"
            style={{
              padding: '4px 9px', fontSize: 10, letterSpacing: '.1em',
              borderColor: g.statPoints > 0 ? '#4dffa0' : '#c99b43',
              color: g.statPoints > 0 ? '#4dffa0' : '#ffc95c',
            }}
            onClick={() => g.openPanel(g.panel === 'locker' ? null : 'locker')}
          >
            {g.statPoints > 0 ? `[C] +${g.statPoints} PTS!` : '[C] GEAR & STATS'}
          </button>
        </div>

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
                  {b === 'honey_bread' ? '+25 HP' : b === 'iron_wine' ? '+25% STAM' : '+15% DMG'}
                </span>
              );
            })}
          </div>
        )}
      </div>

      {!g.panel && (
        <div
          className="ps1-box"
          style={{
            position: 'absolute', top: 52, right: 18, padding: '8px 12px',
            display: 'grid', gap: 5, width: 250,
          }}
        >
          <div style={{ fontSize: 10, color: '#ffc95c', letterSpacing: '.18em', borderBottom: '1px solid #c99b4344', paddingBottom: 4 }}>
            ACTIVE CONTRACTS ({g.activeQuests.length}/3)
          </div>
          {g.activeQuests.length === 0 ? (
            <div style={{ fontSize: 10, color: '#a99dc4', letterSpacing: '.06em' }}>
              Visit Contract Board (North-West Forum) for bounties.
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
                    {done ? 'READY AT BOARD!' : `${q.progress}/${q.target}`}
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
    { slot: 'weapon', label: 'MAIN WEAPON (DRIVES MOVESET)', items: WEAPONS },
    { slot: 'offhand', label: weaponDef.twoHanded ? 'OFF-HAND (STORED WHILE WIELDING 2H)' : 'OFF-HAND / SHIELD / NET', items: OFFHANDS },
    { slot: 'helm', label: 'HELM', items: HELMS },
    { slot: 'body', label: 'BODY ARMOR', items: BODIES },
    { slot: 'cape', label: 'CLOAK / CAPE', items: CAPES },
  ];

  return (
    <div className="ps1-box ps1-armory-drawer clickable">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #c99b4355', paddingBottom: 8 }}>
        <h2 className="ps1-heading" style={{ color: '#ffc95c', fontSize: 19, letterSpacing: '.22em' }}>GEAR LOCKER</h2>
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
          EQUIPMENT
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
          ATTRIBUTES {g.statPoints > 0 ? `(+${g.statPoints})` : ''}
        </button>
      </div>

      {tab === 'gear' ? (
        <div style={{ display: 'grid', gap: 10 }}>
          <div style={{ padding: '8px 10px', background: '#07050e', border: '1px solid #4d3f66', display: 'grid', gap: 3, fontSize: 10 }}>
            <div style={{ color: gear.color, fontSize: 12, fontWeight: 700 }}>{gear.name}</div>
            <div style={{ color: '#ffc95c' }}>Light: {gear.moves.light.name} · Heavy: {gear.moves.heavy.name}</div>
            <div style={{ color: '#cfc6e8' }}>
              Armor HP: H{gear.armor.helm} / B{gear.armor.pauldron} / S{gear.armor.shield} · Speed {Math.round(gear.speedMul * 100)}% · Fame ×{gear.fameMul.toFixed(2)}
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
            <div style={{ fontSize: 10, color: '#ffc95c', letterSpacing: '.14em' }}>CREST COLOR</div>
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
            <span>UNSPENT POINTS: {g.statPoints}</span>
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
  const title = kind === 'smith' ? 'BLACKSMITH' : 'ARMORER';
  const sections: { slot: GearSlot; label: string; items: { id: string; name: string; desc: string; cost: number; reqFame: number; color?: string; twoHanded?: boolean; netHeavy?: boolean; hasShield?: boolean }[] }[] =
    kind === 'smith'
      ? [
          { slot: 'weapon', label: 'WEAPONS (SETS YOUR MOVESET)', items: WEAPONS },
          { slot: 'offhand', label: 'SHIELDS & ENERGY NETS', items: OFFHANDS.filter((o) => o.id !== 'none') },
        ]
      : [
          { slot: 'helm', label: 'HELMS', items: HELMS.filter((h) => h.id !== 'none') },
          { slot: 'body', label: 'BODY ARMOR', items: BODIES },
          { slot: 'cape', label: 'CAPES & MANTLES', items: CAPES.filter((c) => c.id !== 'none') },
        ];

  return (
    <div className="ps1-box ps1-armory-drawer clickable">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #c99b4355', paddingBottom: 8 }}>
        <div>
          <h2 className="ps1-heading" style={{ color: kind === 'smith' ? '#ff8a3d' : '#3ff0ff', fontSize: 19, letterSpacing: '.22em' }}>{title}</h2>
          <div style={{ fontSize: 11, color: '#ffc95c', marginTop: 2 }}>{g.denarii} DENARII · {g.fame} FAME</div>
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
              const lockedFame = !owned && g.fame < it.reqFame;
              const cantAfford = !owned && !lockedFame && g.denarii < it.cost;
              const col = it.color ?? '#ffc95c';
              return (
                <button
                  key={it.id}
                  className="clickable btn"
                  disabled={lockedFame || cantAfford}
                  style={{
                    width: '100%', textAlign: 'left', padding: '7px 10px', display: 'grid', gap: 3, letterSpacing: '.05em',
                    borderColor: eq ? '#4dffa0' : owned ? '#3ff0ff' : col,
                    color: eq ? '#4dffa0' : lockedFame || cantAfford ? '#8c81a8' : '#e9e6ff',
                    opacity: lockedFame ? 0.52 : cantAfford ? 0.72 : 1,
                    background: eq ? '#162420' : '#0b0816',
                  }}
                  onClick={() => g.buyAndEquipItem(slot, it.id)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                    <span style={{ color: eq ? '#4dffa0' : col }}>
                      {eq ? '▶ ' : ''}{it.name}{it.twoHanded ? ' [2H]' : it.netHeavy ? ' [NET]' : ''}
                    </span>
                    <span style={{ fontSize: 10 }}>
                      {eq ? 'EQUIPPED' : owned ? 'OWNED · EQUIP' : lockedFame ? `REQ ${it.reqFame} FAME` : `${it.cost}D · BUY`}
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
          <span>{g.denarii} DENARII</span>
          <span style={{ color: '#4dffa0' }}>FLASKS: {g.flasks}/{MAX_FLASKS}</span>
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
                  <span>{active ? 'ACTIVE TODAY' : full ? 'BELT FULL' : `${c.cost} DENARII`}</span>
                </div>
                <div style={{ fontSize: 10, color: '#cfc6e8' }}>{c.desc}</div>
              </button>
            );
          })}
        </div>
        <p style={{ fontSize: 11 }}>Daily food & oils last until you sleep in the Ludus Bunk.</p>
      </>
    ),

    board: (
      <div style={{ display: 'grid', gap: 12, width: '100%' }}>
        <div style={{ display: 'grid', gap: 6 }}>
          <div style={{ fontSize: 11, color: '#ffc95c', letterSpacing: '.16em' }}>
            ACTIVE CONTRACTS ({g.activeQuests.length}/3)
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
                    <div style={{ fontSize: 10, color: '#3ff0ff' }}>Reward: {q.denarii}D · {q.xp} XP · {q.fame} Fame</div>
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
            DAY {g.day} POSTED BOUNTIES
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
                  <div style={{ fontSize: 10, color: '#ffc95c' }}>Reward: {q.denarii}D · {q.xp} XP · {q.fame} Fame</div>
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
        <p style={{ color: g.timeOfDay === 'morning' ? '#ffe57f' : '#ff9d5c' }}>
          DAY {g.day} · {g.timeOfDay.toUpperCase()}
        </p>
        <p>Sleep in your Ludus cot to restore strength for Day {g.day + 1} Morning. Fresh Fight Cards and Contracts post at dawn; daily meals & blade oils expire.</p>
        <button
          className="clickable btn"
          style={{ borderColor: '#a78bfa', color: '#e9e6ff' }}
          onClick={() => { g.sleepNextDay(); g.openPanel(null); }}
        >
          SLEEP UNTIL DAY {g.day + 1} MORNING
        </button>
      </>
    ),

    yard: (
      <div style={{ display: 'grid', gap: 12, width: '100%' }}>
        <p>Heavy timber pel-posts and straw dummies stand under the afternoon sun.</p>
        <button
          className="clickable btn"
          disabled={g.trainedToday}
          style={{ opacity: g.trainedToday ? 0.5 : 1, borderColor: '#ff6b6b', color: '#ffc95c' }}
          onClick={() => g.drillTraining()}
        >
          {g.trainedToday ? 'DAILY DRILL COMPLETED — REST IN BUNK' : 'RUN DAILY COMBAT DRILL (+35 XP)'}
        </button>
        <div style={{ fontSize: 11, color: '#4dffa0', letterSpacing: '.14em' }}>
          QUICK STAT UPGRADES · UNSPENT POINTS: {g.statPoints}
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
          <span>RECORD: {g.wins}W - {g.losses}L</span>
          <span style={{ color: rank.color }}>{rank.name} ({g.fame} FAME)</span>
          <span>TITLES: {g.champions}</span>
        </div>
        {nextRank && (
          <p style={{ fontSize: 11 }}>Next Rank: {nextRank.name} at {nextRank.min} Fame</p>
        )}
        <div style={{ fontSize: 11, color: '#ffc95c', letterSpacing: '.14em' }}>CREST HONOR COLORS</div>
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
                {eq ? '▶ ' : ''}{l.name}{!unlocked ? ` · ${l.cost}D` : ''}
              </button>
            );
          })}
        </div>
        <div style={{ fontSize: 11, color: '#a99dc4', letterSpacing: '.12em', marginTop: 4 }}>CAREER LEDGER</div>
        {g.fallen.length === 0 ? (
          <p>No defeats recorded. Your marble plaque remains unblemished.</p>
        ) : (
          [...g.fallen].reverse().slice(0, 5).map((f, i) => (
            <p key={i} style={{ fontSize: 11 }}>{f.name} — Tier {f.bouts}, {f.cause} ({f.date})</p>
          ))
        )}
      </div>
    ),

    gate: (
      <div style={{ display: 'grid', gap: 10, width: '100%' }}>
        <div style={{ fontSize: 11, color: gear.color }}>
          EQUIPPED: {gear.name} · HEAVY: {gear.moves.heavy.name} · FLASKS: {g.flasks}/{MAX_FLASKS}
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
                    {locked ? `Requires ${card.reqFame} Fame (You: ${g.fame})` : `Payout: ${card.denarii}D · ${card.xp} XP · ${card.fame} Fame`}
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
                  ENTER THE SAND
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
            [H] FLASK ×{flasks}
          </div>
          {dailyBuffs.map((b) => (
            <div
              key={b}
              style={{
                fontSize: 10, padding: '3px 7px', border: '1px solid #ffc95c88',
                color: '#ffc95c', background: '#0d0919cc',
              }}
            >
              {b === 'honey_bread' ? '+25 HP' : b === 'iron_wine' ? '+25% STAM' : '+15% DMG'}
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
            <p style={{ marginTop: 6, color: '#e9e6ff' }}>ENTER THE SAND</p>
          </div>
        </div>
      )}
      {a.phase === 'draft' && <Draft />}
      {ended && (
        <div className="panel clickable">
          <div className="ps1-box" style={{ display: 'grid', gap: 12, justifyItems: 'center', minWidth: 380 }}>
            <h1 style={a.phase === 'defeat' ? { color: '#ff4f6d', textShadow: '2px 2px 0 #05030a, 0 0 20px #ff4f6d88' } : undefined}>
              {a.phase === 'champion' ? 'CHAMPION OF THE COLOSSEUM' : a.phase === 'victory' ? 'VICTORY IN THE SAND' : 'DEFEATED IN THE SAND'}
            </h1>
            {lastResult ? (
              <div style={{ display: 'grid', gap: 6, width: '100%', fontSize: 12, color: '#e9e6ff' }}>
                <div style={{ color: lastResult.denariiDelta >= 0 ? '#ffc95c' : '#ff6b6b' }}>
                  {lastResult.denariiDelta >= 0 ? `+${lastResult.denariiDelta} DENARII EARNED` : `${lastResult.denariiDelta} DENARII (HEALER FEE)`}
                </div>
                <div style={{ color: '#3ff0ff' }}>+{lastResult.xpEarned} XP EARNED</div>
                {lastResult.levelsGained > 0 && (
                  <div style={{ color: '#4dffa0', fontWeight: 700, fontSize: 14, letterSpacing: '.12em' }}>
                    LEVEL UP! +{lastResult.levelsGained * 3} STAT POINTS EARNED [PRESS C IN TOWN]
                  </div>
                )}
                <div style={{ color: lastResult.fameDelta >= 0 ? '#a78bfa' : '#ff6b6b' }}>
                  FAME {lastResult.fameDelta >= 0 ? `+${lastResult.fameDelta}` : lastResult.fameDelta}
                </div>
                {readyQuests > 0 && (
                  <div style={{ color: '#4dffa0' }}>
                    {readyQuests} Contract{readyQuests > 1 ? 's' : ''} ready to turn in at the Contract Board!
                  </div>
                )}
                {!lastResult.victory && (
                  <p style={{ marginTop: 4 }}>Carried back to the Ludus Barracks. You keep all stats and gear.</p>
                )}
              </div>
            ) : (
              <p>{a.phase === 'champion' ? `+${a.earned} GLORY. Your name is sung in the stands.` : `Bout ${a.bout} of ${LADDER.length}.`}</p>
            )}
            <button className="clickable btn" onClick={leave}>RETURN TO TOWN</button>
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
        <KeyCap k="H" label="Flask" />
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
      <div className="title">BONEYARD · {scene === 'ludus' ? 'ROMAN FORUM' : 'COLOSSEUM'}</div>
      <TopRightControls />
      <TownStatusStrip />
      {station && !panel && <div className="hint" style={{ borderColor: station.color, color: station.color }}>[ENTER] {station.verb}</div>}
      {scene === 'ludus' && (
        <div className="controls">
          <KeyCap k="WASD" label="Move" />
          <KeyCap k="Q/E" label="Orbit" />
          <KeyCap k="R/F" label="Tilt" />
          <KeyCap k="ENTER" label="Use" />
          <KeyCap k="C" label="Gear & Stats" />
          <KeyCap k="P" label="CRT" />
        </div>
      )}
      <StationPanel />
      <ArenaHud />
    </div>
  );
}
