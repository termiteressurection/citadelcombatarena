import { useState, useCallback, useRef } from 'react';
import * as THREE from 'three';

export type SceneId = 'world' | 'gladiator3d';

export function useSceneManager(initialPos: THREE.Vector3) {
  const [scene, setScene] = useState<SceneId>('world');
  const [transitioning, setTransitioning] = useState(false);
  const [transLabel, setTransLabel] = useState('');
  const [moshIntensity, setMoshIntensity] = useState(0);
  
  const playerWorldPos = useRef(initialPos.clone());
  const playerYaw = useRef(0);

  const transitionTo = useCallback((newScene: SceneId, label: string, newPos?: THREE.Vector3, intensity = 0, onComplete?: () => void) => {
    setTransLabel(label);
    setMoshIntensity(intensity);
    setTransitioning(true);
    
    setTimeout(() => {
      setScene(newScene);
      if (newPos) playerWorldPos.current.copy(newPos);
      if (onComplete) onComplete();
      
      setTimeout(() => {
        setTransitioning(false);
        setMoshIntensity(0);
      }, 400);
    }, 350);
  }, []);

  return {
    scene,
    transitioning,
    transLabel,
    moshIntensity,
    playerWorldPos,
    playerYaw,
    transitionTo
  };
}
