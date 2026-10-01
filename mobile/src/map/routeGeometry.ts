export function isMapCoordinate(value: unknown): value is [number, number] {
  return Array.isArray(value) && value.length === 2 &&
    typeof value[0] === 'number' && Number.isFinite(value[0]) && Math.abs(value[0]) <= 180 &&
    typeof value[1] === 'number' && Number.isFinite(value[1]) && Math.abs(value[1]) <= 90;
}

/** Invalid samples break the line; never silently draw a bridge across missing route data. */
export function buildRouteGeometry(coordinates: readonly unknown[]): GeoJSON.LineString | GeoJSON.MultiLineString | null {
  const segments: [number, number][][] = [];
  let segment: [number, number][] = [];
  const flush = () => { if (segment.length > 1) segments.push(segment); segment = []; };
  for (const coordinate of coordinates) {
    if (isMapCoordinate(coordinate)) segment.push([coordinate[0], coordinate[1]]);
    else flush();
  }
  flush();
  if (segments.length === 0) return null;
  return segments.length === 1
    ? { type: 'LineString', coordinates: segments[0]! }
    : { type: 'MultiLineString', coordinates: segments };
}
