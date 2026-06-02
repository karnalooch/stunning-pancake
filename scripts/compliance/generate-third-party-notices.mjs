#!/usr/bin/env node
/**
 * Generate THIRD_PARTY_NOTICES.md from admin/package-lock.json and backend/requirements.txt.
 * No network required for npm (lockfile licenses). Python uses pip-licenses or pip show when available.
 *
 * Usage:
 *   node scripts/compliance/generate-third-party-notices.mjs [--check] [--out PATH]
 *
 * --check  Exit 1 if disallowed licenses (GPL/AGPL/NC/proprietary) or UNKNOWN are found.
 */

import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..');
const ADMIN_LOCK = join(ROOT, 'admin/package-lock.json');
const BACKEND_REQ = join(ROOT, 'backend/requirements.txt');
const DEFAULT_OUT = join(ROOT, 'THIRD_PARTY_NOTICES.md');

const DISALLOWED = /\b(AGPL|GPL|GNU General Public|GNU Affero|Non-Commercial|Non Commercial|Commercial|proprietary)\b/i;
const COPYLEFT_REVIEW = /\b(LGPL|MPL-2\.0|Mozilla Public)\b/i;

/** When package-lock.json omits license (offline fallback). */
const NPM_LICENSE_FALLBACK = {
  '@mapbox/jsonlint-lines-primitives': 'MIT',
};

/** SPDX-ish names for top-level backend deps when pip metadata is unavailable (offline fallback). */
const PY_LICENSE_FALLBACK = {
  django: 'BSD-3-Clause',
  djangorestframework: 'BSD-3-Clause',
  'django-cors-headers': 'MIT',
  'psycopg2-binary': 'LGPL-3.0-or-later',
  'python-dotenv': 'BSD-3-Clause',
  gunicorn: 'MIT',
  'drf-spectacular': 'BSD-3-Clause',
  redis: 'MIT',
  pydantic: 'MIT',
  requests: 'Apache-2.0',
  'dj-database-url': 'BSD-3-Clause',
  'django-filter': 'BSD-3-Clause',
  'djangorestframework-gis': 'BSD-3-Clause',
  stripe: 'MIT',
  pillow: 'MIT-Camera',
  'djangorestframework-simplejwt': 'MIT',
  'django-allauth': 'MIT',
  celery: 'BSD-3-Clause',
  'django-celery-results': 'BSD-3-Clause',
  'django-celery-beat': 'MIT',
  pluggy: 'MIT',
  'firebase-admin': 'Apache-2.0',
  'sentry-sdk': 'MIT',
  whitenoise: 'MIT',
  'scikit-learn': 'BSD-3-Clause',
  numpy: 'BSD-3-Clause',
  sendgrid: 'MIT',
  cryptography: 'Apache-2.0 OR BSD-3-Clause',
  'django-stubs': 'MIT',
};

function parseArgs(argv) {
  const args = { check: false, out: DEFAULT_OUT };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--check') args.check = true;
    else if (argv[i] === '--out' && argv[i + 1]) args.out = resolve(argv[++i]);
  }
  return args;
}

function normalizeLicense(raw) {
  if (raw == null) return 'UNKNOWN';
  if (typeof raw === 'string') return raw.trim() || 'UNKNOWN';
  if (Array.isArray(raw)) return raw.map((x) => normalizeLicense(x)).join(' OR ');
  if (typeof raw === 'object') {
    if (raw.type) return String(raw.type).trim();
    if (raw.license) return normalizeLicense(raw.license);
  }
  return 'UNKNOWN';
}

function licenseGroupKey(license) {
  const n = license.toUpperCase();
  if (n.includes('MIT')) return 'MIT';
  if (n.includes('APACHE')) return 'Apache-2.0';
  if (n.includes('BSD')) return 'BSD';
  if (n.includes('ISC')) return 'ISC';
  if (n.includes('LGPL')) return 'LGPL';
  if (n.includes('GPL')) return 'GPL';
  if (n.includes('MPL')) return 'MPL';
  if (n === 'UNKNOWN') return 'UNKNOWN';
  return license;
}

function packageNameFromLockPath(lockPath) {
  const idx = lockPath.lastIndexOf('node_modules/');
  if (idx === -1) return null;
  return lockPath.slice(idx + 'node_modules/'.length);
}

function readNpmPackageJsonLicense(name) {
  const pkgJsonPath = join(ROOT, 'admin/node_modules', name, 'package.json');
  if (!existsSync(pkgJsonPath)) return null;
  try {
    const pkg = JSON.parse(readFileSync(pkgJsonPath, 'utf8'));
    return normalizeLicense(pkg.license);
  } catch {
    return null;
  }
}

