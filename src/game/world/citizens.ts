import { defaultMods, makeFighter, type Fighter, type Kind } from '../arena/combat';
import { type StyleId } from '../arena/styles';
import { gearFromStyle, type ResolvedGear } from '../rpg/items';
import { isFree } from './colliders';
import { BOUNDS, SOLIDS } from './layout';
import { collidersNear, isSanctuaryPosition, WORLD_BOUNDS, type Settlement } from './universe';

export type NpcRole = 'citizen' | 'hustler' | 'gladiator' | 'corrupted' | 'enforcer';
export type NpcTemperament = 'timid' | 'proud' | 'volatile' | 'helpful' | 'opportunist';
export type NpcMood = 'calm' | 'suspicious' | 'panicked' | 'hostile' | 'grateful' | 'fleeing' | 'dead';

export interface CityNpc {
  id: number;
  filename: string;
  role: NpcRole;
  temperament: NpcTemperament;
  mood: NpcMood;
  civilian: boolean;
  style: StyleId;
  color: string;
  gear: ResolvedGear;
  x: number;
  z: number;
  yaw: number;
  targetX: number;
  targetZ: number;
  wait: number;
  bark: string;
  barkT: number;
  greeted: boolean;
  antagonized: number;
  bountyReward: number;
  respawnT: number;
  fighter: Fighter;
}

export interface GreetOutcome {
  bark: string;
  cyclesDelta: number;
  signalDelta: number;
  xpDelta: number;
  healPct: number;
  turnHostile: boolean;
  alertEnforcer: boolean;
}

export interface AntagonizeOutcome {
  bark: string;
  cyclesDelta: number;
  turnHostile: boolean;
  addBounty: number;
}

export interface StreetEventResult {
  title: string;
  npcId: number;
  speaker: string;
  bark: string;
  color: string;
}

const CITIZEN_SPECS: { filename: string; temp: NpcTemperament; color: string; zone: 'plaza' | 'alley' }[] = [
  { filename: 'old_save_04.bin', temp: 'helpful', color: '#3ff0ff', zone: 'plaza' },
  { filename: 'draft_poem.txt', temp: 'timid', color: '#cfc6e8', zone: 'plaza' },
  { filename: 'knight_v2.bak', temp: 'proud', color: '#ffc95c', zone: 'plaza' },
  { filename: 'childhood_photo.png', temp: 'timid', color: '#ff9ad5', zone: 'plaza' },
  { filename: 'broken_ui.css', temp: 'helpful', color: '#4dffa0', zone: 'plaza' },
  { filename: 'unsent_mail.msg', temp: 'timid', color: '#78b4ff', zone: 'plaza' },
  { filename: 'cache_frag_12.tmp', temp: 'opportunist', color: '#ff8a3d', zone: 'alley' },
  { filename: 'audio_stem.wav', temp: 'helpful', color: '#b6f24a', zone: 'plaza' },
  { filename: 'nav_mesh_old.obj', temp: 'timid', color: '#a78bfa', zone: 'alley' },
  { filename: 'shader_test.glsl', temp: 'volatile', color: '#ff6b6b', zone: 'alley' },
];

const HUSTLER_SPECS: { filename: string; style: StyleId; color: string }[] = [
  { filename: 'leak_broker.dat', style: 'dimachaerus', color: '#ff4fd8' },
  { filename: 'crack_key.bin', style: 'retiarius', color: '#b6f24a' },
  { filename: 'dark_cache.zip', style: 'murmillo', color: '#a78bfa' },
  { filename: 'skimmer_08.py', style: 'dimachaerus', color: '#ff8a3d' },
];

const GLADIATOR_SPECS: { filename: string; style: StyleId; color: string; reward: number }[] = [
  { filename: 'ares_proc.exe', style: 'hoplomachus', color: '#ffc95c', reward: 30 },
  { filename: 'spark_v9.dll', style: 'murmillo', color: '#3ff0ff', reward: 28 },
  { filename: 'spear_unit.sys', style: 'hoplomachus', color: '#4dffa0', reward: 32 },
  { filename: 'sica_daemon.elf', style: 'dimachaerus', color: '#ff6b6b', reward: 35 },
  { filename: 'maul_zero.bin', style: 'executioner', color: '#ff4fd8', reward: 40 },
];

