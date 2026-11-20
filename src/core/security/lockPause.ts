export const SUSPEND_LOCK_GAP_MS = 5_000;

export function requiresVaultLockAfterPause(_lastCheckAt: number, _now: number): boolean {
  return false;
}
