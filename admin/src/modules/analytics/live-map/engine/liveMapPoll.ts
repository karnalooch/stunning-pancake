import { pollIntervalForZoom } from './liveMapZoom';

/** SSE cadence when not provided by server meta (200–500 ms at street zoom). */
export function streamIntervalForZoom(
    zoom: number,
    ingestEngaged = false,
    pollMultiplier = 1,
): number {
    let base = 500;
    if (zoom >= 14) base = 200;
    else if (zoom >= 12) base = 350;
    else if (zoom >= 10) base = 450;
    const mult = ingestEngaged ? Math.max(1, pollMultiplier) : 1;
    return Math.max(200, Math.min(2000, Math.round(base * mult)));
}

/** HTTP poll fallback interval while SSE is active (slow sync). */
export function pollFallbackWhileStreaming(streamMs: number): number {
    return Math.max(15_000, Math.round(streamMs * 8));
}

/** Jitter ±12% to avoid synchronized client stampedes. */
export function applyPollJitter(ms: number, random = Math.random): number {
    const jitter = 0.88 + random() * 0.24;
    return Math.max(400, Math.round(ms * jitter));
}

/** Exponential backoff after failed polls (cap 30s). */
export function pollBackoffMs(consecutiveErrors: number, baseMs: number): number {
    if (consecutiveErrors <= 0) return baseMs;
    const factor = Math.min(8, 2 ** (consecutiveErrors - 1));
    return Math.min(30_000, Math.max(baseMs, Math.round(baseMs * factor)));
}

export type ResolvePollDelayInput = {
    zoom: number;
    lastRefreshMs: number | null;
    ingestEngaged: boolean;
    pollMultiplier: number;
    serverPollAfterMs: number | null;
    consecutiveErrors: number;
    random?: () => number;
};

/**
 * Client poll interval: server hint (ADR 011) when present, else zoom-adaptive baseline.
 */
export function resolveLiveMapPollDelayMs(input: ResolvePollDelayInput): number {
    const {
        zoom,
        lastRefreshMs,
        ingestEngaged,
        pollMultiplier,
        serverPollAfterMs,
        consecutiveErrors,
        random = Math.random,
    } = input;

    let base =
        serverPollAfterMs
        ?? pollIntervalForZoom(zoom, lastRefreshMs, ingestEngaged, pollMultiplier);

    base = pollBackoffMs(consecutiveErrors, base);
    return applyPollJitter(base, random);
}

export type ResolvePollDelayWithStreamInput = ResolvePollDelayInput & {
    sseActive?: boolean;
    streamIntervalMs?: number | null;
};

export function resolveLiveMapPollDelayWithStream(input: ResolvePollDelayWithStreamInput): number {
    if (input.sseActive) {
        const streamMs =
            input.streamIntervalMs
            ?? streamIntervalForZoom(input.zoom, input.ingestEngaged, input.pollMultiplier);
        return pollFallbackWhileStreaming(streamMs);
    }
    return resolveLiveMapPollDelayMs(input);
}
