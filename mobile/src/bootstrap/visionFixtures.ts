/**
 * visionFixtures.ts — deterministic demo data matching the `vision/` mocks.
 *
 * Enabled only when `EXPO_PUBLIC_VISION_FIXTURES=true` (preview/diff builds —
 * never production). Screens/services read these so a screenshot can be
 * pixel-diffed against `docs/design/screenshots/2026-06-14-emulator-audit/vision/`
 * without depending on live API data (numbers/names must match the mocks).
 */
import Constants from 'expo-constants';

/** True when the build should render vision fixture data instead of live data. */
export function isVisionFixtures(): boolean {
  const fromProcess = process.env.EXPO_PUBLIC_VISION_FIXTURES;
  if (fromProcess != null && fromProcess !== '') {
    return fromProcess === 'true';
  }

  const fromExpo = Constants.expoConfig?.extra as Record<string, string | undefined> | undefined;
  const fromManifest2 = (
    Constants as { manifest2?: { extra?: Record<string, string | undefined> } }
  ).manifest2?.extra;
  const fromManifest = (
    Constants as { manifest?: { extra?: Record<string, string | undefined> } }
  ).manifest?.extra;
  const extra = { ...fromManifest, ...fromManifest2, ...fromExpo };
  return extra.EXPO_PUBLIC_VISION_FIXTURES === 'true';
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

/** Leaderboard rows — mirrors `vision/15_leaderboard.png` (LeaderboardEntry shape). */
export const VISION_LEADERBOARD = [
  { rank: 1, username: 'Kamil_4V', points: 2450, is_me: false, score_km: 245.0 },
  { rank: 2, username: 'Ev3line', points: 2110, is_me: false, score_km: 211.0 },
  { rank: 3, username: 'RowerowyJanek', points: 1980, is_me: false, score_km: 198.0 },
  { rank: 4, username: 'RoadHunter', points: 1750, is_me: false, score_km: 175.0 },
  { rank: 5, username: 'Magda_4V', points: 1620, is_me: true, score_km: 162.0 },
] as const;

/** Activity history — feeds `vision/14_trends.png` and `vision/16_training_log.png`. */
export const VISION_ACTIVITY_HISTORY = [
  {
    id: 9001,
    type: 'BIKE',
    start_time: '2026-06-14T07:30:00Z',
    end_time: '2026-06-14T09:12:00Z',
    distance: 42300,
    duration: '01:42:00',
    is_verified: true,
    verification_score: 0.98,
  },
  {
    id: 9002,
    type: 'BIKE',
    start_time: '2026-06-12T17:05:00Z',
    end_time: '2026-06-12T17:58:00Z',
    distance: 21800,
    duration: '00:53:00',
    is_verified: true,
    verification_score: 0.95,
  },
  {
    id: 9003,
    type: 'RUN',
    start_time: '2026-06-10T06:40:00Z',
    end_time: '2026-06-10T07:21:00Z',
    distance: 8200,
    duration: '00:41:00',
    is_verified: false,
    verification_score: 0.4,
  },
] as const;

/** Return profile fixture when vision mode is enabled. */
export function getVisionProfileFixture(enabled: boolean): typeof VISION_PROFILE | null {
  return enabled ? VISION_PROFILE : null;
}

/** Return leaderboard fixture when vision mode is enabled. */
export function getVisionLeaderboardFixture(
  enabled: boolean,
): typeof VISION_LEADERBOARD | null {
  return enabled ? VISION_LEADERBOARD : null;
}

/** Return activity-history fixture (trends + training log) when vision mode is enabled. */
export function getVisionActivityHistoryFixture(
  enabled: boolean,
): typeof VISION_ACTIVITY_HISTORY | null {
  return enabled ? VISION_ACTIVITY_HISTORY : null;
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
