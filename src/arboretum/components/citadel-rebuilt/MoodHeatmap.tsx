import { useMemo } from 'react';

const MOOD_COLORS: Record<string, string> = {
  calm: '#34d399', happy: '#fbbf24', excited: '#ec4899', sad: '#6366f1',
  anxious: '#f97316', angry: '#ef4444', reflective: '#a855f7', hopeful: '#22d3ee',
  tired: '#64748b', grateful: '#fbbf24', confused: '#c084fc', peaceful: '#34d399',
};

interface Props {
  moodLog: { date: string; mood: string }[];
  onClose: () => void;
}

export default function MoodHeatmap({ moodLog, onClose }: Props) {
  const weeks = useMemo(() => {
    const now = new Date();
    const daysToShow = 364;
    const grid: { date: string; mood: string | null; day: number; week: number }[] = [];
    for (let i = 0; i <= daysToShow; i++) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (daysToShow - i));
      const dateStr = d.toISOString().slice(0, 10);
      const entry = moodLog.find(m => m.date === dateStr);
      grid.push({ date: dateStr, mood: entry?.mood || null, day: d.getDay(), week: Math.floor(i / 7) });
    }
    return grid;
  }, [moodLog]);

  const moodCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const m of moodLog) counts[m.mood] = (counts[m.mood] || 0) + 1;
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [moodLog]);

  const CELL = 10;
  const GAP = 2;
  const DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/95" onClick={onClose}>
      <div className="flex flex-col items-center gap-4" onClick={e => e.stopPropagation()}>
        <div className="text-purple-300 font-mono text-lg">MOOD JOURNAL HEATMAP</div>
        <div className="text-purple-600 font-mono text-xs">Past 365 days</div>
        <div className="flex gap-1">
          <div className="flex flex-col gap-0" style={{ marginTop: 16 }}>
            {DAYS.map((d, i) => (
              <div key={i} className="text-[8px] font-mono text-purple-700" style={{ height: CELL + GAP, lineHeight: `${CELL + GAP}px` }}>{d}</div>
            ))}
          </div>
          <div className="flex gap-0 overflow-x-auto max-w-[650px]">
            {Array.from({ length: 53 }, (_, week) => (
              <div key={week} className="flex flex-col gap-0">
                {Array.from({ length: 7 }, (_, day) => {
                  const cell = weeks.find(c => c.week === week && c.day === day);
                  const color = cell?.mood ? (MOOD_COLORS[cell.mood] || '#7c3aed') : '#0a0414';
                  return (
                    <div key={day} title={cell ? `${cell.date}: ${cell.mood || 'none'}` : ''}
                      style={{ width: CELL, height: CELL, margin: GAP / 2, background: color, borderRadius: 2, opacity: cell?.mood ? 0.7 : 0.15, border: '1px solid #1e0d3a33' }} />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap gap-3 max-w-[500px] justify-center">
          {moodCounts.slice(0, 10).map(([mood, count]) => (
            <div key={mood} className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-sm" style={{ background: MOOD_COLORS[mood] || '#7c3aed' }} />
              <span className="text-[10px] font-mono text-purple-400">{mood} ({count})</span>
            </div>
          ))}
        </div>
        <div className="text-purple-700 font-mono text-[10px]">{moodLog.length} mood entries logged</div>
        <button onClick={onClose} className="px-4 py-1 text-xs font-mono text-purple-400 border border-purple-800 hover:bg-purple-900/30">CLOSE</button>
      </div>
    </div>
  );
}
