/**
 * Secret Scanning — detects API keys, tokens, passwords in source code.
 * Lightweight regex-based scan. For production use, pair with Gitleaks/TruffleHog.
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve, basename } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');

const PATTERNS: { name: string; regex: RegExp; severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' }[] = [
  { name: 'AWS Access Key', regex: /AKIA[0-9A-Z]{16}/, severity: 'CRITICAL' },
  { name: 'Generic API Key', regex: /['"][A-Za-z0-9+/]{32,}['"]/, severity: 'HIGH' },
  { name: 'OpenAI Key', regex: /sk-[A-Za-z0-9]{32,}/, severity: 'HIGH' },
  { name: 'GitHub Token', regex: /gh[pousr]_[A-Za-z0-9_]{36,}/, severity: 'CRITICAL' },
  { name: 'Google API Key', regex: /AIza[0-9A-Za-z\-_]{35}/, severity: 'HIGH' },
  { name: 'JWT Token', regex: /eyJ[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+/, severity: 'MEDIUM' },
  { name: 'Private Key Header', regex: /-----BEGIN (RSA|EC|DSA|OPENSSH) PRIVATE KEY-----/, severity: 'CRITICAL' },
  { name: 'Hardcoded Password (literal)', regex: /['"]password['"]\s*[:=]\s*['"][^'"]{4,}['"]/, severity: 'HIGH' },
  { name: 'Stripe Key', regex: /[sr]k_(live|test)_[A-Za-z0-9]{24,}/, severity: 'CRITICAL' },
  { name: 'Slack Webhook', regex: /https:\/\/hooks\.slack\.com\/services\/[A-Za-z0-9\/]+/, severity: 'HIGH' },
  { name: 'MongoDB URI', regex: /mongodb(\+srv)?:\/\/[^:]+:[^@]+@/, severity: 'HIGH' },
  { name: 'Postgres URI with creds', regex: /postgres(ql)?:\/\/[^:]+:[^@]+@/, severity: 'HIGH' },
];

const SKIP_DIRS = new Set(['node_modules', '.git', '__pycache__', 'venv', '.venv', 'dist', 'dist-exe', '.expo', '.kilo', 'migrations']);
const SKIP_FILES = new Set(['package-lock.json', 'yarn.lock', 'poetry.lock', '.env.example', 'audit-secrets.ts', 'audit-sca.ts']);

interface Finding { file: string; secret: string; severity: string; line?: number }

function scanFile(filePath: string): Finding[] {
  const findings: Finding[] = [];
  try {
    const lines = readFileSync(filePath, 'utf-8').split('\n');
    for (let i = 0; i < lines.length; i++) {
      for (const pat of PATTERNS) {
        const m = lines[i].match(pat.regex);
        if (m) {
          const relative = filePath.replace(ROOT, '');
          findings.push({ file: relative, secret: pat.name, severity: pat.severity, line: i + 1 });
        }
      }
    }
  } catch {}
  return findings;
}

function scanDir(dir: string): Finding[] {
  const findings: Finding[] = [];
  if (!existsSync(dir)) return findings;
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = resolve(dir, entry.name);
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name) && !entry.name.startsWith('.')) {
          findings.push(...scanDir(full));
        }
      } else if (entry.isFile() && !SKIP_FILES.has(entry.name) && /\.(py|ts|tsx|js|jsx|json|yml|yaml|cfg|toml|env|sh)$/.test(entry.name)) {
        findings.push(...scanFile(full));
      }
    }
  } catch {}
  return findings;
}

function main(): never {
  console.log('\n═══ Secret Scanning ═══\n');

  const findings = [
    ...scanDir(resolve(ROOT, 'backend')),
    ...scanDir(resolve(ROOT, 'admin/src')),
  ];

  let critical = 0;
  let high = 0;
  let medium = 0;

  for (const f of findings) {
    const icon = f.severity === 'CRITICAL' ? '🔴' : f.severity === 'HIGH' ? '🟠' : '⚠️';
    console.log(`  ${icon} [${f.severity}] ${f.secret} — ${f.file}:${f.line}`);
    if (f.severity === 'CRITICAL') critical++;
    if (f.severity === 'HIGH') high++;
    if (f.severity === 'MEDIUM') medium++;
  }

  if (findings.length === 0) {
    console.log('  ✅ No secrets detected');
  }

  console.log(`\n─── Results: ${findings.length} findings (${critical} critical, ${high} high, ${medium} medium) ───`);

  if (critical > 0) {
    console.log('🔴 CRITICAL SECRETS DETECTED\n');
    process.exit(1);
  }
  if (findings.length > 0) {
    console.log('🟡 Secrets found — review immediately\n');
  } else {
    console.log('🟢 All clear\n');
  }
  process.exit(0);
}

main();
