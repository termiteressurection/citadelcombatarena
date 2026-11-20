/**
 * ttiProbe — menu Time-To-Interactive measurement.
 *
 * Two sample points define the interval:
 *
 *   citadel:boot         — taken on module import from RebuiltApp
 *   citadel:menu:mounted — first useEffect of RebuiltMainMenu
 *   citadel:menu:paint   — one requestAnimationFrame after mount, which is
 *                          the commit that contains the menu's first visual
 *                          state (matrix rain, buttons, copy).
 *
 * The reported TTI is menu:paint − boot, in ms. This is the number v6's
 * verification spec compares against after Phase 2 lands the new rain
 * system ("must remain within 50 ms of the Phase 6b baseline").
 *
 * Storage:
 *   window.__citadelTTI = { bootMs, mountMs, paintMs, tti, tti_from_mount }
 *
 * Console: the probe logs once on menu:paint so a human reviewer can scrape
 * the number from devtools without wiring extra tooling.
 *
 * Intentionally framework-free and zero-alloc after first paint. Safe to
 * import from any render path.
 */

export interface TTIReport {
  /** performance.now() at module import. */
  bootMs: number;
  /** performance.now() at menu first useEffect. */
  mountMs: number | null;
  /** performance.now() at first rAF post-mount. */
  paintMs: number | null;
  /** paintMs - bootMs (the TTI figure v6 compares against). */
  tti: number | null;
  /** paintMs - mountMs (isolates React mount cost from JS-parse cost). */
  ttiFromMount: number | null;
}

const report: TTIReport = {
  bootMs: (typeof performance !== 'undefined' ? performance.now() : 0),
  mountMs: null,
  paintMs: null,
  tti: null,
  ttiFromMount: null,
};

function now(): number {
  return typeof performance !== 'undefined' ? performance.now() : 0;
}

function safeMark(name: string): void {
  try {
    if (typeof performance !== 'undefined' && performance.mark) performance.mark(name);
  } catch { /* performance API unavailable */ }
}

safeMark('citadel:boot');

export function markMenuMount(): void {
  if (report.mountMs != null) return;
  report.mountMs = now();
  safeMark('citadel:menu:mounted');
}

export function markMenuPaint(): void {
  if (report.paintMs != null) return;
  report.paintMs = now();
  report.tti = report.paintMs - report.bootMs;
  if (report.mountMs != null) report.ttiFromMount = report.paintMs - report.mountMs;
  safeMark('citadel:menu:paint');
  publish();
  if (typeof console !== 'undefined') {
    // Single log, easy to scrape from devtools. Fixed prefix so verification
    // tooling can regex against it later.
    console.log(
      '[Citadel TTI]',
      `tti=${report.tti!.toFixed(1)}ms`,
      `from_mount=${(report.ttiFromMount ?? 0).toFixed(1)}ms`,
      `boot=${report.bootMs.toFixed(1)}ms`,
    );
  }
}

function publish(): void {
  try {
    (globalThis as unknown as { __citadelTTI?: TTIReport }).__citadelTTI = { ...report };
  } catch { /* globalThis may be frozen */ }
}

export function getTTIReport(): TTIReport {
  return { ...report };
}
