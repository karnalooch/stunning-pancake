/**
 * visionAssets.ts — OPTIONAL registry for vision-parity art (Faza D).
 *
 * The PNGs are produced by the asset generator (scripts/asset_definitions.py
 * -> generate_assets.py). Until they exist in assets/generated, every entry
 * stays `undefined` and the composition components render a pixel fallback.
 * After generating, replace `undefined` with a static `require(...)` — the
 * components upgrade automatically with no further wiring.
 *
 * Metro only bundles STATIC require() paths, so we must not require files that
 * do not exist yet; hence the explicit `undefined` placeholders.
 */
import type { ImageSourcePropType } from 'react-native';

export type CrestKey = 'gdansk' | 'katowice' | 'lublin' | 'siedlce' | 'warszawa';
export type DeptKey = 'it' | 'marketing' | 'hr' | 'sales';

const CREST: Record<CrestKey, ImageSourcePropType | undefined> = {
  gdansk: undefined,
  katowice: undefined,
  lublin: undefined,
  siedlce: undefined,
  warszawa: undefined,
};

const DEPT: Record<DeptKey, ImageSourcePropType | undefined> = {
  it: undefined,
  marketing: undefined,
  hr: undefined,
  sales: undefined,
};

const ACHIEVEMENT: Record<string, ImageSourcePropType | undefined> = {};

export const VISION_BANNERS: Record<string, ImageSourcePropType | undefined> = {
  city_lublin: undefined,
  finish_meta: undefined,
  avatar_frame: undefined,
  frame_ornate: undefined,
};

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip diacritics
    .replace(/[^a-z]/g, ''); // drop spaces, hyphens, "-city", etc. collapse
}

/** Map a tenant id or display name to a crest source (undefined until generated). */
export function crestForTenant(idOrName: string | null | undefined): ImageSourcePropType | undefined {
  if (!idOrName) return undefined;
  const n = normalize(idOrName);
  const key = (Object.keys(CREST) as CrestKey[]).find((k) => n.includes(k));
  return key ? CREST[key] : undefined;
}

/** Map a department name to a team icon (undefined until generated). */
export function deptIconFor(name: string | null | undefined): ImageSourcePropType | undefined {
  if (!name) return undefined;
  const n = normalize(name);
  if (n.includes('it') || n.includes('dev')) return DEPT.it;
  if (n.includes('market')) return DEPT.marketing;
  if (n.includes('hr') || n.includes('kadr')) return DEPT.hr;
  if (n.includes('sprzeda') || n.includes('sales')) return DEPT.sales;
  return undefined;
}

export function achievementIcon(id: string): ImageSourcePropType | undefined {
  return ACHIEVEMENT[id];
}

/** Two-letter fallback initials for a crest when its PNG is absent. */
export function crestInitials(name: string): string {
  return name.trim().slice(0, 2).toUpperCase();
}