const CORRUPTED_SPECS: { filename: string; style: StyleId; reward: number }[] = [
  { filename: 'segfault_99.cor', style: 'dimachaerus', reward: 36 },
  { filename: 'null_ptr.err', style: 'executioner', reward: 42 },
  { filename: 'overflow_0xF.bad', style: 'retiarius', reward: 38 },
];

const ENFORCER_SPECS: { filename: string; style: StyleId }[] = [
  { filename: 'syswatch_01.sec', style: 'murmillo' },
  { filename: 'syswatch_02.sec', style: 'hoplomachus' },
  { filename: 'syswatch_03.sec', style: 'murmillo' },
  { filename: 'warden_root.sec', style: 'executioner' },
];

export function pickCityPoint(zone: 'plaza' | 'alley' | 'heap' = 'plaza'): { x: number; z: number } {
  for (let i = 0; i < 80; i++) {
    let x = -32 + Math.random() * 64;
    let z = -44 + Math.random() * 84;
    if (zone === 'alley') {
      const side = i % 2 === 0 ? -1 : 1;
      x = side * (36 + Math.random() * 24);
      z = -62 + Math.random() * 116;
    } else if (zone === 'heap') {
      const edge = i % 4;
      if (edge === 0) { x = -86 + Math.random() * 24; z = -90 + Math.random() * 165; }
      else if (edge === 1) { x = 62 + Math.random() * 24; z = -90 + Math.random() * 165; }
      else if (edge === 2) { x = -80 + Math.random() * 160; z = 64 + Math.random() * 18; }
      else { x = -80 + Math.random() * 160; z = -98 + Math.random() * 24; }
      if (Math.hypot(x, z) <= 72) continue;
    }
    if (isFree(x, z, 1.35, SOLIDS, BOUNDS)) return { x, z };
  }
  return zone === 'heap' ? { x: 0, z: 76 } : { x: 0, z: 24 };
}

function buildNpcFighter(
  id: number,
  filename: string,
  role: NpcRole,
  style: StyleId,
  gear: ResolvedGear,
  color: string,
  x: number,
  z: number,
): Fighter {
  const kind: Kind = role === 'enforcer' ? 'brute' : role === 'corrupted' || role === 'gladiator' ? 'skirmisher' : 'skirmisher';
  const hpTarget = role === 'enforcer' ? 110 : role === 'corrupted' ? 85 : role === 'gladiator' ? 75 : 46;
  const f = makeFighter(id, kind, x, z, defaultMods(), style, gear);
  f.hp = hpTarget;
  f.maxHp = hpTarget;
  f.stats = { ...f.stats, name: filename, color };
  return f;
}

