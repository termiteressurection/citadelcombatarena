import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { COMIC_FOG, COMIC_HORIZON_SRGB } from './ComicEnvironment';

/**
 * ComicSkin — re-skins the Citadel into a crisp four-color Pulp Comic / Cel-Shaded
 * graphic novel world:
 *   • Uses a 3-band stepped gradient map with `MeshToonMaterial` so every column,
 *     branch, and monument snaps into flat comic shadow/midtone/highlight bands.
 *   • Maps colors into high-contrast CMYK pop-art primaries (canary yellow,
 *     crimson-magenta, cyan-blue, vibrant emerald, and warm newsprint cream).
 *   • Pools materials by key and only re-scans when scene children change for
 *     locked 60 FPS performance.
 */

const HIDDEN_LAYER = 29;
const SCAN_INTERVAL_S = 2.0;

const hsl = { h: 0, s: 0, l: 0 };

/** Map any wireframe color into a punchy 4-color comic print palette. */
function comicifyColor(src: THREE.Color): THREE.Color {
  const out = src.clone();
  out.getHSL(hsl, THREE.SRGBColorSpace);

  // Dark inner occlusion cores -> warm newsprint cream with high contrast
  if (hsl.l < 0.16) {
    out.setRGB(0.98, 0.94, 0.82, THREE.SRGBColorSpace);
    return out;
  }

  // Green / teal -> punchy comic emerald
  if (hsl.h >= 0.22 && hsl.h <= 0.48) {
    out.setRGB(0.05, 0.86, 0.48, THREE.SRGBColorSpace);
    return out;
  }

  // Cyan / blue -> electric process cyan
  if (hsl.h > 0.48 && hsl.h < 0.68) {
    out.setRGB(0.0, 0.78, 1.0, THREE.SRGBColorSpace);
    return out;
  }

  // Purple / magenta / violet -> bold crimson-magenta
  if (hsl.h >= 0.68 && hsl.h <= 0.94) {
    out.setRGB(1.0, 0.18, 0.38, THREE.SRGBColorSpace);
    return out;
  }

  // Gold / amber / red -> canary comic yellow
  out.setRGB(1.0, 0.86, 0.08, THREE.SRGBColorSpace);
  return out;
}

function isLineLike(obj: THREE.Object3D): boolean {
  const o = obj as unknown as Record<string, unknown>;
  return o.isLine === true || o.isLineSegments === true || o.isLineLoop === true;
}

function shouldHideMaterial(mat: THREE.Material): boolean {
  const m = mat as unknown as Record<string, unknown>;
  if (m.isLineMaterial === true || m.isLineBasicMaterial === true || m.isLineDashedMaterial === true) return true;
  if (mat instanceof THREE.ShaderMaterial) {
    if (mat.side === THREE.BackSide) return true;
    const u = mat.uniforms ?? {};
    if ('uSphereRadius' in u) return true;
    if ('u_lineColor' in u) return true;
  }
  return false;
}

