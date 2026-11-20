/**
 * scrambleText — Termitesse (.termite-runic) token highlights for Sigma (Ares) only.
 * Termite NPC dialogue does not use this (VT323 only). Matrix rain uses a separate canvas.
 *
 * Termitesse is a display layer, not a natural language. This does not turn
 * the line into (or from) “English”; it re-styles selected tokens in the
 * runic class while preserving the same underlying string.
 *
 * Takes a plain string and returns a JSX fragment that wraps ~15% of word
 * tokens in a `.termite-runic` span. The selection is DETERMINISTIC per
 * input string (FNV-1a seeded LCG), so the same reply always scrambles the
 * same way — no animated glitch, no inter-user divergence. This matches v6's
 * "consistent across tiers, narrative-driven" decision: the scramble is part
 * of the content, not a frame-by-frame effect.
 *
 * Tier only controls STYLING via CSS (see `.termite-runic`). The scramble
 * RATE is fixed; tier-gated cost is in the spans' text-shadow / animation.
 *
 * Kill switch: mount this via the visual flags check below. When disabled,
 * returns the plain string unchanged. Safe to call on every render.
 */

import type { ReactNode } from 'react';
import { visualFlags } from './visualFlags';

const TARGET_RATIO = 0.15;
// Require a token be at least this long to scramble. Dropping 1–2 letter
// glue words (a, of, to) keeps the scramble from disrupting readability.
const MIN_TOKEN_LEN = 3;

function hashString(s: string): number {
  // FNV-1a 32-bit.
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function lcgNext(state: number): number {
  // Numerical Recipes constants, 32-bit.
  return (Math.imul(state, 1664525) + 1013904223) >>> 0;
}

export function scrambleText(text: string): ReactNode {
  const flags = visualFlags();
  if (!flags.master || !flags.termiteFont) return text;

  // Split into word/non-word tokens so whitespace and punctuation stay intact.
  const tokens = text.split(/(\s+)/);
  let state = hashString(text);

  const nodes: ReactNode[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];
    if (!tok) continue;
    const isWord = /\w/.test(tok);
    if (!isWord || tok.length < MIN_TOKEN_LEN) {
      nodes.push(tok);
      continue;
    }
    state = lcgNext(state);
    const r = state / 0xffffffff;
    if (r < TARGET_RATIO) {
      nodes.push(
        <span key={i} className="termite-runic">{tok}</span>,
      );
    } else {
      nodes.push(tok);
    }
  }
  return <>{nodes}</>;
}
