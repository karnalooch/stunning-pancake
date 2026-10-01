import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const screen = (name: string) => readFileSync(resolve(__dirname, `../../src/screens/${name}.tsx`), 'utf8');
const today = screen('RideDashboardScreen');
const startRide = screen('StartRideScreen');
const surface = readFileSync(resolve(__dirname, '../../src/components/roadbook/Surface.tsx'), 'utf8');

describe('Product UX v2 Today context contract', () => {
  test('Today uses semantic Roadbook sections without owning ride setup', () => {
    expect(today).toContain('PrimaryButton');
    expect(today).toContain('RoadbookPage');
    expect(today).toContain('RoadbookSection');
    expect(today).toContain('Metric');
    expect(surface).toContain('getSemanticColors');
    expect(surface).toContain('PRODUCT_TYPOGRAPHY');
    for (const preparation of ['SportChip', 'ACTIVITY_SPORT_OPTIONS', 'selectedSport', 'onStartRide', 'GpsRecoveryBanner', 'startRideError']) expect(today).not.toContain(preparation);
  });
  test('does not restore legacy arcade or generated-art Today chrome', () => {
    for (const forbidden of ['ArcadeButton', 'GameCard', 'SceneBackground', 'CyclistSprite', 'DailyQuestCard', 'LevelXpBar', 'StreakBadge', 'RiderAvatar', 'FONTS.display']) expect(today).not.toContain(forbidden);
  });
  test('keeps deterministic Today state hooks for visual review', () => {
    for (const testId of ['home-open-start-ride', 'home-go-to-ride', 'home-stats-error', 'home-stats-offline', 'home-first-use-empty', 'home-weekly-context', 'home-week-distance']) expect(today).toContain(testId);
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
    for (const position of [rideEntry, weeklyPreview, lastRide]) expect(position).toBeGreaterThanOrEqual(0);
    expect(rideEntry).toBeLessThan(weeklyPreview);
    expect(weeklyPreview).toBeLessThan(lastRide);
    expect(today).not.toContain('home-gps-check');
    expect(today).not.toContain('home-sport-');
  });
  test('Start Ride exclusively owns sport selection and pre-ride recovery/error UI', () => {
    for (const marker of ['SportChip', 'ACTIVITY_SPORT_OPTIONS', 'start-ride-primary', 'GpsRecoveryBanner', 'startRideError', 'start-ride-gps-diagnostics']) expect(startRide).toContain(marker);
    // Behavioral locking is covered by startRideRoadbook and rideStartCommand.
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
