import React, { useState, useEffect } from 'react';
import {
  loadPlayerModel,
  correctPlayerRecord,
  deletePlayerRecord,
  exportPlayerModelJson,
  exportPlayerModelMarkdown,
} from '@/core/player-model/playerModelStore';
import type { PlayerModelRecord, PlayerModelCategory } from '@/core/player-model/playerModelTypes';

interface Props {
  onClose: () => void;
}

const CATEGORIES: Array<{ key: PlayerModelCategory; title: string; desc: string }> = [
  { key: 'commitments', title: 'Commitments & Open Loops', desc: 'Active intentions, deadlines, and promises' },
  { key: 'facts', title: 'Stated Facts', desc: 'Projects, roles, places, and stable context' },
  { key: 'preferences', title: 'Preferences', desc: 'Working styles, likes, and creative habits' },
  { key: 'people', title: 'People', desc: 'Names and context as you stated them' },
  { key: 'themes', title: 'Recurring Themes', desc: 'Observed creative and philosophical threads' },
];

export function WhatSigmaKnowsModal({ onClose }: Props) {
  const [records, setRecords] = useState<PlayerModelRecord[]>([]);
  const [selectedCat, setSelectedCat] = useState<PlayerModelCategory>('commitments');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [exportNotice, setExportNotice] = useState<string | null>(null);

  const refresh = async () => {
    const data = await loadPlayerModel();
    setRecords(data.records);
  };

  useEffect(() => {
    void refresh();
  }, []);

  const handleStartEdit = (rec: PlayerModelRecord) => {
    setEditingId(rec.id);
    setEditText(rec.claim);
  };

  const handleSaveEdit = async (recId: string) => {
    if (!editText.trim()) return;
    await correctPlayerRecord(recId, editText.trim());
    setEditingId(null);
    setEditText('');
    await refresh();
  };

  const handleDelete = async (recId: string) => {
    await deletePlayerRecord(recId);
    await refresh();
  };

  const handleExportJson = () => {
    const data = exportPlayerModelJson();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `citadel-player-model-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setExportNotice('Exported Player Model as JSON');
    setTimeout(() => setExportNotice(null), 3000);
  };

  const handleExportMarkdown = () => {
    const data = exportPlayerModelMarkdown();
    const blob = new Blob([data], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `citadel-player-model-${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
    setExportNotice('Exported Player Model as Markdown');
    setTimeout(() => setExportNotice(null), 3000);
  };

  const activeRecords = records.filter((r) => r.status === 'active' && r.category === selectedCat);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 font-mono">
      <div className="flex flex-col w-full max-w-3xl h-[85vh] bg-gray-950 border border-purple-500/50 rounded-xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-purple-900/40 bg-purple-950/20">
          <div>
            <h2 className="text-lg font-bold text-purple-200 tracking-wider">
              WHAT SIGMA KNOWS
            </h2>
            <p className="text-xs text-purple-400/80">
              Your inspectable, auditable memory model. Nothing is hidden; player corrections outrank extraction.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-xs font-bold text-purple-300 border border-purple-600/40 rounded hover:bg-purple-900/40 cursor-pointer"
          >
            ESC / CLOSE
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-purple-900/30 bg-black/40 overflow-x-auto text-xs">
          {CATEGORIES.map((cat) => {
            const count = records.filter((r) => r.status === 'active' && r.category === cat.key).length;
            const isSel = selectedCat === cat.key;
            return (
              <button
                key={cat.key}
                type="button"
                onClick={() => setSelectedCat(cat.key)}
                className={`px-4 py-2.5 whitespace-nowrap transition-colors border-b-2 cursor-pointer flex items-center gap-1.5 ${
                  isSel
                    ? 'border-purple-400 text-purple-200 bg-purple-950/40 font-bold'
                    : 'border-transparent text-purple-400/60 hover:text-purple-300 hover:bg-purple-950/20'
                }`}
              >
                <span>{cat.title}</span>
                <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-purple-900/50 text-purple-300">
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Content list */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          {activeRecords.length === 0 ? (
            <div className="text-center py-12 text-purple-400/50 text-sm">
              No active records in this category yet.
              <div className="text-xs text-purple-500/40 mt-1">
                Sigma derives records solely from your conversations and verified journal stones.
              </div>
            </div>
          ) : (
            activeRecords.map((rec) => {
              const isEditing = editingId === rec.id;
              return (
                <div
                  key={rec.id}
                  className="p-4 rounded-lg border border-purple-900/50 bg-purple-950/20 hover:border-purple-500/40 transition-all text-xs"
                >
                  {isEditing ? (
                    <div className="space-y-2">
                      <input
                        type="text"
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        className="w-full px-3 py-2 bg-black/80 border border-purple-500 rounded text-purple-100 text-xs focus:outline-none"
                        autoFocus
                      />
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="px-2.5 py-1 text-gray-400 hover:text-white border border-gray-700 rounded cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleSaveEdit(rec.id)}
                          className="px-2.5 py-1 bg-purple-700 hover:bg-purple-600 text-white rounded font-bold cursor-pointer"
                        >
                          Save Correction
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1.5 flex-1">
                        <div className="text-purple-100 font-semibold text-sm">
                          “{rec.claim}”
                        </div>
                        <div className="flex flex-wrap gap-3 text-[11px] text-purple-400/70">
                          <span>
                            Source: <strong className="text-purple-300">{rec.sourceType} ({rec.sourceDate})</strong>
                          </span>
                          <span>
                            Confidence: <strong className="text-purple-300">{(rec.confidence * 100).toFixed(0)}%</strong>
                          </span>
                          <span>
                            First seen: {rec.firstSeen.slice(0, 10)}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleStartEdit(rec)}
                          className="px-2.5 py-1 text-purple-300 border border-purple-800/60 rounded hover:bg-purple-900/40 hover:border-purple-500 cursor-pointer"
                        >
                          Correct
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDelete(rec.id)}
                          className="px-2.5 py-1 text-red-400 border border-red-900/60 rounded hover:bg-red-950/40 hover:border-red-500 cursor-pointer"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer controls & Export */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-purple-900/40 bg-black/60 text-xs">
          <div className="flex items-center gap-3">
            <span className="text-purple-400/60">Export Model:</span>
            <button
              type="button"
              onClick={handleExportMarkdown}
              className="px-2.5 py-1 border border-purple-800/60 rounded hover:bg-purple-900/40 text-purple-300 cursor-pointer"
            >
              Markdown (.md)
            </button>
            <button
              type="button"
              onClick={handleExportJson}
              className="px-2.5 py-1 border border-purple-800/60 rounded hover:bg-purple-900/40 text-purple-300 cursor-pointer"
            >
              JSON (.json)
            </button>
            {exportNotice && <span className="text-emerald-400 ml-2">{exportNotice}</span>}
          </div>
          <div className="text-[11px] text-purple-400/50">
            Encrypted in Argon2id Vault • Full Wipe Clears All
          </div>
        </div>
      </div>
    </div>
  );
}
