import { test, expect } from '@playwright/test';
import { mockBackendWithLiveMap, seedPlaywrightE2e } from './helpers';
import { KRAKOW } from './fixtures/liveMapTelemetry';
import fs from 'fs';
import path from 'path';

const OUT = path.join(process.cwd(), 'audit-screenshots');
const WARSAW: [number, number] = [21.0122, 52.2297];

type LiveMapE2EWindow = Window & {
    __liveMapE2E?: {
        isReady: () => boolean;
        setZoom: (z: number, c?: [number, number]) => void;
        waitForPaint: () => Promise<void>;
        getRenderedCount: () => number;
        getWebGlAudit: () => {
            sourcePoints: number;
            renderedTotal: number;
            renderedClusters: number;
            renderedPoints: number;
            glRenderer: string | null;
            layoutVisibility: Record<string, string>;
        } | null;
    };
};

test.describe('Live Map WebGL audit', () => {
    test('meso clusters vs micro points — source vs rendered', async ({ page }) => {
        fs.mkdirSync(OUT, { recursive: true });

        await mockBackendWithLiveMap(page);
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

        await page.evaluate(async ({ z, c }) => {
            const api = (window as LiveMapE2EWindow).__liveMapE2E;
            api?.setZoom(z, c);
            await api?.waitForPaint?.();
        }, { z: 10, c: WARSAW });
        await expect(page.getByTestId('live-map-rendered-count')).toContainText(/[1-9]\d*/, {
            timeout: 30_000,
        });

        const mesoAudit = await page.evaluate(() =>
            (window as LiveMapE2EWindow).__liveMapE2E?.getWebGlAudit?.() ?? null,
        );
        await page.screenshot({ path: path.join(OUT, 'webgl-e2e-meso.png') });

        await page.evaluate(async ({ z, c }) => {
            const api = (window as LiveMapE2EWindow).__liveMapE2E;
            api?.setZoom(z, c);
            await api?.waitForPaint?.();
        }, { z: 13.5, c: [KRAKOW.lng, KRAKOW.lat] });
        await expect(page.getByTestId('live-map-rendered-count')).toContainText(/[1-9]\d*/, {
            timeout: 30_000,
        });

        const micro = await page.evaluate(() =>
            (window as LiveMapE2EWindow).__liveMapE2E?.getWebGlAudit?.(),
        );
        await page.screenshot({ path: path.join(OUT, 'webgl-e2e-micro.png') });

        const report = { mesoAudit, micro, finished: new Date().toISOString() };
        fs.writeFileSync(path.join(OUT, 'webgl-e2e-audit.json'), JSON.stringify(report, null, 2));

        expect(mesoAudit?.layoutVisibility['live-clusters']).toBe('visible');
        expect(mesoAudit?.layoutVisibility['live-direction-dots']).toBe('visible');
        expect(mesoAudit?.renderedClusters ?? 0).toBeGreaterThan(0);

        expect(micro?.layoutVisibility['live-unclustered']).toBe('visible');
        expect(micro?.sourcePoints ?? 0).toBeGreaterThan(0);
        expect(micro?.renderedPoints ?? 0).toBeGreaterThan(0);
        await expect(page.getByTestId('live-map-drawn-count')).toContainText(/[1-9]\d*/);

        console.log('WEBGL_AUDIT', JSON.stringify({ mesoAudit, micro }));
    });
});
