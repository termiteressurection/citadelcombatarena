import { useState, useEffect, useCallback, useRef } from 'react';
import { localDateISO } from './localDate';
import { UI_LAYER } from './uiLayers';

export default function DailyAnchorGate({
  onSubmit,
}: {
  onSubmit: (body: string) => void;
}) {
  const [text, setText] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const dateStr = localDateISO();
  const label = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const submit = useCallback(() => {
    const t = text.trim();
    if (!t) return;
    onSubmit(t);
  }, [onSubmit, text]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') e.preventDefault();
      if ((e.key === 'Enter' && (e.metaKey || e.ctrlKey)) || e.key === 'F2') {
        if (text.trim()) submit();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [submit, text]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <div
      className="fixed inset-0 flex items-center justify-center font-mono p-6"
      style={{
        zIndex: UI_LAYER.dailyAnchorGate,
        background: 'radial-gradient(circle at 50% 40%, rgba(168,85,247,0.15), rgba(2,0,6,0.96))',
        backdropFilter: 'blur(16px)',
        animation: 'citadelFadeIn 320ms ease-out',
      }}
    >
      <div className="w-full max-w-lg rounded-2xl border border-purple-500/40 bg-[#0e0720]/90 p-8 shadow-[0_0_60px_rgba(0,0,0,0.9),0_0_40px_rgba(168,85,247,0.25)] backdrop-blur-2xl">
        <div className="flex items-center justify-between border-b border-purple-500/25 pb-3">
          <p className="text-[10px] uppercase tracking-[0.45em] text-cyan-300 font-bold">Monad Sanctuary · Daily Anchor</p>
          <span className="text-[9px] uppercase tracking-[0.2em] text-[#ffd700] font-bold">{dateStr}</span>
        </div>
        <h1 className="citadel-display mt-4 text-[22px] uppercase tracking-[0.18em] text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.4)]">
          {label}
        </h1>
        <p className="mt-4 text-[13px] text-purple-100 font-medium leading-relaxed">
          What is the one thing that would make today complete?
        </p>
        <p className="mt-1 text-[11px] leading-relaxed text-purple-300/60">
          Inscribe your daily intention to materialize today’s monolith and unlock the chamber lattice.
        </p>
        <textarea
          ref={inputRef}
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Set your core intention for today…"
          className="mt-4 w-full h-32 resize-none rounded-xl border border-purple-500/35 bg-black/50 px-4 py-3 text-[13px] text-purple-50 outline-none placeholder:text-purple-300/30 focus:border-[#00f0ff] focus:shadow-[0_0_20px_rgba(0,240,255,0.25)] transition-all"
        />
        <div className="mt-5 flex items-center justify-between">
          <p className="text-[9px] uppercase tracking-[0.2em] text-purple-400/50">⌘↵ inscribe & seal</p>
          <button
            type="button"
            onClick={submit}
            disabled={!text.trim()}
            className="rounded-xl border border-[#00f0ff] bg-gradient-to-r from-purple-600/40 to-cyan-500/40 px-5 py-2.5 text-[11px] font-bold uppercase tracking-[0.25em] text-white shadow-[0_0_20px_rgba(0,240,255,0.3)] transition-all disabled:opacity-30 disabled:pointer-events-none hover:shadow-[0_0_30px_rgba(0,240,255,0.5)] hover:scale-[1.02]"
          >
            Inscribe & Enter
          </button>
        </div>
      </div>
    </div>
  );
}
