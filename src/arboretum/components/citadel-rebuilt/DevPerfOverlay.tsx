/**
 * DevPerfOverlay — renders live perf numbers in the top-right.
 *
 * Only mounts when `perfEnabled` is true (dev build + ?perf=1).
 * Never ship-blocking: pure DOM, no canvas cost.
 */

import { useEffect, useState } from 'react';
import {
  perfEnabled,
  perfReport,
  perfReset,
  readAndResetAllocs,
  getAllocBudget,
  type PerfSnapshot,
} from './devPerf';

export default function DevPerfOverlay() {
  const [snap, setSnap] = useState<PerfSnapshot>({ timings: [], counters: {} });
  const [alloc, setAlloc] = useState(0);

  useEffect(() => {
    if (!perfEnabled) return;
    const id = window.setInterval(() => {
      setSnap(perfReport());
      setAlloc(readAndResetAllocs());
    }, 500);
    return () => window.clearInterval(id);
  }, []);

  if (!perfEnabled) return null;

  const overBudget = alloc > getAllocBudget();
  const r = snap.renderer;
  const drawsOver = r ? r.drawCalls > 30 : false;

  return (
    <div
      style={{
        position: 'fixed',
        top: 8,
        right: 8,
        zIndex: 9999,
        fontFamily: 'ui-monospace, Menlo, monospace',
        fontSize: 11,
        lineHeight: 1.35,
        color: '#d8b4fe',
        background: 'rgba(10, 4, 20, 0.78)',
        border: '1px solid rgba(168, 85, 247, 0.45)',
        padding: '8px 10px',
        pointerEvents: 'auto',
        minWidth: 220,
      }}
    >
      <div style={{ color: '#fbbf24', marginBottom: 4, letterSpacing: 1 }}>PERF · dev</div>
      {r && (
        <>
          <div style={{ color: drawsOver ? '#fb7185' : undefined }}>
            draws: {r.drawCalls} {drawsOver ? '(>30!)' : ''}
          </div>
          <div>tris: {r.triangles.toLocaleString()}</div>
          <div>geos: {r.geometries} · texs: {r.textures}</div>
        </>
      )}
      {typeof snap.memoryMB === 'number' && (
        <div>heap: {snap.memoryMB} MB</div>
      )}
      <div style={{ color: overBudget ? '#fb7185' : undefined }}>
        alloc/0.5s: {alloc} {overBudget ? `(>${getAllocBudget()}!)` : ''}
      </div>
      {snap.timings.map(t => (
        <div key={t.key}>
          {t.key}: {t.median.toFixed(2)}ms (p95 {t.p95.toFixed(2)})
        </div>
      ))}
      {Object.entries(snap.counters).map(([k, v]) => (
        <div key={k} style={{ color: '#a78bfa' }}>
          {k}: {v}
        </div>
      ))}
      <button
        onClick={perfReset}
        style={{
          marginTop: 6,
          background: 'transparent',
          border: '1px solid rgba(168, 85, 247, 0.45)',
          color: '#d8b4fe',
          padding: '2px 6px',
          fontSize: 10,
          cursor: 'pointer',
          fontFamily: 'inherit',
        }}
      >
        reset
      </button>
    </div>
  );
}
