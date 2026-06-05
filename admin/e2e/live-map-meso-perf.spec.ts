import { test, expect } from '@playwright/test';
import { mockBackendWithLiveMap, seedPlaywrightE2e } from './helpers';

/**
 * Meso entry perf budget — city ranking → clusters on map.
 * CI budget generous for mock + ANGLE; tighten when prod metrics stable.
 */
const MESO_ENTRY_BUDGET_MS = Number(process.env.LIVE_MAP_MESO_BUDGET_MS ?? 12_000);

test.describe('Live Map Meso perf', () => {
    test('city ranking → on map within budget', async ({ page }) => {
        await mockBackendWithLiveMap(page);
        await seedPlaywrightE2e(page);
        await page.goto('/#/owner/analytics/live-map', { waitUntil: 'load', timeout: 90_000 });
        await expect(page.getByTestId('e2e-auth-ready')).toBeAttached({ timeout: 30_000 });
        await expect(page.getByTestId('live-map-root')).toHaveAttribute('data-map-ready', 'true', {
            timeout: 90_000,
        });

        const t0 = Date.now();
        const ranking = page.getByTestId('live-map-city-ranking');
        await ranking.waitFor({ state: 'visible', timeout: 60_000 });
        await ranking.getByRole('button').first().click();

        await expect(page.getByTestId('live-map-zoom-mode')).toHaveText('Meso', { timeout: 60_000 });
        await expect(page.getByTestId('live-map-drawn-count')).toContainText(/[1-9]\d* on map/, {
            timeout: MESO_ENTRY_BUDGET_MS,
        });

        const elapsed = Date.now() - t0;
        expect(elapsed).toBeLessThan(MESO_ENTRY_BUDGET_MS);

        const refreshing = page.getByTestId('live-map-viewport-refreshing');
        if (await refreshing.isVisible().catch(() => false)) {
            await expect(refreshing).toBeHidden({ timeout: 30_000 });
        }
    });
});
