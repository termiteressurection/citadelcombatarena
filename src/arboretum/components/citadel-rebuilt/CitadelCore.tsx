import { useEffect } from 'react';
import { useIdentity } from './hooks/useIdentity';

/**
 * CitadelCore
 * Persistent background orchestrator that runs silent maintenance tasks.
 * This should be mounted at the top level of the game.
 */
export default function CitadelCore() {
  const { checkAchievements, collectBottles } = useIdentity();

  useEffect(() => {
    // Run maintenance every 60 seconds
    const interval = setInterval(() => {
      // 1. Check for newly completed achievements
      const newAchievements = checkAchievements();
      if (newAchievements.length > 0) {
        console.log('CITADEL // ACHIEVEMENTS UNLOCKED:', newAchievements);
      }

      // 2. Collect message bottles that have arrived
      const bottles = collectBottles();
      if (bottles.length > 0) {
        console.log('CITADEL // BOTTLES COLLECTED:', bottles.length);
      }
    }, 60000);

    // Run once on mount
    collectBottles();

    return () => clearInterval(interval);
  }, [checkAchievements, collectBottles]);

  return null; // Invisible component
}
