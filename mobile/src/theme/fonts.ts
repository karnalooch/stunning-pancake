/**
 * Legacy/specialist pixel font tokens.
 *
 * Frozen UI v1.2 forbids pixel fonts in routine product UI. Existing legacy
 * components may keep these tokens during migration; new routine UI must use
 * semantic product typography from `theme/typography.ts`.
 */
export const FONTS = {
  /** Decorative brand/event/achievement treatment only. */
  display: 'Silkscreen',
  /** Legacy pixel numeric treatment; not for new product metrics. */
  mono: 'VT323',
} as const;
