import { observable } from '@legendapp/state';
import { MMKV } from 'react-native-mmkv';

const storage = new MMKV();
const THEME_STORAGE_KEY = 'theme_mode';

export type ThemeMode = 'dark' | 'solar';

// Initialize with stored value or default to 'dark'
const initialTheme = (storage.getString(THEME_STORAGE_KEY) as ThemeMode) || 'dark';

export const ThemeService = {
  themeMode: observable<ThemeMode>(initialTheme),
  
  toggleTheme: () => {
    const current = ThemeService.themeMode.get();
    const next = current === 'dark' ? 'solar' : 'dark';
    ThemeService.themeMode.set(next);
    storage.set(THEME_STORAGE_KEY, next);
  },
  
  setTheme: (theme: ThemeMode) => {
    ThemeService.themeMode.set(theme);
    storage.set(THEME_STORAGE_KEY, theme);
  }
};
