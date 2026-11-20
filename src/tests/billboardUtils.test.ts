import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { faceCameraAtHeight } from '../arboretum/components/citadel-rebuilt/world/assets/billboardUtils';

describe('faceCameraAtHeight', () => {
  it('reuses the target vector and keeps the camera-facing point level with the mesh', () => {
    const mesh = new THREE.Object3D();
    mesh.position.set(2, 3, 4);
    const camera = new THREE.PerspectiveCamera();
    camera.position.set(8, 10, 12);
    const target = new THREE.Vector3();

    faceCameraAtHeight(mesh, camera, target);

    expect(target.toArray()).toEqual([8, 3, 12]);
    expect(camera.position.toArray()).toEqual([8, 10, 12]);

    const targetIdentity = target;
    camera.position.set(-5, 6, 9);
    mesh.position.y = -2;
    faceCameraAtHeight(mesh, camera, target);

    expect(target).toBe(targetIdentity);
    expect(target.toArray()).toEqual([-5, -2, 9]);
  });
});
