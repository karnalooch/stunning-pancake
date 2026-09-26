/**
 * Fresh-v1 optional art registry.
 *
 * Retired legacy generated PNGs are never loaded.
 * Optional official/decorative artwork falls back safely until a governed
 * replacement is explicitly approved.
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

export const VISION_BANNERS: Record<string, ImageSourcePropType | undefined> = {};

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z]/g, '');
}

export function crestForTenant(idOrName: string | null | undefined): ImageSourcePropType | undefined {
  if (!idOrName) return undefined;
  const n = normalize(idOrName);
  const key = (Object.keys(CREST) as CrestKey[]).find((k) => n.includes(k));
  return key ? CREST[key] : undefined;
}

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

export function crestInitials(name: string): string {
  return name.trim().slice(0, 2).toUpperCase();
}
