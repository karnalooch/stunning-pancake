import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const schemaPath = join(root, 'openapi.json');

const CRITICAL = [
  '/api/auth/token/',
  '/api/auth/token/refresh/',
  '/api/users/profile/',
  '/api/users/register/',
  '/api/activities/sessions/',
  '/api/activities/admin/scale-preflight/',
  '/api/activities/admin/disk-audit/',
  '/api/infra/health/',
];

if (!existsSync(schemaPath)) {
  console.error('codegen:check — missing openapi.json; run: python scripts/export_openapi.py');
  process.exit(1);
}

const schema = JSON.parse(readFileSync(schemaPath, 'utf8'));
const paths = Object.keys(schema.paths ?? {});
const missing = CRITICAL.filter((p) => !paths.includes(p));

if (missing.length) {
  console.error('codegen:check — critical paths missing from openapi.json:');
  for (const p of missing) console.error(`  - ${p}`);
  process.exit(1);
}

console.log('codegen:check — all critical paths present in openapi.json');
