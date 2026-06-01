/**
 * Run platform audit suite (static analysis + security checks).
 * Usage: npx tsx scripts/audit-all.ts [--quick]
 */
import { execSync } from 'node:child_process';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const quick = process.argv.includes('--quick');

const steps: { name: string; cmd: string; cwd?: string }[] = [
  { name: 'Auth session', cmd: 'npx tsx scripts/audit-auth-session.ts' },
  { name: 'Security config', cmd: 'npx tsx scripts/audit-security.ts' },
  { name: 'Secrets scan', cmd: 'npx tsx scripts/audit-secrets.ts' },
  { name: 'Env keys', cmd: 'npx tsx scripts/audit-env.ts' },
  { name: 'RBAC', cmd: 'npx tsx scripts/audit-rbac.ts' },
  { name: 'API gaps', cmd: 'npx tsx scripts/audit-api-gaps.ts' },
  { name: 'Async races', cmd: 'npx tsx scripts/audit-async-race-conditions.ts' },
  { name: 'ORM performance', cmd: 'npx tsx scripts/audit-orm-performance.ts' },
  { name: 'Simulator', cmd: 'npx tsx scripts/audit-simulator.ts' },
];

if (!quick) {
  steps.push(
    { name: 'Routes', cmd: 'npx tsx scripts/audit-routes.ts' },
    { name: 'Screens', cmd: 'npx tsx scripts/audit-screens.ts' },
    { name: 'SCA (npm/pip)', cmd: 'npx tsx scripts/audit-sca.ts' },
  );
}

let failed = 0;

console.log('═══════════════════════════════════════════');
console.log('  SPORT Platform — Full Audit');
console.log(quick ? '  (quick mode — skipping slow checks)' : '');
console.log('═══════════════════════════════════════════\n');

for (const step of steps) {
  process.stdout.write(`▶ ${step.name}... `);
  try {
    execSync(step.cmd, { cwd: ROOT, stdio: 'pipe', encoding: 'utf-8' });
    console.log('OK');
  } catch (err: unknown) {
    failed++;
    console.log('FAIL');
    const e = err as { stdout?: string; stderr?: string };
    if (e.stdout) console.log(e.stdout.slice(0, 2000));
    if (e.stderr) console.log(e.stderr.slice(0, 1000));
  }
}

console.log('\n═══════════════════════════════════════════');
if (failed) {
  console.log(`❌ ${failed} audit step(s) failed.`);
  process.exit(1);
}
console.log('✅ All audit steps passed.');
process.exit(0);
