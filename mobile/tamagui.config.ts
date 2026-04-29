import { createTamagui, createFont, createTokens } from 'tamagui'
import { config } from '@tamagui/config/v3'

// HD-2D Pixel Tokens
const tokens = createTokens({
  ...config.tokens,
  color: {
    ...config.tokens.color,
    primary: '#00F0FF',
    secondary: '#FFF200',
    background: '#050505',
    void: '#050505',
    cyan: '#00F0FF',
    yellow: '#FFF200',
    matrix: '#00FF41',
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
      background: '#050505',
      color: '#FFFFFF',
    }
  },
  defaultTheme: 'dark',
})

export type AppConfig = typeof tamaguiConfig

declare module 'tamagui' {
  interface TamaguiCustomConfig extends AppConfig {}
}

export default tamaguiConfig
