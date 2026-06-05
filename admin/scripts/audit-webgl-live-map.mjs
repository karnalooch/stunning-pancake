/**
 * WebGL audit — source vs rendered clusters across Chromium GL backends.
 *
 * Local:  cross-env E2E_FORCE_WEB_SERVER=1 npm run dev  (or audit spawns via playwright webServer)
 *   node scripts/audit-webgl-live-map.mjs
 *
 * Prod (badges only, no E2E bridge): ADMIN_PASS=... node scripts/audit-webgl-live-map.mjs --prod
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { mockLiveTelemetryBody } from '../e2e/fixtures/liveMapTelemetry.ts';

const OUT = path.join(process.cwd(), 'audit-screenshots');
const PROD = process.argv.includes('--prod');
const BASE = PROD
    ? process.env.ADMIN_URL || 'https://admin-production-083b.up.railway.app'
    : process.env.E2E_BASE_URL || 'http://localhost:3000';

const GL_PROFILES = PROD
    ? [
          { name: 'prod-headless-angle', headless: true, args: ['--use-gl=angle', '--enable-webgl'] },
          { name: 'prod-headed-angle', headless: false, args: ['--use-gl=angle', '--enable-webgl'] },
      ]
    : [
          { name: 'headless-angle', headless: true, args: ['--use-gl=angle', '--enable-webgl'] },
          { name: 'headless-swiftshader', headless: true, args: ['--use-gl=swiftshader', '--enable-webgl'] },
          { name: 'headless-default', headless: true, args: ['--enable-webgl'] },
          { name: 'headed-angle', headless: false, args: ['--use-gl=angle', '--enable-webgl'] },
      ];

const WARSAW = [21.0122, 52.2297];
const KRAKOW = [19.945, 50.0647];

fs.mkdirSync(OUT, { recursive: true });

async function probeWebGL(page) {
    return page.evaluate(() => {
        const canvas = document.createElement('canvas');
        const out = { webgl1: false, webgl2: false, renderer: null, vendor: null };
        const gl1 = canvas.getContext('webgl');
        if (gl1) {
            out.webgl1 = true;
            const dbg = gl1.getExtension('WEBGL_debug_renderer_info');
            if (dbg) {
                out.renderer = gl1.getParameter(dbg.UNMASKED_RENDERER_WEBGL);
                out.vendor = gl1.getParameter(dbg.UNMASKED_VENDOR_WEBGL);
            }
        }
        out.webgl2 = Boolean(canvas.getContext('webgl2'));
        return out;
    });
}

async function setupLocalMocks(page) {
    await page.addInitScript(() => {
        sessionStorage.setItem('playwright-e2e', '1');
    });
    await page.route('**/api/**', async (route) => {
        const url = route.request().url();
        const method = route.request().method();
        const json = (body) =>
            route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });

        if (url.includes('/auth/token/') && method === 'POST') {
            return json({ access: 't', refresh: 'r' });
        }
        if (url.includes('/users/profile/')) {
            return json({ data: { id: 1, username: 'admin', role: 'GLOBAL_OWNER', tenant_id: null } });
        }
        if (url.includes('/users/rbac/user-roles/my_roles/')) {
            return json([]);
        }
        if (url.includes('/infra/health/')) {
            return json({ status: 'ok', backend: { status: 'ok' }, postgresql: { status: 'ok' }, redis: { status: 'ok' }, celery: { status: 'ok' } });
        }
        if (url.includes('/activities/telemetry/config/')) {
            return json({ poll_interval_ms: 2000, stream_interval_ms: 5000 });
        }
        if (url.includes('/activities/telemetry/live/')) {
            const u = new URL(url);
            return json(mockLiveTelemetryBody(u.searchParams.get('detail'), u.searchParams.get('bbox')));
        }
        return json({});
    });
}

async function loginProd(page) {
    const pass = process.env.ADMIN_PASS;
    if (!pass) throw new Error('ADMIN_PASS required for --prod');
    await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 90_000 });
    await page.getByLabel('Username or Email').fill(process.env.ADMIN_USER || 'global_owner');
    await page.getByPlaceholder('Enter your password').fill(pass);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForFunction(() => !window.location.hash.includes('/login'), { timeout: 90_000 });
}

async function openLiveMap(page) {
    await page.goto(`${BASE}/#/owner/analytics/live-map`, { waitUntil: 'load', timeout: 120_000 });
    await page.waitForSelector('[data-testid=live-map-root][data-map-ready=true]', { timeout: 120_000 });
}

async function flyToMesoProd(page) {
    const ranking = page.getByTestId('live-map-city-ranking');
    await ranking.waitFor({ state: 'visible', timeout: 60_000 });
    await ranking.getByRole('button').first().click();
    await page.waitForTimeout(3500);
    await page.waitForFunction(
        () => document.querySelector('[data-testid=live-map-zoom-mode]')?.textContent?.trim() === 'Meso',
        { timeout: 60_000 },
    );
}

async function runTierAudit(page, zoom, center) {
    if (PROD) {
        return page.evaluate(() => ({
            prod: true,
            onMap: document.querySelector('[data-testid=live-map-drawn-count]')?.textContent?.trim(),
            rendered: document.querySelector('[data-testid=live-map-rendered-count]')?.textContent?.trim(),
            mode: document.querySelector('[data-testid=live-map-zoom-mode]')?.textContent?.trim(),
        }));
    }
    await page.evaluate(
        ({ zoom, center }) => {
            window.__liveMapE2E?.setZoom(zoom, center);
        },
        { zoom, center },
    );
    await page.waitForTimeout(3500);
    return page.evaluate(() => window.__liveMapE2E?.getWebGlAudit?.() ?? { error: 'no bridge' });
}

const report = { started: new Date().toISOString(), base: BASE, prod: PROD, profiles: [] };

for (const profile of GL_PROFILES) {
    console.log(`\n─── ${profile.name} ───`);
    const entry = { profile: profile.name, webgl: null, meso: null, micro: null, error: null };
    const browser = await chromium.launch({ headless: profile.headless, args: profile.args });
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    page.setDefaultTimeout(120_000);

    try {
        entry.webgl = await probeWebGL(page);
        console.log('  WebGL probe:', entry.webgl.renderer || entry.webgl);

        if (PROD) {
            await loginProd(page);
            await openLiveMap(page);
            await flyToMesoProd(page);
            entry.meso = await runTierAudit(page);
            console.log('  Meso (prod):', entry.meso);
        } else {
            await setupLocalMocks(page);
            await page.goto(`${BASE}/#/owner/analytics/live-map`, { waitUntil: 'load', timeout: 120_000 });
            await page.waitForSelector('[data-testid=live-map-root]', { timeout: 120_000 });
            await page.waitForSelector('[data-testid=live-map-root][data-map-ready=true]', { timeout: 120_000 });
            await page.waitForFunction(() => window.__liveMapE2E?.isReady?.(), { timeout: 120_000 });

            entry.meso = await runTierAudit(page, 10, WARSAW);
            console.log('  Meso:', entry.meso);

            entry.micro = await runTierAudit(page, 13.5, KRAKOW);
            console.log('  Micro:', entry.micro);
        }

        const slug = profile.name.replace(/[^a-z0-9]+/gi, '-');
        await page.screenshot({ path: path.join(OUT, `webgl-audit-${slug}-final.png`) });
    } catch (e) {
        entry.error = String(e);
        console.log('  ERROR:', entry.error);
    } finally {
        await browser.close();
    }
    report.profiles.push(entry);
}

report.finished = new Date().toISOString();
report.summary = report.profiles.map((p) => {
    const m = p.meso || {};
    const mi = p.micro || {};
    return {
        profile: p.profile,
        renderer: p.webgl?.renderer,
        mesoSrcCl: m.sourceClusters,
        mesoRndCl: m.renderedClusters,
        microSrcPt: mi.sourcePoints,
        microRndPt: mi.renderedPoints,
        mesoGap: m.sourceClusters > 0 && m.renderedClusters === 0,
        microOk: (mi.renderedPoints ?? 0) > 0 || (mi.sourcePoints ?? 0) === 0,
    };
});

const outPath = path.join(OUT, 'webgl-audit-report.json');
fs.writeFileSync(outPath, JSON.stringify(report, null, 2));

console.log('\n═══ WebGL Audit Summary ═══');
for (const s of report.summary) {
    console.log(
        `${s.profile.padEnd(24)} ${(s.renderer || 'no-gl').slice(0, 40).padEnd(40)} meso src/rnd ${s.mesoSrcCl ?? '?'}/${s.mesoRndCl ?? '?'} micro ${s.microSrcPt ?? '?'}/${s.microRndPt ?? '?'}`,
    );
}
console.log(`\nReport: ${outPath}\n`);

process.exit(report.profiles.some((p) => p.error) ? 1 : 0);
