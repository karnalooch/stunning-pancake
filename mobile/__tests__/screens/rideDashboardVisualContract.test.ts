import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const screen = (name: string) =>
  readFileSync(resolve(__dirname, `../../src/screens/${name}.tsx`), 'utf8');

const today = screen('RideDashboardScreen');
const startRide = screen('StartRideScreen');

describe('Product UX v2 Today context contract', () => {
  test('Today uses product primitives without owning ride setup', () => {
    expect(today).toContain('PrimaryButton');
    expect(today).toContain('ProductCard');
    expect(today).toContain('Metric');
    expect(today).toContain('getSemanticColors');

    expect(today).not.toContain('SportChip');
    expect(today).not.toContain('ACTIVITY_SPORT_OPTIONS');
    expect(today).not.toContain('selectedSport');
    expect(today).not.toContain('onStartRide');
    expect(today).not.toContain('GpsRecoveryBanner');
    expect(today).not.toContain('startRideError');
  });

  test('does not restore legacy arcade or generated-art Today chrome', () => {
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
      expect(today).not.toContain(forbidden);
    }
  });

  test('keeps deterministic Today state hooks for visual review', () => {
    for (const testId of [
      'home-open-start-ride',
      'home-go-to-ride',
      'home-stats-error',
      'home-stats-offline',
      'home-first-use-empty',
      'home-weekly-context',
      'home-week-distance',
    ]) {
      expect(today).toContain(testId);
    }
  });

  test('supports the five deterministic Today review states', () => {
    expect(today).toContain('getVisionHomePreviewState');
    expect(today).toContain("effectivePreviewState === 'loading'");
    expect(today).toContain("effectivePreviewState === 'empty'");
    expect(today).toContain("effectivePreviewState === 'offline'");
    expect(today).toContain("effectivePreviewState === 'error'");
  });

  test('keeps Today hierarchy focused on context rather than pre-ride configuration', () => {
    const rideEntry = today.indexOf('testID="home-open-start-ride"');
    const weeklyPreview = today.indexOf('testID="home-weekly-context"');
    const lastRide = today.indexOf('testID="home-last-ride-distance"');

    for (const position of [rideEntry, weeklyPreview, lastRide]) {
      expect(position).toBeGreaterThanOrEqual(0);
    }

    expect(rideEntry).toBeLessThan(weeklyPreview);
    expect(weeklyPreview).toBeLessThan(lastRide);
    expect(today).not.toContain('home-gps-check');
    expect(today).not.toContain('home-sport-');
  });

  test('Start Ride exclusively owns sport selection and pre-ride recovery/error UI', () => {
    expect(startRide).toContain('SportChip');
    expect(startRide).toContain('ACTIVITY_SPORT_OPTIONS');
    expect(startRide).toContain('start-ride-primary');
    expect(startRide).toContain('GpsRecoveryBanner');
    expect(startRide).toContain('startRideError');
    expect(startRide).toContain('start-ride-gps-diagnostics');
    // The async contract is structural; double-press/busy/retry behavior is exercised
    // in startRideRoadbook.test.tsx and bootstrap/rideStartCommand.test.ts.
    // Do not require the old state-only guard, which cannot lock before a render.
    expect(startRide).toContain('onStartRide: (sport: ActivitySportType) => Promise<void>');
    expect(startRide).toContain('await onStartRide(selectedSport)');
    expect(startRide).toContain('disabled={isStarting}');
    expect(startRide).toContain('t.dashboard.startingRide');
  });

  test('refreshes rider history when Today regains focus', () => {
    expect(today).toContain('useFocusEffect');
    expect(today).toContain('hasFocusedHome');
    expect(today).toContain('void refreshStats()');
  });

  test('distinguishes hard history failure from a legitimate empty history', () => {
    expect(today).toContain('error: statsError');
    expect(today).toContain('refresh: refreshStats');
    expect(today).toContain('displayStatsError');
    expect(today).toContain('home-stats-retry');
  });
});
