import { describe, expect, it } from 'vitest';
import {
    computeLiveMapHealth,
    formatLastSyncAgo,
    parsePollAfterMs,
    resolveStaleAfterMs,
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

    it('stays live when server bbox cache returns riders (normal TTL)', () => {
        const now = Date.now();
        const h = computeLiveMapHealth({
            mapReady: true,
            canFetch: true,
            tabVisible: true,
            liveFetchPaused: false,
            ingestEngaged: false,
            lastSuccessAt: now,
            lastErrorAt: null,
            consecutiveErrors: 0,
            lastLatencyMs: 539,
            cachedPositionCount: 120,
            meta: { cached: true, positions_returned: 45 },
            now,
        });
        expect(h.status).toBe('live');
        expect(h.readMode).toBe('cached');
        expect(h.message).toBeNull();
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

    it('resolveStaleAfterMs tolerates slow SSE + 15s poll', () => {
        const ms = resolveStaleAfterMs({
            pollDelayMs: 15_000,
            lastLatencyMs: 7_051,
            sseActive: true,
            streamIntervalMs: 350,
        });
        expect(ms).toBeGreaterThan(20_000);
    });

    it('resolveStaleAfterMs stays at default for fast polls', () => {
        expect(resolveStaleAfterMs({ pollDelayMs: 950, lastLatencyMs: 120, sseActive: false }))
            .toBe(12_000);
    });

    it('formatLastSyncAgo', () => {
        expect(formatLastSyncAgo(null)).toBe('—');
        expect(formatLastSyncAgo(Date.now() - 500)).toBe('teraz');
        expect(statusLabel('live')).toBe('Live');
    });

    it('reports stale not error when polls fail but map has cached riders', () => {
        const h = computeLiveMapHealth({
            mapReady: true,
            canFetch: true,
            tabVisible: true,
            liveFetchPaused: false,
            ingestEngaged: false,
            lastSuccessAt: Date.now() - 60_000,
            lastErrorAt: Date.now(),
            consecutiveErrors: 4,
            lastLatencyMs: null,
            cachedPositionCount: 785,
        });
        expect(h.status).toBe('stale');
        expect(h.message).toContain('ostatnie znane pozycje');
    });
});
