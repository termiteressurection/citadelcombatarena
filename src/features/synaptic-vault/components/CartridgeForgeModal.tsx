import { useRef, useState } from 'react';
import { Download, Upload, X } from 'lucide-react';
import type { SynapticQuestionType } from '@/core/model/types';
import { useCitadelStore } from '@/core/state/citadelStore';
import { assertImportByteLength } from '@/core/persistence/importLimits';
import { deckTemplates, parseSynapticDeck } from '../cartridgeParser';
import { tokens } from '@/app/styles';

export function CartridgeForgeModal({ onClose }: { onClose: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const importDeck = useCitadelStore((store) => store.importSynapticDeck);
  const saveQuestion = useCitadelStore((store) => store.saveCustomSynapticQuestion);
  const state = useCitadelStore((store) => store.state);
  const [message, setMessage] = useState('');
  const [draft, setDraft] = useState({ sector: 'Reflection', type: 'inscription' as SynapticQuestionType, prompt: '', options: '' });
  const acceptFile = async (file: File) => {
    const format = file.name.split('.').pop()?.toLowerCase();
    if (format !== 'json' && format !== 'csv' && format !== 'txt') { setMessage('Only .json, .csv, and .txt Synaptic decks are accepted.'); return; }
    try { assertImportByteLength(file.size, 'Synaptic deck'); importDeck(parseSynapticDeck(await file.text(), format)); setMessage(`Imported ${file.name}.`); } catch (error) { setMessage(error instanceof Error ? error.message : String(error)); }
  };
  const downloadTemplate = (format: 'csv' | 'txt') => {
    const anchor = document.createElement('a'); anchor.href = URL.createObjectURL(new Blob([deckTemplates[format]], { type: 'text/plain' })); anchor.download = `synaptic-deck-template.${format}`; anchor.click(); URL.revokeObjectURL(anchor.href);
  };
  const saveDraft = () => {
    const deckId = state.synapticVault?.activeDeckId;
    if (!deckId || !draft.prompt.trim()) return;
    saveQuestion({ id: `scribe-${Date.now().toString(36)}`, deckId, sector: draft.sector.trim(), type: draft.type, prompt: draft.prompt.trim(), options: draft.options.split('|').map((option) => option.trim()).filter(Boolean), difficulty: 1, tags: ['custom'] });
    setDraft({ sector: 'Reflection', type: 'inscription', prompt: '', options: '' }); setMessage('Question saved into the active deck.');
  };
  return <div style={overlay} onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}><div style={panel}>
    <header style={header}><div><div style={eyebrow}>CARTRIDGE FORGE</div><div style={{ color: tokens.text }}>Synaptic Deck Authoring</div></div><button title="Close forge" onClick={onClose} style={iconButton}><X size={18} /></button></header>
    <input ref={inputRef} type="file" accept=".json,.csv,.txt" hidden onChange={(event) => { const file = event.target.files?.[0]; if (file) void acceptFile(file); event.currentTarget.value = ''; }} />
    <button style={dropZone} onClick={() => inputRef.current?.click()} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); const file = event.dataTransfer.files[0]; if (file) void acceptFile(file); }}><Upload size={20} /><span>DROP DECK OR SELECT FILE</span><small>.JSON / .CSV / .TXT</small></button>
    <p style={messageStyle}>{message}</p>
    <div style={guide}><span>CSV: `Sector, Type, Prompt, Options, Difficulty, Tags`</span><button title="Download CSV template" style={iconButton} onClick={() => downloadTemplate('csv')}><Download size={15} /></button><span>TXT: delimit questions with `---`, then use `Sector:`, `Type:`, `Prompt:`.</span><button title="Download TXT template" style={iconButton} onClick={() => downloadTemplate('txt')}><Download size={15} /></button></div>
    <div style={{ borderTop: `1px solid ${tokens.border}`, paddingTop: tokens.gap }}><div style={eyebrow}>MANUAL SCRIBE</div><div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: tokens.gapSm, marginTop: tokens.gapSm }}><input value={draft.sector} onChange={(event) => setDraft({ ...draft, sector: event.target.value })} placeholder="Sector" style={field} /><select value={draft.type} onChange={(event) => setDraft({ ...draft, type: event.target.value as SynapticQuestionType })} style={field}>{['binary', 'spectrum', 'prism', 'inscription'].map((type) => <option key={type}>{type}</option>)}</select></div><textarea value={draft.prompt} onChange={(event) => setDraft({ ...draft, prompt: event.target.value })} placeholder="Question prompt" style={{ ...field, width: '100%', boxSizing: 'border-box', minHeight: 72, marginTop: tokens.gapSm }} /><input value={draft.options} onChange={(event) => setDraft({ ...draft, options: event.target.value })} placeholder="Options separated by |" style={{ ...field, width: '100%', boxSizing: 'border-box', marginTop: tokens.gapSm }} /><button style={{ ...command, marginTop: tokens.gapSm }} onClick={saveDraft}>SAVE QUESTION</button></div>
  </div></div>;
}

const overlay = { position: 'fixed' as const, inset: 0, zIndex: 250, background: 'rgba(0,0,0,.78)', display: 'grid', placeItems: 'center', padding: 16 };
const panel = { width: 'min(620px, 100%)', maxHeight: '90vh', overflowY: 'auto' as const, background: '#111', border: `1px solid ${tokens.border}`, padding: tokens.gapLg, fontFamily: tokens.fontMono };
const header = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: tokens.gapLg };
const eyebrow = { color: tokens.accent, fontSize: tokens.fontSizeXs, letterSpacing: '0.12em', marginBottom: 4 };
const iconButton = { background: 'transparent', color: tokens.textDim, border: `1px solid ${tokens.border}`, padding: 6, cursor: 'pointer' };
const dropZone = { width: '100%', minHeight: 110, display: 'flex', flexDirection: 'column' as const, alignItems: 'center', justifyContent: 'center', gap: 6, background: 'rgba(255,255,255,.02)', border: `1px dashed ${tokens.accent}`, color: tokens.accent, fontFamily: tokens.fontMono, cursor: 'pointer' };
const guide = { display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, alignItems: 'center', fontSize: tokens.fontSizeXs, color: tokens.textMuted, margin: `${tokens.gap}px 0` };
const field = { padding: 9, background: '#090909', color: tokens.text, border: `1px solid ${tokens.border}`, fontFamily: tokens.fontMono };
const command = { width: '100%', padding: 10, background: 'transparent', border: `1px solid ${tokens.reflect}`, color: tokens.reflect, fontFamily: tokens.fontMono, cursor: 'pointer' };
const messageStyle = { minHeight: 18, color: tokens.midday, fontSize: tokens.fontSizeXs };
