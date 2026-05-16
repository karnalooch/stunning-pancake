/**
 * RBAC-Permission Consistency Audit — compares sidebar role requirements
 * (NAV_SECTIONS in Layout.tsx) with PermissionGuard permission requirements
 * (App.tsx <Route> elements).
 *
 * Issues detected:
 *   - ERROR: sidebar allows a role, but route's PermissionGuard doesn't list any
 *            permission that role has (user sees 403 after clicking)
 *   - WARNING: PermissionGuard uses a permission not in the known Django permission set
 *   - INFO: Role-permission mapping gaps
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');

/* ─── Known role-permission mapping (from docs/RBAC.md and backend models) ─── */
const ROLE_PERMISSIONS: Record<string, string[]> = {
  GLOBAL_OWNER: [
    'activities.view', 'activities.approve', 'activities.edit',
    'users.view', 'users.edit', 'users.create', 'users.delete',
    'poi.view', 'poi.edit', 'vouchers.view', 'vouchers.edit',
    'tenants.view', 'tenants.edit',
  ],
  TENANT_ADMIN: [
    'activities.view', 'activities.edit',
    'users.view',
    'users.edit',
  ],
  TENANT_MODERATOR: [
    'activities.view', 'activities.approve',
  ],
  SPONSOR: [
    'poi.view', 'vouchers.view',
  ],
};

/* ─── Sidebar entries with their allowed roles ──────────────── */
interface SidebarEntry {
  path: string;
  label: string;
  roles: string[];
}

