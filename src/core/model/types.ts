import type { JournalLevel } from '@/arboretum/components/citadel-rebuilt/writablePath';

export type LocalDay = `${number}-${number}-${number}`;

export type RitualPhase = 'morning' | 'midday' | 'reflect' | 'commune';
export type DensityLabel = 'BOSS_THREAT' | 'CHARGED_THREAD' | 'CALM_ECHO' | 'SILENT_SIGNAL';
export type ConstellationCategory =
  | 'WORK'
  | 'RITUAL'
  | 'MEMORY'
  | 'BOSS_THREAT'
  | 'GOLDEN_SIGNAL';

export interface EntryConflictLog {
  id: string;
  entryId: string;
  day: LocalDay;
  at: string;
  reason: 'lww_overwrite';
  replaced: {
    text: string;
    updatedAt: string;
  };
  incoming: {
    text: string;
    updatedAt: string;
  };
}

export interface SyncState {
  conflictLogs: EntryConflictLog[];
}

export interface FractalDayPointer {
  year: string;
  season: string;
  month: string;
  day: LocalDay;
}

export interface FractalIndexV1 {
  version: 1;
  byDay: Record<LocalDay, FractalDayPointer>;
}

export interface CellEntry {
  id: string;          // UUID v4
  day: LocalDay;
  createdAt: string;   // ISO8601 UTC
  updatedAt: string;   // ISO8601 UTC — used for LWW merge
  text: string;
  tags?: string[];
  densityScore?: number;
  densityLabel?: DensityLabel;
  chamberCategory?: ConstellationCategory;
  /** Set when migration preserved a conflicting legacy ID as a separate entry. */
  migrationConflict?: boolean;
  /** The colliding source ID retained for audit and user review. */
  originalId?: string;
  level?: JournalLevel;
  period?: string;
}

export interface DayCell {
  day: LocalDay;
  entries: CellEntry[];
  locked: boolean;
  dailyAnchorComplete: boolean;
  /** The day's Stoic trial was completed at the altar. Optional: older saves predate it. */
  dailyTrialComplete?: boolean;
  /** True when the day has undergone midnight or manual crystallization into stone. */
  crystallized?: boolean;
  /** ISO timestamp when the day was sealed. */
  crystallizedAt?: string;
}

export interface RitualRecord {
  day: LocalDay;
  morning: boolean;
  evening: boolean;
}

export interface IdentityState {
  name: string;
  streak: number;
  mbti?: string;
}

export type SynapticQuestionType = 'binary' | 'spectrum' | 'prism' | 'inscription';
export type SynapticAnswerValue = boolean | number | string | string[];
export type ArchetypeName = 'Sensorium' | 'Metaphysics' | 'Vector' | 'Reflection';

export interface SynapticQuestion {
  id: string;
  sector: string;
  type: SynapticQuestionType;
  prompt: string;
  options?: string[];
  difficulty: number;
  tags: string[];
  deckId: string;
  archetypeWeights?: Record<string, Partial<Record<ArchetypeName, number>>>;
}

export interface SynapticAnswer {
  questionId: string;
  timestamp: string;
  value: SynapticAnswerValue;
  depthTimeMs: number;
  dialecticNotes?: string;
}

export interface QuestionDeck {
  id: string;
  title: string;
  description: string;
  version: string;
  questions: SynapticQuestion[];
  author?: string;
}

export interface NeuralProfile {
  sectorDensities: Record<string, number>;
  archetypeScores: Record<ArchetypeName, number>;
  resonantFrequency: number;
  totalAnswered: number;
  averageDepthTimeMs: number;
}

export interface SynapticVaultState {
  decks: QuestionDeck[];
  activeDeckId: string;
  answers: Record<string, SynapticAnswer>;
  synthesizedQuestions: SynapticQuestion[];
}

export interface CitadelStateModel {
  today: LocalDay;
  days: Record<LocalDay, DayCell>;
  ritual: RitualRecord;
  identity: IdentityState;
  /** Hub-level global mindmap — the traveler's whole-citadel thought graph. */
  globalMindMap: { nodes: MindNode[]; edges: MindEdge[] };
  /** Sync/runtime metadata; does not alter day-cell canonical store. */
  sync?: SyncState;
  /** The persisted Synaptic Vault knowledge-graph state. */
  synapticVault?: SynapticVaultState;
  /**
   * Fractal migration stage: derived Y/S/M/W/D pointers while keeping canonical
   * persistence compatible with existing `days` map.
   */
  fractal?: FractalIndexV1;
  /** Hierarchical entries for month, season, and year tiers (period key -> entries). */
  hierarchicalEntries?: Record<string, CellEntry[]>;
  /** The 3D Mindmap state (nodes with 3D positions, notes/bullets, and styled crosslink edges). */
  mindmap3d?: Mindmap3dState;
}

export interface WriteEntryInput {
  day: LocalDay;
  text: string;
  tags?: string[];
  level?: JournalLevel;
  period?: string;
}

export interface MindNode {
  id: string;
  label: string;
  x: number;
  y: number;
  bullets?: string[];
  /** Chamber id this node is bound to. When starred, Sigma raises a torii gate to it. */
  boundChamberId?: string | null;
  /** Starred nodes manifest as torii gates in the Hub's starred lane. */
  starred?: boolean;
}

export interface MindEdge {
  id: string;
  from: string;
  to: string;
}

export interface Mindmap3dNode {
  id: string;
  title: string;
  body: string;
  position: [number, number, number];
  hue: number;
  color?: string;
  links: string[];
  createdAt: number;
  starred?: boolean;
  bullets?: string[];
}

export type Mindmap3dEdgeKind = 'tree' | 'crosslink';

export interface Mindmap3dEdgeStyle {
  color?: string;
  thickness?: number;
  dashed?: boolean;
  curvature?: number;
  arrow?: boolean;
  label?: string;
}

export interface Mindmap3dEdge {
  id: string;
  source: string;
  target: string;
  kind: Mindmap3dEdgeKind;
  style?: Mindmap3dEdgeStyle;
}

export interface Mindmap3dDoc {
  nodes: Record<string, Mindmap3dNode>;
  edges: Record<string, Mindmap3dEdge>;
  order: string[];
}

export interface Mindmap3dMapMeta {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
}

/** The active map's graph, plus (optionally) the library of all maps. Absent library = a single map. */
export interface Mindmap3dState extends Mindmap3dDoc {
  activeMapId?: string;
  maps?: Record<string, Mindmap3dMapMeta>;
  /** Content of every inactive map, keyed by map id. */
  stash?: Record<string, Mindmap3dDoc>;
}
