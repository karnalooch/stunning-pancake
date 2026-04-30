import { observable } from '@legendapp/state';
import { MMKV } from 'react-native-mmkv';

const THEME_STORAGE_KEY = 'theme_mode';

// Lazy MMKV initialization to prevent JSI "Runtime not ready" crash
let _storage: MMKV | null = null;
function getStorage(): MMKV | null {
  if (_storage) return _storage;
  try {
    _storage = new MMKV();
    return _storage;
  } catch (e) {
    console.error('[ThemeService] MMKV init failed, falling back to defaults.', e);
    return null;
  }
}

export type ThemeMode = 'dark' | 'solar';

// Initialize with stored value or default to 'dark'
function getInitialTheme(): ThemeMode {
  const storage = getStorage();
  if (!storage) return 'dark';
  return (storage.getString(THEME_STORAGE_KEY) as ThemeMode) || 'dark';
}

export const ThemeService = {
  themeMode: observable<ThemeMode>(getInitialTheme()),
  
  toggleTheme: () => {
    const current = ThemeService.themeMode.get();
    const next = current === 'dark' ? 'solar' : 'dark';
    ThemeService.themeMode.set(next);
    const storage = getStorage();
    if (storage) storage.set(THEME_STORAGE_KEY, next);
  },
  
  setTheme: (theme: ThemeMode) => {
    ThemeService.themeMode.set(theme);
    const storage = getStorage();
    if (storage) storage.set(THEME_STORAGE_KEY, theme);
  }
};
