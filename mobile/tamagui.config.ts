import { createTamagui, createFont, createTokens } from 'tamagui';
import { config } from '@tamagui/config/v3';

// ─── HD-2D Pixel Font: Press Start 2P ─────────────────────────
const pixelFont = createFont({
  family: 'Press Start 2P',
  size: {
    1: 10,
    2: 12,
    3: 14,
    4: 16,
    5: 18,
    6: 20,
    7: 24,
    8: 32,
    true: 16,
  },
  lineHeight: {
    1: 12,
    2: 14,
    3: 16,
    4: 18,
    5: 20,
    6: 22,
    7: 26,
    8: 34,
    true: 18,
  },
  weight: { 4: '400', 7: '400' },
  letterSpacing: { 4: 0, 7: 0 },
});

// ─── Color Palette: Dave the Diver × Metal Slug × Octopath ─────
// Deep Sea (tła) / Ocean Teal (akcenty) / Coral (CTA)
// Gold (podium) / Warning Red / Pixel Black (obrysy)
const hd2dColors = {
  deepBlue: '#0A1628',
  oceanTeal: '#00D4AA',
  coral: '#FF6B35',
  warmGold: '#D4A373',
  pixelBlack: '#000000',
  solarWhite: '#FFF8E7',
  solarBlack: '#111111',
  warning: '#EF4444',
  success: '#10B981',
  silver: '#A0A0A0',
  void: '#060E1A',
};

// ─── Tokens ────────────────────────────────────────────────────
const tokens = createTokens({
  ...config.tokens,
  color: {
    ...config.tokens.color,
    primary: hd2dColors.warmGold,
    secondary: hd2dColors.coral,
    accent: hd2dColors.oceanTeal,
    background: hd2dColors.deepBlue,
    backgroundStrong: hd2dColors.void,
    color: '#FFFFFF',
    error: hd2dColors.warning,
    success: hd2dColors.success,
    gold: hd2dColors.warmGold,
    coral: hd2dColors.coral,
    teal: hd2dColors.oceanTeal,
    silver: hd2dColors.silver,
    // Semantic aliases
    deepBlue: hd2dColors.deepBlue,
    oceanTeal: hd2dColors.oceanTeal,
    pixelBlack: hd2dColors.pixelBlack,
    solarWhite: hd2dColors.solarWhite,
    solarBlack: hd2dColors.solarBlack,
  },
  radius: {
    none: 0,
    xs: 0,
    sm: 0,
    md: 0,
    lg: 0,
    true: 0,
  },
  hd2d: {
    borderWidth: 1,
    outlineColor: hd2dColors.pixelBlack,
    pixelScale: 2,
    shadow: '4px 4px 0px rgba(0,0,0,1)',
  },
});

// ─── Themes ────────────────────────────────────────────────────
const tamaguiConfig = createTamagui({
  ...config,
  fonts: {
    ...config.fonts,
    heading: pixelFont,
    body: config.fonts.body,
    pixel: pixelFont,
  },
  tokens,
  themes: {
    ...config.themes,
    // Deep Sea — default dark theme (Dave the Diver)
    deep: {
      ...config.themes.dark,
      background: hd2dColors.deepBlue,
      backgroundStrong: hd2dColors.void,
      color: '#FFFFFF',
      primary: hd2dColors.warmGold,
      secondary: hd2dColors.coral,
      accent: hd2dColors.oceanTeal,
      error: hd2dColors.warning,
      success: hd2dColors.success,
      gold: hd2dColors.warmGold,
      coral: hd2dColors.coral,
      teal: hd2dColors.oceanTeal,
      silver: hd2dColors.silver,
      outlineColor: hd2dColors.pixelBlack,
    },
    // Solar — high-noon outdoor mode (12:1 contrast)
    solar: {
      ...config.themes.light,
      background: hd2dColors.solarWhite,
      backgroundStrong: '#FFFFFF',
      color: hd2dColors.solarBlack,
      primary: hd2dColors.solarBlack,
      secondary: hd2dColors.solarBlack,
      accent: '#000080',
      error: '#CC0000',
      success: '#006600',
      gold: '#B8860B',
      coral: '#CC3300',
      teal: '#006666',
      silver: '#666666',
      outlineColor: hd2dColors.pixelBlack,
    },
  },
  defaultTheme: 'deep',
});

export type AppConfig = typeof tamaguiConfig;

declare module 'tamagui' {
  interface TamaguiCustomConfig extends AppConfig {}
}

export default tamaguiConfig;
