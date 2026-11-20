import { useEffect, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * ComicPostFx — high-performance graphic novel / pulp comic post-processing.
 *
 * Visual features:
 *   • Crisp black India-ink edge outlines via 4-tap cross Sobel-style luminance edge detection.
 *   • Authentic Ben-Day halftone screening in shadows and midtones.
 *   • Color quantization into 4-color pop-art print ink levels.
 *   • Newsprint paper grain and vintage print misalignment (chromatic press registration drift).
 *
 * Performance:
 *   • Single full-screen pass over an un-multisampled UnsignedByte target (0.75× scale).
 *   • Runs at priority 1 to suppress the default R3F scene render.
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

    // Subtle CMYK printing plate registration offset (chromatic ink slip)
    vec2 cyanOffset = vec2(-0.8, 0.4) * px;
    vec2 magOffset  = vec2(0.8, -0.4) * px;
    float r = tap(vUv + magOffset).r;
    float g = tap(vUv).g;
    float b = tap(vUv + cyanOffset).b;
    vec3 c0 = vec3(r, g, b);

    // 4-tap edge detection for black India-ink comic linework
    vec3 cL = tap(vUv - vec2(px.x * 1.5, 0.0));
    vec3 cR = tap(vUv + vec2(px.x * 1.5, 0.0));
    vec3 cU = tap(vUv + vec2(0.0, px.y * 1.5));
    vec3 cD = tap(vUv - vec2(0.0, px.y * 1.5));

    float lL = luma(cL);
    float lR = luma(cR);
    float lU = luma(cU);
    float lD = luma(cD);
    float edge = abs(lR - lL) + abs(lU - lD);

    // Ben-Day halftone dot screen in mid-tones & shadows
    // Rotate grid by 45 degrees like authentic offset printing
    vec2 screenPos = gl_FragCoord.xy;
    vec2 rotCoord = vec2(
      screenPos.x * 0.7071 - screenPos.y * 0.7071,
      screenPos.x * 0.7071 + screenPos.y * 0.7071
    );
    vec2 dotGrid = fract(rotCoord * 0.18) - 0.5;
    float dotDist = length(dotGrid);

    float lum = luma(c0);
    // Darker areas have larger Ben-Day dots
    float dotRadius = clamp((0.72 - lum) * 0.58, 0.0, 0.48);
    float isDot = step(dotDist, dotRadius);

    // Posterize colors into punchy comic print levels
    vec3 posterized = floor(c0 * 5.0 + 0.5) / 5.0;

    // Apply Ben-Day dots in the shadows
    vec3 col = mix(posterized, posterized * 0.45 + vec3(0.02, 0.01, 0.05), isDot * 0.75);

    // Stamp bold India-ink outlines where edge threshold is exceeded
    float inkOutline = smoothstep(0.12, 0.28, edge);
    col = mix(col, vec3(0.04, 0.02, 0.06), inkOutline * 0.95);

    // Pulp newsprint paper tone + grain
    float grain = fastHash(screenPos) - 0.5;
    col *= 1.0 + grain * 0.04;
    // Slight warm newsprint yellow tint to whites
    col = mix(col, col * vec3(1.02, 0.99, 0.93), 0.5);

    // Comic book panel border frame vignette
    vec2 borderDist = abs(vUv - 0.5) * 2.0;
    float frame = smoothstep(0.92, 0.98, max(borderDist.x, borderDist.y));
    col = mix(col, vec3(0.04, 0.02, 0.06), frame * 0.85);

    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`;

export function ComicPostFx() {
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
