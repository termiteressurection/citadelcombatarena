import { useEffect, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

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

  vec3 rainbow(float t) {
    return 0.5 + 0.5 * cos(6.28318 * (vec3(0.0, 0.33, 0.67) + t));
  }

  void main() {
    vec2 px = 1.0 / uRes;
    vec2 p = vUv - 0.5;
    float dist = length(p);

    // Subtle gentle visual breathing distortion (breathing sine ripple)
    float breath = sin(uTime * 1.4) * 0.5 + 0.5;
    vec2 ripple = vec2(
      sin(p.y * 12.0 + uTime * 1.8) * 0.0035 * breath,
      cos(p.x * 12.0 + uTime * 1.6) * 0.0035 * breath
    );
    vec2 uv = vUv + ripple;

    // Pulsating RGB chromatic aberration fringe radiating outward
    float chromaAmount = (0.004 + 0.003 * sin(uTime * 2.1)) * (dist * 1.8);
    vec2 chromaDir = normalize(p + 0.0001) * chromaAmount;

    float r = texture2D(tScene, uv + chromaDir).r;
    float g = texture2D(tScene, uv).g;
    float b = texture2D(tScene, uv - chromaDir).b;
    vec3 col = vec3(r, g, b);

    // Iridescent highlight glow: bright areas bloom into shifting rainbow colors
    float luma = dot(col, vec3(0.299, 0.587, 0.114));
    float high = max(luma - 0.55, 0.0);
    vec3 glow = rainbow(luma * 1.5 + uTime * 0.35) * high * 1.25;
    col += glow;

    // Acid trip color grading: hyper-saturated, lifted violet shadows & solarized sheen
    col = pow(max(col, vec3(0.0)), vec3(0.92));
    col = mix(col, rainbow(luma * 0.8 + uTime * 0.15), 0.16);

    // Vignette with breathing psychedelic halo
    float vig = smoothstep(0.42, 0.98, dist);
    vec3 vigCol = mix(vec3(0.12, 0.02, 0.25), rainbow(uTime * 0.2), 0.35);
    col = mix(col, vigCol, vig * 0.62);

    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`;

export function AcidPostFx() {
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
