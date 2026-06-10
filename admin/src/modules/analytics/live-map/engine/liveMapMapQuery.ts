/**
 * MapLibre query helpers — viewport bbox + rendered feature classification.
 */

export type MapQuerySurface = {
    getCanvas?: () => HTMLCanvasElement;
    getContainer?: () => HTMLElement;
    queryRenderedFeatures?: (
        geometryOrOptions?: [number, number] | [[number, number], [number, number]] | { layers?: string[] },
        options?: { layers?: string[] },
    ) => Array<{ properties?: Record<string, unknown> }>;
};

function viewportCssSize(map: MapQuerySurface): { w: number; h: number } {
    const canvas = map.getCanvas?.();
    const container = map.getContainer?.() ?? canvas?.parentElement ?? null;
    const w = container?.clientWidth ?? canvas?.clientWidth ?? 0;
    const h = container?.clientHeight ?? canvas?.clientHeight ?? 0;
    return { w, h };
}

/** Viewport query — MapLibre expects CSS pixel coords, not canvas backing-store size. */
export function queryRenderedFeaturesInViewport(
    map: MapQuerySurface,
    layers: string[],
): Array<{ properties?: Record<string, unknown> }> {
    if (!map.queryRenderedFeatures || layers.length === 0) return [];

    try {
        const all = map.queryRenderedFeatures({ layers });
        if (all.length > 0) return all;
    } catch {
        /* fall through */
    }

    const { w, h } = viewportCssSize(map);
    if (w > 0 && h > 0) {
        try {
            return map.queryRenderedFeatures([[0, 0], [w, h]], { layers });
        } catch {
            /* fall through */
        }
    }
    return [];
}

export function classifyRenderedFeatures(
    features: Array<{ properties?: Record<string, unknown> }>,
    tier: 'macro' | 'meso' | 'micro',
): { total: number; clusters: number; points: number; hubs: number } {
    let clusters = 0;
    let points = 0;
    let hubs = 0;
    for (const f of features) {
        const p = f.properties;
        if (!p) continue;
        if (p.cluster_id != null || p.point_count != null) {
            clusters += 1;
            continue;
        }
        if (tier === 'macro' && (p.slug != null || p.count != null)) {
            hubs += 1;
            continue;
        }
        if (p.deviceId != null && tier !== 'macro') {
            points += 1;
        }
    }
    return { total: clusters + points + hubs, clusters, points, hubs };
}

export type RenderedCountResult = ReturnType<typeof classifyRenderedFeatures> & {
    usedSourceFallback: boolean;
};

/**
 * MapLibre symbol layers (rider icons) often return 0 from queryRenderedFeatures in
 * headless/ANGLE — fall back to querySourceFeatures when viewport query is empty.
 */
export function countRenderedWithSymbolFallback(
    map: MapQuerySurface & {
        querySourceFeatures?: (sourceId: string) => Array<{ properties?: Record<string, unknown> }>;
    },
    layerIds: string[],
    tier: 'macro' | 'meso' | 'micro',
    sourceId?: string,
): RenderedCountResult {
    const rendered = queryRenderedFeaturesInViewport(map, layerIds);
    const classified = classifyRenderedFeatures(rendered, tier);
    if (
        tier === 'micro'
        && classified.total === 0
        && sourceId
        && map.querySourceFeatures
    ) {
        const sourceFeatures = map.querySourceFeatures(sourceId);
        const sourcePoints = sourceFeatures.filter((f) => f.properties?.point_count == null).length;
        if (sourcePoints > 0) {
            return {
                total: sourcePoints,
                clusters: 0,
                points: sourcePoints,
                hubs: 0,
                usedSourceFallback: true,
            };
        }
    }
    return { ...classified, usedSourceFallback: false };
}
