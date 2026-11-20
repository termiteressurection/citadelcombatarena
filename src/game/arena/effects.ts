import * as THREE from 'three';

interface Shard { x: number; y: number; z: number; vx: number; vy: number; vz: number; life: number; max: number; s: number; color: THREE.Color }

/** Neon shatter: cheap ballistic shards drawn through one InstancedMesh. */
export class ShardPool {
  static readonly CAP = 900;
  private shards: Shard[] = [];
  private dummy = new THREE.Object3D();

  burst(x: number, y: number, z: number, n: number, speed: number, color: string, dirX = 0, dirZ = 0): void {
    const c = new THREE.Color(color);
    for (let i = 0; i < n; i++) {
      if (this.shards.length >= ShardPool.CAP) this.shards.shift();
      const a = Math.random() * Math.PI * 2, e = Math.random() * 0.9 + 0.1;
      const sp = speed * (0.4 + Math.random() * 0.8);
      this.shards.push({
        x, y, z,
        vx: Math.cos(a) * sp * e + dirX * speed * 0.5, vy: Math.random() * sp * 0.9 + 1.5, vz: Math.sin(a) * sp * e + dirZ * speed * 0.5,
        life: 0, max: 0.7 + Math.random() * 0.7, s: 0.07 + Math.random() * 0.12, color: Math.random() < 0.25 ? new THREE.Color('#ffffff') : c,
      });
    }
  }

  get count(): number { return this.shards.length; }

  update(dt: number, mesh: THREE.InstancedMesh): void {
    let w = 0;
    for (let i = 0; i < this.shards.length; i++) {
      const s = this.shards[i];
      s.life += dt;
      if (s.life >= s.max) continue;
      s.vy -= 16 * dt;
      s.x += s.vx * dt; s.y += s.vy * dt; s.z += s.vz * dt;
      if (s.y < 0.05) { s.y = 0.05; s.vy *= -0.4; s.vx *= 0.7; s.vz *= 0.7; }
      const k = 1 - s.life / s.max;
      this.dummy.position.set(s.x, s.y, s.z);
      this.dummy.rotation.set(s.life * 9, s.life * 7, 0);
      this.dummy.scale.setScalar(s.s * k * 1.6);
      this.dummy.updateMatrix();
      mesh.setMatrixAt(w, this.dummy.matrix);
      mesh.setColorAt(w, s.color);
      this.shards[w++] = s;
    }
    this.shards.length = w;
    mesh.count = w;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }
}
