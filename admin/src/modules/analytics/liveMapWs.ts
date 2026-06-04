import type { LiveMapPosition } from './liveMapMarkers';

export type WsPositionUpdate = {
    type: 'position_update';
    device_id?: string | number;
    lat?: number;
    lon?: number;
    speed_ms?: number;
    course?: number;
};

function resolveTelemetryWsBase(): string | null {
    const raw = import.meta.env.VITE_TELEMETRY_WS_URL || import.meta.env.VITE_TELEMETRY_URL || '';
    if (!raw) return null;
    const base = String(raw).replace(/\/$/, '');
    return base.replace(/^https:/i, 'wss:').replace(/^http:/i, 'ws:');
}

export function liveMapWsEnabled(): boolean {
    const flag = import.meta.env.VITE_LIVE_MAP_WS;
    return flag === '1' || flag === 'true';
}

export function wsUpdateToPosition(msg: WsPositionUpdate): LiveMapPosition | null {
    const id = msg.device_id;
    if (id == null || msg.lat == null || msg.lon == null) return null;
    return {
        deviceId: String(id),
        name: '',
        type: 'bike',
        lat: msg.lat,
        lng: msg.lon,
        speed: msg.speed_ms ?? 0,
        course: msg.course ?? 0,
        lastUpdate: '',
    };
}

/**
 * Optional FastAPI `/ws/telemetry/live` lane (mobile ingest broadcast).
 * Complements Django SSE (simulator / Redis snapshots).
 */
export function connectLiveMapWs(
    onUpdate: (pos: LiveMapPosition) => void,
    onError?: (err: unknown) => void,
): (() => void) | null {
    const wsBase = resolveTelemetryWsBase();
    if (!wsBase || !liveMapWsEnabled()) return null;

    let ws: WebSocket;
    let closed = false;
    try {
        ws = new WebSocket(`${wsBase}/ws/telemetry/live`);
    } catch (err) {
        onError?.(err);
        return null;
    }

    ws.onmessage = (ev) => {
        try {
            const data = JSON.parse(String(ev.data)) as WsPositionUpdate & { type?: string };
            if (data.type === 'ping' || data.type === 'pong') return;
            if (data.type !== 'position_update') return;
            const pos = wsUpdateToPosition(data);
            if (pos) onUpdate(pos);
        } catch {
            /* ignore */
        }
    };

    ws.onerror = () => onError?.(new Error('ws error'));
    ws.onclose = () => {
        if (!closed) onError?.(new Error('ws closed'));
    };

    return () => {
        closed = true;
        try {
            ws.close();
        } catch {
            /* ignore */
        }
    };
}
