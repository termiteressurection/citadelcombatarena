import React, { type ReactNode } from 'react';

/**
 * Termitesse Glitch Engine
 * 
 * Refined Corruption Rules:
 * 1. Every word with 4 or more letters has at least one letter in the middle of
 *    its body replaced with a character from the custom Termitesse font ('A'-'Z').
 * 2. Words with fewer than 4 letters (e.g. 'I', 'we', 'the', 'and') remain untouched.
 * 3. Word boundaries (the first and last letter) remain intact to preserve reading
 *    silhouette and cognitive recognition while alien glyphs pulse in the word's core.
 */

export const TERMITESSE_GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export function corruptWord(word: string, densityScore?: number): string {
  if (word.length < 4) return word;

  const first = word[0];
  const last = word[word.length - 1];
  const middleChars = word.slice(1, -1).toLowerCase().split('');
  const midLen = middleChars.length;

  // Pick at least 1 middle index strictly within the body
  const midIndex = Math.floor(Math.random() * midLen);
  const glyph = TERMITESSE_GLYPHS[Math.floor(Math.random() * TERMITESSE_GLYPHS.length)];
  middleChars[midIndex] = glyph;

  // For long words (length >= 8) or high corruption (densityScore < 0.3), optionally corrupt a 2nd middle letter
  const shouldDouble = (densityScore !== undefined && densityScore < 0.3 && word.length >= 7) || (word.length >= 9 && Math.random() > 0.4);
  if (shouldDouble && midLen >= 3) {
    let secondMid = Math.floor(Math.random() * midLen);
    if (secondMid === midIndex) {
      secondMid = secondMid === midLen - 1 ? midIndex - 1 : secondMid + 1;
    }
    const secondGlyph = TERMITESSE_GLYPHS[Math.floor(Math.random() * TERMITESSE_GLYPHS.length)];
    middleChars[secondMid] = secondGlyph;
  }

  return first + middleChars.join('') + last;
}

/**
 * Applies Termitesse speech corruption to English text.
 */
export function applyTermiteseGlitch(text: string, densityScore: number = 0.5): string {
  if (!text) return text;
  return text.replace(/\b([a-zA-Z]{4,})\b/g, (match) => corruptWord(match, densityScore));
}

/**
 * Renders text containing Termitesse corrupted glyphs into React elements,
 * wrapping the Termitesse characters in dedicated styled spans using the custom Termitesse font.
 */
export function renderTermiteseText(
  text: string,
  options?: { runicClass?: string; customStyle?: React.CSSProperties }
): ReactNode {
  if (!text) return text;

  const wordRegex = /\b([a-zA-Z]{4,})\b/g;
  let lastIndex = 0;
  const nodes: ReactNode[] = [];
  let match: RegExpExecArray | null;

  while ((match = wordRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }

    const word = match[1];
    const first = word[0];
    const last = word[word.length - 1];
    const middle = word.slice(1, -1);

    // Look for uppercase glyphs in the middle of the word
    const midRegex = /[A-Z]+/g;
    let midLast = 0;
    let midMatch: RegExpExecArray | null;

    nodes.push(first);

    let hasGlyph = false;
    while ((midMatch = midRegex.exec(middle)) !== null) {
      hasGlyph = true;
      if (midMatch.index > midLast) {
        nodes.push(middle.slice(midLast, midMatch.index));
      }
      nodes.push(
        <span
          key={`termite-glyph-${match.index}-${midMatch.index}`}
          className={options?.runicClass ?? 'termite-runic'}
          style={{
            fontFamily: 'Termitesse, "IBM Plex Mono", monospace',
            display: 'inline',
            letterSpacing: '0.04em',
            ...options?.customStyle,
          }}
        >
          {midMatch[0]}
        </span>
      );
      midLast = midRegex.lastIndex;
    }

    if (hasGlyph) {
      if (midLast < middle.length) {
        nodes.push(middle.slice(midLast));
      }
    } else {
      nodes.push(middle);
    }

    nodes.push(last);
    lastIndex = wordRegex.lastIndex;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes;
}
