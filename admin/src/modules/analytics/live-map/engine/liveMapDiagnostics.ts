import type { LiveApiDetail } from './liveMapEnterprise';
import { resolveLiveMapTier } from './liveMapEnterprise';
import { LIVE_LAYERS, LIVE_SOURCES } from './liveMapLayers';
import { countRenderedWithSymbolFallback } from './liveMapMapQuery';

export type LiveMapWebGlAudit = {
    zoom: number;
    tier: string;
    glRenderer: string | null;
    glVendor: string | null;
    /** Raw GeoJSON features from querySourceFeatures (never clustered tiles). */
    sourceTotal: number;
    sourceClusters: number;
    sourcePoints: number;
    /** Viewport queryRenderedFeatures count. */
    renderedTotal: number;
    renderedClusters: number;
    renderedPoints: number;
    /** Non-basemap pixels from gl.readPixels (ground truth for WebGL paint). */
    canvasColoredPixels: number;
    canvasSampledPixels: number;
    layoutVisibility: Record<string, string>;
};

function sampleMapCanvasPixels(canvas: HTMLCanvasElement): { colored: number; sampled: number } {
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return { colored: 0, sampled: 0 };
    const w = canvas.width;
    const h = canvas.height;
    if (w <= 0 || h <= 0) return { colored: 0, sampled: 0 };
    const buf = new Uint8Array(4 * w * h);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, buf);
    let colored = 0;
    for (let i = 0; i < buf.length; i += 4) {
        const r = buf[i];
        const g = buf[i + 1];
        const b = buf[i + 2];
        const a = buf[i + 3];
        if (a < 40) continue;
        // Skip light basemap tones (OpenFreeMap neutrals).
        if (r > 238 && g > 238 && b > 232) continue;
        if (r > 215 && g > 220 && b > 210 && Math.abs(r - g) < 18) continue;
        colored += 1;
    }
    return { colored, sampled: w * h };
}

/** Source vs rendered probe for WebGL / headless audits (E2E bridge only). */
export function auditWebGlLiveMap(map: {
    getZoom: () => number;
    getCanvas?: () => HTMLCanvasElement;
    querySourceFeatures?: (sourceId: string) => Array<{ properties?: Record<string, unknown> }>;
    queryRenderedFeatures?: (
        geometryOrOptions?: [number, number] | [[number, number], [number, number]] | { layers?: string[] },
        options?: { layers?: string[] },
    ) => Array<{ properties?: Record<string, unknown> }>;
    getLayoutProperty?: (id: string, prop: string) => unknown;
}): LiveMapWebGlAudit {
    const zoom = map.getZoom();
    const tier = resolveLiveMapTier(zoom);
    const canvas = map.getCanvas?.();
    let glRenderer: string | null = null;
    let glVendor: string | null = null;
    if (canvas) {
        const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
        const dbg = gl?.getExtension('WEBGL_debug_renderer_info');
        if (dbg && gl) {
            glRenderer = gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) as string;
            glVendor = gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL) as string;
        }
    }

    const sourceId = tier === 'meso' ? LIVE_SOURCES.mesoClusters : LIVE_SOURCES.positions;
    const sourceFeatures = map.querySourceFeatures?.(sourceId) ?? [];
    const sourceClusters = sourceFeatures.filter((f) => f.properties?.point_count != null).length;
    const sourcePoints = sourceFeatures.filter((f) => f.properties?.point_count == null).length;

    const layerIds =
        tier === 'macro'
            ? [LIVE_LAYERS.cityHubRing, LIVE_LAYERS.cityHubCount]
            : tier === 'meso'
                ? [
                    LIVE_LAYERS.clusters,
                    LIVE_LAYERS.clusterCount,
                    LIVE_LAYERS.directionDots,
                ]
                : [LIVE_LAYERS.unclustered, LIVE_LAYERS.riderLabels];

    const classified = countRenderedWithSymbolFallback(map, layerIds, tier, sourceId);
    const renderedClusters = classified.clusters;
    const renderedPoints = classified.points;

    const layoutVisibility: Record<string, string> = {};
    for (const id of layerIds) {
        try {
            const v = map.getLayoutProperty?.(id, 'visibility');
            layoutVisibility[id] = typeof v === 'string' ? v : 'visible';
        } catch {
            layoutVisibility[id] = 'error';
        }
    }

    const pixelSample = canvas ? sampleMapCanvasPixels(canvas) : { colored: 0, sampled: 0 };

    return {
        zoom,
        tier,
        glRenderer,
        glVendor,
        sourceTotal: sourceFeatures.length,
        sourceClusters,
        sourcePoints,
        renderedTotal: classified.total,
        renderedClusters,
        renderedPoints,
        canvasColoredPixels: pixelSample.colored,
        canvasSampledPixels: pixelSample.sampled,
        layoutVisibility,
    };
}

export type LiveMapRequestLogEntry = {
    at: number;
    bbox?: string;
    zoom?: number;
    detail: LiveApiDetail;
    latencyMs: number;
    positions: number;
    readMode?: string;
    capped?: boolean;
    cached?: boolean;
};

const MAX_LOG = 12;

export function appendRequestLog(
    prev: LiveMapRequestLogEntry[],
    entry: Omit<LiveMapRequestLogEntry, 'at'> & { at?: number },
): LiveMapRequestLogEntry[] {
    const row: LiveMapRequestLogEntry = { ...entry, at: entry.at ?? Date.now() };
    return [row, ...prev].slice(0, MAX_LOG);
}

export type IncidentBundle = {
    exportedAt: string;
    viewport: { bbox?: string; zoom?: number; detail?: string };
    sync: Record<string, unknown>;
    meta: Record<string, unknown> | null;
    filters: Record<string, unknown>;
    requestLog: LiveMapRequestLogEntry[];
};

export function buildIncidentBundle(input: {
    bbox?: string;
    zoom?: number;
    detail?: string;
    health: Record<string, unknown>;
    meta: Record<string, unknown> | null;
    filters: Record<string, unknown>;
    requestLog: LiveMapRequestLogEntry[];
}): IncidentBundle {
    return {
        exportedAt: new Date().toISOString(),
        viewport: {
            bbox: input.bbox,
            zoom: input.zoom,
            detail: input.detail,
        },
        sync: input.health,
        meta: input.meta,
        filters: input.filters,
        requestLog: input.requestLog,
    };
}

export type RenderedBadgeColor = 'green' | 'orange' | 'red';

/** Badge color when drawn features exist but MapLibre paint may still be pending. */
export function renderedBadgeColor(
    drawn: number,
    rendered: number,
    mismatchAgeMs: number | null,
    pendingThresholdMs = 2000,
): RenderedBadgeColor {
    if (rendered === 0 && drawn > 0) {
        if (mismatchAgeMs == null || mismatchAgeMs < pendingThresholdMs) return 'orange';
        return 'red';
    }
    if (rendered >= drawn) return 'green';
    return 'orange';
}

export function formatCapHonestyMessage(meta: Record<string, unknown> | null | undefined): string | null {
    if (!meta?.capped) return null;
    const returned = meta.positions_returned ?? meta.viewport_returned;
    const estimate = meta.viewport_total_estimate;
    if (typeof returned === 'number' && typeof estimate === 'number' && estimate > returned) {
        return `Pokazujemy ${returned.toLocaleString()} z ~${estimate.toLocaleString()} kolarzy w widoku (limit próbkowania).`;
    }
    if (typeof returned === 'number') {
        return `Widok ograniczony do ${returned.toLocaleString()} pozycji (cap viewport).`;
    }
    return 'Widok może być niekompletny — aktywny limit próbkowania.';
}
