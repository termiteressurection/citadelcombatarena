import RAPIER from '@dimforge/rapier3d-compat';

export { RAPIER };
export const ARENA_RADIUS = 18;
export const GROUP_WORLD = 0x0001;
export const GROUP_RAGDOLL = 0x0002;
/** membership in the high 16 bits, filter in the low 16 */
export const WORLD_GROUPS = (GROUP_WORLD << 16) | 0xffff;
export const RAGDOLL_GROUPS = (GROUP_RAGDOLL << 16) | GROUP_WORLD; // ragdolls hit the world, never each other

let ready: Promise<void> | null = null;
export function initPhysics(): Promise<void> {
  ready ??= RAPIER.init();
  return ready;
}

/** Floor plus a ring of wall segments that matches the visible arena wall. */
export function createArenaWorld(): RAPIER.World {
  const world = new RAPIER.World({ x: 0, y: -20, z: 0 });
  world.timestep = 1 / 60;
  world.createCollider(RAPIER.ColliderDesc.cuboid(120, 0.5, 120).setTranslation(0, -0.5, 0).setFriction(0.9).setRestitution(0.15).setCollisionGroups(WORLD_GROUPS));
  const segs = 24;
  const arc = (2 * Math.PI * (ARENA_RADIUS + 0.6)) / segs;
  for (let i = 0; i < segs; i++) {
    const a = (i / segs) * Math.PI * 2;
    const r = ARENA_RADIUS + 0.6;
    const q = new RAPIER.Quaternion(0, Math.sin(-a / 2), 0, Math.cos(-a / 2));
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(arc / 2 + 0.05, 2.5, 0.6)
        .setTranslation(Math.cos(a) * r, 2.5, Math.sin(a) * r)
        .setRotation(q)
        .setCollisionGroups(WORLD_GROUPS),
    );
  }
  return world;
}
