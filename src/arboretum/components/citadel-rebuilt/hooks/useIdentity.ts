import { useCallback } from 'react';
import { useCitadelStore } from '../store';
import { AvatarConfig, BottleMessage, CalibrationState } from '../types';
import { localDateISO } from '../localDate';

export function useIdentity() {
  const identity = useCitadelStore(state => state.identity);
  const chambers = useCitadelStore(state => state.chambers);
  const updateIdentity = useCitadelStore(state => state.updateIdentity);
  const setChambers = useCitadelStore(state => state.setChambers);

  const setIdentity = useCallback((name: string) => {
    updateIdentity(prev => {
      prev.name = name;
    });
  }, [updateIdentity]);

  const updateStreak = useCallback(() => {
    const today = localDateISO();
    if (identity.lastActiveDate === today) return;

    updateIdentity(prev => {
      const yesterday = localDateISO(new Date(Date.now() - 86400000));
      const newStreak = (prev.lastActiveDate === yesterday) ? (prev.streak || 0) + 1 : 1;
      prev.lastActiveDate = today;
      prev.streak = newStreak;
    });
  }, [identity.lastActiveDate, updateIdentity]);



  const setAvatar = useCallback((config: AvatarConfig) => {
    updateIdentity(prev => {
      prev.avatar = config;
    });
  }, [updateIdentity]);

  const logMood = useCallback((mood: string) => {
    updateIdentity(prev => {
      if (!prev.moodLog) prev.moodLog = [];
      prev.moodLog.push({ date: new Date().toISOString(), mood });
      if (prev.moodLog.length > 30) prev.moodLog.shift();
    });
  }, [updateIdentity]);

  const completeRitual = useCallback((slot: 'morning' | 'midday' | 'evening') => {
    const today = new Date().toISOString().slice(0, 10);
    updateIdentity(prev => {
      if (!prev.rituals || prev.rituals.date !== today) {
        prev.rituals = { date: today, stars: prev.rituals?.stars || 0, constellations: prev.rituals?.constellations || 0 };
      }
      (prev.rituals as any)[slot] = true;
    });
  }, [updateIdentity]);

  const sendBottle = useCallback((text: string, currentChamberId: number) => {
    const bottle: BottleMessage = {
      id: Date.now(), text, sentAt: new Date().toISOString(),
      arriveAt: new Date(Date.now() + (1 + Math.random() * 3) * 86400000).toISOString(),
      fromChamber: currentChamberId,
    };
    updateIdentity(prev => {
      if (!prev.sentBottles) prev.sentBottles = [];
      prev.sentBottles.push(bottle);
    });
  }, [updateIdentity]);

  const collectBottles = useCallback(() => {
    const now = new Date().toISOString();
    const sent = identity.sentBottles || [];
    const ready = sent.filter(b => b.arriveAt <= now && !b.toChamber);
    if (ready.length === 0) return [];
    
    const chamberIds = Object.keys(chambers).map(Number);
    const updatedReady: BottleMessage[] = [];
    
    setChambers(prev => {
      const u = { ...prev };
      ready.forEach(b => {
        const target = chamberIds[Math.floor(Math.random() * chamberIds.length)];
        const bUpdated = { ...b, toChamber: target };
        u[target] = { ...u[target], bottles: [...(u[target].bottles || []), bUpdated] };
        updatedReady.push(bUpdated);
      });
      return u;
    }, true);

    updateIdentity(prev => {
      if (prev.sentBottles) {
        prev.sentBottles = prev.sentBottles.map(b => updatedReady.find(r => r.id === b.id) || b);
      }
    });
    return updatedReady;
  }, [identity.sentBottles, chambers, setChambers, updateIdentity]);

  const markDailyPromptComplete = useCallback(() => {
    const today = localDateISO();
    updateIdentity(prev => {
      prev.lastDailyPromptDate = today;
    });
  }, [updateIdentity]);

  const incrementDailyDeepThoughts = useCallback(() => {
    const today = localDateISO();
    updateIdentity(prev => {
      if (prev.lastDeepThoughtDate !== today) {
        prev.dailyDeepThoughts = 1;
        prev.lastDeepThoughtDate = today;
      } else {
        prev.dailyDeepThoughts = (prev.dailyDeepThoughts || 0) + 1;
      }
    });
  }, [updateIdentity]);

  const updateIdentityExtra = useCallback((extra: Record<string, any>) => {
    updateIdentity(prev => {
      prev.extra = extra;
    });
  }, [updateIdentity]);

  const applyMBTICalibration = useCallback((patch: Partial<CalibrationState>) => {
    updateIdentity(prev => {
      prev.calibration = {
        ...(prev.calibration || { status: 'none' }),
        ...patch,
        lastUpdatedAt: new Date().toISOString(),
      };
    });
  }, [updateIdentity]);

  // Compatibility shim for CitadelCore maintenance loop.
  // Achievement unlock logic is currently handled elsewhere.
  const checkAchievements = useCallback((): string[] => {
    return [];
  }, []);

  return {
    setIdentity,
    updateStreak,

    setAvatar,
    logMood,
    completeRitual,
    sendBottle,
    collectBottles,
    checkAchievements,
    markDailyPromptComplete,
    incrementDailyDeepThoughts,
    updateIdentityExtra,
    applyMBTICalibration,
  };
}
