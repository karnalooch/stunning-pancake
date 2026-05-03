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

// ─── Color Palette: Octopath Traveler (primary) × Metal Slug (HUD) ─
// Octopath: warm gold, parchment brown, soft forest green, sepia bronze — fantasy RPG warmth
// Metal Slug: pixel black outlines, chunky UI, industrial contrast
const hd2dColors = {
  // Octopath Traveler — core palette
  parchment: '#2D2418',      // Dark warm brown (background)
  deepBrown: '#1A1410',      // Deeper shadow brown
  panel: '#3D3020',          // Surface brown (cards, panels)
  goldAmber: '#D4A373',      // Octopath gold (primary accent)
  goldLight: '#EDD9B0',      // Bright gold (highlight)
  forestGreen: '#7BA05B',    // Soft forest green (success, growth)
  deepShadow: '#2D3A54',     // Night sky blue (contrast accent)
  cream: '#F5E6CC',          // Warm parchment cream (text on dark)
  sepia: '#8B7355',          // Bronze/sepia (secondary)
  woodBorder: '#5C4020',     // Dark wood (outline/border)
  // Metal Slug — HUD / industrial accents
  pixelBlack: '#000000',     // Pure black outlines
  industrial: '#4A4A4A',     // Metal Slug grey
  // Solar Mode
  solarCream: '#FFF8E7',     // Parchment white (solar bg)
  solarBrown: '#2D2418',     // Dark brown (solar text)
  // Semantic
  warning: '#E8A840',        // Amber warning
  error: '#CC4444',          // Soft red error
  silver: '#A0A0A0',         // Silver podium
};

// ─── Tokens ────────────────────────────────────────────────────
const tokens = createTokens({
  ...config.tokens,
  color: {
    ...config.tokens.color,
    primary: hd2dColors.goldAmber,
    secondary: hd2dColors.sepia,
    accent: hd2dColors.forestGreen,
    background: hd2dColors.parchment,
    backgroundStrong: hd2dColors.deepBrown,
    color: hd2dColors.cream,
    error: hd2dColors.error,
    warning: hd2dColors.warning,
    success: hd2dColors.forestGreen,
    gold: hd2dColors.goldAmber,
    amber: hd2dColors.goldLight,
    sepia: hd2dColors.sepia,
    forest: hd2dColors.forestGreen,
    silver: hd2dColors.silver,
    // Semantic aliases
    parchment: hd2dColors.parchment,
    deepBrown: hd2dColors.deepBrown,
    panel: hd2dColors.panel,
    cream: hd2dColors.cream,
    pixelBlack: hd2dColors.pixelBlack,
    solarCream: hd2dColors.solarCream,
    solarBrown: hd2dColors.solarBrown,
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
    // Octopath — warm fantasy parchment (default dark theme)
    octopath: {
      ...config.themes.dark,
      background: hd2dColors.parchment,
      backgroundStrong: hd2dColors.deepBrown,
      color: hd2dColors.cream,
      primary: hd2dColors.goldAmber,
      secondary: hd2dColors.sepia,
      accent: hd2dColors.forestGreen,
      error: hd2dColors.error,
      warning: hd2dColors.warning,
      success: hd2dColors.forestGreen,
      gold: hd2dColors.goldAmber,
      amber: hd2dColors.goldLight,
      sepia: hd2dColors.sepia,
      forest: hd2dColors.forestGreen,
      silver: hd2dColors.silver,
      panel: hd2dColors.panel,
      cream: hd2dColors.cream,
      parchment: hd2dColors.parchment,
      outlineColor: hd2dColors.woodBorder,
    },
    // Solar — high-noon parchment (12:1 contrast outdoor mode)
    solar: {
      ...config.themes.light,
      background: hd2dColors.solarCream,
      backgroundStrong: '#FFF0D4',
      color: hd2dColors.solarBrown,
      primary: '#6B4226',
      secondary: '#4A3520',
      accent: '#3D6B2E',
      error: '#AA0000',
      warning: '#8B6914',
      success: '#2E6B1E',
      gold: '#8B6914',
      amber: '#B8860B',
      sepia: '#6B4226',
      forest: '#3D6B2E',
      silver: '#666666',
      panel: '#F5E6CC',
      cream: hd2dColors.solarBrown,
      parchment: hd2dColors.solarCream,
      outlineColor: hd2dColors.pixelBlack,
    },
  },
  defaultTheme: 'octopath',
});

export type AppConfig = typeof tamaguiConfig;

declare module 'tamagui' {
  interface TamaguiCustomConfig extends AppConfig {}
}

export default tamaguiConfig;
