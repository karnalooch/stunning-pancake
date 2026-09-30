import fs from 'fs';
import path from 'path';

const SRC = path.resolve(__dirname, '../../src');

function source(relative: string): string {
  return fs.readFileSync(path.join(SRC, relative), 'utf8');
}

describe('Active Ride composition contract', () => {
  const modernRideChrome = [
    'components/ride/DataFieldCell.tsx',
    'components/ride/RideStatusBar.tsx',
    'components/ride/RideNavigationHint.tsx',
    'components/ride/RideActionBar.tsx',
    'components/ride/RidePausedOverlay.tsx',
  ];

  test.each(modernRideChrome)('%s uses product typography, not legacy pixel fonts', (file) => {
    const text = source(file);
    expect(text).not.toContain('FONTS.display');
    expect(text).not.toContain("fontFamily: 'VT323'");
  });

  test('live HUD keeps map/data/control planes and safe areas', () => {
    const hud = source('screens/ActiveRideHUDScreen.tsx');

    expect(hud).toContain('<RideMapView');
    expect(hud).toContain('<RideStatusBar');
    expect(hud).toContain('<DataFieldGrid metrics={metrics} hudMode');
    expect(hud).toContain('<RideActionBar');
    expect(hud).toContain('<RidePausedOverlay');
    expect(hud).toContain('testID="active-ride-map"');
    expect(hud).toContain('testID="active-ride-metrics"');
    expect(hud).toContain("edges={['top', 'bottom']}");
  });

  test('active recording cannot enter field editor and pause stays primary', () => {
    const grid = source('components/ride/DataFieldGrid.tsx');
    const actions = source('components/ride/RideActionBar.tsx');

    expect(grid).toContain('onLongPress={hudMode ? undefined : toggleEdit}');
    expect(actions.indexOf('testID={pauseTestID}')).toBeLessThan(
      actions.indexOf('testID={stopTestID}'),
    );
    expect(actions).toContain('styles.primaryAction');
    expect(actions).toContain('const STOP_HOLD_MS = 900');
    expect(actions).toContain('onPressIn={startStopHold}');
    expect(actions).toContain('onPressOut={clearStopTimer}');
  });

  test('paused state is an overlay on the same Ride, not a screen', () => {
    const hud = source('screens/ActiveRideHUDScreen.tsx');
    const overlay = source('components/ride/RidePausedOverlay.tsx');

    expect(hud).toContain('{isPaused ? (');
    expect(overlay).toContain('testID="ride-paused-overlay"');
    expect(overlay).toContain('<RideActionBar');
    expect(overlay).toContain('resumeTestID="ride-paused-resume"');
    expect(overlay).toContain('stopTestID="ride-paused-stop"');
    expect(fs.existsSync(path.join(SRC, 'screens/RidePausedScreen.tsx'))).toBe(false);
  });

  test('metric presentation uses semantic product typography', () => {
    const fields = source('components/ride/DataFieldCell.tsx');

    expect(fields).toContain('PRODUCT_TYPOGRAPHY.metric');
    expect(fields).toContain('PRODUCT_TYPOGRAPHY.metricLabel');
    expect(fields).toContain('fontSize: 48');
  });
});
