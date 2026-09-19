/**
 * audit-screen-tokens.ts — Frozen UI v1.2 static visual guard.
 *
 * Screens and routine product primitives must not introduce raw colour
 * literals. Product primitives also must not import legacy arcade/pixel UI.
 *
 * Run: npx tsx scripts/audit-screen-tokens.ts
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(__dirname, '..');
const TARGETS = [
  join(ROOT, 'mobile', 'src', 'screens'),
  join(ROOT, 'mobile', 'src', 'components', 'product'),
];
const HEX = /#[0-9a-fA-F]{3,8}\b/;
const RGB = /\brgba?\s*\(/i;
const FALLBACK = /\?\?\s*['"`]#[0-9a-fA-F]{3,8}/;
const PRODUCT_FORBIDDEN = [
  /\/PixelText['"]/,
  /\/ArcadeButton['"]/,
  /\/RetroInput['"]/,
  /\/GameCard['"]/,
  /FONTS\.display/,
  /FONTS\.mono/,
  /pixelShadow/i,
];

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return walk(full);
    return full.endsWith('.tsx') || full.endsWith('.ts') ? [full] : [];
  });
}

const colorViolations: string[] = [];
const productViolations: string[] = [];
let screenFontWeightCount = 0;

for (const target of TARGETS) {
  const isProduct = target.endsWith(join('components', 'product'));
  for (const file of walk(target)) {
    const lines = readFileSync(file, 'utf8').split('\n');
    lines.forEach((line, i) => {
      const trimmed = line.trim();
      if (trimmed.startsWith('//') || trimmed.startsWith('*')) return;

      if ((HEX.test(line) && !FALLBACK.test(line)) || RGB.test(line)) {
        colorViolations.push(`${file}:${i + 1}  ${trimmed}`);
      }
      if (!isProduct && /fontWeight\s*:/.test(line)) screenFontWeightCount += 1;
      if (isProduct && PRODUCT_FORBIDDEN.some((pattern) => pattern.test(line))) {
        productViolations.push(`${file}:${i + 1}  ${trimmed}`);
      }
    });
  }
}

if (screenFontWeightCount > 0) {
  console.warn(
    `[visual-contract] WARN: ${screenFontWeightCount} legacy fontWeight usages in screens; migrate through semantic typography roles.`,
  );
}

if (colorViolations.length > 0) {
  console.error(
    `[visual-contract] FAIL: ${colorViolations.length} raw colour literal(s) in protected UI paths:`,
  );
  colorViolations.forEach((violation) => console.error(`  ${violation}`));
}

if (productViolations.length > 0) {
  console.error(
    `[visual-contract] FAIL: ${productViolations.length} legacy arcade/pixel import(s) in routine product primitives:`,
  );
  productViolations.forEach((violation) => console.error(`  ${violation}`));
}

if (colorViolations.length > 0 || productViolations.length > 0) {
  process.exit(1);
}

console.log('[visual-contract] OK: protected UI paths use semantic visual roles.');
