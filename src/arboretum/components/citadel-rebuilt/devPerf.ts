/**
 * devPerf.ts — Lightweight, zero-cost-in-prod performance accounting.
 *
 * Usage:
 *   import { perfEnabled, perfTick, perfBegin, perfEnd, perfReport } from './devPerf';
 *   if (perfEnabled) perfBegin('world');
 *   // ...useFrame body...
 *   if (perfEnabled) perfEnd('world');
 *
 * Enabled only when:
 *   - import.meta.env.DEV, AND
 *   - URL contains ?perf=1
 *
 * Production builds (Electron) NEVER show the overlay, regardless of URL.
 */

// Vite exposes DEV as a compile-time constant.
// In Electron production builds this folds to `false` and the rest is tree-shaken.
type MetaEnv = { env?: { DEV?: boolean } };
const viteMeta = (import.meta as unknown as MetaEnv).env;
const isDev = !!viteMeta?.DEV;

function readParam(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return new URLSearchParams(window.location.search).has('perf');
  } catch {
    return false;
  }
}

export const perfEnabled: boolean = isDev && readParam();

// ── Allocation watchdog ────────────────────────────────────────────────
// Increments on each new THREE.Vector3/Vector2/Matrix4/Quaternion/Color
// (when patched). Read once per frame from R3F to detect hot-path leaks.
// Production builds bypass the patch entirely.
let allocCount = 0;
let allocBudget = 50; // per-frame allocation ceiling for warnings

export function bumpAlloc(): void {
  allocCount += 1;
}

export function readAndResetAllocs(): number {
  const v = allocCount;
  allocCount = 0;
  return v;
}

export function setAllocBudget(n: number): void {
  allocBudget = n;
}

export function getAllocBudget(): number {
  return allocBudget;
}

/**
 * Patch THREE.* constructors to count allocations. Call once at boot from
 * the renderer entry. Safe to call when perfEnabled is false (no-op).
 */
export async function installAllocationWatchdog(): Promise<void> {
  if (!perfEnabled) return;
  try {
    const THREE = await import('three');
    const ctors: Array<keyof typeof THREE> = [
      'Vector2', 'Vector3', 'Vector4', 'Matrix3', 'Matrix4',
      'Quaternion', 'Color', 'Euler',
    ];
    for (const name of ctors) {
      const Original = (THREE as unknown as Record<string, unknown>)[name as string] as
        new (...args: unknown[]) => unknown;
      if (typeof Original !== 'function') continue;
      const Patched = function (this: unknown, ...args: unknown[]) {
        bumpAlloc();
        return new (Original as unknown as new (...a: unknown[]) => unknown)(...args);
      } as unknown as typeof Original;
      Patched.prototype = Original.prototype;
      Object.setPrototypeOf(Patched, Original);
      (THREE as unknown as Record<string, unknown>)[name as string] = Patched;
    }
    console.warn('[devPerf] allocation watchdog installed');
  } catch (err) {
    console.warn('[devPerf] failed to install watchdog', err);
  }
}

interface Sample {
  // Rolling median bucket of last N frames (ms).
  samples: number[];
  // Last begin() timestamp (ms since perf origin).
  t0: number;
}

const MAX_SAMPLES = 120; // ~2s @ 60fps
const buckets: Record<string, Sample> = {};

function getBucket(key: string): Sample {
  let b = buckets[key];
  if (!b) {
    b = { samples: [], t0: 0 };
    buckets[key] = b;
  }
  return b;
}

export function perfBegin(key: string): void {
  if (!perfEnabled) return;
  getBucket(key).t0 = performance.now();
}

export function perfEnd(key: string): void {
  if (!perfEnabled) return;
  const b = getBucket(key);
  if (b.t0 === 0) return;
  const dt = performance.now() - b.t0;
  b.t0 = 0;
  b.samples.push(dt);
  if (b.samples.length > MAX_SAMPLES) b.samples.shift();
}

/** Record a single tick count (e.g. thought count, portal count). */
export function perfTick(_key: string, _value: number): void {
  if (!perfEnabled) return;
  // Counters are kept in a separate namespace to avoid colliding with timing buckets.
  counters[_key] = _value;
}

const counters: Record<string, number> = {};

export interface PerfSnapshot {
  timings: Array<{ key: string; median: number; p95: number; count: number }>;
  counters: Record<string, number>;
  renderer?: {
    drawCalls: number;
    triangles: number;
    geometries: number;
    textures: number;
  };
  memoryMB?: number;
  allocPerFrame?: number;
}

function percentile(arr: number[], p: number): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor(sorted.length * p));
  return sorted[idx];
}

type R3FRendererInfo = {
  info?: {
    render?: { calls?: number; triangles?: number };
    memory?: { geometries?: number; textures?: number };
  };
};

type WindowWithR3F = Window & {
  __R3F_RENDERER?: R3FRendererInfo;
};

type PerfWindow = Window & {
  performance: Performance & { memory?: { usedJSHeapSize?: number } };
};

export function perfReport(): PerfSnapshot {
  const timings = Object.entries(buckets).map(([key, b]) => ({
    key,
    median: percentile(b.samples, 0.5),
    p95: percentile(b.samples, 0.95),
    count: b.samples.length,
  }));
  const snap: PerfSnapshot = { timings, counters: { ...counters } };
  if (typeof window !== 'undefined') {
    const r = (window as unknown as WindowWithR3F).__R3F_RENDERER;
    if (r?.info) {
      snap.renderer = {
        drawCalls: r.info.render?.calls ?? -1,
        triangles: r.info.render?.triangles ?? -1,
        geometries: r.info.memory?.geometries ?? -1,
        textures: r.info.memory?.textures ?? -1,
      };
    }
    const mem = (window as unknown as PerfWindow).performance?.memory?.usedJSHeapSize;
    if (typeof mem === 'number') snap.memoryMB = Math.round(mem / 1024 / 1024);
  }
  return snap;
}

/** Clear sample buffers (call before taking a fresh 5-second measurement). */
export function perfReset(): void {
  for (const k of Object.keys(buckets)) {
    buckets[k].samples.length = 0;
  }
}