export function ComicSkin() {
  const scene = useThree((s) => s.scene);
  const savedMeshMaterials = useRef(new Map<THREE.Mesh, THREE.Material | THREE.Material[]>());
  const materialCache = useRef(new Map<string, THREE.MeshToonMaterial>());
  const hiddenObjects = useRef(new Map<THREE.Object3D, number>());
  const lastChildCount = useRef(-1);
  const scanClock = useRef(0);
  const fogRef = useRef<THREE.Fog | null>(null);

  // 3-step nearest-neighbor cel-shading ramp texture
  const toonGradient = useMemo(() => {
    const data = new Uint8Array([95, 185, 255]);
    const tex = new THREE.DataTexture(data, 3, 1, THREE.RedFormat);
    tex.minFilter = THREE.NearestFilter;
    tex.magFilter = THREE.NearestFilter;
    tex.needsUpdate = true;
    return tex;
  }, []);

  useEffect(() => () => toonGradient.dispose(), [toonGradient]);

  const hide = (obj: THREE.Object3D) => {
    if (hiddenObjects.current.has(obj)) return;
    hiddenObjects.current.set(obj, obj.layers.mask);
    obj.layers.set(HIDDEN_LAYER);
  };

  const makeComicMaterial = (orig: THREE.Material): THREE.Material => {
    const anyOrig = orig as unknown as {
      color?: THREE.Color;
      wireframe?: boolean;
      opacity?: number;
      transparent?: boolean;
      side?: THREE.Side;
    };
    if (orig instanceof THREE.ShaderMaterial || orig instanceof THREE.PointsMaterial) {
      return orig;
    }

    const baseColor =
      anyOrig.color instanceof THREE.Color ? comicifyColor(anyOrig.color) : new THREE.Color('#ffe600');

    const origOpacity = typeof orig.opacity === 'number' ? orig.opacity : 1;
    const isWire = Boolean(anyOrig.wireframe);
    const isAuraShell = orig.transparent && origOpacity < 0.42;
    const opacity = isWire ? 0.85 : isAuraShell ? Math.max(origOpacity * 0.5, 0.2) : 1.0;
    const side = orig.side ?? THREE.FrontSide;
    const wireColor = isWire ? new THREE.Color('#08040f') : baseColor;
    const cacheKey = `${wireColor.getHexString()}_${isWire ? 'w' : isAuraShell ? opacity.toFixed(2) : '1'}_${side}`;

    let cached = materialCache.current.get(cacheKey);
    if (!cached) {
      cached = new THREE.MeshToonMaterial({
        color: wireColor,
        gradientMap: toonGradient,
        emissive: wireColor.clone().multiplyScalar(isWire ? 0.05 : 0.18),
        emissiveIntensity: isWire ? 0.1 : 0.35,
        wireframe: isWire,
        transparent: isAuraShell || isWire,
        opacity,
        depthWrite: !isAuraShell,
        side,
      });
      materialCache.current.set(cacheKey, cached);
    }
    return cached;
  };

  const scan = () => {
    scene.traverse((obj) => {
      if (obj.userData?.comicOwn) return;
      let p: THREE.Object3D | null = obj.parent;
      while (p) {
        if (p.userData?.comicOwn) return;
        p = p.parent;
      }

      if (isLineLike(obj)) {
        hide(obj);
        return;
      }

      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh || !mesh.material) return;
      if (savedMeshMaterials.current.has(mesh)) return;

      const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      if (list.some(shouldHideMaterial)) {
        hide(obj);
        return;
      }

      const hasTexture = list.some((m) => (m as unknown as { map?: THREE.Texture | null }).map != null);
      if (hasTexture) return;

      if (mesh.geometry && !mesh.geometry.attributes.normal) {
        mesh.geometry.computeVertexNormals();
      }

      savedMeshMaterials.current.set(mesh, mesh.material);
      if (Array.isArray(mesh.material)) {
        mesh.material = mesh.material.map(makeComicMaterial);
      } else {
        mesh.material = makeComicMaterial(mesh.material);
      }
    });
  };

  const restore = () => {
    savedMeshMaterials.current.forEach((origMat, mesh) => {
      mesh.material = origMat;
    });
    savedMeshMaterials.current.clear();
    materialCache.current.forEach((m) => m.dispose());
    materialCache.current.clear();
    hiddenObjects.current.forEach((mask, obj) => {
      obj.layers.mask = mask;
    });
    hiddenObjects.current.clear();
    lastChildCount.current = -1;
  };

  useEffect(() => {
    const previousFog = scene.fog;
    const previousBackground = scene.background;
    const fogColor = new THREE.Color().setRGB(
      COMIC_HORIZON_SRGB[0],
      COMIC_HORIZON_SRGB[1],
      COMIC_HORIZON_SRGB[2],
      THREE.SRGBColorSpace,
    );
    const fog = new THREE.Fog(fogColor, COMIC_FOG.near, COMIC_FOG.far);
    fogRef.current = fog;
    scene.fog = fog;
    scene.background = null;
    scan();
    return () => {
      restore();
      if (scene.fog === fog) scene.fog = previousFog;
      scene.background = previousBackground;
      fogRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene]);

  useFrame((_, delta) => {
    scanClock.current += delta;
    if (scanClock.current < SCAN_INTERVAL_S) return;
    scanClock.current = 0;
    const fog = fogRef.current;
    if (fog && scene.fog !== fog) scene.fog = fog;
    if (scene.background) scene.background = null;
    if (scene.children.length !== lastChildCount.current) {
      lastChildCount.current = scene.children.length;
      scan();
    }
  });

  return (
    <>
      <ambientLight args={[0xfff7e0, 0.72]} userData={{ comicOwn: true }} />
      <directionalLight
        args={[0xffffff, 1.65]}
        position={[38, 60, 26]}
        userData={{ comicOwn: true }}
      />
      <directionalLight
        args={[0x00d4ff, 0.5]}
        position={[-32, 22, -24]}
        userData={{ comicOwn: true }}
      />
    </>
  );
}
