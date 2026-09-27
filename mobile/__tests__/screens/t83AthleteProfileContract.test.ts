import fs from 'fs';
import path from 'path';

const SRC = path.resolve(__dirname, '../../src');
const read = (relative: string) => fs.readFileSync(path.join(SRC, relative), 'utf8');

describe('T83-A Athlete Profile truth contract', () => {
  test('Profile uses Frozen UI product chrome and real data sources', () => {
    const profile = read('screens/AthleteProfileScreen.tsx');

    expect(profile).toContain('AuthService.getProfile()');
    expect(profile).toContain('profile?.tenant_name');
    expect(profile).toContain('error: statsError');
    expect(profile).toContain('refresh: refreshStats');
    expect(profile).toContain('<ProductCard');
    expect(profile).toContain('<Metric');
    expect(profile).toContain('<PrimaryButton');

    expect(profile).not.toContain('OrnateFrame');
    expect(profile).not.toContain('PixelText');
    expect(profile).not.toContain('AchievementGrid');
    expect(profile).not.toContain('LaurelHeader');
    expect(profile).not.toContain('SceneBackground');
    expect(profile).not.toContain('LevelXpBar');
  });

  test('Profile does not derive achievements or KOM claims from ride counters', () => {
    const profile = read('screens/AthleteProfileScreen.tsx');

    expect(profile).toContain('profile-achievements-unavailable');
    expect(profile).toContain('t.profile.achievementsUnavailable');
    expect(profile).not.toContain("label: '100 KM'");
    expect(profile).not.toContain("label: 'KOM'");
    expect(profile).not.toContain('1000 KCAL');
    expect(profile).not.toContain('PASJA');
    expect(profile).not.toContain('verified >= 1');
    expect(profile).not.toContain('displayRides - displayVerified');
  });

  test('Profile keeps account and ride failure states explicit', () => {
    const profile = read('screens/AthleteProfileScreen.tsx');

    expect(profile).toContain('profile-load-error');
    expect(profile).toContain('profile-stats-error');
    expect(profile).toContain('profile-stats-offline');
    expect(profile).toContain('profile-retry');
    expect(profile).toContain('profile-stats-retry');
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
