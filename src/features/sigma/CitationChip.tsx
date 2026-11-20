import React, { useState } from 'react';
import type { CitationChipData, CitationSourceType } from '@/core/sigma/sigmaLeash';
import { formatCitationDate } from '@/core/sigma/sigmaLeash';

interface Props {
  citation: CitationChipData;
  onOpenSource?: (citation: CitationChipData) => void;
}

const SOURCE_THEMES: Record<
  CitationSourceType,
  { label: string; fullName: string; border: string; bg: string; text: string; icon: string }
> = {
  journal: {
    label: 'Journal',
    fullName: 'Journal Entry',
    border: 'border-emerald-500/40',
    bg: 'bg-emerald-950/40',
    text: 'text-emerald-300',
    icon: '✦',
  },
  chat: {
    label: 'Chat',
    fullName: 'Prior Conversation',
    border: 'border-indigo-500/40',
    bg: 'bg-indigo-950/40',
    text: 'text-indigo-300',
    icon: '💬',
  },
  synaptic: {
    label: 'Synaptic',
    fullName: 'Synaptic Vault Dialectic',
    border: 'border-fuchsia-500/40',
    bg: 'bg-fuchsia-950/40',
    text: 'text-fuchsia-300',
    icon: '🔮',
  },
  mindmap: {
    label: 'Mind Map',
    fullName: 'Global Mind Map Concept',
    border: 'border-cyan-500/40',
    bg: 'bg-cyan-950/40',
    text: 'text-cyan-300',
    icon: '🕸',
  },
  activity: {
    label: 'Altar',
    fullName: 'Citadel Altar & Rituals',
    border: 'border-purple-500/40',
    bg: 'bg-purple-950/40',
    text: 'text-purple-300',
    icon: '⛩',
  },
  profile: {
    label: 'Profile',
    fullName: 'Traveler Profile & MBTI',
    border: 'border-sky-500/40',
    bg: 'bg-sky-950/40',
    text: 'text-sky-300',
    icon: '👤',
  },
};

export function CitationChip({ citation, onOpenSource }: Props) {
  const [showDetail, setShowDetail] = useState(false);

  const theme = SOURCE_THEMES[citation.sourceType] || SOURCE_THEMES.journal;
  const dateStr = formatCitationDate(citation.sourceDate);

  return (
    <div className="relative inline-block my-1 mr-2 text-xs">
      <button
        type="button"
        onClick={() => {
          setShowDetail(!showDetail);
          if (onOpenSource) onOpenSource(citation);
        }}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border ${theme.border} ${theme.bg} ${theme.text} hover:brightness-125 transition-all font-mono shadow-sm cursor-pointer`}
        title="Tap to inspect source record provenance"
      >
        <span className="font-bold text-[11px]">{theme.icon}</span>
        <span>[{dateStr} • {theme.label}]</span>
        <span className="max-w-[140px] truncate opacity-90">
          “{citation.snippet}”
        </span>
        <span className="text-[10px] opacity-60">↗</span>
      </button>

      {showDetail && (
        <div className="absolute z-50 bottom-full left-0 mb-1.5 w-80 p-3 rounded-lg border border-purple-500/60 bg-gray-950/95 backdrop-blur-md shadow-2xl text-xs font-mono text-purple-100">
          <div className="flex justify-between items-center pb-1.5 mb-1.5 border-b border-purple-800/40">
            <span className="font-bold text-purple-300 flex items-center gap-1.5">
              <span>{theme.icon}</span> VERIFIED CITADEL PROVENANCE
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowDetail(false);
              }}
              className="text-gray-400 hover:text-white"
            >
              ✕
            </button>
          </div>
          <div className="space-y-1 text-[11px]">
            <div><span className="text-gray-400">Date:</span> {citation.sourceDate}</div>
            <div><span className="text-gray-400">Store:</span> <span className={theme.text}>{theme.fullName}</span></div>
            {citation.eventId && (
              <div className="truncate text-gray-500">
                <span className="text-gray-400">Event ID:</span> {citation.eventId}
              </div>
            )}
            {citation.timestamp && (
              <div className="truncate text-gray-500">
                <span className="text-gray-400">Recorded:</span> {citation.timestamp}
              </div>
            )}
            <div className="mt-2 pt-2 border-t border-purple-900/40 italic text-purple-200">
              “{citation.snippet}”
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
