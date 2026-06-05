import { test, expect } from '@playwright/test';
import { mockBackend, seedPlaywrightE2e } from './helpers';
import {
    mockAggregateScaleTelemetryBody,
    mockH3AggregateBody,
} from './fixtures/liveMapTelemetry';

const TELEMETRY_LIVE_GLOB = '**/activities/telemetry/live/**';

type LiveMapE2EWindow = Window & {
    __liveMapE2E?: {
        isReady: () => boolean;
        setZoom: (z: number, c?: [number, number]) => void;
        getRenderMode: () => string;
        getLayerVisibility: (id: string) => string | null;
        waitForPaint: () => Promise<void>;
    };
};

async function mockAggregateScaleBackend(page: import('@playwright/test').Page) {
    await mockBackend(page);
    await page.route(TELEMETRY_LIVE_GLOB, async (route) => {
        const url = new URL(route.request().url());
        const path = url.pathname;
        const method = route.request().method();

        if (path.includes('/telemetry/live/audit') && method === 'POST') {
            return route.fulfill({ status: 204, body: '' });
        }

        if (path.includes('/telemetry/live/aggregate')) {
            return route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify(mockH3AggregateBody(1500)),
            });
        }

        if (path.includes('/telemetry/live/stream')) {
            return route.fulfill({ status: 200, contentType: 'text/event-stream', body: '' });
        }

        const bbox = url.searchParams.get('bbox');
        return route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(mockAggregateScaleTelemetryBody(bbox)),
        });
    });

    await page.route('**/activities/telemetry/config/', async (route) => {
        return route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ poll_interval_ms: 2000, stream_interval_ms: 5000 }),
        });
    });
}

test.describe('Live Map H3 aggregate at scale', () => {
    test('shows H3 layer when render_mode=aggregate with high cell count', async ({ page }) => {
        await mockAggregateScaleBackend(page);
        await seedPlaywrightE2e(page);
        await page.goto('/#/owner/analytics/live-map', { waitUntil: 'load', timeout: 90_000 });
        await expect(page.getByTestId('e2e-auth-ready')).toBeAttached({ timeout: 30_000 });
        await expect(page.getByTestId('live-map-root')).toHaveAttribute('data-map-ready', 'true', {
            timeout: 90_000,
        });
        await page.waitForFunction(
            () => (window as LiveMapE2EWindow).__liveMapE2E?.isReady?.(),
            { timeout: 30_000 },
        );

        await page.evaluate(() => {
            const api = (window as LiveMapE2EWindow).__liveMapE2E;
            api?.setZoom(8, [21.0, 52.2]);
        });

        await page.waitForResponse(
            (resp) => resp.url().includes('/telemetry/live/aggregate') && resp.status() === 200,
            { timeout: 30_000 },
        ).catch(() => null);

        await page.waitForFunction(
            () => (window as LiveMapE2EWindow).__liveMapE2E?.getRenderMode?.() === 'aggregate',
            { timeout: 30_000 },
        );

        await page.evaluate(async () => {
            await (window as LiveMapE2EWindow).__liveMapE2E?.waitForPaint?.();
        });

        await page.waitForFunction(
            () => {
                const api = (window as LiveMapE2EWindow).__liveMapE2E;
                return api?.getLayerVisibility('live-h3-cells-fill') === 'visible';
            },
            { timeout: 30_000 },
        );

        const mode = await page.evaluate(
            () => (window as LiveMapE2EWindow).__liveMapE2E?.getRenderMode?.(),
        );
        const h3Vis = await page.evaluate(
            () => (window as LiveMapE2EWindow).__liveMapE2E?.getLayerVisibility('live-h3-cells-fill'),
        );
        const clusterVis = await page.evaluate(
            () => (window as LiveMapE2EWindow).__liveMapE2E?.getLayerVisibility('live-clusters'),
        );

        expect(mode).toBe('aggregate');
        expect(h3Vis).toBe('visible');
        expect(clusterVis).toBe('none');
    });
});
