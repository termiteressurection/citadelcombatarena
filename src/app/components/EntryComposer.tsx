import React, { useState, useRef, useEffect } from 'react';
import type { LocalDay } from '@/core/model/types';
import { canWriteToDay } from '@/core/rules/writeGate';
import { useCitadelStore } from '@/core/state/citadelStore';
import { tokens } from '../styles';

interface Props {
  today: LocalDay;
}

export function EntryComposer({ today }: Props) {
  const state = useCitadelStore((s) => s.state);
  const writeToDay = useCitadelStore((s) => s.writeToDay);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [text]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const gate = canWriteToDay({ targetDay: today, today: state.today, text });
    if (!gate.allowed) {
      setError(gateMessage(gate.reason));
      return;
    }

    writeToDay(today, text.trim());
    setText('');
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      handleSubmit(e as unknown as React.FormEvent);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ marginTop: 24 }}>
      <div
        className="composer-container"
        style={{
          border: `1px solid ${error ? tokens.danger : tokens.border}`,
          borderRadius: tokens.radius,
          background: tokens.surface,
          transition: 'border-color 0.15s',
          overflow: 'hidden',
        }}
      >
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            if (error) setError(null);
          }}
          onKeyDown={handleKeyDown}
          placeholder="Write an entry… (⌘↵ to save)"
          rows={3}
          style={{
            display: 'block',
            width: '100%',
            padding: '14px 16px',
            fontFamily: tokens.fontMono,
            fontSize: tokens.fontSizeBase,
            color: tokens.text,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            resize: 'none',
            lineHeight: 1.6,
            boxSizing: 'border-box',
            minHeight: 80,
            caretColor: 'var(--citadel-accent)',
          }}
        />
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 12px',
            borderTop: `1px solid ${tokens.border}`,
          }}
        >
          {error ? (
            <span style={{ fontFamily: tokens.fontMono, fontSize: tokens.fontSizeXs, color: tokens.danger }}>
              {error}
            </span>
          ) : (
            <span style={{ fontFamily: tokens.fontMono, fontSize: tokens.fontSizeXs, color: tokens.textDim }}>
              {text.length > 0 ? `${text.trim().split(/\s+/).filter(Boolean).length} words` : ''}
            </span>
          )}
          <button
            type="submit"
            disabled={!text.trim()}
            style={{
              fontFamily: tokens.fontMono,
              fontSize: tokens.fontSizeXs,
              color: text.trim() ? tokens.accent : tokens.textDim,
              background: 'transparent',
              border: `1px solid ${text.trim() ? tokens.accentDim : tokens.border}`,
              borderRadius: tokens.radius,
              padding: '4px 14px',
              cursor: text.trim() ? 'pointer' : 'default',
              letterSpacing: '0.04em',
              transition: 'color 0.15s, border-color 0.15s',
            }}
          >
            Save
          </button>
        </div>
      </div>
    </form>
  );
}

function gateMessage(reason: string): string {
  switch (reason) {
    case 'PAST_DAY_LOCKED': return 'This day is locked — past entries are immutable.';
    case 'FUTURE_DAY_FORBIDDEN': return 'Cannot write to a future day.';
    case 'EMPTY_TEXT': return 'Entry cannot be empty.';
    default: return 'Write not allowed.';
  }
}
