import { useState, useEffect, useRef } from 'react';
import { useCitadelStore } from '@/core/state/citadelStore';
import { renderTermiteseText } from './termiteseGlitch';
import {
  INITIAL_SIGMA_STATE,
  generateSigmaReplyAsync,
  type SigmaState,
} from '@/arboretum/components/citadel-rebuilt/sigma/SigmaEngine';
import type { Chamber, GridIdentity, Thought } from '@/arboretum/components/citadel-rebuilt/types';
import { getCitadelSettings } from '@/arboretum/components/citadel-rebuilt/settings/citadelSettings';
import { calcHubDensity } from '@/features/world/hubDensity';
import { tokens } from '@/app/styles';
import { toLocalDay } from '@/core/time/localDay';
import { commitAtWipeEpoch, getWipeEpoch, isCurrentWipeEpoch, subscribeToWipeEpoch } from '@/core/security/wipeEpoch';
import { CitationChip } from './CitationChip';
import { WhatSigmaKnowsModal } from './WhatSigmaKnowsModal';
import { GrowthFeedModal } from './GrowthFeedModal';
import { ForgetConversationModal } from './ForgetConversationModal';
import {
  isLearningPaused,
  setLearningPaused,
  forgetConversation,
} from '@/core/player-model/playerModelStore';
import { runExtractionPass, extractCitadelState } from '@/core/player-model/playerModelExtractor';
import { harvestToThoughts } from '@/core/sigma/citadelStoreHarvester';
import type { CitationChipData } from '@/core/sigma/sigmaLeash';

interface Props {
  onClose: () => void;
}

export interface ChatTurn {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: CitationChipData[];
  timestamp: number;
}

interface SigmaSession {
  id: string;
  day: string;
  startedAt: number;
  updatedAt: number;
  messages: ChatTurn[];
}

const STORAGE_SESSION_KEY = 'citadel_sigma_chat_session_v2';
const STORAGE_ARCHIVES_KEY = 'citadel_sigma_chat_archives_v2';

function loadDailySigmaSession(): { sessionId: string; messages: ChatTurn[] } {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_SESSION_KEY) : null;
    if (!raw) return { sessionId: `ses_${Date.now()}`, messages: [] };
    const session: SigmaSession = JSON.parse(raw);
    const today = toLocalDay(new Date());
    const now = Date.now();
    const isSameDay = session.day === today;
    const isWithin24Hours = (now - session.startedAt) < (24 * 60 * 60 * 1000);

    if (isSameDay && isWithin24Hours && Array.isArray(session.messages)) {
      return { sessionId: session.id || `ses_${session.startedAt}`, messages: session.messages };
    }
    // Archive previous day's conversation log
    if (Array.isArray(session.messages) && session.messages.length > 0) {
      try {
        const archivesRaw = localStorage.getItem(STORAGE_ARCHIVES_KEY);
        const archives = archivesRaw ? JSON.parse(archivesRaw) : [];
        archives.push({
          id: session.id,
          day: session.day,
          archivedAt: now,
          messages: session.messages,
        });
        localStorage.setItem(STORAGE_ARCHIVES_KEY, JSON.stringify(archives.slice(-30)));
      } catch {}
    }
    return { sessionId: `ses_${Date.now()}`, messages: [] };
  } catch {
    return { sessionId: `ses_${Date.now()}`, messages: [] };
  }
}

function saveDailySigmaSession(sessionId: string, messages: ChatTurn[]) {
  try {
    const today = toLocalDay(new Date());
    const now = Date.now();
    let startedAt = now;
    try {
      const existing = localStorage.getItem(STORAGE_SESSION_KEY);
      if (existing) {
        const parsed = JSON.parse(existing);
        if (parsed.day === today && parsed.startedAt) {
          startedAt = parsed.startedAt;
        }
      }
    } catch {}

    const session: SigmaSession = {
      id: sessionId,
      day: today,
      startedAt,
      updatedAt: now,
      messages,
    };
    localStorage.setItem(STORAGE_SESSION_KEY, JSON.stringify(session));
  } catch {}
}

