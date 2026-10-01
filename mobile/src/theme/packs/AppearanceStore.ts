import { BUILTIN_THEME_PACKS } from './builtins';
import {
  MAX_CUSTOM_PACKS, MAX_PACK_CHARACTERS, ThemePackError, parseThemePack,
  validatePreferences, validateThemePack, type AppearancePreferences, type ThemePack,
} from './themePack';

export const APPEARANCE_STORAGE_KEY = 'appearance_v1';
export interface AppearanceStorage {
  getString(key: string): string | undefined;
  set(key: string, value: string): void;
}
export interface AppearanceSnapshot {
  readonly preferences: AppearancePreferences;
  readonly customPacks: readonly ThemePack[];
  readonly persistence: 'available' | 'unavailable';
  readonly recovered: boolean;
}
const defaults: AppearancePreferences = Object.freeze({ themeId: 'roadbook', mode: 'system', highContrast: false });

/** Synchronous external store; one storage write commits a complete validated transaction. */
export class AppearanceStore {
  private snapshot: AppearanceSnapshot;
  private listeners = new Set<() => void>();
  constructor(private readonly storage: AppearanceStorage | null) {
    let preferences = defaults;
    let customPacks: readonly ThemePack[] = [];
    let recovered = false;
    let persistence: AppearanceSnapshot['persistence'] = storage ? 'available' : 'unavailable';
    try {
      const saved = storage?.getString(APPEARANCE_STORAGE_KEY);
      if (saved !== undefined) {
        if (saved.length > MAX_PACK_CHARACTERS * MAX_CUSTOM_PACKS + 1024) throw new ThemePackError('limit');
        const data = JSON.parse(saved);
        if (!data || typeof data !== 'object' || Array.isArray(data) || data.schemaVersion !== 1 ||
            Object.keys(data).sort().join(',') !== 'customPacks,preferences,schemaVersion' ||
            !Array.isArray(data.customPacks) || data.customPacks.length > MAX_CUSTOM_PACKS) {
          throw new ThemePackError('format');
        }
        const packs: ThemePack[] = data.customPacks.map((value: unknown) => validateThemePack(value));
        const ids = new Set(BUILTIN_THEME_PACKS.map((pack) => pack.id));
        for (const pack of packs) {
          if (ids.has(pack.id)) throw new ThemePackError('duplicate');
          ids.add(pack.id);
        }
        const candidate = validatePreferences(data.preferences);
        if (!ids.has(candidate.themeId)) throw new ThemePackError('missing');
        preferences = candidate;
        customPacks = packs;
      } else {
        const legacy = storage?.getString('theme_mode');
        if (legacy === 'grandPrix' || legacy === 'grandPrixNight') {
          preferences = Object.freeze({ ...defaults, mode: legacy === 'grandPrixNight' ? 'dark' : 'light' });
        }
      }
    } catch (error) {
      preferences = defaults;
      customPacks = [];
      recovered = true;
      if (!(error instanceof ThemePackError) && !(error instanceof SyntaxError)) persistence = 'unavailable';
    }
    this.snapshot = Object.freeze({ preferences, customPacks: Object.freeze(customPacks), persistence, recovered });
  }
  getSnapshot = (): AppearanceSnapshot => this.snapshot;
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };
  getPack(id: string): ThemePack {
    const found = [...BUILTIN_THEME_PACKS, ...this.snapshot.customPacks].find((pack) => pack.id === id);
    if (!found) throw new ThemePackError('missing');
    return found;
  }
  private commit(preferences: AppearancePreferences, customPacks: readonly ThemePack[]): void {
    const next = Object.freeze({ preferences, customPacks: Object.freeze([...customPacks]),
      persistence: this.snapshot.persistence, recovered: false });
    if (this.storage && this.snapshot.persistence === 'available') {
      try {
        this.storage.set(APPEARANCE_STORAGE_KEY, JSON.stringify({ schemaVersion: 1, preferences, customPacks }));
      } catch { throw new ThemePackError('storage'); }
    }
    this.snapshot = next;
    this.listeners.forEach((listener) => listener());
  }
  setPreferences(value: AppearancePreferences): void {
    const preferences = validatePreferences(value);
    this.getPack(preferences.themeId);
    this.commit(preferences, this.snapshot.customPacks);
  }
  installAndSelect(json: string, options: Omit<AppearancePreferences, 'themeId'>): ThemePack {
    const pack = parseThemePack(json);
    if ([...BUILTIN_THEME_PACKS, ...this.snapshot.customPacks].some((existing) => existing.id === pack.id)) {
      throw new ThemePackError('duplicate');
    }
    if (this.snapshot.customPacks.length >= MAX_CUSTOM_PACKS) throw new ThemePackError('limit');
    const preferences = validatePreferences({ ...options, themeId: pack.id });
    this.commit(preferences, [...this.snapshot.customPacks, pack]);
    return pack;
  }
  removePack(id: string): void {
    if (BUILTIN_THEME_PACKS.some((pack) => pack.id === id)) throw new ThemePackError('format');
    this.getPack(id);
    const preferences = this.snapshot.preferences.themeId === id
      ? Object.freeze({ ...this.snapshot.preferences, themeId: 'roadbook' }) : this.snapshot.preferences;
    this.commit(preferences, this.snapshot.customPacks.filter((pack) => pack.id !== id));
  }
}
