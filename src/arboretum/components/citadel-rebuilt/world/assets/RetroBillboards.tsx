/* ─────────────────────────────────────────────────────────────────
   RETRO BILLBOARDS
   Extracted from CityAssets.tsx.
   Doom-style 2.5D billboard sprites. All components are camera-
   facing planes with pixel art textures from pixelArtTextures.ts.
   ───────────────────────────────────────────────────────────────── */
import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { sphereDrop } from '../../RebuiltWorldShared';
import {
  getFloppyDiskTexture, getCRTMonitorTextures,
  getHeartTexture, getHypercubeTexture, getGlitchCloudTextures,
  getWatcherEyeTexture, getPalmTreeTexture, getGrassTexture,
  getPigeonTexture, getBisonTexture,
} from './pixelArtTextures';
import { faceCameraAtHeight } from './billboardUtils';

type BillboardProps = {
  position: [number, number, number];
  scale?: number;
  playerPos: React.MutableRefObject<THREE.Vector3>;
};

function billboard(
  meshRef: React.RefObject<THREE.Mesh | null>,
  position: [number, number, number],
  floatHeight: number,
  playerPos: React.MutableRefObject<THREE.Vector3>,
  extraY?: (clock: THREE.Clock) => number,
) {
  const cameraTarget = new THREE.Vector3();
  return ({ camera, clock }: { camera: THREE.Camera; clock: THREE.Clock }) => {
    if (!meshRef.current) return;
    const pp = playerPos.current;
    const extraOffset = extraY ? extraY(clock) : 0;
    meshRef.current.position.set(
      position[0],
      position[1] + floatHeight + extraOffset - sphereDrop(position[0] - pp.x, position[2] - pp.z),
      position[2],
    );
    faceCameraAtHeight(meshRef.current, camera, cameraTarget);
  };
}

function seedFrom(x: number, z: number, a: number, b: number) {
  const s = Math.sin(x * a + z * b) * 43758.54;
  return s - Math.floor(s);
}

export function DoomFloppy({ position, scale = 1, playerPos }: BillboardProps) {
  const ref = useRef<THREE.Mesh>(null);
  const floatH = useMemo(() => 1.5 + seedFrom(position[0], position[2], 12.98, 78.23) * 8.5, [position]);
  useFrame(billboard(ref, position, floatH, playerPos));
  return (
    <mesh ref={ref} scale={[scale * 1.5, scale * 1.5, 1]}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial map={getFloppyDiskTexture()} transparent alphaTest={0.05} depthWrite side={THREE.DoubleSide} />
    </mesh>
  );
}

export function DoomMonitor({ position, scale = 1, playerPos }: BillboardProps) {
  const ref = useRef<THREE.Mesh>(null);
  const [frame, setFrame] = React.useState(0);
  const floatH = useMemo(() => 2.0 + seedFrom(position[0], position[2], 19.34, 54.21) * 12.0, [position]);
  React.useEffect(() => {
    const id = setInterval(() => setFrame(f => (f + 1) % 4), 150);
    return () => clearInterval(id);
  }, []);
  useFrame(billboard(ref, position, floatH, playerPos));
  return (
    <mesh ref={ref} scale={[scale * 2.2, scale * 2.2, 1]}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial map={getCRTMonitorTextures()[frame]} transparent alphaTest={0.05} depthWrite side={THREE.DoubleSide} />
    </mesh>
  );
}

export function DoomHeart({ position, scale = 1, playerPos }: BillboardProps) {
  const ref = useRef<THREE.Mesh>(null);
  const cameraTarget = useRef(new THREE.Vector3());
  const floatH = useMemo(() => 3.0 + seedFrom(position[0], position[2], 32.11, 87.65) * 14.0, [position]);
  useFrame(({ camera, clock }) => {
    if (!ref.current) return;
    const pp = playerPos.current;
    const pulse = 1.0 + Math.sin(clock.elapsedTime * 6.0) * 0.12;
    ref.current.position.set(
      position[0],
      position[1] + floatH + Math.sin(clock.elapsedTime * 2.0) * 0.15 - sphereDrop(position[0] - pp.x, position[2] - pp.z),
      position[2],
    );
    faceCameraAtHeight(ref.current, camera, cameraTarget.current);
    ref.current.scale.set(scale * 1.5 * pulse, scale * 1.5 * pulse, 1);
  });
  return (
    <mesh ref={ref}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial map={getHeartTexture()} transparent alphaTest={0.05} depthWrite side={THREE.DoubleSide} />
    </mesh>
  );
}

export function DoomHypercube({ position, scale = 1, playerPos }: BillboardProps) {
  const ref = useRef<THREE.Mesh>(null);
  const cameraTarget = useRef(new THREE.Vector3());
  const floatH = useMemo(() => 4.0 + seedFrom(position[0], position[2], 41.89, 29.43) * 15.0, [position]);
  useFrame(({ camera, clock }) => {
    if (!ref.current) return;
    const pp = playerPos.current;
    ref.current.position.set(
      position[0],
      position[1] + floatH + Math.sin(clock.elapsedTime * 1.5) * 0.2 - sphereDrop(position[0] - pp.x, position[2] - pp.z),
      position[2],
    );
    faceCameraAtHeight(ref.current, camera, cameraTarget.current);
    ref.current.rotation.z = clock.elapsedTime * 0.3;
  });
  return (
    <mesh ref={ref} scale={[scale * 2.0, scale * 2.0, 1]}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial map={getHypercubeTexture()} transparent alphaTest={0.05} depthWrite side={THREE.DoubleSide} />
    </mesh>
  );
}

