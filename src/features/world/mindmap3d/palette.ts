// Mindmap chamber palette — neon wireframe on an indigo void.
// A curated neon family (cyan, magenta and gold anchor it). Glow is a reward for focus, never wallpaper.

export const VOID = "#06050d";
export const INK = "#e9e6ff";

type Rgb = readonly [number, number, number];

const rgbOf = (hex: string): Rgb => {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};

const accent = (hex: string, hue: number) => ({ hex, rgb: rgbOf(hex), hue });

export const ACCENTS = {
  coral: accent("#ff6b6b", 8),
  gold: accent("#ffc95c", 45),
  lime: accent("#b6f24a", 95),
  emerald: accent("#4dffa0", 150),
  cyan: accent("#3ff0ff", 185),
  azure: accent("#5aa9ff", 215),
  violet: accent("#a78bfa", 265),
  magenta: accent("#ff4fd8", 315),
  rose: accent("#ff7ab8", 345),
} as const;

/** Accepts only #rrggbb so a stored or imported value can never inject anything odd into styles. */
export const isHexColor = (v: unknown): v is string => typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v);

/** A node's display color: its custom color (any hex from the color wheel) or the accent nearest its hue. */
export function resolveNodeColor(node: { hue: number; color?: string }): { hex: string; rgb: Rgb } {
  if (isHexColor(node.color)) return { hex: node.color.toLowerCase(), rgb: rgbOf(node.color) };
  return ACCENTS[accentForHue(node.hue)];
}

export type AccentName = keyof typeof ACCENTS;

/** Map any stored hue (0–360) onto the nearest accent family. Schema keeps raw hue. */
export function accentForHue(hue: number): AccentName {
  const h = ((hue % 360) + 360) % 360;
  let best: AccentName = "cyan";
  let bestD = Infinity;
  for (const name of Object.keys(ACCENTS) as AccentName[]) {
    const d = Math.min(Math.abs(h - ACCENTS[name].hue), 360 - Math.abs(h - ACCENTS[name].hue));
    if (d < bestD) {
      bestD = d;
      best = name;
    }
  }
  return best;
}

/** Intensity grammar (0–1) — resting floor raised, hard-dim rule revoked. */
export const INTENSITY = {
  rest: 0.82,
  root: 0.95,
  starred: 0.90,
  hover: 1.0,
  selected: 1.0,
  neighbor: 0.96,
  dimmed: 0.58,
} as const;

/** Declutter: roughly how many nodes the default view shows before folding deeper levels. */
export const VISIBLE_BUDGET = 90;
