import { useEffect, useMemo, useRef, useState, type JSX } from 'react';
import { STATIONS } from './world/layout';
import { CAPITALS, COLOSSEUMS, SETTLEMENTS } from './world/universe';
import {
  PROPERTIES, PROPERTY_BY_ID, discountedCost, ownerShopDiscount, propertyRenovateCost,
  propertyRentPayout, propertySellValue, reputationRankOf,
} from './world/properties';
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
  const rep = reputationRankOf(g.reputation);
  const ownedCount = Object.keys(g.ownedProperties).length;
  const needXp = xpForNextLevel(g.level);
  const xpPct = Math.min(100, (g.xp / needXp) * 100);
  const gear = resolveLoadout(g.loadout);
  const showStreetBars = g.weaponDrawn || g.streetVitals.hp < g.streetVitals.maxHp;

  return (
    <>
      {/* Nearest Capital Colosseum Sky-Beacon Compass Pill */}
      {!g.atlasOpen && !g.panel && !g.activePropertyId && !g.arrestPrompt && (
        <div
          className="ps1-box"
          style={{
            position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)',
            padding: '5px 14px', borderColor: g.nearestBeacon.color,
            display: 'flex', alignItems: 'center', gap: 9, fontSize: 11, letterSpacing: '.12em',
            whiteSpace: 'nowrap',
          }}
        >
          <span style={{ color: g.nearestBeacon.color, fontSize: 14 }}>◆</span>
          <span style={{ color: '#a99dc4' }}>NEAREST COLOSSEUM</span>
          <span style={{ color: g.nearestBeacon.color, fontWeight: 700 }}>{g.nearestBeacon.name}</span>
          <span style={{ color: '#ffc95c' }}>{g.nearestBeacon.dist}m {g.nearestBeacon.bearing}</span>
        </div>
      )}

      <div
        className="ps1-box clickable"
        style={{
          position: 'absolute', top: 44, left: 20, padding: '10px 14px',
          display: 'grid', gap: 6, width: 332,
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

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 10, letterSpacing: '.09em' }}>
          <span style={{ color: rep.color }}>REP: {rep.label}</span>
          <span style={{ color: ownedCount > 0 ? '#4dffa0' : '#a99dc4' }}>
            DEEDS OWNED: {ownedCount}
          </span>
        </div>

        {showStreetBars && (
          <div style={{ display: 'grid', gap: 4, paddingTop: 2 }}>
            <Bar v={g.streetVitals.hp} max={g.streetVitals.maxHp} color="#ff4f6d" w={298} />
            <Bar v={g.streetVitals.st} max={g.streetVitals.maxSt} color="#4dffa0" w={224} />
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5, marginTop: 2 }}>
          <button
            className="clickable btn"
            style={{
              width: '100%', padding: '4px 6px', fontSize: 10, letterSpacing: '.07em',
              borderColor: g.onCycle ? '#3ff0ff' : '#6e5a88',
              color: g.onCycle ? '#3ff0ff' : '#e9e6ff',
            }}
            onClick={() => g.toggleCycle()}
          >
            [V] {g.onCycle ? 'DISMOUNT CYCLE' : 'LIGHT-CYCLE'}
          </button>
          <button
            className="clickable btn"
            style={{
              width: '100%', padding: '4px 6px', fontSize: 10, letterSpacing: '.07em',
              borderColor: g.atlasOpen ? '#ffc95c' : '#c99b43',
              color: '#ffc95c',
            }}
            onClick={() => g.toggleAtlas()}
          >
            [M] WORLD ATLAS
          </button>
          <button
            className="clickable btn"
            style={{
              width: '100%', padding: '4px 6px', fontSize: 10, letterSpacing: '.07em',
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
              width: '100%', padding: '4px 6px', fontSize: 10, letterSpacing: '.07em',
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

      {!g.panel && !g.arrestPrompt && !g.atlasOpen && !g.activePropertyId && (
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
  const [showCallout, setShowCallout] = useState(false);

  useEffect(() => {
    if (!g.streetToast) { setShowToast(false); return; }
    setShowToast(true);
    const id = setTimeout(() => setShowToast(false), 5200);
    return () => clearTimeout(id);
  }, [g.streetToast?.id]);

  useEffect(() => {
    if (!g.streetCallout) { setShowCallout(false); return; }
    setShowCallout(true);
    const id = setTimeout(() => setShowCallout(false), 1100);
    return () => clearTimeout(id);
  }, [g.streetCallout?.id]);

  if (g.scene !== 'ludus') return null;

  return (
    <>
      {(g.streetLockName || g.weaponDrawn) && !g.onCycle && !g.panel && !g.atlasOpen && !g.activePropertyId && (
        <div
          className="ps1-box"
          style={{
            position: 'absolute', top: 52, left: '50%', transform: 'translateX(-50%)',
            padding: '4px 12px', fontSize: 11, letterSpacing: '.14em',
            borderColor: g.streetArmed ? '#3ff0ff' : '#ff4fd8',
            color: '#e9e6ff', whiteSpace: 'nowrap', display: 'flex', gap: 10,
          }}
        >
          <span style={{ color: '#ffc95c', fontWeight: 700 }}>
            STANCE: {g.streetStance === 'high' ? 'HIGH ▲' : g.streetStance === 'low' ? 'LOW ▼' : 'MID ●'}
          </span>
          <span style={{ color: g.streetArmed ? '#4dffa0' : '#ff4fd8' }}>
            {g.streetArmed ? 'ARMED [F THROW]' : 'BARE-HANDED [F GRAB]'}
          </span>
          {g.streetLockName && <span style={{ color: '#3ff0ff' }}>· {g.streetLockName}</span>}
        </div>
      )}

      {showCallout && g.streetCallout && (
        <div
          style={{
            position: 'absolute', top: 132, left: '50%', transform: 'translateX(-50%)',
            fontSize: 22, fontWeight: 700, letterSpacing: '.24em',
            color: g.streetCallout.color,
            textShadow: `2px 2px 0 #05030a, 0 0 18px ${g.streetCallout.color}`,
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
          }}
        >
          {g.streetCallout.text}
        </div>
      )}

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

      {g.streetExecuteReady && !g.onCycle && !g.panel && !g.arrestPrompt && !g.inJail && !g.atlasOpen && !g.activePropertyId && (
        <div
          className="ps1-box limb-crit"
          style={{
            position: 'absolute', bottom: 108, left: '50%', transform: 'translateX(-50%)',
            padding: '7px 18px', borderColor: '#ffc95c',
            background: '#22060ee6', color: '#ffc95c',
            fontSize: 14, fontWeight: 700, letterSpacing: '.2em',
            textShadow: '0 0 10px #ff3b5c',
          }}
        >
          [E] EXECUTE FINISHER!
        </div>
      )}

      {g.onCycle && !g.panel && !g.arrestPrompt && !g.inJail && !g.atlasOpen && !g.activePropertyId && (
        <div
          className="ps1-box"
          style={{
            position: 'absolute', bottom: 54, left: '50%', transform: 'translateX(-50%)',
            padding: '6px 16px', borderColor: '#3ff0ff88',
            color: '#3ff0ff', fontSize: 11, letterSpacing: '.14em', whiteSpace: 'nowrap',
          }}
        >
          [SPACE] HOLD TO POWER-DRIFT · RELEASE FOR TURBO BOOST · [LMB] FLYING DISMOUNT CLEAVE
        </div>
      )}

      {g.nearNpc && !g.panel && !g.arrestPrompt && !g.inJail && !g.atlasOpen && !g.activePropertyId && !g.onCycle && (
        <div
          className="ps1-box"
          style={{
            position: 'absolute', bottom: g.near || g.nearPropertyId || g.nearColosseumId ? 104 : 56, left: '50%', transform: 'translateX(-50%)',
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
  const disc = ownerShopDiscount(g.ownedProperties);
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
          <div style={{ fontSize: 11, color: '#ffc95c', marginTop: 2 }}>
            {g.denarii} CYCLES · {g.fame} SIGNAL
            {disc > 0 && <span style={{ color: '#4dffa0', marginLeft: 8 }}>(-{Math.round(disc * 100)}% OWNER DEAL)</span>}
          </div>
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
              const price = discountedCost(it.cost, g.ownedProperties);
              const lockedSignal = !owned && g.fame < it.reqFame;
              const cantAfford = !owned && !lockedSignal && g.denarii < price;
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
                      {eq ? 'EQUIPPED' : owned ? 'OWNED · EQUIP' : lockedSignal ? `REQ ${it.reqFame} SIG` : `${price}C · BUY`}
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
  const activeCol = COLOSSEUMS.find((c) => c.id === g.activeColosseumId) ?? COLOSSEUMS[0];
  const isGate = g.panel === 'gate';
  const headingLabel = isGate ? activeCol.name : s.label;
  const headingColor = isGate ? activeCol.color : s.color;
  const disc = ownerShopDiscount(g.ownedProperties);

  const gear = resolveLoadout(g.loadout);
  const dailyQuests = generateDailyQuests(g.day);
  const fightCards = generateFightCards(g.day, g.fame, activeCol.id);
  const rank = fameRankOf(g.fame);
  const nextRank = nextFameRankOf(g.fame);

  const body: Record<string, JSX.Element> = {
    apothecary: (
      <>
        <div style={{ display: 'flex', gap: 18, fontSize: 12, color: '#ffc95c', flexWrap: 'wrap', justifyContent: 'center' }}>
          <span>{g.denarii} CYCLES</span>
          <span style={{ color: '#4dffa0' }}>RESTORES: {g.flasks}/{MAX_FLASKS}</span>
          {disc > 0 && <span style={{ color: '#3ff0ff' }}>OWNER -{Math.round(disc * 100)}%</span>}
        </div>
        <div style={{ display: 'grid', gap: 8, width: '100%' }}>
          {CONSUMABLES.map((c) => {
            const isFlask = c.kind === 'flask';
            const full = isFlask && g.flasks >= MAX_FLASKS;
            const active = !isFlask && g.dailyBuffs.includes(c.id as typeof g.dailyBuffs[number]);
            const price = discountedCost(c.cost, g.ownedProperties);
            const disabled = full || active || g.denarii < price;
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
                  <span>{active ? 'ACTIVE CYCLE' : full ? 'SLOT FULL' : `${price} CYCLES`}</span>
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
        <h1 style={{ color: headingColor, fontSize: 26, textShadow: `2px 2px 0 #05030a, 0 0 18px ${headingColor}77` }}>{headingLabel}</h1>
        {body[g.panel]}
        <p style={{ opacity: 0.55, fontSize: 11 }}>[ESC] to close</p>
      </div>
    </div>
  );
}

/** Fable-inspired Real Estate Deed Panel: buy homes/shops, live or rent out, set Low/Fair/High rent, renovate & heal. */
function PropertyPanel() {
  const g = useGame();
  if (!g.activePropertyId) return null;
  const def = PROPERTY_BY_ID.get(g.activePropertyId);
  if (!def) return null;
  const owned = g.ownedProperties[def.id];
  const rep = reputationRankOf(g.reputation);

  const tierNames: Record<1 | 2 | 3, string> = {
    1: 'TIER 1 · FLICKERING DRAFT',
    2: 'TIER 2 · SOLID NEON',
    3: 'TIER 3 · KERNEL GOLD',
  };

  const lowPay = propertyRentPayout(def, { id: def.id, mode: 'rent', rentRate: 'low', tier: owned?.tier ?? 1 });
  const fairPay = propertyRentPayout(def, { id: def.id, mode: 'rent', rentRate: 'fair', tier: owned?.tier ?? 1 });
  const highPay = propertyRentPayout(def, { id: def.id, mode: 'rent', rentRate: 'high', tier: owned?.tier ?? 1 });
  const renCost = owned && owned.tier < 3 ? propertyRenovateCost(def, owned.tier) : 0;
  const sellVal = owned ? propertySellValue(def, owned) : 0;

  return (
    <div className="panel clickable">
      <div className="ps1-box" style={{ display: 'grid', gap: 12, width: 'min(560px, 92vw)', borderColor: owned ? '#4dffa0' : '#ffc95c', textAlign: 'left' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #c99b4355', paddingBottom: 8 }}>
          <div>
            <div style={{ fontSize: 10, color: def.accent, letterSpacing: '.16em' }}>
              {def.settlementName} · {def.kind.toUpperCase()} DEED
            </div>
            <h1 style={{ fontSize: 22, letterSpacing: '.16em', color: owned ? '#4dffa0' : '#ffc95c' }}>{def.name}</h1>
          </div>
          <button className="clickable btn" style={{ padding: '4px 10px', fontSize: 11 }} onClick={() => g.openPropertyPanel(null)}>CLOSE</button>
        </div>

        <p style={{ fontSize: 12, color: '#e9e6ff' }}>{def.desc}</p>

        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#ffc95c', background: '#07050e', padding: '7px 10px', border: '1px solid #4d3f66' }}>
          <span>YOUR CYCLES: {g.denarii}</span>
          <span style={{ color: rep.color }}>REPUTATION: {rep.label} ({g.reputation})</span>
        </div>

        {!owned ? (
          <div style={{ display: 'grid', gap: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#cfc6e8' }}>
              <span>DEED PRICE: <strong style={{ color: '#ffc95c' }}>{def.price} CYCLES</strong></span>
              <span>BASE RENT: <strong style={{ color: '#4dffa0' }}>+{def.baseRent}C / CYCLE</strong></span>
            </div>
            <button
              className="clickable btn"
              disabled={g.denarii < def.price}
              style={{
                width: '100%', padding: '12px', fontSize: 13,
                borderColor: '#ffc95c', color: '#ffc95c',
                opacity: g.denarii < def.price ? 0.45 : 1,
              }}
              onClick={() => g.buyProperty(def.id)}
            >
              {g.denarii < def.price ? `NEED ${def.price - g.denarii} MORE CYCLES` : `BUY DEED (${def.price} CYCLES)`}
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            <div style={{ fontSize: 11, color: '#3ff0ff', letterSpacing: '.12em' }}>
              {tierNames[owned.tier]}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <button
                className="clickable btn"
                style={{
                  width: '100%', padding: '8px', fontSize: 11,
                  borderColor: owned.mode === 'live' ? '#3ff0ff' : '#4d3f66',
                  color: owned.mode === 'live' ? '#3ff0ff' : '#cfc6e8',
                  background: owned.mode === 'live' ? '#102436' : '#0b0816',
                }}
                onClick={() => g.setPropertyMode(def.id, 'live')}
              >
                LIVE HERE (FREE HEAL)
              </button>
              <button
                className="clickable btn"
                style={{
                  width: '100%', padding: '8px', fontSize: 11,
                  borderColor: owned.mode === 'rent' ? '#4dffa0' : '#4d3f66',
                  color: owned.mode === 'rent' ? '#4dffa0' : '#cfc6e8',
                  background: owned.mode === 'rent' ? '#12281e' : '#0b0816',
                }}
                onClick={() => g.setPropertyMode(def.id, 'rent')}
              >
                RENT OUT (+{propertyRentPayout(def, owned)}C)
              </button>
            </div>

            {owned.mode === 'rent' ? (
              <div style={{ display: 'grid', gap: 5 }}>
                <div style={{ fontSize: 10, color: '#ffc95c', letterSpacing: '.14em' }}>LANDLORD RENT DIAL</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
                  <button
                    className="clickable btn"
                    style={{
                      width: '100%', padding: '7px 4px', fontSize: 10,
                      borderColor: owned.rentRate === 'low' ? '#3ff0ff' : '#4d3f66',
                      color: owned.rentRate === 'low' ? '#3ff0ff' : '#cfc6e8',
                    }}
                    onClick={() => g.setPropertyRentRate(def.id, 'low')}
                  >
                    LOW · +{lowPay}C (+REP)
                  </button>
                  <button
                    className="clickable btn"
                    style={{
                      width: '100%', padding: '7px 4px', fontSize: 10,
                      borderColor: owned.rentRate === 'fair' ? '#4dffa0' : '#4d3f66',
                      color: owned.rentRate === 'fair' ? '#4dffa0' : '#cfc6e8',
                    }}
                    onClick={() => g.setPropertyRentRate(def.id, 'fair')}
                  >
                    FAIR · +{fairPay}C
                  </button>
                  <button
                    className="clickable btn"
                    style={{
                      width: '100%', padding: '7px 4px', fontSize: 10,
                      borderColor: owned.rentRate === 'high' ? '#ff4f6d' : '#4d3f66',
                      color: owned.rentRate === 'high' ? '#ff4f6d' : '#cfc6e8',
                    }}
                    onClick={() => g.setPropertyRentRate(def.id, 'high')}
                  >
                    HIGH · +{highPay}C (-REP)
                  </button>
                </div>
              </div>
            ) : (
              <button
                className="clickable btn"
                style={{ width: '100%', padding: '9px', fontSize: 11, borderColor: '#3ff0ff', color: '#3ff0ff' }}
                onClick={() => { g.healAtProperty(); g.openPropertyPanel(null); }}
              >
                REST & RESTORE FULL INTEGRITY (FREE)
              </button>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: owned.tier < 3 ? '1fr 1fr' : '1fr', gap: 8 }}>
              {owned.tier < 3 && (
                <button
                  className="clickable btn"
                  disabled={g.denarii < renCost}
                  style={{
                    width: '100%', padding: '8px', fontSize: 11,
                    borderColor: '#ffc95c', color: '#ffc95c',
                    opacity: g.denarii < renCost ? 0.45 : 1,
                  }}
                  onClick={() => g.renovateProperty(def.id)}
                >
                  RENOVATE T{owned.tier + 1} ({renCost}C)
                </button>
              )}
              <button
                className="clickable btn"
                style={{ width: '100%', padding: '8px', fontSize: 11, borderColor: '#ff6b6b', color: '#ff6b6b' }}
                onClick={() => g.sellProperty(def.id)}
              >
                SELL DEED (+{sellVal}C)
              </button>
            </div>
          </div>
        )}
        <p style={{ fontSize: 10, opacity: 0.55, textAlign: 'center' }}>[ESC] to close</p>
      </div>
    </div>
  );
}

/** PS1 Daggerfall-scale World Atlas & Instant Fast-Travel Map [M]. */
function WorldAtlasPanel() {
  const g = useGame();
  const [selectedId, setSelectedId] = useState<string>('cache_city');
  if (!g.atlasOpen) return null;

  const selected = SETTLEMENTS.find((s) => s.id === selectedId) ?? CAPITALS[0];
  const discovered = g.discoveredSettlements.includes(selected.id);
  const localProps = PROPERTIES.filter((p) => p.settlementId === selected.id);
  const ownedProps = Object.keys(g.ownedProperties)
    .map((id) => PROPERTY_BY_ID.get(id))
    .filter((x): x is NonNullable<typeof x> => Boolean(x));
  const distToSelected = Math.round(Math.hypot(selected.x - g.worldPos.x, selected.z - g.worldPos.z));

  const mapCoord = (v: number) => ((v + 2000) / 4000) * 320 + 20;

  return (
    <div className="panel clickable">
      <div className="ps1-box" style={{ display: 'grid', gap: 12, width: 'min(780px, 95vw)', maxHeight: '88vh', overflowY: 'auto', textAlign: 'left' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #c99b4355', paddingBottom: 8 }}>
          <div>
            <h1 style={{ fontSize: 22, letterSpacing: '.24em', color: '#3ff0ff' }}>THE UNALLOCATED EXPANSE · ATLAS</h1>
            <div style={{ fontSize: 10, color: '#ffc95c', letterSpacing: '.12em' }}>
              DISCOVERED SECTORS: {g.discoveredSettlements.length}/{SETTLEMENTS.length} · ACTIVE BEACON: {g.nearestBeacon.name}
            </div>
          </div>
          <button className="clickable btn" style={{ padding: '4px 10px', fontSize: 11 }} onClick={() => g.setAtlasOpen(false)}>CLOSE</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 14, alignItems: 'start' }}>
          {/* Tactical PS1 Vector Map */}
          <svg
            viewBox="0 0 360 360"
            style={{ width: '100%', maxWidth: 360, background: '#05040d', border: '2px solid #c99b4388', justifySelf: 'center' }}
          >
            {[-1500, -1000, -500, 0, 500, 1000, 1500].map((v) => {
              const c = mapCoord(v);
              return (
                <g key={v} opacity={v === 0 ? 0.35 : 0.16}>
                  <line x1={c} y1={16} x2={c} y2={344} stroke="#3ff0ff" strokeWidth={1} />
                  <line x1={16} y1={c} x2={344} y2={c} stroke="#3ff0ff" strokeWidth={1} />
                </g>
              );
            })}
            <text x="180" y="13" fill="#ffd866" fontSize="9" textAnchor="middle" letterSpacing="2">NORTH · KERNEL SPIRE</text>

            {/* Satellite Settlements */}
            {SETTLEMENTS.filter((s) => s.kind !== 'capital').map((s) => {
              const cx = mapCoord(s.x);
              const cz = mapCoord(s.z);
              const known = g.discoveredSettlements.includes(s.id);
              const isSel = selected.id === s.id;
              return (
                <g key={s.id} style={{ cursor: 'pointer' }} onClick={() => setSelectedId(s.id)}>
                  <circle
                    cx={cx}
                    cy={cz}
                    r={isSel ? 6 : 4}
                    fill={known ? s.accent : '#352f4d'}
                    stroke={isSel ? '#ffffff' : '#05040d'}
                    strokeWidth={1.5}
                  />
                </g>
              );
            })}

            {/* 5 Capital Cities + Colosseum Beacon Ring */}
            {CAPITALS.map((c) => {
              const cx = mapCoord(c.x);
              const cz = mapCoord(c.z);
              const isBeacon = g.nearestBeacon.id === c.id;
              const isSel = selected.id === c.id;
              return (
                <g key={c.id} style={{ cursor: 'pointer' }} onClick={() => setSelectedId(c.id)}>
                  {isBeacon && <circle cx={cx} cy={cz} r={12} fill="none" stroke={c.colosseum?.color ?? c.accent} strokeWidth={1.6} strokeDasharray="3 2" />}
                  <polygon
                    points={`${cx},${cz - 7} ${cx + 6},${cz} ${cx},${cz + 7} ${cx - 6},${cz}`}
                    fill={c.accent}
                    stroke={isSel ? '#ffffff' : '#05040d'}
                    strokeWidth={1.5}
                  />
                  <text x={cx} y={cz + 16} fill={c.accent} fontSize="8" textAnchor="middle" fontWeight="bold">
                    {c.name.replace('THE ', '')}
                  </text>
                </g>
              );
            })}

            {/* Owned Property Gold Pins */}
            {ownedProps.map((p) => (
              <rect
                key={p.id}
                x={mapCoord(p.x) - 3}
                y={mapCoord(p.z) - 3}
                width={6}
                height={6}
                fill="#4dffa0"
                stroke="#05040d"
                strokeWidth={1}
              />
            ))}

            {/* Live Player Position Cursor */}
            <g>
              <circle cx={mapCoord(g.worldPos.x)} cy={mapCoord(g.worldPos.z)} r={5.5} fill="none" stroke="#ffffff" strokeWidth={1.6} />
              <circle cx={mapCoord(g.worldPos.x)} cy={mapCoord(g.worldPos.z)} r={2.5} fill="#3ff0ff" />
            </g>
          </svg>

          {/* Inspector & Fast Travel Sidebar */}
          <div style={{ display: 'grid', gap: 10 }}>
            <div style={{ padding: '10px 12px', background: '#07050e', border: `1px solid ${discovered ? selected.accent : '#4d3f66'}`, display: 'grid', gap: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10 }}>
                <span style={{ color: selected.safety === 'frontier' ? '#ff4f6d' : '#4dffa0', letterSpacing: '.12em' }}>
                  {selected.safety === 'frontier' ? 'LAWLESS FRONTIER' : 'SANCTUARY HUB'}
                </span>
                <span style={{ color: '#ffc95c' }}>{distToSelected}m AWAY</span>
              </div>
              <div style={{ fontSize: 17, color: discovered ? selected.accent : '#8c81a8', fontWeight: 700, letterSpacing: '.14em' }}>
                {discovered ? selected.name : 'UNCHARTED SIGNAL'}
              </div>
              <div style={{ fontSize: 11, color: '#a99dc4' }}>{discovered ? selected.code : 'Ride within 120m to map this sector'}</div>
              <p style={{ fontSize: 11, color: '#e9e6ff' }}>{discovered ? selected.description : 'Point your Light-Cycle across the curved horizon to discover this settlement.'}</p>

              {selected.colosseum && (
                <div style={{ fontSize: 11, color: selected.colosseum.color, borderTop: '1px solid #4d3f66', paddingTop: 6 }}>
                  COLOSSEUM: {selected.colosseum.name}
                </div>
              )}

              <div style={{ fontSize: 10, color: '#ffc95c' }}>
                PROPERTIES HERE: {localProps.length} ({localProps.filter((p) => Boolean(g.ownedProperties[p.id])).length} OWNED)
              </div>

              <button
                className="clickable btn"
                disabled={!discovered}
                style={{
                  width: '100%', padding: '10px', fontSize: 12, marginTop: 4,
                  borderColor: discovered ? '#3ff0ff' : '#4d3f66',
                  color: discovered ? '#3ff0ff' : '#8c81a8',
                  opacity: discovered ? 1 : 0.45,
                }}
                onClick={() => g.fastTravelTo(selected.spawnX, selected.spawnZ, selected.name)}
              >
                {discovered ? `FAST TRAVEL → ${selected.name}` : 'DISCOVER TO FAST TRAVEL'}
              </button>
            </div>

            <div style={{ padding: '9px 12px', background: '#07050e', border: '1px solid #4d3f66', display: 'grid', gap: 6 }}>
              <div style={{ fontSize: 10, color: '#4dffa0', letterSpacing: '.14em' }}>
                MY PROPERTIES ({ownedProps.length})
              </div>
              {ownedProps.length === 0 ? (
                <div style={{ fontSize: 10, color: '#a99dc4' }}>
                  No deeds owned yet. Look for golden FOR SALE signs around town!
                </div>
              ) : (
                <div style={{ display: 'grid', gap: 4, maxHeight: 145, overflowY: 'auto' }}>
                  {ownedProps.map((p) => {
                    const st = g.ownedProperties[p.id];
                    return (
                      <button
                        key={p.id}
                        className="clickable btn"
                        style={{
                          width: '100%', padding: '6px 8px', fontSize: 10, textAlign: 'left',
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          borderColor: st.mode === 'live' ? '#3ff0ff' : '#4dffa0',
                          color: '#e9e6ff',
                        }}
                        onClick={() => g.fastTravelTo(p.signX, p.signZ + 2, p.name)}
                      >
                        <span>{p.name} ({p.settlementName})</span>
                        <span style={{ color: st.mode === 'live' ? '#3ff0ff' : '#4dffa0' }}>
                          {st.mode === 'live' ? 'HOME · WARP' : `+${propertyRentPayout(p, st)}C · WARP`}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
        <p style={{ fontSize: 10, opacity: 0.55, textAlign: 'center' }}>[M] or [ESC] to close</p>
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
  const { scene, setScene, loadout, flasks, dailyBuffs, selectedCard, lastResult, activeQuests, activeColosseumId } = useGame();
  const a = useArena();
  if (scene !== 'arena') return null;
  const activeCol = COLOSSEUMS.find((c) => c.id === activeColosseumId) ?? COLOSSEUMS[0];
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
      {a.phase === 'fight' && (
        <div
          className="ps1-box"
          style={{
            position: 'absolute', top: 108, left: '50%', transform: 'translateX(-50%)',
            padding: '4px 14px', fontSize: 11, letterSpacing: '.14em',
            borderColor: a.armed ? '#3ff0ff88' : '#ff4fd8',
            color: '#e9e6ff', whiteSpace: 'nowrap', display: 'flex', gap: 12,
          }}
        >
          <span style={{ color: '#ffc95c', fontWeight: 700 }}>
            STANCE: {a.stance === 'high' ? 'HIGH ▲' : a.stance === 'low' ? 'LOW ▼' : 'MID ●'}
          </span>
          <span style={{ color: a.armed ? '#4dffa0' : '#ff4fd8' }}>
            {a.armed ? 'ARMED · [F] THROW' : 'BARE-HANDED · [F] GRAB'}
          </span>
        </div>
      )}
      {a.phase === 'fight' && a.executeReady && (
        <div
          className="ps1-box limb-crit"
          style={{
            position: 'absolute', bottom: 84, left: '50%', transform: 'translateX(-50%)',
            padding: '7px 18px', borderColor: '#ffc95c',
            background: '#22060ee6', color: '#ffc95c',
            fontSize: 14, fontWeight: 700, letterSpacing: '.2em',
            textShadow: '0 0 10px #ff3b5c',
          }}
        >
          [E] EXECUTE FINISHER!
        </div>
      )}
      {a.phase === 'intro' && (
        <div className="panel" style={{ background: 'transparent' }}>
          <div className="ps1-box" style={{ padding: '16px 36px', borderColor: activeCol.color }}>
            <h1 style={{ color: activeCol.color }}>{selectedCard ? selectedCard.title : `BOUT ${a.bout}`}</h1>
            <p style={{ marginTop: 6, color: '#e9e6ff' }}>ENTER {activeCol.name}</p>
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
        <KeyCap k="A/D" label="Lane (×2 Dash)" />
        <KeyCap k="W/S" label="Stance + 3D Pivot" />
        <KeyCap k="SPACE" label="Jump/DiveKick" />
        <KeyCap k="LMB/J" label="Thrust" />
        <KeyCap k="RMB/K" label="Launch/Sweep" />
        <KeyCap k="F" label="Throw/Grab" />
        <KeyCap k="E" label="Execute" />
        <KeyCap k="SHIFT" label="Guard/Sidestep" />
        <KeyCap k="H" label="Restore" />
        <KeyCap k="TAB" label="2.5D/Free" />
        <KeyCap k="P" label="CRT" />
      </div>
    </>
  );
}

export function HUD() {
  const near = useGame((s) => s.near);
  const nearPropertyId = useGame((s) => s.nearPropertyId);
  const nearColosseumId = useGame((s) => s.nearColosseumId);
  const panel = useGame((s) => s.panel);
  const atlasOpen = useGame((s) => s.atlasOpen);
  const activePropertyId = useGame((s) => s.activePropertyId);
  const scene = useGame((s) => s.scene);
  const currentRegionName = useGame((s) => s.currentRegionName);
  const arrestPrompt = useGame((s) => s.arrestPrompt);
  const inJail = useGame((s) => s.inJail);
  const station = STATIONS.find((s) => s.id === near);
  const nearCol = nearColosseumId ? COLOSSEUMS.find((c) => c.id === nearColosseumId) : null;
  const nearProp = nearPropertyId ? PROPERTY_BY_ID.get(nearPropertyId) : null;
  const modalOpen = Boolean(panel || atlasOpen || activePropertyId || arrestPrompt || inJail);

  const hint = nearCol
    ? { color: nearCol.color, text: `[ENTER] ENTER ${nearCol.name}` }
    : nearProp
      ? { color: '#ffc95c', text: `[ENTER] INSPECT DEED · ${nearProp.name}` }
      : station
        ? { color: station.color, text: `[ENTER] ${station.verb}` }
        : null;

  const activeColosseumId = useGame((s) => s.activeColosseumId);
  const activeCol = COLOSSEUMS.find((c) => c.id === activeColosseumId) ?? COLOSSEUMS[0];
  return (
    <div className="hud">
      <div className="title">BONEYARD · {scene === 'ludus' ? currentRegionName : activeCol.name}</div>
      <TopRightControls />
      <TownStatusStrip />
      <StreetOverlays />
      {hint && !modalOpen && (
        <div className="hint" style={{ borderColor: hint.color, color: hint.color }}>{hint.text}</div>
      )}
      {scene === 'ludus' && (
        <div className="controls">
          <KeyCap k="WASD" label="Move" />
          <KeyCap k="V" label="Cycle" />
          <KeyCap k="F" label="Grapple" />
          <KeyCap k="SPACE" label="ChainDash/Drift" />
          <KeyCap k="TAB" label="Lock" />
          <KeyCap k="E" label="Execute" />
          <KeyCap k="M" label="Atlas" />
          <KeyCap k="T" label="Greet" />
          <KeyCap k="G" label="Provoke" />
          <KeyCap k="X" label="Blade" />
          <KeyCap k="C" label="Gear/Specs" />
          <KeyCap k="ENTER" label="Interact" />
          <KeyCap k="P" label="CRT" />
        </div>
      )}
      <StationPanel />
      <PropertyPanel />
      <WorldAtlasPanel />
      <ArenaHud />
    </div>
  );
}
