import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getActiveCurvatureRadius, livePlayerWorldPos, sphereDrop, WORLD_CURVATURE_RADIUS } from '../../RebuiltWorldShared';

/** Warm newsprint-yellow horizon for the Pulp Comic aesthetic. */
export const COMIC_HORIZON_SRGB = [1.0, 0.91, 0.28] as const;
export const COMIC_FOG = { near: 46, far: 195 } as const;

const horizonLinear = () =>
  new THREE.Color().setRGB(
    COMIC_HORIZON_SRGB[0],
    COMIC_HORIZON_SRGB[1],
    COMIC_HORIZON_SRGB[2],
    THREE.SRGBColorSpace,
  );

/* ──────────────────────  COMIC SKY DOME  ────────────────────── */

const SKY_VERT = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const SKY_FRAG = /* glsl */ `
  uniform float uTime;
  varying vec3 vDir;

  vec3 toLinear(vec3 srgb) {
    return pow(max(srgb, vec3(0.0)), vec3(2.2));
  }

  void main() {
    vec3 d = normalize(vDir);
    float h = clamp(d.y, -0.2, 1.0);

    // Classic four-color print sky bands: canary yellow horizon -> magenta-orange -> halftone cyan zenith
    vec3 colHorizon = vec3(1.0, 0.91, 0.24);
    vec3 colMid     = vec3(1.0, 0.28, 0.42);
    vec3 colTop     = vec3(0.06, 0.68, 0.96);

    // Quantized cel bands with crisp ink divider lines
    vec3 col = colHorizon;
    if (h > 0.36) {
      col = colTop;
    } else if (h > 0.12) {
      col = colMid;
    }

    // Ben-Day dot transitions between sky bands
    vec2 screenGrid = d.xz / (abs(d.y) + 0.35) * 42.0;
    float dotPattern = length(fract(screenGrid) - 0.5);
    float band1Mix = clamp((h - 0.06) / 0.14, 0.0, 1.0);
    if (h >= 0.06 && h <= 0.20) {
      col = dotPattern < (1.0 - band1Mix) * 0.52 ? colHorizon : colMid;
    }
    float band2Mix = clamp((h - 0.30) / 0.14, 0.0, 1.0);
    if (h >= 0.30 && h <= 0.44) {
      col = dotPattern < (1.0 - band2Mix) * 0.52 ? colMid : colTop;
    }

    // Graphic Pop-Art Sun with radiating comic action bursts (Kirby rays)
    vec3 sunDir = normalize(vec3(0.32, 0.24, -0.91));
    float sunAngle = acos(clamp(dot(d, sunDir), -1.0, 1.0));
    float atanRay = atan(d.y - sunDir.y, d.x - sunDir.x);
    float rayWave = step(0.15, sin(atanRay * 18.0 + floor(uTime * 3.0) * 0.4));

    // Action rays radiating out from the sun
    if (sunAngle < 0.58 && sunAngle > 0.135 && h > 0.0 && rayWave > 0.5) {
      col = mix(col, vec3(1.0, 0.95, 0.32), 0.55);
    }

    // Thick black India-ink ring around the sun disk
    if (sunAngle < 0.135 && sunAngle >= 0.118) {
      col = vec3(0.05, 0.03, 0.08);
    } else if (sunAngle < 0.118) {
      col = vec3(1.0, 0.96, 0.40);
    }

    gl_FragColor = vec4(toLinear(col), 1.0);
  }
`;

