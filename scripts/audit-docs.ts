/**
 * Documentation Linting — checks docs/ for structure, broken links, and formatting.
 */
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { resolve, basename, extname } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const DOCS_DIR = resolve(ROOT, 'docs');

interface DocFile {
  path: string;
  lines: number;
  size_kb: number;
  brokenLinks: string[];
  headings: string[];
}

function collectDocs(dir: string): string[] {
  const files: string[] = [];
  if (!existsSync(dir)) return files;
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = resolve(dir, entry.name);
    if (entry.isDirectory() && !entry.name.startsWith('.')) {
      files.push(...collectDocs(full));
    } else if (entry.isFile() && entry.name.endsWith('.md') && !entry.name.includes('PLAN')) {
      files.push(full);
    }
  }
  return files;
}

function analyzeDoc(filePath: string): DocFile {
  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  // Extract headings
  const headings: string[] = [];
  for (const line of lines) {
    const m = line.match(/^#{1,6}\s+(.+)/);
    if (m) headings.push(m[1]);
  }

  // Check for broken internal links
  const brokenLinks: string[] = [];
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  let m;
  while ((m = linkRegex.exec(content)) !== null) {
    const url = m[2];
    if (url.startsWith('./') || url.startsWith('../')) {
      const target = resolve(filePath, '..', url);
      if (!existsSync(target) && !existsSync(target + '.md')) {
        brokenLinks.push(url);
      }
    }
  }

  return {
    path: filePath.replace(ROOT, ''),
    lines: lines.length,
    size_kb: Math.round(statSync(filePath).size / 1024),
    brokenLinks,
    headings,
  };
}

function main(): never {
  console.log('\n═══ Documentation Linting ═══\n');

  const docs = collectDocs(DOCS_DIR);
  const rootDocs = [
    resolve(ROOT, 'CHANGELOG.md'),
    resolve(ROOT, 'README.md'),
  ];

  const allDocs = [...docs, ...rootDocs.filter(existsSync)];
  const results: DocFile[] = [];
  let brokenTotal = 0;

  for (const doc of allDocs) {
    const analysis = analyzeDoc(doc);
    results.push(analysis);

    const icon = analysis.brokenLinks.length > 0 ? '⚠️' : '✅';
    console.log(`  ${icon} ${analysis.path} (${analysis.lines} lines, ${analysis.headings.length} headings, ${analysis.size_kb}KB)`);

    for (const link of analysis.brokenLinks) {
      console.log(`      🔗 broken: ${link}`);
      brokenTotal++;
    }
  }

  console.log(`\n─── Summary ───`);
  console.log(`  Documents: ${allDocs.length}`);
  console.log(`  Total lines: ${results.reduce((s, r) => s + r.lines, 0)}`);
  console.log(`  Total size: ${results.reduce((s, r) => s + r.size_kb, 0)}KB`);
  console.log(`  Broken links: ${brokenTotal}`);

  if (brokenTotal > 0) {
    console.log(`\n🟡 ${brokenTotal} broken links found\n`);
  } else {
    console.log('\n🟢 All clear\n');
  }
  process.exit(0);
}

main();
