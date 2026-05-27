/**
 * Security Audit — checks CORS config, hardcoded secrets, CSP headers, Django DEBUG mode.
 */
import { readFileSync, existsSync } from 'node:fs';
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

  // 1. DEBUG should be False in production (check env default)
  if (src.match(/DEBUG\s*=\s*True/)) {
    console.log('  ⚠️  DEBUG=True hardcoded — should be env-configured');
    warnings++;
  }

  // 2. CORS_ALLOW_ALL_ORIGINS = True is dangerous
  if (src.match(/CORS_ALLOW_ALL_ORIGINS\s*=\s*True/)) {
    console.log('  ❌  CORS_ALLOW_ALL_ORIGINS=True — any domain can access API');
    errors++;
  }

  // 3. Secret key should be from env, not hardcoded
  if (src.match(/SECRET_KEY\s*=\s*['"](?!.*getenv|environ|os\.)/)) {
    console.log('  ❌  SECRET_KEY appears hardcoded — must use environment variable');
    errors++;
  }

  // 4. Check for SECURE_SSL_REDIRECT
  if (!src.includes('SECURE_SSL_REDIRECT')) {
    console.log('  ⚠️  SECURE_SSL_REDIRECT not configured');
    warnings++;
  }

  // 5. Check for SECURE_HSTS_SECONDS
  if (!src.includes('SECURE_HSTS_SECONDS')) {
    console.log('  ⚠️  SECURE_HSTS_SECONDS not configured');
    warnings++;
  }

  // 6. Check for XSS protection
  if (!src.includes('SECURE_BROWSER_XSS_FILTER')) {
    console.log('  ⚠️  SECURE_BROWSER_XSS_FILTER not configured');
    warnings++;
  }

  // 7. Check for CSP middleware
  if (!src.includes('CSP_') && !src.includes('django-csp')) {
    console.log('  ⚠️  Content-Security-Policy middleware not configured');
    warnings++;
  }

  return { errors, warnings };
}

/* ─── Scan for secrets in code ───────────────────────────── */
function scanForSecrets(): { errors: number; warnings: number } {
  const patterns = [
    { regex: /['"][A-Za-z0-9+/]{40,}['"]/, label: 'Potential base64 token/secret' },
    { regex: /sk-[A-Za-z0-9]{20,}/, label: 'OpenAI/Stripe API key pattern' },
    { regex: /password\s*=\s*['"]\w{3,}['"](?!.*CHANGE_ME|placeholder)/i, label: 'Hardcoded password' },
  ];

  let warnings = 0;

  function scanDir(dir: string) {
    const { readdirSync } = require('node:fs');
    if (!existsSync(dir)) return;
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = resolve(dir, entry.name);
      if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules' && entry.name !== '__pycache__' && entry.name !== 'migrations' && entry.name !== '.git') {
        scanDir(full);
      } else if (entry.isFile() && /\.(py|ts|tsx|js|jsx|json|yml|yaml|cfg|toml)$/.test(entry.name) && !entry.name.includes('spec.') && !entry.name.includes('test.')) {
        try {
          const src = readFileSync(full, 'utf-8');
          for (const { regex, label } of patterns) {
            const matches = src.match(regex);
            if (matches) {
              // Skip .env.example and test files
              if (entry.name === '.env.example') continue;
              if (full.includes('test') || full.includes('__test')) continue;
              console.log(`  ⚠️  ${full.replace(ROOT, '')}: ${label}`);
              warnings++;
              break;
            }
          }
        } catch {}
      }
    }
  }

  scanDir(BACKEND);
  scanDir(resolve(ROOT, 'admin/src'));
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
