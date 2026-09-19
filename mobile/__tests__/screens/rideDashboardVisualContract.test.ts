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
      'home-stats-offline',
      'home-first-use-empty',
      'home-weekly-context',
      'home-week-distance',
    ]) {
      expect(source).toContain(testId);
    }
  });

  test('supports the five deterministic Home review states', () => {
    expect(source).toContain('getVisionHomePreviewState');
    expect(source).toContain("effectivePreviewState === 'loading'");
    expect(source).toContain("effectivePreviewState === 'empty'");
    expect(source).toContain("effectivePreviewState === 'offline'");
    expect(source).toContain("effectivePreviewState === 'error'");
  });

  test('keeps the Frozen UI T79 above-fold hierarchy in source order', () => {
    const startRide = source.indexOf('testID="home-start-ride"');
    const sportSelector = source.indexOf('testID={`home-sport-${option.type.toLowerCase()}`}');
    const weeklyPreview = source.indexOf('testID="home-weekly-context"');
    const gpsCheck = source.indexOf('testID="home-gps-check"');
    const lastRide = source.indexOf('testID="home-last-ride-distance"');

    for (const position of [startRide, sportSelector, weeklyPreview, gpsCheck, lastRide]) {
      expect(position).toBeGreaterThanOrEqual(0);
    }

    expect(startRide).toBeLessThan(sportSelector);
    expect(sportSelector).toBeLessThan(weeklyPreview);
    expect(weeklyPreview).toBeLessThan(gpsCheck);
    expect(gpsCheck).toBeLessThan(lastRide);
  });

  test('refreshes rider history when Home regains focus', () => {
    expect(source).toContain('useFocusEffect');
    expect(source).toContain('hasFocusedHome');
    expect(source).toContain('void refreshStats()');
  });

  test('distinguishes hard history failure from a legitimate empty history', () => {
    expect(source).toContain('error: statsError');
    expect(source).toContain('refresh: refreshStats');
    expect(source).toContain('displayStatsError');
    expect(source).toContain('home-stats-retry');
  });
});
