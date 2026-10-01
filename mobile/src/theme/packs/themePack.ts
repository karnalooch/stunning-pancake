/** Data-only theme contract. No scripts, URLs, fonts or layout overrides. */
export const PALETTE_KEYS = [
  'canvas', 'surface', 'raised', 'text', 'muted', 'action', 'actionPressed',
  'onAction', 'border', 'success', 'warning', 'error', 'onError',
] as const;
export type PaletteKey = (typeof PALETTE_KEYS)[number];
export type ThemePalette = Readonly<Record<PaletteKey, string>>;
export type ColorMode = 'light' | 'dark';
export type ModePreference = ColorMode | 'system';
export interface ThemePack {
  readonly schemaVersion: 1;
  readonly id: string;
  readonly name: string;
  readonly light: ThemePalette;
  readonly dark: ThemePalette;
}
export interface AppearancePreferences {
  readonly themeId: string;
  readonly mode: ModePreference;
  readonly highContrast: boolean;
}
export const MAX_PACK_CHARACTERS = 16384;
export const MAX_CUSTOM_PACKS = 10;
export class ThemePackError extends Error {
  constructor(readonly code: 'format' | 'contrast' | 'limit' | 'duplicate' | 'missing' | 'storage') {
    super(`Theme pack: ${code}`);
    this.name = 'ThemePackError';
  }
}
function record(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new ThemePackError('format');
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) throw new ThemePackError('format');
  const actual = Object.keys(value);
  if (actual.length !== keys.length || actual.some((key) => !keys.includes(key))) {
    throw new ThemePackError('format');
  }
  return value as Record<string, unknown>;
}
function luminance(hex: string): number {
  const linearChannel = (offset: number): number => {
    const channel = parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  };
  return linearChannel(1) * 0.2126 + linearChannel(3) * 0.7152 + linearChannel(5) * 0.0722;
}
export function contrastRatio(a: string, b: string): number {
  const x = luminance(a);
  const y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
function validatePalette(value: unknown): ThemePalette {
  const source = record(value, PALETTE_KEYS);
  const result = {} as Record<PaletteKey, string>;
  for (const key of PALETTE_KEYS) {
    if (typeof source[key] !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(source[key])) {
      throw new ThemePackError('format');
    }
    result[key] = source[key].toUpperCase();
  }
  const requireContrast = (a: PaletteKey, b: PaletteKey, minimum: number) => {
    if (contrastRatio(result[a], result[b]) < minimum) throw new ThemePackError('contrast');
  };
  for (const background of ['canvas', 'surface', 'raised'] as const) {
    for (const text of ['text', 'muted', 'action', 'success', 'warning', 'error'] as const) {
      requireContrast(text, background, 4.5);
    }
    requireContrast('border', background, 3);
  }
  requireContrast('onAction', 'action', 4.5);
  requireContrast('onAction', 'actionPressed', 4.5);
  requireContrast('onError', 'error', 4.5);
  return Object.freeze(result);
}
export function validateThemePack(value: unknown): ThemePack {
  const source = record(value, ['schemaVersion', 'id', 'name', 'light', 'dark']);
  if (source.schemaVersion !== 1 || typeof source.id !== 'string' ||
      !/^[a-z][a-z0-9-]{2,39}$/.test(source.id) || typeof source.name !== 'string' ||
      source.name.trim() !== source.name || source.name.length < 1 || source.name.length > 48 ||
      /[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069<>]/.test(source.name)) {
    throw new ThemePackError('format');
  }
  return Object.freeze({ schemaVersion: 1, id: source.id, name: source.name,
    light: validatePalette(source.light), dark: validatePalette(source.dark) });
}
export function parseThemePack(json: string): ThemePack {
  if (json.length > MAX_PACK_CHARACTERS) throw new ThemePackError('limit');
  let value: unknown;
  try { value = JSON.parse(json); } catch { throw new ThemePackError('format'); }
  return validateThemePack(value);
}
export function exportThemePack(pack: ThemePack): string {
  return JSON.stringify(validateThemePack(pack), null, 2);
}
export function validatePreferences(value: unknown): AppearancePreferences {
  const source = record(value, ['themeId', 'mode', 'highContrast']);
  if (typeof source.themeId !== 'string' || !/^[a-z][a-z0-9-]{2,39}$/.test(source.themeId) ||
      !['light', 'dark', 'system'].includes(source.mode as string) ||
      typeof source.highContrast !== 'boolean') throw new ThemePackError('format');
  return Object.freeze({ themeId: source.themeId, mode: source.mode as ModePreference,
    highContrast: source.highContrast });
}
export function resolveColorMode(preference: ModePreference, system: string | null | undefined): ColorMode {
  return preference === 'system' ? (system === 'dark' ? 'dark' : 'light') : preference;
}
const highContrastLight: ThemePalette = Object.freeze({
  canvas: '#FFFFFF', surface: '#FFFFFF', raised: '#FFFFFF', text: '#000000', muted: '#000000',
  action: '#000000', actionPressed: '#000000', onAction: '#FFFFFF', border: '#000000',
  success: '#004000', warning: '#603000', error: '#800000', onError: '#FFFFFF',
});
const highContrastDark: ThemePalette = Object.freeze({
  canvas: '#000000', surface: '#000000', raised: '#000000', text: '#FFFFFF', muted: '#FFFFFF',
  action: '#FFFF00', actionPressed: '#FFFFFF', onAction: '#000000', border: '#FFFFFF',
  success: '#80FF80', warning: '#FFFF80', error: '#FFB0B0', onError: '#000000',
});
export function resolvePalette(pack: ThemePack, mode: ColorMode, highContrast: boolean): ThemePalette {
  return highContrast ? (mode === 'dark' ? highContrastDark : highContrastLight) : pack[mode];
}
