import {
  getPortableModeInfo,
  isPortableModeEnabled,
  portableReadText,
  portableRemoveFile,
  portableWriteText,
} from './portableMode';

const PREFS_PATH = 'citadel-runtime/prefs/browser-prefs.json';

type PortablePrefs = Record<string, string>;

const prefsCache: PortablePrefs = {};
let portablePrefsEnabled = false;
let bootstrapPromise: Promise<void> | null = null;

function parsePrefs(raw: string | null): PortablePrefs {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as PortablePrefs;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

async function flushPrefs(): Promise<void> {
  if (!portablePrefsEnabled) return;
  await portableWriteText(PREFS_PATH, JSON.stringify(prefsCache, null, 2));
}

export async function bootstrapPortablePrefs(): Promise<void> {
  if (!bootstrapPromise) {
    bootstrapPromise = (async () => {
      const info = await getPortableModeInfo();
      portablePrefsEnabled = info.enabled;
      if (!portablePrefsEnabled) return;

      const parsed = parsePrefs(await portableReadText(PREFS_PATH));
      for (const [key, value] of Object.entries(parsed)) {
        prefsCache[key] = value;
      }
    })();
  }
  return bootstrapPromise;
}

export function readPortablePref(key: string): string | null {
  if (portablePrefsEnabled) {
    return Object.prototype.hasOwnProperty.call(prefsCache, key) ? prefsCache[key] : null;
  }

  try {
    return typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
  } catch {
    return null;
  }
}

export function writePortablePref(key: string, value: string | null): void {
  if (portablePrefsEnabled) {
    if (value == null) delete prefsCache[key];
    else prefsCache[key] = value;
    void flushPrefs();
    return;
  }

  try {
    if (typeof localStorage === 'undefined') return;
    if (value == null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // Ignore denied or unavailable browser storage.
  }
}

export async function clearPortablePrefs(): Promise<string[]> {
  for (const key of Object.keys(prefsCache)) {
    delete prefsCache[key];
  }
  try {
    if (await isPortableModeEnabled()) {
      if (!(await portableRemoveFile(PREFS_PATH))) return [`portable:${PREFS_PATH}:delete-failed`];
    }
  } catch (error) {
    return [`portable:${PREFS_PATH}:query-or-delete-failed:${String(error)}`];
  }
  return [];
}
