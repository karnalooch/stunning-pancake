/** Synthetic telemetry for Live Map E2E (Warsaw grid + city_counts). */

const WARSAW = { lng: 21.0122, lat: 52.2297 };

export function buildMockLivePositions(count = 48): Array<Record<string, unknown>> {
    const positions: Array<Record<string, unknown>> = [];
    const cols = 8;
    const step = 0.004;
    for (let i = 0; i < count; i += 1) {
        const row = Math.floor(i / cols);
        const col = i % cols;
        positions.push({
            deviceId: `e2e-athlete-${i + 1}`,
            name: `Athlete ${i + 1}`,
            type: i % 3 === 0 ? 'running' : 'cycling',
            lat: WARSAW.lat + (row - 3) * step,
            lng: WARSAW.lng + (col - 3.5) * step,
            speed: 2.5 + (i % 7) * 0.4,
            course: (i * 37) % 360,
            ride_state: 'ACTIVE',
            lastUpdate: new Date().toISOString(),
        });
    }
    return positions;
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

export function mockLiveTelemetryBody(detail: string | null): object {
    const meta = {
        ride_on_map: 48,
        viewport_bike: 32,
        viewport_run: 16,
        city_counts: MOCK_CITY_COUNTS,
    };
    if (detail === 'summary') {
        return { positions: [], meta };
    }
    return { positions: buildMockLivePositions(), meta };
}
