import type { TextStyle } from 'react-native';
import { FONTS } from './fonts';

export type ProductTypographyRole =
  | 'body'
  | 'bodyMedium'
  | 'title'
  | 'displayEditorial'
  | 'metric'
  | 'metricLabel';

export const PRODUCT_TYPOGRAPHY: Record<ProductTypographyRole, TextStyle> = {
  body: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '400',
  },
  bodyMedium: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '600',
  },
  title: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '700',
  },
  displayEditorial: {
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '700',
  },
  metric: {
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  metricLabel: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
};

export const BRAND_TYPOGRAPHY = {
  displayPixel: {
    fontFamily: FONTS.display,
  } satisfies TextStyle,
  badgePixel: {
    fontFamily: FONTS.display,
    fontSize: 10,
    lineHeight: 14,
  } satisfies TextStyle,
} as const;
