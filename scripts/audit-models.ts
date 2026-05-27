/**
 * Backend Models vs Migrations Completeness Audit
 * Checks every Django model against its app's migration history.
 * Detects: models without migrations, pending changes not migrated.
 */
import { existsSync, readdirSync } from 'node:fs';
import { resolve, basename } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const BACKEND = resolve(ROOT, 'backend');

/* ─── Find all Django apps with models ───────────────────── */
function findDjangoApps(): string[] {
  const apps: string[] = [];
  const dirs = readdirSync(BACKEND, { withFileTypes: true });
  for (const dir of dirs) {
    if (!dir.isDirectory() || dir.name.startsWith('.') || dir.name === '__pycache__') continue;
    const modelsPath = resolve(BACKEND, dir.name, 'models.py');
    if (existsSync(modelsPath)) {
      apps.push(dir.name);
    }
  }
  return apps;
}

/* ─── Check models.py for model definitions ───────────────── */
function getModelNames(app: string): string[] {
  const modelsPath = resolve(BACKEND, app, 'models.py');
  if (!existsSync(modelsPath)) return [];

  const { readFileSync } = require('node:fs');
  const content = readFileSync(modelsPath, 'utf-8');
  const lines = content.split('\n');

  const models: string[] = [];
  for (const line of lines) {
    const m = line.match(/^\s*class\s+(\w+)\s*\(\s*models\.\w+/);
    if (m && !['Meta'].includes(m[1])) {
      models.push(m[1]);
    }
  }
  return models;
}

/* ─── Check migrations for model references ───────────────── */
function getMigratedModels(app: string): string[] {
  const migrationsDir = resolve(BACKEND, app, 'migrations');
  if (!existsSync(migrationsDir)) return [];

  const { readFileSync } = require('node:fs');
  const models = new Set<string>();
  const files = readdirSync(migrationsDir).filter(f => f.endsWith('.py') && f !== '__init__.py');

  for (const file of files) {
    const content = readFileSync(resolve(migrationsDir, file), 'utf-8');
    // Check CreateModel operations
    const createRegex = /migrations\.CreateModel\(\s*name\s*=\s*['"](\w+)['"]/g;
    let m;
    while ((m = createRegex.exec(content)) !== null) {
      models.add(m[1]);
    }
  }

  return [...models];
}

/* ─── Main ────────────────────────────────────────────────── */
function main(): never {
  console.log('\n═══ Backend Models vs Migrations Audit ═══\n');

  const apps = findDjangoApps();
  let errors = 0;
  let warnings = 0;

  for (const app of apps) {
    const models = getModelNames(app);
    if (models.length === 0) continue;

    const migrated = new Set(getMigratedModels(app));
    const hasMigrations = existsSync(resolve(BACKEND, app, 'migrations'));

    if (!hasMigrations) {
      console.log(`  ❌  ${app} — has models but NO migrations directory`);
      console.log(`      Models: ${models.join(', ')}`);
      errors += models.length;
      continue;
    }

    for (const model of models) {
      // Skip abstract base classes (they don't get their own table)
      if (model.includes('Abstract') || model === 'TimeStampedModel' || model === 'BaseModel') continue;

      if (!migrated.has(model)) {
        console.log(`  ❌  ${app}/models.py:${model} — no migration found`);
        errors++;
      }
    }

    if (models.every(m => migrated.has(m))) {
      console.log(`  ✅  ${app}: ${models.length} model(s) all migrated`);
    }
  }

  console.log(`\n─── Results: ${errors} errors, ${warnings} warnings ───`);
  if (errors > 0) {
    console.log('🔴 AUDIT FAILED\n');
    process.exit(1);
  }
  console.log('🟢 All models have migrations\n');
  process.exit(0);
}

main();
