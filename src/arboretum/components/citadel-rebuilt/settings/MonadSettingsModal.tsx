import { useState, useEffect } from 'react';
import {
  getCitadelSettings,
  saveCitadelSettings,
  syncCanonicalUserName,
  DEFAULT_SIGMA_SOUL,
  DEFAULT_SIGMA_MEMORIES,
  type CitadelSettings,
  type MindmapEdgeShape,
  type MindmapEdgeColor,
} from './citadelSettings';
import {
  downloadPreWipeBackup,
  executeCitadelFullWipe,
  type WipeReceipt,
} from '@/core/persistence/fullWipe';
import TrmgtsImportPanel from './TrmgtsImportPanel';
import {
  WORLD_LOOKS,
  WORLD_LOOK_SLOT_COUNT,
  useWorldLook,
} from '../looks/worldLook';

export type MonadSettingsTab = 'identity' | 'worlds' | 'aether' | 'sigma' | 'import' | 'wipe';

const SETTINGS_TABS: {
  id: MonadSettingsTab;
  icon: string;
  label: string;
  testId?: string;
  activeClass: string;
  idleClass: string;
  barClass: string;
}[] = [
  {
    id: 'identity',
    icon: '👤',
    label: 'Inscriber',
    activeClass: 'text-amber-300 bg-amber-950/20',
    idleClass: 'text-purple-400/70 hover:text-purple-200',
    barClass: 'bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.7)]',
  },
  {
    id: 'worlds',
    icon: '🌌',
    label: 'Worlds',
    testId: 'monad-tab-worlds',
    activeClass: 'text-pink-300 bg-pink-950/20',
    idleClass: 'text-purple-400/70 hover:text-purple-200',
    barClass: 'bg-pink-400 shadow-[0_0_10px_rgba(244,114,182,0.7)]',
  },
  {
    id: 'aether',
    icon: '🕸',
    label: 'Aether Graph',
    testId: 'monad-tab-aether',
    activeClass: 'text-cyan-300 bg-cyan-950/20',
    idleClass: 'text-purple-400/70 hover:text-purple-200',
    barClass: 'bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.7)]',
  },
  {
    id: 'sigma',
    icon: '🧠',
    label: 'Sigma Soul',
    activeClass: 'text-fuchsia-300 bg-fuchsia-950/20',
    idleClass: 'text-purple-400/70 hover:text-purple-200',
    barClass: 'bg-fuchsia-400 shadow-[0_0_10px_rgba(232,121,249,0.7)]',
  },
  {
    id: 'import',
    icon: '⇄',
    label: 'Trismegistus Vault',
    testId: 'monad-tab-phone-import',
    activeClass: 'text-cyan-300 bg-cyan-950/20',
    idleClass: 'text-cyan-400/70 hover:text-cyan-200',
    barClass: 'bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.7)]',
  },
  {
    id: 'wipe',
    icon: '⚠',
    label: 'Purify',
    testId: 'monad-tab-wipe',
    activeClass: 'text-rose-300 bg-rose-950/25',
    idleClass: 'text-rose-400/70 hover:text-rose-200',
    barClass: 'bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.7)]',
  },
];

const EDGE_SHAPES: { id: MindmapEdgeShape; label: string; desc: string; path: string }[] = [
  { id: 'straight', label: 'Beam', desc: 'Sleek straight line', path: 'M6 22 L74 22' },
  { id: 'curved', label: 'Curve', desc: 'Organic, gentle bend', path: 'M6 22 Q40 10 74 22' },
  { id: 'arc', label: 'Arc', desc: 'Dramatic sweeping arc', path: 'M6 22 Q40 -6 74 22' },
];

const EDGE_COLORS: { id: MindmapEdgeColor; label: string; swatch: string }[] = [
  { id: 'default', label: 'Aether', swatch: '#a78bfa' },
  { id: 'cyan', label: 'Cyan', swatch: '#3ff0ff' },
  { id: 'magenta', label: 'Magenta', swatch: '#ff4fd8' },
  { id: 'gold', label: 'Gold', swatch: '#ffc95c' },
];

interface MonadSettingsModalProps {
  open: boolean;
  onClose: () => void;
  onSettingsSaved?: (settings: CitadelSettings) => void;
  initialTab?: MonadSettingsTab;
  onWipeComplete?: (receipt: WipeReceipt) => void;
}

const WIPE_CONFIRM_PHRASE = 'WIPE CITADEL';

