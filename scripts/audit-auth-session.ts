/**
 * Auth session audit — prevents regressions in admin token hydration and dashboard stats.
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const ADMIN = resolve(ROOT, 'admin/src');
const BACKEND = resolve(ROOT, 'backend');

interface Finding {
  file: string;
  message: string;
  severity: 'ERROR' | 'WARNING';
}

const findings: Finding[] = [];

function mustInclude(file: string, patterns: string[], label: string) {
  const path = resolve(ROOT, file);
  if (!existsSync(path)) {
    findings.push({ file, message: `Missing file: ${file}`, severity: 'ERROR' });
    return;
  }
  const src = readFileSync(path, 'utf-8');
  for (const p of patterns) {
    if (!src.includes(p)) {
      findings.push({ file, message: `${label}: expected "${p}"`, severity: 'ERROR' });
    }
  }
}

function mustNotInclude(file: string, pattern: string, label: string) {
  const path = resolve(ROOT, file);
  if (!existsSync(path)) return;
  const src = readFileSync(path, 'utf-8');
  if (src.includes(pattern)) {
    findings.push({ file, message: label, severity: 'ERROR' });
  }
}

console.log('🔍 Auth session & admin stats audit...\n');

mustInclude('admin/src/api/client.ts', [
  'getStoredAccessToken',
  'getStoredRefreshToken',
], 'API client must fall back to localStorage tokens');

mustInclude('admin/src/core/auth/useAuth.ts', [
  'useAuth.setState({ token: storedToken, refreshToken: storedRefresh })',
], 'useAuth must sync tokens before async profile load');

mustInclude('admin/src/core/auth/tokens.ts', [
  'getStoredAccessToken',
  'hasStoredSession',
  'clearStoredSession',
  'isAuthApiPath',
], 'tokens helper module');

mustInclude('admin/src/api/client.ts', [
  'isAuthApiPath',
], 'API client must skip Bearer on auth/token paths');

mustInclude('admin/src/App.tsx', [
  'clearStoredSession',
  "axios.post(`${baseURL}/auth/token/`",
], 'password login must clear stale tokens and use plain axios');

mustNotInclude(
  'backend/activities/admin_stats.py',
  'dept.members',
  'admin_stats must use get_member_count(), not dept.members',
);

mustInclude('backend/activities/admin_stats.py', [
  'def _batch_or_live_running',
  'except Exception',
], 'Redis/simulator state check must not crash stats');

mustInclude('backend/activities/admin_views.py', [
  'HTTP_503_SERVICE_UNAVAILABLE',
  'stats_unavailable',
], 'AdminDashboardStatsView must return 503 on failure, not 500');

const liveMapPath = resolve(ADMIN, 'modules/analytics/LiveMap.tsx');
if (existsSync(liveMapPath)) {
  const live = readFileSync(liveMapPath, 'utf-8');
  if (!live.includes('canFetch') || !live.includes('hasStoredSession')) {
    findings.push({
      file: 'admin/src/modules/analytics/LiveMap.tsx',
      message: 'LiveMap must gate polling on auth (canFetch / hasStoredSession)',
      severity: 'ERROR',
    });
  }
}

const dashboardPath = resolve(ADMIN, 'modules/dashboard/Dashboard.tsx');
if (existsSync(dashboardPath)) {
  const dash = readFileSync(dashboardPath, 'utf-8');
  if (!dash.includes('[user]') && !dash.includes(', user)')) {
    findings.push({
      file: 'admin/src/modules/dashboard/Dashboard.tsx',
      message: 'Dashboard stats fetch should depend on authenticated user',
      severity: 'WARNING',
    });
  }
}

if (findings.length) {
  console.log(`❌ ${findings.length} finding(s):\n`);
  for (const f of findings) {
    console.log(`  [${f.severity}] ${f.file}`);
    console.log(`    ${f.message}\n`);
  }
  process.exit(findings.some((f) => f.severity === 'ERROR') ? 1 : 0);
}

console.log('✅ Auth session audit passed.');
process.exit(0);
