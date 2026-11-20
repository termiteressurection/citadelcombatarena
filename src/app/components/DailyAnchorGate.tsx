import React, { useState } from 'react';
import type { LocalDay } from '@/core/model/types';
import { useCitadelStore } from '@/core/state/citadelStore';
import { tokens } from '../styles';

interface Props {
  today: LocalDay;
}

export function DailyAnchorGate({ today }: Props) {
  const state = useCitadelStore((s) => s.state);
  const submitAnchor = useCitadelStore((s) => s.submitAnchor);
  const dayCell = state.days[today];
  const isComplete = dayCell?.dailyAnchorComplete ?? false;

  const [intention, setIntention] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = intention.trim();
    if (!trimmed) return;
    submitAnchor(trimmed);
    setIntention('');
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') handleSubmit(e as unknown as React.FormEvent);
  }

  if (isComplete) {
    const anchorEntry = dayCell?.entries.find((e) => e.tags?.includes('daily-anchor'));
    const anchorText = anchorEntry?.text ?? 'Anchor set.';

    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '10px 16px',
          background: tokens.surface,
          border: `1px solid ${tokens.border}`,
          borderRadius: tokens.radius,
          marginBottom: 20,
        }}
      >
        <span
          style={{
            fontFamily: tokens.fontMono,
            fontSize: tokens.fontSizeXs,
            color: tokens.commune,
            letterSpacing: '0.08em',
          }}
        >
          anchor
        </span>
        <span
          style={{
            fontFamily: tokens.fontMono,
            fontSize: tokens.fontSizeSm,
            color: tokens.textMuted,
            fontStyle: 'italic',
          }}
        >
          {anchorText}
        </span>
        <span
          style={{
            marginLeft: 'auto',
            fontFamily: tokens.fontMono,
            fontSize: tokens.fontSizeXs,
            color: tokens.textDim,
            letterSpacing: '0.06em',
          }}
        >
          set
        </span>
      </div>
    );
  }

  return (
    <div
      style={{
        padding: '16px 20px',
        background: tokens.surface,
        border: `1px solid ${tokens.accentDim}`,
        borderRadius: tokens.radius,
        marginBottom: 20,
      }}
    >
      <div
        style={{
          fontFamily: tokens.fontMono,
          fontSize: tokens.fontSizeXs,
          color: tokens.accent,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          marginBottom: 10,
        }}
      >
        Daily Anchor
      </div>
      <p
        style={{
          fontFamily: tokens.fontMono,
          fontSize: tokens.fontSizeSm,
          color: tokens.textMuted,
          margin: '0 0 12px',
          lineHeight: 1.5,
        }}
      >
        What is the one thing that would make today complete?
      </p>
      <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 8 }}>
        <input
          type="text"
          value={intention}
          onChange={(e) => setIntention(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Set your intention..."
          autoFocus
          style={{
            flex: 1,
            fontFamily: tokens.fontMono,
            fontSize: tokens.fontSizeBase,
            color: tokens.text,
            background: tokens.bg,
            border: `1px solid ${tokens.border}`,
            borderRadius: tokens.radius,
            padding: '8px 12px',
            outline: 'none',
          }}
        />
        <button
          type="submit"
          disabled={!intention.trim()}
          style={{
            fontFamily: tokens.fontMono,
            fontSize: tokens.fontSizeXs,
            color: intention.trim() ? tokens.accent : tokens.textDim,
            background: 'transparent',
            border: `1px solid ${intention.trim() ? tokens.accentDim : tokens.border}`,
            borderRadius: tokens.radius,
            padding: '8px 16px',
            cursor: intention.trim() ? 'pointer' : 'default',
            letterSpacing: '0.04em',
            whiteSpace: 'nowrap',
          }}
        >
          Anchor
        </button>
      </form>
    </div>
  );
}
