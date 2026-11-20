export interface Circle { x: number; z: number; r: number }
export interface Bounds { minX: number; maxX: number; minZ: number; maxZ: number }
export interface Point { x: number; z: number }

/** Push a circle (centre p, radius) out of every solid circle. Mutates p. */
export function resolveCircles(p: Point, radius: number, solids: readonly Circle[]): void {
  for (const c of solids) {
    const dx = p.x - c.x;
    const dz = p.z - c.z;
    const min = radius + c.r;
    const d2 = dx * dx + dz * dz;
    if (d2 >= min * min) continue;
    const d = Math.sqrt(d2) || 1e-6;
    p.x = c.x + (dx / d) * min;
    p.z = c.z + (dz / d) * min;
  }
}

export function clampBounds(p: Point, radius: number, b: Bounds): void {
  p.x = Math.min(b.maxX - radius, Math.max(b.minX + radius, p.x));
  p.z = Math.min(b.maxZ - radius, Math.max(b.minZ + radius, p.z));
}

export function isFree(x: number, z: number, margin: number, solids: readonly Circle[], b: Bounds): boolean {
  if (x < b.minX + margin || x > b.maxX - margin || z < b.minZ + margin || z > b.maxZ - margin) return false;
  return solids.every((c) => Math.hypot(x - c.x, z - c.z) > c.r + margin);
}
