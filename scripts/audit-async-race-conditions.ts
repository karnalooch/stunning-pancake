/**
 * Async Race Conditions & Blocking Tasks Audit — scans backend and frontend code for potential async issues.
 *
 * Detects:
 *   - Celery tasks with while-sleep blocking loops (N+1/Main thread blockage risk on eager/SQLite local environment)
 *   - Celery delay calls spawned without prior synchronous state lock initialization
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

    // 1. Check for Celery tasks with active while-sleep blocking loops (eager thread block risk)
    if (line.includes('@shared_task') || line.includes('@app.task')) {
      let block = '';
      for (let j = idx; j < Math.min(lines.length, idx + 40); j++) {
        block += lines[j] + '\n';
      }

      if (block.includes('while True') && (block.includes('time.sleep') || block.includes('sleep('))) {
        findings.push({
          file: relPath,
          line: lineNum,
          type: 'WARNING',
          finding: 'Celery task contains blocking while-sleep loop',
          suggestion: 'Tasks with active infinite loops block the main execution thread when run synchronously in Celery Eager mode (local SQLite). Use event-driven/polling ticks or cron tasks instead.',
        });
      }
    }

    // 2. Check for task.delay() called in views without immediate view-level state locks
    if (line.includes('.delay(') && filePath.includes('_views.py')) {
      let precedingBlock = '';
      for (let j = Math.max(0, idx - 50); j < idx; j++) {
        precedingBlock += lines[j] + '\n';
      }

      const setsState =
        precedingBlock.includes('set_batch_state')
        || precedingBlock.includes('set_live_state')
        || precedingBlock.includes('reset_batch_state')
        || precedingBlock.includes('reset_live_state')
        || precedingBlock.includes('record_moderation_audit')
        || precedingBlock.includes('.save(')
        || precedingBlock.includes('LeaderboardService.reset')
        || precedingBlock.includes('objects.create');
      if (!setsState) {
        findings.push({
          file: relPath,
          line: lineNum,
          type: 'ERROR',
          finding: 'Celery task delay() without prior state lock initialization',
          suggestion: 'Calling .delay() without initializing a state lock first causes race conditions on frontend polling. Explicitly set state to running/pending immediately in the API view before calling .delay().',
        });
      }
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

console.log('🔍 Running Async Race Conditions & Blocking Tasks Audit...');
walk(BACKEND_DIR);

if (findings.length > 0) {
  console.log(`\n❌ Found ${findings.length} async / blocking task findings:\n`);
  findings.forEach((f) => {
    console.log(`  [${f.type}] ${f.file}:${f.line}`);
    console.log(`    Finding:    ${f.finding}`);
    console.log(`    Suggestion: ${f.suggestion}\n`);
  });
  process.exit(findings.some((f) => f.type === 'ERROR') ? 1 : 0);
} else {
  console.log('✅ Async & Blocking Tasks Audit passed pomyślnie. Brak błędów.');
  process.exit(0);
}