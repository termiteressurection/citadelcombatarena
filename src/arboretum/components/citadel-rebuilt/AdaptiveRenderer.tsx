/**
 * AdaptiveRenderer — DRS (dynamic resolution scaling) + adaptive pixel
 * ratio for the R3F Canvas. Mounted as a child of <Canvas/>, it samples
 * frame time each second and lowers/raises gl.setPixelRatio between the
 * tier's min and max values to hold the budget.
 *
 * This is the single biggest BRICK-tier win available, free, invisible.
 */

import { useEffect, useRef } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { getQualityProfile } from './qualityTier';
import { isPs1Visuals } from './ps1Aesthetic';

const SAMPLE_WINDOW_FRAMES = 60;     // ~1s at 60 FPS
const STEP_DOWN_THRESHOLD_FACTOR = 1.15; // > 1.15× budget → step down
const STEP_UP_THRESHOLD_FACTOR = 0.65;   // < 0.65× budget → try step up
const STEP_SIZE = 0.1;
const STABILITY_HOLD_MS = 1500;       // don't bounce after a change

export function AdaptiveRenderer() {
  const gl = useThree(s => s.gl);
  const profile = useRef(getQualityProfile()).current;

  const frameTimes = useRef<number[]>([]);
  const lastChangeAt = useRef(0);
  const lastFrameAt = useRef(performance.now());
  const currentDpr = useRef(profile.maxPixelRatio);

  // Apply tier-driven initial settings exactly once.
  useEffect(() => {
    if (isPs1Visuals()) {
      gl.setPixelRatio(1);
      currentDpr.current = 1;
      return;
    }
    gl.setPixelRatio(profile.maxPixelRatio);
    currentDpr.current = profile.maxPixelRatio;
  }, [gl, profile.maxPixelRatio]);

  useFrame(() => {
    if (isPs1Visuals()) return;
    const now = performance.now();
    const dt = now - lastFrameAt.current;
    lastFrameAt.current = now;

    const buf = frameTimes.current;
    buf.push(dt);
    if (buf.length < SAMPLE_WINDOW_FRAMES) return;
    if (buf.length > SAMPLE_WINDOW_FRAMES) buf.shift();

    if (now - lastChangeAt.current < STABILITY_HOLD_MS) return;

    // Median frame time over the window.
    const sorted = [...buf].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];

    const budget = profile.budgetMs;
    const dpr = currentDpr.current;

    if (median > budget * STEP_DOWN_THRESHOLD_FACTOR && dpr > profile.minPixelRatio) {
      const next = Math.max(profile.minPixelRatio, +(dpr - STEP_SIZE).toFixed(3));
      gl.setPixelRatio(next);
      currentDpr.current = next;
      lastChangeAt.current = now;
      buf.length = 0;
    } else if (median < budget * STEP_UP_THRESHOLD_FACTOR && dpr < profile.maxPixelRatio) {
      const next = Math.min(profile.maxPixelRatio, +(dpr + STEP_SIZE).toFixed(3));
      gl.setPixelRatio(next);
      currentDpr.current = next;
      lastChangeAt.current = now;
      buf.length = 0;
    }
  });

  return null;
}
