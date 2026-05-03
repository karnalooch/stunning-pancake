import { createTheme, defaultVariantColorsResolver, VariantColorsResolver } from '@mantine/core';

const variantColorResolver: VariantColorsResolver = (input) => {
  const defaultResolved = defaultVariantColorsResolver(input);
  return defaultResolved;
};

export const theme = createTheme({
  primaryColor: 'blue',
  primaryShade: 6,
  fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif',
  fontFamilyMonospace: 'JetBrains Mono, Fira Code, monospace',
  headings: {
    fontFamily: 'Inter, sans-serif',
    fontWeight: '600',
    sizes: {
      h1: { fontSize: '28px', lineHeight: '1.3' },
      h2: { fontSize: '22px', lineHeight: '1.35' },
      h3: { fontSize: '18px', lineHeight: '1.4' },
    },
  },
  defaultRadius: 'md',
  components: {
    Card: {
      defaultProps: { radius: 'md', padding: 'lg' },
    },
    Button: {
      defaultProps: { radius: 'md' },
      styles: { root: { fontWeight: 600 } },
    },
    Badge: {
      defaultProps: { radius: 'sm' },
    },
    Table: {
      defaultProps: { verticalSpacing: 'xs', highlightOnHover: true },
    },
    Modal: {
      defaultProps: { radius: 'lg', overlayProps: { blur: 4 } },
    },
  },
  other: { surfaceColor: '#F8FAFC' },
});
