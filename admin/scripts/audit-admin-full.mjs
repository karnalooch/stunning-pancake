/**
 * Full admin UI audit — all routes, safe clicks, report JSON.
 * Skips: Wipe All Data confirm, Delete user confirm, Stop simulation.
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const BASE = process.env.ADMIN_URL || 'https://admin-production-083b.up.railway.app';
const USER = process.env.ADMIN_USER || 'global_owner';
const PASS = process.env.ADMIN_PASS || '';
const OUT = path.join(process.cwd(), 'audit-screenshots');

const ROUTES = [
    { id: 'rbac', hash: '#/owner/system/rbac' },
    { id: 'feature-flags', hash: '#/owner/system/feature-flags' },
    { id: 'leaderboards', hash: '#/owner/system/leaderboards' },
    { id: 'export', hash: '#/owner/system/export' },
    { id: 'api-playground', hash: '#/owner/system/api-playground' },
    { id: 'settings', hash: '#/owner/settings' },
    { id: 'dashboard', hash: '#/owner/dashboard' },
    { id: 'white-label', hash: '#/owner/white-label' },
    { id: 'users', hash: '#/owner/users' },
    { id: 'departments', hash: '#/owner/departments' },
    { id: 'activities', hash: '#/owner/activities' },
    { id: 'anti-cheat', hash: '#/owner/anti-cheat' },
    { id: 'events', hash: '#/owner/analytics/events' },
    { id: 'sponsor', hash: '#/owner/sponsor' },
    { id: 'sponsorship-analytics', hash: '#/owner/analytics/sponsorship' },
    { id: 'vouchers', hash: '#/owner/analytics/vouchers' },
    { id: 'dept-analytics', hash: '#/owner/analytics/departments' },
    { id: 'heatmaps', hash: '#/owner/analytics/heatmaps' },
    { id: 'live-map', hash: '#/owner/analytics/live-map' },
    { id: 'feedback', hash: '#/owner/analytics/feedback' },
    { id: 'simulator', hash: '#/owner/analytics/simulator' },
];

const SKIP_CLICK =
    /wipe all|delete user|stop active simulation|launch \d+ cyclists|logout|collapse sidebar|toggle colour|toggle color|toggle menu|sign in|toggle password|impersonate/i;

/** Clicks only buttons inside main content — avoids shell logout/theme. */
async function safeClickMainButtons(page, report, section) {
    const main = page.locator('.mantine-AppShell-main, [class*="AppShell-main"], main').first();
    const buttons = main.locator('button:visible, [role="button"]:visible');
    const n = Math.min(await buttons.count(), 35);
    for (let i = 0; i < n; i++) {
        const btn = buttons.nth(i);
        const label = ((await btn.innerText().catch(() => '')) || (await btn.getAttribute('aria-label')) || '').trim();
        if (!label || SKIP_CLICK.test(label)) {
            if (label) report.push({ section, skip: label });
            continue;
        }
        try {
            await btn.click({ timeout: 3000 });
            await page.waitForTimeout(500);
            report.push({ section, clicked: label.slice(0, 60) });
        } catch (e) {
            report.push({ section, clickFail: label.slice(0, 40), err: e.message.slice(0, 80) });
        }
    }
}

async function login(page) {
    await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.getByLabel('Username or Email').fill(USER);
    await page.getByPlaceholder('Enter your password').fill(PASS);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForFunction(() => !window.location.hash.includes('/login'), { timeout: 90000 });
    await page.waitForTimeout(1200);
}

