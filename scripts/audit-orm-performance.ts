/**
 * ORM Performance Audit — scans backend python code for potential performance gotchas.
 *
 * Detects:
 *   - Cartesian JOIN multiplier risk (multiple Counts/Sums inside .annotate without distinct=True)
 *   - Missing batch size in .bulk_create (risk of too many SQL variables on SQLite)
 *   - Potential N+1 database queries (queries inside loops)
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { resolve, relative } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const BACKEND_DIR = resolve(ROOT, 'backend');

interface AuditFinding {
  file: string;
  line: number;
  type: 'ERROR' | 'WARNING';
  finding: string;
  suggestion: string;
}

const findings: AuditFinding[] = [];

function auditFile(filePath: string) {
  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const relPath = relative(ROOT, filePath);

  for (let idx = 0; idx < lines.length; idx++) {
    const lineNum = idx + 1;
    const line = lines[idx].trim();

    // 1. Check for Cartesian JOIN multiplier in annotate()
    if (line.includes('.annotate(')) {
      // Look forward up to 8 lines to gather the full annotate arguments
      let block = '';
      for (let j = idx; j < Math.min(lines.length, idx + 8); j++) {
        block += lines[j];
      }
      
      const counts = (block.match(/Count\(/g) || []).length;
      const sums = (block.match(/Sum\(/g) || []).length;
      const distincts = (block.match(/distinct\s*=\s*True/g) || []).length;

      if ((counts + sums) > 1 && distincts < (counts + sums)) {
        findings.push({
          file: relPath,
          line: lineNum,
          type: 'ERROR',
          finding: 'Cartesian JOIN multiplier risk',
          suggestion: 'Annotating multiple related Count/Sum/Avg fields without distinct=True on SQLite/Postgres multiplies records. Add distinct=True to each aggregator.',
        });
      }
    }

    // 2. Check for bulk_create without batch_size (may span multiple lines)
    if (line.includes('bulk_create(')) {
      let bulkBlock = '';
      for (let j = idx; j < Math.min(lines.length, idx + 6); j++) {
        bulkBlock += lines[j];
      }
      if (bulkBlock.includes('batch_size')) continue;
      findings.push({
        file: relPath,
        line: lineNum,
        type: 'ERROR',
        finding: 'bulk_create() without batch_size',
        suggestion: 'Using bulk_create without a batch_size parameter raises "too many SQL variables" errors on SQLite. Set batch_size=50.',
      });
    }

    // 3. Check for potential N+1 query loops
    if (line.startsWith('for ') && (line.includes('.objects.') || line.includes('.get(') || line.includes('.filter('))) {
      findings.push({
        file: relPath,
        line: lineNum,
        type: 'WARNING',
        finding: 'Potential database query inside loop (N+1 risk)',
        suggestion: 'Executing query operations inside a loop generates N+1 queries. Prefetch related records using select_related() or prefetch_related() instead.',
      });
    }
  }
}

function walk(dir: string) {
  if (!existsSync(dir)) return;
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = resolve(dir, entry.name);
    if (entry.isDirectory()) {
      const skip = ['node_modules', 'dist', '.git', 'venv', '.venv', '__pycache__', '.kilo'];
      if (!skip.includes(entry.name) && !entry.name.startsWith('.')) {
        walk(full);
      }
    } else if (entry.isFile() && entry.name.endsWith('.py')) {
      auditFile(full);
    }
  }
}

console.log('🔍 Running ORM Performance Audit on backend codebase...');
walk(BACKEND_DIR);

if (findings.length > 0) {
  console.log(`\n❌ Found ${findings.length} performance findings:\n`);
  findings.forEach((f) => {
    console.log(`  [${f.type}] ${f.file}:${f.line}`);
    console.log(`    Finding:    ${f.finding}`);
    console.log(`    Suggestion: ${f.suggestion}\n`);
  });
  process.exit(findings.some((f) => f.type === 'ERROR') ? 1 : 0);
} else {
  console.log('✅ ORM Performance Audit passed pomyślnie. Brak błędów.');
  process.exit(0);
}