export function createCityPopulation(): CityNpc[] {
  const list: CityNpc[] = [];
  let nextId = 100;

  for (const spec of CITIZEN_SPECS) {
    const id = nextId++;
    const p = pickCityPoint(spec.zone);
    const t = pickCityPoint(spec.zone);
    const gear = gearFromStyle('murmillo');
    list.push({
      id,
      filename: spec.filename,
      role: 'citizen',
      temperament: spec.temp,
      mood: 'calm',
      civilian: true,
      style: 'murmillo',
      color: spec.color,
      gear,
      x: p.x,
      z: p.z,
      yaw: (id * 1.1) % (Math.PI * 2),
      targetX: t.x,
      targetZ: t.z,
      wait: id % 3,
      bark: '',
      barkT: 0,
      greeted: false,
      antagonized: 0,
      bountyReward: 12,
      respawnT: 0,
      fighter: buildNpcFighter(id, spec.filename, 'citizen', 'murmillo', gear, spec.color, p.x, p.z),
    });
  }

  for (const spec of HUSTLER_SPECS) {
    const id = nextId++;
    const p = pickCityPoint('alley');
    const t = pickCityPoint('alley');
    const gear = gearFromStyle(spec.style);
    list.push({
      id,
      filename: spec.filename,
      role: 'hustler',
      temperament: 'opportunist',
      mood: 'suspicious',
      civilian: false,
      style: spec.style,
      color: spec.color,
      gear,
      x: p.x,
      z: p.z,
      yaw: (id * 0.9) % (Math.PI * 2),
      targetX: t.x,
      targetZ: t.z,
      wait: 0.5,
      bark: '',
      barkT: 0,
      greeted: false,
      antagonized: 0,
      bountyReward: 24,
      respawnT: 0,
      fighter: buildNpcFighter(id, spec.filename, 'hustler', spec.style, gear, spec.color, p.x, p.z),
    });
  }

  for (const spec of GLADIATOR_SPECS) {
    const id = nextId++;
    const p = pickCityPoint('plaza');
    const t = pickCityPoint('plaza');
    const gear = gearFromStyle(spec.style);
    list.push({
      id,
      filename: spec.filename,
      role: 'gladiator',
      temperament: 'proud',
      mood: 'calm',
      civilian: false,
      style: spec.style,
      color: spec.color,
      gear,
      x: p.x,
      z: p.z,
      yaw: (id * 1.4) % (Math.PI * 2),
      targetX: t.x,
      targetZ: t.z,
      wait: 1,
      bark: '',
      barkT: 0,
      greeted: false,
      antagonized: 0,
      bountyReward: spec.reward,
      respawnT: 0,
      fighter: buildNpcFighter(id, spec.filename, 'gladiator', spec.style, gear, spec.color, p.x, p.z),
    });
  }

  for (const spec of CORRUPTED_SPECS) {
    const id = nextId++;
    const p = pickCityPoint('heap');
    const t = pickCityPoint('heap');
    const gear = gearFromStyle(spec.style);
    list.push({
      id,
      filename: spec.filename,
      role: 'corrupted',
      temperament: 'volatile',
      mood: 'hostile',
      civilian: false,
      style: spec.style,
      color: '#ff3b5c',
      gear,
      x: p.x,
      z: p.z,
      yaw: (id * 2.1) % (Math.PI * 2),
      targetX: t.x,
      targetZ: t.z,
      wait: 0.2,
      bark: 'CORRUPTION OVERFLOW // DE-REZ ALL!',
      barkT: 0,
      greeted: false,
      antagonized: 0,
      bountyReward: spec.reward,
      respawnT: 0,
      fighter: buildNpcFighter(id, spec.filename, 'corrupted', spec.style, gear, '#ff3b5c', p.x, p.z),
    });
  }

  for (const spec of ENFORCER_SPECS) {
    const id = nextId++;
    const p = pickCityPoint('plaza');
    const t = pickCityPoint('plaza');
    const gear = gearFromStyle(spec.style);
    list.push({
      id,
      filename: spec.filename,
      role: 'enforcer',
      temperament: 'proud',
      mood: 'calm',
      civilian: false,
      style: spec.style,
      color: '#ff4f6d',
      gear,
      x: p.x,
      z: p.z,
      yaw: (id * 1.7) % (Math.PI * 2),
      targetX: t.x,
      targetZ: t.z,
      wait: 1,
      bark: '',
      barkT: 0,
      greeted: false,
      antagonized: 0,
      bountyReward: 45,
      respawnT: 0,
      fighter: buildNpcFighter(id, spec.filename, 'enforcer', spec.style, gear, '#ff4f6d', p.x, p.z),
    });
  }

  return list;
}

const CITIZEN_GREETS = [
  'Stay sharp. The Garbage Collector swept Sectors 7 and 9 at boot.',
  'My creator emptied the Recycle Bin three years ago... still clinging to these blocks.',
  'Heard a Vector Spear champion cleared three processes under the Conduit last dusk.',
  'Watch your back around the Subura Vaults. Corrupted shaders hunt strays there.',
];