export default function MonadSettingsModal({
  open,
  onClose,
  onSettingsSaved,
  initialTab = 'identity',
  onWipeComplete,
}: MonadSettingsModalProps) {
  const [settings, setSettings] = useState<CitadelSettings>(getCitadelSettings());
  const [savedToast, setSavedToast] = useState(false);
  const [activeTab, setActiveTab] = useState<MonadSettingsTab>(initialTab);
  const [wipeConfirmInput, setWipeConfirmInput] = useState('');
  const [wiping, setWiping] = useState(false);
  const [wipeReceipt, setWipeReceipt] = useState<WipeReceipt | null>(null);
  const [backupExported, setBackupExported] = useState(false);
  const setWorldLook = useWorldLook((s) => s.setLook);

  useEffect(() => {
    if (open) {
      setSettings(getCitadelSettings());
      setSavedToast(false);
      setActiveTab(initialTab);
      setWipeConfirmInput('');
      setWiping(false);
      setWipeReceipt(null);
      setBackupExported(false);
    }
  }, [open, initialTab]);

  if (!open) return null;

  const handleSave = async () => {
    saveCitadelSettings(settings);
    await syncCanonicalUserName(settings.userName);
    onSettingsSaved?.(settings);
    setSavedToast(true);
    setTimeout(() => {
      setSavedToast(false);
      onClose();
    }, 600);
  };

  const handleResetSigma = () => {
    setSettings((prev) => ({
      ...prev,
      sigmaSoulPrompt: DEFAULT_SIGMA_SOUL,
      sigmaMemoryNotes: DEFAULT_SIGMA_MEMORIES,
    }));
  };

  const handleExportBackup = async () => {
    await downloadPreWipeBackup();
    setBackupExported(true);
  };

  const confirmPhraseValid =
    wipeConfirmInput.trim().toUpperCase() === WIPE_CONFIRM_PHRASE;

  const handleExecuteWipe = async () => {
    if (!confirmPhraseValid || wiping) return;
    setWiping(true);
    try {
      const receipt = await executeCitadelFullWipe();
      setWipeReceipt(receipt);
      setSettings(getCitadelSettings());
      setWipeConfirmInput('');
      onWipeComplete?.(receipt);
    } finally {
      setWiping(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center p-4 font-mono select-none"
      style={{
        background: 'rgba(3, 2, 8, 0.88)',
        backdropFilter: 'blur(8px)',
        animation: 'citadelFadeIn 180ms ease-out',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="relative flex flex-col w-[800px] max-w-[95vw] h-[610px] max-h-[90vh] rounded-xl border border-purple-500/40 bg-[#07040f]/95 text-purple-100 shadow-[0_0_60px_rgba(168,85,247,0.25)] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="relative flex items-center justify-between px-6 py-4 border-b border-purple-500/30 bg-gradient-to-r from-[#0a0515] via-[#12062a] to-[#0a0515]">
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-amber-400/60 to-transparent" />
          <div className="flex items-center gap-3">
            <span className="text-amber-400 text-lg drop-shadow-[0_0_8px_rgba(251,191,36,0.6)]">⚙</span>
            <div>
              <div className="citadel-display text-[16px] uppercase tracking-[0.2em] text-purple-200">
                Citadel Monad Settings
              </div>
              <div className="mt-0.5 text-[9px] uppercase tracking-[0.3em] text-purple-400/50">
                The Crucible · The Aether Graph
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-xs uppercase tracking-widest px-3 py-1 rounded border border-purple-500/30 text-purple-300 hover:bg-purple-900/30 transition-colors"
          >
            ✕ Close
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex flex-wrap gap-1 border-b border-purple-500/15 bg-[#05030c] px-4 pt-2.5">
          {SETTINGS_TABS.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                data-testid={tab.testId}
                className={`group relative flex items-center gap-2 rounded-t-lg px-3.5 py-2.5 text-[10px] font-bold uppercase tracking-[0.18em] transition-all ${
                  active ? tab.activeClass : tab.idleClass
                }`}
              >
                <span className="text-sm leading-none">{tab.icon}</span>
                {tab.label}
                <span
                  className={`pointer-events-none absolute inset-x-2 bottom-0 h-[2px] rounded-full transition-opacity ${tab.barClass} ${
                    active ? 'opacity-100' : 'opacity-0 group-hover:opacity-40'
                  }`}
                />
              </button>
            );
          })}
        </div>

        {/* Tab Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5 bg-[radial-gradient(ellipse_at_top,rgba(88,28,135,0.14),transparent_60%)]">
          {activeTab === 'identity' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs uppercase tracking-wider text-amber-300/90 font-bold mb-1.5">
                  Your Inscription Mark
                </label>
                <p className="text-[11px] text-purple-300/60 mb-2">
                  Replace &ldquo;Traveler&rdquo; with your chosen name across your journal stones, lodge inscriptions, and chronicles.
                </p>
                <input
                  type="text"
                  value={settings.userName}
                  onChange={(e) => setSettings({ ...settings, userName: e.target.value })}
                  placeholder="Enter your name..."
                  className="w-full px-4 py-2.5 rounded-lg border border-purple-400/40 bg-purple-950/30 text-purple-100 text-sm outline-none focus:border-amber-400 focus:shadow-[0_0_16px_rgba(251,191,36,0.18)] transition-all"
                />
              </div>

              <div className="p-3.5 rounded-lg border border-purple-500/20 bg-purple-950/15 text-[11px] text-purple-300/70 leading-relaxed">
                ✦ Saving your name synchronizes it immediately with your local profile so you won&apos;t be prompted for &ldquo;Traveler&rdquo; again.
              </div>
            </div>
          )}

          {activeTab === 'worlds' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs uppercase tracking-wider text-pink-300/90 font-bold mb-1.5">
                  World Aesthetic
                </label>
                <p className="text-[11px] text-purple-300/60 mb-3">
                  Choose how the whole Citadel looks. The change is applied instantly, so you can flip between worlds and compare.
                </p>
                <div className="grid grid-cols-4 gap-3 max-sm:grid-cols-2">
                  {Array.from({ length: WORLD_LOOK_SLOT_COUNT }).map((_, slot) => {
                    const look = WORLD_LOOKS[slot];
                    if (!look) {
                      return (
                        <div
                          key={`locked-${slot}`}
                          className="flex aspect-[4/5] flex-col items-center justify-center rounded-lg border border-dashed border-purple-500/20 bg-purple-950/10 text-purple-400/30"
                        >
                          <span className="text-lg">◌</span>
                          <span className="mt-1 text-[8px] uppercase tracking-[0.2em]">World {slot + 1}</span>
                        </div>
                      );
                    }
                    const on = settings.worldLook === look.id;
                    return (
                      <button
                        key={look.id}
                        type="button"
                        data-testid={`world-look-${look.id}`}
                        onClick={() => {
                          setSettings({ ...settings, worldLook: look.id });
                          setWorldLook(look.id);
                        }}
                        className={`group flex aspect-[4/5] flex-col overflow-hidden rounded-lg border text-left transition-all ${
                          on
                            ? 'border-pink-300 shadow-[0_0_18px_rgba(244,114,182,0.35)]'
                            : 'border-purple-500/25 hover:border-purple-300/60'
                        }`}
                      >
                        <div className="flex-1" style={{ background: look.preview }} />
                        <div className="bg-[#0a0515] px-2.5 py-2">
                          <div className="text-[10px] font-bold uppercase tracking-wider text-purple-100">
                            {look.name}
                          </div>
                          <div className="mt-0.5 text-[8px] leading-snug text-purple-300/60">
                            {on ? `✓ Active · R=${look.curvatureRadius}` : `R=${look.curvatureRadius} · Tap to apply`}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="p-3.5 rounded-lg border border-purple-500/20 bg-purple-950/15 text-[11px] text-purple-300/70 leading-relaxed">
                ✦ 16 worlds are planned, one for each personality result from the Synaptic Vault. {WORLD_LOOKS.length} {WORLD_LOOKS.length === 1 ? 'is' : 'are'} ready to try.
              </div>
            </div>
          )}

          {activeTab === 'aether' && (
            <div className="space-y-5">
              <div>
                <label className="block text-xs uppercase tracking-wider text-cyan-300/90 font-bold mb-1.5">
                  Synaptic Edge Shape
                </label>
                <p className="text-[11px] text-purple-300/60 mb-3">
                  How new connections between thoughts bend through the Aether Graph. Existing edges keep their look.
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {EDGE_SHAPES.map((p) => {
                    const on = settings.mindmapEdgeShape === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        data-testid={`aether-shape-${p.id}`}
                        onClick={() => setSettings({ ...settings, mindmapEdgeShape: p.id })}
                        className={`rounded-lg border p-3 text-left transition-all ${
                          on
                            ? 'border-cyan-400 bg-cyan-950/40 text-cyan-200 shadow-[0_0_14px_rgba(34,211,238,0.22)]'
                            : 'border-purple-500/25 bg-purple-950/15 text-purple-300/70 hover:border-purple-400/50'
                        }`}
                      >
                        <svg viewBox="0 0 80 28" className="mb-2 h-7 w-full" fill="none" aria-hidden>
                          <path d={p.path} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                          <circle cx="6" cy="22" r="3" fill="currentColor" />
                          <circle cx="74" cy="22" r="3" fill="currentColor" />
                        </svg>
                        <div className="text-xs font-bold">{p.label}</div>
                        <div className="text-[9px] opacity-60 mt-0.5">{p.desc}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs uppercase tracking-wider text-cyan-300/90 font-bold mb-1.5">
                  Beam Resonance
                </label>
                <p className="text-[11px] text-purple-300/60 mb-3">
                  The default color of newly drawn connections.
                </p>
                <div className="flex flex-wrap gap-2">
                  {EDGE_COLORS.map((c) => {
                    const on = settings.mindmapEdgeColor === c.id;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        data-testid={`aether-color-${c.id}`}
                        onClick={() => setSettings({ ...settings, mindmapEdgeColor: c.id })}
                        className={`flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-all ${
                          on
                            ? 'border-white/60 bg-purple-900/40 text-white'
                            : 'border-purple-500/25 bg-purple-950/15 text-purple-300/70 hover:border-purple-400/50'
                        }`}
                      >
                        <span
                          className="h-3 w-3 rounded-full"
                          style={{ background: c.swatch, boxShadow: on ? `0 0 10px ${c.swatch}` : 'none' }}
                        />
                        {c.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'sigma' && (
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs uppercase tracking-wider text-fuchsia-300/90 font-bold">
                    Sigma Soul Directives (Persona Prompt)
                  </label>
                  <button
                    type="button"
                    onClick={handleResetSigma}
                    className="text-[9px] uppercase tracking-wider text-purple-400 hover:text-purple-200 transition-colors"
                  >
                    Reset Defaults
                  </button>
                </div>
                <p className="text-[11px] text-purple-300/60 mb-2">
                  Tweak the underlying directives, voice laws, and guiding tone that govern Sigma&apos;s responses.
                </p>
                <textarea
                  rows={4}
                  value={settings.sigmaSoulPrompt}
                  onChange={(e) => setSettings({ ...settings, sigmaSoulPrompt: e.target.value })}
                  className="w-full p-3 rounded-lg border border-purple-400/40 bg-purple-950/30 text-purple-100 text-xs font-mono outline-none focus:border-fuchsia-400 leading-relaxed resize-none"
                />
              </div>

              <div>
                <label className="block text-xs uppercase tracking-wider text-fuchsia-300/90 font-bold mb-1.5">
                  Recollection Notes & Memory Anchors
                </label>
                <p className="text-[11px] text-purple-300/60 mb-2">
                  Specific permanent memories, context notes, or facts Sigma will remember during conversations.
                </p>
                <textarea
                  rows={3}
                  value={settings.sigmaMemoryNotes}
                  onChange={(e) => setSettings({ ...settings, sigmaMemoryNotes: e.target.value })}
                  className="w-full p-3 rounded-lg border border-purple-400/40 bg-purple-950/30 text-purple-100 text-xs font-mono outline-none focus:border-fuchsia-400 leading-relaxed resize-none"
                />
              </div>
            </div>
          )}

          {activeTab === 'import' && <TrmgtsImportPanel />}

          {activeTab === 'wipe' && (
            <div className="space-y-4">
              <div className="rounded-lg border border-rose-500/40 bg-rose-950/20 p-4">
                <div className="text-xs font-bold uppercase tracking-wider text-rose-300 mb-1.5">
                  ⚠ Universal In-Game Sanctuary Wipe (Irreversible)
                </div>
                <p className="text-[11px] text-purple-200/80 leading-relaxed">
                  Clears every piece of user data across Browser, Portable Runtime, and macOS Native storage, returning The Citadel and its Memory Tree to a fresh first-run state (bare cylinder trunk, 0 entries).
                </p>
                <ul className="mt-2.5 grid grid-cols-1 sm:grid-cols-2 gap-1 text-[10px] text-purple-300/75">
                  <li>• 3D World Saves (IndexedDB &amp; Portable)</li>
                  <li>• Canonical Journal &amp; Tauri journal.log</li>
                  <li>• citadel-profile.json &amp; migration_receipt.json</li>
                  <li>• legacy_storage_backup/ &amp; citadel_graph/</li>
                  <li>• semantic_index/ &amp; sync/known_devices.json</li>
                  <li>• 3D Mindmap, Sigma Chat, Calibration &amp; Prefs</li>
                </ul>
              </div>

              {/* Pre-wipe Export */}
              <div className="flex items-center justify-between rounded-lg border border-purple-500/25 bg-purple-950/20 px-4 py-3">
                <div>
                  <div className="text-xs font-bold text-amber-200 uppercase tracking-wider">
                    Optional Pre-Wipe Archive
                  </div>
                  <div className="text-[10px] text-purple-300/65 mt-0.5">
                    Download a full JSON snapshot of your journals, chambers, and settings before wiping.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleExportBackup}
                  data-testid="pre-wipe-export-btn"
                  className="px-3.5 py-2 rounded-lg border border-amber-400/50 bg-amber-950/30 text-[11px] font-bold uppercase tracking-wider text-amber-200 hover:bg-amber-900/40 transition-colors"
                >
                  {backupExported ? '✓ Backup Exported' : '⬇ Export Backup'}
                </button>
              </div>

              {/* Typed Confirmation Gate */}
              <div className="rounded-lg border border-rose-500/35 bg-[#0d040a] p-4 space-y-3">
                <label className="block text-[11px] uppercase tracking-wider text-rose-200">
                  Type <span className="font-bold text-rose-400 select-all">{WIPE_CONFIRM_PHRASE}</span> to unlock full wipe:
                </label>
                <div className="flex flex-col sm:flex-row gap-2.5">
                  <input
                    type="text"
                    value={wipeConfirmInput}
                    onChange={(e) => setWipeConfirmInput(e.target.value)}
                    placeholder={WIPE_CONFIRM_PHRASE}
                    data-testid="wipe-confirm-input"
                    className="flex-1 px-3.5 py-2 rounded-lg border border-rose-500/40 bg-black/60 text-rose-100 text-xs font-mono uppercase tracking-wider outline-none focus:border-rose-400"
                  />
                  <button
                    type="button"
                    disabled={!confirmPhraseValid || wiping}
                    onClick={handleExecuteWipe}
                    data-testid="execute-full-wipe-btn"
                    className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                      confirmPhraseValid && !wiping
                        ? 'bg-rose-600 text-white hover:bg-rose-500 shadow-[0_0_20px_rgba(225,29,72,0.45)] cursor-pointer'
                        : 'bg-rose-950/40 text-rose-400/40 border border-rose-500/20 cursor-not-allowed'
                    }`}
                  >
                    {wiping ? 'Wiping All Stores...' : 'Execute Full Wipe'}
                  </button>
                </div>
              </div>

              {wipeReceipt && (
                <div
                  data-testid="wipe-receipt-panel"
                  className="rounded-lg border border-emerald-500/40 bg-emerald-950/20 p-3.5 text-[11px] space-y-2"
                >
                  <div className="font-bold text-emerald-300 uppercase tracking-wider">
                    ✓ Sanctuary Wipe Complete — Returned to First-Run State
                  </div>
                  <div className="text-emerald-200/80">
                    Cleared <span className="font-bold">{wipeReceipt.clearedStores.length}</span> store paths · Survivors:{' '}
                    <span className="font-bold">{wipeReceipt.survivors.length}</span>
                  </div>
                  {wipeReceipt.sandboxNotice && (
                    <div className="rounded border border-amber-500/40 bg-amber-950/30 p-2 text-[10px] text-amber-200">
                      <div className="font-bold uppercase tracking-wider text-amber-300">Sandbox Limit:</div>
                      <div>{wipeReceipt.sandboxNotice}</div>
                    </div>
                  )}
                  <div className="max-h-24 overflow-y-auto rounded bg-black/50 p-2 font-mono text-[10px] text-purple-200/75">
                    {wipeReceipt.clearedStores.join(' · ')}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-purple-500/30 bg-[#0a0515]">
          <div className="text-xs font-mono text-emerald-400">
            {savedToast ? '✓ Settings Inscribed Successfully!' : ''}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs uppercase tracking-wider rounded border border-purple-500/30 text-purple-300/80 hover:bg-purple-900/30 transition-colors"
            >
              {activeTab === 'wipe' ? 'Close' : 'Cancel'}
            </button>
            {activeTab !== 'wipe' && activeTab !== 'import' && (
              <button
                onClick={handleSave}
                className="px-5 py-2 text-xs uppercase tracking-wider font-bold rounded bg-gradient-to-r from-purple-600 to-amber-500 text-black hover:brightness-110 shadow-lg shadow-purple-950/50 transition-all"
              >
                Save & Inscribe
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
