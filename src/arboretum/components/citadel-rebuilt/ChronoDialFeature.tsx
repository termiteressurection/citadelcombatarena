import { useState, useEffect, useRef } from 'react';
import { Chamber } from './types';
import { findDayChamberIdByLocalDate } from './calendarChamberUtils';

interface Props {
  open: boolean;
  onClose: () => void;
  chambers: Record<number, Chamber>;
  onEnterChamber: (id: number) => void;
}

export default function ChronoDialFeature({ open, onClose, chambers, onEnterChamber }: Props) {
  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [month, setMonth] = useState('');
  const [day, setDay] = useState('');
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
      setYear(new Date().getFullYear().toString());
      setMonth('');
      setDay('');
      setError(null);
    }
  }, [open]);

  if (!open) return null;

  const handleJump = () => {
    setError(null);
    const y = year.trim();
    const m = month.trim().padStart(2, '0');
    const d = day.trim().padStart(2, '0');

    if (y && month.trim() && day.trim()) {
      const dateIso = `${y}-${m}-${d}`;
      const id = findDayChamberIdByLocalDate(chambers, dateIso);
      if (id !== null) {
        onEnterChamber(id);
        onClose();
        return;
      }
      setError('NULL_CELL');
      return;
    }

    if (y && month.trim()) {
      const monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
      const mIdx = parseInt(m, 10) - 1;
      const targetMonth = Object.values(chambers).find(c => 
        c.template === 'month' && 
        c.name.toUpperCase().includes(y) && 
        (mIdx >= 0 && c.name.toUpperCase().includes(monthNames[mIdx]))
      );
      if (targetMonth) {
        onEnterChamber(targetMonth.id);
        onClose();
        return;
      }
      setError('NULL_MONTH');
      return;
    }

    if (y) {
      const yearMatch = Object.values(chambers).find(c => 
        c.template === 'calendar-root' && c.name.includes(y)
      );
      if (yearMatch) {
        onEnterChamber(yearMatch.id);
        onClose();
        return;
      }
      setError('NULL_YEAR');
      return;
    }
    setError('VOID_INPUT');
  };

  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/60 backdrop-blur-md">
      {/* Retro Monitor Bezel */}
      <div className="relative w-96 rounded-3xl border-[12px] border-[#1a1510] bg-[#0a0805] p-2 shadow-[0_0_80px_rgba(0,0,0,0.8),inset_0_0_20px_rgba(245,158,11,0.05)]">
        
        {/* The Screen Surface */}
        <div className="relative overflow-hidden rounded-xl bg-[#0c0802] p-8 shadow-inner">
          
          {/* CRT Effects: Scanlines, Flicker, Pixel-Grid */}
          <div className="pointer-events-none absolute inset-0 z-20">
            {/* Scanlines */}
            <div className="absolute inset-0 opacity-[0.12]" 
                 style={{ backgroundImage: 'linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.4) 50%)', backgroundSize: '100% 3px' }} />
            {/* Pixel Grid */}
            <div className="absolute inset-0 opacity-[0.05]" 
                 style={{ backgroundImage: 'radial-gradient(rgba(245, 158, 11, 0.2) 1px, transparent 0)', backgroundSize: '4px 4px' }} />
            {/* Screen Flicker / Jitter */}
            <div className="animate-flicker absolute inset-0 bg-amber-500/5 opacity-[0.02]" />
          </div>

          <div className="relative z-10 flex flex-col space-y-10 font-mono text-amber-500/90">
            <div className="flex items-end justify-between space-x-4">
              <div className="flex flex-col">
                <span className="text-[10px] opacity-40 blur-[0.3px]">Y</span>
                <input
                  ref={inputRef}
                  type="text"
                  maxLength={4}
                  value={year}
                  onChange={e => setYear(e.target.value)}
                  className="w-20 border-b border-amber-500/30 bg-transparent py-2 text-2xl outline-none focus:border-amber-400 focus:text-amber-300 transition-colors placeholder:opacity-20 shadow-[0_5px_15px_-5px_rgba(245,158,11,0.1)]"
                />
              </div>
              <span className="mb-2 text-2xl opacity-10">/</span>
              <div className="flex flex-col">
                <span className="text-[10px] opacity-40 blur-[0.3px]">M</span>
                <input
                  type="text"
                  maxLength={2}
                  value={month}
                  onChange={e => setMonth(e.target.value)}
                  className="w-14 border-b border-amber-500/30 bg-transparent py-2 text-2xl outline-none focus:border-amber-400 focus:text-amber-300 transition-colors"
                />
              </div>
              <span className="mb-2 text-2xl opacity-10">/</span>
              <div className="flex flex-col">
                <span className="text-[10px] opacity-40 blur-[0.3px]">D</span>
                <input
                  type="text"
                  maxLength={2}
                  value={day}
                  onChange={e => setDay(e.target.value)}
                  className="w-14 border-b border-amber-500/30 bg-transparent py-2 text-2xl outline-none focus:border-amber-400 focus:text-amber-300 transition-colors"
                />
              </div>
            </div>

            <div className="flex flex-col space-y-6">
              {error && (
                <div className="text-[9px] text-red-500/90 tracking-[0.4em] blur-[0.2px]">
                  &gt; ERROR_{error}
                </div>
              )}
              
              <div className="flex flex-col space-y-2">
                <button
                  onClick={handleJump}
                  className="bg-amber-600/10 py-4 text-xs font-bold tracking-[0.5em] text-amber-500/80 border border-amber-500/20 hover:bg-amber-500/20 hover:border-amber-500/50 hover:text-amber-400 transition-all active:scale-[0.98] shadow-[0_0_20px_rgba(245,158,11,0.05)]"
                >
                  DRIFT
                </button>
                <button
                  onClick={onClose}
                  className="py-2 text-[9px] tracking-[0.2em] opacity-30 hover:opacity-100 transition-opacity uppercase"
                >
                  Terminate_Session [ESC]
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
