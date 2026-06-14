import { useEffect } from 'react';
import { recordPerformanceMetric } from '../services/performanceBudget';

/**
 * Samples HUD frame rate and reports budget violations via analytics.
 */
export function useFrameBudgetMonitor(enabled: boolean): void {
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
        recordPerformanceMetric('hudMinFps', fps);
        frameCount = 0;
        windowStart = Date.now();
      }
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [enabled]);
}
