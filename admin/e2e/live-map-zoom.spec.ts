import { test, expect } from '@playwright/test';
import { mockBackendWithLiveMap, seedPlaywrightE2e } from './helpers';

/**
 * Live Map zoom LOD — visual regression per tier.
 *
 * Requires dev server with E2E bridge:
 *   cross-env VITE_E2E=1 npm run dev
 *   npx playwright test e2e/live-map-zoom.spec.ts --project=chromium
 *
 * Update baselines: npx playwright test e2e/live-map-zoom.spec.ts --update-snapshots
 */

const ZOOM_SAMPLES: { zoom: number; mode: string; slug: string }[] = [
    { zoom: 6.5, mode: 'Kraj', slug: 'country' },
    { zoom: 7.75, mode: 'Region', slug: 'region' },
    { zoom: 9, mode: 'Aglomeracja', slug: 'metro' },
    { zoom: 10, mode: 'Miasto', slug: 'city' },
    { zoom: 11, mode: 'Dzielnica', slug: 'district' },
    { zoom: 11.85, mode: 'Osiedle', slug: 'neighborhood' },
    { zoom: 12.5, mode: 'Zbliżenie', slug: 'handoff' },
    { zoom: 13.1, mode: 'Ulice (ikony)', slug: 'street-icons' },
    { zoom: 14, mode: 'Ulice (etykiety)', slug: 'street-labels' },
    { zoom: 15.2, mode: 'Detal', slug: 'detail' },
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
            await page.evaluate(({ zoom }) => {
                const api = (window as Window & {
                    __liveMapE2E?: { setZoom: (z: number) => void };
                }).__liveMapE2E;
                api?.setZoom(zoom);
            }, { zoom: sample.zoom });

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

            // Tiles + symbol layout settle after jumpTo
            await page.waitForTimeout(1200);

            const map = page.getByTestId('live-map-canvas');
            await expect(map).toHaveScreenshot(`live-map-zoom-${sample.slug}.png`, {
                maxDiffPixelRatio: 0.02,
                animations: 'disabled',
            });
        });
    }
});
