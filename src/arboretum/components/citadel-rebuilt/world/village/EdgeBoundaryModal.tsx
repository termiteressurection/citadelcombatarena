import React, { useEffect, useCallback } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { useVillageTunerStore } from '@/core/state/villageTunerStore';

interface EdgeBoundaryModalProps {
  onTeleportCenter?: () => void;
}

export function EdgeBoundaryModal({ onTeleportCenter }: EdgeBoundaryModalProps) {
  const edgeModalOpen = useVillageTunerStore((state) => state.edgeModalOpen);
  const setEdgeModalOpen = useVillageTunerStore((state) => state.setEdgeModalOpen);

  const handleCloseApp = useCallback(async () => {
    try {
      if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) {
        const appWindow = getCurrentWindow();
        await appWindow.close();
      } else {
        window.close();
      }
    } catch (err) {
      console.warn('[citadel-edge] Error closing window:', err);
      // Fallback
      if (typeof window !== 'undefined') {
        window.close();
      }
    }
  }, []);

  const handleTeleportBack = useCallback(() => {
    setEdgeModalOpen(false);
    if (onTeleportCenter) {
      onTeleportCenter();
    } else if (typeof window !== 'undefined' && (window as any).__CITADEL_TELEPORT_SPAWN__) {
      (window as any).__CITADEL_TELEPORT_SPAWN__();
    }
  }, [onTeleportCenter, setEdgeModalOpen]);

  // Trap Escape to teleport back (non-destructive safety)
  useEffect(() => {
    if (!edgeModalOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.code === 'KeyT') {
        e.preventDefault();
        handleTeleportBack();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [edgeModalOpen, handleTeleportBack]);

  if (!edgeModalOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-fade-in">
      <div className="relative max-w-lg w-full rounded-2xl border border-rose-500/50 bg-[#070314]/95 p-7 shadow-[0_0_60px_rgba(244,63,94,0.35)] text-center font-mono">
        {/* Monospace Error Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-rose-500/40 bg-rose-950/40 text-rose-300 text-xs font-bold tracking-widest uppercase mb-4">
          <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
          <span>System Out Of Bounds</span>
        </div>

        {/* Exact Error Message */}
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white mb-2 leading-relaxed">
          Error [null]: Your mind has wandered enough, return to the task at hand
        </h2>

        <p className="text-xs text-rose-300/70 mb-8 max-w-sm mx-auto leading-relaxed">
          You have reached the edge of the known sanctuary (r &ge; 900). Beyond here lies only quiet recursion and unwritten memory.
        </p>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            type="button"
            onClick={handleCloseApp}
            className="w-full sm:w-1/2 py-3 px-4 rounded-xl border border-rose-500/50 bg-rose-950/40 text-rose-200 text-xs font-bold uppercase tracking-wider hover:bg-rose-900/60 hover:border-rose-400 transition-all shadow-lg active:scale-95"
          >
            Close app
          </button>

          <button
            type="button"
            onClick={handleTeleportBack}
            className="w-full sm:w-1/2 py-3 px-4 rounded-xl border border-cyan-400 bg-cyan-950/60 text-cyan-200 text-xs font-bold uppercase tracking-wider hover:bg-cyan-900/80 hover:border-cyan-300 hover:shadow-[0_0_20px_rgba(34,211,238,0.4)] transition-all shadow-lg active:scale-95"
          >
            Teleport back to town center
          </button>
        </div>
      </div>
    </div>
  );
}
