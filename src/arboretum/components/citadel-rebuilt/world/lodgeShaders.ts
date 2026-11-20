/**
 * Lodge floor GLSL — extracted from RebuiltWorld so the world file stays
 * easier to navigate; uniforms stay owned by LodgeFloor’s ShaderMaterial.
 */
import { WORLD_CURVATURE_RADIUS } from '../RebuiltWorldShared';

export const lodgeVertexShader = `
  varying vec2 vWorldXZ;
  varying vec2 vLocalXZ;
  uniform float uSphereRadius;
  void main() {
    vec3 localPos = position;
    vLocalXZ = localPos.xz;
    float r = uSphereRadius > 0.0 ? uSphereRadius : ${WORLD_CURVATURE_RADIUS.toFixed(1)};
    if (r > 0.0 && r < 50000.0) {
      float radial = length(localPos.xz);
      float sagitta = (radial * radial) / (2.0 * r);
      localPos.y -= sagitta;
    }
    vec4 worldPos = modelMatrix * vec4(localPos, 1.0);
    vWorldXZ = worldPos.xz;
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

export const lodgeFragmentShader = `
  varying vec2 vWorldXZ;
  varying vec2 vLocalXZ;
  uniform float uTime;
  uniform float uSphereRadius;

  vec3 hsv2rgb(vec3 c) {
    vec4 K = vec4(1.0, 2.0/3.0, 1.0/3.0, 3.0);
    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
  }

  void main() {
    float tileSize = 4.0;
    vec2 worldGrid = vWorldXZ / tileSize;
    vec2 grid = abs(fract(worldGrid - 0.5) - 0.5);
    vec2 lineWidth = max(fwidth(worldGrid) * 1.6, vec2(0.008));
    vec2 lineStrength = smoothstep(lineWidth, vec2(0.0), grid);
    float lineMask = max(lineStrength.x, lineStrength.y);

    vec2 cell = floor(worldGrid);
    float checker = mod(cell.x + cell.y, 2.0);

    float dist = length(vLocalXZ);
    float r = uSphereRadius > 0.0 ? uSphereRadius : 120.0;
    float fadeStart = max(r * 0.9, 110.0);
    float fadeEnd = max(r * 1.7, 210.0);
    float fade = 1.0 - smoothstep(fadeStart, fadeEnd, dist);
    fade = pow(fade, 1.6);

    // Subtle hall region highlight
    float hallX = smoothstep(22.0, 20.0, abs(vWorldXZ.x));
    float hallZ = smoothstep(28.0, 26.0, abs(vWorldXZ.y));
    float hallMask = hallX * hallZ;

    // Psychedelic rainbow hue based on position + time
    float hue = fract(length(vWorldXZ) * 0.012 + atan(vWorldXZ.y, vWorldXZ.x) * 0.16 + uTime * 0.06);
    float hue2 = fract(hue + 0.33 + sin(vWorldXZ.x * 0.05 + uTime * 0.3) * 0.08);
    vec3 rainbow1 = hsv2rgb(vec3(hue, 0.7, 1.0));
    vec3 rainbow2 = hsv2rgb(vec3(hue2, 0.6, 0.85));
    // Solid digital void base (deep obsidian, NOT translucent)
    vec3 darkBase = vec3(0.018, 0.008, 0.035);
    vec3 hallTint = vec3(0.05, 0.02, 0.10);
    vec3 lineColor = mix(rainbow1, rainbow2, checker * 0.5);

    // Opaque checkerboard: obsidian dark tiles accented with subtle neon reflections
    vec3 checkerDark = darkBase;
    vec3 checkerLight = mix(darkBase, lineColor, 0.20);
    vec3 color = mix(checkerDark, checkerLight, checker);
    color = mix(color, hallTint, hallMask * 0.5);
    color = mix(color, lineColor, lineMask * 0.88);

    // Sacred ring — pulses through colors on top of the solid obsidian
    float ringDist = abs(dist - 72.0);
    float ringAlpha = smoothstep(3.0, 0.5, ringDist) * 0.25;
    vec3 ringColor = hsv2rgb(vec3(fract(uTime * 0.1), 0.8, 1.0));
    color = mix(color, ringColor, ringAlpha);

    // Completely solid underfoot (alpha = 1.0), fading smoothly only at the far horizon curve
    float alpha = fade;
    if (alpha < 0.005) discard;
    gl_FragColor = vec4(color, alpha);
  }
`;
