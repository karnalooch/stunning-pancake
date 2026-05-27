/**
 * Environment Variable Drift Check — compares keys in .env.example with
 * those actually used in source code (process.env.X, import.meta.env.VITE_X).
 *
 * Detects:
 *   - WARNING: key in .env.example never used in code (dead env var)
 *   - WARNING: key used in code but missing from .env.example (undocumented)
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');

/* ─── Parse .env.example files ──────────────────────────────── */
function parseEnvExample(filePath: string): string[] {
  if (!existsSync(filePath)) return [];
  try {
    const src = readFileSync(filePath, 'utf-8');
    const lines = src.split('\n');
    const keys: string[] = [];
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('#') || !trimmed.includes('=')) continue;
      const key = trimmed.split('=')[0].trim();
      if (key && !key.startsWith('#')) {
        keys.push(key);
      }
    }
    return keys;
  } catch {
    return [];
  }
}

/* ─── Search codebase for env var usage ─────────────────────── */
function findEnvVarsInCode(dir: string, extensions: string[]): Set<string> {
  const vars = new Set<string>();

  function walk(d: string) {
    if (!existsSync(d)) return;
    try {
      const entries = readdirSync(d, { withFileTypes: true });
      for (const entry of entries) {
        const full = resolve(d, entry.name);
        if (entry.isDirectory()) {
          const skip = ['node_modules', 'dist', '.git', '__pycache__', 'venv', '.venv', 'dist-exe', '.expo', '.kilo'];
          if (!skip.includes(entry.name) && !entry.name.startsWith('.')) {
            walk(full);
          }
        } else if (entry.isFile() && extensions.some((ext) => entry.name.endsWith(ext))) {
          try {
            const src = readFileSync(full, 'utf-8');
            // Match process.env.VAR_NAME / process.env['VAR_NAME'] / import.meta.env.VITE_VAR
            // Match Python: os.environ.get('VAR') / os.getenv('VAR') / environ['VAR']
            const patterns = [
              /process\.env\.(\w+)/g,
              /process\.env\[['"](\w+)['"]\]/g,
              /import\.meta\.env\.(\w+)/g,
              /os\.environ\.get\(\s*['"]([^'"]+)['"]/g,
              /os\.environ\[['"]([^'"]+)['"]\]/g,
              /os\.getenv\(\s*['"]([^'"]+)['"]/g,
              /settings\['([A-Z_]+)'\]/g,
            ];
            for (const pattern of patterns) {
              let m;
              while ((m = pattern.exec(src)) !== null) {
                vars.add(m[1]);
              }
            }
          } catch { /* skip */ }
        }
      }
    } catch { /* skip */ }
  }

  walk(dir);
  return vars;
}

/* ─── Main ──────────────────────────────────────────────────── */
function main(): never {
  console.log('\n═══ Environment Variable Drift ═══\n');

  // Root .env.example
  const rootEnv = parseEnvExample(resolve(ROOT, '.env.example'));
  const backendEnv = parseEnvExample(resolve(ROOT, 'backend/.env.example'));
  const adminEnv = parseEnvExample(resolve(ROOT, 'admin/.env.example'));
  const mobileEnv = parseEnvExample(resolve(ROOT, 'mobile/.env.example'));

  const allEnvKeys = new Set([...rootEnv, ...backendEnv, ...adminEnv, ...mobileEnv]);

  console.log(`.env.example entries (root): ${rootEnv.length}`);
  console.log(`.env.example entries (backend): ${backendEnv.length}`);
  console.log(`.env.example entries (admin): ${adminEnv.length}`);
  console.log(`.env.example entries (mobile): ${mobileEnv.length}`);
  console.log(`Total unique env keys: ${allEnvKeys.size}\n`);

  // Search codebase for env var usage
  const codeEnvVars = findEnvVarsInCode(ROOT, ['.ts', '.tsx', '.js', '.jsx', '.py', '.env', '.cfg', '.toml', '.sh', '.ps1']);

  console.log(`Env vars used in code: ${codeEnvVars.size}\n`);

  let warnings = 0;

  // .env.example keys not used in code
  console.log('─── Keys in .env.example but NOT used in code ───');
  const unused = [...allEnvKeys].filter((k) => !codeEnvVars.has(k));
  for (const key of unused.sort()) {
    // Skip well-known Django/React env vars that may be used by the framework itself
    const wellKnown = ['DJANGO_SETTINGS_MODULE', 'SECRET_KEY', 'DEBUG', 'DATABASE_URL', 'REDIS_URL'];
    if (wellKnown.includes(key)) continue;
    console.log(`  ⚠️  ${key} — defined in .env.example but not found in code`);
    warnings++;
  }
  if (unused.every((k) => ['DJANGO_SETTINGS_MODULE', 'SECRET_KEY', 'DEBUG', 'DATABASE_URL', 'REDIS_URL'].includes(k))) {
    console.log('  ✅  No unused env vars');
  }

  // Keys used in code but NOT in .env.example
  console.log('\n─── Keys used in code but NOT in .env.example ───');
  const missing = [...codeEnvVars].filter((k) => !allEnvKeys.has(k));
  // Filter out common Node.js / React built-ins and regex-test artifacts
  const builtIns = ['NODE_ENV', 'CI', 'npm_lifecycle_event', 'PUBLIC_URL', 'PORT',
    'VAR_NAME', 'VAR', 'VITE_VAR', 'VITE_X', 'X', 'VITE_API_URL',
    'DYNO', 'RAILWAY_SERVICE_NAME', 'RENDER', 'E2E_BASE_URL'];
  const realMissing = missing.filter((k) => !builtIns.includes(k));
  for (const key of realMissing.sort()) {
    // Check if it's a VITE_ prefixed (used by admin)
    if (key.startsWith('VITE_') || key.startsWith('EXPO_')) {
      console.log(`  ⚠️  ${key} — used in code but missing from .env.example (undocumented)`);
      warnings++;
    } else {
      console.log(`  ❌  ${key} — used in code but missing from .env.example`);
      warnings++;
    }
  }
  if (realMissing.length === 0) {
    console.log('  ✅  All env vars in code are documented');
  }

  console.log(`\n─── Results: 0 errors, ${warnings} warnings ───`);
  console.log(warnings > 0 ? '🟡 Review recommended\n' : '🟢 All clear\n');
  process.exit(0);
}

main();
