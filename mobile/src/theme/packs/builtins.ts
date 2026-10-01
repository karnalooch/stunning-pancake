import { validateThemePack, type ThemePack } from './themePack';

export const roadbook = validateThemePack({
  schemaVersion: 1, id: 'roadbook', name: 'Roadbook',
  light: {
    canvas: '#F7F7F2', surface: '#FFFFFF', raised: '#EFF1F4', text: '#171C20', muted: '#505963',
    action: '#2457D6', actionPressed: '#163B9B', onAction: '#FFFFFF', border: '#77808B',
    success: '#17613B', warning: '#855300', error: '#B42318', onError: '#FFFFFF',
  },
  dark: {
    canvas: '#0D1218', surface: '#151D27', raised: '#202B38', text: '#F5F7FA', muted: '#B5C0CE',
    action: '#8BB5FF', actionPressed: '#B9D2FF', onAction: '#101923', border: '#8796A8',
    success: '#81D9A2', warning: '#F3CC79', error: '#FFB4AB', onError: '#35100B',
  },
});
export const forest = validateThemePack({
  schemaVersion: 1, id: 'forest', name: 'Forest',
  light: { ...roadbook.light, canvas: '#F4F7F2', raised: '#EAF0E8',
    action: '#116544', actionPressed: '#084C32' },
  dark: { ...roadbook.dark, canvas: '#0E1511', surface: '#151F19', raised: '#202D24',
    action: '#8DDDB0', actionPressed: '#B6ECCB' },
});
export const BUILTIN_THEME_PACKS: readonly ThemePack[] = Object.freeze([roadbook, forest]);
