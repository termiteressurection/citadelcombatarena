export type SeasonKey = 'winter' | 'spring' | 'summer' | 'autumn';

export const SEASON_PALETTES: Record<SeasonKey, { bg: string; fog: string }> = {
  winter: { bg: '#0b1022', fog: '#1a2b4a' },
  spring: { bg: '#0e1a18', fog: '#2a4f44' },
  summer: { bg: '#120b1f', fog: '#3b235b' },
  autumn: { bg: '#1a120b', fog: '#4e2d1e' },
};

export function getSeason(date = new Date()): SeasonKey {
  const month = date.getMonth(); // 0-11
  if (month === 11 || month <= 1) return 'winter';
  if (month >= 2 && month <= 4) return 'spring';
  if (month >= 5 && month <= 7) return 'summer';
  return 'autumn';
}
