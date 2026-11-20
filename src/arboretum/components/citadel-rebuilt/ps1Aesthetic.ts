import { isCitadelMicro } from './citadelBuildMode';

/**
 * PlayStation-era presentation: chunky internal resolution, pixel scaling,
 * heavier fog, boosted CRT. Enabled when:
 *   - `VITE_CITADEL_PS1=1` (or `true`), or
 *   - Catacombs mode (`VITE_CITADEL_MICRO`) — micro build is always PS1-flavored.
 */
export function isPs1Visuals(): boolean {
  if (isCitadelMicro()) return true;
  try {
    const meta = import.meta as ImportMeta & { env?: Record<string, string | undefined> };
    const v = meta.env?.VITE_CITADEL_PS1;
    return v === '1' || v === 'true' || v === 'yes';
  } catch {
    return false;
  }
}
