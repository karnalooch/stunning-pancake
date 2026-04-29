import { createTamagui, createFont, createTokens } from 'tamagui'
import { config } from '@tamagui/config/v3'

// HD-2D Pixel Tokens
const tokens = createTokens({
  ...config.tokens,
  color: {
    ...config.tokens.color,
    primary: '#D4A373', // Octopath Gold
    secondary: '#FF6B35', // Metal Slug Orange
    background: '#0B1D33', // Dave the Diver Deep Sea
    void: '#0B1D33',
    cyan: '#2EC4B6',
    yellow: '#FFD166',
    matrix: '#2EC4B6',
  },
  radius: {
    none: 0,
    xs: 0,
    sm: 0,
    md: 0,
    lg: 0,
    true: 0,
  }
})

const tamaguiConfig = createTamagui({
  ...config,
  tokens,
  themes: {
    ...config.themes,
    dark: {
      ...config.themes.dark,
      background: '#0B1D33',
      color: '#F4F1DE',
    }
  },
  defaultTheme: 'dark',
})

export type AppConfig = typeof tamaguiConfig

declare module 'tamagui' {
  interface TamaguiCustomConfig extends AppConfig {}
}

export default tamaguiConfig
