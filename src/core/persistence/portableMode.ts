import { invoke } from '@tauri-apps/api/core';

type PortableModeInfo = {
  enabled: boolean;
  rootDir: string | null;
};

const DISABLED_INFO: PortableModeInfo = { enabled: false, rootDir: null };

let portableInfoPromise: Promise<PortableModeInfo> | null = null;

function normalizeInfo(value: { enabled?: boolean; root_dir?: string | null } | null | undefined): PortableModeInfo {
  if (!value?.enabled) return DISABLED_INFO;
  return {
    enabled: true,
    rootDir: value.root_dir ?? null,
  };
}

export function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

export async function getPortableModeInfo(): Promise<PortableModeInfo> {
  if (!isTauriRuntime()) return DISABLED_INFO;
  if (!portableInfoPromise) {
    portableInfoPromise = invoke<{ enabled?: boolean; root_dir?: string | null }>('portable_mode_info')
      .then(normalizeInfo)
      .catch((err) => {
        console.warn('[citadel] portable mode lookup failed:', err);
        return DISABLED_INFO;
      });
  }
  return portableInfoPromise;
}

export async function isPortableModeEnabled(): Promise<boolean> {
  const info = await getPortableModeInfo();
  return info.enabled;
}

export async function portableReadText(relativePath: string): Promise<string | null> {
  const info = await getPortableModeInfo();
  if (!info.enabled) return null;
  try {
    return await invoke<string | null>('portable_read_text', { relativePath });
  } catch (err) {
    console.warn('[citadel] portable read failed:', err);
    return null;
  }
}

export async function portableWriteText(relativePath: string, contents: string): Promise<boolean> {
  const info = await getPortableModeInfo();
  if (!info.enabled) return false;
  try {
    await invoke('portable_write_text', { relativePath, contents });
    return true;
  } catch (err) {
    console.warn('[citadel] portable write failed:', err);
    return false;
  }
}

export async function portableWriteBytes(relativePath: string, bytes: Uint8Array): Promise<boolean> {
  const info = await getPortableModeInfo();
  if (!info.enabled) return false;
  try {
    await invoke('portable_write_bytes', { relativePath, bytes: Array.from(bytes) });
    return true;
  } catch (err) {
    console.warn('[citadel] portable byte write failed:', err);
    return false;
  }
}

export async function portableRemoveFile(relativePath: string): Promise<boolean> {
  const info = await getPortableModeInfo();
  if (!info.enabled) return false;
  try {
    await invoke('portable_remove_file', { relativePath });
    return true;
  } catch (err) {
    console.warn('[citadel] portable remove failed:', err);
    return false;
  }
}