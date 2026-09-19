import type { ActivityItem } from '../services/api';

const WEEK_DAY_COUNT = 7;

function startOfCurrentWeek(now: Date): Date {
  const start = new Date(now);
  const mondayOffset = (start.getDay() + 6) % WEEK_DAY_COUNT;
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - mondayOffset);
  return start;
}

export function summarizeRiderHistory(list: ActivityItem[], now = new Date()) {
  const rides = list.length;
  const distanceKm = Math.round(
    list.reduce(
      (sum, activity) => sum + Math.max(0, activity.distance ?? 0),
      0,
    ) / 1000,
  );
  const verified = list.filter((activity) => activity.is_verified).length;
  const latest = list[0] ?? null;

  const weeklyDistanceByDayKm = Array.from({ length: WEEK_DAY_COUNT }, () => 0);
  const weekStart = startOfCurrentWeek(now);
  const nextWeek = new Date(weekStart);
  nextWeek.setDate(nextWeek.getDate() + WEEK_DAY_COUNT);

  for (const activity of list) {
    if (!activity.start_time) continue;

    const startedAt = new Date(activity.start_time);
    if (Number.isNaN(startedAt.getTime())) continue;
    if (startedAt < weekStart || startedAt >= nextWeek) continue;

    const dayIndex = (startedAt.getDay() + 6) % WEEK_DAY_COUNT;
    weeklyDistanceByDayKm[dayIndex] =
      (weeklyDistanceByDayKm[dayIndex] ?? 0) +
      Math.max(0, activity.distance ?? 0) / 1000;
  }

  const weeklyDistanceKm = weeklyDistanceByDayKm.reduce(
    (sum, km) => sum + km,
    0,
  );
  const maxDailyDistanceKm = Math.max(...weeklyDistanceByDayKm);

  const weeklyBars =
    maxDailyDistanceKm > 0
      ? weeklyDistanceByDayKm.map((km) => km / maxDailyDistanceKm)
      : weeklyDistanceByDayKm.map(() => 0);

  return {
    rides,
    distanceKm,
    verified,
    latest,
    weeklyBars,
    weeklyDistanceKm,
    weeklyDistanceByDayKm,
  };
}
