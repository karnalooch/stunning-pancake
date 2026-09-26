import fs from 'fs';
import path from 'path';

const SRC = path.resolve(__dirname, '../../src');
const read = (relative: string) => fs.readFileSync(path.join(SRC, relative), 'utf8');

describe('T82 History + Activity Detail data contract', () => {
  test('mobile API uses backend detail endpoint and numeric duration', () => {
    const api = read('services/api.ts');
    const paths = fs.readFileSync(
      path.resolve(__dirname, '../../../packages/api-client/src/paths.ts'),
      'utf8',
    );

    expect(api).toContain('duration: number | null');
    expect(api).toContain('getDetail: (activityId: number)');
    expect(api).toContain('mobileActivityPaths.sessionDetail(activityId)');
    expect(paths).toContain('sessionDetail: (activityId: number)');
    expect(paths).toContain('/detail/');
  });

  test('Activity Detail renders the canonical route instead of a placeholder', () => {
    const detail = read('screens/ActivityDetailScreen.tsx');

    expect(detail).toContain('ActivityService.getDetail(activityId)');
    expect(detail).toContain('detail?.route_coords');
    expect(detail).toContain('<RideMapView');
    expect(detail).toContain('routeCoordinates={routeCoordinates}');
    expect(detail).toContain('showRiderMarker={false}');
    expect(detail).not.toContain('achievementKomName');
    expect(detail).not.toContain('achievementPrName');
    expect(detail).not.toContain('routePreview');
    expect(detail).not.toContain('setAvgSpeed(0)');
  });

  test('Training Log distinguishes API failure from a genuinely empty history', () => {
    const history = read('screens/TrainingLogScreen.tsx');

    expect(history).toContain('setLoadError(true)');
    expect(history).toContain('t.training.loadError');
    expect(history).toContain('training-log-retry');
    expect(history).toContain('OfflineCacheService.getHistory()');
    expect(history).toContain('OfflineCacheService.setHistory(list)');
  });
});