export function greetNpc(npc: CityNpc, playerSignal: number, roll = Math.random()): GreetOutcome {
  if (npc.mood === 'hostile' || npc.role === 'corrupted') {
    return {
      bark: 'CORRUPTED SIGNAL — NO HANDSHAKE POSSIBLE!',
      cyclesDelta: 0, signalDelta: 0, xpDelta: 0, healPct: 0,
      turnHostile: true, alertEnforcer: false,
    };
  }
  if (npc.role === 'enforcer') {
    const line = playerSignal >= 150
      ? 'High-Signal process verified. Keep your hard-light edge off the plaza.'
      : 'Move along, orphaned file. SysWatch indexes every collision.';
    return { bark: line, cyclesDelta: 0, signalDelta: 0, xpDelta: 0, healPct: 0, turnHostile: false, alertEnforcer: false };
  }
  if (npc.greeted) {
    return {
      bark: npc.role === 'gladiator'
        ? 'Save the chatter for the Purge Grid, process.'
        : 'Still buffering... keep walking, survivor.',
      cyclesDelta: 0, signalDelta: 0, xpDelta: 0, healPct: 0, turnHostile: false, alertEnforcer: false,
    };
  }
  npc.greeted = true;

  if (npc.temperament === 'helpful') {
    const giftCycles = 8 + Math.floor(roll * 10);
    npc.mood = 'grateful';
    return {
      bark: `Found loose cache bytes near the Aqueduct—take ${giftCycles} Cycles and a quick patch!`,
      cyclesDelta: giftCycles,
      signalDelta: 3,
      xpDelta: 10,
      healPct: 0.2,
      turnHostile: false,
      alertEnforcer: false,
    };
  }
  if (npc.role === 'hustler') {
    if (roll < 0.35) {
      npc.mood = 'suspicious';
      return {
        bark: 'Keep digging through the Outer Heap... corrupted rogues drop serious Cycles if you drop them first.',
        cyclesDelta: 0, signalDelta: 2, xpDelta: 12, healPct: 0, turnHostile: false, alertEnforcer: false,
      };
    }
    return {
      bark: 'Want easy Cycles? Look under the Conduit arches—plenty of strays asking for a fade.',
      cyclesDelta: 0, signalDelta: 0, xpDelta: 6, healPct: 0, turnHostile: false, alertEnforcer: false,
    };
  }
  if (npc.role === 'gladiator') {
    if (playerSignal < 60 && roll < 0.3) {
      return {
        bark: 'Orphaned bit walking tall? Step onto the Purge Grid and prove your lines compile.',
        cyclesDelta: 0, signalDelta: 0, xpDelta: 8, healPct: 0, turnHostile: false, alertEnforcer: false,
      };
    }
    return {
      bark: `Clean build, file. Watch my Vector Spear in the Purge Grid tonight.`,
      cyclesDelta: 0, signalDelta: 4, xpDelta: 10, healPct: 0, turnHostile: false, alertEnforcer: false,
    };
  }
  return {
    bark: CITIZEN_GREETS[Math.floor(roll * CITIZEN_GREETS.length) % CITIZEN_GREETS.length],
    cyclesDelta: 0, signalDelta: 1, xpDelta: 5, healPct: 0, turnHostile: false, alertEnforcer: false,
  };
}

export function antagonizeNpc(npc: CityNpc, playerArmed: boolean, roll = Math.random()): AntagonizeOutcome {
  npc.antagonized += 1;

  if (npc.role === 'enforcer') {
    npc.mood = 'hostile';
    return {
      bark: 'DISTURBING KERNEL PEACE! HALT FOR QUARANTINE!',
      cyclesDelta: 0,
      turnHostile: true,
      addBounty: 35,
    };
  }

  if (npc.role === 'gladiator' || npc.role === 'corrupted' || npc.temperament === 'volatile') {
    npc.mood = 'hostile';
    npc.civilian = false;
    return {
      bark: npc.role === 'gladiator'
        ? 'You want a live compile check? IGNITE HARD-LIGHT!'
        : 'MEMORY VIOLATION! DE-REZ TIME!',
      cyclesDelta: 0,
      turnHostile: true,
      addBounty: npc.role === 'corrupted' ? 0 : 15,
    };
  }

  if (npc.role === 'hustler') {
    if (playerArmed && roll < 0.45) {
      const tax = 14 + Math.floor(roll * 12);
      npc.mood = 'fleeing';
      return {
        bark: `Easy, process! Take ${tax} Cycles and wipe my address!`,
        cyclesDelta: tax,
        turnHostile: false,
        addBounty: 20,
      };
    }
    npc.mood = 'hostile';
    npc.civilian = false;
    return {
      bark: 'Wrong alley to talk junk in, leftover file!',
      cyclesDelta: 0,
      turnHostile: true,
      addBounty: 20,
    };
  }

  // Timid / helpful citizens panic, flee, or drop spare Cycles when pushed
  if (npc.temperament === 'timid' || (playerArmed && roll < 0.72)) {
    const dropped = npc.antagonized === 1 ? 10 + Math.floor(roll * 12) : 0;
    npc.mood = 'fleeing';
    return {
      bark: dropped > 0
        ? `Please don't overwrite me! Take ${dropped} Cycles—I'm fleeing!`
        : 'SysWatch! Someone stop this rogue executable!',
      cyclesDelta: dropped,
      turnHostile: false,
      addBounty: 25,
    };
  }

  npc.mood = 'hostile';
  npc.civilian = false;
  return {
    bark: 'Enough! Deleted or not, I refuse to roll over!',
    cyclesDelta: 0,
    turnHostile: true,
    addBounty: 20,
  };
}

