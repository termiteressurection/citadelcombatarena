/**
 * Canonical UI stacking (numeric z-index). Prefer `style={{ zIndex: UI_LAYER.x }}`
 * on fixed/fullscreen shells so layers stay ordered when adding new overlays.
 *
 * Tier order (low → high): world chrome → terminal → scene HUD → map →
 * daily flows → rare full-screen gates → ephemeral toasts.
 */
export const UI_LAYER = {
  hud: 90,
  /** Chamber terminal dialog */
  terminal: 100,
  /** In-world scene HUD / pause-style panels */
  sceneHud: 100,
  sceneHudElevated: 150,
  sceneModal: 200,
  /** Constellation + mind-map reuse */
  constellationMap: 400,
  bookmarksModal: 350,
  transitionWipe: 500,
  centerToast: 600,
  /** Daily writing surfaces */
  /** Hard gate before play */
  dailyAnchorGate: 460,
} as const;

export type UILayerKey = keyof typeof UI_LAYER;
