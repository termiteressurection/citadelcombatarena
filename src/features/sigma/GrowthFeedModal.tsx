import React, { useState, useEffect } from 'react';
import { loadPlayerModel } from '@/core/player-model/playerModelStore';
import type { GrowthFeedEvent } from '@/core/player-model/playerModelTypes';

interface Props {
  onClose: () => void;
}

export function GrowthFeedModal({ onClose }: Props) {
  const [feed, setFeed] = useState<GrowthFeedEvent[]>([]);

  useEffect(() => {
    void (async () => {
      const data = await loadPlayerModel();
      setFeed(data.growthFeed || []);
    })();
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 font-mono">
      <div className="flex flex-col w-full max-w-2xl h-[80vh] bg-gray-950 border border-purple-500/50 rounded-xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-purple-900/40 bg-purple-950/20">
          <div>
            <h2 className="text-lg font-bold text-purple-200 tracking-wider">
              GROWTH FEED
            </h2>
            <p className="text-xs text-purple-400/80">
              Chronological log of memories, reinforcements, and model adjustments.
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

        {/* Feed List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          {feed.length === 0 ? (
            <div className="text-center py-12 text-purple-400/50 text-sm">
              The growth feed is quiet.
              <div className="text-xs text-purple-500/40 mt-1">
                As you journal and converse with Sigma, new memories and adjustments will be logged here.
              </div>
            </div>
          ) : (
            feed.map((item) => {
              const typeColor =
                item.type === 'created'
                  ? 'text-emerald-400 border-emerald-900/50 bg-emerald-950/20'
                  : item.type === 'reinforced'
                  ? 'text-cyan-400 border-cyan-900/50 bg-cyan-950/20'
                  : item.type === 'corrected'
                  ? 'text-amber-400 border-amber-900/50 bg-amber-950/20'
                  : 'text-red-400 border-red-900/50 bg-red-950/20';

              const badge = item.type.toUpperCase();
              const dateStr = item.timestamp ? new Date(item.timestamp).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';

              return (
                <div
                  key={item.id}
                  className="flex items-start gap-3 p-3 rounded-lg border border-purple-900/30 bg-purple-950/10 text-xs"
                >
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${typeColor}`}>
                    {badge}
                  </span>
                  <div className="flex-1 space-y-0.5">
                    <div className="text-purple-200">
                      {item.summary}
                    </div>
                    <div className="text-[11px] text-purple-400/50">
                      {dateStr}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
