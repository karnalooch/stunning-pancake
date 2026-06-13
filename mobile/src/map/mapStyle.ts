/**
 * MapLibre style URLs for ride navigation (ADR 014 §4).
 * Retro pixel-art bundled style JSON is planned; until then use demo tiles.
 */
export const MAP_STYLE_DEMO_URL = 'https://demotiles.maplibre.org/style.json';

/** When set, RideMapView prefers this bundled asset over demo tiles. */
export const MAP_STYLE_RETRO_BUNDLED: number | null = null;

export const DEFAULT_RIDE_MAP_ZOOM = 15;

export function resolveRideMapStyleUrl(): string {
  return MAP_STYLE_DEMO_URL;
}
