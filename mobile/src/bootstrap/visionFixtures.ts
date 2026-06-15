/**
 * visionFixtures.ts — deterministic demo data matching the `vision/` mocks.
 *
 * Enabled only when `EXPO_PUBLIC_VISION_FIXTURES=true` (preview/diff builds —
 * never production). Screens/services read these so a screenshot can be
 * pixel-diffed against `docs/design/screenshots/2026-06-14-emulator-audit/vision/`
 * without depending on live API data (numbers/names must match the mocks).
 */
import Constants from 'expo-constants';

function readFlag(key: string): boolean {
  const fromProcess = process.env[key];
  if (fromProcess != null && fromProcess !== '') return fromProcess === 'true';
  const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, string | undefined>;
  return extra[key] === 'true';
}

/** True when the build should render vision fixture data instead of live data. */
export function isVisionFixtures(): boolean {
  return readFlag('EXPO_PUBLIC_VISION_FIXTURES');
}

/** Profile screen — mirrors `vision/12_profile.png` (Anna K.). */
export const VISION_PROFILE = {
  username: 'Anna K.',
  level: 12,
  xpCurrent: 3850,
  xpMax: 5000,
  stats: { km: 342, rides: 28, kom: 12 },
  achievements: [
    { id: 'ach_100km', label: '100 KM', unlocked: true },
    { id: 'ach_10rides', label: '10 JAZD', unlocked: true },
    { id: 'ach_500m', label: '500 M', unlocked: true },
    { id: 'ach_kom', label: 'KOM', unlocked: true },
    { id: 'ach_5h', label: '5H CZAS', unlocked: true },
    { id: 'ach_endurance', label: 'WYTRWAŁOŚĆ', unlocked: true },
    { id: 'ach_1000kcal', label: '1000 KCAL', unlocked: true },
    { id: 'ach_7days', label: '7 DNI', unlocked: true },
    { id: 'ach_explorer', label: 'ODKRYWCA', unlocked: true },
    { id: 'ach_passion', label: 'PASJA', unlocked: true },
  ],
} as const;

/** Compete hub — mirrors `vision/05_compete_hub.png` (Lublin). */
export const VISION_CITY_HUB = {
  level: 12,
  cityOfWeek: { name: 'Lublin', crest: 'crest_lublin' },
  cityWars: {
    left: { name: 'Lublin', crest: 'crest_lublin', score: 1240 },
    right: { name: 'Warszawa', crest: 'crest_warszawa', score: 1180 },
  },
  leaderboard: [
    { rank: 1, name: 'Kamil_4V', score: 2450 },
    { rank: 2, name: 'Ev3line', score: 2110 },
    { rank: 3, name: 'RowerowyJanek', score: 1980 },
    { rank: 4, name: 'RoadHunter', score: 1750 },
    { rank: 5, name: 'Magda_4V', score: 1620 },
  ],
  quests: [
    { id: 'q1', title: 'Odwiedź 3 punkty', distanceKm: 1.2, star: 250, coin: 50 },
    { id: 'q2', title: 'Zrób zdjęcie pomnika', distanceKm: 0.85, star: 200, coin: 40 },
    { id: 'q3', title: 'Przejedź 5 km', distanceKm: 2.1, star: 300, coin: 60 },
  ],
} as const;

/** Ride dashboard — mirrors `vision/01_ride_dashboard.png`. */
export const VISION_RIDE_DASHBOARD = {
  title: 'JAZDA',
  level: 17,
  xpCurrent: 1250,
  xpMax: 2000,
  streakDays: 12,
  bestStreak: 12,
  dailyQuest: { title: 'Przejedź 5 km', current: 3.2, target: 5.0, reward: 50 },
  weekDistanceKm: 128.7,
} as const;

/** Return profile fixture when vision mode is enabled. */
export function getVisionProfileFixture(enabled: boolean): typeof VISION_PROFILE | null {
  return enabled ? VISION_PROFILE : null;
}

/** Return city-hub fixture when vision mode is enabled. */
export function getVisionCityHubFixture(enabled: boolean): typeof VISION_CITY_HUB | null {
  return enabled ? VISION_CITY_HUB : null;
}

/** Return ride dashboard fixture when vision mode is enabled. */
export function getVisionRideDashboardFixture(
  enabled: boolean,
): typeof VISION_RIDE_DASHBOARD | null {
  return enabled ? VISION_RIDE_DASHBOARD : null;
}