function parseSidebarWithRoles(): SidebarEntry[] {
  const src = readFileSync(resolve(ROOT, 'admin/src/core/Layout.tsx'), 'utf-8');
  const lines = src.split('\n');

  const entries: SidebarEntry[] = [];

  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();

    // Find path: '/owner/...',
    if (!t.startsWith('path:')) continue;
    const pathM = t.match(/path:\s*['"](.+)['"]/);
    if (!pathM) continue;
    const path = pathM[1];

    // Find label from previous lines (look back up to 3 lines)
    let label = '';
    for (let j = i - 1; j >= Math.max(0, i - 3); j--) {
      const lblM = lines[j].trim().match(/label:\s*['"](.+)['"]/);
      if (lblM && !['OVERVIEW', 'MANAGEMENT', 'OPERATIONS', 'ANALYTICS', 'SYSTEM', 'Overview', 'Management', 'Operations', 'Analytics', 'System'].includes(lblM[1])) {
        label = lblM[1];
        break;
      }
    }
    if (!label) continue;

    // Find roles from following lines (look forward up to 3 lines, roles come after path)
    let currentRoles: string[] = [];
    for (let j = i + 1; j < Math.min(i + 4, lines.length); j++) {
      const rl = lines[j].trim();
      if (rl.startsWith('roles:')) {
        const m = rl.match(/roles:\s*\[([^\]]*)\]/);
        if (m) {
          currentRoles = m[1].split(',').map((r) => r.trim().replace(/['"]/g, '')).filter(Boolean);
          break;
        }
      }
    }

    entries.push({ path, label, roles: currentRoles });
  }

  return entries;
}

/* ─── Parse route → permissions from App.tsx ────────────────── */
interface RoutePerm {
  path: string;
  permissions: string[];
}

function parseRoutePermissions(): RoutePerm[] {
  const src = readFileSync(resolve(ROOT, 'admin/src/App.tsx'), 'utf-8');
  const lines = src.split('\n');

  const routes: RoutePerm[] = [];
  let currentPath = '';
  let currentPerms: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();

    if (t.startsWith('path=') || t.startsWith('path="') || t.startsWith("path='")) {
      const m = t.match(/path=["']([^"']*)["']/);
      if (m) currentPath = m[1];
    }

    if (t.includes('permissions={[')) {
      const m = t.match(/permissions=\{\s*\[(.*)\]\s*\}/);
      if (m) {
        currentPerms = m[1].split(',').map((p) => p.trim().replace(/['"]/g, ''));
      }
    }

    if (currentPath && currentPerms.length > 0 && t.includes('<PermissionGuard')) {
      // Already captured, will save on next path line or end
    }

    // Route end
    if (t.includes('/>') && currentPath) {
      routes.push({ path: currentPath, permissions: [...currentPerms] });
      currentPath = '';
      currentPerms = [];
    }
  }

  // Also handle routes that don't have separate PermissionGuard closure
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();
    const pathM = t.match(/path=["']([^"']*)["']/);
    if (pathM && !['*', '/login', '/unauthorized', '/', 'index'].includes(pathM[1])) {
      const path = pathM[1];
      // Look ahead for permissions
      for (let j = i; j < Math.min(i + 10, lines.length); j++) {
        const l = lines[j].trim();
        const permM = l.match(/permissions=\{\s*\[(.*)\]\s*\}/);
        if (permM) {
          const perms = permM[1].split(',').map((p) => p.trim().replace(/['"]/g, ''));
          if (!routes.some((r) => r.path === path)) {
            routes.push({ path, permissions: perms });
          }
          break;
        }
      }
    }
  }

  return routes;
}

/* ─── Main ──────────────────────────────────────────────────── */
function main(): never {
  console.log('\n═══ RBAC-Permission Consistency Audit ═══\n');

  const sidebar = parseSidebarWithRoles();
  const routes = parseRoutePermissions();

  console.log(`Sidebar entries: ${sidebar.length}`);
  console.log(`Routes with PermissionGuard: ${routes.length}\n`);

  let errors = 0;
  let warnings = 0;

  // Build route permissions lookup
  const routePermMap = new Map<string, string[]>();
  for (const r of routes) {
    routePermMap.set(r.path, r.permissions);
  }

  // Check each sidebar entry
  console.log('─── Sidebar role vs Route permission check ───');
  for (const entry of sidebar) {
    const rel = entry.path.replace(/^\/owner\//, '');
    const routePerms = routePermMap.get(rel) || [];

    if (routePerms.length === 0) {
      if (rel !== 'index' && rel !== '') {
        console.log(`  ⚠️  ${entry.path} (${entry.label}) — has sidebar roles [${entry.roles.join(', ')}] but no PermissionGuard`);
        warnings++;
      }
      continue;
    }

    // For each role allowed in sidebar, verify they have at least one matching permission
    for (const role of entry.roles) {
      const rolePerms = ROLE_PERMISSIONS[role] || [];
      const hasAccess = routePerms.some((rp) => rolePerms.includes(rp));

      if (!hasAccess && rolePerms.length > 0 && routePerms.length > 0) {
        console.log(`  ❌  ${entry.path} (${entry.label}) — ${role} can see link but lacks any matching permission (route needs: ${routePerms.join(', ')})`);
        errors++;
      } else if (rolePerms.length === 0) {
        console.log(`  ⚠️  ${entry.path} — ${role}: unknown role, no permissions defined`);
        warnings++;
      }
    }

    // Check that all route permissions are known
    for (const perm of routePerms) {
      const allPerms = Object.values(ROLE_PERMISSIONS).flat();
      const unique = new Set(allPerms);
      if (!unique.has(perm)) {
        console.log(`  ⚠️  ${entry.path} — uses unknown permission: '${perm}' (not in ROLE_PERMISSIONS dictionary)`);
        warnings++;
      }
    }
  }

  // Print permission usage summary
  console.log('\n─── Permission usage in routes ───');
  const allUsedPerms = new Set(routes.flatMap((r) => r.permissions));
  const allKnownPerms = new Set(Object.values(ROLE_PERMISSIONS).flat());
  for (const perm of [...allUsedPerms].sort()) {
    const known = allKnownPerms.has(perm) ? '✅' : '⚠️';
    console.log(`  ${known} ${perm}`);
  }

  console.log(`\n─── Results: ${errors} errors, ${warnings} warnings ───`);
  if (errors > 0) {
    console.log('🔴 AUDIT FAILED — RBAC inconsistencies detected\n');
    process.exit(1);
  }
  console.log(warnings > 0 ? '🟡 Passed with warnings\n' : '🟢 All clear\n');
  process.exit(0);
}

main();
