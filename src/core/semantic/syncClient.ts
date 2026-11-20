import { invoke } from '@tauri-apps/api/core';

export interface KnownDevice {
  identityPubkey: string;
  noiseStaticPubkey: string;
  label?: string;
}

export interface LocalDeviceCard {
  identityPubkey: string;
  noiseStaticPubkey: string;
}

export interface BundleExportResult {
  filePath: string;
  eventCount: number;
  merkleRoot: string;
  checksum: string;
}

export interface SyncReport {
  localEventCount: number;
  peerEventCount: number;
  localMerkleRoot: string;
  peerMerkleRoot: string;
  received: number;
  duplicates: number;
  quarantined: number;
  converged: boolean;
}

export const isTauri = (): boolean =>
  typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

export async function syncLocalIdentity(): Promise<LocalDeviceCard> {
  if (!isTauri()) throw new Error('Device identity requires the Tauri desktop runtime.');
  return invoke<LocalDeviceCard>('sync_local_identity');
}

export async function syncKnownDevices(): Promise<KnownDevice[]> {
  if (!isTauri()) throw new Error('Device sync requires the Tauri desktop runtime.');
  return invoke<KnownDevice[]>('sync_known_devices');
}

export async function syncPinKnownDevice(
  identityPubkey: string,
  noiseStaticPubkey: string,
): Promise<KnownDevice[]> {
  if (!isTauri()) throw new Error('Device sync requires the Tauri desktop runtime.');
  return invoke<KnownDevice[]>('sync_pin_known_device', {
    identityPubkey,
    noiseStaticPubkey,
  });
}

export async function syncRevokeKnownDevice(
  identityPubkey: string,
): Promise<KnownDevice[]> {
  if (!isTauri()) throw new Error('Device sync requires the Tauri desktop runtime.');
  return invoke<KnownDevice[]>('sync_revoke_known_device', {
    identityPubkey,
  });
}

export async function syncDeriveConfirmationPhrase(
  peerPubkey: string,
): Promise<string> {
  if (!isTauri()) throw new Error('Device pairing requires the Tauri desktop runtime.');
  return invoke<string>('sync_derive_confirmation_phrase', {
    peerPubkey,
  });
}

export async function syncExportStoneBundle(
  destinationPath?: string,
): Promise<BundleExportResult> {
  if (!isTauri()) throw new Error('Device sync export requires the Tauri desktop runtime.');
  return invoke<BundleExportResult>('sync_export_stone_bundle', {
    destinationPath,
  });
}

export async function syncImportStoneBundle(
  bundlePath: string,
): Promise<SyncReport> {
  if (!isTauri()) throw new Error('Device sync import requires the Tauri desktop runtime.');
  return invoke<SyncReport>('sync_import_stone_bundle', {
    bundlePath,
  });
}

export async function syncConnect(address: string): Promise<SyncReport> {
  if (!isTauri()) {
    throw new Error('Sync connection requires Tauri desktop runtime');
  }
  return invoke<SyncReport>('sync_connect', { address });
}

export async function syncAcceptOnce(bindAddress: string): Promise<SyncReport> {
  if (!isTauri()) {
    throw new Error('Sync listener requires Tauri desktop runtime');
  }
  return invoke<SyncReport>('sync_accept_once', { bindAddress });
}
