import type { RideMetricsSnapshot } from '../ride/types';

export const VISUAL_WORKBENCH_FIXTURES = {
  clock: '10:24',
  batteryPct: 78,
  guidance: {
    text: 'Skręć w prawo w ul. Warszawską',
    distanceM: 180,
  },
  metrics: {
    speedMs: 8.7222,
    distanceKm: 42.8,
    avgSpeedKmh: 31.4,
    elapsedSeconds: 4937,
    heartRateBpm: 156,
    elevationGainM: 438,
    headingDeg: 88,
    gpsPending: false,
  } satisfies RideMetricsSnapshot,
  pendingMetrics: {
    speedMs: 0,
    distanceKm: 0,
    avgSpeedKmh: null,
    elapsedSeconds: 0,
    heartRateBpm: null,
    elevationGainM: 0,
    headingDeg: null,
    gpsPending: true,
  } satisfies RideMetricsSnapshot,
} as const;
