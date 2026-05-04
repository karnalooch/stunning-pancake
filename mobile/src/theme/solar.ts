/**
 * Solar Theme (Light)
 *
 * High-noon parchment outdoor mode — ~12:1 contrast ratio
 * for maximum legibility in bright sunlight.
 *
 * All color values are sourced from the auto-generated token file
 * @tokens/generated/restyle-colors (run `npm run tokens:build` to regenerate).
 */

import { colors } from '@tokens/generated/restyle-colors';
import type { AppTheme } from './unistyles';

export const solarTheme = {
    colors: {
        primitive: colors.primitive,
        semantic: colors.semantic,
        octopath: colors.octopath,
        solar: colors.solar,
    },
} as AppTheme;
