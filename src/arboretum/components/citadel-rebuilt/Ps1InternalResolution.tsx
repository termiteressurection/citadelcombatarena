/**
 * Renders the WebGL buffer at a low resolution then stretches with
 * `image-rendering: pixelated` — the core of the PS1 / 32-bit look.
 */
import { useLayoutEffect } from 'react';
import { useThree } from '@react-three/fiber';
import { isPs1Visuals } from './ps1Aesthetic';

/** Divisor vs CSS viewport (3 ≈ ~640×360 internal on 1080p). */
const INTERNAL_SCALE = 3;

export function Ps1InternalResolution() {
  const gl = useThree(s => s.gl);
  const set = useThree(s => s.set);

  useLayoutEffect(() => {
    if (!isPs1Visuals()) return;
    const canvas = gl.domElement;
    const parent = canvas.parentElement;
    if (!parent) return;

    const apply = () => {
      const rw = Math.max(1, parent.clientWidth);
      const rh = Math.max(1, parent.clientHeight);
      const w = Math.max(256, Math.floor(rw / INTERNAL_SCALE));
      const h = Math.max(180, Math.floor(rh / INTERNAL_SCALE));
      gl.setPixelRatio(1);
      gl.setSize(w, h, false);
      canvas.style.width = `${rw}px`;
      canvas.style.height = `${rh}px`;
      canvas.style.display = 'block';
      canvas.style.imageRendering = 'pixelated';
      (canvas.style as CSSStyleDeclaration & { msInterpolationMode?: string }).msInterpolationMode = 'nearest-neighbor';
      set({ size: { width: w, height: h, top: 0, left: 0 } });
    };

    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(parent);
    return () => ro.disconnect();
  }, [gl, set]);

  return null;
}