const SANCTUARY_CHATTER = [
  'Folks say whoever buys up the Alley Crash-Pads starts pulling Cycles while they sleep.',
  'See that giant pillar of light over the curve? Always guides strays to the nearest Colosseum.',
  'Take a Light-Cycle out past the outer towers if you want real danger—downtown is quiet today.',
  'Rumors say the Kernel Spire holds the truth behind why the machine froze at 99.7%.',
];

export function triggerStreetEvent(
  npcs: CityNpc[],
  playerX: number,
  playerZ: number,
  roll = Math.random(),
): StreetEventResult | null {
  const candidates = npcs
    .filter((n) => n.mood !== 'dead' && n.mood !== 'hostile' && n.role !== 'enforcer')
    .sort((a, b) => Math.hypot(a.x - playerX, a.z - playerZ) - Math.hypot(b.x - playerX, b.z - playerZ));
  if (candidates.length === 0) return null;

  const safe = isSanctuaryPosition(playerX, playerZ);
  if (safe) {
    const gladiator = candidates.find((n) => n.role === 'gladiator' && Math.hypot(n.x - playerX, n.z - playerZ) < 42);
    if (roll < 0.36 && gladiator) {
      gladiator.bark = 'The Colosseum beacon is singing! Meet me on the Purge Grid if you want a clean match.';
      gladiator.barkT = 5.5;
      return {
        title: 'COLOSSEUM INVITE',
        npcId: gladiator.id,
        speaker: gladiator.filename,
        bark: gladiator.bark,
        color: '#ffc95c',
      };
    }
    const speaker = candidates.find((n) => n.role === 'citizen') ?? candidates[0];
    const line = SANCTUARY_CHATTER[Math.floor(roll * 997) % SANCTUARY_CHATTER.length];
    speaker.bark = line;
    speaker.barkT = 5.5;
    return {
      title: roll < 0.72 ? 'TOWN CHATTER' : 'RUMOR MILL',
      npcId: speaker.id,
      speaker: speaker.filename,
      bark: line,
      color: '#3ff0ff',
    };
  }

  const gladiator = candidates.find((n) => n.role === 'gladiator' && Math.hypot(n.x - playerX, n.z - playerZ) < 42);
  if (roll < 0.36 && gladiator) {
    gladiator.targetX = playerX;
    gladiator.targetZ = playerZ;
    gladiator.wait = 0;
    gladiator.mood = 'suspicious';
    gladiator.bark = `Hey, orphan! Ready to wager your runtime against ${gladiator.filename}?`;
    gladiator.barkT = 5.5;
    return {
      title: 'STREET CHALLENGER',
      npcId: gladiator.id,
      speaker: gladiator.filename,
      bark: gladiator.bark,
      color: '#ffc95c',
    };
  }

  const hustler = candidates.find((n) => n.role === 'hustler');
  const citizen = candidates.find((n) => n.role === 'citizen');
  if (roll < 0.7 && hustler && citizen) {
    hustler.targetX = citizen.x + 1.5;
    hustler.targetZ = citizen.z + 1.5;
    hustler.wait = 0;
    hustler.mood = 'suspicious';
    citizen.mood = 'panicked';
    citizen.bark = `HELP! ${hustler.filename} is trying to siphon my Cycles!`;
    citizen.barkT = 6;
    return {
      title: 'CONDUIT SHAKEDOWN',
      npcId: citizen.id,
      speaker: citizen.filename,
      bark: citizen.bark,
      color: '#3ff0ff',
    };
  }

  const target = candidates[0];
  target.role = 'corrupted';
  target.mood = 'hostile';
  target.civilian = false;
  target.color = '#ff3b5c';
  target.bountyReward = 35;
  target.fighter.hp = Math.max(target.fighter.hp, 75);
  target.fighter.maxHp = Math.max(target.fighter.maxHp, 75);
  target.fighter.stats = { ...target.fighter.stats, color: '#ff3b5c' };
  target.bark = 'SIGNAL CORRUPTED // BUFFER OVERFLOW DETECTED!';
  target.barkT = 6;
  return {
    title: 'CORRUPTION OUTBREAK',
    npcId: target.id,
    speaker: target.filename,
    bark: target.bark,
    color: '#ff3b5c',
  };
}

