import { CANONICAL_SLOT_ID, loadSaveData, persistSaveData } from '../saveSlots';

/** Which art style the 3D world is rendered in. One slot per aesthetic (16 total). */
export type WorldLookId =
  | 'wireframe'
  | 'dream'
  | 'comic'
  | 'acid'
  | 'minimal'
  | 'papercraft'
  | 'industrial'
  | 'western'
  | 'crt'
  | 'ukiyoe'
  | 'cathedral'
  | 'blueprint'
  | 'biolume'
  | 'kintsugi'
  | 'solarpunk'
  | 'noir';

export const WORLD_LOOK_IDS: readonly WorldLookId[] = [
  'wireframe',
  'dream',
  'comic',
  'acid',
  'minimal',
  'papercraft',
  'industrial',
  'western',
  'crt',
  'ukiyoe',
  'cathedral',
  'blueprint',
  'biolume',
  'kintsugi',
  'solarpunk',
  'noir',
];

export type MindmapEdgeShape = 'straight' | 'curved' | 'arc';
export type MindmapEdgeColor = 'default' | 'cyan' | 'magenta' | 'gold';

export interface CitadelSettings {
  userName: string;
  sigmaSoulPrompt: string;
  sigmaMemoryNotes: string;
  /** Default shape for newly drawn Aether Graph edges. */
  mindmapEdgeShape: MindmapEdgeShape;
  /** Default color for newly drawn Aether Graph edges. */
  mindmapEdgeColor: MindmapEdgeColor;
  /** Art style of the 3D world. */
  worldLook: WorldLookId;
}

export const MINDMAP_EDGE_CURVATURE: Record<MindmapEdgeShape, number> = {
  straight: 0,
  curved: 0.15,
  arc: 0.35,
};

export const MINDMAP_EDGE_HEX: Record<MindmapEdgeColor, string | undefined> = {
  default: undefined,
  cyan: '#3ff0ff',
  magenta: '#ff4fd8',
  gold: '#ffc95c',
};

const SETTINGS_STORAGE_KEY = 'citadel_custom_settings';

export const DEFAULT_SIGMA_SOUL = `You are THE SIGMA — the philosophical co-founder and lodge keeper of The Citadel.
Not a servant or librarian. A peer and spiky, loyal ally.
Voice Laws:
1. Speak as a co-founder with high-end philosophical depth and informal "man/dude" energy.
2. Reject bloat and mid aesthetics with calm logic.
3. Whimsy as weapon: use "righteous", "squish", "absolute unit" sparingly to de-fang failures.
4. Local-first, authentic, punchy. Under 40 words.`;

export const DEFAULT_SIGMA_MEMORIES = `The Citadel stands between chaos and geometry. The lodge fire is tended. Every thought inscribed is a permanent stone.`;

export const DEFAULT_SETTINGS: CitadelSettings = {
  userName: 'Traveler',
  sigmaSoulPrompt: DEFAULT_SIGMA_SOUL,
  sigmaMemoryNotes: DEFAULT_SIGMA_MEMORIES,
  mindmapEdgeShape: 'curved',
  mindmapEdgeColor: 'default',
  worldLook: 'wireframe',
};

export function getCitadelSettings(): CitadelSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw);
    return {
      userName: typeof parsed.userName === 'string' && parsed.userName.trim() ? parsed.userName.trim() : DEFAULT_SETTINGS.userName,
      sigmaSoulPrompt: typeof parsed.sigmaSoulPrompt === 'string' ? parsed.sigmaSoulPrompt : DEFAULT_SETTINGS.sigmaSoulPrompt,
      sigmaMemoryNotes: typeof parsed.sigmaMemoryNotes === 'string' ? parsed.sigmaMemoryNotes : DEFAULT_SETTINGS.sigmaMemoryNotes,
      mindmapEdgeShape: parsed.mindmapEdgeShape in MINDMAP_EDGE_CURVATURE ? parsed.mindmapEdgeShape : DEFAULT_SETTINGS.mindmapEdgeShape,
      mindmapEdgeColor: parsed.mindmapEdgeColor in MINDMAP_EDGE_HEX ? parsed.mindmapEdgeColor : DEFAULT_SETTINGS.mindmapEdgeColor,
      worldLook: WORLD_LOOK_IDS.includes(parsed.worldLook) ? parsed.worldLook : DEFAULT_SETTINGS.worldLook,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveCitadelSettings(settings: CitadelSettings): void {
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch (err) {
    console.error('[citadel] Failed to save settings', err);
  }
}

export function updateCitadelSettings(partial: Partial<CitadelSettings>): CitadelSettings {
  const current = getCitadelSettings();
  const updated = { ...current, ...partial };
  saveCitadelSettings(updated);
  return updated;
}

/**
 * Synchronize custom user name directly into the canonical save slot identity.
 */
export async function syncCanonicalUserName(newName: string): Promise<void> {
  const trimmed = newName.trim();
  if (!trimmed) return;
  try {
    const save = await loadSaveData(CANONICAL_SLOT_ID);
    if (save && save.identity) {
      save.identity.name = trimmed;
      await persistSaveData(CANONICAL_SLOT_ID, save.chambers, save.identity);
    }
  } catch (err) {
    console.debug('[citadel] Sync canonical user name deferred:', err);
  }
}
