import { useCallback, useRef } from 'react';

type SFXName = 'write' | 'delete' | 'portal' | 'attack' | 'pickup' | 'open' | 'close' | 'step';

const SFX_DEFS: Record<SFXName, { freq: number; type: OscillatorType; duration: number; ramp?: number; freq2?: number }> = {
  write:  { freq: 880, type: 'sine', duration: 0.08, ramp: 0.02 },
  delete: { freq: 300, type: 'sawtooth', duration: 0.12, ramp: 0.04, freq2: 150 },
  portal: { freq: 220, type: 'sine', duration: 0.3, ramp: 0.1, freq2: 660 },
  attack: { freq: 150, type: 'square', duration: 0.1, ramp: 0.02, freq2: 80 },
  pickup: { freq: 523, type: 'sine', duration: 0.15, ramp: 0.05, freq2: 784 },
  open:   { freq: 440, type: 'sine', duration: 0.1, ramp: 0.03, freq2: 660 },
  close:  { freq: 660, type: 'sine', duration: 0.08, ramp: 0.02, freq2: 330 },
  step:   { freq: 100, type: 'triangle', duration: 0.04, ramp: 0.01 },
};

export function useSoundEffects(volume = 0.3) {
  const ctxRef = useRef<AudioContext | null>(null);

  const getCtx = useCallback(() => {
    if (!ctxRef.current) ctxRef.current = new AudioContext();
    if (ctxRef.current.state === 'suspended') ctxRef.current.resume();
    return ctxRef.current;
  }, []);

  const play = useCallback((name: SFXName) => {
    try {
      const ctx = getCtx();
      const def = SFX_DEFS[name];
      if (!def) return;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = def.type;
      osc.frequency.setValueAtTime(def.freq, ctx.currentTime);
      if (def.freq2) {
        osc.frequency.linearRampToValueAtTime(def.freq2, ctx.currentTime + def.duration);
      }

      gain.gain.setValueAtTime(volume, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + def.duration);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + def.duration + 0.01);
    } catch { /* audio not available */ }
  }, [getCtx, volume]);

  return { play };
}
