/**
 * Mobile runtime performance budgets and regression telemetry.
 */

import { setAnalyticsEvent } from './FirebaseService';

export const PERFORMANCE_BUDGETS = {
  /** Minimum acceptable HUD frame rate during active ride. */
  hudMinFps: 55,
  /** Max acceptable GPS batch ingest round-trip (ms). */
  gpsIngestLatencyMs: 2_000,
  /** Max acceptable outbox flush duration (ms). */
  outboxFlushMs: 5_000,
  /** Max acceptable MMKV write for GPS buffer (ms). */
  mmkvWriteMs: 16,
} as const;

export type PerformanceMetricName = keyof typeof PERFORMANCE_BUDGETS;

const violationCooldownMs = 30_000;
const lastViolationAt = new Map<PerformanceMetricName, number>();

export function recordPerformanceMetric(
  name: PerformanceMetricName,
  value: number,
): { withinBudget: boolean; budget: number } {
  const budget = PERFORMANCE_BUDGETS[name];
  const withinBudget = value <= budget;

  if (!withinBudget) {
    const now = Date.now();
    const last = lastViolationAt.get(name) ?? 0;
    if (now - last >= violationCooldownMs) {
      lastViolationAt.set(name, now);
      setAnalyticsEvent('perf_budget_violation', {
        metric: name,
        value,
        budget,
      });
      if (__DEV__) {
        console.warn(`[Perf] Budget exceeded: ${name}=${value} (budget ${budget})`);
      }
    }
  }

  return { withinBudget, budget };
}

export async function measureAsync<T>(
  name: PerformanceMetricName,
  fn: () => Promise<T>,
): Promise<T> {
  const started = Date.now();
  try {
    return await fn();
  } finally {
    recordPerformanceMetric(name, Date.now() - started);
  }
}

export function measureSync<T>(name: PerformanceMetricName, fn: () => T): T {
  const started = Date.now();
  try {
    return fn();
  } finally {
    recordPerformanceMetric(name, Date.now() - started);
  }
}

/** Test-only reset of violation cooldown state. */
export function __resetPerfBudgetForTests(): void {
  lastViolationAt.clear();
}
