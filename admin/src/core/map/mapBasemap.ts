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

/**
 * Glyphs CDN with full Noto Sans coverage (incl. emoji Unicode blocks).
 * OpenFreeMap's bundled fonts omit ranges like 128512–128767 → noisy 404s in console.
 */
export const MAP_GLYPHS_URL = 'https://fonts.openmaptiles.org/{fontstack}/{range}.pbf';

/**
 * Font stacks used by OpenFreeMap positron/dark and live-map label layers.
 * Positron style uses Noto Sans only — Open Sans stacks 404 on any CDN.
 */
export const MAP_TEXT_FONT_BOLD = ['Noto Sans Bold'] as const;
export const MAP_TEXT_FONT_REGULAR = ['Noto Sans Regular'] as const;
export const MAP_TEXT_FONT_ITALIC = ['Noto Sans Italic'] as const;

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

/** Override order: `VITE_MAP_GLYPHS_URL` → {@link MAP_GLYPHS_URL}. */
export function resolveMapGlyphsUrl(): string {
    return envTrim('VITE_MAP_GLYPHS_URL') ?? MAP_GLYPHS_URL;
}

type MapStyleGlyphs = { glyphs?: string };

/** MapLibre `transformStyle` hook — keeps tiles/sprites, swaps glyphs to {@link resolveMapGlyphsUrl}. */
export function transformMapGlyphsStyle(
    _previous: MapStyleGlyphs,
    next: MapStyleGlyphs,
): MapStyleGlyphs {
    return {
        ...next,
        glyphs: resolveMapGlyphsUrl(),
    };
}

type MapImageFallbackHost = {
    hasImage: (id: string) => boolean;
    addImage: (
        id: string,
        image: ImageData,
        options?: { pixelRatio?: number },
    ) => void;
    on: (event: 'styleimagemissing', handler: (e: { id: string }) => void) => void;
};

function placeholderImageData(fill: string, size = 16): ImageData {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('canvas 2d unavailable');
    if (fill === 'circle') {
        ctx.beginPath();
        ctx.arc(size / 2, size / 2, size / 2 - 2, 0, Math.PI * 2);
        ctx.fillStyle = '#64748b';
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.stroke();
    } else {
        ctx.fillStyle = fill;
        ctx.fillRect(0, 0, size, size);
    }
    return ctx.getImageData(0, 0, size, size);
}

/**
 * OpenFreeMap styles reference sprite icons (e.g. circle-11, wood-pattern) that may be
 * missing from the public CDN. Provide lightweight placeholders so the console stays clean.
 */
export function attachBasemapImageFallback(map: MapImageFallbackHost): void {
    map.on('styleimagemissing', (e) => {
        if (map.hasImage(e.id)) return;
        const id = e.id;
        let data: ImageData;
        if (id.startsWith('circle-')) {
            data = placeholderImageData('circle');
        } else if (id.includes('pattern') || id === 'wood-pattern') {
            data = placeholderImageData('#d4c4a8');
        } else {
            data = placeholderImageData('rgba(0,0,0,0)', 1);
        }
        map.addImage(id, data, { pixelRatio: 1 });
    });
}
