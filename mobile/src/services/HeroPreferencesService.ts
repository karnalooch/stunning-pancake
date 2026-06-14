import { MMKV } from 'react-native-mmkv';

const HELMET_KEY = 'hero_helmet_color';
const CITY_KEY = 'hero_city_text';

export const DEFAULT_HELMET_COLOR = '#CC4444';
export const DEFAULT_CITY_TEXT = 'SIEDLCE';

let storage: MMKV | null = null;
try {
  storage = new MMKV();
} catch {
  storage = null;
}

/** MMKV-backed hero theming (helmet palette-swap + jersey city decal). */
export const HeroPreferencesService = {
  getHelmetColor(): string {
    return storage?.getString(HELMET_KEY) ?? DEFAULT_HELMET_COLOR;
  },
  setHelmetColor(color: string): void {
    storage?.set(HELMET_KEY, color);
  },
  getCityText(): string {
    return storage?.getString(CITY_KEY) ?? DEFAULT_CITY_TEXT;
  },
  setCityText(text: string): void {
    storage?.set(CITY_KEY, text.toUpperCase().slice(0, 12));
  },
};
