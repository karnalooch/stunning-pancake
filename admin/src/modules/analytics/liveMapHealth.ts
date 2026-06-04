/** Live Map sync / degradation state (enterprise ops surface). */

export type LiveMapSyncStatus =
    | 'connecting'
    | 'live'
    | 'stale'
    | 'degraded'
    | 'error'
    | 'paused'
    | 'offline';

export type LiveMapReadMode = 'normal' | 'ingest_protected' | 'viewport_capped' | 'cached';

export type LiveMapHealthSnapshot = {
    status: LiveMapSyncStatus;
    readMode: LiveMapReadMode;
    lastSuccessAt: number | null;
    lastErrorAt: number | null;
    consecutiveErrors: number;
    lastLatencyMs: number | null;
    positionsCapped: boolean;
    cachedResponse: boolean;
    detailCeiling: string | null;
    pollAfterMs: number | null;
    message: string | null;
};

export type LiveMapHealthInput = {
    now?: number;
    mapReady: boolean;
    canFetch: boolean;
    tabVisible: boolean;
    liveFetchPaused: boolean;
    ingestEngaged: boolean;
    lastSuccessAt: number | null;
    lastErrorAt: number | null;
    consecutiveErrors: number;
    lastLatencyMs: number | null;
    meta?: Record<string, unknown> | null;
    staleAfterMs?: number;
    /** Riders still drawn from last good payload while HTTP poll fails */
    cachedPositionCount?: number;
};

export const DEFAULT_STALE_AFTER_MS = 12_000;

export type ResolveStaleAfterMsInput = {
    pollDelayMs?: number | null;
    lastLatencyMs?: number | null;
    sseActive?: boolean;
    streamIntervalMs?: number | null;
};

/**
 * Stale threshold must exceed HTTP poll cadence (15s+ when SSE is active) and slow payloads.
 */
export function resolveStaleAfterMs(input: ResolveStaleAfterMsInput = {}): number {
    const latency = Math.max(0, input.lastLatencyMs ?? 0);
    const poll = Math.max(400, input.pollDelayMs ?? (input.sseActive ? 15_000 : 1_000));
    const stream = Math.max(200, input.streamIntervalMs ?? 350);

    if (input.sseActive) {
        return Math.max(
            DEFAULT_STALE_AFTER_MS,
            Math.round(poll * 1.25 + latency * 2),
            Math.round(stream * 25),
        );
    }
    return Math.max(
        DEFAULT_STALE_AFTER_MS,
        Math.round(poll * 1.1 + latency * 2.5),
    );
}

export function parseLiveMapReadMode(meta: Record<string, unknown> | null | undefined): LiveMapReadMode {
    if (!meta) return 'normal';
    if (Boolean(meta.cached) && (meta.positions_returned as number | undefined) !== 0) {
        return 'cached';
    }
    if (Boolean(meta.ingest_engaged ?? meta.live_read_throttled)) return 'ingest_protected';
    if (Boolean(meta.capped)) return 'viewport_capped';
    return 'normal';
}

export function parsePollAfterMs(meta: Record<string, unknown> | null | undefined): number | null {
    const v = meta?.poll_after_ms;
    if (typeof v === 'number' && Number.isFinite(v) && v >= 400) return Math.round(v);
    return null;
}

export function parseDetailCeiling(meta: Record<string, unknown> | null | undefined): string | null {
    const v = meta?.live_detail_ceiling;
    return typeof v === 'string' && v.length > 0 ? v : null;
}

