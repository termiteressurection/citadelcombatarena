import { beforeAll, describe, expect, it } from 'vitest';
import type { LimbKey } from '../arena/combat';
import { createArenaWorld, initPhysics } from '../arena/physics';
import { PIECE_SHATTER_AT, Ragdoll, RAGDOLL_SHATTER_AT, SeveredPiece, type DebrisKind } from '../arena/ragdoll';
import { STYLE_IDS } from '../arena/styles';

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

  it('launches 30 severed pieces + partial ragdolls safely and disposes cleanly', () => {
    const world = createArenaWorld();
    const kinds: LimbKey[] = ['head', 'armL', 'armR', 'legL', 'legR'];
    for (let k = 0; k < 30; k++) {
      const a = (k / 30) * Math.PI * 2;
      const kind = kinds[k % kinds.length];
      const piece = new SeveredPiece(world, {
        kind, x: Math.cos(a) * 4, z: Math.sin(a) * 4, yaw: a,
        hitX: Math.cos(a), hitZ: Math.sin(a), hitSpeed: 14, color: '#ff4fd8',
      });
      const rag = new Ragdoll(world, {
        x: Math.cos(a) * 5, z: Math.sin(a) * 5, yaw: a,
        vx: 1, vz: 1, hitX: -Math.cos(a), hitZ: -Math.sin(a), hitSpeed: 14, color: '#ff6b6b',
        severed: { head: true, armL: k % 2 === 0, armR: k % 3 === 0, legL: true },
      });
      expect(rag.partNames).not.toContain('head');
      expect(rag.partNames).not.toContain('shinL');
      let pieceDone = false;
      for (let i = 0; i < 60 * 9 && !pieceDone; i++) {
        world.step();
        expect(piece.isFinite()).toBe(true);
        if (!rag.shattered) {
          expect(rag.isFinite()).toBe(true);
          if (rag.tick(1 / 60)) rag.dispose();
        }
        pieceDone = piece.tick(1 / 60);
      }
      expect(pieceDone).toBe(true);
      expect(piece.age).toBeLessThanOrEqual(PIECE_SHATTER_AT + 0.05);
      expect(piece.slept).toBe(true);
      piece.dispose();
      if (!rag.shattered) rag.dispose();
    }
    expect(world.bodies.len()).toBe(0);
  });

  it('launches 40 mixed debris pieces (limbs, armor, weapons across all 5 styles) cleanly', () => {
    const world = createArenaWorld();
    const kinds: DebrisKind[] = ['head', 'armL', 'armR', 'legL', 'legR', 'helm', 'pauldron', 'shield', 'weapon'];
    for (let k = 0; k < 40; k++) {
      const a = (k / 40) * Math.PI * 2;
      const piece = new SeveredPiece(world, {
        kind: kinds[k % kinds.length],
        style: STYLE_IDS[k % STYLE_IDS.length],
        x: Math.cos(a) * 3, z: Math.sin(a) * 3, yaw: a,
        hitX: Math.cos(a), hitZ: Math.sin(a), hitSpeed: 13, color: '#ffc95c',
      });
      let done = false;
      for (let i = 0; i < 60 * 9 && !done; i++) {
        world.step();
        expect(piece.isFinite()).toBe(true);
        done = piece.tick(1 / 60);
      }
      expect(done).toBe(true);
      expect(piece.slept).toBe(true);
      piece.dispose();
    }
    expect(world.bodies.len()).toBe(0);
  });
});
