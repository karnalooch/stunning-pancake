/**
 * Route Parity Check — compares sidebar NAV_SECTIONS with App.tsx <Route> declarations.
 * Detects dead sidebar links (no route), orphan routes (no sidebar entry).
 *
 * Exit code: 1 on errors, 0 on warnings-only or clean.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');

/* ─── Parse sidebar paths from Layout.tsx ──────────────────── */
function parseSidebarPaths(): { path: string; label: string; section: string }[] {
  const src = readFileSync(resolve(ROOT, 'admin/src/core/Layout.tsx'), 'utf-8');
  const lines = src.split('\n');

  const entries: { path: string; label: string; section: string }[] = [];
  let currentSection = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const t = line.trim();

    // Section header: label: 'Overview',  (followed soon by items: [)
    if (t.match(/^label:\s*['"](.+)['"]\s*,?\s*$/)) {
      const m = t.match(/^label:\s*['"](.+)['"]\s*,?\s*$/);
      if (m) {
        // Peek ahead to see if next line opens items array
        const nextLine = lines[i + 1]?.trim() || '';
        if (nextLine.startsWith('items:')) {
          currentSection = m[1];
        }
      }
    }

    // Item path: path: '/owner/...',
    if (t.startsWith('path:')) {
      const m = t.match(/path:\s*['"](.+)['"']/);
      if (m) {
        // Find item label (previous line or 2 lines back)
        let label = '';
        for (let j = i - 1; j >= Math.max(0, i - 5); j--) {
          const lblM = lines[j].trim().match(/label:\s*['"](.+)['"']/);
          if (lblM && !['OVERVIEW', 'MANAGEMENT', 'OPERATIONS', 'ANALYTICS', 'SYSTEM', 'Overview', 'Management', 'Operations', 'Analytics', 'System', currentSection].includes(lblM[1])) {
            label = lblM[1];
            break;
          }
        }
        if (label) {
          entries.push({ path: m[1], label, section: currentSection });
        }
      }
    }
  }

  return entries;
}

/* ─── Parse route paths from App.tsx ────────────────────────── */
function parseAppRoutes(): string[] {
  const src = readFileSync(resolve(ROOT, 'admin/src/App.tsx'), 'utf-8');
  const regex = /<Route\s+path=["']([^"']*)["']/g;
  const routes: string[] = [];
  let m;
  while ((m = regex.exec(src)) !== null) {
    routes.push(m[1]);
  }
  return routes;
}

/* ─── Main ──────────────────────────────────────────────────── */
function main(): never {
  const sidebar = parseSidebarPaths();
  const routes = parseAppRoutes();
  const routeSet = new Set(routes);
  const sidebarPaths = new Set(sidebar.map((e) => e.path));

  console.log('\n═══ Route Parity Check ═══');
  console.log(`Sidebar entries: ${sidebar.length}`);
  console.log(`Registered routes: ${routes.length}\n`);

  let errors = 0;
  let warnings = 0;

  // Sidebar entries without route
  for (const entry of sidebar) {
    const rel = entry.path.replace(/^\/owner\//, '');
    const exists = routeSet.has(rel) || routeSet.has(entry.path) ||
      (rel.includes('/') && routeSet.has(rel.split('/')[0]));

    if (!exists) {
      console.log(`  ❌  ERROR: ${entry.path} (${entry.label}) [${entry.section}] — dead link: no <Route>`);
      errors++;
    } else {
      console.log(`  ✅  PASS:  ${entry.path} (${entry.label})`);
    }
  }

  // Routes without sidebar entry (orphans)
  const ignoredRoutes = new Set(['*', '/login', '/unauthorized', '/', 'index', 'dashboard', 'users', 'white-label', 'sponsor', 'settings', 'anti-cheat', '/owner',
    'departments/:id/users', 'activities/:id']);
  for (const route of routes) {
    if (ignoredRoutes.has(route)) continue;
    const full = `/owner/${route}`;
    const bare = route.replace(/^\/owner\//, '');
    if (!sidebarPaths.has(full) && !sidebarPaths.has(bare)) {
      if (route === '/') continue; // landing page
      console.log(`  ⚠️  WARNING: /owner/${route} — route registered but no sidebar entry`);
      warnings++;
    }
  }

  console.log(`\n─── Results: ${errors} errors, ${warnings} warnings ───`);

  if (errors > 0) {
    console.log('🔴 AUDIT FAILED\n');
    process.exit(1);
  }
  console.log(warnings > 0 ? '🟡 Passed with warnings\n' : '🟢 All clear\n');
  process.exit(0);
}

main();
