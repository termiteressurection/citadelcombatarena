import { useState } from 'react';
import {
  executeCitadelFullWipe,
  downloadPreWipeBackup,
  type WipeReceipt,
} from '@/core/persistence/fullWipe';
import { useFoliageDebugStore } from '@/core/state/foliageDebugStore';

const WIPE_CONFIRM_PHRASE = 'WIPE CITADEL';

interface MonadWipeModalProps {
  open: boolean;
  onClose: () => void;
  onWipeComplete?: (receipt: WipeReceipt) => void;
}

export default function MonadWipeModal({
  open,
  onClose,
  onWipeComplete,
}: MonadWipeModalProps) {
  const [wipeConfirmInput, setWipeConfirmInput] = useState('');
  const [backupExported, setBackupExported] = useState(false);
  const [wiping, setWiping] = useState(false);

  if (!open) return null;

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
      setWipeConfirmInput('');
      onWipeComplete?.(receipt);
      onClose();
      useFoliageDebugStore.getState().openDossier(receipt);
    } finally {
      setWiping(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Universal Sanctuary Wipe"
      data-testid="monad-wipe-modal"
      className="fixed inset-0 z-[320] flex items-center justify-center p-4 font-mono select-none"
      style={{
        background: 'rgba(3, 2, 8, 0.92)',
        backdropFilter: 'blur(12px)',
        animation: 'citadelFadeIn 160ms ease-out',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !wiping) onClose();
      }}
    >
      <div
        className="relative flex flex-col w-[680px] max-w-[95vw] max-h-[90vh] rounded-2xl border border-rose-500/50 bg-[#0a0410]/98 text-purple-100 shadow-[0_0_80px_rgba(244,63,94,0.35)] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-rose-500/30 bg-[#16040c]">
          <div className="flex items-center gap-3">
            <span className="flex h-3 w-3 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500" />
            </span>
            <div>
              <div className="text-sm font-bold tracking-wider uppercase text-rose-300">
                Universal Sanctuary Wipe · First-Class Monad Action
              </div>
              <div className="text-[10px] uppercase tracking-widest text-rose-400/70">
                Irreversible Data Purge &amp; Canopy Dissolution
              </div>
            </div>
          </div>
          <button
            type="button"
            disabled={wiping}
            onClick={onClose}
            data-testid="monad-wipe-close-x"
            className="text-rose-400 hover:text-white px-2 py-1 rounded transition-colors text-sm"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-4 text-xs leading-relaxed">
          <div className="rounded-xl border border-rose-500/40 bg-rose-950/25 p-4 space-y-2">
            <div className="text-xs font-bold uppercase tracking-wider text-rose-300">
              ⚠ Universal In-Game Sanctuary Wipe (Irreversible)
            </div>
            <p className="text-[11px] text-purple-200/80 leading-relaxed">
              Clears every piece of user data across Browser, Portable Runtime, and macOS Native storage. The Citadel Memory Tree will dissolve its digital foliage canopy and return to the pure, bare wireframe arbor (0 entries, 0 aliveness).
            </p>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-[10px] text-purple-300/75 pt-1">
              <li>• 3D World Saves (IndexedDB &amp; Portable)</li>
              <li>• Canonical Journal &amp; Tauri journal.log</li>
              <li>• citadel-profile.json &amp; migration_receipt.json</li>
              <li>• legacy_storage_backup/ &amp; citadel_graph/</li>
              <li>• semantic_index/ &amp; sync/known_devices.json</li>
              <li>• 3D Mindmap, Sigma Chat, Calibration &amp; Prefs</li>
            </ul>
          </div>

          {/* Pre-wipe Export */}
          <div className="flex items-center justify-between rounded-xl border border-purple-500/25 bg-purple-950/20 px-4 py-3">
            <div>
              <div className="text-xs font-bold text-amber-200 uppercase tracking-wider">
                Optional Pre-Wipe Archive
              </div>
              <div className="text-[10px] text-purple-300/65 mt-0.5">
                Download a full JSON snapshot of your journals, chambers, and settings before purging.
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
          <div className="rounded-xl border border-rose-500/40 bg-[#0d040a] p-4 space-y-3">
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
                className={`px-5 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                  confirmPhraseValid && !wiping
                    ? 'bg-rose-600 text-white hover:bg-rose-500 shadow-[0_0_20px_rgba(225,29,72,0.45)] cursor-pointer'
                    : 'bg-rose-950/40 text-rose-400/40 border border-rose-500/20 cursor-not-allowed'
                }`}
              >
                {wiping ? 'Purging All Stores...' : 'Execute Full Wipe'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
