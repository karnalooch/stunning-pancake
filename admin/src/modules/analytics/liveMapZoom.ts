/**
 * Live Map zoom — enterprise 3-tier model (see liveMapEnterprise.ts).
 *
 * Fine-grained modes below are UI labels inside meso/micro bands.
 * Paint crossfade: LIVE_MAP_LOD (handoff micro: dots ↔ icons at z≥12).
 */
import { LIVE_MAP_TIER, apiDetailForTier } from './liveMapEnterprise';

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

/**
 * Shared zoom bands for MapLibre paint crossfades — wider ranges reduce pop-in
 * when switching between city hubs, clusters, GL dots, and GPU symbol layers.
 */
export const LIVE_MAP_LOD = {
    /** City hub rings visible from country zoom (incl. z=5). */
    cityHubMin: 4.5,
    cityHubFadeInEnd: 5.8,
    /** Hold full hub opacity until just before meso handoff (z=9). */
    cityHubFadeOutStart: 8.95,
    /** Huby tylko w tierze macro (z < 9) — bez nakładania na klastry. */
    cityHubFadeOutEnd: LIVE_MAP_TIER.mesoMinZoom,
    /** Klastry od tieru meso (z ≥ 9). */
    clusterVisibleStart: LIVE_MAP_TIER.mesoMinZoom,
    clusterPeakEnd: 11.6,
    clusterFadeOutEnd: 13.6,
    /** Individual GL dots only at z≥12 (matches apiDetailForZoom `full`). */
    dotFadeInStart: 12,
    dotFadeInEnd: 12.15,
    /** Dots stay visible through micro handoff until labels take over (no dead band at z≈12.9). */
    dotFadeOutStart: 13.15,
    dotFadeOutEnd: 13.35,
    /** Minimum dot opacity while micro tier active (z ∈ [dotFadeInStart, dotFadeOutEnd]). */
    dotMicroMinOpacity: 0.55,
    iconMinZoom: 12,
    /** Same as labelMinZoom — one icon layer at a time (no 13.35–13.45 double draw). */
    iconMaxZoom: 13.35,
    iconFadeInStart: 12,
    iconFadeInEnd: 12.15,
    /** Full-strength icons from micro tier entry (backup when symbol sprites fail). */
    iconMicroMinOpacity: 0.85,
    iconMicroMinSize: 0.72,
    /** Hold icon strength until label layer takes over (no fade-to-zero dip). */
    iconFadeOutStart: 13.15,
    iconFadeOutEnd: 13.35,
    labelMinZoom: 13.35,
    labelFadeInStart: 13.35,
    labelFadeInEnd: 13.7,
    /** Matches riderIcons opacity at handoff (labels layer picks up). */
    labelIconOpacityAtHandoff: 0.85,
} as const;

/**
 * MapLibre stops clustering when zoom > clusterMaxZoom. Must match dotFadeInStart (12) so
 * unclustered GL dots are visible as soon as clustering ends (avoids empty band at z≈11.5–12).
 */
export const CLUSTER_MAX_ZOOM = LIVE_MAP_LOD.dotFadeInStart;

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

export type { LiveApiDetail } from './liveMapEnterprise';
import type { LiveApiDetail } from './liveMapEnterprise';

/** Aligns HTTP/SSE `detail` with enterprise macro / meso / micro tiers. */
export function apiDetailForZoom(zoom: number): LiveApiDetail {
    return apiDetailForTier(zoom);
}

export { LIVE_MAP_TIER, resolveLiveMapTier, TIER_MODE_LABEL } from './liveMapEnterprise';
export type { LiveMapTier } from './liveMapEnterprise';

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

