// True 3D force layout for the mindmap: 3D springs + 3D spatial repulsion + 
// isotropic radial centering so the map forms a rich 3D constellation of thought.
// Physics settle smoothly and then sleep completely.

export type Vec3 = [number, number, number];

export interface Spring {
  a: number;
  b: number;
  rest: number;
  k: number;
}

const CELL = 11;
const REPULSION = 10;
const VELOCITY_KEEP = 0.58;
const ALPHA_DECAY = 0.978;
const ALPHA_MIN = 0.012;

export class ForceLayout {
  readonly n: number;
  readonly pos: Float32Array;
  readonly vel: Float32Array;
  readonly pinned: Uint8Array;
  springs: Spring[];
  alpha = 1;

  constructor(initial: Vec3[], springs: Spring[], anchorIndex: number | null) {
    this.n = initial.length;
    this.pos = new Float32Array(this.n * 3);
    this.vel = new Float32Array(this.n * 3);
    this.pinned = new Uint8Array(this.n);
    initial.forEach((p, i) => this.pos.set(p, i * 3));
    this.springs = springs;
    if (anchorIndex !== null && anchorIndex < this.n) {
      this.pinned[anchorIndex] = 1;
      this.pos.set([0, 0, 0], anchorIndex * 3);
    }
  }

  get asleep() {
    return this.alpha < ALPHA_MIN;
  }

  reheat(alpha: number) {
    this.alpha = Math.max(this.alpha, alpha);
  }

  tick() {
    if (this.asleep) return;
    const { n, pos, vel, pinned } = this;
    const a = this.alpha;

    // True 3D spatial hash for local repulsion across all three axes
    const grid = new Map<number, number[]>();
    for (let i = 0; i < n; i++) {
      const cx = Math.floor(pos[i * 3] / CELL) + 1024;
      const cy = Math.floor(pos[i * 3 + 1] / CELL) + 1024;
      const cz = Math.floor(pos[i * 3 + 2] / CELL) + 1024;
      const key = (cx * 2048 + cy) * 2048 + cz;
      let bucket = grid.get(key);
      if (!bucket) grid.set(key, (bucket = []));
      bucket.push(i);
    }

    for (let i = 0; i < n; i++) {
      const cx = Math.floor(pos[i * 3] / CELL) + 1024;
      const cy = Math.floor(pos[i * 3 + 1] / CELL) + 1024;
      const cz = Math.floor(pos[i * 3 + 2] / CELL) + 1024;

      for (let ox = -1; ox <= 1; ox++) {
        for (let oy = -1; oy <= 1; oy++) {
          for (let oz = -1; oz <= 1; oz++) {
            const key = ((cx + ox) * 2048 + (cy + oy)) * 2048 + (cz + oz);
            const bucket = grid.get(key);
            if (!bucket) continue;
            for (const j of bucket) {
              if (j <= i) continue;
              let dx = pos[j * 3] - pos[i * 3];
              let dy = pos[j * 3 + 1] - pos[i * 3 + 1];
              let dz = pos[j * 3 + 2] - pos[i * 3 + 2];
              let d2 = dx * dx + dy * dy + dz * dz;
              if (d2 > CELL * CELL) continue;
              if (d2 < 1e-4) {
                dx = (i % 7) * 0.02 + 0.01;
                dy = (j % 5) * 0.02 + 0.01;
                dz = ((i + j) % 6) * 0.02 - 0.05;
                d2 = dx * dx + dy * dy + dz * dz;
              }
              const d = Math.sqrt(d2);
              const f = (REPULSION / Math.max(d2, 0.6)) * a;
              const fx = (dx / d) * f;
              const fy = (dy / d) * f;
              const fz = (dz / d) * f;
              vel[i * 3] -= fx;
              vel[i * 3 + 1] -= fy;
              vel[i * 3 + 2] -= fz;
              vel[j * 3] += fx;
              vel[j * 3 + 1] += fy;
              vel[j * 3 + 2] += fz;
            }
          }
        }
      }
    }

    // 3D Springs
    for (const s of this.springs) {
      const dx = pos[s.b * 3] - pos[s.a * 3];
      const dy = pos[s.b * 3 + 1] - pos[s.a * 3 + 1];
      const dz = pos[s.b * 3 + 2] - pos[s.a * 3 + 2];
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 0.001;
      const f = (d - s.rest) * s.k * a;
      const fx = (dx / d) * f;
      const fy = (dy / d) * f;
      const fz = (dz / d) * f;
      vel[s.a * 3] += fx;
      vel[s.a * 3 + 1] += fy;
      vel[s.a * 3 + 2] += fz;
      vel[s.b * 3] -= fx;
      vel[s.b * 3 + 1] -= fy;
      vel[s.b * 3 + 2] -= fz;
    }

    // Isotropic 3D radial centering and damping
    for (let i = 0; i < n; i++) {
      const o = i * 3;
      if (pinned[i]) {
        vel[o] = vel[o + 1] = vel[o + 2] = 0;
        continue;
      }
      vel[o] -= pos[o] * 0.004 * a;
      vel[o + 1] -= pos[o + 1] * 0.004 * a;
      vel[o + 2] -= pos[o + 2] * 0.004 * a;
      for (let k = 0; k < 3; k++) {
        vel[o + k] *= VELOCITY_KEEP;
        const v = Math.max(-2, Math.min(2, vel[o + k]));
        pos[o + k] += v;
      }
    }
    this.alpha *= ALPHA_DECAY;
  }

  /** Run synchronously until asleep or the time budget is spent. */
  settle(budgetMs: number, now: () => number = () => performance.now()) {
    const start = now();
    while (!this.asleep && now() - start < budgetMs) this.tick();
  }

  get(i: number): Vec3 {
    return [this.pos[i * 3], this.pos[i * 3 + 1], this.pos[i * 3 + 2]];
  }

  set(i: number, p: Vec3) {
    this.pos.set(p, i * 3);
    this.vel.fill(0, i * 3, i * 3 + 3);
  }
}
