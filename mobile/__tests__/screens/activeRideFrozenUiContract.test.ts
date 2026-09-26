import fs from 'fs';
import path from 'path';

const SRC = path.resolve(__dirname, '../../src');

function source(relative: string): string {
  return fs.readFileSync(path.join(SRC, relative), 'utf8');
}

describe('Frozen UI v1.2 Active Ride contract', () => {
  const modernRideChrome = [
    'components/ride/DataFieldCell.tsx',
    'components/ride/RideStatusBar.tsx',
    'components/ride/RideNavigationHint.tsx',
    'components/ride/RideActionBar.tsx',
    'screens/RidePausedScreen.tsx',
  ];

  test.each(modernRideChrome)('%s uses product typography, not legacy pixel fonts', (file) => {
    const text = source(file);
    expect(text).not.toContain('FONTS.display');
    expect(text).not.toContain("fontFamily: 'VT323'");
  });

  test('live HUD keeps map/data/controller behavior and safe areas', () => {
    const hud = source('screens/ActiveRideHUDScreen.tsx');

    expect(hud).toContain('<RideMapView');
    expect(hud).toContain('<RideStatusBar');
    expect(hud).toContain('<DataFieldGrid metrics={metrics} hudMode');
    expect(hud).toContain('<RideActionBar');
    expect(hud).toContain("edges={['top', 'bottom']}");
  });

  test('stop remains protected and pause remains a large direct action', () => {
    const actions = source('components/ride/RideActionBar.tsx');

    expect(actions).toContain('const STOP_HOLD_MS = 900');
    expect(actions).toContain('onPressIn={startStopHold}');
    expect(actions).toContain('onPressOut={clearStopTimer}');
    expect(actions).toContain('testID="ride-stop-button"');
    expect(actions).toContain('testID="ride-pause-button"');
    expect(actions).toContain('minHeight: 56');
  });

  test('metric presentation uses semantic product typography', () => {
    const fields = source('components/ride/DataFieldCell.tsx');

    expect(fields).toContain('PRODUCT_TYPOGRAPHY.metric');
    expect(fields).toContain('PRODUCT_TYPOGRAPHY.metricLabel');
    expect(fields).toContain('fontSize: 48');
  });
});
