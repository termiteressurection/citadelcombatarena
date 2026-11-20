import React from 'react';

interface Props {
  turnCount: number;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ForgetConversationModal({ turnCount, onConfirm, onCancel }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 font-mono">
      <div className="flex flex-col w-full max-w-md bg-gray-950 border border-red-500/50 rounded-xl shadow-2xl p-6 space-y-4">
        <div className="flex items-center gap-2 text-red-400 font-bold text-sm tracking-wide">
          <span>⚠</span>
          <span>FORGET THIS CONVERSATION</span>
        </div>

        <p className="text-xs text-purple-200/90 leading-relaxed">
          Are you sure you want Sigma to forget this conversation?
        </p>

        <div className="p-3 rounded-lg bg-red-950/20 border border-red-900/40 text-xs text-red-200 space-y-1">
          <div>• <strong>{turnCount} message turns</strong> from this session will be permanently erased.</div>
          <div>• Any <strong>Player Model records</strong> derived solely from this conversation will be revoked.</div>
          <div>• Your verified journal logs and other sessions remain untouched.</div>
        </div>

        <div className="flex justify-end gap-3 pt-2 text-xs">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-gray-300 border border-gray-700 rounded hover:bg-gray-900 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-4 py-2 bg-red-800 hover:bg-red-700 text-white font-bold rounded cursor-pointer"
          >
            Confirm & Forget
          </button>
        </div>
      </div>
    </div>
  );
}
