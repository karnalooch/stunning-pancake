/**
 * Local GPX 1.1 / GeoJSON snapshot on ride stop (ADR 011 §16).
 * Optional artefact in app document directory before buffer clear.
 */

import type { GpsPoint } from './gpsSyncStorage';

export function buildGpx11(
  points: GpsPoint[],
  options?: { trackName?: string; activityType?: string },
): string {
  if (points.length < 2) {
    throw new Error('GPX requires at least two track points');
  }
  const sorted = [...points].sort((a, b) => a.timestamp - b.timestamp);
  const trackName = options?.trackName ?? '4VELO Activity';
  const activityType = options?.activityType ?? 'other';
  const startIso = new Date(sorted[0].timestamp).toISOString().replace(/\.\d{3}Z$/, 'Z');

  const trkpts = sorted
    .map((p) => {
      const time = new Date(p.timestamp).toISOString().replace(/\.\d{3}Z$/, 'Z');
      const ele =
        p.altitude_m != null && Number.isFinite(p.altitude_m)
          ? `\n        <ele>${p.altitude_m.toFixed(1)}</ele>`
          : '';
      return `      <trkpt lat="${p.lat.toFixed(6)}" lon="${p.lon.toFixed(6)}">${ele}
        <time>${time}</time>
      </trkpt>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="4VELO" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>${escapeXml(trackName)}</name>
    <time>${startIso}</time>
  </metadata>
  <trk>
    <name>${escapeXml(trackName)}</name>
    <type>${escapeXml(activityType)}</type>
    <trkseg>
${trkpts}
    </trkseg>
  </trk>
</gpx>`;
}

export function buildGeoJsonLineString(points: GpsPoint[]): string {
  const sorted = [...points].sort((a, b) => a.timestamp - b.timestamp);
  const coordinates = sorted.map((p) => [p.lon, p.lat, p.altitude_m ?? 0]);
  return JSON.stringify(
    {
      type: 'Feature',
      properties: {
        activity_id: sorted[0]?.activity_id ?? null,
        point_count: sorted.length,
        exported_at: new Date().toISOString(),
      },
      geometry: { type: 'LineString', coordinates },
    },
    null,
    0,
  );
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export interface LocalRideSnapshotResult {
  gpxPath: string;
  geoJsonPath?: string;
}

/** Write GPX (+ optional GeoJSON) under documentDirectory/gps-snapshots/. */
export async function saveLocalRideSnapshot(
  activityId: number,
  points: GpsPoint[],
): Promise<LocalRideSnapshotResult | null> {
  if (points.length < 2) return null;
  try {
    const FileSystem = await import('expo-file-system');
    const dir = `${FileSystem.documentDirectory}gps-snapshots`;
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const base = `${dir}/activity-${activityId}-${stamp}`;
    const gpxPath = `${base}.gpx`;
    const geoJsonPath = `${base}.geojson`;
    await FileSystem.writeAsStringAsync(gpxPath, buildGpx11(points), {
      encoding: FileSystem.EncodingType.UTF8,
    });
    await FileSystem.writeAsStringAsync(geoJsonPath, buildGeoJsonLineString(points), {
      encoding: FileSystem.EncodingType.UTF8,
    });
    return { gpxPath, geoJsonPath };
  } catch (err) {
    console.warn('[gpsLocalExport] snapshot skipped:', err);
    return null;
  }
}
