/**
 * Environment Compatibility & Drift Audit — scans configuration files for potential environment issues.
 *
 * Detects:
 *   - Missing /api suffix in VITE_API_URL usage
 *   - Missing password hasher local override for SQLite
 *   - Raw PostgreSQL features in migrations without safety handlers (like the _sqlite_safe_forwards monkey-patch)
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { resolve, relative } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const BACKEND_DIR = resolve(ROOT, 'backend');
const FRONTEND_DIR = resolve(ROOT, 'admin');

interface AuditFinding {
  file: string;
  line: number;
  type: 'ERROR' | 'WARNING';
  finding: string;
  suggestion: string;
}

const findings: AuditFinding[] = [];

// 1. Audit Settings and Local Configs
function auditConfigs() {
  const settingsPath = resolve(BACKEND_DIR, 'core/settings.py');
  if (existsSync(settingsPath)) {
    const src = readFileSync(settingsPath, 'utf-8');
    if (!src.includes('PASSWORD_HASHERS') || !src.includes('MD5PasswordHasher')) {
      findings.push({
        file: 'backend/core/settings.py',
        line: 1,
        type: 'WARNING',
        finding: 'No fast password hasher configured for SQLite dev environment',
        suggestion: 'Hashing passwords with Argon2/PBKDF2 in SQLite local environment can block CPU. Use MD5PasswordHasher for SQLite developer environments.',
      });
    }
  }

  const clientPath = resolve(FRONTEND_DIR, 'src/api/client.ts');
  if (existsSync(clientPath)) {
    const src = readFileSync(clientPath, 'utf-8');
    if (!src.includes('endsWith(\'/api\')') && !src.includes('endsWith(\'/api/\')')) {
      findings.push({
        file: 'admin/src/api/client.ts',
        line: 1,
        type: 'ERROR',
        finding: 'VITE_API_URL does not normalize or check for missing /api suffix',
        suggestion: 'If the user inputs VITE_API_URL on Railway without appending "/api", API calls return 404. Normalize baseURL automatically in Axios client.',
      });
    }
  }
}

// 2. Audit migrations for raw PG/GIS features without sqlite bypass
function auditMigrations(filePath: string) {
  const src = readFileSync(filePath, 'utf-8');
  const lines = src.split('\n');
  const relPath = relative(ROOT, filePath);

  if (filePath.includes('/migrations/') && (src.includes('RunSQL(') || src.includes('CREATE MATERIALIZED VIEW') || src.includes('ENABLE ROW LEVEL SECURITY'))) {
    // Check if the project has the _sqlite_safe_forwards or connection.vendor checks
    const hasBypass = src.includes('connection.vendor') || src.includes('sqlite_safe') || src.includes('vendor ==');
    if (!hasBypass) {
      findings.push({
        file: relPath,
        line: 1,
        type: 'WARNING',
        finding: 'Raw PostgreSQL / PostGIS migration SQL without SQLite bypass',
        suggestion: 'Raw PG SQL migration actions will fail when run on a local SQLite developer environment. Ensure migrations bypass PG specific operations if connection.vendor is "sqlite".',
      });
    }
  }
}

function walkMigrations(dir: string) {
  if (!existsSync(dir)) return;
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = resolve(dir, entry.name);
    if (entry.isDirectory()) {
      const skip = ['node_modules', 'dist', '.git', 'venv', '.venv', '__pycache__', '.kilo'];
      if (!skip.includes(entry.name) && !entry.name.startsWith('.')) {
        walkMigrations(full);
      }
    } else if (entry.isFile() && entry.name.endsWith('.py')) {
      auditMigrations(full);
    }
  }
}

console.log('🔍 Running Environment Compatibility & Drift Audit...');
auditConfigs();
walkMigrations(BACKEND_DIR);

if (findings.length > 0) {
  console.log(`\n❌ Found ${findings.length} compatibility or drift findings:\n`);
  findings.forEach((f) => {
    console.log(`  [${f.type}] ${f.file}:${f.line}`);
    console.log(`    Finding:    ${f.finding}`);
    console.log(`    Suggestion: ${f.suggestion}\n`);
  });
  process.exit(findings.some((f) => f.type === 'ERROR') ? 1 : 0);
} else {
  console.log('✅ Environment Compatibility & Drift Audit passed pomyślnie. Brak błędów.');
  process.exit(0);
}