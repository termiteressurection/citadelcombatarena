import { useState, useRef, useEffect } from 'react';
import { tokens } from '@/app/styles';
import { useCitadelStore } from '@/core/state/citadelStore';
import { searchLibrarian, resolveTeleport, type SearchResult } from '@/core/rules/librarian';
import type { LocalDay } from '@/core/model/types';

interface Props {
  onTeleport: (day: LocalDay) => void;
}

export function SearchAltar({ onTeleport }: Props) {
  const [hovered, setHovered] = useState(false);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const state = useCitadelStore((s) => s.state);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
      setQuery('');
      setResults([]);
      setActiveIndex(-1);
    }
  }, [open]);

  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    setResults(searchLibrarian(state, query));
    setActiveIndex(-1);
  }, [query, state]);

  // CMD+K global open
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  function teleport(day: LocalDay) {
    onTeleport(day);
    setOpen(false);
    setQuery('');
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') { setOpen(false); return; }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, results.length - 1));
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, -1));
      return;
    }

    if (e.key === 'Enter') {
      if (activeIndex >= 0 && results[activeIndex]) {
        teleport(results[activeIndex].day);
        return;
      }
      const target = resolveTeleport(state, query);
      if (target) teleport(target);
    }
  }

  return (
    <>
      {/* Altar trigger */}
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={() => setOpen(true)}
        role="button"
        aria-label="Open search altar"
        style={{
          padding: '10px 12px',
          width: '100%',
          border: `1px solid ${hovered ? tokens.accent : tokens.border}`,
          borderRadius: tokens.radius,
          background: hovered ? 'rgba(200,169,110,0.04)' : 'transparent',
          cursor: 'pointer',
          transition: 'border-color 0.2s ease, background 0.2s ease',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        {/* Faceted diamond — the Librarian's Eye */}
        <div
          style={{
            width: 14,
            height: 14,
            border: `1px solid ${hovered ? tokens.accent : tokens.textDim}`,
            transform: 'rotate(45deg)',
            flexShrink: 0,
            transition: 'border-color 0.2s ease, transform 0.4s cubic-bezier(0.4,0,0.2,1)',
          }}
        />
        <span
          style={{
            fontFamily: tokens.fontMono,
            fontSize: tokens.fontSizeXs,
            color: hovered ? tokens.text : tokens.textDim,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            transition: 'color 0.2s ease',
          }}
        >
          Search
        </span>
        <span
          style={{
            marginLeft: 'auto',
            fontFamily: tokens.fontMono,
            fontSize: tokens.fontSizeXs,
            color: tokens.textDim,
            opacity: 0.5,
          }}
        >
          cmd k
        </span>
      </div>

      {/* Search Void overlay */}
      {open && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            background: 'rgba(6, 2, 14, 0.92)',
            backdropFilter: 'blur(12px)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            paddingTop: '14vh',
            fontFamily: tokens.fontMono,
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
        >
          <div style={{ width: '100%', maxWidth: 580, padding: '0 24px' }}>

            {/* Input bar */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '14px 18px',
                border: `1px solid ${tokens.borderFocus}`,
                borderRadius: tokens.radiusLg,
                background: 'rgba(16, 6, 32, 0.9)',
                boxShadow: '0 0 40px rgba(100, 60, 180, 0.15)',
              }}
            >
              {/* Diamond icon */}
              <div
                style={{
                  width: 12,
                  height: 12,
                  border: `1px solid ${tokens.accent}`,
                  transform: 'rotate(45deg)',
                  flexShrink: 0,
                  opacity: 0.8,
                }}
              />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Teleport to date or search memories..."
                style={{
                  flex: 1,
                  background: 'transparent',
                  border: 'none',
                  color: tokens.text,
                  fontSize: tokens.fontSizeSm,
                  fontFamily: tokens.fontMono,
                  outline: 'none',
                  letterSpacing: '0.04em',
                }}
              />
              <span
                style={{
                  fontFamily: tokens.fontMono,
                  fontSize: tokens.fontSizeXs,
                  color: tokens.textDim,
                  opacity: 0.5,
                  cursor: 'pointer',
                }}
                onClick={() => setOpen(false)}
              >
                esc
              </span>
            </div>

            {/* Results */}
            <div
              style={{
                marginTop: 12,
                maxHeight: '50vh',
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
              }}
            >
              {results.map((r, i) => (
                <div
                  key={r.entryId}
                  onClick={() => teleport(r.day)}
                  style={{
                    padding: '10px 14px',
                    borderRadius: tokens.radius,
                    cursor: 'pointer',
                    border: `1px solid ${i === activeIndex ? tokens.borderFocus : 'transparent'}`,
                    background: i === activeIndex ? 'rgba(255,255,255,0.04)' : 'transparent',
                    transition: 'background 0.1s ease, border-color 0.1s ease',
                  }}
                  onMouseEnter={(e) => {
                    setActiveIndex(i);
                    e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
                  }}
                  onMouseLeave={(e) => {
                    if (activeIndex !== i) e.currentTarget.style.background = 'transparent';
                  }}
                >
                  <div
                    style={{
                      fontSize: tokens.fontSizeXs,
                      color: tokens.accent,
                      marginBottom: 3,
                      letterSpacing: '0.06em',
                    }}
                  >
                    {r.day}
                  </div>
                  <div
                    style={{
                      fontSize: tokens.fontSizeSm,
                      color: tokens.textMuted,
                      lineHeight: 1.5,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {r.text}
                  </div>
                </div>
              ))}

              {query.trim() && results.length === 0 && (
                <div
                  style={{
                    textAlign: 'center',
                    color: tokens.textDim,
                    fontSize: tokens.fontSizeXs,
                    marginTop: 48,
                    letterSpacing: '0.1em',
                  }}
                >
                  no echoes found
                </div>
              )}

              {!query.trim() && (
                <div
                  style={{
                    textAlign: 'center',
                    color: tokens.textDim,
                    fontSize: tokens.fontSizeXs,
                    marginTop: 48,
                    letterSpacing: '0.08em',
                    lineHeight: 2,
                  }}
                >
                  type a date (2026-04-24) or keyword
                  <br />
                  enter to teleport
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
