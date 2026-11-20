import type { Chamber, Thought } from '../types';
import { getCalendarTier } from '../calendarChamberUtils';

export type BitCaste = 'elite' | 'artisan' | 'laborer' | 'wanderer';

export interface BitLoreProfile {
  caste: BitCaste;
  color: number;
  geometry: 'octahedron' | 'icosahedron' | 'tetrahedron';
  scale: number;
  orbitRadius: number;
  orbitHeight: number;
  title: string;
}

function hashText(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function casteForChamber(chamber: Chamber): BitCaste {
  const tier = getCalendarTier(chamber);
  if (tier === 'year' || tier === 'season') return 'elite';
  if (tier === 'month' || tier === 'week') return 'artisan';
  if (tier === 'day') return 'laborer';
  return 'wanderer';
}

export function resolveBitLoreProfile(thought: Thought, chamber: Chamber): BitLoreProfile {
  const caste = casteForChamber(chamber);
  const seed = hashText(`${thought.id}:${thought.sourceDate ?? ''}:${chamber.id}:${thought.text.slice(0, 32)}`);
  const drift = (seed % 1000) / 1000;

  switch (caste) {
    case 'elite':
      return {
        caste,
        color: chamber.template === 'season' ? 0xfbbf24 : 0xf0abfc,
        geometry: 'icosahedron',
        scale: 1.18 + drift * 0.18,
        orbitRadius: 11 + (seed % 4) * 1.5,
        orbitHeight: 4.2 + drift * 1.8,
        title: 'High-tier Bit',
      };
    case 'artisan':
      return {
        caste,
        color: chamber.template === 'month' ? 0x22d3ee : 0xa78bfa,
        geometry: 'octahedron',
        scale: 0.95 + drift * 0.16,
        orbitRadius: 8 + (seed % 5) * 1.25,
        orbitHeight: 2.8 + drift * 1.2,
        title: 'Pattern Bit',
      };
    case 'laborer':
      return {
        caste,
        color: 0x34d399,
        geometry: 'tetrahedron',
        scale: 0.75 + drift * 0.18,
        orbitRadius: 6 + (seed % 6) * 1.1,
        orbitHeight: 1.8 + drift,
        title: 'Day-cell Bit',
      };
    default:
      return {
        caste,
        color: 0xc084fc,
        geometry: 'octahedron',
        scale: 0.85 + drift * 0.14,
        orbitRadius: 7 + (seed % 5),
        orbitHeight: 2.4 + drift,
        title: 'Hub Bit',
      };
  }
}
