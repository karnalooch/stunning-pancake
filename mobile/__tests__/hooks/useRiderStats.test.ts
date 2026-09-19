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
    end_time: null,
    distance: distanceMeters,
    duration: '00:30:00',
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

  test('future rides and invalid dates do not pollute the current week', () => {
    const now = new Date(2026, 8, 16, 12);
    const invalid = activity(1, new Date(2026, 8, 14, 8), 12_000);
    invalid.start_time = 'not-a-date';

    const stats = summarizeRiderHistory(
      [
        invalid,
        activity(2, new Date(2026, 8, 21, 8), 30_000),
      ],
      now,
    );

    expect(stats.weeklyDistanceKm).toBe(0);
    expect(stats.weeklyBars).toEqual([0, 0, 0, 0, 0, 0, 0]);
  });
});
