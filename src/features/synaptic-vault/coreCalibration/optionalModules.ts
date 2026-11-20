import ipcData from '../data/ipip-ipc-32.json';
import ninePatternData from '../data/nine-pattern.json';
import strengthData from '../data/strength-signals.json';
import cognitiveData from '../data/cognitive-style.json';
import type {
  CognitiveStyleResult,
  IPCResult,
  NinePatternResult,
  StrengthPrismResult,
  StrengthRanking,
} from './calibrationTypes';

export const IPC_DATA = ipcData;
export const NINE_PATTERN_DATA = ninePatternData;
export const STRENGTH_SIGNALS_DATA = strengthData;
export const COGNITIVE_STYLE_DATA = cognitiveData;

export const NINE_PATTERN_NAMES: Record<number, string> = {
  1: 'Reformer',
  2: 'Supporter',
  3: 'Performer',
  4: 'Individualist',
  5: 'Observer',
  6: 'Sentinel',
  7: 'Explorer',
  8: 'Protector',
  9: 'Harmonizer',
};

/**
 * Score the 32-item IPIP-IPC Interpersonal Circumplex module.
 */
export function scoreIPC(responses: Record<string, number>): IPCResult | null {
  const items = IPC_DATA.items;
  const itemsByOctant: Record<string, typeof items> = {};

  for (const item of items) {
    if (!itemsByOctant[item.octant]) itemsByOctant[item.octant] = [];
    itemsByOctant[item.octant].push(item);
  }

  const octants: IPCResult['octants'] = {};
  let totalX = 0;
  let totalY = 0;

  for (const [code, octItems] of Object.entries(itemsByOctant)) {
    const answered = octItems.filter((i) => typeof responses[i.id] === 'number');
    if (answered.length < 4) return null; // Require complete octant

    const sum = octItems.reduce((acc, it) => acc + responses[it.id], 0);
    const mean = sum / 4;
    const meta = (IPC_DATA.octants as Record<string, { label: string; angle: number }>)[code];
    const angleDeg = meta.angle;
    const angleRad = (angleDeg * Math.PI) / 180;

    octants[code] = {
      octant: code,
      label: meta.label,
      mean,
      angle: angleDeg,
    };

    const centered = mean - 3;
    totalX += centered * Math.cos(angleRad);
    totalY += centered * Math.sin(angleRad);
  }

  const vectorAngle = ((Math.atan2(totalY, totalX) * 180) / Math.PI + 360) % 360;
  const vectorAmplitude = Math.sqrt(totalX * totalX + totalY * totalY);

  return {
    octants,
    vectorX: totalX,
    vectorY: totalY,
    vectorAngle,
    vectorAmplitude,
  };
}

/**
 * Score the Nine-Pattern Motive Deck (27 items, types 1..9).
 */
