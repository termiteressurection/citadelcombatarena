import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { INDUSTRIAL_FOG, INDUSTRIAL_HORIZON_SRGB } from './IndustrialEnvironment';

/**
 * IndustrialSkin — re-skins the Citadel into heavy gunmetal steel, oxidized
 * rust iron, and glowing furnace-amber hazard lights.
 */

const HIDDEN_LAYER = 29;
const SCAN_INTERVAL_S = 2.0;

const hsl = { h: 0, s: 0, l: 0 };

function industrializeColor(src: THREE.Color): THREE.Color {
  const out = src.clone();
  out.getHSL(hsl, THREE.SRGBColorSpace);

  // Dark inner occlusion cores -> dark gunmetal cast iron
  if (hsl.l < 0.18) {
    out.setRGB(0.14, 0.15, 0.18, THREE.SRGBColorSpace);
    return out;
  }

  // Green / teal -> oxidized industrial patina / weathered bronze
  if (hsl.h >= 0.22 && hsl.h <= 0.48) {
    out.setRGB(0.28, 0.36, 0.34, THREE.SRGBColorSpace);
    return out;
  }

  // Cyan / blue -> cold rolled brushed steel
  if (hsl.h > 0.48 && hsl.h < 0.68) {
    out.setRGB(0.42, 0.48, 0.54, THREE.SRGBColorSpace);
    return out;
  }

  // Purple / magenta -> oxidized rust & corten iron
  if (hsl.h >= 0.68 && hsl.h <= 0.94) {
    out.setRGB(0.58, 0.24, 0.14, THREE.SRGBColorSpace);
    return out;
  }

  // Gold / amber -> molten sodium hazard orange
  out.setRGB(1.0, 0.52, 0.08, THREE.SRGBColorSpace);
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
    if ('uSphereRadius' in u || 'u_lineColor' in u) return true;
  }
  return false;
}

export function IndustrialSkin() {
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

  const makeIndustrialMaterial = (orig: THREE.Material): THREE.Material => {
    const anyOrig = orig as unknown as {
      color?: THREE.Color;
      opacity?: number;
      transparent?: boolean;
      side?: THREE.Side;
    };
    if (orig instanceof THREE.ShaderMaterial || orig instanceof THREE.PointsMaterial) {
      return orig;
    }

    const baseColor =
      anyOrig.color instanceof THREE.Color ? industrializeColor(anyOrig.color) : new THREE.Color('#4a5058');

    const origOpacity = typeof orig.opacity === 'number' ? orig.opacity : 1;
    const isWire = Boolean((anyOrig as { wireframe?: boolean }).wireframe);
    const isAuraShell = orig.transparent && origOpacity < 0.42;
    const opacity = isWire ? Math.max(origOpacity, 0.65) : isAuraShell ? Math.max(origOpacity * 0.5, 0.2) : 1.0;
    const side = orig.side ?? THREE.FrontSide;
    const cacheKey = `${baseColor.getHexString()}_${isWire ? 'w' : isAuraShell ? opacity.toFixed(2) : '1'}_${side}`;

    let cached = materialCache.current.get(cacheKey);
    if (!cached) {
      cached = new THREE.MeshStandardMaterial({
        color: baseColor,
        emissive: baseColor.clone().multiplyScalar(isWire ? 0.4 : 0.22),
        emissiveIntensity: isWire ? 0.65 : 0.45,
        roughness: 0.38,
        metalness: 0.78,
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
      if (obj.userData?.industrialOwn) return;
      let p: THREE.Object3D | null = obj.parent;
      while (p) {
        if (p.userData?.industrialOwn) return;
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
      mesh.material = Array.isArray(mesh.material)
        ? mesh.material.map(makeIndustrialMaterial)
        : makeIndustrialMaterial(mesh.material);
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
      INDUSTRIAL_HORIZON_SRGB[0],
      INDUSTRIAL_HORIZON_SRGB[1],
      INDUSTRIAL_HORIZON_SRGB[2],
      THREE.SRGBColorSpace,
    );
    const fog = new THREE.Fog(fogColor, INDUSTRIAL_FOG.near, INDUSTRIAL_FOG.far);
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
      <ambientLight args={[0x262930, 0.72]} userData={{ industrialOwn: true }} />
      <directionalLight
        args={[0xff8822, 1.85]}
        position={[32, 48, 22]}
        userData={{ industrialOwn: true }}
      />
      <directionalLight
        args={[0x5a7088, 0.95]}
        position={[-30, 24, -20]}
        userData={{ industrialOwn: true }}
      />
    </>
  );
}
