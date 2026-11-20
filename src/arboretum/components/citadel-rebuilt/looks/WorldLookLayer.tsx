import { DreamEnvironment } from './dream/DreamEnvironment';
import { DreamSkin } from './dream/DreamSkin';
import { ComicEnvironment } from './comic/ComicEnvironment';
import { ComicSkin } from './comic/ComicSkin';
import { AcidEnvironment } from './acid/AcidEnvironment';
import { AcidSkin } from './acid/AcidSkin';
import { MinimalSkin } from './minimal/MinimalSkin';
import { PapercraftEnvironment } from './papercraft/PapercraftEnvironment';
import { PapercraftSkin } from './papercraft/PapercraftSkin';
import { IndustrialEnvironment } from './industrial/IndustrialEnvironment';
import { IndustrialSkin } from './industrial/IndustrialSkin';
import { WesternEnvironment } from './western/WesternEnvironment';
import { WesternSkin } from './western/WesternSkin';
import { ArchetypeLookLayer } from './archetypes/ArchetypeLookLayer';
import { useWorldLook } from './worldLook';

/**
 * WorldLookLayer — mounts the active aesthetic's layer inside the R3F Canvas.
 * Single-pass native rendering (no offscreen WebGLRenderTarget copy) for locked 60-120 FPS.
 */
export function WorldLookLayer() {
  const look = useWorldLook((s) => s.look);
  if (look === 'dream') {
    return (
      <>
        <DreamEnvironment />
        <DreamSkin />
      </>
    );
  }
  if (look === 'comic') {
    return (
      <>
        <ComicEnvironment />
        <ComicSkin />
      </>
    );
  }
  if (look === 'acid') {
    return (
      <>
        <AcidEnvironment />
        <AcidSkin />
      </>
    );
  }
  if (look === 'minimal') {
    return <MinimalSkin />;
  }
  if (look === 'papercraft') {
    return (
      <>
        <PapercraftEnvironment />
        <PapercraftSkin />
      </>
    );
  }
  if (look === 'industrial') {
    return (
      <>
        <IndustrialEnvironment />
        <IndustrialSkin />
      </>
    );
  }
  if (look === 'western') {
    return (
      <>
        <WesternEnvironment />
        <WesternSkin />
      </>
    );
  }
  if (
    look === 'crt' ||
    look === 'ukiyoe' ||
    look === 'cathedral' ||
    look === 'blueprint' ||
    look === 'biolume' ||
    look === 'kintsugi' ||
    look === 'solarpunk' ||
    look === 'noir'
  ) {
    return <ArchetypeLookLayer key={look} id={look} />;
  }
  return null;
}
