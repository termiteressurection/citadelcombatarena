import { useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { Ludus } from './Ludus';
import { HUD } from './HUD';
import { installInput } from './input';
import { useGame } from './store';

export function App() {
  useEffect(() => installInput(), []);
  const scene = useGame((s) => s.scene);
  return (
    <>
      <Canvas camera={{ position: [0, 6, 42], fov: 62, near: 0.1, far: 700 }} dpr={[1, 1.5]} gl={{ antialias: true }}>
        {scene === 'ludus' && <Ludus />}
      </Canvas>
      <HUD />
    </>
  );
}
