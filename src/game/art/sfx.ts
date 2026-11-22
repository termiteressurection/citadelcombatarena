/** Procedural PS1 Hard-Light WebAudio Synthesizer — crisp, zero-asset combat & cycle audio. */

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noiseBuf: AudioBuffer | null = null;

function ensureCtx(): { ctx: AudioContext; out: GainNode } | null {
  if (typeof window === 'undefined') return null;
  const AudioCtor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtor) return null;
  if (!ctx) {
    try {
      ctx = new AudioCtor();
      master = ctx.createGain();
      master.gain.value = 0.28;
      master.connect(ctx.destination);
      const len = Math.floor(ctx.sampleRate * 0.5);
      noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    } catch {
      return null;
    }
  }
  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }
  return master ? { ctx, out: master } : null;
}

function tone(
  type: OscillatorType,
  f0: number,
  f1: number,
  dur: number,
  gainPeak: number,
  delay = 0,
): void {
  const sys = ensureCtx();
  if (!sys) return;
  const { ctx: c, out } = sys;
  const t = c.currentTime + delay;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(Math.max(20, f0), t);
  osc.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(gainPeak, t + Math.min(0.012, dur * 0.25));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g);
  g.connect(out);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

function noise(
  filterType: BiquadFilterType,
  freq0: number,
  freq1: number,
  q: number,
  dur: number,
  gainPeak: number,
  delay = 0,
): void {
  const sys = ensureCtx();
  if (!sys || !noiseBuf) return;
  const { ctx: c, out } = sys;
  const t = c.currentTime + delay;
  const src = c.createBufferSource();
  src.buffer = noiseBuf;
  const flt = c.createBiquadFilter();
  flt.type = filterType;
  flt.Q.value = q;
  flt.frequency.setValueAtTime(freq0, t);
  flt.frequency.exponentialRampToValueAtTime(Math.max(40, freq1), t + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(gainPeak, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(flt);
  flt.connect(g);
  g.connect(out);
  src.start(t);
  src.stop(t + dur + 0.02);
}

export const sfx = {
  swing(heavy = false): void {
    tone('triangle', heavy ? 310 : 440, heavy ? 85 : 130, heavy ? 0.2 : 0.12, heavy ? 0.42 : 0.28);
    noise('bandpass', heavy ? 1100 : 1700, heavy ? 280 : 420, 1.4, heavy ? 0.22 : 0.13, heavy ? 0.45 : 0.3);
  },

  hit(heavy = false, riposte = false): void {
    tone('sine', heavy || riposte ? 145 : 125, 34, heavy ? 0.22 : 0.14, heavy ? 0.85 : 0.62);
    noise('bandpass', 1900, 420, 0.9, heavy ? 0.14 : 0.09, heavy ? 0.55 : 0.36);
    if (riposte) {
      tone('triangle', 920, 1840, 0.22, 0.34, 0.01);
    }
  },

  parry(): void {
    tone('sine', 125, 40, 0.18, 0.72);
    tone('triangle', 880, 910, 0.34, 0.42);
    tone('sine', 1320, 1340, 0.38, 0.32);
    tone('triangle', 2420, 2180, 0.26, 0.24);
  },

  block(): void {
    tone('square', 340, 190, 0.1, 0.25);
    tone('triangle', 620, 410, 0.11, 0.22);
    noise('highpass', 1800, 1100, 1.2, 0.07, 0.2);
  },

  guardBreak(): void {
    tone('sawtooth', 165, 32, 0.28, 0.62);
    tone('square', 540, 120, 0.22, 0.32);
    noise('bandpass', 2400, 320, 1.0, 0.24, 0.55);
  },

  sever(): void {
    tone('sine', 150, 28, 0.3, 0.82);
    tone('sawtooth', 780, 1600, 0.16, 0.3);
    noise('highpass', 2200, 700, 1.1, 0.18, 0.42);
  },

  execute(): void {
    tone('sine', 160, 26, 0.42, 0.95);
    tone('triangle', 440, 880, 0.28, 0.34, 0.02);
    tone('triangle', 660, 1320, 0.34, 0.3, 0.06);
    noise('bandpass', 2800, 380, 0.8, 0.3, 0.52);
  },

  dodge(): void {
    noise('bandpass', 750, 2400, 1.6, 0.14, 0.28);
    tone('sine', 240, 420, 0.12, 0.18);
  },

  cycle(on: boolean): void {
    if (on) {
      tone('sawtooth', 95, 340, 0.26, 0.26);
      tone('triangle', 210, 620, 0.24, 0.22, 0.04);
    } else {
      tone('triangle', 360, 85, 0.2, 0.22);
    }
  },

  boost(): void {
    tone('sawtooth', 140, 520, 0.28, 0.3);
    noise('bandpass', 900, 3200, 1.2, 0.25, 0.34);
  },

  taunt(): void {
    tone('triangle', 220, 440, 0.2, 0.32);
    tone('triangle', 330, 660, 0.24, 0.28, 0.05);
    noise('bandpass', 800, 2200, 1.4, 0.28, 0.25, 0.04);
  },

  restoreWave(): void {
    tone('sine', 261.63, 523.25, 0.45, 0.35);
    tone('triangle', 329.63, 659.25, 0.48, 0.3, 0.08);
    tone('triangle', 392.0, 783.99, 0.52, 0.28, 0.16);
  },

  isMusicEnabled(): boolean {
    return musicEnabled;
  },

  setMusicEnabled(on: boolean): void {
    musicEnabled = on;
  },

  toggleMusic(): boolean {
    musicEnabled = !musicEnabled;
    return musicEnabled;
  },

  /** Procedural adaptive PS1 synthwave step sequencer shifting cleanly across biomes, combat & turbo rides. */
  stepMusic(opts: { biome: string; combat: boolean; onCycle: boolean; dt?: number }): void {
    if (!musicEnabled || typeof window === 'undefined') return;
    const stepDur = opts.combat ? 0.175 : opts.onCycle ? 0.165 : 0.26;
    musicAcc += opts.dt ?? 0.016;
    if (musicAcc < stepDur) return;
    musicAcc = 0;

    const scale = BIOME_SCALES[opts.biome] ?? BIOME_SCALES.metropolis;
    const step = musicStep++;
    const bassFreq = scale[step % 4] * (opts.combat ? 0.5 : 0.5);
    tone(opts.onCycle ? 'sawtooth' : 'triangle', bassFreq, bassFreq * 0.99, stepDur * 0.85, opts.combat ? 0.11 : 0.07);

    if (step % 2 === 0 || opts.onCycle) {
      const leadFreq = scale[(step * 3 + (opts.combat ? 2 : 0)) % scale.length] * (opts.combat ? 2 : 1.5);
      tone('sine', leadFreq, leadFreq, stepDur * 0.72, opts.combat ? 0.065 : 0.045, 0.01);
    }
    if (opts.combat && step % 4 === 0) {
      tone('sine', 110, 38, 0.12, 0.24);
    }
  },
};

let musicEnabled = true;
let musicAcc = 0;
let musicStep = 0;
const BIOME_SCALES: Record<string, number[]> = {
  metropolis: [110, 130.81, 146.83, 164.81, 196.0, 220],
  bazaar: [116.54, 138.59, 155.56, 174.61, 207.65, 233.08],
  vault: [98.0, 116.54, 130.81, 146.83, 174.61, 196.0],
  frontier: [87.31, 103.83, 116.54, 130.81, 155.56, 174.61],
  kernel: [130.81, 164.81, 196.0, 246.94, 261.63, 329.63],
};
