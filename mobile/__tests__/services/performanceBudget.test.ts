import {
  PERFORMANCE_BUDGETS,
  __resetPerfBudgetForTests,
  recordPerformanceMetric,
} from '../../src/services/performanceBudget';

jest.mock('../../src/services/FirebaseService', () => ({
  setAnalyticsEvent: jest.fn(),
}));

import { setAnalyticsEvent } from '../../src/services/FirebaseService';

describe('performanceBudget', () => {
  beforeEach(() => {
    __resetPerfBudgetForTests();
    jest.clearAllMocks();
  });

  test('within budget does not emit violation event', () => {
    const result = recordPerformanceMetric('gpsIngestLatencyMs', 500);
    expect(result.withinBudget).toBe(true);
    expect(setAnalyticsEvent).not.toHaveBeenCalled();
  });

  test('minimum budget metric is valid when value is higher', () => {
    const result = recordPerformanceMetric('hudMinFps', 58);
    expect(result.withinBudget).toBe(true);
    expect(setAnalyticsEvent).not.toHaveBeenCalled();
  });

  test('exceeding budget emits perf_budget_violation', () => {
    const over = PERFORMANCE_BUDGETS.gpsIngestLatencyMs.value + 100;
    const result = recordPerformanceMetric('gpsIngestLatencyMs', over);
    expect(result.withinBudget).toBe(false);
    expect(setAnalyticsEvent).toHaveBeenCalledWith('perf_budget_violation', {
      metric: 'gpsIngestLatencyMs',
      value: over,
      budget: PERFORMANCE_BUDGETS.gpsIngestLatencyMs.value,
    });
  });
});
