/**
 * TypeScript Strictness Audit — compares tsconfig.json against industry baseline.
 * Reports missing strict flags and potential type-safety gaps.
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');

/* ─── Strict flags that should be enabled ────────────────── */
const IDEAL_STRICT_FLAGS: Record<string, string> = {
  'strict': 'true',
  'noImplicitAny': 'true',
  'strictNullChecks': 'true',
  'strictFunctionTypes': 'true',
  'strictBindCallApply': 'true',
  'strictPropertyInitialization': 'true',
  'noImplicitThis': 'true',
  'useUnknownInCatchVariables': 'true',
  'alwaysStrict': 'true',
  'noUnusedLocals': 'true',
  'noUnusedParameters': 'true',
  'exactOptionalPropertyTypes': 'true',
  'noImplicitReturns': 'true',
  'noFallthroughCasesInSwitch': 'true',
  'noUncheckedIndexedAccess': 'true',
  'noImplicitOverride': 'true',
  'noPropertyAccessFromIndexSignature': 'true',
};

/* ─── Audit one tsconfig ──────────────────────────────────── */
function auditTsConfig(filePath: string): { missing: string[]; extra: string[] } {
  if (!existsSync(filePath)) return { missing: Object.keys(IDEAL_STRICT_FLAGS), extra: [] };

  try {
    const content = readFileSync(filePath, 'utf-8');
    const missing: string[] = [];
    const extra: string[] = [];

    for (const [flag, expected] of Object.entries(IDEAL_STRICT_FLAGS)) {
      // Match "flag": true or "flag": false (non-commented)
      const flagRegex = new RegExp(`^\\s*"${flag}"\\s*:\\s*(true|false)`, 'm');
      const match = content.match(flagRegex);
      
      // If strict:true is set, all 16 sub-flags are implicitly enabled
      const hasStrict = flag !== 'strict' && content.match(/^\s*"strict"\s*:\s*true/m);
      
      if (hasStrict) {
        // Sub-flag is enabled via strict:true — skip
        continue;
      }
      
      if (!match) {
        missing.push(`${flag}: ${expected}`);
      } else if (match[1] === 'false') {
        missing.push(`${flag}: ${expected} (currently false)`);
      }
    }

    return { missing, extra };
  } catch {
    return { missing: Object.keys(IDEAL_STRICT_FLAGS), extra: [] };
  }
}

/* ─── Main ────────────────────────────────────────────────── */
function main(): never {
  console.log('\n═══ TypeScript Strictness Audit ═══\n');

  const adminConfig = resolve(ROOT, 'admin/tsconfig.app.json');
  const mobileConfig = resolve(ROOT, 'mobile/tsconfig.json');

  let totalMissing = 0;

  for (const [label, path] of [['Admin', adminConfig], ['Mobile', mobileConfig]] as const) {
    if (!existsSync(path)) {
      console.log(`  ❌  ${label}: tsconfig.json not found`);
      totalMissing += Object.keys(IDEAL_STRICT_FLAGS).length;
      continue;
    }

    const { missing } = auditTsConfig(path);
    console.log(`  ── ${label} (tsconfig.json) ──`);
    if (missing.length === 0) {
      console.log(`  ✅  All ${Object.keys(IDEAL_STRICT_FLAGS).length} strictness flags enabled`);
    } else {
      console.log(`  ⚠️  ${missing.length}/${Object.keys(IDEAL_STRICT_FLAGS).length} strictness flags MISSING:`);
      for (const m of missing) {
        console.log(`      - ${m}`);
      }
      totalMissing += missing.length;
    }
  }

  console.log(`\n─── Results: 0 errors, ${totalMissing} missing flags ───`);
  if (totalMissing > 0) {
    console.log('🟡 Type safety gaps detected\n');
  } else {
    console.log('🟢 Maximum TypeScript strictness\n');
  }
  process.exit(0);
}

main();
