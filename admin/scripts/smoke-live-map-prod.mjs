/**
 * Prod Live Map smoke — login, wait for telemetry, zoom to meso, capture badges.
 * ADMIN_PASS required. Screenshots → audit-screenshots/
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const BASE = process.env.ADMIN_URL || 'https://admin-production-083b.up.railway.app';
const USER = process.env.ADMIN_USER || 'global_owner';
const PASS = process.env.ADMIN_PASS || '';
const OUT = path.join(process.cwd(), 'audit-screenshots');

if (!PASS) {
    console.error('ADMIN_PASS required');
    process.exit(1);
}

fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
    headless: true,
    args: ['--use-gl=angle'],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.setDefaultTimeout(120_000);
const report = { steps: [], badges: {} };

try {
    await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 90_000 });
    await page.getByLabel('Username or Email').fill(USER);
    await page.getByPlaceholder('Enter your password').fill(PASS);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForFunction(() => !window.location.hash.includes('/login'), { timeout: 90_000 });
    report.steps.push('login ok');

    await page.goto(`${BASE}/#/owner/analytics/live-map`, {
        waitUntil: 'domcontentloaded',
        timeout: 90_000,
    });
    await page.waitForSelector('[data-testid=live-map-root][data-map-ready=true]', {
        timeout: 120_000,
    });
    report.steps.push('map ready');

    // Macro tier hides rider GeoJSON — fly to city (z≈10.5) via ranking panel.
    const ranking = page.getByTestId('live-map-city-ranking');
    await ranking.waitFor({ state: 'visible', timeout: 60_000 });
    await ranking.getByRole('button').first().click({ timeout: 10_000 });
    await page.waitForTimeout(2500);
    await page.waitForFunction(
        () => {
            const mode = document.querySelector('[data-testid=live-map-zoom-mode]');
            return mode?.textContent?.trim() === 'Meso';
        },
        { timeout: 60_000 },
    );
    report.steps.push('meso tier');

    await page.waitForFunction(
        () => {
            const el = document.querySelector('[data-testid=live-map-drawn-count]');
            return el && /[1-9]/.test(el.textContent || '');
        },
        { timeout: 120_000 },
    );
    report.steps.push('on map > 0');
    await page.waitForTimeout(5000);

    report.badges = {
        drawn: await page.getByTestId('live-map-drawn-count').innerText().catch(() => ''),
        rendered: await page.getByTestId('live-map-rendered-count').innerText().catch(() => ''),
        mode: await page.getByTestId('live-map-zoom-mode').innerText().catch(() => ''),
    };

    const zoomBadge = page.locator('text=/Z\\s*[\\d.]+/').first();
    if (await zoomBadge.isVisible().catch(() => false)) {
        report.badges.zoom = await zoomBadge.innerText();
    }

    report.layerVis = await page.evaluate(() => {
        const cached = window.__liveMapLayerVis;
        if (cached) return { source: 'cache', ...cached };
        return { source: 'none' };
    });

    await page.screenshot({ path: path.join(OUT, 'live-map-smoke-meso.png') });
    report.steps.push('screenshot saved');

    fs.writeFileSync(path.join(OUT, 'live-map-smoke-report.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
} catch (e) {
    report.error = String(e);
    await page.screenshot({ path: path.join(OUT, 'live-map-smoke-fatal.png') }).catch(() => {});
    fs.writeFileSync(path.join(OUT, 'live-map-smoke-report.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
    process.exit(1);
} finally {
    await browser.close();
}
