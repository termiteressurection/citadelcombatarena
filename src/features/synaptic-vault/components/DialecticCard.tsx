import { useEffect, useState } from 'react';
import type { SynapticAnswerValue, SynapticQuestion } from '@/core/model/types';
import { tokens } from '@/app/styles';

export function DialecticCard({ question, onCommit }: { question: SynapticQuestion; onCommit: (value: SynapticAnswerValue, notes?: string) => void }) {
  const [inscription, setInscription] = useState('');
  const [spectrum, setSpectrum] = useState(3);
  useEffect(() => { setInscription(''); setSpectrum(3); }, [question.id]);
  useEffect(() => {
    const keypress = (event: KeyboardEvent) => {
      if (question.type === 'binary' && /^[yn]$/i.test(event.key)) onCommit(event.key.toLowerCase() === 'y');
      if (question.type === 'prism' && /^[a-d]$/i.test(event.key)) {
        const option = question.options?.[event.key.toLowerCase().charCodeAt(0) - 97];
        if (option) onCommit(option);
      }
      if (question.type === 'spectrum' && /^[1-5]$/.test(event.key)) onCommit(Number(event.key));
    };
    window.addEventListener('keydown', keypress);
    return () => window.removeEventListener('keydown', keypress);
  }, [onCommit, question]);

  const buttonStyle = { background: 'transparent', border: `1px solid ${tokens.border}`, color: tokens.text, padding: '12px', fontFamily: tokens.fontMono, cursor: 'pointer', borderRadius: tokens.radius };
  return <section style={{ border: `1px solid ${tokens.border}`, padding: tokens.gapLg, background: 'rgba(0, 0, 0, 0.2)' }}>
    <div style={{ color: tokens.accent, fontSize: tokens.fontSizeXs, letterSpacing: '0.12em', marginBottom: tokens.gap }}>SECTOR // {question.sector.toUpperCase()}</div>
    <h2 style={{ color: tokens.text, fontSize: tokens.fontSizeLg, fontWeight: 400, margin: `0 0 ${tokens.gapLg}px`, lineHeight: 1.35 }}>{question.prompt}</h2>
    {question.type === 'binary' && <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: tokens.gap }}>
      <button style={{ ...buttonStyle, borderColor: tokens.commune, color: tokens.commune }} onClick={() => onCommit(true)}>Y // YES</button>
      <button style={{ ...buttonStyle, borderColor: tokens.danger, color: tokens.danger }} onClick={() => onCommit(false)}>N // NO</button>
    </div>}
    {question.type === 'spectrum' && <div>
      <input aria-label="Resonance spectrum" type="range" min="1" max="5" value={spectrum} onChange={(event) => setSpectrum(Number(event.target.value))} style={{ width: '100%', accentColor: tokens.accent }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', color: tokens.textDim, fontSize: tokens.fontSizeXs }}><span>DISAGREE</span><span style={{ color: tokens.accent }}>{spectrum} / 5</span><span>AGREE</span></div>
      <button style={{ ...buttonStyle, width: '100%', marginTop: tokens.gap, borderColor: tokens.accent, color: tokens.accent }} onClick={() => onCommit(spectrum)}>COMMIT RESONANCE</button>
    </div>}
    {question.type === 'prism' && <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: tokens.gapSm }}>{question.options?.map((option, index) => <button key={option} style={buttonStyle} onClick={() => onCommit(option)}>{String.fromCharCode(65 + index)} // {option}</button>)}</div>}
    {question.type === 'inscription' && <div>
      <textarea aria-label="Reflection" value={inscription} onChange={(event) => setInscription(event.target.value)} placeholder="INSCRIBE SIGNAL..." style={{ boxSizing: 'border-box', width: '100%', minHeight: 120, background: '#080808', border: `1px solid ${tokens.border}`, color: tokens.text, padding: tokens.gap, fontFamily: tokens.fontMono, resize: 'vertical' }} />
      <button disabled={!inscription.trim()} style={{ ...buttonStyle, width: '100%', marginTop: tokens.gap, opacity: inscription.trim() ? 1 : 0.4, borderColor: tokens.reflect, color: tokens.reflect }} onClick={() => onCommit(inscription.trim())}>COMMIT INSCRIPTION</button>
    </div>}
  </section>;
}