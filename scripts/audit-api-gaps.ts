/**
 * API Gap Analysis — compares frontend API calls with registered Django endpoints.
 *
 * Frontend sources:
 *   - admin/src/api/client.ts (AdminApi, TelemetryApi, RewardsApi, BrandingApi)
 *   - Direct apiClient.get/post calls in module files
 *
 * Backend sources:
 *   - backend/core/urls.py (main urlpatterns)
 *   - backend/users/urls.py, activities/urls.py, rewards/urls.py etc.
 *
 * Detects: FE calls endpoint not registered in BE, BE endpoint not consumed by FE.
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');

/* ─── Extract frontend API calls ────────────────────────────── */
function extractFrontendApiCalls(): { method: string; url: string; source: string }[] {
  const calls: { method: string; url: string; source: string }[] = [];

  // Scan client.ts explicitly
  const clientFile = resolve(ROOT, 'admin/src/api/client.ts');
  if (existsSync(clientFile)) {
    const src = readFileSync(clientFile, 'utf-8');
    const lines = src.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      const methods = ['get', 'post', 'put', 'patch', 'delete'];

      for (const method of methods) {
        const regex = new RegExp(`apiClient\\.${method}\\(['"]([^'"]+)['"]`);
        const m = line.match(regex);
        if (m) {
          calls.push({ method: method.toUpperCase(), url: m[1], source: 'client.ts' });
        }

        // Template literal: `/${...}/`
        const tplRegex = new RegExp(`apiClient\\.${method}\\(\\\`([^\\\`]+)\\\``);
        const tplM = line.match(tplRegex);
        if (tplM) {
          calls.push({ method: method.toUpperCase(), url: tplM[1] + '{id}', source: 'client.ts' });
        }
      }
    }
  }

  // Scan all module files for apiClient calls
  const modulesDir = resolve(ROOT, 'admin/src/modules');
  if (existsSync(modulesDir)) {
    function scanDir(dir: string) {
      const entries = readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const full = resolve(dir, entry.name);
        if (entry.isDirectory() && !entry.name.startsWith('.')) {
          scanDir(full);
        } else if (entry.isFile() && /\.(tsx|ts)$/.test(entry.name)) {
          try {
            const src = readFileSync(full, 'utf-8');
            for (const method of ['get', 'post', 'put', 'patch', 'delete']) {
              const regex = new RegExp(`apiClient\\.${method}\\(['"]([^'"]+)['"]`, 'g');
              let m;
              while ((m = regex.exec(src)) !== null) {
                const relName = full.replace(resolve(ROOT, 'admin/src'), '');
                calls.push({ method: method.toUpperCase(), url: m[1], source: relName });
              }
            }
          } catch { /* skip */ }
        }
      }
    }
    scanDir(modulesDir);
  }

  return calls;
}

