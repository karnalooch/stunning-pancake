import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = readFileSync(
  resolve(__dirname, '../../src/screens/RideDashboardScreen.tsx'),
  'utf8',
);

describe('T79 Home visual contract', () => {
  test('uses the Frozen UI product primitives', () => {
    expect(source).toContain('PrimaryButton');
    expect(source).toContain('ProductCard');
    expect(source).toContain('SportChip');
    expect(source).toContain('Metric');
    expect(source).toContain('getSemanticColors');
  });

  test('does not restore legacy arcade or generated-art Home chrome', () => {
    for (const forbidden of [
      'ArcadeButton',
      'GameCard',
      'SceneBackground',
      'CyclistSprite',
      'DailyQuestCard',
      'LevelXpBar',
      'StreakBadge',
      'RiderAvatar',
      'FONTS.display',
    ]) {
      expect(source).not.toContain(forbidden);
    }
  });

  test('keeps deterministic state hooks for visual review', () => {
    for (const testId of [
      'home-start-ride',
      'home-go-to-ride',
      'home-stats-error',
      'home-first-use-empty',
      'home-weekly-context',
      'home-week-distance',
    ]) {
      expect(source).toContain(testId);
    }
  });

  test('distinguishes hard history failure from a legitimate empty history', () => {
    expect(source).toContain('error: statsError');
    expect(source).toContain('refresh: refreshStats');
    expect(source).toContain('displayStatsError');
    expect(source).toContain('home-stats-retry');
  });
});
