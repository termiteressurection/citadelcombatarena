import { useState, useRef, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { Thought } from './types';

/**
 * [1] Global search overlay — search all thoughts across all chambers.
 * [16] Also doubles as fuzzy jump — type a chamber name to teleport.
 */
interface SearchResult { chamberId: number; chamberName: string; thought: Thought; }

interface Props {
  onClose: () => void;
  onNavigate: (chamberId: number) => void;
  searchThoughts: (q: string) => SearchResult[];
  fuzzyJump: (q: string) => number | null;
  chambers: Record<number, { id: number; name: string; thoughts: Thought[] }>;
}

export default function SearchOverlay({ onClose, onNavigate, searchThoughts, fuzzyJump, chambers }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [chamberResults, setChamberResults] = useState<{ id: number; name: string }[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  useEffect(() => {
    if (!query.trim()) { setResults([]); setChamberResults([]); return; }
    const q = query.toLowerCase();
    const directMatches = Object.values(chambers)
      .filter(c => c.name.toLowerCase().includes(q))
      .map(c => ({ id: c.id, name: c.name }));
    const fuzzyMatchId = directMatches.length === 0 ? fuzzyJump(query) : null;
    const fuzzyMatch = fuzzyMatchId !== null ? chambers[fuzzyMatchId] : undefined;
    const nextChamberResults = fuzzyMatch && !directMatches.some(c => c.id === fuzzyMatch.id)
      ? [{ id: fuzzyMatch.id, name: fuzzyMatch.name }, ...directMatches]
      : directMatches;

    setResults(searchThoughts(query).slice(0, 20));
    setChamberResults(nextChamberResults.slice(0, 10));
  }, [query, searchThoughts, fuzzyJump, chambers]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const highlight = (text: string) => {
    if (!query.trim()) return text;
    const re = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return text.replace(re, '⟨$1⟩');
  };

  const thoughtLinkPattern = /@([^/\n]+)\/(\d+)/g;
  const renderThoughtWithLinks = (text: string) => {
    const parts: ReactNode[] = [];
    let last = 0;
    for (const match of text.matchAll(thoughtLinkPattern)) {
      const full = match[0];
      const chamberPart = match[1].trim().toLowerCase();
      const idx = Number(match[2]);
      const start = match.index ?? 0;
      if (start > last) parts.push(<span key={`txt-${start}`}>{highlight(text.slice(last, start))}</span>);
      const targetChamber = Object.values(chambers).find(c => c.name.toLowerCase().includes(chamberPart));
      const targetThought = targetChamber?.thoughts[idx - 1];
      if (targetChamber && targetThought) {
        parts.push(
          <button
            key={`lnk-${start}`}
            className="mx-0.5 rounded border px-1 py-0 text-[9px] uppercase tracking-[0.08em] hover:brightness-125"
            style={{ color: '#c4b5fd', borderColor: 'rgba(168,85,247,0.35)' }}
            onClick={(e) => {
              e.stopPropagation();
              onNavigate(targetChamber.id);
              onClose();
            }}
            title={`Jump to ${targetChamber.name} thought ${idx}`}
          >
            {full}
          </button>,
        );
      } else {
        parts.push(<span key={`bad-${start}`} className="text-red-300/60">{full}</span>);
      }
      last = start + full.length;
    }
    if (last < text.length) parts.push(<span key="tail">{highlight(text.slice(last))}</span>);
    return parts.length > 0 ? parts : [highlight(text)];
  };

  return (
    <div className="fixed inset-0 z-[450] flex flex-col items-center font-mono" style={{ background: 'rgba(10,4,20,0.94)', animation: 'citadelFadeIn 150ms ease-out' }}>
      <div className="w-full max-w-2xl mt-16 px-4">
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 rounded-lg border border-purple-400/20" style={{ background: 'rgba(20,8,40,0.9)' }}>
          <span className="text-purple-400/60 text-sm">⌕</span>
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && chamberResults.length > 0) {
                onNavigate(chamberResults[0].id);
                onClose();
              }
            }}
            placeholder="Search thoughts, tags, or chamber names..."
            className="flex-1 bg-transparent text-[12px] tracking-[0.1em] text-purple-100 outline-none placeholder:text-purple-400/30"
          />
          <button onClick={onClose} className="text-[9px] uppercase tracking-[0.15em] text-purple-400/40 hover:text-purple-300">ESC</button>
        </div>

        {/* Results */}
        <div className="mt-4 max-h-[60vh] overflow-y-auto space-y-1" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(168,85,247,0.2) transparent' }}>
          {/* Chamber matches */}
          {chamberResults.length > 0 && (
            <div className="mb-3">
              <p className="text-[8px] uppercase tracking-[0.3em] text-purple-400/40 mb-2">Chambers</p>
              {chamberResults.map(c => (
                <button
                  key={c.id}
                  onClick={() => { onNavigate(c.id); onClose(); }}
                  className="w-full text-left px-3 py-2 rounded hover:bg-purple-500/10 transition-colors flex items-center gap-2"
                >
                  <span className="text-purple-400/60 text-[10px]">◈</span>
                  <span className="text-[11px] text-purple-200/80">{c.name}</span>
                </button>
              ))}
            </div>
          )}

          {/* Thought matches */}
          {results.length > 0 && (
            <div>
              <p className="text-[8px] uppercase tracking-[0.3em] text-purple-400/40 mb-2">Thoughts</p>
              {results.map(r => (
                <button
                  key={r.thought.id}
                  onClick={() => { onNavigate(r.chamberId); onClose(); }}
                  className="w-full text-left px-3 py-2 rounded hover:bg-purple-500/10 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] text-purple-400/40 shrink-0">{r.chamberName}</span>
                    {r.thought.pinned && <span className="text-[8px] text-amber-400/60">📌</span>}
                  </div>
                  <p className="text-[11px] text-purple-100/70 mt-0.5 line-clamp-2">{renderThoughtWithLinks(r.thought.text)}</p>
                  {r.thought.tags && r.thought.tags.length > 0 && (
                    <div className="flex gap-1 mt-1">
                      {r.thought.tags.map(tag => (
                        <span key={tag} className="text-[8px] px-1.5 py-0.5 rounded-full border border-emerald-400/20 text-emerald-300/60">#{tag}</span>
                      ))}
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}

          {query.trim() && results.length === 0 && chamberResults.length === 0 && (
            <p className="text-center text-[10px] text-purple-400/30 mt-8">No results found</p>
          )}
        </div>
      </div>
    </div>
  );
}
