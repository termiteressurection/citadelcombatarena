import { RAPIER, RAGDOLL_GROUPS } from './physics';
import type { LimbKey } from './combat';

export type Shape = 'capsule' | 'box' | 'ball';
export interface PartDef { name: string; shape: Shape; size: number[]; pos: [number, number, number] }

/** Eleven-part humanoid, standing, facing +Z, feet at y = 0. +X is left (shield), -X is right (sword). */
export const PARTS: PartDef[] = [
  { name: 'pelvis', shape: 'box', size: [0.17, 0.1, 0.11], pos: [0, 0.95, 0] },
  { name: 'torso', shape: 'box', size: [0.19, 0.25, 0.12], pos: [0, 1.4, 0] },
  { name: 'head', shape: 'ball', size: [0.17], pos: [0, 1.85, 0] },
  { name: 'thighL', shape: 'capsule', size: [0.18, 0.07], pos: [0.11, 0.66, 0] },
  { name: 'thighR', shape: 'capsule', size: [0.18, 0.07], pos: [-0.11, 0.66, 0] },
  { name: 'shinL', shape: 'capsule', size: [0.17, 0.06], pos: [0.11, 0.26, 0] },
  { name: 'shinR', shape: 'capsule', size: [0.17, 0.06], pos: [-0.11, 0.26, 0] },
  { name: 'uarmL', shape: 'capsule', size: [0.13, 0.055], pos: [0.25, 1.48, 0] },
  { name: 'uarmR', shape: 'capsule', size: [0.13, 0.055], pos: [-0.25, 1.48, 0] },
  { name: 'farmL', shape: 'capsule', size: [0.13, 0.05], pos: [0.25, 1.18, 0] },
  { name: 'farmR', shape: 'capsule', size: [0.13, 0.05], pos: [-0.25, 1.18, 0] },
];

const PART_TO_LIMB: Record<string, LimbKey | undefined> = {
  head: 'head',
  uarmL: 'armL',
  farmL: 'armL',
  uarmR: 'armR',
  farmR: 'armR',
  shinL: 'legL',
  shinR: 'legR',
};

interface JointDef { a: string; b: string; at: [number, number, number]; hinge?: [number, number] }
const JOINTS: JointDef[] = [
  { a: 'pelvis', b: 'torso', at: [0, 1.15, 0] },
  { a: 'torso', b: 'head', at: [0, 1.68, 0] },
  { a: 'torso', b: 'uarmL', at: [0.22, 1.6, 0] },
  { a: 'torso', b: 'uarmR', at: [-0.22, 1.6, 0] },
  { a: 'uarmL', b: 'farmL', at: [0.25, 1.32, 0], hinge: [-2.4, 0] },
  { a: 'uarmR', b: 'farmR', at: [-0.25, 1.32, 0], hinge: [-2.4, 0] },
  { a: 'pelvis', b: 'thighL', at: [0.11, 0.88, 0] },
  { a: 'pelvis', b: 'thighR', at: [-0.11, 0.88, 0] },
  { a: 'thighL', b: 'shinL', at: [0.11, 0.45, 0], hinge: [0, 2.4] },
  { a: 'thighR', b: 'shinR', at: [-0.11, 0.45, 0], hinge: [0, 2.4] },
];

export interface SpawnOpts {
  x: number; z: number; yaw: number;
  vx: number; vz: number;
  /** direction (unit) and speed of the killing blow */
  hitX: number; hitZ: number; hitSpeed: number;
  color: string;
  severed?: Partial<Record<LimbKey, boolean>>;
}

export const RAGDOLL_SLEEP_AT = 3.0;
export const RAGDOLL_SHATTER_AT = 3.6;
export const PIECE_SHATTER_AT = 8.0;

let NEXT_ID = 1;
export class Ragdoll {
  readonly id = NEXT_ID++;
  readonly bodies: RAPIER.RigidBody[] = [];
  readonly partNames: string[] = [];
  readonly color: string;
  age = 0;
  slept = false;
  shattered = false;

