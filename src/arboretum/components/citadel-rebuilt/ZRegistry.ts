/**
 * THE_CITADEL Z-INDEX REGISTRY
 *
 * Central authority for UI layering. Avoid using raw z-index literals.
 * Higher numbers = closer to the player's eyes.
 */
export const Z = {
  // WORLD LAYER
  BASE_WORLD: 0,
  PS1_BEZEL: 4,
  CRT_OVERLAY: 5,

  // HUD LAYER
  SCENE_HUD: 90,
  HUD_ELEVATED: 100,

  // INTERFACE LAYER
  TERMINAL: 100,
  MAIN_MENU: 110,

  // FEATURE LAYER
  FEATURE_MODAL: 400,
  BOOKMARKS_MODAL: 350,
  CALENDAR_EYE: 420,
  DAILY_GATE: 460,

  // TRANSIENT FEEDBACK
  TRANSITION_WIPE: 500,
  CENTER_TOAST: 600,
  FLASH_OVERLAY: 700,

  // CRITICAL LAYER
  RESET_CONFIRM: 300,
  CRITICAL_MODAL: 1000,
  SCREEN_LOADER: 2000,

  // SYSTEM LAYER
  DEV_OVERLAY: 9999,
} as const;

export type ZLayer = typeof Z[keyof typeof Z];
