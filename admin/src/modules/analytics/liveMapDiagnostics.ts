import type { LiveApiDetail } from './liveMapEnterprise';

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
