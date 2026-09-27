import {
  averageSpeedKmh,
  formatDurationSeconds,
  routeViewport,
} from '../../src/utils/activityMetrics';

describe('activityMetrics', () => {
  test('formats backend duration seconds deterministically', () => {
    expect(formatDurationSeconds(0)).toBe('00:00:00');
    expect(formatDurationSeconds(3661)).toBe('01:01:01');
    expect(formatDurationSeconds(null)).toBe('—');
  });

  test('computes average speed from meters and seconds', () => {
    expect(averageSpeedKmh(30_000, 3600)).toBeCloseTo(30, 6);
    expect(averageSpeedKmh(10_000, 0)).toBeNull();
    expect(averageSpeedKmh(-1, 120)).toBeNull();
  });

  test('derives a bounded viewport from route coordinates', () => {
    const viewport = routeViewport([
      [22.24, 52.16],
      [22.26, 52.18],
      [22.28, 52.17],
    ]);
    expect(viewport.center?.[0]).toBeCloseTo(22.26, 5);
    expect(viewport.center?.[1]).toBeCloseTo(52.17, 5);
    expect(viewport.zoom).toBeGreaterThanOrEqual(10);
    expect(viewport.zoom).toBeLessThanOrEqual(16);
  });
});