export function pollIntervalForZoom(
    zoom: number,
    lastRefreshMs: number | null,
    ingestEngaged = false,
    pollMultiplier = 1,
): number {
    let base = 2200;
    if (zoom >= 14) base = 800;
    else if (zoom >= 12) base = 950;
    else if (zoom >= 11) base = 1500;
    else if (zoom >= 9) base = 1900;
    else if (zoom >= 7) base = 2100;
    else base = 2400;
    if (lastRefreshMs && lastRefreshMs > 900) base += 400;
    const mult = ingestEngaged ? Math.max(1, pollMultiplier) : 1;
    return Math.max(900, Math.round(base * mult));
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

export type ZoomStopPair = readonly [number, number];

/** Sort zoom/value pairs and build a MapLibre `interpolate` expression (ascending zoom required). */
export function zoomInterpolate(...pairs: ZoomStopPair[]): unknown[] {
    const sorted = [...pairs].sort((a, b) => a[0] - b[0]);
    const flat: number[] = [];
    for (const [z, v] of sorted) {
        flat.push(z, v);
    }
    return ['interpolate', ['linear'], ['zoom'], ...flat];
}

/** @deprecated use zoomInterpolate — alias for tests */
export function zoomStops(...pairs: ZoomStopPair[]): unknown[] {
    return zoomInterpolate(...pairs);
}

function maplibreInterp(zoom: number, stops: readonly ZoomStopPair[]): number {
    if (zoom <= stops[0][0]) return stops[0][1];
    for (let i = 1; i < stops.length; i++) {
        if (zoom <= stops[i][0]) {
            const [z0, v0] = stops[i - 1];
            const [z1, v1] = stops[i];
            return v0 + ((v1 - v0) * (zoom - z0)) / (z1 - z0);
        }
    }
    return stops[stops.length - 1][1];
}

export type LiveMapLodAuditIssue = {
    zoom: number;
    type: 'GAP' | 'DOUBLE' | 'AGGREGATE_DOUBLE' | 'ICON_OVERLAP' | 'ICON_STEP';
    detail?: Record<string, number>;
};

/** MapLibre holds the first stop below min zoom — explicit zeros avoid stray rider dots. */
export function riderUnclusteredOpacityAtZoom(zoom: number): number {
    const L = LIVE_MAP_LOD;
    return maplibreInterp(zoom, [
        [L.clusterVisibleStart - 0.5, 0],
        [L.dotFadeInStart, 0],
        [L.dotFadeInStart + 0.25, 0.35],
        [L.dotFadeInEnd, 0.82],
        [L.iconFadeInEnd, L.dotMicroMinOpacity],
        [L.dotFadeOutStart, L.dotMicroMinOpacity],
        [L.dotFadeOutEnd, 0],
    ]);
}

export function riderUnclusteredRadiusAtZoom(zoom: number): number {
    const L = LIVE_MAP_LOD;
    return maplibreInterp(zoom, [
        [L.clusterVisibleStart - 0.5, 0],
        [L.dotFadeInStart, 0],
        [L.dotFadeInStart + 0.25, 5],
        [12.2, 8],
        [L.iconFadeInEnd, 7],
        [L.dotFadeOutStart, 6],
        [L.dotFadeOutEnd, 0],
    ]);
}

/** Rider icon layer opacity (live-rider-icons), z ∈ [iconMinZoom, iconMaxZoom). */
export function riderIconOpacityAtZoom(zoom: number): number {
    const L = LIVE_MAP_LOD;
    if (zoom < L.iconMinZoom || zoom >= L.iconMaxZoom) return 0;
    return maplibreInterp(zoom, [
        [L.iconFadeInStart, L.iconMicroMinOpacity],
        [L.iconFadeInEnd, L.iconMicroMinOpacity],
        [L.iconFadeOutStart, L.iconMicroMinOpacity],
        [L.iconFadeOutEnd, L.labelIconOpacityAtHandoff],
    ]);
}

export function riderIconSizeAtZoom(zoom: number): number {
    const L = LIVE_MAP_LOD;
    if (zoom < L.iconMinZoom) return 0;
    return maplibreInterp(zoom, [
        [L.iconMinZoom, L.iconMicroMinSize],
        [13.5, 0.88],
        [15, 0.88],
    ]);
}

/** True when unclustered GL dots should be visible (z≥12 handoff band). */
export function shouldRenderIndividualRiders(zoom: number): boolean {
    return riderUnclusteredOpacityAtZoom(zoom) > 0.2 && riderUnclusteredRadiusAtZoom(zoom) > 3;
}

/** Cluster circle paint opacity (mirrors live-clusters layer). */
export function clusterLayerOpacityAtZoom(zoom: number): number {
    const L = LIVE_MAP_LOD;
    return maplibreInterp(zoom, CLUSTER_CIRCLE_OPACITY_STOPS);
}

/** Cluster count label opacity (mirrors live-cluster-count layer). */
export function clusterCountOpacityAtZoom(zoom: number): number {
    return maplibreInterp(zoom, CLUSTER_COUNT_OPACITY_STOPS);
}

/** City hub ring opacity (mirrors live-city-hub-ring layer). */
export function cityHubOpacityAtZoom(zoom: number): number {
    return maplibreInterp(zoom, CITY_HUB_RING_OPACITY_STOPS);
}

/** SSOT paint stops — must stay sorted by zoom ascending. */
export const CLUSTER_CIRCLE_OPACITY_STOPS: readonly ZoomStopPair[] = [
    [LIVE_MAP_LOD.clusterVisibleStart, 0.32],
    [10.5, 0.88],
    [LIVE_MAP_LOD.clusterPeakEnd, 0.94],
    [LIVE_MAP_LOD.clusterFadeOutEnd - 1.2, 0.62],
    [LIVE_MAP_LOD.clusterFadeOutEnd, 0],
] as const;

export const CLUSTER_COUNT_OPACITY_STOPS: readonly ZoomStopPair[] = [
    [LIVE_MAP_LOD.clusterVisibleStart, 0.4],
    [10, 0.92],
    [LIVE_MAP_LOD.clusterPeakEnd, 1],
    [LIVE_MAP_LOD.clusterFadeOutEnd - 0.8, 0.55],
    [LIVE_MAP_LOD.clusterFadeOutEnd, 0],
] as const;

export const CITY_HUB_RING_OPACITY_STOPS: readonly ZoomStopPair[] = [
    [LIVE_MAP_LOD.cityHubMin, 0.55],
    [LIVE_MAP_LOD.cityHubFadeInEnd, 0.85],
    [8, 0.95],
    [LIVE_MAP_LOD.cityHubFadeOutStart, 0.92],
    [LIVE_MAP_LOD.cityHubFadeOutEnd, 0],
] as const;

/** Label-layer icon opacity (live-rider-labels), z ≥ labelMinZoom. */
export function riderLabelIconOpacityAtZoom(zoom: number): number {
    const L = LIVE_MAP_LOD;
    if (zoom < L.labelMinZoom) return 0;
    return maplibreInterp(zoom, [
        [L.labelFadeInStart, L.labelIconOpacityAtHandoff],
        [L.labelFadeInEnd, 1],
    ]);
}

/** Combined rider visibility (dots, icons, or labels) — mirrors auditLiveMapLodCrossfade riderVis. */
export function riderLayerVisibilityAtZoom(zoom: number): number {
    const dotOp = riderUnclusteredOpacityAtZoom(zoom);
    const dotR = riderUnclusteredRadiusAtZoom(zoom);
    const dotVis = dotOp > 0.2 && dotR > 3 ? dotOp : 0;
    return Math.max(dotVis, riderIconOpacityAtZoom(zoom), riderLabelIconOpacityAtZoom(zoom));
}

/**
 * True when riders should be visible on canvas — clusters (meso) or dots/icons/labels (micro).
 */
export function ridersVisibleAtZoom(zoom: number): boolean {
    if (zoom < LIVE_MAP_TIER.mesoMinZoom) {
        return false;
    }
    if (zoom <= CLUSTER_MAX_ZOOM) {
        return clusterLayerOpacityAtZoom(zoom) > 0.2;
    }
    return riderLayerVisibilityAtZoom(zoom) > 0.25;
}

/** Numeric crossfade audit (mirrors paint stops in liveMapLayers.ts). */
export function auditLiveMapLodCrossfade(zMin = 5, zMax = 16, step = 0.1): LiveMapLodAuditIssue[] {
    const L = LIVE_MAP_LOD;
    const issues: LiveMapLodAuditIssue[] = [];
    for (let z = zMin; z <= zMax + 1e-6; z = Math.round((z + step) * 10) / 10) {
        const hubOp = cityHubOpacityAtZoom(z);
        const clOp = clusterLayerOpacityAtZoom(z);
        const dotOp = riderUnclusteredOpacityAtZoom(z);
        const dotR = riderUnclusteredRadiusAtZoom(z);
        const iconLayer = z >= L.iconMinZoom && z < L.iconMaxZoom;
        const iconOp = riderIconOpacityAtZoom(z);
        const labelLayer = z >= L.labelMinZoom;
        const labelIconOp = riderLabelIconOpacityAtZoom(z);
        const dotVisible = dotOp > 0.2 && dotR > 3;
        const riderVis = riderLayerVisibilityAtZoom(z);
        if (riderVis < 0.25 && clOp < 0.2 && hubOp < 0.2) {
            issues.push({ zoom: z, type: 'GAP' });
        }
        const inHandoff = z >= L.iconFadeInStart && z < L.labelMinZoom;
        if (dotVisible && iconOp > 0.5 && !inHandoff) {
            issues.push({ zoom: z, type: 'DOUBLE', detail: { dotOp, iconOp } });
        }
        if (z < L.dotFadeInStart && dotVisible && (hubOp > 0.25 || clOp > 0.25)) {
            issues.push({ zoom: z, type: 'AGGREGATE_DOUBLE', detail: { dotOp, hubOp, clOp } });
        }
        if (iconOp > 0.35 && labelIconOp > 0.35 && iconLayer && labelLayer) {
            issues.push({ zoom: z, type: 'ICON_OVERLAP', detail: { iconOp, labelIconOp } });
        }
        if (labelLayer && iconLayer && Math.abs(iconOp - labelIconOp) > 0.4) {
            issues.push({ zoom: z, type: 'ICON_STEP', detail: { iconOp, labelIconOp } });
        }
    }
    return issues;
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
