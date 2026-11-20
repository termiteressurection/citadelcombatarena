import { useState } from 'react';
import { portableReadText, portableWriteText } from '@/core/persistence/portableMode';
import { useCitadelStore } from '@/core/state/citadelStore';
import { assertImportByteLength, MAX_IMPORT_BYTES } from '@/core/persistence/importLimits';
import { tokens } from '../styles';

type Status = 'idle' | 'exporting' | 'importing' | 'verifying' | 'merged' | 'error';

interface Props {
  onClose: () => void;
}

export function FloppyPanel({ onClose }: Props) {
  const state = useCitadelStore((s) => s.state);
  const exportCartridgeJson = useCitadelStore((s) => s.exportCartridgeJson);
  const applyCartridgeImportJson = useCitadelStore((s) => s.applyCartridgeImportJson);

  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState('');

  const entryCount = Object.values(state.days).reduce((n, d) => n + d.entries.length, 0);

  // Export

  async function handleExport() {
    setStatus('exporting');
    setMessage('');
    try {
      const json = await exportCartridgeJson();
      const filename = `citadel-export-${state.today}.json`;

      if (await portableWriteText(`citadel-runtime/exports/${filename}`, json)) {
        setStatus('idle');
        setMessage(`Exported ${entryCount} entries to citadel-runtime/exports.`);
        return;
      }

      if (isTauri()) {
        const { save } = await import('@tauri-apps/plugin-dialog');
        const { writeTextFile } = await import('@tauri-apps/plugin-fs');
        const path = await save({
          defaultPath: filename,
          filters: [{ name: 'Citadel Cartridge', extensions: ['json'] }],
        });
        if (path) {
          await writeTextFile(path, json);
          setStatus('idle');
          setMessage(`Exported ${entryCount} entries.`);
        } else {
          setStatus('idle');
        }
      } else {
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
        setStatus('idle');
        setMessage(`Exported ${entryCount} entries.`);
      }
    } catch (err) {
      setStatus('error');
      setMessage(String(err));
    }
  }

  // Import

  async function handleImport() {
    setStatus('importing');
    setMessage('');
    try {
      let raw: string | null = null;

      raw = await portableReadText('citadel-runtime/import/citadel-import.json');
      if (raw && isTrmgtsEnvelope(raw)) {
        setStatus('error');
        setMessage('Phone transfers must be imported from Settings > Phone Import.');
        return;
      }
      if (raw) {
        setStatus('verifying');
        await applyCartridgeImportJson(raw);
        setStatus('merged');
        setMessage('Imported citadel-runtime/import/citadel-import.json.');
        return;
      }

      if (isTauri()) {
        const { open } = await import('@tauri-apps/plugin-dialog');
        const { readTextFile, stat } = await import('@tauri-apps/plugin-fs');
        const selected = await open({
          multiple: false,
          filters: [{ name: 'Citadel Cartridge', extensions: ['json'] }],
        });
        if (!selected || typeof selected !== 'string') {
          setStatus('idle');
          return;
        }
        const info = await stat(selected);
        if (!info.isFile) throw new Error('Cartridge import must be a regular file.');
        assertImportByteLength(info.size, 'Cartridge');
        raw = await readTextFile(selected);
      } else {
        raw = await pickFileText();
        if (!raw) {
          setStatus('idle');
          return;
        }
      }

      if (isTrmgtsEnvelope(raw)) {
        setStatus('error');
        setMessage('Phone transfers must be imported from Settings > Phone Import.');
        return;
      }

      setStatus('verifying');
      await applyCartridgeImportJson(raw);
      setStatus('merged');
      setMessage('Cartridge merged.');
    } catch (err) {
      setStatus('error');
      setMessage(String(err));
    }
  }

  // Render

  const statusColor: Record<Status, string> = {
    idle: tokens.textDim,
    exporting: tokens.accent,
    importing: tokens.accent,
    verifying: tokens.midday,
    merged: tokens.commune,
    error: tokens.danger,
  };

  const statusLabel: Record<Status, string> = {
    idle: '',
    exporting: 'exporting...',
    importing: 'reading...',
    verifying: 'verifying hash...',
    merged: 'merged',
    error: 'error',
  };

  const busy = status === 'exporting' || status === 'importing' || status === 'verifying';

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.7)',
        zIndex: 200,
        backdropFilter: 'blur(6px)',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          background: 'rgba(14, 14, 14, 0.98)',
          border: `1px solid ${tokens.border}`,
          borderRadius: tokens.radiusLg,
          padding: `${tokens.gapLg}px`,
          width: 360,
          fontFamily: tokens.fontMono,
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: tokens.gapLg,
          }}
        >
          <div>
            <div
              style={{
                fontSize: tokens.fontSizeXs,
                color: tokens.textDim,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                marginBottom: 4,
              }}
            >
              Data Cartridge
            </div>
            <div style={{ fontSize: tokens.fontSizeSm, color: tokens.text }}>
              Floppy Path — v0 Sync
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: tokens.textDim,
              fontSize: tokens.fontSizeLg,
              cursor: 'pointer',
              lineHeight: 1,
              padding: 4,
            }}
          >
            x
          </button>
        </div>

        <p
          style={{
            fontSize: tokens.fontSizeXs,
            color: tokens.textMuted,
            lineHeight: 1.6,
            marginBottom: tokens.gapLg,
          }}
        >
          Export your entries as a JSON cartridge. Import a cartridge from another
          device. Conflicts resolve by last-write-wins.
        </p>

        <div style={{ display: 'flex', gap: tokens.gapSm, marginBottom: tokens.gap }}>
          <CartridgeButton
            label="Export"
            sublabel={`${entryCount} entries`}
            onClick={handleExport}
            disabled={busy}
            color={tokens.accent}
          />
          <CartridgeButton
            label="Import"
            sublabel="select .json"
            onClick={handleImport}
            disabled={busy}
            color={tokens.midday}
          />
        </div>

        {(status !== 'idle' || message) && (
          <div
            style={{
              fontSize: tokens.fontSizeXs,
              color: statusColor[status],
              letterSpacing: '0.04em',
              minHeight: 16,
            }}
          >
            {statusLabel[status] || message}
            {status !== 'idle' && message && status !== 'error' && ` — ${message}`}
          </div>
        )}
      </div>
    </div>
  );
}

