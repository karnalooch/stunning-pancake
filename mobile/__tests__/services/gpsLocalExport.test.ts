/**
 * Local GPX export unit tests (ADR 011 §16).
 */

import { buildGeoJsonLineString, buildGpx11 } from '../../src/services/gpsLocalExport';
import type { GpsPoint } from '../../src/services/gpsSyncStorage';

const samplePoints = (): GpsPoint[] => [
  {
    device_id: 'dev-1',
    user_id: 1,
    activity_id: 99,
    lat: 52.2297,
    lon: 21.0122,
    altitude_m: 110,
    speed_ms: 2,
    accuracy_m: 5,
    timestamp: 1_700_000_000_000,
    seq: 1,
  },
  {
    device_id: 'dev-1',
    user_id: 1,
    activity_id: 99,
    lat: 52.2301,
    lon: 21.0128,
    altitude_m: 112,
    speed_ms: 3,
    accuracy_m: 4,
    timestamp: 1_700_000_030_000,
    seq: 2,
  },
];

describe('gpsLocalExport', () => {
  test('buildGpx11 emits GPX 1.1 with ordered trkpts', () => {
    const gpx = buildGpx11(samplePoints(), { trackName: 'Test Ride' });
    expect(gpx).toContain('<?xml version="1.0"');
    expect(gpx).toContain('xmlns="http://www.topografix.com/GPX/1/1"');
    expect(gpx).toContain('<name>Test Ride</name>');
    expect(gpx).toContain('lat="52.229700"');
    expect(gpx).toContain('lat="52.230100"');
    expect(gpx).toMatch(/<trkpt[\s\S]*<\/trkpt>/);
  });

  test('buildGpx11 rejects fewer than two points', () => {
    expect(() => buildGpx11([samplePoints()[0]])).toThrow(/at least two/);
  });

  test('buildGeoJsonLineString sorts by timestamp', () => {
    const pts = samplePoints().reverse();
    const raw = buildGeoJsonLineString(pts);
    const geo = JSON.parse(raw) as {
      geometry: { coordinates: number[][] };
      properties: { point_count: number };
    };
    expect(geo.properties.point_count).toBe(2);
    expect(geo.geometry.coordinates[0][0]).toBeCloseTo(21.0122, 4);
    expect(geo.geometry.coordinates[1][0]).toBeCloseTo(21.0128, 4);
  });
});
