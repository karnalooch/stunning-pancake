/**
 * Optional WebSocket telemetry ingest lane (ADR 011 §4).
 * Enabled when EXPO_PUBLIC_TELEMETRY_WS_INGEST=1; HTTP batch remains default.
 *
 * WS handshake does not carry the Django Authorization header (the browser
 * WebSocket API does not let us set arbitrary request headers). We append
 * the telemetry-scoped JWT as ``?token=...`` query param — the telemetry
 * WS endpoint validates it the same way as the HTTP middleware.
 */

import type { GpsPoint } from './gpsSyncStorage';
import { TELEMETRY_URL } from './gpsTelemetryUrl';

export interface IngestAckResult {
  acked: boolean;
  inserted: number;
  queued?: boolean;
  deduped?: boolean;
}

function parseWsAck(data: unknown, sentCount: number): IngestAckResult {
  if (!data || typeof data !== 'object') return { acked: false, inserted: 0 };
  const body = data as Record<string, unknown>;
  if (body.acked === true) {
    return {
      acked: true,
      inserted: typeof body.inserted === 'number' ? body.inserted : sentCount,
      queued: body.queued === true,
    };
  }
  return { acked: false, inserted: 0 };
}

export const WS_INGEST_ENABLED =
  process.env.EXPO_PUBLIC_TELEMETRY_WS_INGEST === '1' ||
  process.env.EXPO_PUBLIC_TELEMETRY_WS_INGEST === 'true';

function telemetryWsUrl(token?: string): string {
  const base = TELEMETRY_URL.replace(/\/$/, '');
  const wsBase = base.replace(/^https:/i, 'wss:').replace(/^http:/i, 'ws:');
  if (!token) return `${wsBase}/ws/telemetry/ingest`;
  return `${wsBase}/ws/telemetry/ingest?token=${encodeURIComponent(token)}`;
}

type WsAckMessage = {
  type?: string;
  inserted?: number;
  queued?: boolean;
  last_acked_seq?: number | null;
  status?: number;
  detail?: unknown;
  retry_after?: string;
};

/** Send one batch over WS with resume cursor; returns null if WS lane disabled or failed. */
export async function postTelemetryBatchViaWs(
  points: GpsPoint[],
  lastAckedSeq: number | null,
  token?: string,
): Promise<IngestAckResult | null> {
  if (!WS_INGEST_ENABLED || points.length === 0) return null;

  return new Promise((resolve) => {
    let settled = false;
    const finish = (value: IngestAckResult | null) => {
      if (settled) return;
      settled = true;
      try {
        ws.close();
      } catch {
        /* ignore */
      }
      resolve(value);
    };

    const ws = new WebSocket(telemetryWsUrl(token));
    const timeout = setTimeout(() => finish(null), 15_000);

    ws.onopen = () => {
      if (lastAckedSeq != null) {
        ws.send(JSON.stringify({ type: 'resume', last_acked_seq: lastAckedSeq }));
      }
      ws.send(JSON.stringify(points));
    };

    ws.onmessage = (ev) => {
      let data: WsAckMessage;
      try {
        data = JSON.parse(String(ev.data)) as WsAckMessage;
      } catch {
        return;
      }
      if (data.type === 'resume_ack' || data.type === 'pong') return;
      if (data.type === 'error') {
        clearTimeout(timeout);
        finish({ acked: false, inserted: 0 });
        return;
      }
      if (data.type === 'ack') {
        clearTimeout(timeout);
        const ack = parseWsAck(
          {
            acked: true,
            inserted: data.inserted ?? points.length,
            queued: data.queued,
          },
          points.length,
        );
        finish(ack);
      }
    };

    ws.onerror = () => {
      clearTimeout(timeout);
      finish(null);
    };

    ws.onclose = () => {
      clearTimeout(timeout);
      if (!settled) finish(null);
    };
  });
}