function CartridgeButton({
  label, sublabel, onClick, disabled, color,
}: {
  label: string; sublabel: string; onClick: () => void; disabled: boolean; color: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        flex: 1,
        padding: `${tokens.gapSm}px ${tokens.gap}px`,
        background: 'transparent',
        border: `1px solid ${disabled ? tokens.border : color}`,
        borderRadius: tokens.radius,
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        textAlign: 'left',
        transition: 'border-color 0.15s, opacity 0.15s',
      }}
    >
      <div style={{ fontFamily: tokens.fontMono, fontSize: tokens.fontSizeSm, color: disabled ? tokens.textDim : color, marginBottom: 2 }}>
        {label}
      </div>
      <div style={{ fontFamily: tokens.fontMono, fontSize: tokens.fontSizeXs, color: tokens.textDim }}>
        {sublabel}
      </div>
    </button>
  );
}

function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

function pickFileText(): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) { resolve(null); return; }
      try {
        assertImportByteLength(file.size, 'Cartridge');
        resolve(await file.text());
      } catch (error) {
        reject(error instanceof Error ? error : new Error(`Cartridge exceeds the ${MAX_IMPORT_BYTES}-byte import limit.`));
      }
    };
    input.oncancel = () => resolve(null);
    input.click();
  });
}

function isTrmgtsEnvelope(text: string): boolean {
  try {
    const value: unknown = JSON.parse(text);
    return typeof value === 'object'
      && value !== null
      && 'format' in value
      && value.format === 'trismegistus';
  } catch {
    return false;
  }
}
