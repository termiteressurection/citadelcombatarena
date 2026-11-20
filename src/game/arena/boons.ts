import { defaultMods, type Mods } from './combat';

export interface Boon { id: string; name: string; desc: string; color: string; apply: (m: Mods) => void }

/** The Fate pool. Every boon stacks; caps below keep stacking from breaking the game. */
export const BOONS: Boon[] = [
  { id: 'ares', name: 'WRATH OF ARES', desc: '+15% damage', color: '#ff6b6b', apply: (m) => { m.dmg += 0.15; } },
  { id: 'lungs', name: 'IRON LUNGS', desc: '+25 max stamina', color: '#4dffa0', apply: (m) => { m.maxStamina += 25; } },
  { id: 'wind', name: 'SECOND WIND', desc: '+30% stamina regen', color: '#3ff0ff', apply: (m) => { m.stamRegen += 0.3; } },
  { id: 'hermes', name: 'FLEET OF FOOT', desc: '+10% move speed', color: '#5aa9ff', apply: (m) => { m.speed += 0.1; } },
  { id: 'heart', name: 'BULL HEART', desc: '+25 max health', color: '#ff4f6d', apply: (m) => { m.maxHp += 25; } },
  { id: 'blood', name: 'BLOOD RITE', desc: 'Heal 12 on every kill', color: '#ff7ab8', apply: (m) => { m.healOnKill += 12; } },
  { id: 'thorn', name: 'THORNED SHIELD', desc: 'Blocked hits cost attackers 8 health', color: '#b6f24a', apply: (m) => { m.thorns += 8; } },
  { id: 'eagle', name: 'EAGLE EYE', desc: 'Parry window +0.07s', color: '#ffc95c', apply: (m) => { m.parryWindow += 0.07; } },
  { id: 'crush', name: 'CRUSHING BLOW', desc: '+30% heavy attack damage', color: '#ff4fd8', apply: (m) => { m.heavyDmg += 0.3; } },
  { id: 'ghost', name: 'GHOST STEP', desc: 'Dodge costs 8 less stamina', color: '#a78bfa', apply: (m) => { m.dodgeCost += 8; } },
  { id: 'wall', name: 'STONE WALL', desc: 'Blocking drains 30% less stamina', color: '#e9e6ff', apply: (m) => { m.blockStam += 0.3; } },
  { id: 'crowd', name: 'CROWD FAVORITE', desc: '+50% glory this run', color: '#ffc95c', apply: (m) => { m.glory += 0.5; } },
];

const byId = new Map(BOONS.map((b) => [b.id, b]));
export const boonById = (id: string) => byId.get(id);

export function modsFor(ids: readonly string[]): Mods {
  const m = defaultMods();
  for (const id of ids) byId.get(id)?.apply(m);
  m.speed = Math.min(1.5, m.speed);
  m.parryWindow = Math.min(0.17, m.parryWindow);
  m.blockStam = Math.min(0.75, m.blockStam);
  m.stamRegen = Math.min(3, m.stamRegen);
  m.dmg = Math.min(3, m.dmg);
  m.heavyDmg = Math.min(3, m.heavyDmg);
  return m;
}

/** Three distinct boons. */
export function drawBoons(rng: () => number = Math.random): Boon[] {
  const pool = [...BOONS];
  const out: Boon[] = [];
  while (out.length < 3) out.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
  return out;
}
