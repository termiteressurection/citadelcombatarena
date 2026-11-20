import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { PAPERCRAFT_FOG, PAPERCRAFT_HORIZON_SRGB } from './PapercraftEnvironment';

/**
 * PapercraftSkin — re-skins Citadel structures into faceted, folded origami
 * cardstock & construction paper with crisp flat-shaded creases.
 */

const HIDDEN_LAYER = 29;
const SCAN_INTERVAL_S = 2.0;

const hsl = { h: 0, s: 0, l: 0 };

function paperifyColor(src: THREE.Color): THREE.Color {
  const out = src.clone();
  out.getHSL(hsl, THREE.SRGBColorSpace);

  // Dark occlusion cores become warm ivory origami cardstock
  if (hsl.l < 0.18) {
    out.setRGB(0.96, 0.92, 0.84, THREE.SRGBColorSpace);
    return out;
  }

  // Green / teal -> muted eucalyptus sage paper
  if (hsl.h >= 0.22 && hsl.h <= 0.48) {
    out.setRGB(0.51, 0.70, 0.60, THREE.SRGBColorSpace);
    return out;
  }

  // Cyan / blue -> dusty slate-indigo paper
  if (hsl.h > 0.48 && hsl.h < 0.68) {
    out.setRGB(0.35, 0.45, 0.62, THREE.SRGBColorSpace);
    return out;
  }

  // Purple / magenta -> terracotta coral cardstock
  if (hsl.h >= 0.68 && hsl.h <= 0.94) {
    out.setRGB(0.88, 0.48, 0.37, THREE.SRGBColorSpace);
    return out;
  }

  // Gold / amber -> warm mustard ochre paper
  out.setRGB(0.95, 0.80, 0.56, THREE.SRGBColorSpace);
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

export function PapercraftSkin() {
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

  const makePaperMaterial = (orig: THREE.Material): THREE.Material => {
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
      anyOrig.color instanceof THREE.Color ? paperifyColor(anyOrig.color) : new THREE.Color('#f4ead5');

    const origOpacity = typeof orig.opacity === 'number' ? orig.opacity : 1;
    const isWire = Boolean((anyOrig as { wireframe?: boolean }).wireframe);
    const isAuraShell = orig.transparent && origOpacity < 0.42;
    const opacity = isWire ? Math.max(origOpacity, 0.55) : isAuraShell ? Math.max(origOpacity * 0.5, 0.22) : 1.0;
    const side = orig.side ?? THREE.FrontSide;
    const cacheKey = `${baseColor.getHexString()}_${isWire ? 'w' : isAuraShell ? opacity.toFixed(2) : '1'}_${side}`;

    let cached = materialCache.current.get(cacheKey);
    if (!cached) {
      cached = new THREE.MeshStandardMaterial({
        color: baseColor,
        emissive: baseColor.clone().multiplyScalar(0.18),
        emissiveIntensity: 0.35,
        roughness: 0.92,
        metalness: 0.0,
        flatShading: true,
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
      if (obj.userData?.papercraftOwn) return;
      let p: THREE.Object3D | null = obj.parent;
      while (p) {
        if (p.userData?.papercraftOwn) return;
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
        ? mesh.material.map(makePaperMaterial)
        : makePaperMaterial(mesh.material);
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
      PAPERCRAFT_HORIZON_SRGB[0],
      PAPERCRAFT_HORIZON_SRGB[1],
      PAPERCRAFT_HORIZON_SRGB[2],
      THREE.SRGBColorSpace,
    );
    const fog = new THREE.Fog(fogColor, PAPERCRAFT_FOG.near, PAPERCRAFT_FOG.far);
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
      <ambientLight args={[0xfff5e4, 0.78]} userData={{ papercraftOwn: true }} />
      <directionalLight
        args={[0xffe4b8, 1.45]}
        position={[32, 48, 24]}
        userData={{ papercraftOwn: true }}
      />
      <directionalLight
        args={[0xe07a5f, 0.55]}
        position={[-28, 20, -20]}
        userData={{ papercraftOwn: true }}
      />
    </>
  );
}
