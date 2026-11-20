import { useState, useRef, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { Thought } from './types';
import {
  isTauri,
  syncKnownDevices,
  syncRevokeKnownDevice,
  syncExportStoneBundle,
  syncImportStoneBundle,
  type KnownDevice,
  type BundleExportResult,
  type SyncReport,
} from '../../../core/semantic/syncClient';

export interface SearchResult {
  chamberId: number;
  chamberName: string;
  thought: Thought;
}

interface Props {
  onClose: () => void;
  onNavigate: (chamberId: number) => void;
  searchThoughts: (q: string) => SearchResult[];
  fuzzyJump: (q: string) => number | null;
  chambers: Record<number, { id: number; name: string; thoughts: Thought[] }>;
  initialTab?: 'search' | 'vault' | 'roster';
}

// Pairing is parked because it cannot be tested without a two-device setup. Reopen this ceremony only after an end-to-end pairing test with two real devices passes.

export default function ArchiveMonolithModal({
  onClose,
  onNavigate,
  searchThoughts,
  fuzzyJump,
  chambers,
  initialTab = 'search',
}: Props) {
  const [activeTab, setActiveTab] = useState<'search' | 'vault' | 'roster'>(initialTab);

  // Search state
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [chamberResults, setChamberResults] = useState<{ id: number; name: string }[]>([]);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [knownDevices, setKnownDevices] = useState<KnownDevice[]>([]);

  // Cold Stone Bundle state
  const [exportResult, setExportResult] = useState<BundleExportResult | null>(null);
  const [importPath, setImportPath] = useState('');
  const [importReport, setImportReport] = useState<SyncReport | null>(null);
  const [bundleError, setBundleError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Load identities and roster on mount
  useEffect(() => {
    let mounted = true;
    syncKnownDevices().then((devices) => {
      if (mounted) setKnownDevices(devices);
    }).catch(console.error);

    return () => {
      mounted = false;
    };
  }, []);

  // Autofocus search on search tab
  useEffect(() => {
    if (activeTab === 'search') {
      searchInputRef.current?.focus();
    }
  }, [activeTab]);

  // Handle ESC to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  // Search logic
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setChamberResults([]);
      return;
    }
    const q = query.toLowerCase();
    const directMatches = Object.values(chambers)
      .filter((c) => c.name.toLowerCase().includes(q))
      .map((c) => ({ id: c.id, name: c.name }));
    const fuzzyMatchId = directMatches.length === 0 ? fuzzyJump(query) : null;
    const fuzzyMatch = fuzzyMatchId !== null ? chambers[fuzzyMatchId] : undefined;
    const nextChamberResults =
      fuzzyMatch && !directMatches.some((c) => c.id === fuzzyMatch.id)
        ? [{ id: fuzzyMatch.id, name: fuzzyMatch.name }, ...directMatches]
        : directMatches;

    setResults(searchThoughts(query).slice(0, 20));
    setChamberResults(nextChamberResults.slice(0, 10));
  }, [query, searchThoughts, fuzzyJump, chambers]);

  // Revoke device
  const handleRevokeDevice = async (pubkey: string) => {
    try {
      setIsProcessing(true);
      const updated = await syncRevokeKnownDevice(pubkey);
      setKnownDevices(updated);
    } catch (err: any) {
      console.error('Revoke failed:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  // Export Cold Stone bundle
  const handleExportBundle = async () => {
    try {
      setIsProcessing(true);
      setBundleError(null);
      let destinationPath: string | undefined;
      if (isTauri()) {
        const { save } = await import('@tauri-apps/plugin-dialog');
        destinationPath = await save({
          defaultPath: 'citadel-export.citadel-sync',
          filters: [{ name: 'Citadel Stone Bundle', extensions: ['citadel-sync'] }],
        }) ?? undefined;
        if (!destinationPath) return;
      }
      const res = await syncExportStoneBundle(destinationPath);
      setExportResult(res);
    } catch (err: any) {
      setBundleError(err.message || String(err));
    } finally {
      setIsProcessing(false);
    }
  };

  // Import Cold Stone bundle
  const handleImportBundle = async () => {
    if (!importPath.trim()) return;
    try {
      setIsProcessing(true);
      setBundleError(null);
      const report = await syncImportStoneBundle(importPath.trim());
      setImportReport(report);
      setImportPath('');
    } catch (err: any) {
      setBundleError(err.message || String(err));
    } finally {
      setIsProcessing(false);
    }
  };

  const highlight = (text: string) => {
    if (!query.trim()) return text;
    const re = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return text.replace(re, '⟨$1⟩');
  };

  const thoughtLinkPattern = /@([^/\n]+)\/(\d+)/g;
  const renderThoughtWithLinks = (text: string) => {
    const parts: ReactNode[] = [];
    let last = 0;
    for (const match of text.matchAll(thoughtLinkPattern)) {
      const full = match[0];
      const chamberPart = match[1].trim().toLowerCase();
      const idx = Number(match[2]);
      const start = match.index ?? 0;
      if (start > last) parts.push(<span key={`txt-${start}`}>{highlight(text.slice(last, start))}</span>);
      const targetChamber = Object.values(chambers).find((c) =>
        c.name.toLowerCase().includes(chamberPart)
      );
      const targetThought = targetChamber?.thoughts[idx - 1];
      if (targetChamber && targetThought) {
        parts.push(
          <button
            key={`lnk-${start}`}
            className="mx-0.5 rounded border px-1 py-0 text-[9px] uppercase tracking-[0.08em] hover:brightness-125"
            style={{ color: '#22d3ee', borderColor: 'rgba(34,211,238,0.35)' }}
            onClick={(e) => {
              e.stopPropagation();
              onNavigate(targetChamber.id);
              onClose();
            }}
            title={`Jump to ${targetChamber.name} thought ${idx}`}
          >
            {full}
          </button>,
        );
      } else {
        parts.push(<span key={`bad-${start}`} className="text-red-300/60">{full}</span>);
      }
      last = start + full.length;
    }
    if (last < text.length) parts.push(<span key="tail">{highlight(text.slice(last))}</span>);
    return parts.length > 0 ? parts : [highlight(text)];
  };

  return (
    <div
      className="fixed inset-0 z-[450] flex flex-col items-center justify-center font-mono p-4"
      style={{ background: 'rgba(7,4,15,0.95)', animation: 'citadelFadeIn 150ms ease-out' }}
    >
      <div
        className="w-full max-w-4xl max-h-[90vh] flex flex-col rounded-xl border border-cyan-500/30 shadow-2xl overflow-hidden"
        style={{
          background: 'linear-gradient(180deg, rgba(16,12,30,0.98) 0%, rgba(8,6,18,0.99) 100%)',
          boxShadow: '0 0 50px rgba(6,182,212,0.15)',
        }}
      >
        {/* Monolith Header */}
        <div className="flex items-center justify-between border-b border-cyan-500/20 px-6 py-4 bg-black/40">
          <div className="flex items-center gap-3">
            <span className="text-xl text-cyan-400">▮</span>
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-[0.25em] text-cyan-200">
                Station 04 // Archive Monolith
              </h2>
              <p className="text-[10px] tracking-[0.15em] text-cyan-400/60">
                CRYSTALLIZED HISTORY · NOISE HANDSHAKE · COLD STONE CUSTODY
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded border border-cyan-500/30 px-2.5 py-1 text-xs text-cyan-400 hover:bg-cyan-500/10 hover:border-cyan-400 transition-colors"
          >
            ESC ✕
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-cyan-500/15 bg-black/20 px-6 gap-2 pt-2">
          <button
            onClick={() => setActiveTab('search')}
            className={`px-4 py-2 text-xs uppercase tracking-[0.18em] transition-all border-b-2 ${
              activeTab === 'search'
                ? 'border-cyan-400 text-cyan-200 font-bold bg-cyan-500/10'
                : 'border-transparent text-cyan-400/50 hover:text-cyan-300'
            }`}
          >
            ⌕ Search Archives
          </button>
          <button
            onClick={() => setActiveTab('vault')}
            className={`px-4 py-2 text-xs uppercase tracking-[0.18em] transition-all border-b-2 ${
              activeTab === 'vault'
                ? 'border-purple-400 text-purple-200 font-bold bg-purple-500/10'
                : 'border-transparent text-purple-400/50 hover:text-purple-300'
            }`}
          >
            📦 Cold Stone Vault
          </button>
          <button
            onClick={() => setActiveTab('roster')}
            className={`px-4 py-2 text-xs uppercase tracking-[0.18em] transition-all border-b-2 ${
              activeTab === 'roster'
                ? 'border-emerald-400 text-emerald-200 font-bold bg-emerald-500/10'
                : 'border-transparent text-emerald-400/50 hover:text-emerald-300'
            }`}
          >
            🛡 Bonded Roster ({knownDevices.length})
          </button>
        </div>

        {/* Tab Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* TAB 1: SEARCH */}
          {activeTab === 'search' && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 px-4 py-3 rounded-lg border border-cyan-400/30 bg-black/40">
                <span className="text-cyan-400 text-base">⌕</span>
                <input
                  ref={searchInputRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search historical chambers, thoughts, or type chamber name to jump..."
                  className="flex-1 bg-transparent text-cyan-100 placeholder-cyan-500/40 text-xs tracking-[0.1em] focus:outline-none"
                />
                {query && (
                  <button
                    onClick={() => setQuery('')}
                    className="text-cyan-400/50 hover:text-cyan-300 text-xs px-2"
                  >
                    CLEAR
                  </button>
                )}
              </div>

              {/* Chamber teleports */}
              {chamberResults.length > 0 && (
                <div className="space-y-1">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-cyan-400/60 px-1">Chambers</p>
                  <div className="flex flex-wrap gap-2">
                    {chamberResults.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => {
                          onNavigate(c.id);
                          onClose();
                        }}
                        className="rounded border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-xs text-cyan-300 hover:border-cyan-400 hover:bg-cyan-500/20 transition-colors"
                      >
                        → {c.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Thought results */}
              {results.length > 0 && (
                <div className="space-y-2 mt-4">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-cyan-400/60 px-1">
                    Historical Thoughts ({results.length})
                  </p>
                  <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
                    {results.map(({ chamberId, chamberName, thought }) => (
                      <div
                        key={thought.id}
                        onClick={() => {
                          onNavigate(chamberId);
                          onClose();
                        }}
                        className="cursor-pointer rounded border border-cyan-500/20 bg-black/30 p-3 hover:border-cyan-400/60 hover:bg-cyan-950/20 transition-colors"
                      >
                        <div className="flex items-center justify-between text-[10px] text-cyan-400/60 mb-1">
                          <span className="uppercase tracking-[0.15em] text-cyan-300">{chamberName}</span>
                          <span>{thought.timestamp ? new Date(thought.timestamp).toLocaleDateString() : 'Historical Stone'}</span>
                        </div>
                        <p className="text-xs text-cyan-100 leading-relaxed">
                          {renderThoughtWithLinks(thought.text)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {!query.trim() && (
                <div className="text-center py-12 text-cyan-400/40 text-xs tracking-[0.15em]">
                  TYPE TO SEARCH VERIFIED STONES OR TELEPORT TO HISTORICAL CHAMBERS
                </div>
              )}
            </div>
          )}

          {/* TAB 3: COLD STONE VAULT */}
          {activeTab === 'vault' && (
            <div className="space-y-6">
              <div className="rounded-lg border border-purple-500/20 bg-purple-950/10 p-5 space-y-3">
                <h3 className="text-xs uppercase tracking-[0.2em] text-purple-300 font-bold">
                  AirDrop & Cold Stone Transfers (.citadel-sync)
                </h3>
                <p className="text-xs text-purple-200/70 leading-relaxed">
                  Off-grid? No Wi-Fi? Export your signed, tamper-evident stone record into an encrypted bundle. AirDrop or transfer it via USB to your iPhone or secondary Citadel node.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Export Section */}
                <div className="p-5 rounded-xl border border-purple-500/30 bg-black/40 space-y-4">
                  <h4 className="text-xs uppercase tracking-[0.2em] text-purple-200 font-semibold">
                    1. Export Stone Record
                  </h4>
                  <p className="text-[11px] text-purple-300/60 leading-relaxed">
                    Packages all verified stones and Merkle roots into a single verifiable snapshot.
                  </p>
                  <button
                    onClick={handleExportBundle}
                    disabled={isProcessing}
                    className="w-full py-2.5 rounded border border-purple-500/50 bg-purple-500/20 text-purple-200 text-xs font-semibold uppercase tracking-[0.18em] hover:bg-purple-500/30 hover:border-purple-400 transition-colors"
                  >
                    {isProcessing ? 'Sealing Bundle...' : 'Export .citadel-sync Bundle'}
                  </button>

                  {exportResult && (
                    <div className="p-3 rounded border border-purple-500/30 bg-purple-950/20 space-y-1 text-[10px]">
                      <p className="text-emerald-400 font-bold">✓ Bundle Exported Successfully</p>
                      <p className="text-purple-300 truncate">File: {exportResult.filePath}</p>
                      <p className="text-purple-300/70">Stones: {exportResult.eventCount}</p>
                      <p className="text-purple-300/70 truncate">Merkle Root: {exportResult.merkleRoot}</p>
                    </div>
                  )}
                </div>

                {/* Import Section */}
                <div className="p-5 rounded-xl border border-purple-500/30 bg-black/40 space-y-4">
                  <h4 className="text-xs uppercase tracking-[0.2em] text-purple-200 font-semibold">
                    2. Ingest Stone Bundle
                  </h4>
                  <p className="text-[11px] text-purple-300/60 leading-relaxed">
                    Ingests a received `.citadel-sync` bundle from an authorized peer, validating all BLAKE3 signatures.
                  </p>
                  <input
                    value={importPath}
                    onChange={(e) => setImportPath(e.target.value)}
                    placeholder="Enter absolute path to .citadel-sync file..."
                    className="w-full bg-black/40 border border-purple-500/30 rounded px-3 py-2 text-xs text-purple-100 placeholder-purple-500/30 focus:outline-none focus:border-purple-400"
                  />
                  <button
                    onClick={handleImportBundle}
                    disabled={!importPath.trim() || isProcessing}
                    className="w-full py-2.5 rounded border border-purple-500/50 bg-purple-500/20 text-purple-200 text-xs font-semibold uppercase tracking-[0.18em] hover:bg-purple-500/30 hover:border-purple-400 disabled:opacity-40 transition-colors"
                  >
                    {isProcessing ? 'Verifying Stones...' : 'Ingest Stone Bundle'}
                  </button>

                  {importReport && (
                    <div className="p-3 rounded border border-emerald-500/30 bg-emerald-950/20 space-y-1 text-[10px]">
                      <p className="text-emerald-400 font-bold">✓ Bundle Ingestion Complete</p>
                      <p className="text-emerald-300">New Stones Appended: {importReport.received}</p>
                      <p className="text-emerald-300/70">Duplicates Ignored: {importReport.duplicates}</p>
                      <p className="text-emerald-300/70">Quarantined (Tampered): {importReport.quarantined}</p>
                      <p className="text-emerald-300/70">Merkle Converged: {importReport.converged ? 'YES' : 'NO'}</p>
                    </div>
                  )}

                  {bundleError && (
                    <div className="p-3 rounded border border-red-500/40 bg-red-950/20 text-[10px] text-red-300">
                      Error: {bundleError}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: BONDED ROSTER */}
          {activeTab === 'roster' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs uppercase tracking-[0.2em] text-emerald-300 font-bold">
                    Authorized Device Roster
                  </h3>
                  <p className="text-[11px] text-emerald-400/60">
                    Only bonded devices can exchange signed stone events with this Citadel node.
                  </p>
                </div>
              </div>

              {knownDevices.length === 0 ? (
                <div className="text-center py-12 rounded-xl border border-emerald-500/20 bg-black/30 space-y-2">
                  <p className="text-xs text-emerald-400/50 uppercase tracking-[0.18em]">
                    No secondary devices bonded yet.
                  </p>
                  <p className="text-[11px] text-emerald-400/30">
                    Device pairing is parked until the two-device ceremony can be tested.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {knownDevices.map((dev) => (
                    <div
                      key={dev.identityPubkey}
                      className="flex items-center justify-between p-4 rounded-lg border border-emerald-500/20 bg-black/40 hover:border-emerald-500/40 transition-colors"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-emerald-400 text-xs">●</span>
                          <span className="text-xs font-bold text-emerald-200 uppercase tracking-[0.1em]">
                            {dev.label || 'Bonded Companion Node'}
                          </span>
                        </div>
                        <p className="text-[10px] text-emerald-400/60 font-mono">
                          ID: {dev.identityPubkey}
                        </p>
                      </div>
                      <button
                        onClick={() => handleRevokeDevice(dev.identityPubkey)}
                        disabled={isProcessing}
                        className="rounded border border-red-500/40 px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10 hover:border-red-400 transition-colors"
                      >
                        Revoke Access
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