  constructor(private world: RAPIER.World, o: SpawnOpts) {
    this.color = o.color;
    const q = new RAPIER.Quaternion(0, Math.sin(o.yaw / 2), 0, Math.cos(o.yaw / 2));
    const cos = Math.cos(o.yaw), sin = Math.sin(o.yaw);
    const byName = new Map<string, { body: RAPIER.RigidBody; def: PartDef }>();
    for (const def of PARTS) {
      const limb = PART_TO_LIMB[def.name];
      if (limb && o.severed?.[limb]) continue;
      const [lx, ly, lz] = def.pos;
      const wx = o.x + lx * cos + lz * sin;
      const wz = o.z - lx * sin + lz * cos;
      const body = world.createRigidBody(
        RAPIER.RigidBodyDesc.dynamic().setTranslation(wx, ly, wz).setRotation(q).setLinearDamping(0.35).setAngularDamping(2.2).setCcdEnabled(true),
      );
      const d = def.shape === 'box' ? RAPIER.ColliderDesc.cuboid(def.size[0], def.size[1], def.size[2])
        : def.shape === 'ball' ? RAPIER.ColliderDesc.ball(def.size[0])
        : RAPIER.ColliderDesc.capsule(def.size[0], def.size[1]);
      world.createCollider(d.setFriction(0.9).setRestitution(0.12).setCollisionGroups(RAGDOLL_GROUPS), body);
      this.bodies.push(body);
      this.partNames.push(def.name);
      byName.set(def.name, { body, def });
    }
    for (const j of JOINTS) {
      const A = byName.get(j.a), B = byName.get(j.b);
      if (!A || !B) continue;
      const a1 = { x: j.at[0] - A.def.pos[0], y: j.at[1] - A.def.pos[1], z: j.at[2] - A.def.pos[2] };
      const a2 = { x: j.at[0] - B.def.pos[0], y: j.at[1] - B.def.pos[1], z: j.at[2] - B.def.pos[2] };
      const data = j.hinge ? RAPIER.JointData.revolute(a1, a2, { x: 1, y: 0, z: 0 }) : RAPIER.JointData.spherical(a1, a2);
      if (j.hinge) { data.limitsEnabled = true; data.limits = [j.hinge[0], j.hinge[1]]; }
      const joint = world.createImpulseJoint(data, A.body, B.body, true);
      joint.setContactsEnabled(false);
    }
    // launch
    for (const b of this.bodies) {
      b.setLinvel({ x: o.vx + o.hitX * o.hitSpeed, y: 2.5 + o.hitSpeed * 0.35, z: o.vz + o.hitZ * o.hitSpeed }, true);
    }
    const torso = byName.get('torso')?.body ?? this.bodies[0];
    if (torso) {
      torso.setAngvel({ x: -o.hitZ * Math.min(o.hitSpeed * 0.4, 8), y: (o.hitX - o.hitZ) * 2, z: o.hitX * Math.min(o.hitSpeed * 0.4, 8) }, true);
    }
  }

  /** Advance bookkeeping. Returns true once the ragdoll should shatter and be removed. */
  tick(dt: number): boolean {
    this.age += dt;
    if (!this.slept && this.age >= RAGDOLL_SLEEP_AT) {
      this.slept = true;
      for (const b of this.bodies) b.sleep();
    }
    return !this.shattered && this.age >= RAGDOLL_SHATTER_AT;
  }

  isFinite(): boolean {
    return this.bodies.every((b) => {
      const t = b.translation();
      return Number.isFinite(t.x) && Number.isFinite(t.y) && Number.isFinite(t.z) && Math.abs(t.x) < 200 && t.y > -5 && Math.abs(t.z) < 200;
    });
  }

  dispose(): void {
    if (this.shattered) return;
    this.shattered = true;
    for (const b of this.bodies) this.world.removeRigidBody(b);
    this.bodies.length = 0;
  }
}

export interface SeveredOpts {
  kind: LimbKey;
  x: number; z: number; yaw: number;
  hitX: number; hitZ: number; hitSpeed: number;
  color: string;
}

const PIECE_OFFSETS: Record<LimbKey, [number, number, number]> = {
  head: [0, 1.88, 0],
  torso: [0, 1.35, 0],
  armL: [0.26, 1.35, 0],
  armR: [-0.26, 1.35, 0],
  legL: [0.11, 0.28, 0],
  legR: [-0.11, 0.28, 0],
};

let NEXT_PIECE_ID = 1;

