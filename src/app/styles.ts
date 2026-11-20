// Design tokens — single source of truth for the notebook UI
export const tokens = {
  // Colors
  bg: 'transparent', // allow system vibrancy
  appBg: 'var(--citadel-app-bg)', // actual content background
  surface: 'var(--citadel-surface)',
  surfaceHover: '#1e1e1e',
  border: 'var(--citadel-border)',
  borderFocus: '#555',
  text: '#e8e8e8',
  textMuted: '#666',
  textDim: '#444',
  accent: 'var(--citadel-accent)',       // today / active
  accentDim: 'var(--citadel-accent-dim)',
  morning: '#f0c060',
  midday: '#60c0f0',
  reflect: '#c060f0',
  commune: '#60f0a0',
  locked: '#3a3a3a',
  danger: '#e05050',

  // Spacing (Golden Ratio: 1.618)
  gapXs: 6,
  gapSm: 10,
  gap: 16,
  gapLg: 26,
  gapXl: 42,
  radius: 4,
  radiusLg: 8,

  // Typography
  fontMono: '"JetBrains Mono", "Fira Mono", monospace',
  fontSans: '"Inter", system-ui, sans-serif',
  fontSizeXs: 11,
  fontSizeSm: 13,
  fontSizeBase: 13, // Enforced 13px baseline
  fontSizeLg: 21,
  fontSizeXl: 34,
} as const;

export type Tokens = typeof tokens;
