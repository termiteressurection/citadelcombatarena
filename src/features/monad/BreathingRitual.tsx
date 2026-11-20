import { useState, useEffect, useRef, useCallback } from 'react';

interface Props {
  onComplete?: () => void;
}

export function BreathingRitual({ onComplete }: Props) {
  const [active, setActive] = useState(false);
  const [phase, setPhase] = useState<'READY' | 'INHALE' | 'HOLD' | 'EXHALE' | 'CENTERED'>('READY');
  const [cycleCount, setCycleCount] = useState(0);
  const timerRef = useRef<NodeJS.Timeout[]>([]);

  const clearTimers = () => {
    timerRef.current.forEach(clearTimeout);
    timerRef.current = [];
  };

  useEffect(() => {
    return () => clearTimers();
  }, []);

  const runCycle = useCallback((currentCycle: number) => {
    if (currentCycle >= 3) {
      setPhase('CENTERED');
      setActive(false);
      onComplete?.();
      return;
    }

    // Inhale 4s
    setPhase('INHALE');
    const t1 = setTimeout(() => {
      // Hold 7s
      setPhase('HOLD');
      const t2 = setTimeout(() => {
        // Exhale 8s
        setPhase('EXHALE');
        const t3 = setTimeout(() => {
          setCycleCount(c => c + 1);
          runCycle(currentCycle + 1);
        }, 8000);
        timerRef.current.push(t3);
      }, 7000);
      timerRef.current.push(t2);
    }, 4000);
    timerRef.current.push(t1);
  }, [onComplete]);

  const startRitual = () => {
    clearTimers();
    setActive(true);
    setCycleCount(0);
    runCycle(0);
  };

  const getSphereScale = () => {
    switch (phase) {
      case 'INHALE':
      case 'HOLD':
        return 1.4;
      default:
        return 1.0;
    }
  };

  const getTransitionDuration = () => {
    switch (phase) {
      case 'INHALE':
        return '4s ease-in-out';
      case 'HOLD':
        return '0.2s ease-out';
      case 'EXHALE':
        return '8s ease-in-out';
      default:
        return '0.6s ease-out';
    }
  };

  return (
    <div className="flex flex-col items-center text-center gap-6 max-w-xl font-mono">
      <div className="text-3xl md:text-5xl font-black uppercase tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-[#00f0ff] via-[#a855f7] to-[#ff007f] drop-shadow-[0_0_25px_rgba(168,85,247,0.5)]">
        YOU ARE ALREADY AWAKE
      </div>
      <p className="text-[11px] uppercase tracking-[0.35em] text-[#b0b0c8]/70">
        DECOMPRESS · CLEAR CORTISOL · 4-7-8 PRIMING
      </p>

      {/* Pulsing Breathing Sphere */}
      <div
        className="relative w-44 h-44 rounded-full flex items-center justify-center border-2 border-purple-500/40 shadow-[0_0_50px_rgba(168,85,247,0.25)] transition-transform"
        style={{
          transform: `scale(${getSphereScale()})`,
          transition: `transform ${getTransitionDuration()}`,
        }}
      >
        <div
          className="w-28 h-28 rounded-full bg-gradient-to-tr from-[#00f0ff] via-[#a855f7] to-[#ff007f] filter blur-xl transition-opacity"
          style={{
            opacity: phase === 'INHALE' || phase === 'HOLD' ? 0.85 : 0.25,
            transition: `opacity ${getTransitionDuration()}`,
          }}
        />
        <div className="absolute text-xs font-bold uppercase tracking-[0.25em] text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.8)]">
          {phase}
        </div>
      </div>

      {!active && phase !== 'CENTERED' && (
        <button
          onClick={startRitual}
          className="px-6 py-2.5 rounded border border-purple-500/60 bg-purple-950/20 text-[#b0b0c8] text-xs uppercase tracking-[0.25em] hover:text-[#00f0ff] hover:border-[#00f0ff] hover:shadow-[0_0_20px_rgba(0,240,255,0.3)] transition-all"
        >
          BEGIN 4-7-8 RITUAL
        </button>
      )}

      {active && (
        <div className="text-[10px] uppercase tracking-[0.2em] text-[#00f0ff]">
          CYCLE {cycleCount + 1} OF 3
        </div>
      )}

      {phase === 'CENTERED' && (
        <div className="text-xs uppercase tracking-[0.25em] text-[#ccff00] drop-shadow-[0_0_10px_rgba(204,255,0,0.5)]">
          ✓ PRIMING COMPLETE · MIND GROUNDED
        </div>
      )}
    </div>
  );
}
