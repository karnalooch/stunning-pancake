/**
 * audit-screen-tokens.ts — design-system guard for mobile screens.
 *
 * FAILS (exit 1) when a raw hex color literal is used in a screen style
 * (must use theme tokens via Unistyles). A `?? '#...'` safety fallback is
 * allowed. Reports `fontWeight` usages as warnings (tracked for the pixel-font
 * migration in the vision->code phase) without failing.
 *
 * Run: npx tsx scripts/audit-screen-tokens.ts
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const SCREENS_DIR = join(__dirname, '..', 'mobile', 'src', 'screens');
const HEX = /#[0-9a-fA-F]{3,8}\b/;
const FALLBACK = /\?\?\s*['"`]#[0-9a-fA-F]{3,8}/; // `c.x ?? '#111'` allowed

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return walk(full);
    return full.endsWith('.tsx') || full.endsWith('.ts') ? [full] : [];
  });
}

const hexViolations: string[] = [];
let fontWeightCount = 0;

for (const file of walk(SCREENS_DIR)) {
  const lines = readFileSync(file, 'utf8').split('\n');
  lines.forEach((line, i) => {
    const trimmed = line.trim();
    if (trimmed.startsWith('//') || trimmed.startsWith('*')) return;
    if (HEX.test(line) && !FALLBACK.test(line)) {
      hexViolations.push(`${file}:${i + 1}  ${trimmed}`);
    }
    if (/fontWeight\s*:/.test(line)) fontWeightCount += 1;
  });
}

if (fontWeightCount > 0) {
  console.warn(`[tokens] WARN: ${fontWeightCount} fontWeight usages in screens (migrate to pixel font).`);
}

if (hexViolations.length > 0) {
  console.error(`[tokens] FAIL: ${hexViolations.length} inline hex color(s) in screens (use theme tokens):`);
  hexViolations.forEach((v) => console.error(`  ${v}`));
  process.exit(1);
}

console.log('[tokens] OK: no inline hex colors in mobile/src/screens.');
