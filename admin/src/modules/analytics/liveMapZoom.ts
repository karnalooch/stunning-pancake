/**
 * Live Map zoom tiers — readable, performant, smooth crossfades.
 *
 * | Zoom    | Mode           | Render |
 * |---------|----------------|--------|
 * | < 7     | country        | Huby + lekkie klastry GL |
 * | 7–8.5   | region         | Huby + klastry |
 * | 8.5–9.5 | metro          | Huby zanikają, klastry |
 * | 9.5–10.5| city           | Klastry (główny widok miasta) |
 * | 10.5–11.5| district      | Ciaśniejsze klastry |
 * | 11.5–12.2| neighborhood  | Klastry + pojedyncze kropki GL |
 * | 12.2–12.8| handoff       | GL dots fade ↔ GPU symbol icons |
 * | 12.8–13.5| street-icons  | Ikony MapLibre + collision engine |
 * | 13.5–14.5| street-labels | Etykiety GPU (text-optional) |
 * | 14.5+   | detail         | Więcej etykiet dzięki collision |
 *
 * Paint crossfade bands: see LIVE_MAP_LOD (wider ranges than mode boundaries).
 */

export type LiveMapZoomMode =
    | 'country'
    | 'region'
    | 'metro'
    | 'city'
    | 'district'
    | 'neighborhood'
    | 'handoff'
    | 'street-icons'
    | 'street-labels'
    | 'detail';

export const CLUSTER_MAX_ZOOM = 14;

/**
 * Shared zoom bands for MapLibre paint crossfades — wider ranges reduce pop-in
 * when switching between city hubs, clusters, GL dots, and GPU symbol layers.
 */
export const LIVE_MAP_LOD = {
    cityHubMin: 6,
    cityHubFadeInEnd: 7.2,
    cityHubFadeOutStart: 8.6,
    cityHubFadeOutEnd: 10.8,
    clusterVisibleStart: 6.2,
    clusterPeakEnd: 11.6,
    clusterFadeOutEnd: 13.6,
    dotFadeInStart: 7,
    dotFadeInEnd: 11.2,
    dotFadeOutStart: 12.4,
    dotFadeOutEnd: 13.2,
    iconMinZoom: 11.8,
    iconMaxZoom: 13.45,
    iconFadeInStart: 11.8,
    iconFadeInEnd: 12.2,
    labelMinZoom: 13.35,
    labelFadeInStart: 13.35,
    labelFadeInEnd: 13.7,
} as const;

/** Fade 0→1 between start (inclusive) and end (exclusive) zoom. */
export function zoomFade(zoom: number, start: number, end: number): number {
    if (end <= start) return zoom >= start ? 1 : 0;
    return Math.max(0, Math.min(1, (zoom - start) / (end - start)));
}

export function resolveLiveMapZoomMode(zoom: number): LiveMapZoomMode {
    if (zoom < 7) return 'country';
    if (zoom < 8.5) return 'region';
    if (zoom < 9.5) return 'metro';
    if (zoom < 10.5) return 'city';
    if (zoom < 11.5) return 'district';
    if (zoom < 12.2) return 'neighborhood';
    if (zoom < 12.8) return 'handoff';
    if (zoom < 13.5) return 'street-icons';
    if (zoom < 14.5) return 'street-labels';
    return 'detail';
}

/** Backend payload LOD — summary = tylko city_counts, standard = bez nazw. */
export type LiveApiDetail = 'summary' | 'standard' | 'full';

export function apiDetailForZoom(zoom: number): LiveApiDetail {
    if (zoom < 7.5) return 'summary';
    if (zoom < 12) return 'standard';
    return 'full';
}

export function limitForZoom(zoom: number): number {
    if (zoom < 6) return 800;
    if (zoom < 7) return 1200;
    if (zoom < 8.5) return 2000;
    if (zoom < 10) return 2800;
    if (zoom < 11) return 4000;
    if (zoom < 12) return 5500;
    if (zoom < 13) return 7000;
    if (zoom < 14) return 9000;
    return 11000;
}

export function pollIntervalForZoom(zoom: number, lastRefreshMs: number | null): number {
    let base = 2200;
    if (zoom >= 14) base = 1100;
    else if (zoom >= 12.5) base = 1300;
    else if (zoom >= 11) base = 1600;
    else if (zoom >= 9) base = 1900;
    else if (zoom >= 7) base = 2100;
    else base = 2400;
    if (lastRefreshMs && lastRefreshMs > 900) base += 400;
    return Math.max(900, base);
}

export function clusterRadiusForZoom(zoom: number): number {
    if (zoom < 7) return 68;
    if (zoom < 8.5) return 56;
    if (zoom < 9.5) return 50;
    if (zoom < 10.5) return 46;
    if (zoom < 11.5) return 40;
    if (zoom < 12.2) return 36;
    return 32;
}

export const ZOOM_MODE_LABEL: Record<LiveMapZoomMode, string> = {
    country: 'Kraj',
    region: 'Region',
    metro: 'Aglomeracja',
    city: 'Miasto',
    district: 'Dzielnica',
    neighborhood: 'Osiedle',
    handoff: 'Zbliżenie',
    'street-icons': 'Ulice (ikony)',
    'street-labels': 'Ulice (etykiety)',
    detail: 'Detal',
};
