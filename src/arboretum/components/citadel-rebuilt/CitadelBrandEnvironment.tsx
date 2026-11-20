/**
 * CitadelBrandEnvironment — opt-in visual brand overlay.
 *
 * Single entry point for the Phase 3+ visual upgrades. Mounts inside the
 * R3F Canvas as a sibling of RebuiltWorld. When the master kill switch is
 * off, every child bails internally and this is a near-zero-cost no-op.
 *
 * Composition:
 *   - NeuralSkybox            → inverted-sphere sky (brick: gradient, else Worley)
 *   - SmallPlanetEnvironment  → curved-horizon ground (flat inside chamber)
 *   - WireframeAltar          → nested additive wireframe at origin
 *   - Static fog              → #030611 (matches electron backgroundColor),
 *                               used regardless of tier. Sampling script is
 *                               unnecessary because the sky shader's darkest
 *                               regions resolve to roughly this hex already,
 *                               and the electron window already uses this
 *                               color as its flash-of-black frame, so the
 *                               seam between viewport chrome and scene fog
 *                               is visually continuous.
 *
 * Mount this ONCE per Canvas. Mounting twice registers materials twice with
 * shaderTimeRegistry, causing double rewinds on overlay close.
 */

import { SmallPlanetEnvironment } from './world/SmallPlanetEnvironment';
import { CitadelSkyDome } from './world/sky/CitadelSkyDome';
import { WireframeAltar } from './world/WireframeAltar';
import { visualFlags } from './visualFlags';
import { WorldLookLayer } from './looks/WorldLookLayer';
import { useWorldLook } from './looks/worldLook';
import type { Chamber } from './types';

export interface CitadelBrandEnvironmentProps {
  chamber?: Chamber | null;
  isNearSigma?: boolean;
}

export function CitadelBrandEnvironment({ chamber, isNearSigma }: CitadelBrandEnvironmentProps = {}) {
  const flags = visualFlags();
  const look = useWorldLook((s) => s.look);

  // Alternate aesthetics replace the wireframe sky / grid / altar wholesale.
  if (look !== 'wireframe') return <WorldLookLayer />;

  return (
    <>
      <CitadelSkyDome chamber={chamber} isNearSigma={isNearSigma} />
      {flags.master && <SmallPlanetEnvironment />}
      {flags.master && <WireframeAltar />}
    </>
  );
}
