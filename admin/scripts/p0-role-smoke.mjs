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
    paths: ['/owner/dashboard', '/owner/users', '/owner/analytics/simulator'],
  },
  {
    role: 'TENANT_ADMIN',
    user: process.env.ADMIN_USER_TENANT_ADMIN,
    pass: process.env.ADMIN_PASS_TENANT_ADMIN,
    paths: ['/owner/dashboard', '/owner/users', '/owner/white-label'],
  },
  {
    role: 'TENANT_MODERATOR',
    user: process.env.ADMIN_USER_MODERATOR,
    pass: process.env.ADMIN_PASS_MODERATOR,
    paths: ['/owner/dashboard', '/owner/activities', '/owner/moderation'],
  },
  {
    role: 'SPONSOR',
    user: process.env.ADMIN_USER_SPONSOR,
    pass: process.env.ADMIN_PASS_SPONSOR,
    paths: ['/owner/sponsor', '/owner/sponsor/poi', '/owner/analytics/vouchers', '/owner/analytics/sponsorship'],
  },
];

async function login(page, username, password) {
  await page.goto(`${BASE}/#/login`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.getByLabel(/username|email/i).fill(username);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole('button', { name: /sign in|log in|zaloguj/i }).click();
  await page.waitForURL(/#\/owner\//, { timeout: 30000 });
}

async function checkPath(page, hashPath) {
  await page.goto(`${BASE}/#${hashPath}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(800);
  const denied = await page.getByText(/access denied|unauthorized/i).count();
  const login = await page.getByLabel(/password/i).count();
  if (denied > 0) return { ok: false, reason: 'access_denied' };
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
