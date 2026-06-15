import {
  isVisionFixtures,
  getVisionCityHubFixture,
  getVisionProfileFixture,
  getVisionRideDashboardFixture,
  VISION_PROFILE,
  VISION_CITY_HUB,
  VISION_RIDE_DASHBOARD,
} from '../../src/bootstrap/visionFixtures';

describe('visionFixtures', () => {
  test('is disabled by default (no env / no extra)', () => {
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

  test('screen adapters expose fixtures only when flag is enabled', () => {
    expect(getVisionProfileFixture(true)?.username).toBe('Anna K.');
    expect(getVisionCityHubFixture(true)?.cityOfWeek.name).toBe('Lublin');
    expect(getVisionRideDashboardFixture(true)?.streakDays).toBe(12);

    expect(getVisionProfileFixture(false)).toBeNull();
    expect(getVisionCityHubFixture(false)).toBeNull();
    expect(getVisionRideDashboardFixture(false)).toBeNull();
  });
});
