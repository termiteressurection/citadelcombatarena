import { useEffect, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { useCitadelStore } from '../../../../core/state/citadelStore';

interface ImportSession {
  session: string;
  phrase: string;
  endpoint: string;
  deviceName: string;
  qrCode: string;
  qrSvg: string;
}

interface ImportPreview {
  previewId: string;
  entryCount: number;
  perLevelCounts: Record<string, number>;
  deviceName: string | null;
}

interface ImportReceipt {
  imported: number;
  skipped: number;
  perLevelCounts: Record<string, number>;
  warnings: string[];
}

const levelCounts = (counts: Record<string, number>) =>
  Object.entries(counts)
    .map(([level, count]) => `${level}: ${count}`)
    .join(' · ');

export default function TrmgtsImportPanel() {
  const [session, setSession] = useState<ImportSession | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [filePath, setFilePath] = useState('');
  const [filePhrase, setFilePhrase] = useState('');
  const [useSessionPhrase, setUseSessionPhrase] = useState(false);
  const [receipt, setReceipt] = useState<ImportReceipt | null>(null);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const sessionRef = useRef<ImportSession | null>(null);
  const previewRef = useRef<ImportPreview | null>(null);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  useEffect(() => {
    previewRef.current = preview;
  }, [preview]);

  useEffect(() => {
    let disposed = false;
    let unlistenUploaded: (() => void) | undefined;
    let unlistenExpired: (() => void) | undefined;
    let unlistenError: (() => void) | undefined;
    let unlistenRejected: (() => void) | undefined;

    void Promise.all([
      listen('trmgts-import-uploaded', async () => {
        if (disposed) return;
        setBusy(true);
        setError('');
        try {
          const nextPreview = await invoke<ImportPreview>('trmgts_preview_pending');
          if (!disposed) {
            setPreview(nextPreview);
            setStatus('approval');
          }
        } catch (reason) {
          if (!disposed) {
            setSession(null);
            setError(String(reason));
            setStatus('error');
          }
        } finally {
          if (!disposed) setBusy(false);
        }
      }),
      listen('trmgts-import-expired', () => {
        if (!disposed && session) {
          setSession(null);
          setUseSessionPhrase(false);
          setStatus((current) => current === 'waiting' ? 'expired' : current);
          setError((current) => current || 'The five-minute phone import session ended.');
        }
      }),
      listen<string>('trmgts-import-error', (event) => {
        if (!disposed) {
          setError(event.payload);
          setStatus('error');
        }
      }),
      listen<string>('trmgts-import-rejected', (event) => {
        if (!disposed) setError(event.payload);
      }),
    ]).then(([uploaded, expired, failed, rejected]) => {
      if (disposed) {
        uploaded();
        expired();
        failed();
        rejected();
      } else {
        unlistenUploaded = uploaded;
        unlistenExpired = expired;
        unlistenError = failed;
        unlistenRejected = rejected;
      }
    }).catch((reason: unknown) => {
      if (!disposed) setError(`Unable to listen for the phone upload: ${String(reason)}`);
    });

    return () => {
      disposed = true;
      unlistenUploaded?.();
      unlistenExpired?.();
      unlistenError?.();
      unlistenRejected?.();
    };
  }, [session]);

  useEffect(() => () => {
    const activeSession = sessionRef.current;
    const activePreview = previewRef.current;
    if (activeSession) {
      void invoke('trmgts_end_session', { token: activeSession.session }).catch((reason: unknown) => {
        console.error('[citadel] Could not close phone import session', reason);
      });
    }
    if (activePreview) {
      void invoke('trmgts_discard_preview', { previewId: activePreview.previewId }).catch((reason: unknown) => {
        console.error('[citadel] Could not discard phone import preview', reason);
      });
    }
  }, []);

  const startSession = async () => {
    setBusy(true);
    setError('');
    setReceipt(null);
    setPreview(null);
    setStatus('');
    try {
      const nextSession = await invoke<ImportSession>('trmgts_start_session');
      setSession(nextSession);
      setUseSessionPhrase(false);
      setStatus('waiting');
    } catch (reason) {
      setError(String(reason));
      setStatus('error');
      setPreview(null);
      setSession(null);
      setUseSessionPhrase(false);
      setFilePhrase('');
    } finally {
      setBusy(false);
    }
  };

  const chooseFile = async () => {
    setError('');
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const selected = await open({
        multiple: false,
        filters: [{ name: 'Citadel phone transfer', extensions: ['trmgts'] }],
      });
      if (typeof selected === 'string') {
        setFilePath(selected);
        setFilePhrase('');
        setReceipt(null);
      }
    } catch (reason) {
      setError(`Could not open the file picker: ${String(reason)}`);
    }
  };

  const reviewFile = async () => {
    if (!filePath) return;
    setBusy(true);
    setError('');
    setReceipt(null);
    const phrase = useSessionPhrase && session ? session.phrase : filePhrase;
    try {
      const nextPreview = await invoke<ImportPreview>('trmgts_preview_file', {
        path: filePath,
        phrase,
        sessionToken: session?.session ?? null,
      });
      setPreview(nextPreview);
      setStatus('approval');
      setFilePhrase('');
    } catch (reason) {
      setError(String(reason));
      setStatus('error');
      setFilePhrase('');
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    setBusy(true);
    setError('');
    try {
      if (preview) {
        await invoke('trmgts_discard_preview', { previewId: preview.previewId });
      }
      if (session) {
        await invoke('trmgts_end_session', { token: session.session });
      }
      setPreview(null);
      setSession(null);
      setUseSessionPhrase(false);
      setFilePhrase('');
      setStatus('');
      setReceipt(null);
    } catch (reason) {
      setError(`Could not cancel the import session: ${String(reason)}`);
    } finally {
      setBusy(false);
    }
  };

  const accept = async () => {
    if (!preview) return;
    setBusy(true);
    setError('');
    try {
      const result = await invoke<ImportReceipt>('trmgts_accept_import', {
        previewId: preview.previewId,
      });
      setReceipt(result);
      try {
        await useCitadelStore.getState().reloadFromDisk();
      } catch (reloadReason) {
        setError(`Imported, but the chambers could not refresh: ${String(reloadReason)}. Restart Citadel to see them.`);
      }
      setPreview(null);
      setSession(null);
      setUseSessionPhrase(false);
      setFilePhrase('');
      setStatus('complete');
    } catch (reason) {
      let message = String(reason);
      if (session) {
        try {
          await invoke('trmgts_end_session', { token: session.session });
        } catch (cleanupReason) {
          message += `; session cleanup failed: ${String(cleanupReason)}`;
        }
      }
      setError(message);
      setStatus('error');
      setPreview(null);
      setSession(null);
      setUseSessionPhrase(false);
      setFilePhrase('');
    } finally {
      setBusy(false);
    }
  };

  const decline = async () => {
    if (preview) {
      setBusy(true);
      try {
        await invoke('trmgts_discard_preview', { previewId: preview.previewId });
      } catch (reason) {
        setError(`Could not discard the received bundle: ${String(reason)}`);
        setBusy(false);
        return;
      }
      setBusy(false);
    }
    setPreview(null);
    setSession(null);
    setUseSessionPhrase(false);
    setFilePhrase('');
    setStatus('');
    setReceipt(null);
  };

  return (
    <div className="space-y-4" data-testid="trmgts-import-panel">
      <div className="rounded-lg border border-cyan-500/30 bg-cyan-950/15 p-4">
        <div className="text-xs font-bold uppercase tracking-wider text-cyan-200">
          Import journal entries from Citadel Phone
        </div>
        <p className="mt-1.5 text-[11px] leading-relaxed text-purple-200/70">
          Transfers contain only encrypted, chain-validated journal entries. Nothing imports until you review and accept it.
        </p>
        {!session && !preview && (
          <button
            type="button"
            onClick={startSession}
            disabled={busy}
            data-testid="start-phone-import"
            className="mt-3 rounded-lg border border-cyan-400/50 bg-cyan-950/40 px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-cyan-100 hover:bg-cyan-900/50 disabled:opacity-50"
          >
            Import from Phone
          </button>
        )}
      </div>

      {session && (
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 rounded-lg border border-purple-500/30 bg-black/30 p-4">
          <div className="space-y-3">
            <div className="text-xs font-bold uppercase tracking-wider text-amber-200">
              Scan with Citadel Phone
            </div>
            <div className="rounded border border-amber-400/40 bg-amber-950/25 px-3 py-2 text-center text-lg font-bold tracking-widest text-amber-100">
              {session.phrase}
            </div>
            <div className="text-[10px] text-purple-300/70">
              Transfer phrase — use only for this session. Expires in 5 minutes.
            </div>
            <div className="break-all text-[10px] text-purple-400/70">{session.endpoint}</div>
          </div>
          <img
            src={`data:image/svg+xml;base64,${btoa(session.qrSvg)}`}
            alt="Phone import QR code"
            className="h-40 w-40 rounded bg-white p-2"
            data-testid="phone-import-qr"
          />
        </div>
      )}

      {session && status === 'waiting' && (
        <div className="flex items-center justify-between rounded border border-cyan-500/30 bg-cyan-950/20 px-3 py-2 text-[11px] text-cyan-100">
          <span>Waiting for phone…</span>
          <button
            type="button"
            onClick={cancel}
            disabled={busy}
            className="rounded border border-purple-400/30 px-3 py-1 text-[10px] uppercase tracking-wider text-purple-200 hover:bg-purple-900/30"
          >
            Cancel
          </button>
        </div>
      )}

      {!preview && (
        <div className="space-y-2 rounded-lg border border-purple-500/25 bg-purple-950/10 p-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-purple-100">
                File fallback
              </div>
              <div className="mt-0.5 text-[10px] text-purple-300/60">
                Choose a .trmgts file exported by the phone.
              </div>
            </div>
            <button
              type="button"
              onClick={chooseFile}
              disabled={busy}
              className="shrink-0 rounded border border-purple-400/40 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-purple-100 hover:bg-purple-900/30 disabled:opacity-50"
            >
              Import a .trmgts file…
            </button>
          </div>
          {filePath && (
            <>
              <div className="break-all text-[10px] text-purple-300/70">{filePath}</div>
              {session && (
                <label className="flex items-center gap-2 text-[10px] text-amber-200">
                  <input
                    type="checkbox"
                    checked={useSessionPhrase}
                    onChange={(event) => setUseSessionPhrase(event.target.checked)}
                  />
                  Use the session phrase shown above
                </label>
              )}
              {(!session || !useSessionPhrase) && (
                <input
                  type="password"
                  autoComplete="off"
                  value={filePhrase}
                  onChange={(event) => setFilePhrase(event.target.value)}
                  placeholder="Enter the three-word transfer phrase"
                  className="w-full rounded border border-purple-400/35 bg-black/50 px-3 py-2 text-xs text-purple-100 outline-none focus:border-cyan-400"
                />
              )}
              <button
                type="button"
                onClick={reviewFile}
                disabled={busy || (!(useSessionPhrase && session) && !filePhrase.trim())}
                className="rounded border border-cyan-400/40 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-cyan-100 hover:bg-cyan-950/40 disabled:opacity-50"
              >
                Decrypt &amp; Review
              </button>
            </>
          )}
        </div>
      )}

      {preview && (
        <div className="space-y-3 rounded-lg border border-amber-400/40 bg-amber-950/20 p-4" data-testid="phone-import-approval">
          <div className="text-xs font-bold uppercase tracking-wider text-amber-200">
            Review before import
          </div>
          <div className="text-[11px] text-purple-100">
            {preview.deviceName ? `${preview.deviceName} is offering` : 'This file contains'}{' '}
            <strong className="text-amber-100">{preview.entryCount}</strong> journal entries.
          </div>
          <div className="text-[10px] text-purple-300/75">
            {levelCounts(preview.perLevelCounts)}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={accept}
              disabled={busy}
              className="rounded bg-emerald-600 px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              Accept &amp; Import
            </button>
            <button
              type="button"
              onClick={decline}
              disabled={busy}
              className="rounded border border-rose-400/40 px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-rose-200 hover:bg-rose-950/30 disabled:opacity-50"
            >
              Decline
            </button>
          </div>
        </div>
      )}

      {receipt && (
        <div className="space-y-1 rounded-lg border border-emerald-400/35 bg-emerald-950/20 p-3 text-[11px]" data-testid="phone-import-counts">
          <div className="font-bold text-emerald-200">Import complete</div>
          <div className="text-emerald-100">
            Imported {receipt.imported} · Skipped already present {receipt.skipped}
          </div>
          <div className="text-[10px] text-emerald-200/75">
            {levelCounts(receipt.perLevelCounts) || 'No new entries'}
          </div>
          {receipt.warnings.map((warning) => (
            <div key={warning} className="text-[10px] text-amber-200">{warning}</div>
          ))}
        </div>
      )}

      {status === 'expired' && (
        <div className="text-[11px] text-amber-200">The phone import session expired. Start a new session to try again.</div>
      )}
      {error && (
        <div role="alert" className="break-words rounded border border-rose-500/35 bg-rose-950/20 px-3 py-2 text-[11px] text-rose-200">
          {error}
        </div>
      )}
      {busy && <div className="text-[10px] text-purple-300/60">Processing locally…</div>}
    </div>
  );
}
