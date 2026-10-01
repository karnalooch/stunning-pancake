import fs from 'fs';
import path from 'path';
const SRC = path.resolve(__dirname, '../../src');
const read = (relative: string) => fs.readFileSync(path.join(SRC, relative), 'utf8');

describe('Product UX v2 You truth contract', () => {
  test('You uses Roadbook sections and real data sources', () => {
    const profile = read('screens/AthleteProfileScreen.tsx');
    for (const marker of ['AuthService.getProfile()', 'profile?.tenant_name', 'error: statsError', 'refresh: refreshStats', '<RoadbookPage', '<RoadbookSection', '<RoadbookRow', '<Metric']) expect(profile).toContain(marker);
    for (const retired of ['OrnateFrame', 'PixelText', 'AchievementGrid', 'LaurelHeader', 'SceneBackground', 'LevelXpBar']) expect(profile).not.toContain(retired);
  });
  test('You does not render fake or unavailable achievement modules', () => {
    const profile = read('screens/AthleteProfileScreen.tsx');
    for (const fake of ['profile-achievements-unavailable', 't.profile.achievementsUnavailable', "label: '100 KM'", "label: 'KOM'", '1000 KCAL', 'PASJA', 'verified >= 1', 'displayRides - displayVerified']) expect(profile).not.toContain(fake);
  });
  test('You groups Progress actions separately from Settings and account actions', () => {
    const profile = read('screens/AthleteProfileScreen.tsx');
    for (const id of ['you-open-trends', 'you-open-training-log', 'profile-settings-button', 'profile-logout-button']) expect(profile).toContain(`testID="${id}"`);
    expect(profile.indexOf('testID="you-open-trends"')).toBeLessThan(profile.indexOf('testID="profile-settings-button"'));
    expect(profile.indexOf('testID="you-open-training-log"')).toBeLessThan(profile.indexOf('testID="profile-settings-button"'));
  });
  test('Profile keeps account and ride failure states explicit', () => {
    const profile = read('screens/AthleteProfileScreen.tsx');
    for (const id of ['profile-load-error', 'profile-stats-error', 'profile-stats-offline', 'profile-retry', 'profile-stats-retry']) expect(profile).toContain(id);
  });
  test('vision Profile fixture uses verified ride count instead of a KOM proxy', () => {
    const fixtures = read('bootstrap/visionFixtures.ts');
    const start = fixtures.indexOf('export const VISION_PROFILE');
    const end = fixtures.indexOf('/** Compete hub', start);
    const profileFixture = fixtures.slice(start, end);
    expect(profileFixture).toContain('stats: { km: 342, rides: 28, verified: 12 }');
    expect(profileFixture).not.toContain('kom:');
    expect(profileFixture).not.toContain('achievements:');
  });
});
