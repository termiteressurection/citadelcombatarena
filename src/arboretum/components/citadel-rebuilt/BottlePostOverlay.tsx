import { useMemo, useState } from 'react';
import type { BottleMessage, Chamber, FutureLetter, GridIdentity } from './types';
import { Z } from './ZRegistry';

type Props = {
  open: boolean;
  onClose: () => void;
  chamber: Chamber;
  identity: GridIdentity;
  onSendBottle: (text: string) => void;
  onWriteLetter: (days: number, text: string) => void;
  onCollectBottles: () => BottleMessage[];
};

type Tab = 'sent' | 'received' | 'letters' | 'write';

export default function BottlePostOverlay({
  open,
  onClose,
  chamber,
  identity,
  onSendBottle,
  onWriteLetter,
  onCollectBottles,
}: Props) {
  const [tab, setTab] = useState<Tab>('sent');
  const [draft, setDraft] = useState('');
  const [letterDays, setLetterDays] = useState(7);
  const [letterDraft, setLetterDraft] = useState('');

  const sent = identity.sentBottles || [];
  const received = chamber.bottles || [];
  const letters = chamber.letters || [];

  const pendingSent = useMemo(
    () => sent.filter(msg => !msg.toChamber).sort((a, b) => +new Date(b.sentAt) - +new Date(a.sentAt)),
    [sent],
  );
  const landedSent = useMemo(
    () => sent.filter(msg => !!msg.toChamber).sort((a, b) => +new Date(b.sentAt) - +new Date(a.sentAt)),
    [sent],
  );
  const sortedReceived = useMemo(
    () => [...received].sort((a, b) => +new Date(b.arriveAt) - +new Date(a.arriveAt)),
    [received],
  );
  const sortedLetters = useMemo(
    () => [...letters].sort((a, b) => +new Date(b.writtenAt) - +new Date(a.writtenAt)),
    [letters],
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/70 px-4" style={{ zIndex: Z.FEATURE_MODAL }}>
      <div className="w-full max-w-3xl rounded-xl border border-cyan-300/40 bg-[#080915] p-4 text-cyan-100 shadow-2xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-mono text-lg tracking-widest text-cyan-200">BOTTLE POST</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-cyan-300/40 px-2 py-1 font-mono text-xs tracking-wider text-cyan-100 hover:bg-cyan-300/10"
          >
            CLOSE
          </button>
        </div>

        <div className="mb-3 flex flex-wrap gap-2">
          {(['sent', 'received', 'letters', 'write'] as const).map(item => (
            <button
              key={item}
              type="button"
              onClick={() => setTab(item)}
              className={`rounded border px-2 py-1 font-mono text-xs tracking-wider ${
                tab === item
                  ? 'border-cyan-200 bg-cyan-300/20 text-cyan-50'
                  : 'border-cyan-300/30 text-cyan-200 hover:bg-cyan-300/10'
              }`}
            >
              {item.toUpperCase()}
            </button>
          ))}
          <button
            type="button"
            onClick={() => onCollectBottles()}
            className="ml-auto rounded border border-fuchsia-300/40 px-2 py-1 font-mono text-xs tracking-wider text-fuchsia-100 hover:bg-fuchsia-300/10"
          >
            COLLECT ARRIVALS
          </button>
        </div>

        {tab === 'sent' && (
          <div className="grid gap-3 md:grid-cols-2">
            <Pane title={`In Flight (${pendingSent.length})`} rows={pendingSent} renderRow={renderSent} empty="No bottles in flight." />
            <Pane title={`Delivered (${landedSent.length})`} rows={landedSent} renderRow={renderSent} empty="No delivered bottles yet." />
          </div>
        )}

        {tab === 'received' && (
          <Pane title={`Received Here (${sortedReceived.length})`} rows={sortedReceived} renderRow={renderReceived} empty="No arrivals in this chamber." />
        )}

        {tab === 'letters' && (
          <Pane title={`Future Letters (${sortedLetters.length})`} rows={sortedLetters} renderRow={renderLetter} empty="No future letters in this chamber." />
        )}

        {tab === 'write' && (
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded border border-cyan-300/30 bg-black/35 p-3">
              <h3 className="mb-2 font-mono text-sm tracking-wider text-cyan-200">Cast Bottle</h3>
              <textarea
                value={draft}
                onChange={e => setDraft(e.target.value)}
                placeholder="Short signal to the grid..."
                className="h-28 w-full rounded border border-cyan-300/30 bg-black/45 p-2 font-mono text-xs text-cyan-100 outline-none focus:border-cyan-200"
              />
              <button
                type="button"
                onClick={() => {
                  const text = draft.trim();
                  if (!text) return;
                  onSendBottle(text);
                  setDraft('');
                }}
                className="mt-2 rounded border border-cyan-200/50 px-3 py-1 font-mono text-xs tracking-wider text-cyan-50 hover:bg-cyan-300/15"
              >
                SEND BOTTLE
              </button>
            </div>

            <div className="rounded border border-fuchsia-300/30 bg-black/35 p-3">
              <h3 className="mb-2 font-mono text-sm tracking-wider text-fuchsia-200">Letter to Future Self</h3>
              <label className="mb-2 block font-mono text-xs text-fuchsia-100">
                Reveal in days:
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={letterDays}
                  onChange={e => setLetterDays(Math.max(1, Math.min(365, Number(e.target.value) || 1)))}
                  className="ml-2 w-20 rounded border border-fuchsia-300/40 bg-black/45 px-2 py-1 text-xs outline-none focus:border-fuchsia-200"
                />
              </label>
              <textarea
                value={letterDraft}
                onChange={e => setLetterDraft(e.target.value)}
                placeholder="What should future-you remember?"
                className="h-20 w-full rounded border border-fuchsia-300/30 bg-black/45 p-2 font-mono text-xs text-fuchsia-100 outline-none focus:border-fuchsia-200"
              />
              <button
                type="button"
                onClick={() => {
                  const text = letterDraft.trim();
                  if (!text) return;
                  onWriteLetter(letterDays, text);
                  setLetterDraft('');
                }}
                className="mt-2 rounded border border-fuchsia-200/50 px-3 py-1 font-mono text-xs tracking-wider text-fuchsia-50 hover:bg-fuchsia-300/15"
              >
                SEAL LETTER
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Pane<T>({
  title,
  rows,
  renderRow,
  empty,
}: {
  title: string;
  rows: T[];
  renderRow: (row: T) => string;
  empty: string;
}) {
  return (
    <div className="rounded border border-cyan-300/25 bg-black/30 p-3">
      <h3 className="mb-2 font-mono text-sm tracking-wider text-cyan-200">{title}</h3>
      {rows.length === 0 ? (
        <p className="font-mono text-xs text-cyan-200/70">{empty}</p>
      ) : (
        <ul className="max-h-64 space-y-2 overflow-auto pr-1">
          {rows.map((row, idx) => (
            <li key={idx} className="rounded border border-cyan-300/20 bg-black/35 p-2 font-mono text-xs leading-relaxed text-cyan-100/90">
              {renderRow(row)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function renderSent(row: BottleMessage): string {
  const delivered = row.toChamber != null ? `Delivered to chamber ${row.toChamber}` : `Arrives ${formatDate(row.arriveAt)}`;
  return `${row.text}\n${delivered}`;
}

function renderReceived(row: BottleMessage): string {
  return `${row.text}\nFrom chamber ${row.fromChamber} · Arrived ${formatDate(row.arriveAt)}`;
}

function renderLetter(row: FutureLetter): string {
  const state = row.revealed ? 'REVEALED' : `Sealed until ${formatDate(row.revealAt)}`;
  return `${row.text}\n${state}`;
}

function formatDate(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleString();
}
