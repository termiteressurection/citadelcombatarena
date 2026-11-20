import { useEffect, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * WesternPostFx — authentic 1880s wet-plate daguerreotype sepia filter,
 * heavy burnt-amber lens vignette, subtle silver-gelatin grain, and vertical
 * celluloid scratch lines.
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
  uniform float uTime;
  varying vec2 vUv;

  float luma(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }

  float fastHash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  void main() {
    vec3 c0 = texture2D(tScene, vUv).rgb;
    float lum = luma(c0);

    // Rich silver-gelatin duotone sepia curve (deep espresso shadows -> warm amber -> aged parchment)
    vec3 shadowCol = vec3(0.14, 0.08, 0.04);
    vec3 midCol    = vec3(0.68, 0.48, 0.28);
    vec3 highCol   = vec3(0.98, 0.90, 0.74);

    vec3 sepia = lum < 0.5
      ? mix(shadowCol, midCol, lum * 2.0)
      : mix(midCol, highCol, (lum - 0.5) * 2.0);

    // Retain a whisper of original warm color
    vec3 col = mix(sepia, c0 * vec3(1.12, 0.92, 0.68), 0.18);

    // Vintage wet-plate film grain & subtle exposure flicker
    float flicker = 0.985 + 0.015 * sin(uTime * 11.0);
    float grain = (fastHash(gl_FragCoord.xy + floor(uTime * 12.0)) - 0.5) * 0.06;
    col = col * flicker + grain;

    // Subtle vertical daguerreotype plate scratch line
    float scratchX = fract(sin(floor(uTime * 4.0) * 43.7) * 197.3);
    float onScratch = smoothstep(0.0018, 0.0, abs(vUv.x - scratchX));
    col += vec3(0.28, 0.22, 0.14) * onScratch * 0.45;

    // Classic Old Western burnt-edge oval lens vignette
    vec2 vc = (vUv - 0.5) * vec2(1.15, 1.0);
    float dist = length(vc);
    float vig = smoothstep(0.32, 0.86, dist);
    col = mix(col, vec3(0.06, 0.03, 0.01), vig * 0.85);

    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`;

export function WesternPostFx() {
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
        uTime: { value: 0 },
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

  useFrame(({ scene, camera, clock }) => {
    gl.getDrawingBufferSize(sizeVec);
    const w = Math.max(2, Math.floor(sizeVec.x * TARGET_SCALE));
    const h = Math.max(2, Math.floor(sizeVec.y * TARGET_SCALE));
    if (target.width !== w || target.height !== h) target.setSize(w, h);
    quad.material.uniforms.uRes.value.set(w, h);
    quad.material.uniforms.uTime.value = clock.elapsedTime;

    const prevTarget = gl.getRenderTarget();
    gl.setRenderTarget(target);
    gl.render(scene, camera);
    gl.setRenderTarget(prevTarget);
    gl.render(quad.scene, quad.camera);
  }, 1);

  return null;
}
