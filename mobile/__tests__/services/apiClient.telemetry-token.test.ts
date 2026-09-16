/**
 * Tests for the activity-scoped telemetry JWT helper.
 *
 * The helper posts to /api/activities/sessions/<id>/telemetry-token/ and
 * returns { token, expiresAt, audience, activityId }. On failure it returns
 * null so callers can fall back to skipping the batch (outbox retains).
 */

import { getTelemetryIngestToken } from '../../src/services/apiClient';

const mockPost = jest.fn();

jest.mock('axios', () => {
  const actual = jest.requireActual('axios');
  return {
    ...actual,
    post: (...args: unknown[]) => mockPost(...args),
  };
});

jest.mock('../../src/services/FirebaseService', () => ({
  firebaseCapture: jest.fn(),
}));

describe('getTelemetryIngestToken', () => {
  beforeEach(() => {
    mockPost.mockReset();
  });

  test('posts to the SSOT telemetry-token path and returns the body', async () => {
    mockPost.mockResolvedValue({
      data: {
        token: 'aud-telemetry.jwt.body',
        expires_at: '2026-09-16T12:30:00Z',
        audience: 'telemetry',
        activity_id: 42,
      },
    });

    const result = await getTelemetryIngestToken(42);

    expect(result).toEqual({
      token: 'aud-telemetry.jwt.body',
      expiresAt: '2026-09-16T12:30:00Z',
      audience: 'telemetry',
      activityId: 42,
    });

    expect(mockPost).toHaveBeenCalledTimes(1);
    const [url, body, config] = mockPost.mock.calls[0];
    expect(url).toMatch(/\/api\/activities\/sessions\/42\/telemetry-token\/$/);
    expect(body).toBeUndefined();
    expect(config.timeout).toBe(10_000);
  });

  test('returns null when response body is missing the audience claim', async () => {
    mockPost.mockResolvedValue({
      data: {
        token: 'wrong-aud.jwt',
        expires_at: '2026-09-16T12:30:00Z',
        audience: 'django-api',
        activity_id: 1,
      },
    });

    const result = await getTelemetryIngestToken(1);

    expect(result).toBeNull();
  });

  test('returns null when response body has no token', async () => {
    mockPost.mockResolvedValue({
      data: { audience: 'telemetry', activity_id: 1 },
    });

    const result = await getTelemetryIngestToken(1);

    expect(result).toBeNull();
  });

  test('returns null when the endpoint rejects', async () => {
    mockPost.mockRejectedValue(new Error('Network Error'));

    const result = await getTelemetryIngestToken(7);

    expect(result).toBeNull();
  });

  test('returns null on non-2xx HTTP responses', async () => {
    mockPost.mockRejectedValue({
      isAxiosError: true,
      response: { status: 401 },
    });

    const result = await getTelemetryIngestToken(99);

    expect(result).toBeNull();
  });
});
