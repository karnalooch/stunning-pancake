import { test, expect } from '@playwright/test';
import { mockBackendWithLiveMap, seedPlaywrightE2e } from './helpers';
import { KRAKOW } from './fixtures/liveMapTelemetry';

/**
 * Live Map enterprise tiers — visual regression (macro / meso / micro).
 *
 * Requires dev server with E2E bridge:
 *   cross-env VITE_E2E=1 npm run dev
 *   npx playwright test e2e/live-map-zoom.spec.ts --project=chromium
 *
 * Update baselines: npx playwright test e2e/live-map-zoom.spec.ts --update-snapshots
 */

const ZOOM_SAMPLES: { zoom: number; mode: string; slug: string; center?: [number, number] }[] = [
    { zoom: 6.5, mode: 'Makro', slug: 'macro-country' },
    { zoom: 8, mode: 'Makro', slug: 'macro-region' },
    { zoom: 9.5, mode: 'Meso', slug: 'meso-metro' },
    { zoom: 10, mode: 'Meso', slug: 'meso-city' },
    { zoom: 11.5, mode: 'Meso', slug: 'meso-district' },
    { zoom: 12.9, mode: 'Mikro', slug: 'micro-handoff-krakow', center: [KRAKOW.lng, KRAKOW.lat] },
    { zoom: 13.5, mode: 'Mikro', slug: 'micro-street' },
    { zoom: 15, mode: 'Mikro', slug: 'micro-detail' },
];

test.describe('Live Map zoom LOD screenshots', () => {
    test.describe.configure({ mode: 'serial', timeout: 120_000 });

    test.beforeEach(async ({ page }) => {
        await mockBackendWithLiveMap(page);
        await seedPlaywrightE2e(page);
        await page.goto('/#/owner/analytics/live-map', { waitUntil: 'domcontentloaded' });
        await expect(page.getByTestId('e2e-auth-ready')).toBeAttached({ timeout: 20000 });
        await expect(page.getByTestId('live-map-root')).toBeVisible({ timeout: 30000 });
        await page.waitForFunction(
            () => {
                const api = (window as Window & { __liveMapE2E?: { isReady: () => boolean } }).__liveMapE2E;
                return Boolean(api?.isReady());
            },
            { timeout: 60000 },
        );
    });

    for (const sample of ZOOM_SAMPLES) {
        test(`zoom ${sample.zoom} — ${sample.mode}`, async ({ page }) => {
            await page.evaluate(({ zoom, center }) => {
                const api = (window as Window & {
                    __liveMapE2E?: { setZoom: (z: number, c?: [number, number]) => void };
                }).__liveMapE2E;
                api?.setZoom(zoom, center);
            }, { zoom: sample.zoom, center: sample.center });

            await page.waitForFunction(
                ({ target }) => {
                    const api = (window as Window & { __liveMapE2E?: { getZoom: () => number } }).__liveMapE2E;
                    const z = api?.getZoom() ?? 0;
                    return Math.abs(z - target) < 0.25;
                },
                { target: sample.zoom },
                { timeout: 8000 },
            );
            await expect(page.getByTestId('live-map-zoom-mode')).toHaveText(sample.mode);

            if (sample.slug === 'micro-handoff-krakow') {
                await expect(page.getByTestId('live-map-drawn-count')).toContainText(/\d+ on map/);
                await expect(page.getByTestId('live-map-rendered-count')).toContainText(/\d+ rendered/);
            }

            await page.waitForTimeout(1200);

            const map = page.getByTestId('live-map-canvas');
            await expect(map).toHaveScreenshot(`live-map-zoom-${sample.slug}.png`, {
                maxDiffPixelRatio: 0.02,
                animations: 'disabled',
            });
        });
    }
});
