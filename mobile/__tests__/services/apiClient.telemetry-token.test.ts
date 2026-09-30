/**
 * Tests for the authenticated activity-scoped telemetry JWT bootstrap.
 *
 * The helper must use the normal Django API client so the current access token
 * and the existing 401 refresh/session-expiry interceptor apply to token
 * issuance. On failure it returns null and the GPS outbox retains the batch.
 */

import {
  api,
  getTelemetryIngestToken,
  setAuthToken,
} from '../../src/services/apiClient';

jest.mock('../../src/services/FirebaseService', () => ({
  firebaseCapture: jest.fn(),
}));

describe('getTelemetryIngestToken', () => {
  const postSpy = jest.spyOn(api, 'post');

  beforeEach(() => {
    postSpy.mockReset();
    setAuthToken('django-access-token');
  });

  afterEach(() => {
    setAuthToken(null);
  });

  afterAll(() => {
    postSpy.mockRestore();
  });

  test('uses the authenticated Django API client and SSOT telemetry-token path', async () => {
    postSpy.mockResolvedValue({
      data: {
        token: 'aud-telemetry.jwt.body',
        expires_at: '2026-09-16T12:30:00Z',
        audience: 'telemetry',
        activity_id: 42,
      },
    });

    const result = await getTelemetryIngestToken(42);

    expect(api.defaults.headers.common.Authorization).toBe(
      'Bearer django-access-token',
    );
    expect(result).toEqual({
      token: 'aud-telemetry.jwt.body',
      expiresAt: '2026-09-16T12:30:00Z',
      audience: 'telemetry',
      activityId: 42,
    });

    expect(postSpy).toHaveBeenCalledTimes(1);
    const call = postSpy.mock.calls[0];
    expect(call).toBeDefined();
    const [url, body, config] = call!;
    expect(url).toMatch(/\/api\/activities\/sessions\/42\/telemetry-token\/$/);
    expect(body).toBeUndefined();
    expect(config).toMatchObject({ timeout: 10_000 });
  });

  test('returns null when response body is missing the audience claim', async () => {
    postSpy.mockResolvedValue({
      data: {
        token: 'wrong-aud.jwt',
        expires_at: '2026-09-16T12:30:00Z',
        audience: 'django-api',
        activity_id: 1,
      },
    });

    await expect(getTelemetryIngestToken(1)).resolves.toBeNull();
  });

  test('returns null when response body has no token', async () => {
    postSpy.mockResolvedValue({
      data: { audience: 'telemetry', activity_id: 1 },
    });

    await expect(getTelemetryIngestToken(1)).resolves.toBeNull();
  });

  test('returns null when the authenticated endpoint rejects', async () => {
    postSpy.mockRejectedValue(new Error('Network Error'));

    await expect(getTelemetryIngestToken(7)).resolves.toBeNull();
  });

  test('returns null on non-2xx HTTP responses', async () => {
    postSpy.mockRejectedValue({
      isAxiosError: true,
      response: { status: 401 },
    });

    await expect(getTelemetryIngestToken(99)).resolves.toBeNull();
  });
});
