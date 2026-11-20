import { useMemo, useState } from 'react';
import type { GridIdentity, TemperamentKey, CalibrationState } from './types';

type Props = {
  open: boolean;
  onClose: () => void;
  identity: GridIdentity;
  onApply: (patch: Partial<CalibrationState>) => void;
};

const TYPES = [
  'INTJ', 'INTP', 'ENTJ', 'ENTP',
  'INFJ', 'INFP', 'ENFJ', 'ENFP',
  'ISTJ', 'ISFJ', 'ESTJ', 'ESFJ',
  'ISTP', 'ISFP', 'ESTP', 'ESFP',
] as const;

const TEMPERAMENTS: TemperamentKey[] = ['NF', 'NT', 'SP', 'SJ'];

function inferTemperament(mbti: string | null): TemperamentKey | undefined {
  if (!mbti || mbti.length !== 4) return undefined;
  const second = mbti[1];
  const third = mbti[2];
  if (second === 'N' && third === 'F') return 'NF';
  if (second === 'N' && third === 'T') return 'NT';
  if (second === 'S' && third === 'F') return 'SP';
  if (second === 'S' && third === 'T') return 'SJ';
  return undefined;
}

export default function MBTICalibrationOverlay({ open, onClose, identity, onApply }: Props) {
  const current = identity.calibration;
  const [mbti, setMbti] = useState<string>(current?.mbti || '');
  const [temperament, setTemperament] = useState<TemperamentKey | ''>((current?.temperament as TemperamentKey) || '');
  const [confidence, setConfidence] = useState<number>(Math.round((current?.mbtiConfidence || 0.7) * 100));
  const [consent, setConsent] = useState<boolean>(!!current?.consentSigmaPersonalization);

  const derivedTemperament = useMemo(() => inferTemperament(mbti || null), [mbti]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[240] flex items-center justify-center font-mono">
      <button
        aria-label="Close MBTI calibration"
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="relative w-[720px] max-w-[94vw] rounded-md border border-cyan-400/30 bg-[#050813] p-6 shadow-2xl">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-[0.32em] text-cyan-300/60">Sigma Calibration</p>
            <h2 className="mt-1 text-xl uppercase tracking-[0.12em] text-cyan-100">MBTI Profile</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded border border-cyan-400/40 px-2 py-1 text-[10px] uppercase tracking-[0.2em] text-cyan-200/80"
          >
            Close
          </button>
        </div>

        <div className="space-y-5">
          <div>
            <p className="mb-2 text-[11px] uppercase tracking-[0.2em] text-cyan-200/70">Select MBTI Type</p>
            <div className="grid grid-cols-4 gap-2 max-sm:grid-cols-2">
              {TYPES.map((type) => (
                <button
                  key={type}
                  onClick={() => setMbti(type)}
                  className={`rounded border px-2 py-2 text-sm tracking-[0.12em] transition ${mbti === type ? 'border-cyan-300 bg-cyan-400/20 text-cyan-100' : 'border-cyan-700/40 bg-black/20 text-cyan-200/65 hover:border-cyan-500/60'}`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 max-sm:grid-cols-1">
            <div>
              <p className="mb-2 text-[11px] uppercase tracking-[0.2em] text-cyan-200/70">Temperament</p>
              <div className="flex flex-wrap gap-2">
                {TEMPERAMENTS.map((t) => (
                  <button
                    key={t}
                    onClick={() => setTemperament(t)}
                    className={`rounded border px-3 py-2 text-xs tracking-[0.16em] transition ${temperament === t ? 'border-cyan-300 bg-cyan-400/20 text-cyan-100' : 'border-cyan-700/40 bg-black/20 text-cyan-200/65 hover:border-cyan-500/60'}`}
                  >
                    {t}
                  </button>
                ))}
                {derivedTemperament && temperament !== derivedTemperament && (
                  <button
                    onClick={() => setTemperament(derivedTemperament)}
                    className="rounded border border-amber-400/45 bg-amber-400/10 px-3 py-2 text-xs tracking-[0.16em] text-amber-200"
                  >
                    Match {derivedTemperament}
                  </button>
                )}
              </div>
            </div>

            <div>
              <p className="mb-2 text-[11px] uppercase tracking-[0.2em] text-cyan-200/70">Confidence ({confidence}%)</p>
              <input
                type="range"
                min={40}
                max={100}
                step={1}
                value={confidence}
                onChange={(e) => setConfidence(Number(e.target.value))}
                className="w-full accent-cyan-400"
              />
            </div>
          </div>

          <label className="flex items-start gap-3 rounded border border-cyan-700/40 bg-black/25 p-3 text-[11px] text-cyan-100/85">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              className="mt-0.5"
            />
            Allow Sigma to personalize tone using MBTI hints. This is optional and can be turned off any time.
          </label>
        </div>

        <div className="mt-6 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded border border-cyan-700/40 px-4 py-2 text-xs uppercase tracking-[0.2em] text-cyan-200/70"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              onApply({
                status: mbti ? 'complete' : 'in_progress',
                mbti: mbti || undefined,
                temperament: (temperament || derivedTemperament) as TemperamentKey | undefined,
                mbtiConfidence: Math.max(0, Math.min(1, confidence / 100)),
                consentSigmaPersonalization: consent,
                completedAt: mbti ? new Date().toISOString() : undefined,
              });
            }}
            className="rounded border border-cyan-300/50 bg-cyan-400/20 px-4 py-2 text-xs uppercase tracking-[0.2em] text-cyan-100"
          >
            Apply Calibration
          </button>
        </div>
      </div>
    </div>
  );
}
