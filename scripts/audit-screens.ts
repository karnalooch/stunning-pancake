/**
 * Dead Screen Detection — scans all .tsx files in admin/src/modules/ and checks
 * whether each is import-ed anywhere in the project. Screens that exist as files
 * but are never imported are "orphan" components — possibly dead code.
 *
 * Exit code: 1 if any orphan screens found, 0 otherwise.
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { resolve, basename, extname } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const MODULES_DIR = resolve(ROOT, 'admin/src/modules');
const AUTH_DIR = resolve(ROOT, 'admin/src/core/auth');
const SRC_DIR = resolve(ROOT, 'admin/src');

/* ─── Gather all module .tsx files ──────────────────────────── */
function collectModuleFiles(): string[] {
  const files: string[] = [];
  if (!existsSync(MODULES_DIR)) return files;

  const dirs = readdirSync(MODULES_DIR, { withFileTypes: true });
  for (const dir of dirs) {
    if (!dir.isDirectory()) continue;
    const subDir = resolve(MODULES_DIR, dir.name);
    const entries = readdirSync(subDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && (entry.name.endsWith('.tsx') || entry.name.endsWith('.ts'))) {
        files.push(resolve(subDir, entry.name));
      }
    }
  }
  return files;
}

/* ─── Collect all tsx/ts files under src ────────────────────── */
function collectAllSrcTsFiles(): string[] {
  const result: string[] = [];
  function walk(dir: string) {
    if (!existsSync(dir)) return;
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = resolve(dir, entry.name);
      if (entry.isDirectory() && !entry.name.startsWith('node_modules') && !entry.name.startsWith('dist')) {
        walk(full);
      } else if (entry.isFile() && /\.(tsx|ts)$/.test(entry.name)) {
        result.push(full);
      }
    }
  }
  walk(SRC_DIR);
  return result;
}

/* ─── Extract component name from file ──────────────────────── */
function componentNameFromFile(filePath: string): string {
  return basename(filePath, extname(filePath));
}

/* ─── Main ──────────────────────────────────────────────────── */
function main(): never {
  const moduleFiles = collectModuleFiles();

  // Also check LoginPage
  if (existsSync(resolve(AUTH_DIR, 'LoginPage.tsx'))) {
    moduleFiles.push(resolve(AUTH_DIR, 'LoginPage.tsx'));
  }

  const allFiles = collectAllSrcTsFiles();

  console.log('\n═══ Dead Screen Detection ═══');
  console.log(`Module files: ${moduleFiles.length}`);
  console.log(`Total .tsx/.ts in src: ${allFiles.length}\n`);

  let orphans = 0;
  let used = 0;

  for (const moduleFile of moduleFiles) {
    const componentName = componentNameFromFile(moduleFile);
    const moduleRel = moduleFile.replace(ROOT, '');

    // Search for imports of this component in all other files
    let imported = false;
    const searchPatterns = [
      `from '${componentName}'`,
      `from "./${componentName}"`,
      `from '../${componentName}'`,
      `import ${componentName}`,
      `import { ${componentName}`,
      `import {${componentName}`,
      `import type { ${componentName}`,
    ];

    for (const otherFile of allFiles) {
      if (otherFile === moduleFile) continue;
      try {
        const content = readFileSync(otherFile, 'utf-8');
        // Check direct import
        for (const pattern of searchPatterns) {
          if (content.includes(pattern)) {
            imported = true;
            break;
          }
        }
        if (imported) break;

        // Check relative import paths
        if (content.includes(basename(moduleFile).replace('.tsx', '')).includes(basename(moduleFile).replace('.ts', ''))) {
          imported = true;
          break;
        }
      } catch { /* skip unreadable files */ }
    }

    if (imported) {
      used++;
    } else {
      console.log(`  ❌  ORPHAN: ${moduleRel} — not imported anywhere`);
      orphans++;
    }
  }

  // Now check the reverse: which files ARE imported by App.tsx?
  const appTsx = readFileSync(resolve(ROOT, 'admin/src/App.tsx'), 'utf-8');
  const routedInApp = new Set<string>();
  const importRegex = /import\s+\{\s*(\w+)\s*\}\s+from\s+['"](.+\.tsx)['"]/g;
  let m;
  while ((m = importRegex.exec(appTsx)) !== null) {
    routedInApp.add(m[1]);
  }
  const defaultImportRegex = /import\s+(\w+)\s+from\s+['"](.+\.tsx)['"]/g;
  while ((m = defaultImportRegex.exec(appTsx)) !== null) {
    routedInApp.add(m[1]);
  }

  console.log(`\n  📊  ${used} files imported somewhere, ${orphans} orphan files`);
  console.log(`  📊  ${routedInApp.size} components imported in App.tsx\n`);

  // Summary by module directory
  const moduleCounts: Record<string, { total: number; orphans: number }> = {};
  for (const file of moduleFiles) {
    const dir = basename(resolve(file, '..'));
    if (!moduleCounts[dir]) moduleCounts[dir] = { total: 0, orphans: 0 };
    moduleCounts[dir].total++;
  }

  console.log('  ─── Per-module breakdown ───');
  for (const [dir, counts] of Object.entries(moduleCounts)) {
    console.log(`  ${dir}: ${counts.total} files`);
  }

  if (orphans > 0) {
    console.log('\n🔴 AUDIT FAILED — orphan screens detected\n');
    process.exit(1);
  }
  console.log('🟢 All module files are imported\n');
  process.exit(0);
}

main();