function resolveNpmLicense(name, lockLicense) {
  const fromLock = normalizeLicense(lockLicense);
  if (fromLock !== 'UNKNOWN') return fromLock;
  const fromNode = readNpmPackageJsonLicense(name);
  if (fromNode && fromNode !== 'UNKNOWN') return fromNode;
  if (NPM_LICENSE_FALLBACK[name]) return NPM_LICENSE_FALLBACK[name];
  return 'UNKNOWN';
}

function scanNpmLockfile() {
  if (!existsSync(ADMIN_LOCK)) {
    console.warn('warn: admin/package-lock.json not found');
    return [];
  }
  const lock = JSON.parse(readFileSync(ADMIN_LOCK, 'utf8'));
  const entries = [];
  for (const [path, meta] of Object.entries(lock.packages || {})) {
    if (!path.startsWith('node_modules/')) continue;
    const name = packageNameFromLockPath(path);
    if (!name) continue;
    entries.push({
      ecosystem: 'npm',
      name,
      version: meta.version || '',
      license: resolveNpmLicense(name, meta.license),
    });
  }
  entries.sort((a, b) => a.name.localeCompare(b.name) || a.version.localeCompare(b.version));
  return entries;
}

function parseRequirementsTxt() {
  if (!existsSync(BACKEND_REQ)) return [];
  const lines = readFileSync(BACKEND_REQ, 'utf8').split(/\r?\n/);
  const specs = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const bare = trimmed.split('#')[0].trim();
    const match = bare.match(/^([A-Za-z0-9][A-Za-z0-9._-]*)(.*)$/);
    if (!match) continue;
    let name = match[1];
    const extras = name.match(/^([^\[]+)\[([^\]]+)\]$/);
    if (extras) name = extras[1];
    specs.push({ name, spec: bare });
  }
  return specs;
}

function pipLicensesJson() {
  try {
    const out = execSync('pip-licenses --format=json --with-urls', {
      cwd: join(ROOT, 'backend'),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 120_000,
    });
    return JSON.parse(out);
  } catch {
    return null;
  }
}

function pipShowLicense(pkgName) {
  try {
    const out = execSync(`pip show ${pkgName}`, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 30_000,
    });
    const m = out.match(/^License:\s*(.+)$/m);
    const m2 = out.match(/^Version:\s*(.+)$/m);
    return {
      license: m ? m[1].trim() : null,
      version: m2 ? m2[1].trim() : '',
    };
  } catch {
    return null;
  }
}

function scanPythonRequirements() {
  const specs = parseRequirementsTxt();
  const pipMap = new Map();
  const pipJson = pipLicensesJson();
  if (pipJson) {
    for (const row of pipJson) {
      pipMap.set(row.Name.toLowerCase(), {
        license: normalizeLicense(row.License),
        version: row.Version || '',
      });
    }
  }

  const entries = [];
  for (const { name, spec } of specs) {
    const key = name.toLowerCase();
    let license = 'UNKNOWN';
    let version = '';
    const fromPip = pipMap.get(key);
    if (fromPip) {
      license = fromPip.license;
      version = fromPip.version;
    } else {
      const shown = pipShowLicense(name);
      if (shown?.license) {
        license = normalizeLicense(shown.license);
        version = shown.version;
      } else if (PY_LICENSE_FALLBACK[key]) {
        license = PY_LICENSE_FALLBACK[key];
      }
      if (!version) {
        const verMatch = spec.match(/==\s*([^\s,;]+)/);
        if (verMatch) version = verMatch[1];
        else {
          const geMatch = spec.match(/>=\s*([^\s,;]+)/);
          if (geMatch) version = `>=${geMatch[1]}`;
        }
      }
    }
    entries.push({
      ecosystem: 'pip',
      name,
      version,
      license,
      spec,
    });
  }
  entries.sort((a, b) => a.name.localeCompare(b.name));
  return entries;
}

function groupByLicense(entries) {
  const groups = new Map();
  for (const e of entries) {
    const key = licenseGroupKey(e.license);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(e);
  }
  const order = ['MIT', 'Apache-2.0', 'BSD', 'ISC', 'LGPL', 'MPL', 'GPL', 'UNKNOWN'];
  return [...groups.entries()].sort((a, b) => {
    const ia = order.indexOf(a[0]);
    const ib = order.indexOf(b[0]);
    if (ia === -1 && ib === -1) return a[0].localeCompare(b[0]);
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });
}

function formatEntry(e) {
  const ver = e.version ? `@${e.version}` : '';
  return `- \`${e.name}${ver}\` — ${e.license}`;
}

