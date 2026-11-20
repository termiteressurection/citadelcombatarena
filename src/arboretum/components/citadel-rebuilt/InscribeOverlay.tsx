import { useState, useRef, useEffect } from 'react';
import { Z } from './ZRegistry';
import { tokens } from '@/app/styles';

interface InscribeOverlayProps {
  open: boolean;
  onClose: () => void;
  onSave: (text: string) => void;
  prompt?: string;
}

// ── Proper PlayStation button shapes ──
function PSButton({ type, size = 28 }: { type: 'cross' | 'circle' | 'square' | 'triangle'; size?: number }) {
  const configs = {
    cross:    { color: '#8bb8ff', bg: '#8bb8ff22', border: '#8bb8ff66', label: '✕' },
    circle:   { color: '#ff8888', bg: '#ff888822', border: '#ff888866', label: '○' },
    square:   { color: '#ff88cc', bg: '#ff88cc22', border: '#ff88cc66', label: '□' },
    triangle: { color: '#88ffbb', bg: '#88ffbb22', border: '#88ffbb66', label: '△' },
  };
  const c = configs[type];
  return (
    <span
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: size, height: size, borderRadius: '50%',
        background: c.bg, border: `1.5px solid ${c.border}`,
        color: c.color, fontSize: size * 0.48, fontWeight: 700,
        lineHeight: 1, flexShrink: 0,
        boxShadow: `0 0 8px ${c.color}33`,
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      {c.label}
    </span>
  );
}

function KBKey({ label, size = 28 }: { label: string; size?: number }) {
  return (
    <span
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        minWidth: size, height: size, borderRadius: 6,
        background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.2)',
        color: 'rgba(255,255,255,0.8)', fontSize: size * 0.38, fontWeight: 700,
        lineHeight: 1, padding: '0 6px', flexShrink: 0,
        fontFamily: 'monospace',
      }}
    >
      {label}
    </span>
  );
}

