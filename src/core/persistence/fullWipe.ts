import { keys as idbKeys } from 'idb-keyval';
import { isTauri } from './storage';
import { clearPortablePrefs } from './portablePrefs';
import { isPortableModeEnabled } from './portableMode';
import { resumeTauriVaultStorage, suspendTauriVaultStorage } from '@/core/security/vaultStorage';
import { clearAllWorldSaveData, CANONICAL_SLOT_ID } from '@/arboretum/components/citadel-rebuilt/saveSlots';
import {
  cancelPendingWorldSaves,
  recordWipedWorldSnapshot,
} from '@/arboretum/components/citadel-rebuilt/hooks/usePersistence';
import { useCitadelStore as useWorldStore } from '@/arboretum/components/citadel-rebuilt/store';
import { syncSigmaEngineChambers } from '@/arboretum/components/citadel-rebuilt/hooks/useCitadelState';
import { withIdentityDefaults } from '@/arboretum/components/citadel-rebuilt/identityDefaults';
import { useCitadelStore as useCanonicalStore } from '@/core/state/citadelStore';
import { useMindmap, cancelPendingMindmapSave } from '@/features/world/mindmap3d/store';
import { advanceWipeEpoch } from '@/core/security/wipeEpoch';

import {
  resetFoliageDebugOverrides,
  useFoliageDebugStore,
} from '@/core/state/foliageDebugStore';
import { resetVillageDebugOverrides } from '@/core/state/villageTunerStore';

export interface WipeReceipt {
  timestamp: string;
  clearedStores: string[];
  survivors: string[];
  unreachableStores: string[];
  sandboxNotice?: string;
  deletedEntriesCount: number;
}

interface NativeWipeReport {
  clearedPaths: string[];
  survivors: string[];
}

/**
 * Explicit inventory of every known localStorage key used across The Citadel.
 * In addition to these exact keys, `executeCitadelFullWipe` also sweeps any
 * key matching `citadel*` or `mindmap*` and calls `localStorage.clear()`.
 */
export const KNOWN_LOCAL_STORAGE_KEYS = [
  // Store 1 — 3D World Saves & Legacy Save Keys
  'citadel_saves_index',
  `citadel_save_${CANONICAL_SLOT_ID}`,
  'citadel_data',
  'citadel_identity',
  // Store 2 — Canonical Citadel Store (v2)
  'citadel-v2-state',
  // Store 3 — 3D Mindmap Store
  'mindmap-v1',
  // Store 4 — User & Sigma Settings
  'citadel_custom_settings',
  // Store 5 — Sigma / Termite Chat Logs
  'citadel_sigma_chat_session',
  'citadel_sigma_chat_archives',
  // Store 6 — Synaptic Calibration & Governance
  'citadel_synaptic_core_calibration_v1',
  'citadel_synaptic_core_responses_v1',
  'citadel_synaptic_ipc_responses_v1',
  'citadel_synaptic_nine_responses_v1',
  'citadel_synaptic_governance_seen_v1',
  // Retired Soundscape preferences; clear them for existing installs.
  'citadel.soundscape.safetySeen.v1',
  'citadel.soundscape.headphoneCheckSeen.v1',
  'citadel.tarot.history',
  // Store 8 — Visual & Quality Prefs
  'citadel.qualityTier',
  'citadel.visuals.next',
  'citadel.visuals.sky',
  'citadel.visuals.altar',
  'citadel.visuals.rain',
  'citadel.visuals.termiteFont',
] as const;

export const KNOWN_SESSION_STORAGE_KEYS = [
  'citadel.rebuilt.autoRecoverV1',
] as const;

/**
 * Build a complete JSON snapshot of all current user data before wiping so the
 * user can save a backup file if desired.
 */
