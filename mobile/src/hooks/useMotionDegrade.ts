import { useEffect, useState } from 'react';

const DEGRADE_FPS_THRESHOLD = 45;
const RECOVER_FPS_THRESHOLD = 52;

let globalDegraded = false;
const listeners = new Set<(v: boolean) => void>();

export function subscribeMotionDegrade(listener: (degraded: boolean) => void): () => void {
  listeners.add(listener);
  listener(globalDegraded);
  return () => listeners.delete(listener);
}

function setGlobalDegraded(value: boolean) {
  if (globalDegraded === value) return;
  globalDegraded = value;
  listeners.forEach((l) => l(value));
}

/**
 * Auto-degrade heavy effects when sustained FPS drops (ADR 012 / 014).
 */
export function useMotionDegradeMonitor(enabled: boolean): boolean {
  const [degraded, setDegraded] = useState(globalDegraded);

  useEffect(() => subscribeMotionDegrade(setDegraded), []);

  useEffect(() => {
    if (!enabled) return;

    let frameCount = 0;
    let windowStart = Date.now();
    let rafId = 0;

    const tick = () => {
      frameCount += 1;
      const elapsed = Date.now() - windowStart;
      if (elapsed >= 1_000) {
        const fps = Math.round((frameCount * 1_000) / elapsed);
        if (fps < DEGRADE_FPS_THRESHOLD) {
          setGlobalDegraded(true);
        } else if (fps >= RECOVER_FPS_THRESHOLD) {
          setGlobalDegraded(false);
        }
        frameCount = 0;
        windowStart = Date.now();
      }
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [enabled]);

  return degraded;
}

export function useEffectiveMotionPolicy(base: {
  allowParallax: boolean;
  allowParticles: boolean;
  allowSpriteAnim: boolean;
}) {
  const degraded = useMotionDegradeMonitor(true);
  if (!degraded) return base;
  return {
    allowParallax: false,
    allowParticles: false,
    allowSpriteAnim: base.allowSpriteAnim,
  };
}
