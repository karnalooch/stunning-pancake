/**
 * Quick admin probe: login, Users page timing, Live Map zoom badge.
 * Usage: node scripts/probe-admin.mjs
 */
import { chromium } from 'playwright';

const ADMIN_URL = process.env.ADMIN_URL || 'https://admin-production-083b.up.railway.app';
const USER = process.env.ADMIN_USER || 'global_owner';
const PASS = process.env.ADMIN_PASS || '';

const log = (msg) => console.log(`[probe] ${msg}`);

async function timeStep(name, fn) {
    const t0 = Date.now();
    try {
        const result = await fn();
        log(`${name}: ${Date.now() - t0}ms`);
        return result;
    } catch (e) {
        log(`${name} FAILED (${Date.now() - t0}ms): ${e.message}`);
        throw e;
    }
}

async function main() {
    if (!PASS) {
        console.error('Set ADMIN_PASS env var');
        process.exit(1);
    }
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
    const page = await context.newPage();

    const apiTimes = [];
    page.on('response', async (res) => {
        const url = res.url();
        if (url.includes('/api/') || url.includes('/users/')) {
            apiTimes.push({ url: url.split('?')[0].slice(-60), status: res.status(), ms: 0 });
        }
    });

    await timeStep('goto login', () => page.goto(ADMIN_URL, { waitUntil: 'domcontentloaded', timeout: 60000 }));

    await page.getByLabel('Username or Email').fill(USER);
    await page.getByPlaceholder('Enter your password').fill(PASS);
    await timeStep('login submit', async () => {
        await page.getByRole('button', { name: 'Sign in' }).click();
        await page.waitForFunction(
            () => !window.location.hash.includes('/login'),
            { timeout: 60000 },
        );
    });

    log(`after login URL: ${page.url()}`);

    await timeStep('navigate Users', async () => {
        await page.goto(`${ADMIN_URL}/owner/users`, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await page.waitForTimeout(500);
    });

    const usersLoadStart = Date.now();
    await timeStep('Users table visible', async () => {
        await page.waitForSelector('table tbody tr, [data-testid="users-table"]', { timeout: 120000 });
    });
    log(`Users first paint ~${Date.now() - usersLoadStart}ms`);

    const rowCount = await page.locator('table tbody tr').count();
    log(`visible table rows: ${rowCount}`);

    await page.screenshot({ path: 'probe-users.png', fullPage: false });

    const filterStart = Date.now();
    const search = page.locator('input[placeholder*="Search"], input[placeholder*="Szukaj"]').first();
    if (await search.count()) {
        await search.fill('athlete');
        await page.waitForTimeout(800);
        log(`filter typing lag ~${Date.now() - filterStart}ms, rows=${await page.locator('table tbody tr').count()}`);
    }

    await timeStep('navigate Simulator/Live', async () => {
        const sim = page.getByRole('link', { name: /simulator/i }).first();
        if (await sim.count()) {
            await sim.click();
            await page.waitForTimeout(2000);
        }
    });

    const zoomBadge = page.getByText(/^zoom$/i);
    if (await zoomBadge.count()) {
        const zoomText = await page.locator('text=/^\\d+\\.\\d+$/').first().textContent().catch(() => '?');
        log(`Live map zoom overlay: ${zoomText}`);
    }
    await page.screenshot({ path: 'probe-live.png', fullPage: false });

    await browser.close();
    log('done — screenshots: probe-users.png, probe-live.png');
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
