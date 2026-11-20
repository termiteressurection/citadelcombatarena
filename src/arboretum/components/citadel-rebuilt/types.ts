export interface Thought {
  id: number;
  text: string;
  timestamp: string;
  chamberId?: number;
  sourceThoughtId?: number;
  sourceChamberId?: number;
  sourceDate?: string;
  derived?: boolean;
  manifestTier?: 'root' | 'year' | 'season' | 'month' | 'week' | 'day';
  stressScore?: number;
  stressLabel?: string;
  pinned?: boolean;
  tags?: string[];
  replyTo?: number;
  mood?: string;
  type?: 'gem' | 'seed' | 'scroll' | 'monolith' | 'orb';
  isRefined?: boolean;
}

export interface FurnitureItem {
  id: number;
  kind: string;       // 'lantern' | 'rug' | 'sculpture' | 'crystal' | 'pillar' | 'altar' | 'fountain' | 'banner'
  x: number;
  z: number;
  color?: number;
}

export interface NamePlate {
  id: number;
  text: string;
  x: number;
  z: number;
}

export interface BottleMessage {
  id: number;
  text: string;
  sentAt: string;
  arriveAt: string;    // ISO date — appears after this time
  fromChamber: number;
  toChamber?: number;  // assigned on arrival
}

export interface FutureLetter {
  id: number;
  text: string;
  writtenAt: string;
  revealAt: string;    // ISO date
  revealed?: boolean;
}

export interface Chamber {
  id: number;
  name: string;
  description: string;
  depth: number;
  thoughts: Thought[];
  doors: number[];
  wormholes?: number[];
  parent?: number;
  bookmarked?: boolean;
  template?: string;
  nodeId?: string;
  lastVisited?: number;
  isLighthouse?: boolean;
  furniture?: FurnitureItem[];
  namePlates?: NamePlate[];
  commandLog?: string[];      // last N commands for echo board
  bottles?: BottleMessage[];  // incoming messages
  letters?: FutureLetter[];   // letters to future self
  skyboxData?: string;        // base64 custom skybox image
}

// Premium whitelist. Anything outside this set is normalised to 'none' at render time.
export type HatStyle = 'none' | 'wizard' | 'crown' | 'halo';
export type TrailStyle =
  | 'none'
  | 'footprints'
  | 'particles'
  | 'ink'
  | 'fire'
  | 'stars'
  | 'glitch'
  | 'duck_feather';
export type WeaponStyle =
  | 'none'
  | 'sword'
  | 'wand'
  | 'axe'
  | 'spear'
  | 'dagger'
  | 'hammer'
  | 'scythe'
  | 'katana'
  | 'staff'
  | 'trident'
  | 'flail';

export interface CombatSignature {
  equationId: string;
  params: Record<string, number | string | boolean>;
}

export interface AvatarConfig {
  glowColor: number;     // hex
  silhouette: string;    // 'default' | 'crystal' | 'flame' | 'void' | 'prism'
  auraIntensity: number; // 0-1
  hat?: HatStyle;
  hatColor?: string;     // hex color string for hat tint
  isSlicker?: boolean;
  trailStyle?: TrailStyle;
  weapon?: WeaponStyle;
}

/** Keiretsu temperament bucket (Root Chamber vision). */
export type TemperamentKey = 'NF' | 'NT' | 'SP' | 'SJ';

/** 50-question calibration + derived typing (Phase 1 consumes this). */
export interface CalibrationState {
  status: 'none' | 'in_progress' | 'complete';
  startedAt?: string;
  completedAt?: string;
  /** Fingerprint of answers for idempotent resume / export. */
  answersDigest?: string;
  temperament?: TemperamentKey;
  mbti?: string;
  mbtiScores?: Partial<Record<'E' | 'I' | 'S' | 'N' | 'T' | 'F' | 'J' | 'P', number>>;
  mbtiConfidence?: number;
  consentSigmaPersonalization?: boolean;
  lastUpdatedAt?: string;
  sigmaTone?: 'felt' | 'obsidian' | 'neon' | 'hearth' | 'neutral';
}

/** Wireframe altar progression (Phase 1 / IV). */
export interface AltarState {
  /** 0–1 how "settled" the altar is for the current cycle. */
  stabilization: number;
  /** Bitmask 0–127 for seven working tools + reserve bit. */
  toolsUnlocked: number;
  stage?: 'wireframe' | 'stabilizing' | 'sealed';
}

export interface Intention {
  id: string;
  text: string;
  deadline: string; // ISO string
  createdAt: string;
  status: 'active' | 'completed' | 'failed';
  priority: 'low' | 'med' | 'high';
}

export interface GridIdentity {
  name: string;
  createdAt: string;
  sessionStart: number;
  corruption?: number;
  sessionCount?: number;
  streak?: number;
  lastActiveDate?: string;
  mentalLoad?: number;
  upgrades?: Record<string, number>;
  achievements?: string[];
  combatSignature?: CombatSignature;
  rituals?: { date: string; morning?: boolean; midday?: boolean; evening?: boolean; stars: number; constellations: number };
  avatar?: AvatarConfig;
  moodLog?: { date: string; mood: string }[];
  sentBottles?: BottleMessage[];
  unlockedThemes?: string[];
  /** Local YYYY-MM-DD when the player sealed the root "Today is …" anchor. */
  lastDailyAnchorLocalDate?: string;
  lastDailyPromptDate?: string;
  dailyDeepThoughts?: number;
  lastDeepThoughtDate?: string;
  /** Phase 0 — optional; merged on load via `withIdentityDefaults`. */
  calibration?: CalibrationState;
  altar?: AltarState;
  extra?: Record<string, any>;
}

export const CHAMBER_SIZE = 40;
export const HUB_SIZE = 200;
export const MOVE_SPEED = 0.27;
export const GRAVITY = -0.015;
export const LOOK_SPEED = 0.003;
