import fs from 'fs';
import path from 'path';

const SRC = path.resolve(__dirname, '../../src');

function source(relative: string): string {
  return fs.readFileSync(path.join(SRC, relative), 'utf8');
}

describe('semantic Ride pause/resume architecture', () => {
  test('public controller exposes commands instead of mutable pause setter', () => {
    const controller = source('features/ride/controller/RideController.ts');
    const bridge = source('app/navigation/LegacyNavigationBridge.tsx');

    expect(controller).toContain('pause: () => Promise<void>');
    expect(controller).toContain('resume: () => Promise<void>');
    expect(controller).not.toContain('setRidePaused:');

    expect(bridge).toContain('onPauseRide={ride.pause}');
    expect(bridge).toContain('onResumeRide={ride.resume}');
    expect(bridge).not.toContain('ride.setRidePaused');
  });

  test('production lifecycle delegates pause and resume to the durable session layer', () => {
    const lifecycle = source('bootstrap/useRideLifecycle.ts');
    const session = source('services/rideSessionService.ts');

    expect(lifecycle).toContain('await pauseRideSession(userIdRef.current)');
    expect(lifecycle).toContain('await resumeRideSession(userIdRef.current)');
    expect(lifecycle).toContain("setRidePaused(getRideSessionPhase() === 'paused')");

    expect(session).toContain('manager.pauseTracking()');
    expect(session).toContain('manager.resumeTracking()');
    expect(session).toContain('getPersistedRidePhase()');
  });

  test('GPS producer fails closed while paused and ride clock excludes pause intervals', () => {
    const gps = source('services/GpsSyncManager.ts');

    expect(gps).toContain("getPersistedRidePhaseFromState(state) === 'paused'");
    expect(gps).toContain("ridePhase: 'paused'");
    expect(gps).toContain("ridePhase: 'active'");
    expect(gps).toContain('pausedDurationMs');
    expect(gps).toContain('pauseStartedAtMs');
    expect(gps).toContain('completedPauseMs');
    expect(gps).toContain('openPauseMs');
    expect(gps).toContain('resetFilterStateForActivity');
  });

  test('relaunch preserves PAUSED without restarting the native producer', () => {
    const gps = source('services/GpsSyncManager.ts');

    expect(gps).toContain("if (phase === 'paused')");
    expect(gps).toContain('Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME)');
    expect(gps).toContain("logGpsBackgroundProof('RESUMED'");
    expect(gps).toContain('phase,');
  });

  test('presentation keeps pause inside the same Active Ride surface', () => {
    const hud = source('screens/ActiveRideHUDScreen.tsx');
    const navigation = source('bootstrap/NavigationShell.tsx');

    expect(hud).toContain('<RidePausedOverlay');
    expect(hud).toContain('testID="active-ride-map"');
    expect(hud).toContain('testID="active-ride-metrics"');
    expect(navigation).not.toContain("navigate('RidePaused')");
    expect(navigation).not.toContain('name="RidePaused"');
  });
});