function buildMarkdown(npmEntries, pipEntries) {
  const generated = new Date().toISOString().slice(0, 10);
  const lines = [
    '# Third-Party Notices',
    '',
    `> Auto-generated on **${generated}**. Do not edit manually.`,
    '> Regenerate before each production release (see [docs/compliance/RELEASE_LEGAL_COMPLIANCE_PACKAGE.md](docs/compliance/RELEASE_LEGAL_COMPLIANCE_PACKAGE.md)).',
    '',
    '## How to regenerate',
    '',
    '```bash',
    '# From repository root (npm lockfile only; no network required for admin):',
    'node scripts/compliance/generate-third-party-notices.mjs',
    '',
    '# Or from admin workspace (after npm ci):',
    'cd admin && npm run licenses:report',
    '',
    '# For accurate Python licenses, install backend deps first:',
    'pip install -r backend/requirements.txt',
    'pip install pip-licenses',
    'node scripts/compliance/generate-third-party-notices.mjs',
    '```',
    '',
    '## Summary',
    '',
    `| Stack | Packages | Source |`,
    `|-------|----------|--------|`,
    `| Admin (npm) | ${npmEntries.length} | \`admin/package-lock.json\` |`,
    `| Backend (pip, direct) | ${pipEntries.length} | \`backend/requirements.txt\` |`,
    '',
    '> Transitive Python dependencies are included when `pip-licenses` is installed; otherwise only direct requirements are listed with fallback SPDX names.',
    '',
    '## Admin Dashboard (npm)',
    '',
  ];

  if (npmEntries.length === 0) {
    lines.push('_No npm packages found._', '');
  } else {
    for (const [group, items] of groupByLicense(npmEntries)) {
      lines.push(`### ${group}`, '');
      for (const e of items) lines.push(formatEntry(e));
      lines.push('');
    }
  }

  lines.push('## Backend (Python, direct requirements)', '');
  if (pipEntries.length === 0) {
    lines.push('_No Python packages found._', '');
  } else {
    for (const [group, items] of groupByLicense(pipEntries)) {
      lines.push(`### ${group}`, '');
      for (const e of items) lines.push(formatEntry(e));
      lines.push('');
    }
  }

  lines.push(
    '## License policy',
    '',
    'Production releases must not ship with **unreviewed** GPL/AGPL or unknown licenses.',
    'LGPL dependencies (e.g. psycopg2-binary) require legal review for distribution model.',
    'Run `node scripts/compliance/generate-third-party-notices.mjs --check` in CI to flag blockers.',
    '',
  );

  return lines.join('\n');
}

function runCheck(npmEntries, pipEntries) {
  const problems = [];
  const all = [...npmEntries, ...pipEntries];
  for (const e of all) {
    if (DISALLOWED.test(e.license)) {
      problems.push({ level: 'error', pkg: e.name, license: e.license, reason: 'disallowed license' });
    } else if (COPYLEFT_REVIEW.test(e.license)) {
      problems.push({ level: 'warn', pkg: e.name, license: e.license, reason: 'copyleft — legal review required' });
    } else if (e.license === 'UNKNOWN' || /\bUNKNOWN\b/i.test(e.license)) {
      problems.push({ level: 'error', pkg: e.name, license: e.license, reason: 'unknown license' });
    }
  }
  return problems;
}

function main() {
  const args = parseArgs(process.argv);
  const npmEntries = scanNpmLockfile();
  const pipEntries = scanPythonRequirements();
  const md = buildMarkdown(npmEntries, pipEntries);

  if (!args.check) {
    writeFileSync(args.out, md, 'utf8');
    console.log(`Wrote ${args.out}`);
    console.log(`  npm: ${npmEntries.length} packages`);
    console.log(`  pip: ${pipEntries.length} direct packages`);
  }

  const problems = runCheck(npmEntries, pipEntries);
  const errors = problems.filter((p) => p.level === 'error');
  const warns = problems.filter((p) => p.level === 'warn');

  if (warns.length) {
    console.warn('\nLicense review warnings:');
    for (const w of warns) console.warn(`  [warn] ${w.pkg}: ${w.license} (${w.reason})`);
  }

  if (args.check) {
    if (errors.length) {
      console.error('\nLicense compliance check FAILED:');
      for (const e of errors) console.error(`  [error] ${e.pkg}: ${e.license} (${e.reason})`);
      process.exit(1);
    }
    if (warns.length) {
      console.warn('\nLicense check passed with warnings (copyleft review required).');
    } else {
      console.log('License compliance check passed.');
    }
    return;
  }

  if (errors.length) {
    console.warn('\nNote: run with --check before release; current data has license blockers:');
    for (const e of errors) console.error(`  [error] ${e.pkg}: ${e.license}`);
  }
}

main();
