import { useEffect, useState } from 'react';
import { AccessibilityInfo, AppState, type AppStateStatus } from 'react-native';

export interface MotionPolicy {
  reduceMotion: boolean;
  appActive: boolean;
  /** Parallax / ambient animation allowed */
  allowParallax: boolean;
  /** Particle bursts / confetti allowed */
  allowParticles: boolean;
  /** Sprite bounce / Reanimated loops allowed */
  allowSpriteAnim: boolean;
}

export function useMotionPolicy(): MotionPolicy {
  const [reduceMotion, setReduceMotion] = useState(false);
  const [appActive, setAppActive] = useState(AppState.currentState === 'active');

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled()
      .then(setReduceMotion)
      .catch(() => setReduceMotion(false));

    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => sub.remove();
  }, []);

  useEffect(() => {
    const onChange = (state: AppStateStatus) => {
      setAppActive(state === 'active');
    };
    const sub = AppState.addEventListener('change', onChange);
    return () => sub.remove();
  }, []);

  const motionOk = !reduceMotion && appActive;

  return {
    reduceMotion,
    appActive,
    allowParallax: motionOk,
    allowParticles: motionOk,
    allowSpriteAnim: motionOk,
  };
}
