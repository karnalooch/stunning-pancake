/**
 * GPS quality filter unit tests (ADR 011).
 */
import {
  acceptGpsPoint,
  createGpsFilterState,
  evaluateGpsPoint,
  DEFAULT_GPS_FILTER_PROFILE,
} from '../../src/services/gpsQualityFilter';
import type { GpsPoint } from '../../src/services/gpsSyncStorage';

function point(
  ts: number,
  lat: number,
  lon: number,
  accuracy = 10,
  speed = 5,
): GpsPoint {
  return {
    device_id: 'd1',
    user_id: 1,
    activity_id: 99,
    lat,
    lon,
    altitude_m: 0,
    speed_ms: speed,
    accuracy_m: accuracy,
    timestamp: ts,
    seq: 1,
    idempotency_key: `99:${ts}:1`,
  };
}

describe('gpsQualityFilter', () => {
  test('rejects poor accuracy', () => {
    const state = createGpsFilterState();
    const r = evaluateGpsPoint(point(100, 52, 21, 200), state);
    expect(r.accept).toBe(false);
    expect(r.reason).toBe('accuracy');
  });

  test('rejects non-monotonic timestamps', () => {
    const state = createGpsFilterState();
    acceptGpsPoint(point(100, 52, 21), state);
    const r = evaluateGpsPoint(point(99, 52.001, 21.001), state);
    expect(r.accept).toBe(false);
    expect(r.reason).toBe('monotonic_time');
  });

  test('rejects impossible speed spike', () => {
    const state = createGpsFilterState();
    acceptGpsPoint(point(100, 52.0, 21.0), state);
    const r = evaluateGpsPoint(point(110, 53.5, 22.0), state);
    expect(r.accept).toBe(false);
    expect(r.reason).toBe('max_speed');
  });

  test('marks segment break after long gap', () => {
    const state = createGpsFilterState();
    const profile = { ...DEFAULT_GPS_FILTER_PROFILE, gapBreakS: 60 };
    acceptGpsPoint(point(100, 52, 21), state, profile);
    const r = evaluateGpsPoint(point(200, 52.0001, 21.0001), state, profile);
    expect(r.accept).toBe(true);
    expect(r.segmentBreak).toBe(true);
  });
});
