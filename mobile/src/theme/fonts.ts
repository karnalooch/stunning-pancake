/**
 * Font family tokens — single place to swap the display face.
 *
 * The vision mocks use a chunky pixel display face for chrome titles. We ship
 * Press Start 2P today; to adopt a heavier face (e.g. Silkscreen / Pixelify
 * Sans) install the font, load it in App.tsx `useFonts`, then change ONLY
 * `display` here — every header/button picks it up.
 */
export const FONTS = {
  /** Chrome titles, labels, buttons. */
  display: 'PressStart2P',
  /** Numeric/metric readouts (HUD, stats). */
  mono: 'VT323',
} as const;
