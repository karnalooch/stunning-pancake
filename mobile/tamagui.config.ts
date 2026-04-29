import { createTamagui, createFont, createTokens } from 'tamagui'
import { config } from '@tamagui/config/v3'

// HD-2D Pixel Font Configuration
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
  weight: {
    4: '400',
    7: '400', // Only one weight for pixel font
  },
  letterSpacing: {
    4: 0,
    7: 0,
  },
})

// HD-2D Pixel Tokens
const tokens = createTokens({
  ...config.tokens,
  color: {
    ...config.tokens.color,
    primary: '#D4A373', // Octopath Gold
    secondary: '#FF6B35', // Metal Slug Orange
    accent: '#2EC4B6', // Matrix Cyan
    background: '#0B1D33', // Dave the Diver Deep Sea
    void: '#0B1D33',
    matrix: '#2EC4B6',
    octopath: '#D4A373',
    metalSlug: '#FF6B35',
  },
  radius: {
    none: 0,
    xs: 0,
    sm: 0,
    md: 0,
    lg: 0,
    true: 0,
  },
  // Custom HD2D tokens for easy access
  hd2d: {
    borderWidth: 1,
    outlineColor: '#000000',
    pixelScale: 2,
    shadow: '4px 4px 0px rgba(0,0,0,1)',
  }
})

const tamaguiConfig = createTamagui({
  ...config,
  fonts: {
    ...config.fonts,
    heading: pixelFont,
    body: config.fonts.body, // Keep standard body font or replace if needed
    pixel: pixelFont,
  },
  tokens,
  themes: {
    ...config.themes,
    dark: {
      ...config.themes.dark,
      background: '#0B1D33', // daveDeepSea
      color: '#FFFFFF',
      primary: '#D4A373',
      secondary: '#FF6B35',
      accent: '#2EC4B6',
    },
    solar: {
      ...config.themes.light,
      background: '#FFFFFF',
      color: '#000000',
      primary: '#000000',
      secondary: '#000000',
      accent: '#000080', // Dark Navy for 16:1 contrast on White
    }
  },
  defaultTheme: 'dark',
})

export type AppConfig = typeof tamaguiConfig

declare module 'tamagui' {
  interface TamaguiCustomConfig extends AppConfig {}
}

export default tamaguiConfig
