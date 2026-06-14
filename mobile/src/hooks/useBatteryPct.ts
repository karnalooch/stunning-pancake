import { useEffect, useState } from 'react';
import * as Battery from 'expo-battery';

/**
 * Returns current battery percentage (0-100), or null when unavailable.
 */
export function useBatteryPct(enabled = true): number | null {
  const [batteryPct, setBatteryPct] = useState<number | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let alive = true;

    const syncLevel = async () => {
      try {
        const level = await Battery.getBatteryLevelAsync();
        if (!alive || !Number.isFinite(level)) return;
        setBatteryPct(Math.max(0, Math.min(100, level * 100)));
      } catch {
        if (alive) setBatteryPct(null);
      }
    };

    void syncLevel();
    const sub = Battery.addBatteryLevelListener(({ batteryLevel }) => {
      if (!alive || !Number.isFinite(batteryLevel)) return;
      setBatteryPct(Math.max(0, Math.min(100, batteryLevel * 100)));
    });

    return () => {
      alive = false;
      sub.remove();
    };
  }, [enabled]);

  return batteryPct;
}