/** A severed stick-limb (and dropped sword/shield) tumbling on the arena sand. */
export class SeveredPiece {
  readonly id = NEXT_PIECE_ID++;
  readonly kind: LimbKey;
  readonly color: string;
  readonly body: RAPIER.RigidBody;
  readonly weaponBody?: RAPIER.RigidBody;
  age = 0;
  slept = false;
  shattered = false;

  constructor(private world: RAPIER.World, o: SeveredOpts) {
    this.kind = o.kind;
    this.color = o.color;
    const q = new RAPIER.Quaternion(0, Math.sin(o.yaw / 2), 0, Math.cos(o.yaw / 2));
    const cos = Math.cos(o.yaw), sin = Math.sin(o.yaw);
    const [lx, ly, lz] = PIECE_OFFSETS[o.kind];
    const wx = o.x + lx * cos + lz * sin;
    const wz = o.z - lx * sin + lz * cos;

    this.body = world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic().setTranslation(wx, ly, wz).setRotation(q)
        .setLinearDamping(0.35).setAngularDamping(1.8).setCcdEnabled(true),
    );
    const col = o.kind === 'head'
      ? RAPIER.ColliderDesc.ball(0.15)
      : RAPIER.ColliderDesc.capsule(o.kind === 'armL' || o.kind === 'armR' ? 0.22 : 0.18, 0.055);
    world.createCollider(col.setFriction(0.85).setRestitution(0.22).setCollisionGroups(RAGDOLL_GROUPS), this.body);

    const sideSign = o.kind === 'armL' || o.kind === 'legL' ? 1 : -1;
    const sideX = cos * sideSign * 2.2;
    const sideZ = -sin * sideSign * 2.2;
    const sp = Math.min(18, o.hitSpeed * 0.75);
    this.body.setLinvel({
      x: o.hitX * sp + sideX,
      y: o.kind === 'head' ? 7.5 : 4.5,
      z: o.hitZ * sp + sideZ,
    }, true);
    this.body.setAngvel({
      x: Math.max(-12, Math.min(12, -o.hitZ * 7 + sideSign * 4)),
      y: Math.max(-12, Math.min(12, sideSign * 6)),
      z: Math.max(-12, Math.min(12, o.hitX * 7)),
    }, true);

    if (o.kind === 'armL' || o.kind === 'armR') {
      const [wlx, wly, wlz] = o.kind === 'armL' ? [0.34, 1.25, 0.1] : [-0.28, 1.05, 0.25];
      const wwx = o.x + wlx * cos + wlz * sin;
      const wwz = o.z - wlx * sin + wlz * cos;
      const wb = world.createRigidBody(
        RAPIER.RigidBodyDesc.dynamic().setTranslation(wwx, wly, wwz).setRotation(q)
          .setLinearDamping(0.3).setAngularDamping(1.5).setCcdEnabled(true),
      );
      const wcol = o.kind === 'armL'
        ? RAPIER.ColliderDesc.cylinder(0.04, 0.24)
        : RAPIER.ColliderDesc.cuboid(0.04, 0.44, 0.04);
      world.createCollider(wcol.setFriction(0.8).setRestitution(0.25).setCollisionGroups(RAGDOLL_GROUPS), wb);
      wb.setLinvel({
        x: o.hitX * sp * 1.15 + sideX * 1.4,
        y: 5.5,
        z: o.hitZ * sp * 1.15 + sideZ * 1.4,
      }, true);
      wb.setAngvel({ x: 8, y: sideSign * 9, z: -6 }, true);
      this.weaponBody = wb;
    }
  }

  tick(dt: number): boolean {
    this.age += dt;
    if (!this.slept && this.age >= RAGDOLL_SLEEP_AT) {
      this.slept = true;
      this.body.sleep();
      this.weaponBody?.sleep();
    }
    return !this.shattered && this.age >= PIECE_SHATTER_AT;
  }

  isFinite(): boolean {
    const ok = (b: RAPIER.RigidBody) => {
      const t = b.translation();
      return Number.isFinite(t.x) && Number.isFinite(t.y) && Number.isFinite(t.z) && Math.abs(t.x) < 200 && t.y > -5 && Math.abs(t.z) < 200;
    };
    return ok(this.body) && (!this.weaponBody || ok(this.weaponBody));
  }

  dispose(): void {
    if (this.shattered) return;
    this.shattered = true;
    this.world.removeRigidBody(this.body);
    if (this.weaponBody) this.world.removeRigidBody(this.weaponBody);
  }
}