export function computeLiveMapHealth(input: LiveMapHealthInput): LiveMapHealthSnapshot {
    const now = input.now ?? Date.now();
    const staleAfter = input.staleAfterMs ?? DEFAULT_STALE_AFTER_MS;
    const meta = input.meta ?? null;
    const readMode = parseLiveMapReadMode(meta);
    const pollAfterMs = parsePollAfterMs(meta);
    const detailCeiling = parseDetailCeiling(meta);
    const positionsCapped = Boolean(meta?.capped);
    const cachedResponse = Boolean(meta?.cached);

    if (!input.tabVisible) {
        return {
            status: 'offline',
            readMode,
            lastSuccessAt: input.lastSuccessAt,
            lastErrorAt: input.lastErrorAt,
            consecutiveErrors: input.consecutiveErrors,
            lastLatencyMs: input.lastLatencyMs,
            positionsCapped,
            cachedResponse,
            detailCeiling,
            pollAfterMs,
            message: 'Karta w tle — odświeżanie wstrzymane',
        };
    }

    if (input.liveFetchPaused) {
        return {
            status: 'paused',
            readMode,
            lastSuccessAt: input.lastSuccessAt,
            lastErrorAt: input.lastErrorAt,
            consecutiveErrors: input.consecutiveErrors,
            lastLatencyMs: input.lastLatencyMs,
            positionsCapped,
            cachedResponse,
            detailCeiling,
            pollAfterMs,
            message: 'Sesja wygasła — zaloguj się ponownie',
        };
    }

    if (!input.canFetch) {
        return {
            status: 'paused',
            readMode,
            lastSuccessAt: input.lastSuccessAt,
            lastErrorAt: input.lastErrorAt,
            consecutiveErrors: input.consecutiveErrors,
            lastLatencyMs: input.lastLatencyMs,
            positionsCapped,
            cachedResponse,
            detailCeiling,
            pollAfterMs,
            message: 'Wymagane logowanie administratora',
        };
    }

    if (!input.mapReady) {
        return {
            status: 'connecting',
            readMode,
            lastSuccessAt: input.lastSuccessAt,
            lastErrorAt: input.lastErrorAt,
            consecutiveErrors: input.consecutiveErrors,
            lastLatencyMs: input.lastLatencyMs,
            positionsCapped,
            cachedResponse,
            detailCeiling,
            pollAfterMs,
            message: 'Ładowanie mapy…',
        };
    }

    if (input.consecutiveErrors > 0) {
        const cached = (input.cachedPositionCount ?? 0) > 0;
        const manyErrors = input.consecutiveErrors >= 3;
        if (cached && manyErrors) {
            return {
                status: 'stale',
                readMode,
                lastSuccessAt: input.lastSuccessAt,
                lastErrorAt: input.lastErrorAt,
                consecutiveErrors: input.consecutiveErrors,
                lastLatencyMs: input.lastLatencyMs,
                positionsCapped,
                cachedResponse,
                detailCeiling,
                pollAfterMs,
                message:
                    'Odświeżanie telemetrii chwilowo niedostępne — mapa pokazuje ostatnie znane pozycje (backend może być obciążony symulatorem)',
            };
        }
        const errMsg = manyErrors
            ? 'Wielokrotny błąd telemetrii — dane mogą być nieaktualne'
            : 'Błąd odświeżania telemetrii';
        return {
            status: 'error',
            readMode,
            lastSuccessAt: input.lastSuccessAt,
            lastErrorAt: input.lastErrorAt,
            consecutiveErrors: input.consecutiveErrors,
            lastLatencyMs: input.lastLatencyMs,
            positionsCapped,
            cachedResponse,
            detailCeiling,
            pollAfterMs,
            message: errMsg,
        };
    }

    const lastOk = input.lastSuccessAt;
    const age = lastOk != null ? now - lastOk : Infinity;
    const ingestDegraded = input.ingestEngaged || readMode === 'ingest_protected';

    if (lastOk == null) {
        return {
            status: 'connecting',
            readMode,
            lastSuccessAt: null,
            lastErrorAt: input.lastErrorAt,
            consecutiveErrors: 0,
            lastLatencyMs: input.lastLatencyMs,
            positionsCapped,
            cachedResponse,
            detailCeiling,
            pollAfterMs,
            message: 'Pierwsze pobranie pozycji…',
        };
    }

    if (age > staleAfter) {
        return {
            status: 'stale',
            readMode,
            lastSuccessAt: lastOk,
            lastErrorAt: input.lastErrorAt,
            consecutiveErrors: 0,
            lastLatencyMs: input.lastLatencyMs,
            positionsCapped,
            cachedResponse,
            detailCeiling,
            pollAfterMs,
            message: `Brak synchronizacji od ${Math.round(age / 1000)} s`,
        };
    }

    const cacheStaleEmpty = Boolean(meta?.cache_stale_empty);
    if (ingestDegraded || positionsCapped || cacheStaleEmpty) {
        let message: string | null = null;
        if (ingestDegraded) message = 'Tryb ochrony ingest (ADR 011) — rzadsze odświeżanie';
        else if (positionsCapped) message = 'Limit viewport — część rowerzystów nie jest rysowana';
        else if (cacheStaleEmpty) {
            message = 'Cache bbox bez pozycji w viewport — odświeżanie z Redis';
        }
        return {
            status: 'degraded',
            readMode,
            lastSuccessAt: lastOk,
            lastErrorAt: input.lastErrorAt,
            consecutiveErrors: 0,
            lastLatencyMs: input.lastLatencyMs,
            positionsCapped,
            cachedResponse,
            detailCeiling,
            pollAfterMs,
            message,
        };
    }

    return {
        status: 'live',
        readMode,
        lastSuccessAt: lastOk,
        lastErrorAt: input.lastErrorAt,
        consecutiveErrors: 0,
        lastLatencyMs: input.lastLatencyMs,
        positionsCapped,
        cachedResponse,
        detailCeiling,
        pollAfterMs,
        message: null,
    };
}

export function formatLastSyncAgo(lastSuccessAt: number | null, now = Date.now()): string {
    if (lastSuccessAt == null) return '—';
    const sec = Math.max(0, Math.round((now - lastSuccessAt) / 1000));
    if (sec < 2) return 'teraz';
    if (sec < 60) return `${sec} s temu`;
    return `${Math.floor(sec / 60)} min temu`;
}

export function statusColor(status: LiveMapSyncStatus): string {
    switch (status) {
        case 'live':
            return 'green';
        case 'degraded':
        case 'stale':
            return 'yellow';
        case 'error':
            return 'red';
        case 'paused':
            return 'orange';
        case 'offline':
            return 'gray';
        default:
            return 'blue';
    }
}

export function statusLabel(status: LiveMapSyncStatus): string {
    switch (status) {
        case 'live':
            return 'Live';
        case 'stale':
            return 'Stale';
        case 'degraded':
            return 'Degraded';
        case 'error':
            return 'Error';
        case 'paused':
            return 'Paused';
        case 'offline':
            return 'Background';
        default:
            return 'Connecting';
    }
}
