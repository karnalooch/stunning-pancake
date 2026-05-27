/**
 * Production Health Audit — checks backend + admin endpoints for availability,
 * response times, and HTTP status codes.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const BACKEND_URL = 'https://backend-production-55c7.up.railway.app';
const ADMIN_URL = 'https://admin-production-083b.up.railway.app';

/* ─── Endpoints to check ─────────────────────────────────── */
const ENDPOINTS = [
  { method: 'GET', url: '/api/activities/admin/stats/', label: 'Admin Stats' },
  { method: 'GET', url: '/api/users/all/', label: 'Users All' },
  { method: 'GET', url: '/api/users/departments/', label: 'Departments' },
  { method: 'GET', url: '/api/users/departments/tree/', label: 'Department Tree' },
  { method: 'GET', url: '/api/rewards/sponsor-stats/', label: 'Sponsor Stats' },
  { method: 'GET', url: '/api/activities/telemetry/live/', label: 'Telemetry Live' },
  { method: 'GET', url: '/api/activities/telemetry/config/', label: 'Telemetry Config' },
  { method: 'GET', url: '/api/activities/analytics/', label: 'Analytics' },
  { method: 'GET', url: '/api/users/audit-log/', label: 'Audit Log' },
  { method: 'GET', url: '/api/activities/sessions/', label: 'Sessions' },
  { method: 'GET', url: '/api/infra/health/', label: 'Infra Health' },
  { method: 'GET', url: '/api/docs/', label: 'Swagger Docs' },
  { method: 'GET', url: '/api/activities/ai/insights/', label: 'AI Insights' },
  { method: 'GET', url: '/api/activities/admin/simulate/', label: 'Simulator Status' },
  { method: 'GET', url: '/api/activities/admin/live-simulate/', label: 'Live Sim Status' },
  { method: 'GET', url: '/', label: 'Admin Root' },
];

/* ─── HTTP Check ──────────────────────────────────────────── */
async function checkEndpoint(method: string, url: string, label: string): Promise<{ status: number; time: number; error?: string }> {
  const start = Date.now();
  try {
    const res = await fetch(url, { method, signal: AbortSignal.timeout(10000) });
    return { status: res.status, time: Date.now() - start };
  } catch (err: any) {
    return { status: 0, time: Date.now() - start, error: err.message || 'Connection failed' };
  }
}

/* ─── Main ────────────────────────────────────────────────── */
async function main(): Promise<never> {
  console.log('\n═══ Production Health Audit ═══\n');
  console.log(`Backend: ${BACKEND_URL}`);
  console.log(`Admin:   ${ADMIN_URL}\n`);

  let errors = 0;
  let warnings = 0;
  const results: { label: string; status: number; time: number; error?: string }[] = [];

  for (const ep of ENDPOINTS) {
    const baseUrl = ep.url.startsWith('/api') ? BACKEND_URL : ADMIN_URL;
    const fullUrl = `${baseUrl}${ep.url}`;
    const result = await checkEndpoint(ep.method, fullUrl, ep.label);
    results.push({ ...result, label: ep.label });

    // 401 = needs auth (expected), 200 = OK, other = problem
    if (result.status === 401) {
      console.log(`  ✅  ${ep.label.padEnd(22)} ${result.status} (auth required) — ${result.time}ms`);
    } else if (result.status >= 200 && result.status < 300) {
      console.log(`  ✅  ${ep.label.padEnd(22)} ${result.status} OK — ${result.time}ms`);
    } else if (result.status === 0) {
      console.log(`  ❌  ${ep.label.padEnd(22)} DOWN — ${result.error || 'no response'}`);
      errors++;
    } else if (result.status >= 500) {
      console.log(`  ❌  ${ep.label.padEnd(22)} ${result.status} SERVER ERROR`);
      errors++;
    } else if (result.status >= 400) {
      console.log(`  ⚠️  ${ep.label.padEnd(22)} ${result.status} — ${result.time}ms`);
      warnings++;
    }

    // Rate limit
    await new Promise(r => setTimeout(r, 100));
  }

  // Summary
  const down = results.filter(r => r.status === 0).length;
  const serverErrors = results.filter(r => r.status >= 500).length;
  const slowResponses = results.filter(r => r.time > 2000).length;

  console.log(`\n─── Summary ───`);
  console.log(`  Total checks: ${results.length}`);
  console.log(`  Down: ${down}`);
  console.log(`  Server errors (5xx): ${serverErrors}`);
  console.log(`  Auth required (401): ${results.filter(r => r.status === 401).length}`);
  console.log(`  Slow responses (>2s): ${slowResponses}`);
  console.log(`  Avg response time: ${Math.round(results.reduce((s, r) => s + r.time, 0) / results.length)}ms`);

  if (down > 0) {
    console.log('\n🔴 CRITICAL: Some endpoints are DOWN');
  }
  if (serverErrors > 0) {
    console.log('\n🔴 Server errors detected');
  }
  if (down > 0 || serverErrors > 0) {
    console.log('\n🔴 AUDIT FAILED\n');
    process.exit(1);
  }
  console.log('\n🟢 All endpoints responding\n');
  process.exit(0);
}

main();
