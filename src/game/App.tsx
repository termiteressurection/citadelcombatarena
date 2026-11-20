import { useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { Ludus } from './Ludus';
import { Arena } from './Arena';
import { HUD } from './HUD';
import { installInput } from './input';
import { useGame } from './store';

export function App() {
  useEffect(() => installInput(), []);
  const scene = useGame((s) => s.scene);
  return (
    <>
      <Canvas camera={{ position: [0, 4.95, 35.2], fov: 66, near: 0.1, far: 800 }} dpr={[1, 1.5]} gl={{ antialias: true }}>
        {scene === 'ludus' && <Ludus />}
        {scene === 'arena' && <Arena />}
      </Canvas>
      <HUD />
    </>
  );
}
