/**
 * Dead Import Detection — wrapper around ts-prune.
 * Falls back to manual analysis if ts-prune is not installed.
 *
 * Detects:
 *   - Imports that are never used in the importing file
 *   - Default exports that are never imported by any other file
 *
 * Note: ts-prune MUST be installed as devDependency for full analysis.
 * This script will attempt to run it; if unavailable, does a basic check.
 */
import { execSync } from 'node:child_process';
import { resolve, basename } from 'node:path';
import { readdirSync, readFileSync, existsSync } from 'node:fs';

const ROOT = resolve(import.meta.dirname, '..');
const ADMIN_DIR = resolve(ROOT, 'admin');

/* ─── Try ts-prune ──────────────────────────────────────────── */
function tryTsPrune(): { success: boolean; output: string } {
  try {
    const result = execSync('npx ts-prune', {
      cwd: ADMIN_DIR,
      encoding: 'utf-8',
      timeout: 30_000,
      env: { ...process.env, FORCE_COLOR: '0' },
    });
    return { success: true, output: result };
  } catch {
    return { success: false, output: '' };
  }
}

/* ─── Basic manual check: unused default exports ────────────── */
function checkUnusedExports(): string[] {
  const srcDir = resolve(ADMIN_DIR, 'src');
  if (!existsSync(srcDir)) return [];

  const allFiles: string[] = [];
  const exports: Map<string, string> = new Map();

  function walk(dir: string) {
    if (!existsSync(dir)) return;
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = resolve(dir, entry.name);
      if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
        walk(full);
      } else if (entry.isFile() && /\.(tsx|ts)$/.test(entry.name)) {
        allFiles.push(full);
        try {
          const content = readFileSync(full, 'utf-8');
          // Detect default exports: export default function ComponentName | export default ComponentName
          const defaultExportM = content.match(/export\s+default\s+(?:function|class)\s+(\w+)/) ||
                                 content.match(/export\s+default\s+(\w+)/) ||
                                 content.match(/export\s+\{\s*(\w+)\s+as\s+default\s*\}/);
          if (defaultExportM) {
            exports.set(defaultExportM[1], basename(full));
          }
        } catch { /* skip */ }
      }
    }
  }
  walk(srcDir);

  const unused: string[] = [];
  for (const [name, file] of exports) {
    let used = false;
    for (const otherFile of allFiles) {
      if (otherFile === resolve(ADMIN_DIR, 'src', file)) continue; // skip self
      try {
        const content = readFileSync(otherFile, 'utf-8');
        if (content.includes(`import ${name}`) || content.includes(`{ ${name}`) || content.includes(`import {${name}`) ||
            content.includes(`import(${name}`) || content.includes(`React.lazy(${name}`)) {
          used = true;
          break;
        }
      } catch { /* skip */ }
    }
    if (!used) {
      unused.push(`${name} (${file})`);
    }
  }

  return unused;
}

/* ─── Main ──────────────────────────────────────────────────── */
function main(): never {
  console.log('\n═══ Dead Import Detection ═══\n');

  // Try ts-prune first
  const prune = tryTsPrune();
  if (prune.success) {
    console.log('ts-prune results:');
    const lines = prune.output.trim().split('\n').filter((l) => l.length > 0);
    const deadLines = lines.filter((l) => l.includes(' - unused') || l.includes('is unused'));
    for (const line of deadLines) {
      console.log(`  ${line}`);
    }
    console.log(`\n  Dead exports found by ts-prune: ${deadLines.length}`);
    if (deadLines.length > 0) {
      console.log('\n🟡 Review recommended — ts-prune found dead exports\n');
    } else {
      console.log('🟢 All clear\n');
    }
    process.exit(0);
  }

  // Fallback: basic check
  console.log('ts-prune not installed. Running basic unused export check...\n');
  const unused = checkUnusedExports();
  if (unused.length > 0) {
    console.log('Potentially unused exports:');
    for (const u of unused) {
      console.log(`  ⚠️  ${u}`);
    }
    console.log(`\n  Found: ${unused.length} potentially unused exports`);
    console.log('\n🟡 Review recommended\n');
  } else {
    console.log('  No unused exports detected (basic check)');
    console.log('\n💡 Install ts-prune for comprehensive analysis:\n    npm i -D ts-prune\n');
  }
  process.exit(0);
}

main();
