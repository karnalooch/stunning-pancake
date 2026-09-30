/**
 * 4VELO MapLibre style authority.
 *
 * Default runtime style is a repository-owned Maputnik-editable fork of
 * OpenFreeMap Liberty. A deployment may override it with an explicitly
 * configured compliant style URL without changing application code.
 */

export const DEFAULT_RIDE_MAP_ZOOM = 15;

export const OPENFREEMAP_LIBERTY_STYLE_URL =
  'https://tiles.openfreemap.org/styles/liberty';

export const RIDE_ROUTE_COLOR = '#1F4E5F';
export const RIDE_ROUTE_CASING_COLOR = '#FBF3E2';

// eslint-disable-next-line @typescript-eslint/no-require-imports
export const MAP_STYLE_4VELO = require('../../assets/map/4velo-ride-v1.json') as object;

export function resolveRideMapStyle(): string | object {
  const configured = process.env.EXPO_PUBLIC_MAP_STYLE_URL?.trim();
  return configured || MAP_STYLE_4VELO;
}
