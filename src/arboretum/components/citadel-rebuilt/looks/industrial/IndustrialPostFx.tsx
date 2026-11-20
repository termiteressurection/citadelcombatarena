import { useEffect, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * IndustrialPostFx — high-contrast harsh warehouse grading, crushed blacks,
 * sodium-vapor amber halation, and gritty metallic film grain.
 */

const TARGET_SCALE = 0.75;

const VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const FRAG = /* glsl */ `
  uniform sampler2D tScene;
  uniform vec2 uRes;
  varying vec2 vUv;

  vec3 tap(vec2 uv) { return texture2D(tScene, uv).rgb; }
  float luma(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }

  float fastHash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  void main() {
    vec2 px = 1.0 / uRes;
    vec3 c0 = tap(vUv);

    // Harsh metallic edge sharpening
    vec3 cL = tap(vUv - vec2(px.x, 0.0));
    vec3 cR = tap(vUv + vec2(px.x, 0.0));
    vec3 cU = tap(vUv + vec2(0.0, px.y));
    vec3 cD = tap(vUv - vec2(0.0, px.y));
    vec3 sharp = c0 * 1.4 - (cL + cR + cU + cD) * 0.1;

    // Bleach-bypass style desaturation with crushed blacks & sodium-amber highlights
    float lum = luma(sharp);
    vec3 desat = mix(vec3(lum), sharp, 0.68);
    vec3 contrast = smoothstep(0.04, 0.96, desat);

    // Sodium-vapor bloom on hot highlights
    float hot = max(lum - 0.55, 0.0);
    contrast += vec3(1.0, 0.48, 0.10) * hot * 0.65;

    // Coarse gritty warehouse film grain
    float grain = (fastHash(gl_FragCoord.xy) - 0.5) * 0.075;
    vec3 col = contrast + grain;

    // Heavy industrial corner vignette
    float dist = length(vUv - 0.5);
    float vig = smoothstep(0.36, 0.92, dist);
    col *= 1.0 - vig * 0.52;

    gl_FragColor = vec4(max(col, vec3(0.0)), 1.0);
    #include <colorspace_fragment>
  }
`;

export function IndustrialPostFx() {
  const gl = useThree((s) => s.gl);

  const target = useMemo(
    () =>
      new THREE.WebGLRenderTarget(4, 4, {
        type: THREE.UnsignedByteType,
        depthBuffer: true,
        stencilBuffer: false,
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
      }),
    [],
  );

  const quad = useMemo(() => {
    const material = new THREE.ShaderMaterial({
      uniforms: {
        tScene: { value: target.texture },
        uRes: { value: new THREE.Vector2(1, 1) },
      },
      vertexShader: VERT,
      fragmentShader: FRAG,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
    mesh.frustumCulled = false;
    const scene = new THREE.Scene();
    scene.add(mesh);
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    return { material, mesh, scene, camera };
  }, [target]);

  useEffect(
    () => () => {
      target.dispose();
      quad.material.dispose();
      quad.mesh.geometry.dispose();
    },
    [target, quad],
  );

  const sizeVec = useMemo(() => new THREE.Vector2(), []);

  useFrame(({ scene, camera }) => {
    gl.getDrawingBufferSize(sizeVec);
    const w = Math.max(2, Math.floor(sizeVec.x * TARGET_SCALE));
    const h = Math.max(2, Math.floor(sizeVec.y * TARGET_SCALE));
    if (target.width !== w || target.height !== h) target.setSize(w, h);
    quad.material.uniforms.uRes.value.set(w, h);

    const prevTarget = gl.getRenderTarget();
    gl.setRenderTarget(target);
    gl.render(scene, camera);
    gl.setRenderTarget(prevTarget);
    gl.render(quad.scene, quad.camera);
  }, 1);

  return null;
}
