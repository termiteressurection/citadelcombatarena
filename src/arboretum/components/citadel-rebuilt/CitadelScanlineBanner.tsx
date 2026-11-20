import React from 'react';

// Character positions matching the user's uploaded banner:
// [ T H E _ C I T A D E L ]
// Behind each letter is a vertical column of Termitese runes / glyphs
const GLYPH_COLUMNS: string[][] = [
  ['|', ':', '.', '|', ':'],        // for [
  ['A', 'H', ':', '.', '^'],        // for T
  ['J', '.', ':', 'r', '|'],        // for H
  ['A', '+', 'E', '|', '.'],        // for E
  ['H', 'A', '//', ':', '|'],       // for _
  ['|', 'C', '+', '//', '.'],       // for C
  [':', '|', 'F', '//', 'r'],       // for I
  ['?', '|', 'C', ':', '.'],        // for T
  ['6', '?', '^', '|', '.'],        // for A
  [':', '|', 'C', '+', '.'],        // for D
  ['H', 'A', '//', ':', '|'],       // for E
  ['J', '7', '|', ':', '.'],        // for L
  ['|', ':', '.', '|', ':'],        // for ]
];

const LETTERS = ['[', 'T', 'H', 'E', '_', 'C', 'I', 'T', 'A', 'D', 'E', 'L', ']'];

export function CitadelScanlineBanner() {
  return (
    <div
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px 28px',
        userSelect: 'none',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'clamp(6px, 1.2vw, 18px)',
          position: 'relative',
        }}
      >
        {LETTERS.map((char, colIdx) => {
          const runes = GLYPH_COLUMNS[colIdx] || ['.', ':', '|'];
          return (
            <div
              key={colIdx}
              style={{
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {/* Vertical background glyph stream behind each letter */}
              <div
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  inset: '-20px 0 -20px 0',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'space-around',
                  color: 'rgba(168, 85, 247, 0.45)',
                  fontFamily: 'ui-monospace, monospace',
                  fontSize: 'clamp(9px, 1.1vw, 13px)',
                  letterSpacing: '0.1em',
                  pointerEvents: 'none',
                  zIndex: 1,
                  filter: 'drop-shadow(0 0 6px rgba(168, 85, 247, 0.4))',
                }}
              >
                {runes.map((r, rIdx) => (
                  <span key={rIdx}>{r}</span>
                ))}
              </div>

              {/* Striped scanline letterform */}
              <span
                style={{
                  position: 'relative',
                  zIndex: 2,
                  fontSize: 'clamp(2rem, 5.2vw, 3.8rem)',
                  fontWeight: 900,
                  fontFamily: 'ui-monospace, SFMono-Regular, "Courier New", monospace',
                  lineHeight: 1,
                  color: '#ffffff',
                  backgroundImage:
                    'repeating-linear-gradient(180deg, #ffffff 0px, #ffffff 3px, transparent 3px, transparent 6px)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  filter: 'drop-shadow(0 0 10px rgba(255, 255, 255, 0.4)) drop-shadow(0 0 24px rgba(168, 85, 247, 0.5))',
                }}
              >
                {char}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
