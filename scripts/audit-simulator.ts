/**
 * Simulator State & Telemetry Order Audit
 *
 * Detects:
 *   - Telemetry execution order bugs (ensures starters phase runs BEFORE telemetry interpolation phase)
 *   - Missing type-safety casting for real Redis (which returns bytes/strings) on live simulator stats
 *   - Missing concurrency locks on multi-threaded periodic task invocations
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { resolve, relative } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const BACKEND_DIR = resolve(ROOT, 'backend');

interface Finding {
    file: string;
    line: number;
    type: 'ERROR' | 'WARNING';
    finding: string;
    suggestion: string;
}

const findings: Finding[] = [];

function auditSimulatorCode(filePath: string) {
    const content = readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    const relPath = relative(ROOT, filePath);

    // 1. Check for Telemetry Order bug (Phase 1 Telemetry must come AFTER new rides generation)
    if (filePath.endsWith('simulator_tasks.py')) {
        const p1Index = content.indexOf('Phase 1: Interpolate');
        const p2Index = content.indexOf('Phase 2: Finish expired');
        const p3Index = content.indexOf('Phase 3: Start new');

        if (p1Index !== -1 && p3Index !== -1 && p1Index < p3Index) {
            findings.push({
                file: relPath,
                line: 1,
                type: 'ERROR',
                finding: 'Telemetry interpolation phase scheduled BEFORE new riders generation',
                suggestion: 'New riders started in the current tick will experience an 8-10s delay before showing up on the map. Move the telemetry interpolation phase to run AFTER new rides are generated.'
            });
        }
    }

    // 2. Check for missing type casting from Redis get_live_state properties
    if (content.includes("get_live_state()")) {
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (line.includes("state['total_users']") || line.includes("state['active_ratio']") || line.includes("state['cheat_ratio']")) {
                const hasCast = line.includes('int(') || line.includes('float(');
                if (!hasCast) {
                    findings.push({
                        file: relPath,
                        line: i + 1,
                        type: 'ERROR',
                        finding: 'Missing numeric type casting for Redis live state attributes',
                        suggestion: 'Real Redis on production returns everything as strings/bytes. Accessing state attributes without float() or int() casting will trigger TypeError crashes in mathematical calculations.'
                    });
                }
            }
        }
    }

    // 3. Check for concurrent tick race condition (e.g. running ticks without a concurrency lock)
    if (filePath.endsWith('simulator_tasks.py') && content.includes('def live_tick_task')) {
        const hasLock = content.includes('acquire_live_tick_lock') || content.includes('tick_lock');
        if (!hasLock) {
            findings.push({
                file: relPath,
                line: 1,
                type: 'ERROR',
                finding: 'Simulator tick execution without a concurrency lock',
                suggestion: 'When HTTP poll endpoints and background loops fire simultaneously, overlapping ticks will trigger database conflicts. Ensure live_tick_task checks and acquires a concurrency lock before execution.'
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
            if (!skip.includes(entry.name) && !entry.name.startsWith('.')) walk(full);
        } else if (entry.isFile() && entry.name.endsWith('.py')) {
            auditSimulatorCode(full);
        }
    }
}

console.log('🔍 Running Simulator State & Telemetry Order Audit...');
walk(BACKEND_DIR);

if (findings.length > 0) {
  console.log(`\n❌ Found ${findings.length} simulator architectural findings:\n`);
  findings.forEach((f) => {
    console.log(`  [${f.type}] ${f.file}:${f.line}`);
    console.log(`    Finding:    ${f.finding}`);
    console.log(`    Suggestion: ${f.suggestion}\n`);
  });
  process.exit(findings.some((f) => f.type === 'ERROR') ? 1 : 0);
} else {
  console.log('✅ Simulator State & Telemetry Order Audit passed successfully. No anomalies found.');
  process.exit(0);
}