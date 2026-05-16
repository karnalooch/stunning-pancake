/**
 * Redirect Chain Audit — analyzes all <Navigate to="..."> declarations in App.tsx
 * to detect redirect loops, chains, and redirects to non-existent routes.
 *
 * Detects:
 *   - Redirect loops (A → B → A)
 *   - Multi-hop chains (> 2 redirects, likely navigation smell)
 *   - Redirect targets with no corresponding <Route>
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');

/* ─── Parse App.tsx for routes and Navigate declarations ─────── */
interface RouteEntry {
  path: string;
  isNavigate: boolean;
  navigateTo?: string;
  element?: string;
}

function parseRoutes(): RouteEntry[] {
  const src = readFileSync(resolve(ROOT, 'admin/src/App.tsx'), 'utf-8');
  const lines = src.split('\n');
  const routes: RouteEntry[] = [];

  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();

    // <Route path="..." ... />
    const pathM = t.match(/<Route\s+path=["']([^"']*)["']/);
    if (!pathM) continue;
    const path = pathM[1];

    // Check for Navigate element
    if (t.includes('<Navigate')) {
      const toM = t.match(/to=["']([^"']*)["']/);
      routes.push({ path, isNavigate: true, navigateTo: toM ? toM[1] : undefined });
      continue;
    }

    // Check for Route with element
    const elementM = t.match(/element=\{(?:<PermissionGuard[^>]*>)?\s*<(\w+)/);
    routes.push({ path, isNavigate: false, element: elementM ? elementM[1] : 'Unknown component' });
  }

  return routes;
}

/* ─── Build redirect chain graph ─────────────────────────────── */
function buildRedirectGraph(routes: RouteEntry[]): Map<string, string> {
  const graph = new Map<string, string>();
  for (const r of routes) {
    if (r.isNavigate && r.navigateTo) {
      // Normalize paths: /owner/dashboard vs dashboard
      const from = r.path === 'index' ? '/owner' : r.path.startsWith('/') ? r.path : `/owner/${r.path}`;
      const to = r.navigateTo.startsWith('/') ? r.navigateTo : `/owner/${r.navigateTo}`;
      // Handle relative redirects like "dashboard" from parent "/owner"
      if (r.navigateTo.startsWith('/')) {
        graph.set(from, r.navigateTo);
      } else if (r.path !== 'index') {
        graph.set(r.path, r.navigateTo);
      } else {
        graph.set('/owner', `/owner/${r.navigateTo}`);
      }
    }
  }
  return graph;
}

/* ─── Main ──────────────────────────────────────────────────── */
function main(): never {
  console.log('\n═══ Redirect Chain Audit ═══\n');

  const routes = parseRoutes();
  const navigateRoutes = routes.filter((r) => r.isNavigate);
  const routePaths = new Set(routes.filter((r) => !r.isNavigate).map((r) => r.path));

  console.log(`Total routes: ${routes.length}`);
  console.log(`Navigate (redirect) routes: ${navigateRoutes.length}\n`);

  let errors = 0;
  let warnings = 0;

  // 1. Check redirect targets exist
  console.log('─── Redirect validity check ───');
  for (const nr of navigateRoutes) {
    const target = nr.navigateTo?.replace(/^\/owner\//, '');
    if (target && !routePaths.has(target) && target !== 'login' && target !== 'dashboard') {
      // Check for catch-all
      if (routePaths.has('*')) continue;
      console.log(`  ❌  ${nr.path} → ${nr.navigateTo} — target route does not exist`);
      errors++;
    } else {
      console.log(`  ✅  ${nr.path} → ${nr.navigateTo}`);
    }
  }

  // 2. Detect redirect chains
  const redirectGraph = buildRedirectGraph(routes);
  console.log('\n─── Redirect chain analysis ───');

  // Check for direct loops (A → A)
  for (const [from, to] of redirectGraph) {
    // Normalize both for comparison (remove /owner prefix)
    const fromNorm = from.replace(/^\/owner\//, '');
    const toNorm = to.replace(/^\/owner\//, '');
    if (fromNorm === toNorm && fromNorm !== '') {
      console.log(`  ❌  Loop: ${from} → ${to} (self-redirect)`);
      errors++;
    }
  }

  // Check for two-hop loops (A → B → A)
  for (const [from, to] of redirectGraph) {
    const secondHop = redirectGraph.get(to);
    if (secondHop) {
      if (secondHop === from || secondHop.replace(/^\/owner\//, '') === from.replace(/^\/owner\//, '')) {
        console.log(`  ❌  Loop: ${from} → ${to} → ${secondHop} (circular redirect)`);
        errors++;
      } else {
        console.log(`  ⚠️  Chain: ${from} → ${to} → ${secondHop} (${redirectGraph.get(secondHop) ? 'continues...' : 'ends'})`);
        warnings++;
      }
    }
  }

  // 3. Check for multiple wildcards / catch-alls
  const catchAlls = routes.filter((r) => r.path === '*');
  if (catchAlls.length > 1) {
    // Check if they're in separate auth branches (authenticated vs unauthenticated)
    const appSrc = readFileSync(resolve(ROOT, 'admin/src/App.tsx'), 'utf-8');
    const routeBlocks = (appSrc.match(/<Routes>/g) || []).length;
    if (routeBlocks <= 1) {
      console.log(`\n  ❌  Multiple catch-all '*' routes (${catchAlls.length}) — ambiguous fallback`);
      errors++;
    } else {
      console.log(`\n  ✅  ${catchAlls.length} catch-all '*' routes in ${routeBlocks} separate <Routes> blocks (auth branching, OK)`);
    }
  }

  // 4. Print full redirect map
  console.log(`\n─── Redirect Map ───`);
  for (const [from, to] of redirectGraph) {
    console.log(`  ${from} → ${to}`);
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
