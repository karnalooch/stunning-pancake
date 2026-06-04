export type LngLat = { lng: number; lat: number };

/** Haversine distance in metres between two WGS84 points. */
export function segmentLengthM(a: LngLat, b: LngLat): number {
    const R = 6_371_000;
    const lat1 = (a.lat * Math.PI) / 180;
    const lat2 = (b.lat * Math.PI) / 180;
    const dLat = lat2 - lat1;
    const dLng = ((b.lng - a.lng) * Math.PI) / 180;
    const x =
        Math.sin(dLat / 2) ** 2
        + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(x)));
}

/** Sample point at fraction t ∈ [0,1] along polyline by arc length. */
export function pointAlongPolyline(points: LngLat[], t: number): LngLat | null {
    if (points.length === 0) return null;
    if (points.length === 1 || t <= 0) return points[0];
    if (t >= 1) return points[points.length - 1];

    const segLens: number[] = [];
    let total = 0;
    for (let i = 1; i < points.length; i++) {
        const len = segmentLengthM(points[i - 1], points[i]);
        segLens.push(len);
        total += len;
    }
    if (total < 1e-3) return points[points.length - 1];

    let target = total * t;
    for (let i = 0; i < segLens.length; i++) {
        if (target <= segLens[i]) {
            const segT = segLens[i] > 0 ? target / segLens[i] : 0;
            const a = points[i];
            const b = points[i + 1];
            return {
                lng: a.lng + (b.lng - a.lng) * segT,
                lat: a.lat + (b.lat - a.lat) * segT,
            };
        }
        target -= segLens[i];
    }
    return points[points.length - 1];
}
