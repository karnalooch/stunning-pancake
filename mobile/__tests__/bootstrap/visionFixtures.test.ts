jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { extra: {} }, manifest: { extra: {} } },
}));

import {
  isVisionFixtures,
  getVisionCityHubFixture,
  getVisionProfileFixture,
  getVisionRideDashboardFixture,
  getVisionLeaderboardFixture,
  getVisionActivityHistoryFixture,
  VISION_PROFILE,
  VISION_CITY_HUB,
  VISION_RIDE_DASHBOARD,
  VISION_LEADERBOARD,
  VISION_ACTIVITY_HISTORY,
} from '../../src/bootstrap/visionFixtures';

describe('visionFixtures', () => {
  test('is disabled by default (no env / no extra)', () => {
    // A local mobile/.env (loaded by jest-expo) may leak the flag into
    // process.env; clear it so the default-off path is exercised hermetically.
    delete process.env.EXPO_PUBLIC_VISION_FIXTURES;
    expect(isVisionFixtures()).toBe(false);
  });

  test('profile fixture matches vision/12_profile.png', () => {
    expect(VISION_PROFILE.username).toBe('Anna K.');
    expect(VISION_PROFILE.level).toBe(12);
    expect(VISION_PROFILE.xpCurrent).toBe(3850);
    expect(VISION_PROFILE.xpMax).toBe(5000);
    expect(VISION_PROFILE.stats).toEqual({ km: 342, rides: 28, kom: 12 });
    expect(VISION_PROFILE.achievements).toHaveLength(10);
  });

  test('city hub fixture matches vision/05_compete_hub.png', () => {
    expect(VISION_CITY_HUB.cityOfWeek.name).toBe('Lublin');
    expect(VISION_CITY_HUB.cityWars.left.score).toBe(1240);
    expect(VISION_CITY_HUB.cityWars.right.score).toBe(1180);
    expect(VISION_CITY_HUB.leaderboard[0]).toEqual({ rank: 1, name: 'Kamil_4V', score: 2450 });
    expect(VISION_CITY_HUB.leaderboard).toHaveLength(5);
  });

  test('ride dashboard fixture matches vision/01_ride_dashboard.png', () => {
    expect(VISION_RIDE_DASHBOARD.level).toBe(17);
    expect(VISION_RIDE_DASHBOARD.streakDays).toBe(12);
    expect(VISION_RIDE_DASHBOARD.weekDistanceKm).toBe(128.7);
    expect(VISION_RIDE_DASHBOARD.dailyQuest.target).toBe(5.0);
  });

  test('leaderboard + activity history fixtures match mocks', () => {
    expect(VISION_LEADERBOARD[0]).toMatchObject({ rank: 1, username: 'Kamil_4V', points: 2450 });
    expect(VISION_LEADERBOARD).toHaveLength(5);
    expect(VISION_LEADERBOARD.some((e) => e.is_me)).toBe(true);
    expect(VISION_ACTIVITY_HISTORY).toHaveLength(3);
    expect(VISION_ACTIVITY_HISTORY[0]).toMatchObject({ type: 'BIKE', distance: 42300 });
  });

  test('screen adapters expose fixtures only when flag is enabled', () => {
    expect(getVisionProfileFixture(true)?.username).toBe('Anna K.');
    expect(getVisionCityHubFixture(true)?.cityOfWeek.name).toBe('Lublin');
    expect(getVisionRideDashboardFixture(true)?.streakDays).toBe(12);
    expect(getVisionLeaderboardFixture(true)?.length).toBe(5);
    expect(getVisionActivityHistoryFixture(true)?.length).toBe(3);

    expect(getVisionProfileFixture(false)).toBeNull();
    expect(getVisionCityHubFixture(false)).toBeNull();
    expect(getVisionRideDashboardFixture(false)).toBeNull();
    expect(getVisionLeaderboardFixture(false)).toBeNull();
    expect(getVisionActivityHistoryFixture(false)).toBeNull();
  });
});
