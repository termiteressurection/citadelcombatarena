import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { MINIMAL_FOG, MINIMAL_VOID_HEX } from './MinimalEnvironment';

/**
 * MinimalSkin — transforms the entire Citadel into pure sculptural MONOLITHIC LIGHT.
 *
 * Every geometric form (Altar, floating crystal focus, dais, and functional service
 * pavilions) is rendered as a solid, luminous white monolithic sculpture against
 * the pitch-black void.
 *
 *   • NO wireframes: all wireframe cage shells are converted into solid volumes.
 *   • NO line segments: all Line, LineSegments, LineLoop, and fat Line2 meshes are hidden.
 *   • NO black cores: dark occlusion cores become radiant alabaster monolithic light.
 *   • Directional & ambient light carve crisp geometric facets so every 3D plane,
 *     eave, and bevel is clearly defined as solid sculptural architecture.
 *   • All original materials and visibility layers are cleanly restored on look exit.
 */

const HIDDEN_LAYER = 29;
const SCAN_INTERVAL_S = 1.5;

function isLineLike(obj: THREE.Object3D): boolean {
  const o = obj as unknown as Record<string, unknown>;
  return o.isLine === true || o.isLineSegments === true || o.isLineLoop === true;
}

function isSkyOrFloorShader(mat: THREE.Material): boolean {
  if (mat instanceof THREE.ShaderMaterial) {
    if (mat.side === THREE.BackSide) return true;
    const u = mat.uniforms ?? {};
    if ('uSphereRadius' in u || 'u_lineColor' in u) return true;
  }
  return false;
}

function isLineMaterial(mat: THREE.Material): boolean {
  const m = mat as unknown as Record<string, unknown>;
  return (
    m.isLineMaterial === true ||
    m.isLineBasicMaterial === true ||
    m.isLineDashedMaterial === true
  );
}

export function MinimalSkin() {
  const scene = useThree((s) => s.scene);
  const saved = useRef(new Map<THREE.Object3D, THREE.Material | THREE.Material[]>());
  const cache = useRef(new Map<string, THREE.Material>());
  const hidden = useRef(new Map<THREE.Object3D, number>());
  const lastChildCount = useRef(-1);
  const clock = useRef(0);
  const fogRef = useRef<THREE.Fog | null>(null);

  const hide = (obj: THREE.Object3D) => {
    if (hidden.current.has(obj)) return;
    hidden.current.set(obj, obj.layers.mask);
    obj.layers.set(HIDDEN_LAYER);
  };

  const getMonolithMaterial = (orig: THREE.Material): THREE.Material => {
    // Preserve custom shaders that are our own
    if (orig instanceof THREE.ShaderMaterial && (orig as any).userData?.minimalOwn) return orig;

    const o = orig as unknown as {
      opacity?: number;
      transparent?: boolean;
      side?: THREE.Side;
    };

    const side = o.side ?? THREE.FrontSide;
    const isAccent = (orig.transparent === true && (orig.opacity ?? 1) < 0.85);

    if (isAccent) {
      const key = `accent_${side}`;
      let m = cache.current.get(key);
      if (!m) {
        m = new THREE.MeshBasicMaterial({
          color: 0xffffff,
          transparent: true,
          opacity: 0.88,
          depthWrite: false,
          wireframe: false,
          side,
        });
        cache.current.set(key, m);
      }
      return m;
    }

    const key = `solid_${side}`;
    let m = cache.current.get(key);
    if (!m) {
      m = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.18,
        metalness: 0.02,
        emissive: 0xffffff,
        emissiveIntensity: 0.38,
        wireframe: false,
        transparent: false,
        depthWrite: true,
        side,
      });
      cache.current.set(key, m);
    }
    return m;
  };

  const scan = () => {
    scene.traverse((obj) => {
      if (obj.userData?.minimalOwn) return;
      let p: THREE.Object3D | null = obj.parent;
      while (p) {
        if (p.userData?.minimalOwn) return;
        p = p.parent;
      }

      const mesh = obj as THREE.Mesh;
      const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
      if (!mat) return;
      if (saved.current.has(obj)) return;

      const list = Array.isArray(mat) ? mat : [mat];

      // Hide sky dome / horizon / lodge floor shaders
      if (list.some(isSkyOrFloorShader)) {
        hide(obj);
        return;
      }

      // Hide all line-like objects and fat-line meshes (no wireframe cages!)
      if (isLineLike(obj) || list.some(isLineMaterial)) {
        hide(obj);
        return;
      }

      if (!mesh.isMesh) return;

      // Convert solid and wireframe meshes into pure sculptural monolithic light
      saved.current.set(obj, mat);
      mesh.material = Array.isArray(mat)
        ? mat.map(getMonolithMaterial)
        : getMonolithMaterial(mat);
    });
  };

  const restore = () => {
    saved.current.forEach((orig, obj) => {
      (obj as THREE.Mesh).material = orig;
    });
    saved.current.clear();

    cache.current.forEach((m) => m.dispose());
    cache.current.clear();

    hidden.current.forEach((mask, obj) => {
      obj.layers.mask = mask;
    });
    hidden.current.clear();
    lastChildCount.current = -1;
  };

  useEffect(() => {
    const prevFog = scene.fog;
    const prevBg = scene.background;
    const fog = new THREE.Fog(MINIMAL_VOID_HEX, MINIMAL_FOG.near, MINIMAL_FOG.far);
    fogRef.current = fog;
    scene.fog = fog;
    scene.background = new THREE.Color(MINIMAL_VOID_HEX);
    scan();

    return () => {
      restore();
      if (scene.fog === fog) scene.fog = prevFog;
      scene.background = prevBg;
      fogRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene]);

  useFrame((_, delta) => {
    clock.current += delta;
    if (clock.current < SCAN_INTERVAL_S) return;
    clock.current = 0;
    const fog = fogRef.current;
    if (fog && scene.fog !== fog) scene.fog = fog;
    if (scene.children.length !== lastChildCount.current) {
      lastChildCount.current = scene.children.length;
      scan();
    }
  });

  return (
    <>
      {/* Pure ambient light ensuring monolithic shadows glow softly rather than plunging into pitch black */}
      <ambientLight args={[0xffffff, 0.58]} userData={{ minimalOwn: true }} />
      {/* Crisp elevated directional key light carving sharp 3D geometric facets */}
      <directionalLight
        position={[24, 38, 18]}
        intensity={0.78}
        color={0xffffff}
        userData={{ minimalOwn: true }}
      />
      {/* Soft opposing fill light to model subtle depth across side planes */}
      <directionalLight
        position={[-22, 16, -22]}
        intensity={0.28}
        color={0xf1f5f9}
        userData={{ minimalOwn: true }}
      />
    </>
  );
}
