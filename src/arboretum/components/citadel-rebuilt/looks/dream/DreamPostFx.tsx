import { useEffect, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * DreamPostFx — lightweight single-pass painterly post-FX.
 *
 * Performance architecture:
 *   • Renders the scene into a scaled offscreen target (0.65× drawing buffer, UnsignedByteType,
 *     no MSAA) so fragment fill-rate is ~2.4× cheaper than native Retina.
 *   • Uses a 5-tap rotated cross bilateral-style painter filter + 4-tap highlight bloom
 *     (9 texture taps total instead of 32+, zero per-pixel FBM loops).
 *   • Runs at useFrame priority 1, which tells react-three-fiber NOT to run its default
 *     scene render pass (eliminating the double scene render).
 */

const TARGET_SCALE = 0.68;

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

  // Fast single-ALU hash for subtle paper grain (replaces multi-octave FBM)
  float fastHash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  void main() {
    vec2 px = 1.0 / uRes;

    // 5-tap edge-preserving painterly brush kernel (fast Kuwahara approximation)
    vec3 c0 = tap(vUv);
    vec3 c1 = tap(vUv + vec2( 1.6,  0.9) * px);
    vec3 c2 = tap(vUv + vec2(-1.6,  0.9) * px);
    vec3 c3 = tap(vUv + vec2( 0.9, -1.6) * px);
    vec3 c4 = tap(vUv + vec2(-0.9, -1.6) * px);

    float l0 = luma(c0);
    float l1 = luma(c1);
    float l2 = luma(c2);
    float l3 = luma(c3);
    float l4 = luma(c4);

    // Pick the pair closest in luminance to center for flat gouache brush patches
    vec3 pairA = (c0 + c1 + c2) * 0.3333;
    vec3 pairB = (c0 + c3 + c4) * 0.3333;
    float varA = abs(l1 - l0) + abs(l2 - l0);
    float varB = abs(l3 - l0) + abs(l4 - l0);
    vec3 painted = varA < varB ? pairA : pairB;
    vec3 col = mix(painted, (c1 + c2 + c3 + c4) * 0.25, 0.28);

    // 4-tap wide pastel dream bloom
    vec3 b1 = tap(vUv + vec2( 6.5,  6.5) * px);
    vec3 b2 = tap(vUv + vec2(-6.5,  6.5) * px);
    vec3 b3 = tap(vUv + vec2( 6.5, -6.5) * px);
    vec3 b4 = tap(vUv + vec2(-6.5, -6.5) * px);
    vec3 glow = max(b1 - 0.58, 0.0)
              + max(b2 - 0.58, 0.0)
              + max(b3 - 0.58, 0.0)
              + max(b4 - 0.58, 0.0);
    col += glow * 0.32;

    // Gentle storybook ink-edge from existing taps (zero extra texture reads!)
    float edge = abs(l1 - l4) + abs(l2 - l3);
    col = mix(col, col * vec3(0.78, 0.64, 0.80), smoothstep(0.08, 0.38, edge) * 0.32);

    // Dream color grading: lifted violet shadows, warm cream highlights
    float lum = luma(col);
    col = mix(vec3(lum), col, 1.06);
    col += vec3(0.028, 0.016, 0.042) * (1.0 - lum);
    col *= mix(vec3(1.0), vec3(1.03, 1.0, 0.97), lum);

    // Lightweight paper grain
    float grain = fastHash(gl_FragCoord.xy) - 0.5;
    col *= 1.0 + grain * 0.035;

    // Rosy vignette
    vec2 vc = vUv - 0.5;
    float vig = smoothstep(0.35, 0.95, length(vc * vec2(1.0, 0.9)));
    col = mix(col, col * vec3(1.0, 0.82, 0.92), vig * 0.50);
    col *= 1.0 - vig * 0.10;

    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`;

export function DreamPostFx() {
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
