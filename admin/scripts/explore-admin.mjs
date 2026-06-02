/**
 * Explore admin after login — screenshots + timings per route.
 * ADMIN_PASS required. ADMIN_USER defaults to global_owner.
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const ADMIN_URL = process.env.ADMIN_URL || 'https://admin-production-083b.up.railway.app';
const USER = process.env.ADMIN_USER || 'global_owner';
const PASS = process.env.ADMIN_PASS || '';
const OUT = path.join(process.cwd(), 'probe-screenshots');

const ROUTES = [
    { name: 'dashboard', hash: '#/owner/dashboard' },
    { name: 'users', hash: '#/owner/users' },
    { name: 'activities', hash: '#/owner/activities' },
    { name: 'anti-cheat', hash: '#/owner/anti-cheat' },
    { name: 'live-map', hash: '#/owner/analytics/live-map' },
    { name: 'simulator', hash: '#/owner/analytics/simulator' },
    { name: 'sponsor', hash: '#/owner/sponsor' },
    { name: 'white-label', hash: '#/owner/white-label' },
    { name: 'departments', hash: '#/owner/departments' },
    { name: 'settings', hash: '#/owner/settings' },
];

async function login(page) {
    await page.goto(ADMIN_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.getByLabel('Username or Email').fill(USER);
    await page.getByPlaceholder('Enter your password').fill(PASS);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForFunction(
        () => !window.location.hash.includes('/login'),
        { timeout: 90000 },
    );
    await page.waitForTimeout(1500);
}

async function main() {
    if (!PASS) {
        console.error('Set ADMIN_PASS');
        process.exit(1);
    }
    fs.mkdirSync(OUT, { recursive: true });

    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

    const report = [];
    try {
        const t0 = Date.now();
        await login(page);
        report.push({ step: 'login', ms: Date.now() - t0, url: page.url() });

        for (const route of ROUTES) {
            const start = Date.now();
            await page.goto(`${ADMIN_URL}/${route.hash}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
            await page.waitForTimeout(2500);
            const ms = Date.now() - start;
            const title = await page.locator('h1, [class*="PageHeader"]').first().textContent().catch(() => '');
            const bodyText = await page.locator('body').innerText();
            const hasError = /failed|error|404|unauthorized/i.test(bodyText.slice(0, 2000));
            const hasEmpty = /will appear here|no data|loading/i.test(bodyText.slice(0, 3000));
            await page.screenshot({ path: path.join(OUT, `${route.name}.png`), fullPage: false });
            report.push({
                route: route.name,
                ms,
                title: (title || '').trim().slice(0, 80),
                hasError,
                hasEmptyPlaceholder: hasEmpty,
                snippet: bodyText.replace(/\s+/g, ' ').slice(0, 200),
            });
            console.log(`[ok] ${route.name} ${ms}ms`);
        }
    } catch (e) {
        report.push({ error: String(e.message) });
        await page.screenshot({ path: path.join(OUT, 'error.png') }).catch(() => {});
        console.error(e);
    } finally {
        fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2));
        await browser.close();
    }
    console.log(`Report: ${path.join(OUT, 'report.json')}`);
}

main();
