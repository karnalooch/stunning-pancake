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

export function mockLiveTelemetryBody(detail: string | null, bbox?: string | null): object {
    const positions = mockPositionsForBbox(bbox ?? null);
    const bike = positions.filter((p) => (p.type as string) !== 'running').length;
    const run = positions.length - bike;
    const meta = {
        ride_on_map: 48,
        positions_returned: positions.length,
        viewport_returned: positions.length,
        viewport_bike: bike,
        viewport_run: run,
        city_counts: MOCK_CITY_COUNTS,
        city_bike_counts: MOCK_CITY_BIKE_COUNTS,
        city_run_counts: MOCK_CITY_RUN_COUNTS,
        city_trend: MOCK_CITY_TREND,
        flagged_device_ids: ['e2e-athlete-52.2297-3'],
        flagged_in_viewport: 1,
        read_mode: 'normal',
    };
    if (detail === 'summary') {
        return { positions: [], meta };
    }
    return { positions, meta };
}