/* ─── Extract backend endpoints from urls.py ────────────────── */
function extractBackendEndpoints(): { method: string; url: string }[] {
  const endpoints: { method: string; url: string }[] = [];

  // Parse core/urls.py for include() prefixes + direct paths
  const coreUrlsPath = resolve(ROOT, 'backend/core/urls.py');
  if (!existsSync(coreUrlsPath)) return endpoints;

  const coreSrc = readFileSync(coreUrlsPath, 'utf-8');

  // Extract module prefixes from path('prefix/', include(...))
  const includeMap = new Map<string, string>();
  const includeRegex = /path\(\s*['"]([^'"]+)['"]\s*,\s*include\(\s*['"]([^'"]+)['"]\s*\)/g;
  let im;
  while ((im = includeRegex.exec(coreSrc)) !== null) {
    const prefix = im[1].replace(/\/$/, '');
    const module = im[2];
    includeMap.set(module, prefix);
  }

  // Also parse direct paths in core urls.py
  const directPathRegex = /path\(\s*['"]([^'"]+)['"]\s*,/g;
  let dm;
  while ((dm = directPathRegex.exec(coreSrc)) !== null) {
    const p = dm[1];
    if (!p.includes('include(') && !p.startsWith('admin')) {
      endpoints.push({ method: detectMethod(coreSrc, dm.index), url: p });
    }
  }

  // For each included module, parse its urls.py
  // Map module names to file paths
  const moduleToPath: Record<string, string> = {
    'users.urls': 'backend/users/urls.py',
    'users.rbac_urls': 'backend/users/rbac_urls.py',
    'users.department_urls': 'backend/users/department_urls.py',
    'activities.urls': 'backend/activities/urls.py',
    'clubs.urls': 'backend/clubs/urls.py',
    'events.urls': 'backend/events/urls.py',
    'rewards.urls': 'backend/rewards/urls.py',
    'core.feature_urls': 'backend/core/feature_urls.py',
  };

  for (const [module, prefix] of includeMap) {
    const relPath = moduleToPath[module];
    if (!relPath) continue;
    const fullPath = resolve(ROOT, relPath);
    if (!existsSync(fullPath)) continue;

    try {
      const moduleSrc = readFileSync(fullPath, 'utf-8');
      const lineRegex = /path\(\s*['"]([^'"]+)['"]\s*,/g;
      let lm;
      while ((lm = lineRegex.exec(moduleSrc)) !== null) {
        let subPath = lm[1];
        if (subPath === '') {
          subPath = prefix;
        } else {
          subPath = `${prefix}/${subPath.replace(/^\//, '')}`;
        }
        subPath = subPath.replace(/\/$/, '');
        endpoints.push({ method: detectMethod(moduleSrc, lm.index), url: subPath });
      }
    } catch { /* skip */ }
  }

  return endpoints;
}

function detectMethod(src: string, pos: number): string {
  const near = src.substring(pos, pos + 300);
  if (/ViewSet|ModelViewSet|ReadOnlyModelViewSet/.test(near)) return 'GET/POST';
  if (/ListAPIView|ListCreateAPIView/.test(near)) return 'GET/POST';
  if (/RetrieveAPIView|RetrieveUpdateAPIView/.test(near)) return 'GET';
  if (/CreateAPIView/.test(near)) return 'POST';
  if (/UpdateAPIView/.test(near)) return 'PUT/PATCH';
  if (/DestroyAPIView/.test(near)) return 'DELETE';
  if (/generic\.|GenericAPIView/.test(near)) return 'GET';
  if (/name\s*=\s*['"][^'"]*create[^'"]*['"]/i.test(near)) return 'POST';
  if (/name\s*=\s*['"][^'"]*delete[^'"]*['"]/i.test(near)) return 'DELETE';
  return 'GET';
}

/* ─── Main ──────────────────────────────────────────────────── */
function main(): never {
  console.log('\n═══ API Gap Analysis ═══\n');

  const feCalls = extractFrontendApiCalls();
  const beEndpoints = extractBackendEndpoints();

  // Normalize URLs: strip trailing slashes, replace params, ensure leading /
  const normalize = (url: string) => {
    let n = url.replace(/\/$/, '')
               .replace(/\/<[^>]+>/g, '/:id')
               .replace(/<int:(\w+)>/g, ':$1')
               .replace(/<str:(\w+)>/g, ':$1')
               .replace(/<path:(\w+)>/g, ':$1')
               .replace(/\$\{[^}]+\}/g, ':id');
    return n.startsWith('/') ? n : `/${n}`;
  };

  // Admin calls use relative paths to baseURL='/api' — prepend /api for comparison
  const normalizeFe = (url: string) => {
    const n = normalize(url);
    return n.startsWith('/api/') || n.startsWith('/api') ? n : `/api${n.startsWith('/') ? n : `/${n}`}`;
  };

  const feSet = new Set(feCalls.map((c) => normalizeFe(c.url)));
  const beSet = new Set(beEndpoints.map((e) => normalize(e.url)));

  console.log(`Frontend API calls: ${feCalls.length} (${feSet.size} unique)`);
  console.log(`Backend endpoints: ${beEndpoints.length} (${beSet.size} unique)\n`);

  let errors = 0;
  let warnings = 0;

  // Frontend calls without backend
  console.log('─── FE calls without BE endpoint ───');
  for (const call of feCalls) {
    const norm = normalizeFe(call.url);
    // Check partial match (prefix) against BE endpoints
    const hasBeEndpoint = beEndpoints.some((be) => {
      const bn = normalize(be.url);
      return norm.startsWith(bn) || bn.startsWith(norm) ||
             norm.replace(/\/:id|\/:(\w+)/g, '') === bn.replace(/\/:id|\/:(\w+)/g, '');
    });
    if (!hasBeEndpoint) {
      console.log(`  ❌  ${call.method} ${call.url} (${call.source}) — no backend endpoint found`);
      errors++;
    }
  }
  if (feCalls.every((c) => {
    const norm = normalize(c.url);
    return beEndpoints.some((be) => normalize(be.url).startsWith(norm) || norm.startsWith(normalize(be.url)));
  })) {
    console.log('  ✅  All FE calls have matching BE endpoints');
  }

  // Backend endpoints without frontend consumer
  console.log('\n─── BE endpoints without FE consumer ───');
  const uniqueBeUrls = [...new Set(beEndpoints.map((e) => normalize(e.url)))];
  for (const beUrl of uniqueBeUrls) {
    const consumed = feCalls.some((fe) => {
      const fn = normalizeFe(fe.url);
      return beUrl.startsWith(fn) || fn.startsWith(beUrl) ||
             beUrl.replace(/\/:id|\/:(\w+)/g, '') === fn.replace(/\/:id|\/:(\w+)/g, '');
    });
    if (!consumed && beUrl && !beUrl.includes('admin/') && !beUrl.includes('schema') && !beUrl.includes('docs') && !beUrl.includes('auth/social') && !beUrl.includes('matrix') && !beUrl.includes('llm') && !beUrl.includes('ogc')) {
      console.log(`  ⚠️  ${beUrl} — no frontend consumer found`);
      warnings++;
    }
  }

  // Print unique FE calls for reference
  console.log('\n─── Unique Frontend API calls ───');
  for (const url of [...feSet].sort()) {
    console.log(`  ${url}`);
  }

  console.log(`\n─── Results: ${errors} errors, ${warnings} warnings ───`);
  if (errors > 0) {
    console.log('🔴 AUDIT FAILED — frontend calls missing backend\n');
    process.exit(1);
  }
  console.log(warnings > 0 ? '🟡 Passed with warnings\n' : '🟢 All clear\n');
  process.exit(0);
}

main();
