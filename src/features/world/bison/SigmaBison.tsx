import { useRef } from 'react';
import { useFrame, useLoader } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * SigmaBison: The God in the Machine
 * Replaced the wireframe geometry with a highly dithered SNES-style 2D sprite.
 */
export function SigmaBison() {
  const spriteRef = useRef<THREE.Sprite>(null);
  const texture = useLoader(THREE.TextureLoader, '/snes_bison.png');
  
  // Enforce nearest-neighbor filtering for the crisp SNES pixel look
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.colorSpace = THREE.SRGBColorSpace;

  useFrame((state) => {
    if (spriteRef.current) {
      // Gentle retro hover
      spriteRef.current.position.y = Math.sin(state.clock.elapsedTime * 2) * 0.1 + 1.5;
    }
  });

  return (
    <sprite ref={spriteRef} position={[0, 1.5, 0]} scale={[4, 4, 1]}>
      <spriteMaterial map={texture} transparent={true} alphaTest={0.01} />
    </sprite>
  );
}
