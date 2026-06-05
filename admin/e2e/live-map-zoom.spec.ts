import { test, expect } from '@playwright/test';
import { mockBackendWithLiveMap, seedPlaywrightE2e } from './helpers';
import { KRAKOW } from './fixtures/liveMapTelemetry';

/**
 * Live Map enterprise tiers — visual regression (macro / meso / micro).
 *
 * Requires dev server with E2E bridge:
 *   cross-env VITE_E2E=1 npm run dev
 *   npx playwright test e2e/live-map-zoom.spec.ts --project=live-map-zoom
 *
 * Update baselines: npm run test:e2e:live-map:update
 */

const ZOOM_SAMPLES: {
    zoom: number;
    mode: string;
    slug: string;
    center?: [number, number];
    /** Assert rider GeoJSON loaded (on map badge). */
    expectOnMap?: boolean;
    /** Assert correct MapLibre layer visibility (logic fix). */
    expectLayerVisibility?: boolean;
}[] = [
    { zoom: 6.5, mode: 'Makro', slug: 'macro-country' },
    { zoom: 8, mode: 'Makro', slug: 'macro-region' },
    { zoom: 9.5, mode: 'Meso', slug: 'meso-metro', expectOnMap: true, expectLayerVisibility: true },
    { zoom: 10, mode: 'Meso', slug: 'meso-city', expectOnMap: true, expectLayerVisibility: true },
    { zoom: 11.5, mode: 'Meso', slug: 'meso-district', expectOnMap: true, expectLayerVisibility: true },
    {
        zoom: 12.9,
        mode: 'Mikro',
        slug: 'micro-handoff-krakow',
        center: [KRAKOW.lng, KRAKOW.lat],
        expectOnMap: true,
        expectLayerVisibility: true,
    },
    { zoom: 13.5, mode: 'Mikro', slug: 'micro-street', expectOnMap: true, expectLayerVisibility: true },
    { zoom: 15, mode: 'Mikro', slug: 'micro-detail', expectOnMap: true, expectLayerVisibility: true },
];

type LiveMapE2EWindow = Window & {
    __liveMapE2E?: {
        isReady: () => boolean;
        setZoom: (z: number, c?: [number, number]) => void;
        getZoom: () => number;
        getLayerVisibility: (id: string) => string | null;
        getRenderedCount: () => number;
    };
};

async function waitForLiveMapReady(page: import('@playwright/test').Page) {
    const root = page.getByTestId('live-map-root');
    await expect(root).toBeAttached({ timeout: 90_000 });
    await expect(root).toHaveAttribute('data-map-ready', 'true', { timeout: 90_000 });
    await expect(page.getByTestId('live-map-canvas')).toBeVisible({ timeout: 30_000 });
    await page.waitForFunction(
        () => {
            const api = (window as LiveMapE2EWindow).__liveMapE2E;
            return Boolean(api?.isReady?.());
        },
        { timeout: 15_000 },
    );
}

test.describe('Live Map zoom LOD screenshots', () => {
    test.describe.configure({ mode: 'serial', timeout: 180_000 });

    test.beforeEach(async ({ page }) => {
        await mockBackendWithLiveMap(page);
        await seedPlaywrightE2e(page);
        await page.goto('/#/owner/analytics/live-map', { waitUntil: 'load', timeout: 90_000 });
        await expect(page.getByTestId('e2e-auth-ready')).toBeAttached({ timeout: 30_000 });
        await waitForLiveMapReady(page);
    });

    for (const sample of ZOOM_SAMPLES) {
        test(`zoom ${sample.zoom} — ${sample.mode}`, async ({ page }) => {
            const telemetryWait = page.waitForResponse(
                (resp) => resp.url().includes('/telemetry/live/') && resp.status() === 200,
                { timeout: 20_000 },
            ).catch(() => null);

            await page.evaluate(({ zoom, center }) => {
                const api = (window as LiveMapE2EWindow).__liveMapE2E;
                api?.setZoom(zoom, center);
            }, { zoom: sample.zoom, center: sample.center });

            await telemetryWait;

            await page.waitForFunction(
                ({ target }) => {
                    const api = (window as LiveMapE2EWindow).__liveMapE2E;
                    const z = api?.getZoom() ?? 0;
                    return Math.abs(z - target) < 0.25;
                },
                { target: sample.zoom },
                { timeout: 8000 },
            );
            await expect(page.getByTestId('live-map-zoom-mode')).toHaveText(sample.mode);

            if (sample.expectOnMap) {
                await expect(page.getByTestId('live-map-drawn-count')).toContainText(/[1-9]\d* on map/);
            }

            if (sample.expectLayerVisibility) {
                const layerIds = sample.zoom >= 12
                    ? ['live-unclustered']
                    : ['live-clusters', 'live-cluster-count'];
                await page.waitForFunction(
                    ({ ids }) => {
                        const api = (window as LiveMapE2EWindow).__liveMapE2E;
                        return ids.every((id) => api?.getLayerVisibility(id) === 'visible');
                    },
                    { ids: layerIds },
                    { timeout: 30_000 },
                );
            }

            if (sample.slug === 'micro-handoff-krakow') {
                await expect(page.getByTestId('live-map-drawn-count')).toContainText(/4\d+ on map|45 on map/);
            }

            await page.waitForTimeout(800);

            const map = page.getByTestId('live-map-canvas');
            await expect(map).toHaveScreenshot(`live-map-zoom-${sample.slug}.png`, {
                maxDiffPixelRatio: 0.02,
                animations: 'disabled',
            });
        });
    }
});
