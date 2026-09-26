import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '../../src');

function source(relative: string): string {
  return fs.readFileSync(path.join(ROOT, relative), 'utf8');
}

describe('AppRoot ride-controller architecture', () => {
  test('AppRoot selects separate production and deterministic component roots', () => {
    const appRoot = source('app/AppRoot.tsx');

    expect(appRoot).toContain('isVisionFixtures() ? <DeterministicRideRoot /> : <ProductionRideRoot />');
    expect(appRoot).toContain('useProductionRideController');
    expect(appRoot).toContain('useDeterministicRideController');
  });

  test('deterministic controller has no production GPS/API/storage dependencies', () => {
    const deterministic = source(
      'features/ride/controller/useDeterministicRideController.ts',
    );

    for (const forbidden of [
      'useRideLifecycle',
      'GpsSyncManager',
      'ActivityService',
      'MMKV',
      'SecureStore',
      'rideSessionService',
    ]) {
      expect(deterministic).not.toContain(forbidden);
    }
  });

  test('App.tsx is only the provider shell', () => {
    const app = source('../App.tsx');

    expect(app).toContain('<AppRoot />');
    expect(app).not.toContain('useRideLifecycle');
    expect(app).not.toContain('NavigationShell');
  });
});
