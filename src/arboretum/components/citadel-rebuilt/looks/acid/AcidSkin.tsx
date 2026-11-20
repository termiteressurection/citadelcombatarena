import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { ACID_FOG, ACID_HORIZON_SRGB } from './AcidEnvironment';

/**
 * AcidSkin — re-skins Citadel architecture into iridescent, psychedelic
 * crystal structures with chromatic emissive auras.
 */

const HIDDEN_LAYER = 29;
const SCAN_INTERVAL_S = 2.0;

const hsl = { h: 0, s: 0, l: 0 };

/** Map wireframe colors into intense neon psychedelic pigments. */
function acidifyColor(src: THREE.Color): THREE.Color {
  const out = src.clone();
  out.getHSL(hsl, THREE.SRGBColorSpace);

  // Black occlusion cores become deep iridescent ultraviolet crystal
  if (hsl.l < 0.16) {
    out.setRGB(0.12, 0.02, 0.22, THREE.SRGBColorSpace);
    return out;
  }

  // Shift hues into saturated psychedelic primaries
  if (hsl.h >= 0.2 && hsl.h < 0.45) {
    // Electric laser lime
    out.setRGB(0.22, 1.0, 0.08, THREE.SRGBColorSpace);
    return out;
  }
  if (hsl.h >= 0.45 && hsl.h < 0.68) {
    // Electric hyper cyan
    out.setRGB(0.0, 0.94, 1.0, THREE.SRGBColorSpace);
    return out;
  }
  if (hsl.h >= 0.68 && hsl.h < 0.92) {
    // Neon hot magenta
    out.setRGB(1.0, 0.0, 0.55, THREE.SRGBColorSpace);
    return out;
  }

  // Solar psychedelic gold
  out.setRGB(1.0, 0.88, 0.0, THREE.SRGBColorSpace);
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

export function AcidSkin() {
  const scene = useThree((s) => s.scene);
  const savedMeshMaterials = useRef(new Map<THREE.Mesh, THREE.Material | THREE.Material[]>());
  const materialCache = useRef(new Map<string, THREE.MeshStandardMaterial>());
  const hiddenObjects = useRef(new Map<THREE.Object3D, number>());
  const lastChildCount = useRef(-1);
  const scanClock = useRef(0);
  const fogRef = useRef<THREE.Fog | null>(null);

  const hide = (obj: THREE.Object3D) => {
    if (hiddenObjects.current.has(obj)) return;
    hiddenObjects.current.set(obj, obj.layers.mask);
    obj.layers.set(HIDDEN_LAYER);
  };

  const makeAcidMaterial = (orig: THREE.Material): THREE.Material => {
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
      anyOrig.color instanceof THREE.Color ? acidifyColor(anyOrig.color) : new THREE.Color('#ff00aa');

    const origOpacity = typeof orig.opacity === 'number' ? orig.opacity : 1;
    const isWire = Boolean(anyOrig.wireframe);
    const isAuraShell = orig.transparent && origOpacity < 0.42;
    const opacity = isWire ? Math.max(origOpacity, 0.75) : isAuraShell ? Math.max(origOpacity * 0.6, 0.25) : 1.0;
    const side = orig.side ?? THREE.FrontSide;
    const cacheKey = `${baseColor.getHexString()}_${isWire ? 'w' : isAuraShell ? opacity.toFixed(2) : '1'}_${side}`;

    let cached = materialCache.current.get(cacheKey);
    if (!cached) {
      cached = new THREE.MeshStandardMaterial({
        color: baseColor,
        emissive: baseColor.clone().multiplyScalar(isWire ? 0.65 : 0.4),
        emissiveIntensity: isWire ? 0.9 : 0.65,
        roughness: 0.18,
        metalness: 0.35,
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
      if (obj.userData?.acidOwn) return;
      let p: THREE.Object3D | null = obj.parent;
      while (p) {
        if (p.userData?.acidOwn) return;
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
        mesh.material = mesh.material.map(makeAcidMaterial);
      } else {
        mesh.material = makeAcidMaterial(mesh.material);
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
      ACID_HORIZON_SRGB[0],
      ACID_HORIZON_SRGB[1],
      ACID_HORIZON_SRGB[2],
      THREE.SRGBColorSpace,
    );
    const fog = new THREE.Fog(fogColor, ACID_FOG.near, ACID_FOG.far);
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
      <ambientLight args={[0x2a083b, 0.9]} userData={{ acidOwn: true }} />
      <directionalLight
        args={[0xff00d4, 1.8]}
        position={[36, 50, 24]}
        userData={{ acidOwn: true }}
      />
      <directionalLight
        args={[0x00f0ff, 1.4]}
        position={[-30, 25, -22]}
        userData={{ acidOwn: true }}
      />
      <pointLight
        args={[0x39ff14, 2.2, 35]}
        position={[0, 8, 0]}
        userData={{ acidOwn: true }}
      />
    </>
  );
}
