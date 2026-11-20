// Canonical Calibration Data Contracts & Types (Spec v0.2)

export type ItemBankId = 'ipip-neo-120' | 'ipip-ipc-32' | 'nine-pattern' | 'strength-signals' | 'cognitive-style';

export interface IPIPItem {
  id: string;
  facet: string; // N1..N6, E1..E6, O1..O6, A1..A6, C1..C6
  key: '+' | '-';
  text: string;
}

export interface IPIPBank {
  bank: string;
  bankVersion: string;
  items: IPIPItem[];
  scale: Record<string, string>;
  source: string;
}

export interface FacetScore {
  raw: number;
  mean: number;
  n: number;
  possibleRangePosition: number; // 25 * (mean - 1), 0..100
}

export interface DomainScore {
  raw: number;
  mean: number;
  n: number;
  possibleRangePosition: number; // 25 * (mean - 1), 0..100
  facets: Record<string, FacetScore>;
}

export interface IPIPNeoResult {
  bank: string;
  bankVersion: string;
  answeredCount: number;
  isComplete: boolean;
  domains: Record<'N' | 'E' | 'O' | 'A' | 'C', DomainScore | null>;
  facets: Record<string, FacetScore | null>;
}

export interface IPCOctantScore {
  octant: string;
  label: string;
  mean: number;
  angle: number;
}

export interface IPCResult {
  octants: Record<string, IPCOctantScore>;
  vectorX: number;
  vectorY: number;
  vectorAngle: number;
  vectorAmplitude: number;
}

export interface NinePatternResult {
  scores: Record<number, number>; // 1..9 -> mean (1..5)
  rankedTypes: Array<{ type: number; name: string; mean: number }>;
  leadType: number;
  secondType?: number;
  leadMargin: number;
  leadStatus: 'shared' | 'tentative' | 'clear';
  wing?: { type: number; name: string; score: number };
  tieBreakerRequired: boolean;
  tieBreakerResolved?: number;
}

export interface StrengthRanking {
  id: string;
  name: string;
  baseRating: number;
  rank?: number; // 1..5 if in prism
}

export interface StrengthPrismResult {
  signatureStrengths: StrengthRanking[]; // Exactly 5 ranked
  availableStrengths: StrengthRanking[]; // Remaining 19
  underusedTarget?: string; // id of underused strength
}

export interface CognitiveStyleResult {
  axes: {
    energy: { preference: 'inward' | 'outward' | 'balanced'; score: number; label: string };
    perception: { preference: 'concrete' | 'pattern' | 'balanced'; score: number; label: string };
    decision: { preference: 'principle' | 'people' | 'balanced'; score: number; label: string };
    rhythm: { preference: 'structured' | 'adaptive' | 'balanced'; score: number; label: string };
  };
}

export interface CelestialResult {
  solarStation: { station: string; line: number; hexagramName: string };
  lunarStation: { station: string; phase: number; hexagramName: string };
  horizonTone?: { altitude: number; azimuth: number };
  confidence: 'exact' | 'approximate' | 'date-only';
  convention: string;
}

export interface CoachingControls {
  directness: number; // 1 (gentle) .. 5 (blunt)
  challenge: 'affirm' | 'balanced' | 'confront';
  pace: 'one step' | 'steady' | 'rapid stack';
  evidence: 'example' | 'balanced' | 'model';
}

export interface ProductiveTension {
  id: string;
  name: string;
  advantage: string;
  failureMode: string;
  earlyWarning: string;
  experiment: string;
  evidenceSource: string;
}

export interface CalibrationFieldManual {
  portrait: string[];
  controls: CoachingControls;
  ipip: IPIPNeoResult;
  ipc?: IPCResult;
  ninePattern?: NinePatternResult;
  strengthPrism?: StrengthPrismResult;
  cognitiveStyle?: CognitiveStyleResult;
  celestial?: CelestialResult;
  tensions: ProductiveTension[];
  inscriptions: {
    helpfulCriticism?: string;
    challengePattern?: string;
  };
  consent: {
    scope: 'session' | 'local' | 'export';
    timestamp: string;
  };
}
