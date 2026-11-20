/**
 * Master + per-subsystem kill switches for the visual brand upgrade.
 *
 * Semantics are deliberately strict to avoid ambiguous ternary reads:
 *
 *   master       = localStorage['citadel.visuals.next']       === '1'
 *   sky          = master && localStorage['citadel.visuals.sky']         !== '0'
 *   altar        = master && localStorage['citadel.visuals.altar']       !== '0'
 *   rain         = master && localStorage['citadel.visuals.rain']        !== '0'
 *   termiteFont  = master && localStorage['citadel.visuals.termiteFont'] !== '0'
 *
 * In short: the master switch opts the user in to the new visuals;
 * individual subsystems are on by default once opted in, and only a literal
 * '0' turns a subsystem off for triage. Unset / '1' / anything-else-truthy
 * means "enabled when master is on." This keeps the dev console path simple:
 *
 *   // turn the whole thing on
 *   localStorage.setItem('citadel.visuals.next', '1');
 *
 *   // disable the sky shader while keeping the rest
 *   localStorage.setItem('citadel.visuals.sky', '0');
 *
 *   // opt back into everything
 *   localStorage.removeItem('citadel.visuals.sky');
 *
 * Reads are defensive: if localStorage is unavailable (SSR, sandbox-denied),
 * every flag reports false. That is the safe default.
 */

import { readPortablePref } from '@/core/persistence/portablePrefs';

export type VisualSubsystem = 'sky' | 'altar' | 'rain' | 'termiteFont';

const MASTER_KEY = 'citadel.visuals.next';
const SUBSYSTEM_KEY = (s: VisualSubsystem): string => `citadel.visuals.${s}`;

function safeRead(key: string): string | null {
  return readPortablePref(key);
}

export function visualsNextEnabled(): boolean {
  return safeRead(MASTER_KEY) === '1';
}

export function subsystemEnabled(s: VisualSubsystem): boolean {
  if (!visualsNextEnabled()) return false;
  return safeRead(SUBSYSTEM_KEY(s)) !== '0';
}

export interface VisualFlags {
  master: boolean;
  sky: boolean;
  altar: boolean;
  rain: boolean;
  termiteFont: boolean;
}

/**
 * Snapshot every flag once. Consumers should call this at mount time and
 * treat the result as immutable for the lifetime of the mount — flag changes
 * require a reload, which is consistent with how QualityTier is consumed.
 * Cycle tests (verification v2) deliberately reload the app between toggles.
 */
export function visualFlags(): VisualFlags {
  const master = visualsNextEnabled();
  return {
    master,
    sky: master && safeRead(SUBSYSTEM_KEY('sky')) !== '0',
    altar: master && safeRead(SUBSYSTEM_KEY('altar')) !== '0',
    rain: master && safeRead(SUBSYSTEM_KEY('rain')) !== '0',
    termiteFont: master && safeRead(SUBSYSTEM_KEY('termiteFont')) !== '0',
  };
}
