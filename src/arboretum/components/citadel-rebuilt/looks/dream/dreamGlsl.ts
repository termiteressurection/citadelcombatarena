/**
 * Shared GLSL helpers for the Dream look. Colors in Dream shaders are authored
 * as perceptual (sRGB-ish) values and converted with `dreamToLinear` before output,
 * because the scene renders into a linear target that the post pass encodes once.
 */
export const DREAM_GLSL_NOISE = /* glsl */ `
  float dHash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }
  float dNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = dHash(i);
    float b = dHash(i + vec2(1.0, 0.0));
    float c = dHash(i + vec2(0.0, 1.0));
    float d = dHash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }
  float dFbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 4; i++) {
      v += a * dNoise(p);
      p = p * 2.03 + vec2(17.1, 9.2);
      a *= 0.5;
    }
    return v;
  }
  vec3 dreamToLinear(vec3 c) {
    return pow(max(c, vec3(0.0)), vec3(2.2));
  }
`;

/** Horizon haze color (sRGB). Sky, ground fade and scene fog all share it so the world melts into the sky. */
export const DREAM_HORIZON_SRGB: [number, number, number] = [1.0, 0.8, 0.86];
