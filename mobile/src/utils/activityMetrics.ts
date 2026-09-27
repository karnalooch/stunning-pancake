export function formatDurationSeconds(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value) || value < 0) return '—';
  const total = Math.round(value);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return [hours, minutes, seconds].map((part) => String(part).padStart(2, '0')).join(':');
}

export function averageSpeedKmh(
  distanceMeters: number | null | undefined,
  durationSeconds: number | null | undefined,
): number | null {
  const distance = Number(distanceMeters);
  const duration = Number(durationSeconds);
  if (!Number.isFinite(distance) || distance < 0 || !Number.isFinite(duration) || duration <= 0) {
    return null;
  }
  return (distance / 1000) / (duration / 3600);
}

export function routeViewport(route: [number, number][]): {
  center: [number, number] | null;
  zoom: number;
} {
  if (route.length === 0) return { center: null, zoom: 13 };

  let minLon = route[0]![0];
  let maxLon = route[0]![0];
  let minLat = route[0]![1];
  let maxLat = route[0]![1];

  for (const [lon, lat] of route) {
    minLon = Math.min(minLon, lon);
    maxLon = Math.max(maxLon, lon);
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
  }

  const span = Math.max(maxLon - minLon, maxLat - minLat);
  const zoom =
    span <= 0.002 ? 16 :
    span <= 0.005 ? 15 :
    span <= 0.015 ? 14 :
    span <= 0.04 ? 13 :
    span <= 0.1 ? 12 :
    span <= 0.25 ? 11 : 10;

  return {
    center: [(minLon + maxLon) / 2, (minLat + maxLat) / 2],
    zoom,
  };
}
