/** Haversine distance in meters between two WGS84 points. */
function segmentMeters(lon1: number, lat1: number, lon2: number, lat2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export interface SpeedPoint {
  index: number;
  km: number;
  speedKmh: number;
}

/** Estimate speed profile from route coords + total duration (seconds). */
export function buildSpeedProfile(
  coords: Array<[number, number]>,
  durationSeconds?: number | null,
): SpeedPoint[] {
  if (coords.length < 2) return [];

  const segMeters: number[] = [];
  let totalM = 0;
  for (let i = 1; i < coords.length; i += 1) {
    const m = segmentMeters(coords[i - 1][0], coords[i - 1][1], coords[i][0], coords[i][1]);
    segMeters.push(m);
    totalM += m;
  }

  const secPerSeg =
    durationSeconds && durationSeconds > 0
      ? durationSeconds / segMeters.length
      : totalMeters > 0
        ? (totalM / 3.5) / segMeters.length
        : 60;

  const points: SpeedPoint[] = [{ index: 0, km: 0, speedKmh: 0 }];
  let cumKm = 0;
  for (let i = 0; i < segMeters.length; i += 1) {
    cumKm += segMeters[i] / 1000;
    const speedKmh = secPerSeg > 0 ? (segMeters[i] / 1000) / (secPerSeg / 3600) : 0;
    points.push({ index: i + 1, km: Math.round(cumKm * 100) / 100, speedKmh: Math.round(speedKmh * 10) / 10 });
  }
  return points;
}
