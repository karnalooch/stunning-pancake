/**
 * Authenticated API latency audit for admin-critical endpoints.
 * Runs warm + cold (refresh=1) passes and writes JSON report.
 *
 * Usage:
 *   ADMIN_PASS='***' node scripts/audit-admin-perf.mjs
 *   BACKEND_URL=https://backend-production-55c7.up.railway.app ADMIN_PASS='***' node scripts/audit-admin-perf.mjs
 */
import fs from 'fs';
import path from 'path';

const BACKEND =
    process.env.BACKEND_URL || 'https://backend-production-55c7.up.railway.app';
const USER = process.env.ADMIN_USER || 'global_owner';
const PASS = process.env.ADMIN_PASS || '';
const SAMPLES = Math.min(Math.max(parseInt(process.env.PERF_SAMPLES || '5', 10), 1), 15);
const OUT = path.join(process.cwd(), 'audit-screenshots');

const API_BASE = `${BACKEND.replace(/\/$/, '')}/api`;

/** @type {{ path: string, label: string, expected: 'optimize'|'loading'|'ok', query?: string }[]} */
const ENDPOINTS = [
    { path: '/activities/admin/stats/', label: 'Admin Stats', expected: 'optimize' },
    { path: '/activities/admin/stats/', label: 'Admin Stats (cold)', expected: 'optimize', query: 'refresh=1' },
    { path: '/activities/ai/insights/', label: 'AI Insights', expected: 'optimize' },
    { path: '/activities/analytics/department/', label: 'Department Analytics', expected: 'optimize' },
    { path: '/activities/analytics/', label: 'Trend Analytics', expected: 'loading' },
    { path: '/activities/telemetry/live/', label: 'Telemetry Live', expected: 'loading', query: 'bbox=19,49,20,50&zoom=6' },
    { path: '/activities/sessions/', label: 'Sessions', expected: 'loading' },
    { path: '/users/audit-log/', label: 'Audit Log', expected: 'loading', query: 'limit=50' },
    { path: '/infra/health/', label: 'Infra Health', expected: 'ok' },
    { path: '/users/all/', label: 'Users All', expected: 'ok', query: 'page_size=25' },
    { path: '/activities/admin/all/', label: 'Activities Admin', expected: 'ok', query: 'page=1&page_size=25' },
    { path: '/activities/telemetry/anomalies/', label: 'Telemetry Anomalies', expected: 'ok' },
    { path: '/rewards/sponsor-stats/', label: 'Sponsor Stats', expected: 'ok' },
    { path: '/users/departments/', label: 'Departments', expected: 'loading' },
    { path: '/users/departments/tree/', label: 'Department Tree', expected: 'loading' },
];

function percentile(sorted, p) {
    if (!sorted.length) return 0;
    const idx = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, idx)];
}

function classifyVerdict(expected, p95, status) {
    if (status >= 400) return 'error';
    if (expected === 'optimize' && p95 > 800) return 'optimize';
    if (expected === 'loading' && p95 > 1500) return 'loading';
    if (p95 <= 800) return 'ok';
    if (expected === 'loading') return 'loading';
    return expected;
}

async function login() {
    const res = await fetch(`${API_BASE}/auth/token/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: USER, password: PASS }),
        signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`Login failed ${res.status}: ${text.slice(0, 200)}`);
    }
    const data = await res.json();
    return data.access;
}

async function measureEndpoint(token, ep) {
    const url = `${API_BASE}${ep.path}${ep.query ? `?${ep.query}` : ''}`;
    const times = [];
    let lastStatus = 0;
    let lastBytes = 0;
    let lastError = null;

    for (let i = 0; i < SAMPLES; i++) {
        const t0 = performance.now();
        try {
            const res = await fetch(url, {
                method: 'GET',
                headers: { Authorization: `Bearer ${token}` },
                signal: AbortSignal.timeout(60000),
            });
            const body = await res.arrayBuffer();
            times.push(Math.round(performance.now() - t0));
            lastStatus = res.status;
            lastBytes = body.byteLength;
        } catch (err) {
            lastError = err.message || String(err);
            times.push(Math.round(performance.now() - t0));
        }
        await new Promise((r) => setTimeout(r, 120));
    }

    const sorted = [...times].sort((a, b) => a - b);
    const p50 = percentile(sorted, 50);
    const p95 = percentile(sorted, 95);
    const verdict = lastError
        ? 'error'
        : classifyVerdict(ep.expected, p95, lastStatus);

    return {
        endpoint: ep.path + (ep.query ? `?${ep.query}` : ''),
        label: ep.label,
        expected: ep.expected,
        samples: SAMPLES,
        p50_ms: p50,
        p95_ms: p95,
        min_ms: sorted[0] ?? 0,
        max_ms: sorted[sorted.length - 1] ?? 0,
        bytes: lastBytes,
        status: lastStatus,
        verdict,
        notes: lastError
            ? lastError
            : ep.expected === 'optimize' && p95 > 500
              ? 'Consider cache or aggregate query'
              : ep.expected === 'loading' && p95 > 1000
                ? 'Ensure skeleton/boot overlay on frontend'
                : '',
    };
}

async function main() {
    if (!PASS) {
        console.error('ADMIN_PASS required');
        process.exit(1);
    }
    fs.mkdirSync(OUT, { recursive: true });

    const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const report = {
        started: new Date().toISOString(),
        backend: BACKEND,
        user: USER,
        samples: SAMPLES,
        results: [],
    };

    console.log(`\n═══ Admin API Perf Audit ═══\nBackend: ${BACKEND}\nSamples: ${SAMPLES}\n`);

    const token = await login();
    console.log('Login OK\n');

    for (const ep of ENDPOINTS) {
        process.stdout.write(`  → ${ep.label}... `);
        const row = await measureEndpoint(token, ep);
        report.results.push(row);
        const icon = row.verdict === 'ok' ? '✅' : row.verdict === 'error' ? '❌' : row.verdict === 'optimize' ? '🔧' : '⏳';
        console.log(`${icon} p50=${row.p50_ms}ms p95=${row.p95_ms}ms [${row.verdict}]`);
    }

    report.finished = new Date().toISOString();
    report.summary = {
        optimize: report.results.filter((r) => r.verdict === 'optimize').length,
        loading: report.results.filter((r) => r.verdict === 'loading').length,
        ok: report.results.filter((r) => r.verdict === 'ok').length,
        error: report.results.filter((r) => r.verdict === 'error').length,
    };

    const outFile = path.join(OUT, `perf-audit-${stamp}.json`);
    fs.writeFileSync(outFile, JSON.stringify(report, null, 2));
    console.log(`\nDone → ${outFile}`);
    console.log(`Summary: ${report.summary.ok} ok, ${report.summary.optimize} optimize, ${report.summary.loading} loading, ${report.summary.error} error\n`);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
