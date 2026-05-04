/**
 * Octopath Theme (Dark)
 *
 * The default dark fantasy theme — Octopath Traveler-inspired
 * warm parchment tones, deep sea blues, and gold accents.
 *
 * All color values are sourced from the auto-generated token file
 * @tokens/generated/restyle-colors (run `npm run tokens:build` to regenerate).
 */

import { colors } from '@tokens/generated/restyle-colors';
import type { AppTheme } from './unistyles';

export const octopathTheme = {
    colors: {
        primitive: colors.primitive,
        semantic: colors.semantic,
        octopath: colors.octopath,
        solar: colors.solar,
    },
} as AppTheme;
