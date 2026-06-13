/**
 * MapLibre style for ride navigation (ADR 014 §4).
 */

export const MAP_STYLE_DEMO_URL = 'https://demotiles.maplibre.org/style.json';

export const DEFAULT_RIDE_MAP_ZOOM = 15;

/** Bundled retro style object for MapLibre `mapStyle` prop. */
// eslint-disable-next-line @typescript-eslint/no-require-imports
export const MAP_STYLE_RETRO = require('../../assets/map/retro-ride-style.json') as object;

export function resolveRideMapStyle(useRetro: boolean): string | object {
  if (useRetro) {
    return MAP_STYLE_RETRO;
  }
  return MAP_STYLE_DEMO_URL;
}
