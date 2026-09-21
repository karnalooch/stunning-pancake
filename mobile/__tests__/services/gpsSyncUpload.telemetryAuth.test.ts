import type { GpsPoint } from '../../src/services/gpsSyncStorage';

const mockAxiosPost = jest.fn();
const mockGetTelemetryIngestToken = jest.fn();

jest.mock('axios', () => ({
  __esModule: true,
  default: {
    post: (...args: unknown[]) => mockAxiosPost(...args),
    isAxiosError: () => false,
  },
}));

jest.mock('../../src/services/apiClient', () => ({
  getTelemetryIngestToken: (...args: unknown[]) => mockGetTelemetryIngestToken(...args),
}));

jest.mock('../../src/services/gpsWsIngest', () => ({
  WS_INGEST_ENABLED: false,
  postTelemetryBatchViaWs: jest.fn(),
}));

jest.mock('../../src/services/gpsTelemetryUrl', () => ({
  TELEMETRY_URL: 'https://telemetry.example.test',
}));

jest.mock('../../src/services/FirebaseService', () => ({
  firebaseCapture: jest.fn(),
}));

jest.mock('../../src/services/gpsEncryptedStorage', () => ({
  getGpsStorage: () => null,
  initializeGpsStorage: jest.fn(),
  __setGpsStorageForTests: jest.fn(),
}));

jest.mock('../../src/services/performanceBudget', () => ({
  measureAsync: async (_name: string, fn: () => Promise<unknown>) => fn(),
}));

import { uploadPointsWithRetry } from '../../src/services/gpsSyncUpload';

const point = (activityId: number): GpsPoint => ({
  device_id: 'device-1',
  user_id: 7,
  activity_id: activityId,
  lat: 52.167,
  lon: 22.29,
  altitude_m: 150,
  speed_ms: 8.5,
  accuracy_m: 4,
  timestamp: 1_789_000_000_000,
  seq: 11,
  idempotency_key: `${activityId}:1789000000000:11`,
});

describe('gpsSyncUpload telemetry auth propagation', () => {
  beforeEach(() => {
    mockAxiosPost.mockReset();
    mockGetTelemetryIngestToken.mockReset();
  });

  test('sends the activity-scoped telemetry token as HTTP Bearer auth', async () => {
    mockGetTelemetryIngestToken.mockResolvedValue({
      token: 'aud-telemetry.jwt.body',
      expiresAt: '2026-09-18T12:30:00Z',
      audience: 'telemetry',
      activityId: 42,
    });
    mockAxiosPost.mockResolvedValue({
      data: {
        client_batch_id: 'batch-42',
        acked: true,
        inserted: 1,
        dropped_privacy: 0,
      },
    });

    await expect(uploadPointsWithRetry([point(42)], 'batch-42')).resolves.toMatchObject({
      acked: true,
      inserted: 1,
    });

    expect(mockGetTelemetryIngestToken).toHaveBeenCalledWith(42);
    expect(mockAxiosPost).toHaveBeenCalledTimes(1);

    const [url, body, config] = mockAxiosPost.mock.calls[0];
    expect(url).toMatch(/\/api\/telemetry\/ingest\/batch$/);
    expect(body).toMatchObject({
      client_batch_id: 'batch-42',
      point_count: 1,
      max_seq: 11,
      activity_id: 42,
    });
    expect(config).toMatchObject({
      headers: {
        Authorization: 'Bearer aud-telemetry.jwt.body',
      },
    });
  });

  test('fails closed without calling telemetry ingest when a scoped token cannot be issued', async () => {
    mockGetTelemetryIngestToken.mockResolvedValue(null);

    await expect(uploadPointsWithRetry([point(42)], 'batch-no-token')).resolves.toEqual({
      acked: false,
      inserted: 0,
    });

    expect(mockGetTelemetryIngestToken).toHaveBeenCalledWith(42);
    expect(mockAxiosPost).not.toHaveBeenCalled();
  });
});