export async function exportPreWipeBackup(): Promise<string> {
  const worldState = useWorldStore.getState();
  const canonicalState = useCanonicalStore.getState().state;
  const mindmapState = useMindmap.getState();

  const localSnapshot: Record<string, string | null> = {};
  if (typeof localStorage !== 'undefined') {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k) localSnapshot[k] = localStorage.getItem(k);
    }
  }

  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      kind: 'citadel-pre-wipe-backup-v1',
      world: {
        chambers: worldState.chambers,
        identity: worldState.identity,
      },
      canonical: canonicalState,
      mindmap: {
        nodes: mindmapState.nodes,
        edges: mindmapState.edges,
        order: mindmapState.order,
        activeMapId: mindmapState.activeMapId,
        maps: mindmapState.maps,
        stash: mindmapState.stash,
      },
      localStorage: localSnapshot,
    },
    null,
    2,
  );
}

/**
 * Trigger a browser download of the pre-wipe backup JSON.
 */
export async function downloadPreWipeBackup(): Promise<void> {
  const json = await exportPreWipeBackup();
  if (typeof document === 'undefined' || typeof Blob === 'undefined') return;
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const stamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
  a.href = url;
  a.download = `citadel-pre-wipe-backup-${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Execute an irreversible, universal full wipe of all user data across:
 * 1. Pending debounced world saves (`usePersistence`)
 * 2. Tauri Native (`app_data_dir`: `journal.log`, `citadel-profile.json`,
 *    `migration_receipt.json`, `legacy_storage_backup/`, `citadel-state.json`,
 *    `state.json`, `citadel_graph/`, `semantic_index/index.json`,
 *    `sync/known_devices.json`, `quarantine/`)
 * 3. Portable Mode (`citadel-runtime/world/`, `citadel-runtime/prefs/`)
 * 4. Browser IndexedDB (`idb-keyval`: `citadel_saves_index`, `citadel_save_*`)
 * 5. Browser `localStorage` & `sessionStorage` (all 9 store categories)
 * 6. In-memory Zustand stores (`mindmap3d`, `citadelStore`, `arboretum/store`)
 */
export async function executeCitadelFullWipe(): Promise<WipeReceipt> {
  advanceWipeEpoch();
  const clearedStores: string[] = [];
  const survivors: string[] = [];
  const unreachableStores: string[] = [];
  let sandboxNotice: string | undefined;
  let vaultStorageSuspended = false;
  let vaultStorageResumed = false;

  if (isTauri()) {
    try {
      await suspendTauriVaultStorage(true);
      vaultStorageSuspended = true;
    } catch (error) {
      vaultStorageSuspended = true;
      survivors.push(`tauri:webview-storage-flush-failed:${String(error)}`);
    }
  }

  // Count existing entries before clearing for the audit dossier
  const priorCanonical = useCanonicalStore.getState().state;
  const canonicalCount = Object.values(priorCanonical.days).reduce(
    (sum, d) => sum + (d.entries?.length ?? 0),
    0,
  );
  const priorWorld = useWorldStore.getState();
  const worldCount = Object.values(priorWorld.chambers)
    .filter((c) => c.template === 'day')
    .reduce((sum, c) => sum + (c.thoughts?.length ?? 0), 0);
  const deletedEntriesCount = Math.max(canonicalCount, worldCount);

  // Stop any in-flight 800ms debounced save timer first
  cancelPendingWorldSaves();
  cancelPendingMindmapSave();

  // Reset all debug overrides so foliage and village snap back to pure reality on wipe
  resetFoliageDebugOverrides();
  resetVillageDebugOverrides();

  // Trigger real-time visual dissolution of the digital foliage canopy
  useFoliageDebugStore.getState().triggerDissolution();

  // 2. Wipe Tauri Native stores if running in Tauri
  if (isTauri()) {
    let nativeWipeFailed = false;
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const report = await invoke<NativeWipeReport>('citadel_full_wipe');
      if (report?.clearedPaths) {
        clearedStores.push(...report.clearedPaths);
      }
      if (report?.survivors?.length) {
        survivors.push(...report.survivors);
        nativeWipeFailed = true;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[Citadel Wipe] Native wipe invocation failed:', err);
      survivors.push(`tauri:native_wipe_error: ${msg}`);
      nativeWipeFailed = true;
    }
    if (nativeWipeFailed && vaultStorageSuspended) {
      try {
        await resumeTauriVaultStorage();
        vaultStorageResumed = true;
      } catch (resumeError) {
        survivors.push(`tauri:webview-storage-reopen-failed:${String(resumeError)}`);
      }
    }
  } else {
    // Honest Sandbox Reporting: browser environment cannot delete native OS files
    const NATIVE_STORE_PATHS = [
      'tauri:app_data/journal.log',
      'tauri:app_data/journal.head',
      'tauri:app_data/citadel-profile.json',
      'tauri:app_data/migration_receipt.json',
      'tauri:app_data/legacy_storage_backup/',
      'tauri:app_data/citadel-state.json',
      'tauri:app_data/state.json',
      'tauri:app_data/citadel_graph/',
      'tauri:app_data/citadel_graph.enc',
      'tauri:app_data/models/generative/',
      'tauri:app_data/semantic_index/index.json',
      'tauri:app_data/sync/known_devices.json',
      'tauri:app_data/sync/trusted_authors.json',
      'tauri:app_data/sync/noise_x25519.keypair (must rotate)',
      'tauri:app_data/quarantine/',
      'tauri:app_data/webview_storage.json',
    ];
    unreachableStores.push(...NATIVE_STORE_PATHS);
    sandboxNotice =
      'Browser sandbox cannot access macOS Application Support disk storage. Launch the native Citadel.app desktop application to purge OS-level journal.log and graph stores.';
  }

  // 3. Wipe Portable Mode + IndexedDB World Saves
  survivors.push(...await clearAllWorldSaveData());

  // 4. Wipe Portable Prefs
  survivors.push(...await clearPortablePrefs());

  // 5. Reset 3D Mindmap store first (its persist middleware writes to localStorage on set)
  useMindmap.getState().reset();
  try {
    useMindmap.persist?.clearStorage?.();
  } catch (error) {
    survivors.push(`localStorage:mindmap-v1:clear-failed:${String(error)}`);
  }
  clearedStores.push('memory:mindmap3d');

  // 6. Sweep and clear all localStorage keys
  if (typeof localStorage !== 'undefined') {
    for (const key of KNOWN_LOCAL_STORAGE_KEYS) {
      try {
        localStorage.removeItem(key);
        clearedStores.push(`localStorage:${key}`);
      } catch (error) {
        survivors.push(`localStorage:${key}:delete-failed:${String(error)}`);
      }
    }
    try {
      const dynamicKeys: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k) dynamicKeys.push(k);
      }
      for (const k of dynamicKeys) {
        try {
          localStorage.removeItem(k);
          if (!clearedStores.includes(`localStorage:${k}`)) {
            clearedStores.push(`localStorage:${k}`);
          }
        } catch (error) {
          survivors.push(`localStorage:${k}:delete-failed:${String(error)}`);
        }
      }
    } catch (error) {
      survivors.push(`localStorage:enumeration-failed:${String(error)}`);
    }
    try {
      localStorage.clear();
    } catch (error) {
      survivors.push(`localStorage:clear-failed:${String(error)}`);
    }
  }

  // 7. Sweep and clear all sessionStorage keys
  if (typeof sessionStorage !== 'undefined') {
    for (const key of KNOWN_SESSION_STORAGE_KEYS) {
      try {
        sessionStorage.removeItem(key);
        clearedStores.push(`sessionStorage:${key}`);
      } catch (error) {
        survivors.push(`sessionStorage:${key}:delete-failed:${String(error)}`);
      }
    }
    try {
      sessionStorage.clear();
    } catch (error) {
      survivors.push(`sessionStorage:clear-failed:${String(error)}`);
    }
  }

  // 8. Reset Canonical Citadel Store in memory (without writing back to localStorage/disk)
  useCanonicalStore.getState().wipeAllInMemory();
  clearedStores.push('memory:citadelStore');

  // 9. Reset 3D World Store (`arboretum/components/citadel-rebuilt/store.ts`) to fresh first-run state
  const { chambers: freshChambers } = syncSigmaEngineChambers({});
  const freshIdentity = withIdentityDefaults({
    name: 'Traveler',
    createdAt: new Date().toISOString(),
    sessionStart: Date.now(),
  });
  recordWipedWorldSnapshot(freshChambers, freshIdentity);

  const worldStore = useWorldStore.getState();
  worldStore.setChambers(freshChambers, true);
  worldStore.setIdentity(freshIdentity);
  worldStore.setCurrentChamberId(0);
  worldStore.setModalOpen(false);
  clearedStores.push('memory:worldStore');

  // 10. Post-wipe verification check for any survivors
  if (typeof localStorage !== 'undefined') {
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k) survivors.push(`localStorage:${k}`);
      }
    } catch (error) {
      survivors.push(`localStorage:post-wipe-query-failed:${String(error)}`);
    }
  }
  if (typeof sessionStorage !== 'undefined') {
    try {
      for (let i = 0; i < sessionStorage.length; i++) {
        const k = sessionStorage.key(i);
        if (k) survivors.push(`sessionStorage:${k}`);
      }
    } catch (error) {
      survivors.push(`sessionStorage:post-wipe-query-failed:${String(error)}`);
    }
  }
  let idbPostWipeVerified = false;
  try {
    const remainingIdb = await idbKeys();
    for (const k of remainingIdb) {
      survivors.push(`idb:${String(k)}`);
    }
    idbPostWipeVerified = remainingIdb.length === 0;
  } catch (error) {
    survivors.push(`idb:post-wipe-query-failed:${String(error)}`);
  }

  if (idbPostWipeVerified && !survivors.some(survivor => survivor.startsWith('idb:'))) {
    clearedStores.push('idb:citadel_saves_index', `idb:citadel_save_${CANONICAL_SLOT_ID}`);
  }
  try {
    if (await isPortableModeEnabled() && !survivors.some(survivor => survivor.startsWith('portable:'))) {
      clearedStores.push(
        'portable:citadel-runtime/world/save-index.json',
        `portable:citadel-runtime/world/saves/${CANONICAL_SLOT_ID}.json`,
        'portable:citadel-runtime/prefs/browser-prefs.json',
      );
    }
  } catch (error) {
    survivors.push(`portable:post-wipe-query-failed:${String(error)}`);
  }

  const canonicalAfter = useCanonicalStore.getState().state;
  const remainingCanonicalEntries = Object.values(canonicalAfter.days).reduce(
    (sum, d) => sum + d.entries.length,
    0,
  );
  if (remainingCanonicalEntries > 0) {
    survivors.push(`memory:citadelStore(entries=${remainingCanonicalEntries})`);
  }

  const worldAfter = useWorldStore.getState();
  const remainingDayThoughts = Object.values(worldAfter.chambers)
    .filter(c => c.template === 'day')
    .reduce((sum, c) => sum + c.thoughts.length, 0);
  if (remainingDayThoughts > 0) {
    survivors.push(`memory:worldStore(dayThoughts=${remainingDayThoughts})`);
  }

  if (vaultStorageSuspended && !vaultStorageResumed) {
    try {
      await resumeTauriVaultStorage();
    } catch (error) {
      survivors.push(`tauri:webview-storage-reopen-failed:${String(error)}`);
    }
  }

  const receipt: WipeReceipt = {
    timestamp: new Date().toISOString(),
    clearedStores,
    survivors,
    unreachableStores,
    sandboxNotice,
    deletedEntriesCount,
  };

  useFoliageDebugStore.getState().openDossier(receipt);

  try {
    if (typeof window !== 'undefined') {
      (window as unknown as { __citadelLastWipeReceipt?: WipeReceipt }).__citadelLastWipeReceipt = receipt;
    }
  } catch {
    // Window may have restricted accessors
  }
  console.info('[Citadel Wipe] Full wipe complete:', receipt);

  return receipt;
}
