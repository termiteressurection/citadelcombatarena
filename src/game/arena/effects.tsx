import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { Atk } from './combat';
import { moveOf, type MoveMotion, type StyleId } from './styles';

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

export type SlashKind = Atk | 'parry';

interface SlashSlot {
  active: boolean;
  x: number;
  y: number;
  z: number;
  yaw: number;
  kind: SlashKind;
  style: StyleId;
  motion?: MoveMotion;
  color: THREE.Color;
  life: number;
  max: number;
}

/** Curved neon blade ribbons and bash/parry shockwaves, pooled with zero per-frame allocations. */
export class SlashPool {
  static readonly CAP = 10;
  readonly slots: SlashSlot[] = Array.from({ length: SlashPool.CAP }, () => ({
    active: false, x: 0, y: 1.25, z: 0, yaw: 0, kind: 'light', style: 'murmillo', color: new THREE.Color('#ffffff'), life: 0, max: 0.18,
  }));

  spawn(x: number, z: number, yaw: number, kind: SlashKind, color: string, style: StyleId = 'murmillo', motion?: MoveMotion): void {
    let slot = this.slots.find((s) => !s.active);
    if (!slot) {
      slot = this.slots.reduce((a, b) => (a.life / a.max > b.life / b.max ? a : b));
    }
    slot.active = true;
    slot.x = x;
    slot.y = kind === 'bash' || kind === 'parry' ? 1.15 : 1.28;
    slot.z = z;
    slot.yaw = yaw;
    slot.kind = kind;
    slot.style = style;
    slot.motion = motion;
    slot.color.set(color);
    slot.life = 0;
    slot.max = kind === 'heavy' || kind === 'light3' ? 0.24 : kind === 'parry' ? 0.28 : 0.18;
  }

  update(dt: number): void {
    for (const s of this.slots) {
      if (!s.active) continue;
      s.life += dt;
      if (s.life >= s.max) s.active = false;
    }
  }
}

export function SlashRibbons({ pool }: { pool: SlashPool }) {
  const roots = useRef<(THREE.Group | null)[]>([]);
  const arcs = useRef<(THREE.Mesh | null)[]>([]);
  const rings = useRef<(THREE.Mesh | null)[]>([]);
  const lances = useRef<(THREE.Mesh | null)[]>([]);

  const { arcGeo, ringGeo, lanceGeo, mats } = useMemo(() => {
    const a = new THREE.RingGeometry(0.95, 2.35, 20, 1, -1.1, 2.2);
    a.rotateX(-Math.PI / 2);
    a.rotateY(-Math.PI / 2);
    const r = new THREE.RingGeometry(0.5, 0.85, 24);
    r.rotateX(-Math.PI / 2);
    const l = new THREE.ConeGeometry(0.24, 2.8, 5);
    l.translate(0, 1.4, 0);
    l.rotateX(Math.PI / 2);
    const ms = Array.from({ length: SlashPool.CAP }, () => new THREE.MeshBasicMaterial({
      color: '#ffffff', transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    }));
    return { arcGeo: a, ringGeo: r, lanceGeo: l, mats: ms };
  }, []);

  useFrame(() => {
    for (let i = 0; i < SlashPool.CAP; i++) {
      const s = pool.slots[i];
      const root = roots.current[i];
      const arc = arcs.current[i];
      const ring = rings.current[i];
      const lance = lances.current[i];
      if (!root || !arc || !ring || !lance) continue;
      if (!s.active) {
        root.visible = false;
        continue;
      }
      root.visible = true;
      root.position.set(s.x, s.y, s.z);
      root.rotation.set(0, s.yaw, 0);

      const p = Math.min(1, s.life / s.max);
      const mat = mats[i];
      mat.color.copy(s.color);
      mat.opacity = (1 - p) * (1 - p) * 0.92;

      const motion = s.kind === 'parry' ? 'parry' : s.motion ?? moveOf(s.style, s.kind).motion;
      if (motion === 'bash' || motion === 'parry' || motion === 'netThrow') {
        arc.visible = false;
        lance.visible = false;
        ring.visible = true;
        const sc = s.kind === 'parry' ? 0.7 + p * 2.8 : motion === 'netThrow' ? 0.9 + p * 3.8 : 0.6 + p * 1.9;
        ring.scale.setScalar(sc);
      } else if (motion === 'thrust') {
        arc.visible = false;
        ring.visible = false;
        lance.visible = true;
        const heavyThrust = s.kind === 'heavy' || s.kind === 'light3';
        const fwdBoost = 0.65 + p * (heavyThrust ? 1.1 : 0.6);
        lance.position.set(0, 0.05, 0.35 + p * 0.85);
        lance.scale.set(heavyThrust ? 1.35 : 0.9, heavyThrust ? 1.35 : 0.9, fwdBoost * (s.kind === 'heavy' ? 1.45 : 1.0));
      } else {
        arc.visible = true;
        ring.visible = motion === 'crush' && p > 0.25;
        lance.visible = motion === 'twinCross';
        arc.position.set(0, 0, 0);
        const stScale = s.style === 'executioner' ? 1.38 : s.style === 'dimachaerus' ? 0.95 : 1.0;
        if (motion === 'sweep') {
          arc.rotation.set(0, THREE.MathUtils.lerp(-0.85, 0.85, p), 0.16);
          arc.scale.setScalar(1.38 * stScale);
        } else if (motion === 'crush' || motion === 'overhead' || motion === 'twinSlash') {
          arc.rotation.set(THREE.MathUtils.lerp(-0.45, 0.38, p), 0, Math.PI / 2);
          arc.position.set(0, 0.18, 0);
          arc.scale.setScalar((motion === 'crush' ? 1.3 : 1.18) * stScale);
          if (ring.visible) ring.scale.setScalar(0.8 + p * 2.4);
        } else if (motion === 'twinCross') {
          arc.rotation.set(0, THREE.MathUtils.lerp(-0.65, 0.7, p), 0.45);
          arc.scale.setScalar(1.22 * stScale);
          lance.position.set(0, 0.05, 0.3);
          lance.scale.set(1.2, 0.7, 0.8 + p * 0.5);
        } else if (motion === 'backhand') {
          arc.rotation.set(0, THREE.MathUtils.lerp(0.55, -0.55, p), -0.24);
          arc.scale.setScalar(1.04 * stScale);
        } else {
          arc.rotation.set(0, THREE.MathUtils.lerp(-0.55, 0.55, p), 0.24);
          arc.scale.setScalar(1.0 * stScale);
        }
      }
    }
  });

  return (
    <group>
      {pool.slots.map((_, i) => (
        <group key={i} ref={(el) => { roots.current[i] = el; }} visible={false}>
          <mesh ref={(el) => { arcs.current[i] = el; }} geometry={arcGeo} material={mats[i]} />
          <mesh ref={(el) => { rings.current[i] = el; }} geometry={ringGeo} material={mats[i]} />
          <mesh ref={(el) => { lances.current[i] = el; }} geometry={lanceGeo} material={mats[i]} />
        </group>
      ))}
    </group>
  );
}