export function DoomGlitchCloud({ position, scale = 1, playerPos }: BillboardProps) {
  const ref = useRef<THREE.Mesh>(null);
  const [frame, setFrame] = React.useState(0);
  const floatH = useMemo(() => 5.0 + seedFrom(position[0], position[2], 53.27, 61.12) * 16.0, [position]);
  React.useEffect(() => {
    const id = setInterval(() => setFrame(f => (f + 1) % 4), 85);
    return () => clearInterval(id);
  }, []);
  useFrame(billboard(ref, position, floatH, playerPos));
  return (
    <mesh ref={ref} scale={[scale * 2.5, scale * 2.5, 1]}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial map={getGlitchCloudTextures()[frame]} transparent alphaTest={0.05} depthWrite side={THREE.DoubleSide} />
    </mesh>
  );
}

export function DoomWatcherEye({ position, scale = 1, playerPos }: BillboardProps) {
  const ref = useRef<THREE.Mesh>(null);
  const floatH = useMemo(() => 6.0 + seedFrom(position[0], position[2], 64.71, 18.99) * 18.0, [position]);
  useFrame(billboard(ref, position, floatH, playerPos,
    clock => Math.sin(clock.elapsedTime * 2.5) * 0.1));
  return (
    <mesh ref={ref} scale={[scale * 2.2, scale * 2.2, 1]}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial map={getWatcherEyeTexture()} transparent alphaTest={0.05} depthWrite side={THREE.DoubleSide} />
    </mesh>
  );
}

export function DoomTree({ position, scale = 1, playerPos }: BillboardProps) {
  const ref = useRef<THREE.Mesh>(null);
  const cameraTarget = useRef(new THREE.Vector3());
  useFrame(({ camera }) => {
    if (!ref.current) return;
    const pp = playerPos.current;
    ref.current.position.set(
      position[0],
      position[1] + 4.2 * scale - sphereDrop(position[0] - pp.x, position[2] - pp.z),
      position[2],
    );
    faceCameraAtHeight(ref.current, camera, cameraTarget.current);
  });
  return (
    <mesh ref={ref} scale={[scale * 9.0, scale * 9.0, 1]}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial map={getPalmTreeTexture()} transparent alphaTest={0.05} depthWrite side={THREE.DoubleSide} />
    </mesh>
  );
}

export function DoomGrass({ position, scale = 1, playerPos }: BillboardProps) {
  const ref = useRef<THREE.Mesh>(null);
  const cameraTarget = useRef(new THREE.Vector3());
  useFrame(({ camera }) => {
    if (!ref.current) return;
    const pp = playerPos.current;
    ref.current.position.set(
      position[0],
      position[1] + 0.9 * scale - sphereDrop(position[0] - pp.x, position[2] - pp.z),
      position[2],
    );
    faceCameraAtHeight(ref.current, camera, cameraTarget.current);
  });
  return (
    <mesh ref={ref} scale={[scale * 2.0, scale * 2.0, 1]}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial map={getGrassTexture()} transparent alphaTest={0.05} depthWrite side={THREE.DoubleSide} />
    </mesh>
  );
}

export function DoomPigeon({ position, scale = 1, playerPos }: BillboardProps) {
  const ref = useRef<THREE.Mesh>(null);
  const cameraTarget = useRef(new THREE.Vector3());
  const floatH = useMemo(() => 1.8 + seedFrom(position[0], position[2], 42.84, 29.13) * 9.2, [position]);
  useFrame(({ camera, clock }) => {
    if (!ref.current) return;
    const pp = playerPos.current;
    ref.current.position.set(
      position[0],
      position[1] + floatH + Math.sin(clock.elapsedTime * 1.5 + floatH) * 0.2 - sphereDrop(position[0] - pp.x, position[2] - pp.z),
      position[2],
    );
    faceCameraAtHeight(ref.current, camera, cameraTarget.current);
  });
  return (
    <mesh ref={ref} scale={[scale * 3.5, scale * 3.5, 1]}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial map={getPigeonTexture()} transparent alphaTest={0.01} depthWrite side={THREE.DoubleSide} />
    </mesh>
  );
}

export function DoomBison({ position, scale = 1, playerPos }: BillboardProps) {
  const ref = useRef<THREE.Mesh>(null);
  const cameraTarget = useRef(new THREE.Vector3());
  const floatH = useMemo(() => 3.0 + seedFrom(position[0], position[2], 58.73, 34.61) * 14.0, [position]);
  useFrame(({ camera, clock }) => {
    if (!ref.current) return;
    const pp = playerPos.current;
    ref.current.position.set(
      position[0],
      position[1] + floatH + Math.cos(clock.elapsedTime * 1.2 + floatH) * 0.25 - sphereDrop(position[0] - pp.x, position[2] - pp.z),
      position[2],
    );
    faceCameraAtHeight(ref.current, camera, cameraTarget.current);
  });
  return (
    <mesh ref={ref} scale={[scale * 4.2, scale * 4.2, 1]}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial map={getBisonTexture()} transparent alphaTest={0.01} depthWrite side={THREE.DoubleSide} />
    </mesh>
  );
}