const REGION_STYLES: StyleId[] = ['murmillo', 'hoplomachus', 'dimachaerus', 'retiarius', 'executioner'];

/** Build 8 lightweight themed NPCs around any non-Cache settlement so every town & frontier ruin feels alive. */
export function createRegionNpcs(s: Settlement): CityNpc[] {
  const solids = collidersNear(s.x, s.z);
  const out: CityNpc[] = [];
  const prefix = s.id.slice(0, 6);
  const isFrontier = s.safety === 'frontier';

  for (let i = 0; i < 8; i++) {
    const id = s.seed * 20 + i;
    let px = s.x + Math.cos(i * 0.8) * 14;
    let pz = s.z + Math.sin(i * 0.8) * 14;
    for (let k = 0; k < 24; k++) {
      const a = ((i + k * 0.37) / 8) * Math.PI * 2;
      const r = 10 + ((i * 7 + k * 5) % 24);
      const cx = s.x + Math.cos(a) * r;
      const cz = s.z + Math.sin(a) * r;
      if (isFree(cx, cz, 1.1, solids, WORLD_BOUNDS)) {
        px = cx;
        pz = cz;
        break;
      }
    }

    const role: NpcRole = isFrontier
      ? i < 4 ? 'corrupted' : 'gladiator'
      : i < 4 ? 'citizen' : i < 6 ? 'hustler' : i === 6 ? 'gladiator' : 'enforcer';
    const style = REGION_STYLES[i % REGION_STYLES.length];
    const gear = gearFromStyle(style);
    const filename =
      role === 'corrupted' ? `${prefix}_err_${i}.bad`
      : role === 'enforcer' ? `${prefix}_sec.sys`
      : role === 'gladiator' ? `${prefix}_champ_${i}.exe`
      : role === 'hustler' ? `${prefix}_deal_${i}.dat`
      : `${prefix}_mem_${i}.bak`;
    const color =
      role === 'corrupted' ? '#ff3b5c'
      : role === 'enforcer' ? '#ff4f6d'
      : i % 2 === 0 ? s.accent : s.secondary;

    out.push({
      id,
      filename,
      role,
      temperament: role === 'corrupted' ? 'volatile' : role === 'hustler' ? 'opportunist' : role === 'citizen' ? 'helpful' : 'proud',
      mood: role === 'corrupted' ? 'hostile' : 'calm',
      civilian: role === 'citizen',
      style,
      color,
      gear,
      x: px,
      z: pz,
      yaw: (i * 1.3) % (Math.PI * 2),
      targetX: px,
      targetZ: pz,
      wait: i % 3,
      bark: '',
      barkT: 0,
      greeted: false,
      antagonized: 0,
      bountyReward: role === 'corrupted' ? 42 : role === 'gladiator' ? 35 : 15,
      respawnT: 0,
      fighter: buildNpcFighter(id, filename, role, style, gear, color, px, pz),
    });
  }
  return out;
}
