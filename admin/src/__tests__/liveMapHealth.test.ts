import { describe, expect, it } from 'vitest';
import {
    computeLiveMapHealth,
    formatLastSyncAgo,
    parsePollAfterMs,
    statusLabel,
} from '../modules/analytics/liveMapHealth';

describe('liveMapHealth', () => {
    it('parsePollAfterMs rejects invalid values', () => {
        expect(parsePollAfterMs({ poll_after_ms: 2000 })).toBe(2000);
        expect(parsePollAfterMs({ poll_after_ms: 100 })).toBeNull();
    });

    it('reports paused when live fetch paused', () => {
        const h = computeLiveMapHealth({
            mapReady: true,
            canFetch: true,
            tabVisible: true,
            liveFetchPaused: true,
            ingestEngaged: false,
            lastSuccessAt: Date.now(),
            lastErrorAt: null,
            consecutiveErrors: 0,
            lastLatencyMs: 120,
        });
        expect(h.status).toBe('paused');
    });

    it('reports degraded under ingest protection', () => {
        const now = Date.now();
        const h = computeLiveMapHealth({
            mapReady: true,
            canFetch: true,
            tabVisible: true,
            liveFetchPaused: false,
            ingestEngaged: true,
            lastSuccessAt: now,
            lastErrorAt: null,
            consecutiveErrors: 0,
            lastLatencyMs: 200,
            meta: { ingest_engaged: true },
            now,
        });
        expect(h.status).toBe('degraded');
        expect(h.message).toContain('ingest');
    });

    it('reports stale when last success is old', () => {
        const now = 10_000;
        const h = computeLiveMapHealth({
            mapReady: true,
            canFetch: true,
            tabVisible: true,
            liveFetchPaused: false,
            ingestEngaged: false,
            lastSuccessAt: now - 20_000,
            lastErrorAt: null,
            consecutiveErrors: 0,
            lastLatencyMs: 100,
            now,
            staleAfterMs: 5_000,
        });
        expect(h.status).toBe('stale');
    });

    it('formatLastSyncAgo', () => {
        expect(formatLastSyncAgo(null)).toBe('—');
        expect(formatLastSyncAgo(Date.now() - 500)).toBe('teraz');
        expect(statusLabel('live')).toBe('Live');
    });
});
