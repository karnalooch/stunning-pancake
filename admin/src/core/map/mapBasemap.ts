/**
 * Admin MapLibre basemap configuration.
 *
 * Default provider: OpenFreeMap (https://openfreemap.org/) — free public instance,
 * commercial use allowed (MIT + OSM ODbL attribution). See docs/compliance/MAP_BASEMAP_LICENSING.md.
 */

export const OPENFREEMAP_POSITRON = 'https://tiles.openfreemap.org/styles/positron';
export const OPENFREEMAP_DARK = 'https://tiles.openfreemap.org/styles/dark';

export type MapBasemapVariant = 'light' | 'dark';

const DEFAULT_BY_VARIANT: Record<MapBasemapVariant, string> = {
    light: OPENFREEMAP_POSITRON,
    dark: OPENFREEMAP_DARK,
};

/** Shown via MapLibre AttributionControl (style JSON also carries OSM credits). */
export const MAP_ATTRIBUTION_CUSTOM: string[] = [
    '<a href="https://openfreemap.org" target="_blank" rel="noopener noreferrer">OpenFreeMap</a>',
    '<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">© OpenStreetMap</a>',
];

export const MAP_ATTRIBUTION_CONTROL_OPTIONS = {
    compact: true,
    customAttribution: MAP_ATTRIBUTION_CUSTOM,
} as const;

function envTrim(key: string): string | undefined {
    const v = import.meta.env[key];
    if (typeof v !== 'string') return undefined;
    const t = v.trim();
    return t.length > 0 ? t : undefined;
}

/**
 * Resolve basemap style URL for MapLibre `style` option.
 *
 * Override order: variant-specific env → `VITE_MAP_STYLE_URL` → OpenFreeMap default.
 */
export function resolveMapStyleUrl(variant: MapBasemapVariant): string {
    const global = envTrim('VITE_MAP_STYLE_URL');
    const specific =
        variant === 'light'
            ? envTrim('VITE_MAP_STYLE_URL_LIGHT')
            : envTrim('VITE_MAP_STYLE_URL_DARK');
    return specific ?? global ?? DEFAULT_BY_VARIANT[variant];
}