function ControlHint({ kbKey, label }: {
  kbKey: string;
  label: string;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <KBKey label={kbKey} size={24} />
      <span style={{ fontSize: 11, fontFamily: 'monospace', color: 'rgba(255,255,255,0.4)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
        {label}
      </span>
    </div>
  );
}

const JOURNAL_PROMPTS = [
  "What's on your mind right now?",
  "What happened today worth remembering?",
  "What are you carrying into tomorrow?",
  "What felt heavy today? What felt light?",
  "One thing you noticed. One thing you felt.",
  "What do you want to remember about this moment?",
  "What's unresolved? What's settled?",
  "Describe today in three words, then explain one.",
];

export default function InscribeOverlay({ open, onClose, onSave, prompt }: InscribeOverlayProps) {
  const [text, setText] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  
  const sessionPrompt = useRef(prompt || JOURNAL_PROMPTS[Math.floor(Math.random() * JOURNAL_PROMPTS.length)]);
  useEffect(() => {
    if (open) sessionPrompt.current = prompt || JOURNAL_PROMPTS[Math.floor(Math.random() * JOURNAL_PROMPTS.length)];
  }, [open, prompt]);

  useEffect(() => {
    if (open) {
      const timer = setTimeout(() => inputRef.current?.focus(), 300);
      if (document.pointerLockElement) document.exitPointerLock();
      return () => clearTimeout(timer);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const keyHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', keyHandler);
    return () => {
      window.removeEventListener('keydown', keyHandler);
    };
  }, [open, text, onClose]);

  const handleSave = () => {
    if (text.trim()) {
      onSave(text.trim());
      setText('');
    }
    onClose();
  };

  if (!open) return null;

  const charCount = text.length;
  const maxChars = 1200;
  const canSave = text.trim().length > 0;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: Z.CRITICAL_MODAL,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24, pointerEvents: 'auto',
      }}
    >
      {/* Immersive Glassmorphism Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'absolute', inset: 0,
          background: 'radial-gradient(circle at center, rgba(168,85,247,0.1) 0%, rgba(8,6,18,0.85) 100%)',
          backdropFilter: 'blur(32px) saturate(120%)',
          animation: 'fadeIn 0.3s ease-out',
        }}
      />

      {/* Premium Modal Panel */}
      <div
        style={{
          position: 'relative', width: '100%', maxWidth: 640,
          background: 'linear-gradient(145deg, rgba(20,15,35,0.7) 0%, rgba(10,7,20,0.9) 100%)',
          backdropFilter: 'blur(24px)',
          border: '1px solid rgba(168, 85, 247, 0.3)',
          borderRadius: 24,
          boxShadow: '0 30px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.05) inset, 0 0 40px rgba(168,85,247,0.15)',
          overflow: 'hidden',
          animation: 'slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
          display: 'flex', flexDirection: 'column',
        }}
      >
        {/* Dynamic neon top border */}
        <div style={{
          position: 'absolute', top: 0, left: '10%', right: '10%', height: 2,
          background: 'linear-gradient(90deg, transparent, #c084fc, #ec4899, transparent)',
          boxShadow: '0 0 10px #c084fc, 0 0 20px #ec4899',
          opacity: isFocused ? 1 : 0.4,
          transition: 'opacity 0.3s ease',
        }} />

        <div style={{ padding: '40px 48px 32px' }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 32 }}>
            <div>
              <div style={{ 
                fontSize: 11, fontFamily: 'monospace', letterSpacing: '0.4em', 
                color: '#c084fc', textTransform: 'uppercase', marginBottom: 12,
                display: 'flex', alignItems: 'center', gap: 8
              }}>
                <span style={{ width: 8, height: 8, background: '#c084fc', borderRadius: '50%', boxShadow: '0 0 8px #c084fc' }} />
                ARCHIVE ENTRY
              </div>
              <div style={{ 
                fontSize: 26, fontWeight: 300, color: '#ffffff', 
                letterSpacing: '-0.02em', lineHeight: 1.3, maxWidth: 440,
                textShadow: '0 2px 10px rgba(0,0,0,0.5)'
              }}>
                {sessionPrompt.current}
              </div>
            </div>

            <button
              onClick={onClose}
              style={{
                flexShrink: 0, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                cursor: 'pointer', padding: 8, borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.2s ease', color: 'rgba(255,255,255,0.6)',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
                e.currentTarget.style.color = '#ffffff';
                e.currentTarget.style.transform = 'scale(1.05)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                e.currentTarget.style.color = 'rgba(255,255,255,0.6)';
                e.currentTarget.style.transform = 'scale(1)';
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Textarea */}
          <div style={{ position: 'relative', marginBottom: 32 }}>
            <textarea
              ref={inputRef}
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={e => {
                if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') handleSave();
                if (e.key === 'Escape') onClose();
              }}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              placeholder="Begin inscription..."
              maxLength={maxChars}
              style={{
                width: '100%', minHeight: 200, resize: 'none',
                background: isFocused ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.15)',
                border: `1px solid ${isFocused ? 'rgba(168,85,247,0.6)' : 'rgba(255,255,255,0.1)'}`,
                boxShadow: isFocused ? '0 0 20px rgba(168,85,247,0.1) inset' : 'none',
                borderRadius: 16, padding: '20px 24px',
                fontSize: 18, fontWeight: 300, lineHeight: 1.6,
                color: 'rgba(255,255,255,0.95)',
                fontFamily: tokens.fontSans,
                outline: 'none', boxSizing: 'border-box',
                caretColor: '#ec4899',
                transition: 'all 0.3s ease',
              }}
            />
            <div style={{
              position: 'absolute', bottom: 16, right: 20,
              fontSize: 11, fontFamily: 'monospace',
              color: charCount > maxChars * 0.85 ? '#fbbf24' : 'rgba(255,255,255,0.2)',
              transition: 'color 0.2s ease',
            }}>
              {charCount} / {maxChars}
            </div>
          </div>

          {/* Footer Controls */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
              <button 
                onClick={onClose} 
                style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', outline: 'none' }}
                className="hover:opacity-80 transition-opacity"
              >
                <ControlHint kbKey="ESC" label="Cancel" />
              </button>
              <button 
                onClick={handleSave} 
                style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', outline: 'none' }}
                className="hover:opacity-80 transition-opacity"
              >
                <ControlHint kbKey="⌘↵" label="Save" />
              </button>
            </div>

            <button
              onClick={handleSave}
              disabled={!canSave}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 28px', borderRadius: 100,
                background: canSave ? 'linear-gradient(135deg, rgba(168,85,247,0.3), rgba(236,72,153,0.3))' : 'rgba(255,255,255,0.05)',
                border: `1px solid ${canSave ? 'rgba(236,72,153,0.6)' : 'rgba(255,255,255,0.1)'}`,
                color: canSave ? '#ffffff' : 'rgba(255,255,255,0.3)',
                fontSize: 13, fontFamily: 'monospace', fontWeight: 600,
                letterSpacing: '0.15em', textTransform: 'uppercase',
                cursor: canSave ? 'pointer' : 'default',
                transition: 'all 0.2s ease',
                boxShadow: canSave ? '0 8px 20px rgba(236,72,153,0.2)' : 'none',
                outline: 'none',
              }}
              onMouseEnter={e => { 
                if (canSave) { 
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 12px 24px rgba(236,72,153,0.3)';
                }
              }}
              onMouseLeave={e => { 
                if (canSave) { 
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 8px 20px rgba(236,72,153,0.2)';
                }
              }}
            >
              <span>Inscribe</span>
              {canSave && (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { 
          from { opacity: 0; transform: translateY(20px) scale(0.98); } 
          to { opacity: 1; transform: translateY(0) scale(1); } 
        }
      `}</style>
    </div>
  );
}
