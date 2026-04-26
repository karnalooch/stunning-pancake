import { createTheme, type MantineColorsTuple } from '@mantine/core';


// Based on assets/branding/design_tokens.json
const primaryCyan: MantineColorsTuple = [
  '#e0fbff',
  '#b3f4ff',
  '#66e3ff',
  '#00d1ff', // Main
  '#00a3c7', // Dark
  '#007a94',
  '#005161',
  '#00282e',
  '#001417',
  '#000000',
];

const secondaryPurple: MantineColorsTuple = [
  '#f3ebff',
  '#e2d1ff',
  '#d199ff',
  '#b066ff', // Main
  '#8a3bff', // Dark
  '#6b1aff',
  '#5100e6',
  '#3600b3',
  '#1b0080',
  '#00004d',
];

export const theme = createTheme({
  primaryColor: 'cyan',
  colors: {
    cyan: primaryCyan,
    purple: secondaryPurple,
  },
  fontFamily: 'Inter, sans-serif',
  headings: {
    fontFamily: 'Inter, sans-serif',
    fontWeight: '700',
  },
  components: {
    Card: {
      defaultProps: {
        radius: 'xl',
      },
    },
    Button: {
      defaultProps: {
        radius: 'md',
      },
    },
  },
});
