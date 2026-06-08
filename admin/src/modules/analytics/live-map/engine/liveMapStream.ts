import { getStoredAccessToken } from '../../../../core/auth/tokens';
import { useAuth } from '../../../../core/auth/useAuth';
import type { LiveMapPosition } from './liveMapMarkers';

export type LiveMapStreamPayload = {
    positions?: LiveMapPosition[];
    meta?: Record<string, unknown>;
};

export type LiveMapStreamHandlers = {
    onSnapshot: (positions: LiveMapPosition[], meta: Record<string, unknown> | undefined) => void;
    onError?: (err: unknown) => void;
    onOpen?: () => void;
};

function resolveApiBase(): string {
    let baseURL = import.meta.env.VITE_API_URL || '';
    if (!baseURL) {
        if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
            baseURL = 'http://localhost:8000/api';
        } else {
            baseURL = '/api';
        }
    }
    if (baseURL && !baseURL.endsWith('/api') && !baseURL.endsWith('/api/')) {
        baseURL = `${baseURL.replace(/\/$/, '')}/api`;
    }
    if (baseURL.startsWith('/') && typeof window !== 'undefined') {
        baseURL = `${window.location.protocol}//${window.location.host}${baseURL}`;
    }
    return baseURL.replace(/\/$/, '');
}

function authHeader(): string | undefined {
    const token = useAuth.getState().token || getStoredAccessToken();
    return token ? `Bearer ${token}` : undefined;
}

/** Parse SSE `data:` lines from a growing text buffer. */
export function parseSseBuffer(buffer: string): { events: LiveMapStreamPayload[]; rest: string } {
    const events: LiveMapStreamPayload[] = [];
    const parts = buffer.split('\n\n');
    const rest = parts.pop() ?? '';
    for (const block of parts) {
        for (const line of block.split('\n')) {
            if (!line.startsWith('data:')) continue;
            const raw = line.slice(5).trim();
            if (!raw) continue;
            try {
                events.push(JSON.parse(raw) as LiveMapStreamPayload);
            } catch {
                /* skip malformed */
            }
        }
    }
    return { events, rest };
}

/**
 * Authenticated fetch-based SSE (supports Bearer; unlike EventSource).
 * Returns AbortController to close the stream.
 */
export function connectLiveMapSse(
    params: Record<string, string | number>,
    handlers: LiveMapStreamHandlers,
): AbortController {
    const ac = new AbortController();
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
        qs.set(k, String(v));
    }
    const url = `${resolveApiBase()}/activities/telemetry/live/stream/?${qs.toString()}`;

    (async () => {
        try {
            const headers: Record<string, string> = { Accept: 'text/event-stream' };
            const auth = authHeader();
            if (auth) headers.Authorization = auth;

            const res = await fetch(url, { headers, signal: ac.signal, cache: 'no-store' });
            if (!res.ok || !res.body) {
                throw new Error(`SSE ${res.status}`);
            }
            handlers.onOpen?.();

            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                const { events, rest } = parseSseBuffer(buffer);
                buffer = rest;
                for (const ev of events) {
                    const list = ev.positions ?? [];
                    handlers.onSnapshot(list, ev.meta);
                }
            }
        } catch (err) {
            if (!ac.signal.aborted) handlers.onError?.(err);
        }
    })();

    return ac;
}

export function parseStreamIntervalMs(meta: Record<string, unknown> | null | undefined): number | null {
    const v = meta?.stream_interval_ms;
    if (typeof v === 'number' && Number.isFinite(v) && v >= 200) return Math.round(v);
    return null;
}
