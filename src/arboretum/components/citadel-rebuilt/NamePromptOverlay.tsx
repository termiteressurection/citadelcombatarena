import { useState, useEffect, useRef, useCallback } from 'react';

/* ═══════════════════════════════════════════════════════
   Name Prompt Overlay — First-Run Identity Setup
   Appears when identity.name is the default.
   Matches the lodge wireframe aesthetic.
   ═══════════════════════════════════════════════════════ */

interface Props {
  onSetName: (name: string) => void;
  onSkip: () => void;
}

export default function NamePromptOverlay({ onSetName, onSkip }: Props) {
  const [value, setValue] = useState('');
  const [phase, setPhase] = useState<'fade-in' | 'ready' | 'fade-out'>('fade-in');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => setPhase('ready'), 600);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (phase === 'ready') inputRef.current?.focus();
  }, [phase]);

  const submit = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed) return;
    setPhase('fade-out');
    setTimeout(() => onSetName(trimmed), 400);
  }, [value, onSetName]);

  const skip = useCallback(() => {
    setPhase('fade-out');
    setTimeout(() => onSkip(), 400);
  }, [onSkip]);

  const opacity = phase === 'fade-in' ? 0 : phase === 'fade-out' ? 0 : 1;

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center font-mono"
      style={{
        background: 'radial-gradient(ellipse at 50% 30%, #1a0635 0%, #0a0318 50%, #030108 100%)',
        opacity,
        transition: 'opacity 500ms ease',
      }}
    >
      {/* Sacred geometry background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: 'linear-gradient(rgba(168,85,247,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(236,72,153,0.6) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }} />
      </div>

      <div className="relative flex flex-col items-center gap-8 max-w-md px-8">
        {/* Wireframe eye symbol */}
        <svg width="64" height="64" viewBox="0 0 64 64" fill="none" className="opacity-60" style={{ animation: 'breathe 4s ease-in-out infinite' }}>
          <path d="M32 16 L52 32 L32 48 L12 32 Z" stroke="#a855f7" strokeWidth="1.5" fill="none" opacity="0.6" />
          <circle cx="32" cy="32" r="8" stroke="#ec4899" strokeWidth="1" fill="none" opacity="0.8" />
          <circle cx="32" cy="32" r="3" fill="#fbbf24" opacity="0.6" />
          <path d="M32 8 L56 32 L32 56 L8 32 Z" stroke="#a855f7" strokeWidth="0.5" fill="none" opacity="0.2" />
        </svg>

        {/* Title */}
        <div className="text-center">
          <p className="text-[10px] uppercase tracking-[0.5em] text-purple-300/50 mb-2">Welcome to</p>
          <h1
            className="text-3xl font-light uppercase tracking-[0.3em] text-white/90"
            style={{ textShadow: '0 0 30px rgba(168,85,247,0.3)' }}
          >
            The Citadel
          </h1>
        </div>

        {/* Prompt */}
        <p className="text-[11px] uppercase tracking-[0.25em] text-purple-200/50 text-center">
          How shall the lodge know you?
        </p>

        {/* Input */}
        <div className="w-full relative">
          <input
            ref={inputRef}
            value={value}
            onChange={e => setValue(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') skip(); }}
            maxLength={24}
            placeholder="Enter your name"
            className="w-full bg-transparent text-center text-lg text-white/90 outline-none py-3 px-4 rounded-lg font-mono tracking-[0.15em]"
            style={{
              border: '1px solid rgba(168, 85, 247, 0.3)',
              boxShadow: '0 0 20px rgba(168, 85, 247, 0.1), inset 0 0 20px rgba(168, 85, 247, 0.03)',
              animation: 'iridescent 8s linear infinite',
            }}
            autoComplete="off"
            spellCheck={false}
          />
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-6">
          <button
            onClick={submit}
            disabled={!value.trim()}
            className="flex items-center gap-2 px-5 py-2 rounded-lg transition-all disabled:opacity-30"
            style={{
              border: '1px solid rgba(168, 85, 247, 0.4)',
              background: value.trim() ? 'rgba(168, 85, 247, 0.1)' : 'transparent',
            }}
          >
            
            <span className="text-[10px] uppercase tracking-[0.2em] text-purple-200/80">Enter</span>
          </button>
          <button
            onClick={skip}
            className="flex items-center gap-2 px-4 py-2 rounded-lg transition-all"
            style={{ border: '1px solid rgba(168, 85, 247, 0.15)' }}
          >
            
            <span className="text-[10px] uppercase tracking-[0.2em] text-purple-200/40">Skip</span>
          </button>
        </div>

        {/* Flavor text */}
        <p className="text-[8px] uppercase tracking-[0.3em] text-purple-400/25 text-center">
          Your name echoes through every chamber you create
        </p>
      </div>
    </div>
  );
}
