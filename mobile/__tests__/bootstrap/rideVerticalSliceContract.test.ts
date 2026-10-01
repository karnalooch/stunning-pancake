import fs from 'fs';
import path from 'path';
const ROOT = path.resolve(__dirname, '../../src');
function source(relative: string): string { return fs.readFileSync(path.join(ROOT, relative), 'utf8'); }

describe('T80-D deterministic Ride vertical slice contract', () => {
  test('critical screens expose stable automation ids', () => {
    const startRide = source('screens/StartRideScreen.tsx');
    expect(startRide).toContain('testID="start-ride-primary"');
    expect(startRide).toContain('disabled={isStarting}');
    expect(source('screens/RideDashboardScreen.tsx')).toContain('testID="home-open-start-ride"');
    const active = source('screens/ActiveRideHUDScreen.tsx');
    const actions = source('components/ride/RideActionBar.tsx');
    expect(active).toContain('testID="active-ride-screen"');
    expect(actions).toContain("pauseTestID = 'ride-pause-button'");
    expect(actions).toContain("stopTestID = 'ride-stop-button'");
    const paused = source('screens/RidePausedScreen.tsx');
    expect(paused).toContain('testID="ride-paused-screen"');
    expect(paused).toContain('resumeTestID="ride-paused-resume"');
    expect(paused).toContain('stopTestID="ride-paused-stop"');
    const summary = source('screens/RideSummaryScreen.tsx');
    for (const id of ['ride-summary-screen', 'ride-summary-share', 'ride-summary-back-home']) expect(summary).toContain(`testID="${id}"`);
  });
  test('navigation owns the complete Ride flow outside the four content tabs', () => {
    const navigation = source('bootstrap/NavigationShell.tsx');
    expect(navigation).toContain("navigate('Tracking')");
    expect(navigation).toContain('<Stack.Screen name="Tracking"');
    expect(navigation).toContain('<Stack.Screen name="StartRide"');
    expect(navigation).not.toContain('<Tab.Screen name="Tracking"');
    expect(navigation).not.toContain('<Tab.Screen name="StartRide"');
    expect(navigation).toContain('onPauseRide');
    expect(navigation).toContain('onResumeRide');
    expect(navigation).not.toContain("navigate('RidePaused')");
    expect(source('screens/ActiveRideHUDScreen.tsx')).toContain('<RidePausedScreen');
    expect(navigation).toContain("navigate('RideSummary', rideFinishState)");
    expect(navigation).toContain('setRideFinishState(null)');
    expect(navigation).toContain("screen: 'Today'");
  });
  test('vision mode uses the deterministic controller at composition root', () => {
    const root = source('app/AppRoot.tsx');
    expect(root).toContain('isVisionFixtures() ? <DeterministicRideRoot /> : <ProductionRideRoot />');
    expect(root).toContain('useDeterministicRideController');
    expect(root).toContain('useProductionRideController');
  });
});