function ComicSkyDome() {
  const ref = useRef<THREE.Mesh>(null);
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 } },
        vertexShader: SKY_VERT,
        fragmentShader: SKY_FRAG,
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
      }),
    [],
  );
  useEffect(() => () => material.dispose(), [material]);

  useFrame(({ camera, clock }) => {
    material.uniforms.uTime.value = clock.elapsedTime;
    ref.current?.position.copy(camera.position);
  });

  return (
    <mesh ref={ref} renderOrder={-1000} frustumCulled={false} userData={{ comicOwn: true }}>
      <sphereGeometry args={[420, 24, 16]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
}

/* ──────────────────────  COMIC GROUND  ─────────────────────── */

const GROUND_VERT = /* glsl */ `
  uniform vec3 uCam;
  uniform vec3 uCenter;
  uniform float uCurvatureRadius;
  varying vec2 vWorld;
  varying float vPathDist;

  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vWorld = w.xz;
    float pathCenterX = sin(vWorld.y * 0.08) * 2.8;
    vPathDist = abs(vWorld.x - pathCenterX);

    float r = uCurvatureRadius > 0.0 ? uCurvatureRadius : ${WORLD_CURVATURE_RADIUS.toFixed(1)};
    float radial = length(vWorld - uCenter.xz);
    float sagitta = (r <= 0.0 || r >= 50000.0) ? 0.0 : (radial * radial) / (2.0 * r);

    w.y -= sagitta;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;

const GROUND_FRAG = /* glsl */ `
  uniform vec3 uFogColor;
  uniform float uFogNear;
  uniform float uFogFar;
  uniform vec3 uCam;
  varying vec2 vWorld;
  varying float vPathDist;

  vec3 toLinear(vec3 srgb) {
    return pow(max(srgb, vec3(0.0)), vec3(2.2));
  }

  void main() {
    // Comic panel grid lines inked onto the ground
    vec2 panelCell = fract(vWorld * 0.22);
    float inkGrid = step(panelCell.x, 0.035) + step(panelCell.y, 0.035);

    // Ben-Day halftone dots across the turf
    vec2 dotUv = fract(vWorld * 1.35) - 0.5;
    float dotMask = step(length(dotUv), 0.24);

    vec3 turfBase = vec3(0.14, 0.80, 0.56);
    vec3 turfDots = vec3(0.06, 0.62, 0.44);
    vec3 turf = mix(turfBase, turfDots, dotMask * 0.65);

    // Bold action road leading into the Citadel plaza
    float plazaDist = length(vWorld);
    bool onPlaza = plazaDist < 4.4;
    bool onRoad  = vPathDist < 2.6;
    bool onInkBorder = (!onPlaza && abs(plazaDist - 4.4) < 0.22) || (!onPlaza && abs(vPathDist - 2.6) < 0.22);

    // Alternating yellow/cream comic panel tiles along the road
    float roadTile = step(0.5, fract(vWorld.y * 0.18));
    vec3 roadCol = mix(vec3(0.99, 0.93, 0.76), vec3(1.0, 0.84, 0.24), roadTile * 0.45);
    // Dashed center action stripe
    if (vPathDist < 0.20 && fract(vWorld.y * 0.35) > 0.4) {
      roadCol = vec3(1.0, 0.20, 0.36);
    }

    vec3 col = (onPlaza || onRoad) ? roadCol : turf;
    col = mix(col, vec3(0.05, 0.03, 0.08), clamp(inkGrid * 0.45, 0.0, 1.0));
    if (onInkBorder) {
      col = vec3(0.04, 0.02, 0.07);
    }

    vec3 lin = toLinear(col);
    float dist = length(vec3(vWorld.x - uCam.x, 0.0, vWorld.y - uCam.z));
    lin = mix(lin, uFogColor, smoothstep(uFogNear, uFogFar, dist));
    gl_FragColor = vec4(lin, 1.0);
  }
`;

function ComicGround() {
  const ref = useRef<THREE.Mesh>(null);
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uFogColor: { value: horizonLinear() },
          uFogNear: { value: COMIC_FOG.near },
          uFogFar: { value: COMIC_FOG.far },
          uCam: { value: new THREE.Vector3() },
          uCenter: { value: new THREE.Vector3() },
          uCurvatureRadius: { value: getActiveCurvatureRadius() },
        },
        vertexShader: GROUND_VERT,
        fragmentShader: GROUND_FRAG,
      }),
    [],
  );
  useEffect(() => () => material.dispose(), [material]);

  useFrame(({ camera }) => {
    material.uniforms.uCam.value.copy(camera.position);
    material.uniforms.uCenter.value.copy(livePlayerWorldPos);
    material.uniforms.uCurvatureRadius.value = getActiveCurvatureRadius();
    ref.current?.position.set(livePlayerWorldPos.x, -0.02, livePlayerWorldPos.z);
  });

  return (
    <mesh
      ref={ref}
      rotation={[-Math.PI / 2, 0, 0]}
      renderOrder={-900}
      frustumCulled={false}
      userData={{ comicOwn: true }}
    >
      <planeGeometry args={[520, 520, 128, 128]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
}

/* ──────────────  COMIC SKYLINE, TREES & ACTION PROPS  ────────────── */

function ComicScenery() {
  const burstRef = useRef<THREE.Group>(null);
  const kirbyRef = useRef<THREE.Group>(null);
  const bldgGroupRef = useRef<THREE.Group>(null);
  const treeGroupRef = useRef<THREE.Group>(null);

  // Graphic comic-book city towers & monolith silhouettes on the horizon
  const buildings = useMemo(
    () => [
      { pos: [-16, 4.5, -18] as [number, number, number], size: [4.2, 9.0, 4.2] as [number, number, number], color: '#00c8ff' },
      { pos: [-11.5, 6.2, -21] as [number, number, number], size: [3.6, 12.4, 3.6] as [number, number, number], color: '#ff2a55' },
      { pos: [12.5, 5.5, -19] as [number, number, number], size: [4.0, 11.0, 4.0] as [number, number, number], color: '#ffe600' },
      { pos: [17.2, 4.0, -15.5] as [number, number, number], size: [3.5, 8.0, 3.5] as [number, number, number], color: '#9b4dff' },
    ],
    [],
  );

  // Stylized graphic pop-art trees with black ink outline shells
  const popTrees = useMemo(
    () => [
      { pos: [-6.5, 0, 8.5] as [number, number, number], color: '#00e575', scale: 1.15 },
      { pos: [6.8, 0, 7.8] as [number, number, number], color: '#ff3366', scale: 1.05 },
      { pos: [-8.2, 0, -4.5] as [number, number, number], color: '#ffe600', scale: 1.25 },
      { pos: [8.4, 0, -5.2] as [number, number, number], color: '#00d4ff', scale: 1.2 },
    ],
    [],
  );

  // Jack Kirby "Krackle" energy spheres floating near the plaza
  const kirbyDots = useMemo(
    () => [
      { pos: [-4.2, 2.8, 4.5] as [number, number, number], r: 0.34, color: '#ff2a55' },
      { pos: [-4.7, 3.5, 4.2] as [number, number, number], r: 0.22, color: '#ffe600' },
      { pos: [-3.8, 3.9, 4.7] as [number, number, number], r: 0.16, color: '#00e5ff' },
      { pos: [4.4, 3.1, 3.8] as [number, number, number], r: 0.32, color: '#ffe600' },
      { pos: [4.9, 3.7, 3.5] as [number, number, number], r: 0.20, color: '#ff2a55' },
    ],
    [],
  );

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const px = livePlayerWorldPos.x;
    const pz = livePlayerWorldPos.z;
    // Stepped 12-FPS Spider-Verse style animation tick!
    const steppedT = Math.floor(t * 12) / 12;
    if (bldgGroupRef.current) {
      bldgGroupRef.current.children.forEach((child, idx) => {
        const b = buildings[idx];
        if (!b) return;
        child.position.y = b.pos[1] - sphereDrop(b.pos[0] - px, b.pos[2] - pz);
      });
    }
    if (treeGroupRef.current) {
      treeGroupRef.current.children.forEach((child, idx) => {
        const tr = popTrees[idx];
        if (!tr) return;
        child.position.y = -sphereDrop(tr.pos[0] - px, tr.pos[2] - pz);
      });
    }
    if (burstRef.current) {
      const burstDrop = sphereDrop(-3.6 - px, 8.2 - pz);
      burstRef.current.position.y = 3.8 + Math.sin(steppedT * 3.0) * 0.22 - burstDrop;
      burstRef.current.rotation.z = Math.sin(steppedT * 2.0) * 0.08;
    }
    if (kirbyRef.current) {
      kirbyRef.current.children.forEach((child, idx) => {
        const kd = kirbyDots[idx];
        if (!kd) return;
        const drop = sphereDrop(kd.pos[0] - px, kd.pos[2] - pz);
        child.position.y = kd.pos[1] + Math.sin(steppedT * 3.5 + idx * 1.3) * 0.18 - drop;
      });
    }
  });

  return (
    <group userData={{ comicOwn: true }}>
      {/* Horizon Comic Metropolis Towers with Ink Outlines */}
      <group ref={bldgGroupRef} userData={{ comicOwn: true }}>
      {buildings.map((b, i) => (
        <group key={`comic-bldg-${i}`} position={b.pos} userData={{ comicOwn: true }}>
          <mesh userData={{ comicOwn: true }}>
            <boxGeometry args={b.size} />
            <meshLambertMaterial color={b.color} emissive={b.color} emissiveIntensity={0.25} />
          </mesh>
          {/* Inverted-hull black ink outline */}
          <mesh scale={[1.04, 1.02, 1.04]} userData={{ comicOwn: true }}>
            <boxGeometry args={b.size} />
            <meshBasicMaterial color="#0b0714" side={THREE.BackSide} />
          </mesh>
        </group>
      ))}
      </group>

      {/* Pop-Art Graphic Trees with Bold Black Ink Shells */}
      <group ref={treeGroupRef} userData={{ comicOwn: true }}>
      {popTrees.map((t, i) => (
        <group key={`comic-tree-${i}`} position={t.pos} scale={t.scale} userData={{ comicOwn: true }}>
          {/* Trunk */}
          <mesh position={[0, 1.0, 0]} userData={{ comicOwn: true }}>
            <cylinderGeometry args={[0.22, 0.32, 2.0, 6]} />
            <meshBasicMaterial color="#140c1c" />
          </mesh>
          {/* Cel-shaded geometric crown */}
          <mesh position={[0, 2.6, 0]} userData={{ comicOwn: true }}>
            <dodecahedronGeometry args={[1.35, 0]} />
            <meshLambertMaterial color={t.color} emissive={t.color} emissiveIntensity={0.28} />
          </mesh>
          {/* Black ink outline shell around crown */}
          <mesh position={[0, 2.6, 0]} scale={1.08} userData={{ comicOwn: true }}>
            <dodecahedronGeometry args={[1.35, 0]} />
            <meshBasicMaterial color="#0b0714" side={THREE.BackSide} />
          </mesh>
        </group>
      ))}
      </group>

      {/* Floating Comic Action Starburst Sign ("POW! / ∑") */}
      <group ref={burstRef} position={[-3.6, 3.8, 8.2]} rotation={[0, 0.38, 0]} userData={{ comicOwn: true }}>
        {/* Black ink backing star */}
        <mesh position={[0, 0, -0.06]} scale={1.14} userData={{ comicOwn: true }}>
          <cylinderGeometry args={[1.15, 1.15, 0.08, 7]} />
          <meshBasicMaterial color="#0b0714" />
        </mesh>
        {/* Bright yellow action burst */}
        <mesh rotation={[Math.PI / 2, 0, 0]} userData={{ comicOwn: true }}>
          <cylinderGeometry args={[1.0, 1.0, 0.12, 7]} />
          <meshBasicMaterial color="#ffe600" />
        </mesh>
        {/* Inner magenta diamond */}
        <mesh position={[0, 0, 0.04]} rotation={[Math.PI / 2, Math.PI / 4, 0]} userData={{ comicOwn: true }}>
          <cylinderGeometry args={[0.62, 0.62, 0.14, 4]} />
          <meshBasicMaterial color="#ff2a55" />
        </mesh>
      </group>

      {/* Jack Kirby Krackle Energy Dots */}
      <group ref={kirbyRef} userData={{ comicOwn: true }}>
        {kirbyDots.map((d, i) => (
          <group key={`kirby-${i}`} position={d.pos} userData={{ comicOwn: true }}>
            <mesh userData={{ comicOwn: true }}>
              <icosahedronGeometry args={[d.r, 1]} />
              <meshBasicMaterial color={d.color} />
            </mesh>
            <mesh scale={1.22} userData={{ comicOwn: true }}>
              <icosahedronGeometry args={[d.r, 1]} />
              <meshBasicMaterial color="#08040f" side={THREE.BackSide} />
            </mesh>
          </group>
        ))}
      </group>
    </group>
  );
}

export function ComicEnvironment() {
  return (
    <>
      <ComicSkyDome />
      <ComicGround />
      <ComicScenery />
    </>
  );
}
