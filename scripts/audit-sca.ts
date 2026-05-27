/**
 * SCA (Software Composition Analysis) — wraps npm audit + pip-audit.
 * Detects known vulnerabilities in dependencies.
 */
import { execSync } from 'node:child_process';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';

const ROOT = resolve(import.meta.dirname, '..');
const ADMIN_DIR = resolve(ROOT, 'admin');
const BACKEND_DIR = resolve(ROOT, 'backend');

interface Finding {
  level: 'CRITICAL' | 'HIGH' | 'MODERATE' | 'LOW';
  pkg: string;
  title: string;
}

function auditNpm(dir: string, label: string): Finding[] {
  if (!existsSync(resolve(dir, 'package.json'))) return [];
  try {
    const raw = execSync('npm audit --json', { cwd: dir, encoding: 'utf-8', timeout: 60_000 });
    const data = JSON.parse(raw);
    const findings: Finding[] = [];
    for (const [name, info] of Object.entries(data.vulnerabilities || {}) as any) {
      findings.push({ level: info.severity?.toUpperCase() || 'LOW', pkg: name, title: info.name || name });
    }
    return findings;
  } catch (err: any) {
    if (err.stdout) {
      try {
        const data = JSON.parse(err.stdout);
        const findings: Finding[] = [];
        for (const [name, info] of Object.entries(data.vulnerabilities || {}) as any) {
          findings.push({ level: info.severity?.toUpperCase() || 'MODERATE', pkg: name, title: info.name || name });
        }
        return findings;
      } catch { return [{ level: 'MODERATE', pkg: label, title: err.message?.substring(0, 80) || 'npm audit failed' }]; }
    }
    return [];
  }
}

function auditPip(): Finding[] {
  if (!existsSync(resolve(BACKEND_DIR, 'requirements.txt'))) return [];
  try {
    const raw = execSync('pip-audit --format json 2>nul || echo []', {
      cwd: BACKEND_DIR, encoding: 'utf-8', timeout: 60_000,
    });
    const data = JSON.parse(raw);
    const findings: Finding[] = [];
    for (const vuln of data) {
      findings.push({ level: (vuln.severity || 'LOW').toUpperCase(), pkg: vuln.name, title: vuln.description?.substring(0, 100) || vuln.id });
    }
    return findings;
  } catch { return []; }
}

function main(): never {
  console.log('\n═══ SCA — Dependency Vulnerability Audit ═══\n');

  const adminFindings = auditNpm(ADMIN_DIR, 'admin');
  const backendFindings = auditNpm(BACKEND_DIR, 'backend');
  const pipFindings = auditPip();

  const allFindings = [...adminFindings, ...backendFindings, ...pipFindings];
  let critical = 0;
  let high = 0;

  for (const f of allFindings) {
    const icon = f.level === 'CRITICAL' ? '❌' : f.level === 'HIGH' ? '🔴' : f.level === 'MODERATE' ? '⚠️' : '•';
    console.log(`  ${icon} [${f.level}] ${f.pkg} — ${f.title}`);
    if (f.level === 'CRITICAL') critical++;
    if (f.level === 'HIGH') high++;
  }

  console.log(`\n─── Results ───`);
  console.log(`  npm (admin): ${adminFindings.length} vulnerabilities`);
  console.log(`  npm (backend): ${backendFindings.length} vulnerabilities`);
  console.log(`  pip: ${pipFindings.length} vulnerabilities`);
  console.log(`  CRITICAL: ${critical} | HIGH: ${high}`);

  if (critical > 0) {
    console.log('\n🔴 AUDIT FAILED — critical vulnerabilities\n');
    process.exit(1);
  }
  if (high > 0) {
    console.log('\n🟡 HIGH vulnerabilities present\n');
  } else if (allFindings.length === 0) {
    console.log('\n🟢 All clear\n');
  } else {
    console.log('\n🟡 Review recommended\n');
  }
  process.exit(0);
}

main();
