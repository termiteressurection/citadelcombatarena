/**
 * shaderTimeRegistry — central registry of u_time-driven ShaderMaterials.
 *
 * Why this exists:
 *
 * The R3F Canvas runs in `frameloop="demand"` whenever a UI overlay is open
 * (see RebuiltGame.tsx). During pause, Three.js clock stops ticking but any
 * material whose shader reads a u_time uniform from `state.clock.elapsedTime`
 * or similar will visibly pause. That is the intended meditative effect.
 *
 * The problem shows up on overlay *close*: the shader jumps forward by
 * pauseDurationMs because the clock resumes from where it left off while
 * the `uiOpen` state machine advances `u_time` via useFrame again. For a
 * pulsing skybox or rotating altar, this looks like a hitch.
 *
 * The fix: every continuous-animation ShaderMaterial registers itself here
 * on construction. On overlay close, the RebuiltGame observer computes the
 * pause duration and calls rewindAll(pauseMs), subtracting the delta from
 * every registered material's u_time uniform. The animation resumes from
 * its pre-pause phase and the hitch disappears.
 *
 * Explicit scope:
 *
 *   - Continuous loops (sky pulse, altar rotation, ground shimmer) REGISTER.
 *   - One-shot animations (portal-open flash, pickup glint) DO NOT. They
 *     capture their own startedAt at the moment the trigger fires. If a
 *     trigger fires while uiOpen=true, the caller is responsible for queuing
 *     it until uiOpen flips to false; the registry does not help them.
 *
 * API shape is module-scope to avoid threading a context through the R3F
 * tree. Materials call register() in their constructor (or an
 * onBeforeCompile hook) and unregister() in their dispose handler.
 */

import type * as THREE from 'three';

type Registrable = THREE.ShaderMaterial | THREE.RawShaderMaterial;

const registry = new Set<Registrable>();

export function register(material: Registrable): void {
  registry.add(material);
}

export function unregister(material: Registrable): void {
  registry.delete(material);
}

export function registrySize(): number {
  return registry.size;
}

/**
 * Subtract `pauseMs` (converted to seconds if the uniform expects seconds)
 * from every registered material's u_time. No-op for materials that do not
 * own a u_time uniform; safe across the whole registry.
 */
export function rewindAll(pauseMs: number): void {
  if (!(pauseMs > 0)) return;
  const pauseSec = pauseMs / 1000;
  for (const mat of registry) {
    const u = mat.uniforms;
    if (!u) continue;
    const t = u['u_time'];
    if (t && typeof t.value === 'number') {
      t.value = Math.max(0, t.value - pauseSec);
    }
  }
}

/**
 * Test / verification helper. Not used at runtime.
 */
export function _debugListMaterials(): Registrable[] {
  return Array.from(registry);
}
