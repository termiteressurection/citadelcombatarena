import type {
  GridIdentity,
  CalibrationState,
  AltarState,
  CombatSignature,
} from './types';

const DEFAULT_CALIBRATION: CalibrationState = {
  status: 'none',
  consentSigmaPersonalization: false,
  mbtiScores: {},
  mbtiConfidence: 0,
};

const DEFAULT_ALTAR: AltarState = {
  stabilization: 0,
  toolsUnlocked: 0,
  stage: 'wireframe',
};

const DEFAULT_COMBAT: CombatSignature = {
  equationId: 'sword_default',
  params: {},
};

/**
 * Merges Root-Chamber contract fields onto identity loaded from disk so older
 * saves (without these keys) behave as first-class
 * citizens without one-off `?.` sprawl everywhere.
 */
export function withIdentityDefaults(identity: GridIdentity): GridIdentity {
  const cs = identity.combatSignature;
  return {
    corruption: 100.0,
    sessionCount: 0,
    ...identity,
    calibration: { ...DEFAULT_CALIBRATION, ...identity.calibration },
    altar: { ...DEFAULT_ALTAR, ...identity.altar },
    combatSignature: {
      ...DEFAULT_COMBAT,
      ...cs,
      params: { ...DEFAULT_COMBAT.params, ...cs?.params },
    },
  };
}
