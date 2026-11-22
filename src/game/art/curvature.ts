import * as THREE from 'three';

export const CITY_CURVE_RADIUS = 200.0;

export const CURVE_UNIFORMS = {
  uCurveOrigin: { value: new THREE.Vector3(0, 0, 0) },
  uCurveRadius: { value: 0.0 },
};

/** Continuous parabolic horizon drop: d^2 / (2R) matching the vertex shader. */
export function curveDrop(dx: number, dz: number, radius = CURVE_UNIFORMS.uCurveRadius.value): number {
  if (!Number.isFinite(radius) || radius <= 0 || radius >= 50000) return 0;
  return (dx * dx + dz * dz) / (2.0 * radius);
}

/** Enable (radius > 0) or disable (radius = 0) global planetary curvature around (originX, originZ). */
export function setCurvature(radius: number, originX = 0, originZ = 0): void {
  CURVE_UNIFORMS.uCurveRadius.value = radius;
  CURVE_UNIFORMS.uCurveOrigin.value.set(originX, 0, originZ);
}

/** Inject the shared horizon curvature displacement into any Three.js material. */
export function patchCurvedMaterial<T extends THREE.Material>(mat: T): T {
  mat.customProgramCacheKey = () => 'boneyard-curved-v1';
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uCurveOrigin = CURVE_UNIFORMS.uCurveOrigin;
    shader.uniforms.uCurveRadius = CURVE_UNIFORMS.uCurveRadius;
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>\nuniform vec3 uCurveOrigin;\nuniform float uCurveRadius;`,
      )
      .replace(
        '#include <project_vertex>',
        `vec4 curveWorld = vec4( transformed, 1.0 );
        #ifdef USE_INSTANCING
          curveWorld = instanceMatrix * curveWorld;
        #endif
        curveWorld = modelMatrix * curveWorld;
        if (uCurveRadius > 0.0 && uCurveRadius < 50000.0) {
          vec2 curveD = curveWorld.xz - uCurveOrigin.xz;
          curveWorld.y -= dot(curveD, curveD) / (2.0 * uCurveRadius);
        }
        vec4 mvPosition = viewMatrix * curveWorld;
        gl_Position = projectionMatrix * mvPosition;`,
      );
  };
  return mat;
}

export function makeCurvedBasicMaterial(params: THREE.MeshBasicMaterialParameters): THREE.MeshBasicMaterial {
  return patchCurvedMaterial(new THREE.MeshBasicMaterial(params));
}
