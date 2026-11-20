import { useLayoutEffect } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useGame } from '../store';
import { useArena } from '../arena/arenaStore';

const INTERNAL_DIVISOR = 2.4;

/** Renders Three.js into a crisp low-res PS1 buffer stretched pixelated across the viewport. */
export function Ps1Resolution() {
  const gl = useThree((s) => s.gl);
  const set = useThree((s) => s.set);
  const camera = useThree((s) => s.camera);
  const ps1Mode = useGame((s) => s.ps1Mode);

  useLayoutEffect(() => {
    const canvas = gl.domElement;
    const parent = canvas.parentElement;
    if (!parent) return;

    const apply = () => {
      const rw = Math.max(1, parent.clientWidth);
      const rh = Math.max(1, parent.clientHeight);
      const dpr = ps1Mode ? 1 : Math.min(window.devicePixelRatio || 1, 1.5);
      const w = ps1Mode ? Math.max(320, Math.floor(rw / INTERNAL_DIVISOR)) : rw;
      const h = ps1Mode ? Math.max(200, Math.floor(rh / INTERNAL_DIVISOR)) : rh;
      gl.setPixelRatio(dpr);
      gl.setSize(w, h, false);
      canvas.style.width = `${rw}px`;
      canvas.style.height = `${rh}px`;
      canvas.style.display = 'block';
      canvas.style.imageRendering = ps1Mode ? 'pixelated' : 'auto';
      set({ size: { width: w, height: h, top: 0, left: 0 } });
      if (camera instanceof THREE.PerspectiveCamera) {
        camera.aspect = rw / rh;
        camera.updateProjectionMatrix();
      }
    };

    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(parent);
    return () => ro.disconnect();
  }, [gl, set, camera, ps1Mode]);

  return null;
}

/** Non-blocking CRT scanlines, beveled retro bezel, and reactive combat edge vignette. */
export function Ps1Overlay() {
  const ps1Mode = useGame((s) => s.ps1Mode);
  const scene = useGame((s) => s.scene);
  const phase = useArena((s) => s.phase);
  const combo = useArena((s) => s.combo);
  const playerLimbs = useArena((s) => s.playerLimbs);

  const inFight = scene === 'arena' && phase === 'fight';
  const critLimb = inFight && Object.values(playerLimbs).some((l) => l.r <= 0.35 || l.s);
  const hotCombo = inFight && !critLimb && combo >= 2;

  return (
    <div
      aria-hidden
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 4,
        overflow: 'hidden',
      }}
    >
      {ps1Mode && (
        <>
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background:
                'repeating-linear-gradient(to bottom, transparent 0px, transparent 2px, rgba(4, 2, 10, 0.22) 2px, rgba(4, 2, 10, 0.22) 3px)',
            }}
          />
          <div
            style={{
              position: 'absolute',
              inset: 0,
              boxShadow:
                'inset 0 0 0 6px #07050c, inset 0 0 0 8px #2a2138, inset 0 0 90px rgba(0, 0, 0, 0.58)',
            }}
          />
        </>
      )}
      {critLimb && (
        <div
          className="limb-crit"
          style={{
            position: 'absolute',
            inset: 0,
            boxShadow: 'inset 0 0 95px rgba(255, 40, 72, 0.42)',
          }}
        />
      )}
      {hotCombo && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            boxShadow: 'inset 0 0 70px rgba(255, 201, 92, 0.22)',
          }}
        />
      )}
    </div>
  );
}
