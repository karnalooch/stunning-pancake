/**
 * Bundle Size Audit — analyzes Vite build output for chunk sizes and lazy-loading.
 */
import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const ADMIN_DIR = resolve(ROOT, 'admin');
const ADMIN_OUT = resolve(ADMIN_DIR, 'dist');

interface Chunk {
  file: string;
  size_kb: number;
  is_lazy: boolean;
}

function analyzeDist(dir: string): Chunk[] {
  const chunks: Chunk[] = [];
  if (!existsSync(dir)) return chunks;

  const { readdirSync, statSync } = require('node:fs');
  function walk(d: string) {
    const entries = readdirSync(d, { withFileTypes: true });
    for (const entry of entries) {
      const full = resolve(d, entry.name);
      if (entry.isDirectory() && !entry.name.startsWith('.')) {
        walk(full);
      } else if (entry.isFile() && /\.(js|css)$/.test(entry.name)) {
        const stat = statSync(full);
        const rel = full.replace(ADMIN_OUT, '');
        chunks.push({
          file: rel,
          size_kb: Math.round(stat.size / 1024),
          is_lazy: entry.name.includes('lazy') || rel.includes('chunk-'),
        });
      }
    }
  }
  walk(dir);
  return chunks.sort((a, b) => b.size_kb - a.size_kb);
}

function main(): never {
  console.log('\n═══ Bundle Size Audit ═══\n');

  let chunks = analyzeDist(ADMIN_OUT);

  if (chunks.length === 0) {
    console.log('  No dist/ found. Run "npm run build" in admin/ first.\n');
    console.log('  💡 To build: cd admin && npm run build');
    console.log('  💡 To visualize: cd admin && npx vite-bundle-visualizer\n');
    process.exit(0);
  }

  // Top 10 heaviest
  console.log('─── Top 10 Heaviest Chunks ───');
  for (const c of chunks.slice(0, 10)) {
    const flag = c.size_kb > 500 ? '🔴' : c.size_kb > 200 ? '🟡' : '✅';
    const lazy = c.is_lazy ? ' (lazy)' : ' (eager)';
    console.log(`  ${flag} ${c.size_kb.toLocaleString()}KB${lazy} ${c.file}`);
  }

  // Stats
  const totalSize = chunks.reduce((s, c) => s + c.size_kb, 0);
  const eagerChunks = chunks.filter(c => !c.is_lazy);
  const lazyChunks = chunks.filter(c => c.is_lazy);
  const heavyEager = eagerChunks.filter(c => c.size_kb > 200);

  console.log(`\n─── Stats ───`);
  console.log(`  Total chunks: ${chunks.length}`);
  console.log(`  Total size: ${Math.round(totalSize / 1024 * 10) / 10}MB`);
  console.log(`  Eager chunks: ${eagerChunks.length} (${Math.round(eagerChunks.reduce((s, c) => s + c.size_kb, 0) / 1024)}MB)`);
  console.log(`  Lazy chunks: ${lazyChunks.length} (${Math.round(lazyChunks.reduce((s, c) => s + c.size_kb, 0) / 1024)}MB)`);
  console.log(`  Heavy eager (>200KB): ${heavyEager.length}`);

  if (heavyEager.length > 1) {
    console.log(`\n  🟡 ${heavyEager.length} eager chunks over 200KB — consider lazy-loading`);
  }

  // Check for screens that aren't lazy-loaded
  console.log(`\n─── Lazy-loading Coverage ───`);
  try {
    const appTsx = readFileSync(resolve(ADMIN_DIR, 'src/App.tsx'), 'utf-8');
    const lazyCount = (appTsx.match(/React\.lazy|lazy\(/g) || []).length;
    const importCount = (appTsx.match(/import \w+ from/g) || []).length;
    console.log(`  Lazy imports in App.tsx: ${lazyCount}/${importCount} total imports`);
    if (lazyCount === 0) {
      console.log(`  ⚠️  No lazy loading detected — all screens load eagerly`);
    }
  } catch {}

  console.log(`\n${chunks.length > 0 ? '🟡 Review bundle sizes above' : '💡 Build first'}\n`);
  process.exit(0);
}

main();
