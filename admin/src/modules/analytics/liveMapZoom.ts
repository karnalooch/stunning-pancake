/**
 * Live Map zoom tiers — readable, performant, smooth crossfades.
 *
 * | Zoom    | Mode           | Render |
 * |---------|----------------|--------|
 * | 5–7     | country        | Huby miast + klastry (standard API) |
 * | < 5     | overview       | Huby z meta (summary, bez punktów) |
 * | 7–8.5   | region         | Huby + klastry |
 * | 8.5–9.5 | metro          | Huby zanikają, klastry |
 * | 9.5–10.5| city           | Klastry (huby znikają ≤9.5) |
 * | 10.5–11.5| district      | Ciaśniejsze klastry |
 * | 11.5–12.2| neighborhood  | Klastry (bez pojedynczych kropek — te od z≥12) |
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

/**
 * Shared zoom bands for MapLibre paint crossfades — wider ranges reduce pop-in
 * when switching between city hubs, clusters, GL dots, and GPU symbol layers.
 */
export const LIVE_MAP_LOD = {
    /** City hub rings visible from country zoom (incl. z=5). */
    cityHubMin: 4.5,
    cityHubFadeInEnd: 5.8,
    cityHubFadeOutStart: 8.2,
    /** Gone by z≈9.5 (city tier) so rider clusters are not covered at z=10. */
    cityHubFadeOutEnd: 9.5,
    clusterVisibleStart: 5,
    clusterPeakEnd: 11.6,
    clusterFadeOutEnd: 13.6,
    /** Individual GL dots only at z≥12 (matches apiDetailForZoom `full`). */
    dotFadeInStart: 12,
    dotFadeInEnd: 12.15,
    /** Align with icon fade-in — avoids double GL dots + GPU icons in handoff. */
    dotFadeOutStart: 12.2,
    dotFadeOutEnd: 13.2,
    iconMinZoom: 12,
    /** Same as labelMinZoom — one icon layer at a time (no 13.35–13.45 double draw). */
    iconMaxZoom: 13.35,
    iconFadeInStart: 12.2,
    iconFadeInEnd: 12.2,
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

/** Backend payload LOD — summary = tylko city_counts, standard = bez nazw. */
export type LiveApiDetail = 'summary' | 'standard' | 'full';

export function apiDetailForZoom(zoom: number): LiveApiDetail {
    if (zoom < 5) return 'summary';
    if (zoom < CLUSTER_MAX_ZOOM) return 'standard';
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

function maplibreInterp(zoom: number, stops: readonly (readonly [number, number])[]): number {
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
        [L.dotFadeOutStart, 0.45],
        [12.4, 0.32],
        [12.6, 0.1],
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
        [L.dotFadeOutStart, 5.5],
        [12.4, 3],
        [12.6, 1],
        [L.dotFadeOutEnd, 0],
    ]);
}

/** True when unclustered GL dots should be visible (z≥12 handoff band). */
export function shouldRenderIndividualRiders(zoom: number): boolean {
    return riderUnclusteredOpacityAtZoom(zoom) > 0.2 && riderUnclusteredRadiusAtZoom(zoom) > 3;
}

/** Cluster circle paint opacity (mirrors live-clusters layer). */
export function clusterLayerOpacityAtZoom(zoom: number): number {
    const L = LIVE_MAP_LOD;
    return maplibreInterp(zoom, [
        [L.clusterVisibleStart, 0.32],
        [8, 0.72],
        [10.5, 0.88],
        [L.clusterPeakEnd, 0.94],
        [L.clusterFadeOutEnd - 1.2, 0.62],
        [L.clusterFadeOutEnd, 0],
    ]);
}

/**
 * True when riders should be visible on canvas — accounts for MapLibre unclustering above clusterMaxZoom.
 */
export function ridersVisibleAtZoom(zoom: number): boolean {
    if (zoom <= CLUSTER_MAX_ZOOM) {
        return clusterLayerOpacityAtZoom(zoom) > 0.2;
    }
    return shouldRenderIndividualRiders(zoom);
}

/** Numeric crossfade audit (mirrors paint stops in liveMapLayers.ts). */
export function auditLiveMapLodCrossfade(zMin = 5, zMax = 16, step = 0.1): LiveMapLodAuditIssue[] {
    const L = LIVE_MAP_LOD;
    const issues: LiveMapLodAuditIssue[] = [];
    for (let z = zMin; z <= zMax + 1e-6; z = Math.round((z + step) * 10) / 10) {
        const hubOp = maplibreInterp(z, [
            [L.cityHubMin, 0.55],
            [L.cityHubFadeInEnd, 0.85],
            [8.2, 0.95],
            [L.cityHubFadeOutStart, 0.88],
            [L.cityHubFadeOutEnd, 0],
        ]);
        const clOp = maplibreInterp(z, [
            [L.clusterVisibleStart, 0.32],
            [8, 0.72],
            [10.5, 0.88],
            [L.clusterPeakEnd, 0.94],
            [L.clusterFadeOutEnd - 1.2, 0.62],
            [L.clusterFadeOutEnd, 0],
        ]);
        const dotOp = riderUnclusteredOpacityAtZoom(z);
        const dotR = riderUnclusteredRadiusAtZoom(z);
        const iconLayer = z >= L.iconMinZoom && z < L.iconMaxZoom;
        const iconOp = iconLayer
            ? maplibreInterp(z, [
                  [L.iconFadeInStart, 0.15],
                  [L.iconFadeInEnd, 0.75],
                  [12.6, 0.95],
                  [L.iconFadeOutStart, 0.92],
                  [L.iconFadeOutEnd, L.labelIconOpacityAtHandoff],
              ])
            : 0;
        const labelLayer = z >= L.labelMinZoom;
        const labelIconOp = labelLayer
            ? maplibreInterp(z, [[L.labelFadeInStart, L.labelIconOpacityAtHandoff], [L.labelFadeInEnd, 1]])
            : 0;
        const dotVisible = dotOp > 0.2 && dotR > 3;
        const riderVis = Math.max(dotOp * (dotR > 1 ? 1 : 0), iconOp, labelIconOp);
        if (riderVis < 0.25 && clOp < 0.2 && hubOp < 0.2) {
            issues.push({ zoom: z, type: 'GAP' });
        }
        const inHandoff = z >= L.dotFadeOutStart && z < 12.8;
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