export function SigmaChatPanel({ onClose }: Props) {
  const state = useCitadelStore((s) => s.state);
  const writeToDay = useCitadelStore((s) => s.writeToDay);
  const density = calcHubDensity(state);
  const score = density.score;

  const [sessionData, setSessionData] = useState(() => loadDailySigmaSession());
  const [history, setHistory] = useState<ChatTurn[]>(sessionData.messages);
  const [sessionId, setSessionId] = useState(sessionData.sessionId);
  const [input, setInput] = useState('');
  const [isReplying, setIsReplying] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [sigmaState, setSigmaState] = useState<SigmaState>(INITIAL_SIGMA_STATE);
  const [paused, setPaused] = useState(() => isLearningPaused());

  // Modals
  const [showWhatKnows, setShowWhatKnows] = useState(false);
  const [showGrowthFeed, setShowGrowthFeed] = useState(false);
  const [showForgetModal, setShowForgetModal] = useState(false);
  const [handoffNotice, setHandoffNotice] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [history, isReplying, streamingText]);

  useEffect(() => subscribeToWipeEpoch(() => {
    setHistory([]);
    setSessionId(`ses_${Date.now()}`);
    setSigmaState(INITIAL_SIGMA_STATE);
    setInput('');
    setIsReplying(false);
    setStreamingText('');
  }), []);

  useEffect(() => {
    void extractCitadelState(state);
  }, [state]);

  const handleToggleLearning = async () => {
    const next = !paused;
    setPaused(next);
    await setLearningPaused(next);
  };

  const handleManualNewSession = () => {
    if (history.length > 0) {
      try {
        const archivesRaw = localStorage.getItem(STORAGE_ARCHIVES_KEY);
        const archives = archivesRaw ? JSON.parse(archivesRaw) : [];
        archives.push({
          id: sessionId,
          day: toLocalDay(new Date()),
          archivedAt: Date.now(),
          messages: history,
        });
        localStorage.setItem(STORAGE_ARCHIVES_KEY, JSON.stringify(archives.slice(-30)));
      } catch {}
    }
    const newId = `ses_${Date.now()}`;
    setHistory([]);
    setSessionId(newId);
    setSigmaState(INITIAL_SIGMA_STATE);
    setStreamingText('');
    localStorage.removeItem(STORAGE_SESSION_KEY);
  };

  const handleConfirmForget = async () => {
    await forgetConversation(sessionId);
    setHistory([]);
    setStreamingText('');
    setShowForgetModal(false);
    localStorage.removeItem(STORAGE_SESSION_KEY);
  };

  const handleHandoffNote = () => {
    if (history.length === 0) return;
    const today = toLocalDay(new Date());

    // Extract user discussion and commitments
    const userLines = history
      .filter((h) => h.role === 'user')
      .map((h) => h.content)
      .slice(-5);

    const noteBody = [
      `## Sigma Session Handoff — ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`,
      `**Discussed:** ${userLines.join('; ')}`,
      `**Session Context:** ${history.length} dialogue turns recorded under session ${sessionId}.`,
      `**Status:** Handoff committed to verified journal. Chat closed into stone.`,
    ].join('\n\n');

    writeToDay(today, noteBody, ['sigma-handoff', 'session-note']);

    setHandoffNotice('Handoff note written to Today’s journal!');
    setTimeout(() => setHandoffNotice(null), 3000);
  };

  const handleExportChatMarkdown = () => {
    const lines = [
      '# Citadel — Sigma Chat Log Export',
      `Session ID: ${sessionId}`,
      `Date: ${new Date().toISOString()}`,
      `Turns: ${history.length}`,
      '',
      ...history.map((turn) => {
        const speaker = turn.role === 'user' ? 'Player' : 'Sigma';
        const citationsStr = turn.citations && turn.citations.length > 0
          ? `\n  *Citations: ${turn.citations.map((c) => `[${c.sourceType} ${c.sourceDate}: "${c.snippet}"]`).join(', ')}*`
          : '';
        return `### ${speaker} (${new Date(turn.timestamp).toLocaleTimeString()}):\n${turn.content}${citationsStr}\n`;
      }),
    ];

    const blob = new Blob([lines.join('\n')], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `citadel-chat-session-${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const transmitMessage = async (rawMsg: string) => {
    const userMsg = rawMsg.trim();
    if (!userMsg || isReplying) return;
    const wipeEpoch = getWipeEpoch();
    const today = toLocalDay(new Date());

    setInput('');
    const userTurn: ChatTurn = {
      id: `turn_${Date.now()}_u`,
      role: 'user',
      content: userMsg,
      timestamp: Date.now(),
    };

    const newHistory = [...history, userTurn];
    setHistory(newHistory);
    saveDailySigmaSession(sessionId, newHistory);
    setIsReplying(true);
    setStreamingText('');

    // Trigger extraction pass on user input
    void runExtractionPass({
      text: userMsg,
      sourceId: `${sessionId}:${userTurn.id}`,
      sourceDate: today,
      sourceType: 'chat',
    });

    const allThoughts: Thought[] = harvestToThoughts(state);

    const settings = getCitadelSettings();
    const syntheticChamber: Chamber = {
      id: 0,
      name: 'Sanctuary Hub',
      depth: Math.max(1, Object.keys(state.days).length),
      description: '2D Sanctuary Hub',
      thoughts: allThoughts,
      doors: [],
    };
    const syntheticIdentity: GridIdentity = {
      name: settings.userName || 'Traveler',
      createdAt: new Date().toISOString(),
      sessionStart: Date.now(),
    };

    try {
      const historyPayload = newHistory.map((h) => ({ role: h.role, content: h.content }));

      const { reply, newState, citations } = await generateSigmaReplyAsync(
        userMsg,
        syntheticChamber,
        syntheticIdentity,
        allThoughts,
        sigmaState,
        historyPayload.slice(0, -1),
        allThoughts,
        (token) => {
          setStreamingText((prev) => prev + token);
        },
      );

      commitAtWipeEpoch(wipeEpoch, () => {
        setSigmaState(newState);
        const assistantTurn: ChatTurn = {
          id: `turn_${Date.now()}_a`,
          role: 'assistant',
          content: reply,
          citations,
          timestamp: Date.now(),
        };
        const updated = [...newHistory, assistantTurn];
        setHistory(updated);
        saveDailySigmaSession(sessionId, updated);
        setStreamingText('');
      });
    } finally {
      if (isCurrentWipeEpoch(wipeEpoch)) {
        setIsReplying(false);
        setStreamingText('');
      }
    }
  };

  const handleSend = () => {
    void transmitMessage(input);
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.78)',
        zIndex: 200,
        backdropFilter: 'blur(8px)',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="brutalist-crt"
        style={{
          background: 'rgba(10, 8, 14, 0.98)',
          border: '1px solid rgba(168, 85, 247, 0.45)',
          borderRadius: tokens.radiusLg,
          padding: '16px 20px',
          width: 680,
          maxWidth: '94vw',
          height: 680,
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          fontFamily: tokens.fontMono,
          boxShadow: '0 0 35px rgba(168, 85, 247, 0.25)',
        }}
      >
        {/* Top Control Bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '12px',
            borderBottom: '1px solid rgba(168, 85, 247, 0.25)',
            paddingBottom: '10px',
            flexWrap: 'wrap',
            gap: '8px',
          }}
        >
          <div>
            <div
              style={{
                fontSize: '11px',
                color: '#d8b4fe',
                letterSpacing: '0.12em',
                fontWeight: 'bold',
                textTransform: 'uppercase',
                textShadow: '0 0 8px rgba(192, 132, 252, 0.6)',
              }}
            >
              Σ // LAYERED SIGMA · THE WITNESS
            </div>
            <div style={{ fontSize: '10px', color: 'rgba(216, 180, 254, 0.6)', marginTop: 2 }}>
              Sovereign Local Presence · Density: {Math.round(score * 100)}%
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            {/* What Sigma Knows Button */}
            <button
              type="button"
              onClick={() => setShowWhatKnows(true)}
              style={{
                background: 'rgba(168, 85, 247, 0.15)',
                border: '1px solid rgba(192, 132, 252, 0.4)',
                color: '#e9d5ff',
                fontSize: '10px',
                padding: '3px 8px',
                borderRadius: tokens.radius,
                cursor: 'pointer',
                fontFamily: tokens.fontMono,
              }}
              title="Inspect and edit player model records"
            >
              WHAT SIGMA KNOWS
            </button>

            {/* Growth Feed Button */}
            <button
              type="button"
              onClick={() => setShowGrowthFeed(true)}
              style={{
                background: 'rgba(168, 85, 247, 0.15)',
                border: '1px solid rgba(192, 132, 252, 0.4)',
                color: '#e9d5ff',
                fontSize: '10px',
                padding: '3px 8px',
                borderRadius: tokens.radius,
                cursor: 'pointer',
                fontFamily: tokens.fontMono,
              }}
              title="View chronological learning log"
            >
              GROWTH FEED
            </button>

            {/* Pause Learning Toggle */}
            <button
              type="button"
              onClick={() => void handleToggleLearning()}
              style={{
                background: paused ? 'rgba(239, 68, 68, 0.18)' : 'rgba(16, 185, 129, 0.15)',
                border: `1px solid ${paused ? 'rgba(239, 68, 68, 0.5)' : 'rgba(16, 185, 129, 0.5)'}`,
                color: paused ? '#fca5a5' : '#6ee7b7',
                fontSize: '10px',
                padding: '3px 8px',
                borderRadius: tokens.radius,
                cursor: 'pointer',
                fontFamily: tokens.fontMono,
              }}
              title="Toggle automatic memory extraction from chat"
            >
              {paused ? 'LEARN: PAUSED' : 'LEARN: ACTIVE'}
            </button>

            {/* Close Button */}
            <button
              onClick={onClose}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#d8b4fe',
                fontSize: '14px',
                cursor: 'pointer',
                lineHeight: 1,
                padding: '4px 6px',
              }}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Secondary Session Control Bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '10px',
            padding: '4px 8px',
            background: 'rgba(0, 0, 0, 0.3)',
            borderRadius: tokens.radius,
            fontSize: '10px',
            border: '1px solid rgba(168, 85, 247, 0.15)',
          }}
        >
          <div style={{ color: 'rgba(216, 180, 254, 0.7)' }}>
            Session: {sessionId.slice(0, 14)}... · {history.length} turns
            {handoffNotice && <span style={{ color: '#34d399', marginLeft: 8 }}>✦ {handoffNotice}</span>}
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            {history.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={handleHandoffNote}
                  style={{
                    background: 'rgba(216, 180, 254, 0.1)',
                    border: '1px solid rgba(216, 180, 254, 0.3)',
                    color: '#d8b4fe',
                    padding: '2px 6px',
                    borderRadius: '3px',
                    cursor: 'pointer',
                  }}
                  title="Write a structured handoff note to your journal stone"
                >
                  HANDOFF NOTE
                </button>
                <button
                  type="button"
                  onClick={handleExportChatMarkdown}
                  style={{
                    background: 'rgba(216, 180, 254, 0.1)',
                    border: '1px solid rgba(216, 180, 254, 0.3)',
                    color: '#d8b4fe',
                    padding: '2px 6px',
                    borderRadius: '3px',
                    cursor: 'pointer',
                  }}
                  title="Export this conversation to Markdown"
                >
                  EXPORT
                </button>
                <button
                  type="button"
                  onClick={() => setShowForgetModal(true)}
                  style={{
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    color: '#fca5a5',
                    padding: '2px 6px',
                    borderRadius: '3px',
                    cursor: 'pointer',
                  }}
                  title="Forget this conversation and its derived player records"
                >
                  FORGET
                </button>
                <button
                  type="button"
                  onClick={handleManualNewSession}
                  style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    color: '#cbd5e1',
                    padding: '2px 6px',
                    borderRadius: '3px',
                    cursor: 'pointer',
                  }}
                  title="Archive session and start fresh"
                >
                  NEW SESSION
                </button>
              </>
            )}
          </div>
        </div>

        {/* Chat History Scroll */}
        <div
          ref={scrollRef}
          style={{
            flex: 1,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            marginBottom: '12px',
            paddingRight: '6px',
          }}
        >
          {history.length === 0 && !isReplying && (
            <div style={{ color: 'rgba(216, 180, 254, 0.5)', fontSize: '12px', textAlign: 'center', marginTop: 'auto', marginBottom: 'auto' }}>
              The Citadel's engines are humming. What are you building or working through today?
            </div>
          )}

          {history.map((msg) => (
            <div
              key={msg.id}
              style={{
                alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                background: msg.role === 'user' ? 'rgba(30, 27, 40, 0.9)' : 'rgba(24, 15, 36, 0.85)',
                color: msg.role === 'user' ? '#f1f5f9' : '#f5d0fe',
                border: msg.role === 'user' ? '1px solid rgba(168, 85, 247, 0.3)' : '1px solid rgba(192, 132, 252, 0.35)',
                padding: '10px 14px',
                borderRadius: tokens.radius,
                maxWidth: '88%',
                fontSize: '12px',
                lineHeight: '1.55',
                whiteSpace: 'pre-wrap',
                textShadow: msg.role === 'assistant' ? '0 0 4px rgba(232, 121, 249, 0.3)' : 'none',
              }}
            >
              {msg.role === 'assistant' ? (
                <>
                  <div>{renderTermiteseText(msg.content)}</div>
                  {msg.citations && msg.citations.length > 0 && (
                    <div style={{ marginTop: '8px', paddingTop: '6px', borderTop: '1px solid rgba(168, 85, 247, 0.2)' }}>
                      {msg.citations.map((c) => (
                        <CitationChip key={c.id} citation={c} />
                      ))}
                    </div>
                  )}
                </>
              ) : (
                msg.content
              )}
            </div>
          ))}

          {/* Streaming Assistant Response */}
          {isReplying && (
            <div
              style={{
                alignSelf: 'flex-start',
                background: 'rgba(24, 15, 36, 0.85)',
                color: '#f5d0fe',
                border: '1px solid rgba(192, 132, 252, 0.35)',
                padding: '10px 14px',
                borderRadius: tokens.radius,
                maxWidth: '88%',
                fontSize: '12px',
                lineHeight: '1.55',
                whiteSpace: 'pre-wrap',
                textShadow: '0 0 4px rgba(232, 121, 249, 0.3)',
              }}
            >
              {streamingText ? (
                renderTermiteseText(streamingText)
              ) : (
                <span style={{ color: 'rgba(216, 180, 254, 0.5)' }}>
                  Listening...
                </span>
              )}
            </div>
          )}
        </div>

        {/* Input Bar */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Talk to Sigma..."
            disabled={isReplying}
            style={{
              flex: 1,
              background: 'rgba(0, 0, 0, 0.5)',
              border: '1px solid rgba(168, 85, 247, 0.3)',
              color: '#f1f5f9',
              padding: '10px 14px',
              borderRadius: tokens.radius,
              fontSize: '12px',
              fontFamily: tokens.fontMono,
              outline: 'none',
            }}
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={isReplying || !input.trim()}
            style={{
              background: input.trim() && !isReplying ? 'rgba(168, 85, 247, 0.25)' : 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(168, 85, 247, 0.4)',
              color: input.trim() && !isReplying ? '#f5d0fe' : 'rgba(255, 255, 255, 0.3)',
              padding: '0 16px',
              borderRadius: tokens.radius,
              fontSize: '11px',
              fontWeight: 'bold',
              fontFamily: tokens.fontMono,
              cursor: input.trim() && !isReplying ? 'pointer' : 'default',
            }}
          >
            TRANSMIT ↵
          </button>
        </div>
      </div>

      {/* Modals */}
      {showWhatKnows && <WhatSigmaKnowsModal onClose={() => setShowWhatKnows(false)} />}
      {showGrowthFeed && <GrowthFeedModal onClose={() => setShowGrowthFeed(false)} />}
      {showForgetModal && (
        <ForgetConversationModal
          turnCount={history.length}
          onConfirm={handleConfirmForget}
          onCancel={() => setShowForgetModal(false)}
        />
      )}
    </div>
  );
}
