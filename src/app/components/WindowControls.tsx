import { getCurrentWindow } from '@tauri-apps/api/window';
import { useState } from 'react';
import { tokens } from '../styles';

export function WindowControls() {
  const [hoverClose, setHoverClose] = useState(false);
  const [hoverMin, setHoverMin] = useState(false);

  // Guard: Window controls only exist in the native shell
  if (typeof window === 'undefined' || !('__TAURI_INTERNALS__' in window)) {
    return null;
  }

  const appWindow = getCurrentWindow();

  const controlStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 32,
    height: 32,
    fontFamily: tokens.fontMono,
    fontSize: tokens.fontSizeSm,
    cursor: 'pointer',
    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
    userSelect: 'none',
  };

  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {/* Minimize */}
      <div
        style={{
          ...controlStyle,
          color: hoverMin ? tokens.accent : tokens.textDim,
          background: hoverMin ? 'rgba(255, 255, 255, 0.05)' : 'transparent',
        }}
        onMouseEnter={() => setHoverMin(true)}
        onMouseLeave={() => setHoverMin(false)}
        onClick={() => appWindow.minimize()}
        title="Minimize"
      >
        _
      </div>

      {/* Close */}
      <div
        style={{
          ...controlStyle,
          color: hoverClose ? '#ff5555' : tokens.textDim,
          background: hoverClose ? 'rgba(255, 85, 85, 0.1)' : 'transparent',
        }}
        onMouseEnter={() => setHoverClose(true)}
        onMouseLeave={() => setHoverClose(false)}
        onClick={() => appWindow.close()}
        title="Close"
      >
        ×
      </div>
    </div>
  );
}
