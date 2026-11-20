import * as THREE from 'three';

export function faceCameraAtHeight(
  mesh: THREE.Object3D,
  camera: THREE.Camera,
  target: THREE.Vector3,
): void {
  target.copy(camera.position);
  target.y = mesh.position.y;
  mesh.lookAt(target);
}
