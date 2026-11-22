import { useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { Ludus } from './Ludus';
import { Arena } from './Arena';
import { HUD } from './HUD';
import { Ps1Overlay, Ps1Resolution } from './art/Ps1Display';
import { installInput } from './input';
import { useGame } from './store';

export function App() {
  useEffect(() => {
    const uninstall = installInput();
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'KeyP' && !e.repeat) useGame.getState().togglePs1Mode();
    };
    window.addEventListener('keydown', onKey);
    return () => { uninstall(); window.removeEventListener('keydown', onKey); };
  }, []);
  const scene = useGame((s) => s.scene);
  return (
    <>
      <Canvas camera={{ position: [0, 4.95, 35.2], fov: 66, near: 0.1, far: 1200 }} dpr={[1, 1.5]} gl={{ antialias: false }}>
        <Ps1Resolution />
        {scene === 'ludus' && <Ludus />}
        {scene === 'arena' && <Arena />}
      </Canvas>
      <Ps1Overlay />
      <HUD />
    </>
  );
}
