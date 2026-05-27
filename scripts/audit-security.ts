/**
 * Security Audit — checks CORS config, hardcoded secrets, CSP headers, Django DEBUG mode.
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const BACKEND = resolve(ROOT, 'backend');

/* ─── Check Django settings ──────────────────────────────── */
function auditDjangoSettings(): { errors: number; warnings: number } {
  const settingsPath = resolve(BACKEND, 'core/settings.py');
  if (!existsSync(settingsPath)) return { errors: 0, warnings: 0 };

  const src = readFileSync(settingsPath, 'utf-8');
  let errors = 0;
  let warnings = 0;

  if (src.match(/^\s*DEBUG\s*=\s*True/m)) {
    console.log('  ⚠️  DEBUG=True active');
    warnings++;
  }
  if (src.match(/^\s*CORS_ALLOW_ALL_ORIGINS\s*=\s*True/m)) {
    console.log('  ❌  CORS_ALLOW_ALL_ORIGINS=True');
    errors++;
  }
  if (src.match(/SECRET_KEY\s*=\s*['"](?!.*getenv|environ|os\.)/)) {
    console.log('  ❌  SECRET_KEY appears hardcoded');
    errors++;
  }
  if (!src.includes('SECURE_SSL_REDIRECT')) {
    console.log('  ⚠️  SECURE_SSL_REDIRECT not configured');
    warnings++;
  }
  if (!src.includes('SECURE_HSTS_SECONDS')) {
    console.log('  ⚠️  SECURE_HSTS_SECONDS not configured');
    warnings++;
  }
  if (!src.includes('SECURE_BROWSER_XSS_FILTER')) {
    console.log('  ⚠️  SECURE_BROWSER_XSS_FILTER not configured');
    warnings++;
  }
  if (!src.includes('CSP_') && !src.includes('django-csp')) {
    console.log('  ⚠️  Content-Security-Policy middleware not configured');
    warnings++;
  }
  return { errors, warnings };
}

/* ─── Scan for secrets in code ───────────────────────────── */
function scanForSecrets(): { errors: number; warnings: number } {
  const patterns: { name: string; regex: RegExp; severity: string }[] = [
    { name: 'AWS Key', regex: /AKIA[0-9A-Z]{16}/, severity: 'CRITICAL' },
    { name: 'OpenAI Key', regex: /sk-[A-Za-z0-9]{32,}/, severity: 'HIGH' },
    { name: 'GitHub Token', regex: /gh[pousr]_[A-Za-z0-9_]{36,}/, severity: 'CRITICAL' },
    { name: 'Stripe Key', regex: /[sr]k_(live|test)_[A-Za-z0-9]{24,}/, severity: 'CRITICAL' },
    { name: 'Private Key', regex: /-----BEGIN (RSA|EC|DSA|OPENSSH) PRIVATE KEY-----/, severity: 'CRITICAL' },
    { name: 'Password literal', regex: /['"]password['"]\s*[:=]\s*['"][^'"]{4,}['"]/, severity: 'HIGH' },
    { name: 'PG/Mongo URI', regex: /(postgres(ql)?|mongodb(\+srv)?):\/\/[^:]+:[^@]+@/, severity: 'HIGH' },
    { name: 'Google API Key', regex: /AIza[0-9A-Za-z\-_]{35}/, severity: 'HIGH' },
  ];

  const skipDirs = new Set(['node_modules', '.git', '__pycache__', 'venv', '.venv', 'dist', 'dist-exe', '.expo', '.kilo', 'migrations']);
  const skipFiles = new Set(['package-lock.json', '.env.example', 'audit-secrets.ts']);
  const findings: string[] = [];

  function walk(dir: string) {
    if (!existsSync(dir)) return;
    try {
      const entries = readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const full = resolve(dir, entry.name);
        if (entry.isDirectory()) {
          if (!skipDirs.has(entry.name) && !entry.name.startsWith('.')) walk(full);
        } else if (entry.isFile() && !skipFiles.has(entry.name) && /\.(py|ts|tsx|js)$/.test(entry.name)) {
          try {
            const lines = readFileSync(full, 'utf-8').split('\n');
            for (let i = 0; i < lines.length; i++) {
              for (const pat of patterns) {
                if (pat.regex.test(lines[i])) {
                  findings.push(`[${pat.severity}] ${pat.name} — ${full.replace(ROOT, '')}:${i + 1}`);
                }
              }
            }
          } catch {}
        }
      }
    } catch {}
  }

  walk(resolve(ROOT, 'admin/src'));
  walk(BACKEND);

  let warnings = 0;
  for (const f of findings) {
    // Skip venv completely
    if (f.includes('venv')) continue;
    console.log(`  ⚠️  ${f}`);
    warnings++;
  }

  return { errors: 0, warnings };
}

/* ─── Main ────────────────────────────────────────────────── */
function main(): never {
  console.log('\n═══ Security Audit — CORS, Secrets, Headers ═══\n');

  console.log('─── Django Settings ───');
  const django = auditDjangoSettings();

  console.log('\n─── Secrets Scan ───');
  const secrets = scanForSecrets();

  const totalErrors = django.errors + secrets.errors;
  const totalWarnings = django.warnings + secrets.warnings;

  console.log(`\n─── Results: ${totalErrors} errors, ${totalWarnings} warnings ───`);
  if (totalErrors > 0) {
    console.log('🔴 AUDIT FAILED\n');
    process.exit(1);
  }
  console.log(totalWarnings > 0 ? '🟡 Passed with warnings\n' : '🟢 All clear\n');
  process.exit(0);
}

main();