export function scoreNinePattern(
  responses: Record<string, number>,
  tieBreakerChoice?: number,
): NinePatternResult | null {
  const items = NINE_PATTERN_DATA.items;
  const itemsByType: Record<number, typeof items> = {};

  for (const item of items) {
    if (!itemsByType[item.type]) itemsByType[item.type] = [];
    itemsByType[item.type].push(item);
  }

  const scores: Record<number, number> = {};
  const ranked: Array<{ type: number; name: string; mean: number }> = [];

  for (let t = 1; t <= 9; t++) {
    const typeItems = itemsByType[t] || [];
    const answered = typeItems.filter((i) => typeof responses[i.id] === 'number');
    if (answered.length < 2) return null; // Minimum 2 for reduced confidence, 3 for firm

    const sum = answered.reduce((acc, i) => acc + responses[i.id], 0);
    const mean = sum / answered.length;
    scores[t] = mean;
    ranked.push({ type: t, name: NINE_PATTERN_NAMES[t], mean });
  }

  ranked.sort((a, b) => b.mean - a.mean);

  const top = ranked[0];
  const second = ranked[1];
  const leadMargin = top.mean - (second ? second.mean : 0);

  let leadStatus: 'shared' | 'tentative' | 'clear' = 'clear';
  if (leadMargin < 0.25) leadStatus = 'shared';
  else if (leadMargin < 0.75) leadStatus = 'tentative';

  // Wing rule: adjacent number (1 wraps next to 9) >= 3.25 and within 0.75 of lead
  const leftAdj = top.type === 1 ? 9 : top.type - 1;
  const rightAdj = top.type === 9 ? 1 : top.type + 1;
  const leftScore = scores[leftAdj] || 0;
  const rightScore = scores[rightAdj] || 0;

  let wing: { type: number; name: string; score: number } | undefined;
  const candidates: Array<{ type: number; score: number }> = [];

  if (leftScore >= 3.25 && top.mean - leftScore <= 0.75) {
    candidates.push({ type: leftAdj, score: leftScore });
  }
  if (rightScore >= 3.25 && top.mean - rightScore <= 0.75) {
    candidates.push({ type: rightAdj, score: rightScore });
  }

  if (candidates.length > 0) {
    candidates.sort((a, b) => b.score - a.score);
    wing = {
      type: candidates[0].type,
      name: NINE_PATTERN_NAMES[candidates[0].type],
      score: candidates[0].score,
    };
  }

  return {
    scores,
    rankedTypes: ranked,
    leadType: tieBreakerChoice || top.type,
    secondType: second?.type,
    leadMargin,
    leadStatus,
    wing,
    tieBreakerRequired: leadMargin < 0.25,
    tieBreakerResolved: tieBreakerChoice,
  };
}

/**
 * Score the Strength Signals & Prism.
 * Stage 1: Base ratings 1..5.
 * Stage 2: Selected top 5 ranked strengths.
 */
export function scoreStrengthPrism(
  baseRatings: Record<string, number>,
  rankedTop5Ids: string[],
  underusedTargetId?: string,
): StrengthPrismResult {
  const items = STRENGTH_SIGNALS_DATA.items;
  const allRankings: StrengthRanking[] = items.map((item) => {
    const base = baseRatings[item.id] || 3;
    const prismIndex = rankedTop5Ids.indexOf(item.id);
    return {
      id: item.id,
      name: item.strength,
      baseRating: base,
      rank: prismIndex !== -1 ? prismIndex + 1 : undefined,
    };
  });

  const signatureStrengths = allRankings
    .filter((r) => r.rank !== undefined)
    .sort((a, b) => a.rank! - b.rank!);

  const availableStrengths = allRankings
    .filter((r) => r.rank === undefined)
    .sort((a, b) => b.baseRating - a.baseRating);

  return {
    signatureStrengths,
    availableStrengths,
    underusedTarget: underusedTargetId,
  };
}

/**
 * Score the 4 Cognitive Continua.
 */
export function scoreCognitiveStyle(responses: Record<string, number>): CognitiveStyleResult {
  const calcAxis = (id1: string, id2: string, leftLabel: string, rightLabel: string) => {
    const v1 = responses[id1] ?? 0;
    const v2 = responses[id2] ?? 0;
    const avg = (v1 + v2) / 2;
    const abs = Math.abs(avg);

    let strength = 'balanced';
    if (abs >= 1.25) strength = 'clear';
    else if (abs >= 0.5) strength = 'leaning';

    let preference: any = 'balanced';
    let label = `balanced between ${leftLabel} and ${rightLabel}`;
    if (avg < -0.49) {
      preference = leftLabel;
      label = `${strength} ${leftLabel}-first`;
    } else if (avg > 0.49) {
      preference = rightLabel;
      label = `${strength} ${rightLabel}-first`;
    }

    return { preference, score: avg, label };
  };

  return {
    axes: {
      energy: calcAxis('CS-E-01', 'CS-E-02', 'inward', 'outward'),
      perception: calcAxis('CS-P-01', 'CS-P-02', 'concrete', 'pattern'),
      decision: calcAxis('CS-D-01', 'CS-D-02', 'principle', 'people'),
      rhythm: calcAxis('CS-R-01', 'CS-R-02', 'structured', 'adaptive'),
    },
  };
}
