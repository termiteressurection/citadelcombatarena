import { beforeAll, describe, expect, it } from 'vitest';
import { createArenaWorld, initPhysics } from '../arena/physics';
import { Ragdoll, RAGDOLL_SHATTER_AT } from '../arena/ragdoll';

beforeAll(async () => { await initPhysics(); });

describe('ragdoll stability', () => {
  it('survives 50 consecutive kills with no NaN, tunnelling or explosions', () => {
    const world = createArenaWorld();
    let worstSpeed = 0;
    for (let k = 0; k < 50; k++) {
      const a = (k / 50) * Math.PI * 2;
      const heavy = k % 2 === 0;
      const r = new Ragdoll(world, {
        x: Math.cos(a) * 10, z: Math.sin(a) * 10, yaw: a,
        vx: Math.cos(a) * 3, vz: Math.sin(a) * 3,
        hitX: -Math.cos(a), hitZ: -Math.sin(a), hitSpeed: heavy ? 18 : 8, color: '#fff',
      });
      let done = false;
      for (let i = 0; i < 60 * 5 && !done; i++) {
        world.step();
        for (const b of r.bodies) {
          const v = b.linvel();
          worstSpeed = Math.max(worstSpeed, Math.hypot(v.x, v.y, v.z));
        }
        expect(r.isFinite()).toBe(true);
        done = r.tick(1 / 60);
      }
      expect(done).toBe(true);
      expect(r.age).toBeLessThanOrEqual(RAGDOLL_SHATTER_AT + 0.05);
      expect(r.slept).toBe(true);
      r.dispose();
    }
    expect(worstSpeed).toBeLessThan(60);
    expect(world.bodies.len()).toBe(0);
  });
});
