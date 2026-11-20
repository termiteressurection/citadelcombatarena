import * as THREE from 'three';

/** Flat-world stand-in for the Citadel's "small planet" curvature: just place the object. */
export function applyGlobeCurvature(
  object: THREE.Object3D,
  worldX: number,
  baseY: number,
  worldZ: number,
  _playerPos: THREE.Vector3,
  baseRotationY = 0,
  extraOffsetY = 0,
) {
  object.position.set(worldX, baseY + extraOffsetY, worldZ);
  object.quaternion.set(0, 0, 0, 1);
  if (baseRotationY !== 0) object.rotateY(baseRotationY);
}
