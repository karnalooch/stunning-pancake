#!/usr/bin/env node
/**
 * P0 role smoke — automated nav + page load per role.
 * Usage:
 *   ADMIN_URL=https://admin-production.example.app \
 *   ADMIN_USER_GLOBAL_OWNER=global_owner ADMIN_PASS_GLOBAL_OWNER='…' \
 *   ADMIN_USER_TENANT_ADMIN=tenant_admin ADMIN_PASS_TENANT_ADMIN='…' \
 *   node scripts/p0-role-smoke.mjs
 *
 * Optional roles: ADMIN_USER_MODERATOR, ADMIN_USER_SPONSOR (+ matching _PASS_*).
 * Exit 0 = all tested roles PASS; 1 = any failure.
 */
import { chromium } from 'playwright';

const BASE = (process.env.ADMIN_URL || 'http://localhost:5173').replace(/\/$/, '');

const ROLE_SPECS = [
  {
    role: 'GLOBAL_OWNER',
    user: process.env.ADMIN_USER_GLOBAL_OWNER || process.env.ADMIN_USER,
    pass: process.env.ADMIN_PASS_GLOBAL_OWNER || process.env.ADMIN_PASS,
    paths: [
      '/owner/dashboard',
      '/owner/users',
      '/owner/analytics/simulator',
      '/owner/analytics/revenue',
      '/owner/control-plane/inbox',
    ],
  },
  {
    role: 'TENANT_ADMIN',
    user: process.env.ADMIN_USER_TENANT_ADMIN,
    pass: process.env.ADMIN_PASS_TENANT_ADMIN,
    paths: [
      '/owner/dashboard',
      '/owner/users',
      '/owner/white-label',
      '/owner/moderation',
      '/owner/analytics/feedback',
      '/owner/analytics/export',
      '/owner/analytics/audit-log',
      '/owner/analytics/departments',
    ],
    forbiddenPaths: [
      '/owner/system/rbac',
      '/owner/system/feature-flags',
      '/owner/analytics/simulator',
      '/owner/analytics/revenue',
      '/owner/premium/ai-coach',
    ],
  },
  {
    role: 'TENANT_MODERATOR',
    user: process.env.ADMIN_USER_MODERATOR,
    pass: process.env.ADMIN_PASS_MODERATOR,
    paths: ['/owner/dashboard', '/owner/activities', '/owner/moderation', '/owner/moderation/history'],
  },
  {
    role: 'SPONSOR',
    user: process.env.ADMIN_USER_SPONSOR,
    pass: process.env.ADMIN_PASS_SPONSOR,
    paths: [
      '/owner/sponsor',
      '/owner/sponsor/poi',
      '/owner/sponsor/campaigns',
      '/owner/analytics/vouchers',
      '/owner/analytics/sponsorship',
    ],
  },
];

async function login(page, username, password) {
  await page.goto(`${BASE}/#/login`, { waitUntil: 'load', timeout: 120000 });
  const userInput = page
    .locator('input[autocomplete="username"], input[name="username"]')
    .first();
  await userInput.waitFor({ state: 'visible', timeout: 60000 });
  await userInput.fill(username);
  await page.locator('input[type="password"]').first().fill(password);
  await page.getByRole('button', { name: /sign in|log in|zaloguj/i }).click();
  await page.waitForURL(/#\/owner\//, { timeout: 60000 });
}

async function checkPath(page, hashPath) {
  await page.goto(`${BASE}/#${hashPath}`, { waitUntil: 'load', timeout: 60000 });
  await page.waitForTimeout(1200);
  if (/#\/unauthorized/.test(page.url())) return { ok: false, reason: 'access_denied' };
  const deniedHeading = await page.getByRole('heading', {
    name: /access denied|unauthorized|brak dostępu/i,
  }).count();
  const login = await page.locator('input[type="password"]').count();
  if (deniedHeading > 0) return { ok: false, reason: 'access_denied' };
  if (login > 0) return { ok: false, reason: 'not_authenticated' };
  return { ok: true };
}

async function runRole(browser, spec) {
  if (!spec.user || !spec.pass) {
    return { role: spec.role, skipped: true, reason: 'missing credentials' };
  }
  const context = await browser.newContext();
  const page = await context.newPage();
  const failures = [];
  try {
    await login(page, spec.user, spec.pass);
    for (const p of spec.paths) {
      const r = await checkPath(page, p);
      if (!r.ok) failures.push({ path: p, reason: r.reason });
    }
    for (const p of spec.forbiddenPaths ?? []) {
      const r = await checkPath(page, p);
      if (r.ok) failures.push({ path: p, reason: 'should_be_denied' });
    }
  } catch (e) {
    failures.push({ path: 'login', reason: String(e.message || e) });
  } finally {
    await context.close();
  }
  return { role: spec.role, skipped: false, failures, pass: failures.length === 0 };
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const results = [];
  for (const spec of ROLE_SPECS) {
    const r = await runRole(browser, spec);
    results.push(r);
    if (r.skipped) {
      console.log(`[SKIP] ${r.role}: ${r.reason}`);
    } else if (r.pass) {
      console.log(`[PASS] ${r.role}`);
    } else {
      console.log(`[FAIL] ${r.role}:`, JSON.stringify(r.failures));
    }
  }
  await browser.close();

  const report = {
    at: new Date().toISOString(),
    base: BASE,
    results,
    pass: results.filter((r) => !r.skipped).every((r) => r.pass),
  };
  const fs = await import('node:fs');
  const reportPath = process.env.P0_SMOKE_REPORT || 'p0-smoke-report.json';
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`Report: ${reportPath}`);

  const tested = results.filter((r) => !r.skipped);
  const failed = tested.filter((r) => !r.pass);
  if (tested.length === 0) {
    console.error('No role credentials provided — set ADMIN_USER / ADMIN_PASS at minimum.');
    process.exit(1);
  }
  process.exit(failed.length > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
