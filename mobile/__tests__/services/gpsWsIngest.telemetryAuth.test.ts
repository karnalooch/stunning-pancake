import type { GpsPoint } from '../../src/services/gpsSyncStorage';

jest.mock('../../src/services/gpsTelemetryUrl', () => ({
  TELEMETRY_URL: 'https://telemetry.example',
}));

class FakeWebSocket {
  static instances: FakeWebSocket[] = [];

  readonly url: string;
  readonly sent: string[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: (() => void) | null = null;

  constructor(url: string) {
    this.url = url;
    FakeWebSocket.instances.push(this);
  }

  send(data: string): void {
    this.sent.push(data);
  }

  close(): void {
    // The production helper owns close semantics; the fake only records traffic.
  }
}

const point: GpsPoint = {
  device_id: 'device-1',
  user_id: 7,
  activity_id: 42,
  lat: 52.167,
  lon: 22.29,
  altitude_m: 150,
  speed_ms: 8.5,
  accuracy_m: 4,
  timestamp: 1_789_000_000_000,
  seq: 11,
  idempotency_key: '42:1789000000000:11',
};

describe('gpsWsIngest telemetry auth propagation', () => {
  const originalWebSocket = global.WebSocket;
  const originalFlag = process.env.EXPO_PUBLIC_TELEMETRY_WS_INGEST;

  beforeEach(() => {
    jest.resetModules();
    FakeWebSocket.instances = [];
    process.env.EXPO_PUBLIC_TELEMETRY_WS_INGEST = '1';
    global.WebSocket = FakeWebSocket as unknown as typeof WebSocket;
  });

  afterEach(() => {
    global.WebSocket = originalWebSocket;
    if (originalFlag === undefined) {
      delete process.env.EXPO_PUBLIC_TELEMETRY_WS_INGEST;
    } else {
      process.env.EXPO_PUBLIC_TELEMETRY_WS_INGEST = originalFlag;
    }
  });

  test('encodes the activity-scoped token in the WebSocket handshake URL', async () => {
    const { postTelemetryBatchViaWs } = require('../../src/services/gpsWsIngest') as typeof import('../../src/services/gpsWsIngest');

    const resultPromise = postTelemetryBatchViaWs(
      [point],
      10,
      'aud telemetry+/=token',
    );

    const ws = FakeWebSocket.instances[0];
    expect(ws).toBeDefined();
    expect(ws.url).toBe(
      'wss://telemetry.example/ws/telemetry/ingest?token=aud%20telemetry%2B%2F%3Dtoken',
    );

    ws.onopen?.();
    expect(ws.sent[0]).toBe(JSON.stringify({ type: 'resume', last_acked_seq: 10 }));
    expect(ws.sent[1]).toBe(JSON.stringify([point]));

    ws.onmessage?.({
      data: JSON.stringify({ type: 'ack', inserted: 1 }),
    });

    await expect(resultPromise).resolves.toEqual({
      acked: true,
      inserted: 1,
      queued: false,
    });
  });
});
