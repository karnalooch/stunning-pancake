/** Synthetic telemetry for Live Map E2E (city grids + city_counts). */

export const WARSAW = { lng: 21.0122, lat: 52.2297 };
export const KRAKOW = { lng: 19.945, lat: 50.0647 };

export function buildMockLivePositionsNear(
    center: { lng: number; lat: number },
    count = 48,
): Array<Record<string, unknown>> {
    const positions: Array<Record<string, unknown>> = [];
    const cols = 8;
    const step = 0.004;
    for (let i = 0; i < count; i += 1) {
        const row = Math.floor(i / cols);
        const col = i % cols;
        positions.push({
            deviceId: `e2e-athlete-${center.lat}-${i + 1}`,
            name: `Athlete ${i + 1}`,
            type: i % 3 === 0 ? 'running' : 'cycling',
            lat: center.lat + (row - 3) * step,
            lng: center.lng + (col - 3.5) * step,
            speed: 2.5 + (i % 7) * 0.4,
            course: (i * 37) % 360,
            ride_state: 'ACTIVE',
            lastUpdate: new Date().toISOString(),
        });
    }
    return positions;
}

/** @deprecated use buildMockLivePositionsNear(WARSAW) */
export function buildMockLivePositions(count = 48): Array<Record<string, unknown>> {
    return buildMockLivePositionsNear(WARSAW, count);
}

export function buildMockLivePositionsKrakow(count = 45): Array<Record<string, unknown>> {
    return buildMockLivePositionsNear(KRAKOW, count);
}

export const MOCK_CITY_COUNTS: Record<string, number> = {
    warszawa: 32,
    krakow: 8,
    wroclaw: 4,
    poznan: 2,
    gdansk: 1,
    lodz: 1,
    lublin: 0,
    bydgoszcz: 0,
    katowice: 0,
    siedlce: 0,
};

export const MOCK_CITY_BIKE_COUNTS: Record<string, number> = {
    warszawa: 28,
    krakow: 7,
    wroclaw: 3,
    poznan: 2,
    gdansk: 1,
    lodz: 1,
    lublin: 0,
    bydgoszcz: 0,
    katowice: 0,
    siedlce: 0,
};

export const MOCK_CITY_RUN_COUNTS: Record<string, number> = {
    warszawa: 4,
    krakow: 1,
    wroclaw: 1,
    poznan: 0,
    gdansk: 0,
    lodz: 0,
    lublin: 0,
    bydgoszcz: 0,
    katowice: 0,
    siedlce: 0,
};

export const MOCK_CITY_TREND: Record<string, number> = {
    warszawa: 2,
    krakow: -1,
    wroclaw: 0,
    poznan: 0,
    gdansk: 0,
    lodz: 0,
    lublin: 0,
    bydgoszcz: 0,
    katowice: 0,
    siedlce: 0,
};

/** Pick mock grid from bbox center (Kraków vs Warszawa) for viewport-aligned E2E. */
export function mockPositionsForBbox(bbox: string | null | undefined): Array<Record<string, unknown>> {
    if (!bbox) return buildMockLivePositions();
    const parts = bbox.split(',').map((s) => Number.parseFloat(s.trim()));
    if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) {
        return buildMockLivePositions();
    }
    const [west, south, east, north] = parts;
    const clng = (west + east) / 2;
    const clat = (south + north) / 2;
    if (clat < 51.2 && clng < 20.5) {
        return buildMockLivePositionsKrakow(45);
    }
    return buildMockLivePositions();
}

/** Mirrors backend live_map_api.py render_mode selection. */
export function mockRenderModeForDetail(
    detail: string | null,
    viewportReturned: number,
): 'points' | 'clusters' | 'aggregate' {
    if (detail === 'standard' || detail === 'summary' || viewportReturned > 50) {
        return 'clusters';
    }
    return 'points';
}

export function mockLiveTelemetryBody(detail: string | null, bbox?: string | null): object {
    const positions = mockPositionsForBbox(bbox ?? null);
    const bike = positions.filter((p) => (p.type as string) !== 'running').length;
    const run = positions.length - bike;
    const viewportReturned = positions.length;
    const meta = {
        ride_on_map: 48,
        positions_returned: viewportReturned,
        viewport_returned: viewportReturned,
        viewport_bike: bike,
        viewport_run: run,
        city_counts: MOCK_CITY_COUNTS,
        city_bike_counts: MOCK_CITY_BIKE_COUNTS,
        city_run_counts: MOCK_CITY_RUN_COUNTS,
        city_trend: MOCK_CITY_TREND,
        flagged_device_ids: ['e2e-athlete-52.2297-3'],
        flagged_in_viewport: 1,
        read_mode: 'normal',
        render_mode: mockRenderModeForDetail(detail, viewportReturned),
    };
    if (detail === 'summary') {
        return { positions: [], meta };
    }
    return { positions, meta };
}

/** Synthetic H3/hexbin cells for aggregate-mode E2E (no real 10k load). */
export function buildMockH3AggregateFeatures(cellCount = 1200): Array<Record<string, unknown>> {
    const features: Array<Record<string, unknown>> = [];
    const cols = Math.ceil(Math.sqrt(cellCount));
    const originLng = 19.0;
    const originLat = 49.5;
    const step = 0.04;
    for (let i = 0; i < cellCount; i += 1) {
        const row = Math.floor(i / cols);
        const col = i % cols;
        const lng = originLng + col * step;
        const lat = originLat + row * step;
        const half = step * 0.45;
        features.push({
            type: 'Feature',
            properties: { weight: (i % 10) / 10, count: (i % 50) + 1 },
            geometry: {
                type: 'Polygon',
                coordinates: [[
                    [lng, lat],
                    [lng + half, lat],
                    [lng + half, lat + half],
                    [lng, lat + half],
                    [lng, lat],
                ]],
            },
        });
    }
    return features;
}

export function mockH3AggregateBody(cellCount = 1200): object {
    const features = buildMockH3AggregateFeatures(cellCount);
    return {
        type: 'FeatureCollection',
        features,
        meta: { cells: features.length, mode: 'h3', render_mode: 'aggregate' },
    };
}

/** Live response forcing aggregate LOD (scale gate). */
export function mockAggregateScaleTelemetryBody(bbox?: string | null): object {
    const bboxParam = bbox ?? '19,49,24,55';
    return {
        positions: [],
        meta: {
            ride_on_map: 12_500,
            positions_returned: 0,
            viewport_returned: 0,
            viewport_total_estimate: 12_500,
            capped: true,
            city_counts: MOCK_CITY_COUNTS,
            city_bike_counts: MOCK_CITY_BIKE_COUNTS,
            city_run_counts: MOCK_CITY_RUN_COUNTS,
            city_trend: MOCK_CITY_TREND,
            flagged_in_viewport: 0,
            read_mode: 'normal',
            render_mode: 'aggregate',
            aggregate_url: `/api/activities/telemetry/live/aggregate/?bbox=${bboxParam}&mode=h3`,
        },
    };
}
