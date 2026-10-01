import fs from 'fs';
import path from 'path';
const source = (file: string) => fs.readFileSync(path.resolve(__dirname, '../../src', file), 'utf8');

describe('Roadbook live ride presentation boundary', () => {
  test.each(['components/ride/DataFieldCell.tsx', 'components/ride/RideStatusBar.tsx', 'components/ride/RideNavigationHint.tsx',
    'components/ride/RideActionBar.tsx', 'screens/RidePausedScreen.tsx'])('%s excludes pixel typography', (file) => {
    const text = source(file); expect(text).not.toContain('FONTS.display'); expect(text).not.toContain("fontFamily: 'VT323'");
  });
  test('one live screen renders map/instruments, status, controls and safe areas', () => {
    const hud = source('screens/ActiveRideHUDScreen.tsx');
    for (const marker of ['<RideMapView', '<RideStatusBar', '<RideActionBar', '<RidePausedScreen',
      'testID="active-ride-map"', 'testID="active-ride-metrics"', "edges={['top', 'bottom']}", 'setMode(value)']) expect(hud).toContain(marker);
    for (const forbidden of ['startTracking(', 'stopTracking(', 'createRideController(', 'toggleEdit']) expect(hud).not.toContain(forbidden);
  });
  test('stop is protected and can be explicitly confirmed by assistive technology', () => {
    const actions = source('components/ride/RideActionBar.tsx');
    for (const marker of ['const STOP_HOLD_MS = 900', 'onPressIn={startStopHold}', 'onPressOut={cancelHold}',
      'confirmAccessibleFinish', 'Alert.alert', 'locked.current', 'minHeight: 60', 'minHeight: 48']) expect(actions).toContain(marker);
  });
  test('paused presentation is an accessible bounded overlay, not a navigation destination', () => {
    const paused = source('screens/RidePausedScreen.tsx');
    for (const marker of ["position: 'absolute'", 'accessibilityViewIsModal', "maxHeight: '78%'",
      'resumeTestID="ride-paused-resume"', 'stopTestID="ride-paused-stop"']) expect(paused).toContain(marker);
    expect(source('bootstrap/NavigationShell.tsx')).not.toContain('<Stack.Screen name="RidePaused"');
  });
});
