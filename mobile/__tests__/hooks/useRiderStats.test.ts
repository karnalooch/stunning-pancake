import type { ActivityItem } from '../../src/services/api';
import { summarizeRiderHistory } from '../../src/home/riderStatsSummary';

function activity(
  id: number,
  startedAt: Date,
  distanceMeters: number,
): ActivityItem {
  return {
    id,
    type: 'BIKE',
    start_time: startedAt.toISOString(),
    end_time: new Date(startedAt.getTime() + 30 * 60 * 1000).toISOString(),
    distance: distanceMeters,
    duration: 1800,
    is_verified: true,
    verification_score: 1,
  };
}

describe('summarizeRiderHistory', () => {
  test('empty history produces a truthful zero week', () => {
    const stats = summarizeRiderHistory([], new Date(2026, 8, 16, 12));

    expect(stats.weeklyDistanceKm).toBe(0);
    expect(stats.weeklyDistanceByDayKm).toEqual([0, 0, 0, 0, 0, 0, 0]);
    expect(stats.weeklyBars).toEqual([0, 0, 0, 0, 0, 0, 0]);
    expect(stats.latest).toBeNull();
  });

  test('weekly values sum multiple rides per day and ignore previous week', () => {
    const now = new Date(2026, 8, 16, 12); // Wednesday
    const stats = summarizeRiderHistory(
      [
        activity(1, new Date(2026, 8, 14, 8), 10_000),
        activity(2, new Date(2026, 8, 14, 18), 5_000),
        activity(3, new Date(2026, 8, 15, 7), 20_000),
        activity(4, new Date(2026, 8, 13, 9), 50_000),
      ],
      now,
    );

    expect(stats.weeklyDistanceKm).toBe(35);
    expect(stats.weeklyDistanceByDayKm).toEqual([15, 20, 0, 0, 0, 0, 0]);
    expect(stats.weeklyBars).toEqual([0.75, 1, 0, 0, 0, 0, 0]);
  });

  test('latest ride is the newest completed ride regardless of API order', () => {
    const now = new Date(2026, 8, 16, 12);
    const older = activity(1, new Date(2026, 8, 14, 8), 10_000);
    const newest = activity(2, new Date(2026, 8, 16, 9), 25_000);
    const active = activity(3, new Date(2026, 8, 16, 10), 5_000);
    active.end_time = null;

    const stats = summarizeRiderHistory([older, active, newest], now);

    expect(stats.latest?.id).toBe(2);
  });

  test('future rides and invalid dates do not pollute the current week', () => {
    const now = new Date(2026, 8, 16, 12);
    const invalid = activity(1, new Date(2026, 8, 14, 8), 12_000);
    invalid.start_time = 'not-a-date';

    const stats = summarizeRiderHistory(
      [
        invalid,
        activity(2, new Date(2026, 8, 17, 8), 30_000),
      ],
      now,
    );

    expect(stats.weeklyDistanceKm).toBe(0);
    expect(stats.weeklyBars).toEqual([0, 0, 0, 0, 0, 0, 0]);
  });
});
