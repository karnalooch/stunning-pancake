import { apiClient } from '../../../../api/client';
import { resolveLiveMapTier, type LiveApiDetail } from './liveMapZoom';

let sessionId: string | null = null;

export function liveMapSessionId(): string {
    if (!sessionId) {
        sessionId = typeof crypto !== 'undefined' && crypto.randomUUID
            ? crypto.randomUUID()
            : `lm-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    }
    return sessionId;
}

export function bboxHash(bbox: string | undefined): string {
    if (!bbox) return 'no-bbox';
    let h = 0;
    for (let i = 0; i < bbox.length; i += 1) {
        h = ((h << 5) - h + bbox.charCodeAt(i)) | 0;
    }
    return `b${Math.abs(h).toString(36)}`;
}

export type LiveMapAuditPayload = {
    session_id: string;
    bbox_hash: string;
    zoom?: number;
    tier?: string;
    filters?: Record<string, string>;
    positions_returned?: number;
    detail?: LiveApiDetail;
    read_mode?: string;
};

export async function postLiveMapAudit(payload: LiveMapAuditPayload): Promise<void> {
    await apiClient.post('/activities/telemetry/live/audit/', payload, {
        skipGlobalError: true,
    } as { skipGlobalError: boolean });
}

export function buildAuditPayload(args: {
    bbox?: string;
    zoom?: number;
    detail?: LiveApiDetail;
    meta?: Record<string, unknown> | null;
    filters?: Record<string, string>;
    positionsReturned?: number;
}): LiveMapAuditPayload {
    const zoom = args.zoom;
    return {
        session_id: liveMapSessionId(),
        bbox_hash: bboxHash(args.bbox),
        zoom,
        tier: zoom != null ? resolveLiveMapTier(zoom) : undefined,
        filters: args.filters,
        positions_returned: args.positionsReturned,
        detail: args.detail,
        read_mode: typeof args.meta?.read_mode === 'string' ? args.meta.read_mode : undefined,
    };
}
