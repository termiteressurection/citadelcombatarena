import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { DREAM_FOG } from './DreamEnvironment';
import { DREAM_HORIZON_SRGB } from './dreamGlsl';

/**
 * DreamSkin — re-skins the existing Citadel world into a warm, sunlit gouache
 * storybook look without editing the ~20 files that construct the world:
 *   • Upgrades flat unlit MeshBasicMaterials into lit, matte MeshStandardMaterials
 *     so tree trunks, columns, altars and cottages receive warm directional sunlight
 *     and soft sky bounce light instead of rendering as flat 2D silhouettes.
 *   • Converts wireframe meshes into solid painted surfaces (while keeping faint
 *     outer aura spheres gently translucent).
 *   • Hides raw line segments and the Tron ground/sky shaders (DreamEnvironment
 *     supplies the painted sky, rolling hills, stone path, and sparkles).
 *   • Restores every mesh's exact original material when switching back to Wireframe.
 */

const HIDDEN_LAYER = 29;
const SCAN_INTERVAL_S = 2.0;

const hsl = { h: 0, s: 0, l: 0 };

/** Map any wireframe/dark-mode color into a warm, sunlit storybook palette. */
function dreamifyColor(src: THREE.Color): THREE.Color {
  const out = src.clone();
  out.getHSL(hsl, THREE.SRGBColorSpace);

  // Pitch-dark inner cores (used in wireframe mode to block lines behind columns/buildings)
  // become warm cream/sandstone plaster in Dream mode!
  if (hsl.l < 0.16) {
    out.setRGB(0.94, 0.85, 0.78, THREE.SRGBColorSpace);
    return out;
  }

  // Green / teal hues -> lush sunlit moss & chartreuse
  if (hsl.h >= 0.22 && hsl.h <= 0.48) {
    out.setHSL(0.28 + (hsl.h - 0.35) * 0.3, 0.52, 0.62, THREE.SRGBColorSpace);
    return out;
  }

  // Cyan / blue hues -> soft periwinkle & warm sage-sky
  if (hsl.h > 0.48 && hsl.h < 0.66) {
    out.setHSL(0.55, 0.45, 0.74, THREE.SRGBColorSpace);
    return out;
  }

  // Purple / violet / magenta (tree bark, altar, columns) -> warm plum-rose & terracotta stone
  if (hsl.h >= 0.66 && hsl.h <= 0.92) {
    out.setHSL(0.92, 0.36, 0.66, THREE.SRGBColorSpace);
    return out;
  }

  // Gold / amber / red -> warm butterypeach & rose-gold
  const s = THREE.MathUtils.clamp(hsl.s * 0.65 + 0.12, 0.25, 0.72);
  const l = THREE.MathUtils.clamp(hsl.l * 0.45 + 0.48, 0.56, 0.88);
  out.setHSL(hsl.h, s, l, THREE.SRGBColorSpace);
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
    if (mat.side === THREE.BackSide) return true; // sky domes
    const u = mat.uniforms ?? {};
    if ('uSphereRadius' in u) return true; // lodge Tron floor
    if ('u_lineColor' in u) return true; // small-planet grid
  }
  return false;
}

export function DreamSkin() {
  const scene = useThree((s) => s.scene);
  const savedMeshMaterials = useRef(new Map<THREE.Mesh, THREE.Material | THREE.Material[]>());
  const materialCache = useRef(new Map<string, THREE.MeshLambertMaterial>());
  const hiddenObjects = useRef(new Map<THREE.Object3D, number>());
  const lastChildCount = useRef(-1);
  const scanClock = useRef(0);
  const fogRef = useRef<THREE.Fog | null>(null);

  const hide = (obj: THREE.Object3D) => {
    if (hiddenObjects.current.has(obj)) return;
    hiddenObjects.current.set(obj, obj.layers.mask);
    obj.layers.set(HIDDEN_LAYER);
  };

  const makeDreamMaterial = (orig: THREE.Material): THREE.Material => {
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

    const baseColor = anyOrig.color instanceof THREE.Color
      ? dreamifyColor(anyOrig.color)
      : new THREE.Color('#f0d8e4');

    const origOpacity = typeof orig.opacity === 'number' ? orig.opacity : 1;
    const isWire = Boolean(anyOrig.wireframe);
    // Faint outer aura shells stay softly translucent; wireframe filigree stays crisp wireframe!
    const isAuraShell = orig.transparent && origOpacity < 0.42;
    const opacity = isWire ? Math.max(origOpacity, 0.55) : isAuraShell ? Math.max(origOpacity * 0.55, 0.18) : 1.0;
    const side = orig.side ?? THREE.FrontSide;
    const cacheKey = `${baseColor.getHexString()}_${isWire ? 'w' : isAuraShell ? opacity.toFixed(2) : '1'}_${side}`;

    let cached = materialCache.current.get(cacheKey);
    if (!cached) {
      cached = new THREE.MeshLambertMaterial({
        color: baseColor,
        emissive: baseColor.clone().multiplyScalar(isWire ? 0.45 : 0.24),
        emissiveIntensity: isWire ? 0.65 : 0.45,
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
      if (obj.userData?.dreamOwn) return;
      let p: THREE.Object3D | null = obj.parent;
      while (p) {
        if (p.userData?.dreamOwn) return;
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

      // Skip text sprites (CanvasTexture labels) so floating signs stay crisp
      const hasTexture = list.some((m) => (m as unknown as { map?: THREE.Texture | null }).map != null);
      if (hasTexture) return;

      if (mesh.geometry && !mesh.geometry.attributes.normal) {
        mesh.geometry.computeVertexNormals();
      }

      savedMeshMaterials.current.set(mesh, mesh.material);
      if (Array.isArray(mesh.material)) {
        mesh.material = mesh.material.map(makeDreamMaterial);
      } else {
        mesh.material = makeDreamMaterial(mesh.material);
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
      DREAM_HORIZON_SRGB[0],
      DREAM_HORIZON_SRGB[1],
      DREAM_HORIZON_SRGB[2],
      THREE.SRGBColorSpace,
    );
    const fog = new THREE.Fog(fogColor, DREAM_FOG.near, DREAM_FOG.far);
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
      <ambientLight args={[0xffeef6, 0.65]} userData={{ dreamOwn: true }} />
      <hemisphereLight args={[0xfff0f6, 0xb8d48c, 1.25]} userData={{ dreamOwn: true }} />
      <directionalLight
        args={[0xfff2dc, 1.45]}
        position={[35, 55, 28]}
        userData={{ dreamOwn: true }}
      />
      <directionalLight
        args={[0xf7b8d8, 0.55]}
        position={[-30, 25, -20]}
        userData={{ dreamOwn: true }}
      />
    </>
  );
}
