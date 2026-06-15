import { getAppStorage } from '../bootstrap/storage';

const IMMERSIVE_THEME_KEY = 'immersive_theme_enabled';

export function isImmersiveThemeEnabled(): boolean {
  const raw = getAppStorage().getString(IMMERSIVE_THEME_KEY);
  if (raw === undefined || raw === null) return true;
  return raw !== 'false';
}

export function setImmersiveThemeEnabled(enabled: boolean): void {
  getAppStorage().set(IMMERSIVE_THEME_KEY, enabled ? 'true' : 'false');
}
