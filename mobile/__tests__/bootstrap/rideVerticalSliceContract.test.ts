import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '../../src');

function source(relative: string): string {
  return fs.readFileSync(path.join(ROOT, relative), 'utf8');
}

describe('T80-D deterministic Ride vertical slice contract', () => {
  test('critical screens expose stable automation ids', () => {
    expect(source('screens/RideDashboardScreen.tsx')).toContain(
      'testID="home-start-ride"',
    );

    const active = source('screens/ActiveRideHUDScreen.tsx');
    const actions = source('components/ride/RideActionBar.tsx');
    expect(active).toContain('testID="active-ride-screen"');
    expect(actions).toContain('testID="ride-pause-button"');
    expect(actions).toContain('testID="ride-stop-button"');

    const paused = source('screens/RidePausedScreen.tsx');
    expect(paused).toContain('testID="ride-paused-screen"');
    expect(paused).toContain('testID="ride-paused-resume"');
    expect(paused).toContain('testID="ride-paused-stop"');

    const summary = source('screens/RideSummaryScreen.tsx');
    expect(summary).toContain('testID="ride-summary-screen"');
    expect(summary).toContain('testID="ride-summary-share"');
    expect(summary).toContain('testID="ride-summary-back-home"');
  });

  test('navigation owns the complete Ride slice transitions', () => {
    const navigation = source('bootstrap/NavigationShell.tsx');

    expect(navigation).toContain("screen: 'Tracking'");
    expect(navigation).toContain("navigate('RidePaused')");
    expect(navigation).toContain("navigate('RideSummary', rideFinishState)");
    expect(navigation).toContain('setRideFinishState(null)');
    expect(navigation).toContain("screen: 'Ride'");
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
