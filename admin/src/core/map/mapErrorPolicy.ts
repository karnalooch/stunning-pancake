/**
 * MapLibre fires `error` for non-fatal tile/glyph/sprite failures.
 * Live Map should only surface CDN/style errors that block the basemap.
 */

export type MapLibreErrorLike = {
    error?: {
        message?: string;
        status?: number;
        url?: string;
    };
};

export type MapErrorSeverity = 'fatal' | 'ignorable';

const IGNORABLE_PATTERNS = [
    /glyph/i,
    /sprite/i,
    /fonts?\//i,
    /source layer/i,
    /could not load image/i,
    /missing image/i,
    /failed to load tile/i,
    /\.pbf/i,
    /\/data\/v\d+\//i,
];

function errorMessage(e: MapLibreErrorLike): string {
    return e.error?.message ?? '';
}

function errorUrl(e: MapLibreErrorLike): string {
    return e.error?.url ?? '';
}

function errorStatus(e: MapLibreErrorLike): number | undefined {
    const s = e.error?.status;
    return typeof s === 'number' && Number.isFinite(s) ? s : undefined;
}

/** Style JSON fetch failure — not individual tiles/fonts on the same CDN. */
function targetsBasemapStyle(e: MapLibreErrorLike, styleUrl: string): boolean {
    const url = errorUrl(e);
    if (!url) return false;
    const normalized = styleUrl.replace(/\/$/, '');
    if (url === normalized || url === `${normalized}/style.json`) return true;
    if (url.includes('/styles/') && !/\.(pbf|png|webp|jpg)/i.test(url) && !url.includes('/data/')) {
        return true;
    }
    return false;
}

export function classifyMapLibreError(
    e: MapLibreErrorLike,
    styleUrl: string,
    mapHasLoaded: boolean,
): MapErrorSeverity {
    const msg = errorMessage(e);
    const status = errorStatus(e);
    const url = errorUrl(e);

    if (IGNORABLE_PATTERNS.some((re) => re.test(msg) || re.test(url))) {
        return 'ignorable';
    }

    if (mapHasLoaded) {
        return 'ignorable';
    }

    if (targetsBasemapStyle(e, styleUrl)) {
        if (status == null || status === 0 || status >= 400) return 'fatal';
    }

    if (/failed to fetch/i.test(msg) && !url) {
        return 'fatal';
    }

    if (status != null && status >= 500 && !url) {
        return 'fatal';
    }

    return 'ignorable';
}