async function ensureLoggedIn(page, report, hash) {
    const onLogin =
        page.url().includes('/login') ||
        (await page.getByRole('button', { name: 'Sign in' }).isVisible().catch(() => false));
    if (onLogin) {
        report.push({ relogin: hash });
        await login(page);
        const h = hash.startsWith('#') ? hash : `#${hash}`;
        await page.goto(`${BASE}/${h}`, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(1500);
    }
}

async function closeOverlays(page) {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    const close = page.locator('[aria-label="Close"], button:has-text("Cancel"), button:has-text("Close")').first();
    if (await close.isVisible().catch(() => false)) {
        await close.click({ timeout: 2000 }).catch(() => {});
        await page.waitForTimeout(400);
    }
}

async function auditUsers(page, report) {
    await page.goto(`${BASE}/#/owner/users`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    const auditTab = page.getByRole('tab', { name: /audit log/i });
    if (await auditTab.isVisible().catch(() => false)) {
        await auditTab.click();
        await page.waitForTimeout(1500);
        await page.screenshot({ path: path.join(OUT, 'users-audit-tab.png') });
        report.push({ users: 'audit tab opened' });
        await page.getByRole('tab', { name: /users registry/i }).click().catch(() => {});
        await page.waitForTimeout(800);
    }

    await page.getByRole('button', { name: /create user/i }).click({ timeout: 5000 });
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(OUT, 'users-create-modal.png') });
    report.push({ users: 'create modal' });
    await closeOverlays(page);

    await page.getByRole('button', { name: /invite staff/i }).click({ timeout: 5000 });
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(OUT, 'users-invite-modal.png') });
    report.push({ users: 'invite modal' });
    await closeOverlays(page);

    const eye = page.locator('table tbody tr').first().locator('button').first();
    if (await eye.isVisible().catch(() => false)) {
        await eye.click();
        await page.waitForTimeout(1200);
        await page.screenshot({ path: path.join(OUT, 'users-edit-drawer.png'), fullPage: true });
        report.push({ users: 'edit drawer opened' });
        const drawerText = await page.locator('.mantine-Drawer-content, [class*="Drawer"]').first().innerText().catch(() => '');
        report.push({ usersDrawerSnippet: drawerText.slice(0, 500) });
        await closeOverlays(page);
    }

    const lockBtn = page.locator('table tbody tr').first().getByRole('button').nth(1);
    if (await lockBtn.isVisible().catch(() => false)) {
        report.push({ users: 'lock toggle present (not clicked)' });
    }
}

async function auditActivities(page, report) {
    const link = page.locator('table tbody tr a, table tbody tr button').first();
    if (await link.isVisible().catch(() => false)) {
        await link.click().catch(() => {});
        await page.waitForTimeout(2000);
        if (page.url().includes('activities/')) {
            await page.screenshot({ path: path.join(OUT, 'activity-detail.png') });
            report.push({ activities: 'detail opened', url: page.url() });
        }
    }
}

async function main() {
    if (!PASS) {
        console.error('ADMIN_PASS required');
        process.exit(1);
    }
    fs.mkdirSync(OUT, { recursive: true });
    const report = { started: new Date().toISOString(), findings: [], routes: [] };

    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

    try {
        await login(page);
        report.findings.push({ login: 'ok', url: page.url() });

        for (const route of ROUTES) {
            console.log(`→ ${route.id}`);
            const t0 = Date.now();
            await page.goto(`${BASE}/${route.hash}`, { waitUntil: 'domcontentloaded', timeout: 90000 });
            await page.waitForTimeout(2200);
            await ensureLoggedIn(page, report.findings, route.hash);

            const header = await page.locator('h1, [class*="title"]').first().textContent().catch(() => '');
            const body = await page.locator('main, [class*="AppShell-main"], .mantine-AppShell-main').first().innerText().catch(() =>
                page.locator('body').innerText(),
            );
            const entry = {
                id: route.id,
                ms: Date.now() - t0,
                title: (header || '').trim().slice(0, 100),
                empty: /will appear here|no .* found|unable to load/i.test(body),
                error: /failed to load|access denied|error/i.test(body.slice(0, 1500)),
                snippet: body.replace(/\s+/g, ' ').slice(0, 280),
            };
            report.routes.push(entry);

            await page.screenshot({ path: path.join(OUT, `${route.id}.png`) });

            if (route.id === 'users') {
                await auditUsers(page, report.findings);
            }
            if (route.id === 'activities') {
                await auditActivities(page, report.findings);
            }

            const tabs = page.getByRole('tab');
            const tabCount = await tabs.count();
            for (let t = 0; t < Math.min(tabCount, 6); t++) {
                const tab = tabs.nth(t);
                const name = await tab.innerText().catch(() => `tab-${t}`);
                try {
                    await tab.click({ timeout: 3000 });
                    await page.waitForTimeout(700);
                    report.findings.push({ route: route.id, tab: name.trim() });
                } catch { /* */ }
            }

            await safeClickMainButtons(page, report.findings, route.id);
            await closeOverlays(page);
        }

        report.finished = new Date().toISOString();
    } catch (e) {
        report.fatal = String(e);
        await page.screenshot({ path: path.join(OUT, 'fatal.png') }).catch(() => {});
    } finally {
        fs.writeFileSync(path.join(OUT, 'audit-report.json'), JSON.stringify(report, null, 2));
        await browser.close();
    }
    console.log(`Done → ${OUT}/audit-report.json`);
}

main();
