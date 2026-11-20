/**
 * Build-time / env switches for alternate Citadel shells.
 *
 * **Citadel Micro** (`VITE_CITADEL_MICRO=1`): “Will it run DOOM?” mode —
 * lazy-loads a wireframe catacomb instead of the full `RebuiltWorld` (~2.3k
 * lines of shaders, instancing, fauna, etc.). Gameplay hooks (movement,
 * portals, Sigma / customize proximity) stay wired so the save
 * format and rituals still work.
 *
 * Enable: `VITE_CITADEL_MICRO=1 npm run build` or add to `.env.local`.
 */
export function isCitadelMicro(): boolean {
  try {
    const meta = import.meta as ImportMeta & { env?: Record<string, string | undefined> };
    const v = meta.env?.VITE_CITADEL_MICRO;
    return v === '1' || v === 'true' || v === 'yes';
  } catch {
    return false;
  }
}
