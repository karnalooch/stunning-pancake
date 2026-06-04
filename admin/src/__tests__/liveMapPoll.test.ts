import { describe, expect, it } from 'vitest';
import {
    applyPollJitter,
    pollBackoffMs,
    pollFallbackWhileStreaming,
    resolveLiveMapPollDelayMs,
    resolveLiveMapPollDelayWithStream,
    streamIntervalForZoom,
} from '../modules/analytics/liveMapPoll';

describe('liveMapPoll', () => {
    it('backs off on consecutive errors', () => {
        expect(pollBackoffMs(0, 1000)).toBe(1000);
        expect(pollBackoffMs(2, 1000)).toBe(2000);
        expect(pollBackoffMs(10, 1000)).toBe(8000);
    });

    it('prefers server poll_after_ms', () => {
        const ms = resolveLiveMapPollDelayMs({
            zoom: 12,
            lastRefreshMs: 100,
            ingestEngaged: true,
            pollMultiplier: 2.5,
            serverPollAfterMs: 3200,
            consecutiveErrors: 0,
            random: () => 0.5,
        });
        expect(ms).toBeGreaterThanOrEqual(2800);
        expect(ms).toBeLessThanOrEqual(3600);
    });

    it('jitter stays within bounds', () => {
        const base = 2000;
        const jittered = applyPollJitter(base, () => 0);
        expect(jittered).toBeGreaterThanOrEqual(1760);
        expect(jittered).toBeLessThanOrEqual(2240);
    });

    it('stream interval at zoom 12 is 350ms', () => {
        expect(streamIntervalForZoom(12.5, false)).toBe(350);
        expect(streamIntervalForZoom(14, false)).toBe(200);
    });

    it('poll fallback while SSE is slow', () => {
        expect(pollFallbackWhileStreaming(350)).toBeGreaterThanOrEqual(15_000);
    });

    it('shorter poll at zoom 12', () => {
        const ms = resolveLiveMapPollDelayMs({
            zoom: 12,
            lastRefreshMs: null,
            ingestEngaged: false,
            pollMultiplier: 1,
            serverPollAfterMs: null,
            consecutiveErrors: 0,
            random: () => 0.5,
        });
        expect(ms).toBeLessThan(1200);
    });

    it('uses slow poll when SSE active', () => {
        const ms = resolveLiveMapPollDelayWithStream({
            zoom: 13,
            lastRefreshMs: null,
            ingestEngaged: false,
            pollMultiplier: 1,
            serverPollAfterMs: null,
            consecutiveErrors: 0,
            sseActive: true,
            streamIntervalMs: 350,
            random: () => 0.5,
        });
        expect(ms).toBeGreaterThanOrEqual(15_000);
    });
});