interface GhostSlot {
  active: boolean;
  x: number;
  z: number;
  yaw: number;
  color: THREE.Color;
  life: number;
  max: number;
  tiltX: number;
  tiltZ: number;
}

/** Fading stick-figure dash afterimages, pooled with zero allocations. */
export class GhostPool {
  static readonly CAP = 12;
  readonly slots: GhostSlot[] = Array.from({ length: GhostPool.CAP }, () => ({
    active: false, x: 0, z: 0, yaw: 0, color: new THREE.Color('#3ff0ff'), life: 0, max: 0.26, tiltX: 0, tiltZ: 0,
  }));

  spawn(x: number, z: number, yaw: number, color: string, tiltX: number, tiltZ: number): void {
    let slot = this.slots.find((s) => !s.active);
    if (!slot) {
      slot = this.slots.reduce((a, b) => (a.life / a.max > b.life / b.max ? a : b));
    }
    slot.active = true;
    slot.x = x;
    slot.z = z;
    slot.yaw = yaw;
    slot.color.set(color);
    slot.life = 0;
    slot.max = 0.26;
    slot.tiltX = tiltX;
    slot.tiltZ = tiltZ;
  }

  update(dt: number): void {
    for (const s of this.slots) {
      if (!s.active) continue;
      s.life += dt;
      if (s.life >= s.max) s.active = false;
    }
  }
}

export function DashGhosts({ pool }: { pool: GhostPool }) {
  const roots = useRef<(THREE.Group | null)[]>([]);

  const { headGeo, torsoGeo, limbGeo, mats } = useMemo(() => ({
    headGeo: new THREE.BoxGeometry(0.075, 0.2, 0.075),
    torsoGeo: new THREE.BoxGeometry(0.1, 0.56, 0.1),
    limbGeo: new THREE.BoxGeometry(0.08, 0.72, 0.08),
    mats: Array.from({ length: GhostPool.CAP }, () => new THREE.MeshBasicMaterial({
      color: '#3ff0ff', transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false,
    })),
  }), []);

  useFrame(() => {
    for (let i = 0; i < GhostPool.CAP; i++) {
      const s = pool.slots[i];
      const g = roots.current[i];
      if (!g) continue;
      if (!s.active) {
        g.visible = false;
        continue;
      }
      g.visible = true;
      g.position.set(s.x, 0.72, s.z);
      g.rotation.order = 'YXZ';
      g.rotation.set(s.tiltX, s.yaw, s.tiltZ);
      const p = Math.min(1, s.life / s.max);
      mats[i].color.copy(s.color);
      mats[i].opacity = (1 - p) * 0.52;
    }
  });

  return (
    <group>
      {pool.slots.map((_, i) => (
        <group key={i} ref={(el) => { roots.current[i] = el; }} visible={false}>
          <mesh position={[0, 0.85, 0]} geometry={headGeo} material={mats[i]} />
          <mesh position={[0, 0.34, 0]} geometry={torsoGeo} material={mats[i]} />
          <mesh position={[0.11, -0.35, 0]} rotation={[-0.25, 0, 0]} geometry={limbGeo} material={mats[i]} />
          <mesh position={[-0.11, -0.35, 0]} rotation={[0.25, 0, 0]} geometry={limbGeo} material={mats[i]} />
          <mesh position={[0.24, 0.32, 0.12]} rotation={[-0.6, 0, 0.2]} geometry={limbGeo} material={mats[i]} />
          <mesh position={[-0.24, 0.32, 0.12]} rotation={[-0.6, 0, -0.2]} geometry={limbGeo} material={mats[i]} />
        </group>
      ))}
    </group>
  );
}
