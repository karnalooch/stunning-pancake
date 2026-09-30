import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '../../src');

function source(relative: string): string {
  return fs.readFileSync(path.join(ROOT, relative), 'utf8');
}

describe('deterministic Ride vertical slice contract', () => {
  test('critical surfaces expose stable automation ids', () => {
    const startRide = source('screens/StartRideScreen.tsx');
    expect(startRide).toContain('testID="start-ride-primary"');
    expect(startRide).toContain('disabled={isStarting}');

    expect(source('screens/RideDashboardScreen.tsx')).toContain(
      'testID="home-open-start-ride"',
    );

    const active = source('screens/ActiveRideHUDScreen.tsx');
    const actions = source('components/ride/RideActionBar.tsx');
    const paused = source('components/ride/RidePausedOverlay.tsx');

    expect(active).toContain('testID="active-ride-screen"');
    expect(active).toContain('testID="active-ride-map"');
    expect(active).toContain('testID="active-ride-metrics"');
    expect(active).toContain('<RidePausedOverlay');

    expect(actions).toContain("pauseTestID = 'ride-pause-button'");
    expect(actions).toContain("stopTestID = 'ride-stop-button'");

    expect(paused).toContain('testID="ride-paused-overlay"');
    expect(paused).toContain('resumeTestID="ride-paused-resume"');
    expect(paused).toContain('stopTestID="ride-paused-stop"');

    const summary = source('screens/RideSummaryScreen.tsx');
    expect(summary).toContain('testID="ride-summary-screen"');
    expect(summary).toContain('testID="ride-summary-share"');
    expect(summary).toContain('testID="ride-summary-back-home"');
  });

  test('pause remains inside the Tracking experience rather than navigation', () => {
    const navigation = source('bootstrap/NavigationShell.tsx');
    const types = source('navigation/types.ts');
    const routes = source('navigation/routeContract.ts');

    expect(navigation).toContain("screen: 'Tracking'");
    expect(navigation).toContain('onPause={() => void onPauseRide()}');
    expect(navigation).toContain('onResume={() => void onResumeRide()}');
    expect(navigation).not.toContain("navigate('RidePaused')");
    expect(navigation).not.toContain('name="RidePaused"');
    expect(types).not.toContain('RidePaused:');
    expect(routes).not.toContain('ridePaused:');
  });

  test('finish still routes from domain terminal truth to Summary and Today', () => {
    const navigation = source('bootstrap/NavigationShell.tsx');

    expect(navigation).toContain("navigate('RideSummary', rideFinishState)");
    expect(navigation).toContain('setRideFinishState(null)');
    expect(navigation).toContain("screen: 'Today'");
  });

  test('vision mode uses the deterministic controller at composition root', () => {
    const root = source('app/AppRoot.tsx');

    expect(root).toContain(
      'isVisionFixtures() ? <DeterministicRideRoot /> : <ProductionRideRoot />',
    );
    expect(root).toContain('useDeterministicRideController');
    expect(root).toContain('useProductionRideController');
  });
});
