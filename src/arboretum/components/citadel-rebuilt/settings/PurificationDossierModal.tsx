import type React from 'react';
import { useFoliageDebugStore } from '@/core/state/foliageDebugStore';

export default function PurificationDossierModal() {
  const { dossierOpen, lastReceipt, closeDossier } = useFoliageDebugStore();

  if (!dossierOpen || !lastReceipt) return null;

  const isNativeClean = lastReceipt.survivors.length === 0;
  const hasUnreachable = (lastReceipt.unreachableStores?.length ?? 0) > 0;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Sanctuary Purification Dossier"
      data-testid="purification-dossier-modal"
      className="fixed inset-0 z-[350] flex items-center justify-center p-4 font-mono select-none"
      style={{
        background: 'rgba(2, 1, 6, 0.92)',
        backdropFilter: 'blur(12px)',
        animation: 'citadelFadeIn 160ms ease-out',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) closeDossier();
      }}
    >
      <div
        className="relative flex flex-col w-[680px] max-w-[95vw] max-h-[88vh] rounded-2xl border border-emerald-500/50 bg-[#07040f]/98 text-purple-100 shadow-[0_0_80px_rgba(16,185,129,0.3)] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-emerald-500/30 bg-[#06120c]">
          <div className="flex items-center gap-3">
            <span className="flex h-3 w-3 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
            </span>
            <div>
              <div className="text-sm font-bold tracking-wider uppercase text-emerald-300">
                Citadel Sanctuary Purification Dossier
              </div>
              <div className="text-[10px] uppercase tracking-widest text-emerald-400/70">
                Audited Store Wipe Receipt · Permanent Forensic Log
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={closeDossier}
            data-testid="dossier-close-x"
            className="text-emerald-400 hover:text-white px-2 py-1 rounded transition-colors text-sm"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-4 text-xs leading-relaxed">
          {/* Summary Stat Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-3">
              <div className="text-[9px] uppercase tracking-widest text-emerald-400/80 font-bold">
                Entries Cleared
              </div>
              <div className="text-lg font-bold text-white mt-1">
                {lastReceipt.deletedEntriesCount ?? 0}
              </div>
            </div>

            <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-3">
              <div className="text-[9px] uppercase tracking-widest text-emerald-400/80 font-bold">
                Stores Purged
              </div>
              <div className="text-lg font-bold text-emerald-300 mt-1">
                {lastReceipt.clearedStores.length}
              </div>
            </div>

            <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-3">
              <div className="text-[9px] uppercase tracking-widest text-emerald-400/80 font-bold">
                Survivors
              </div>
              <div
                className={`text-lg font-bold mt-1 ${
                  isNativeClean ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {lastReceipt.survivors.length}
              </div>
            </div>

            <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-3">
              <div className="text-[9px] uppercase tracking-widest text-emerald-400/80 font-bold">
                Canopy State
              </div>
              <div className="text-xs font-bold text-amber-300 mt-2 uppercase">
                Bare Arbor (0)
              </div>
            </div>
          </div>

          {/* Sandbox Notice Banner (Browser Mode) */}
          {hasUnreachable && (
            <div
              data-testid="dossier-sandbox-notice"
              className="rounded-xl border border-amber-500/40 bg-amber-950/25 p-4 text-[11px] text-amber-200/90 space-y-1.5"
            >
              <div className="font-bold uppercase tracking-wider text-amber-300 flex items-center gap-2">
                <span>⚠ Browser Sandbox Limit Acknowledged</span>
              </div>
              <p className="leading-relaxed text-amber-100/80">
                {lastReceipt.sandboxNotice ??
                  'Browser sandbox cannot access macOS Application Support disk storage. Launch the native Citadel.app desktop application to purge OS-level journal.log and graph stores.'}
              </p>
              <div className="text-[10px] text-amber-300/80 mt-1">
                Unreachable native stores ({lastReceipt.unreachableStores.length}):
                <ul className="list-disc pl-4 mt-0.5 space-y-0.5 text-[9px] font-mono text-amber-200/70">
                  {lastReceipt.unreachableStores.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Cleared Stores Log */}
          <div>
            <div className="text-[10px] uppercase tracking-wider text-emerald-300 font-bold mb-1.5">
              Verified Cleared Store Paths ({lastReceipt.clearedStores.length}):
            </div>
            <div
              data-testid="dossier-cleared-list"
              className="max-h-36 overflow-y-auto rounded-xl border border-purple-500/25 bg-black/60 p-3 text-[10px] font-mono text-purple-200/80 space-y-1"
            >
              {lastReceipt.clearedStores.map((store) => (
                <div key={store} className="flex items-center gap-2">
                  <span className="text-emerald-400 font-bold">✓</span>
                  <span>{store}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Survivors Warning (if any) */}
          {lastReceipt.survivors.length > 0 && (
            <div className="rounded-xl border border-rose-500/40 bg-rose-950/30 p-3 text-rose-200">
              <div className="font-bold text-rose-300 uppercase tracking-wider text-[11px] mb-1">
                ⚠ Surviving Paths Detected ({lastReceipt.survivors.length}):
              </div>
              <ul className="list-disc pl-4 text-[10px] space-y-0.5 font-mono">
                {lastReceipt.survivors.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Timestamp footer */}
          <div className="flex items-center justify-between text-[10px] text-purple-400/70 pt-2 border-t border-purple-500/20">
            <div>Timestamp: {lastReceipt.timestamp}</div>
            <div>Status: {isNativeClean ? '100% Verified Purge' : 'Review Survivors'}</div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end px-6 py-3.5 border-t border-emerald-500/30 bg-[#06120c]">
          <button
            type="button"
            onClick={closeDossier}
            data-testid="dossier-dismiss-btn"
            className="px-5 py-2 rounded-xl bg-emerald-600 text-white font-bold uppercase tracking-wider text-xs hover:bg-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.4)] transition-all cursor-pointer"
          >
            Acknowledge &amp; Dismiss Dossier
          </button>
        </div>
      </div>
    </div>
  );
}
