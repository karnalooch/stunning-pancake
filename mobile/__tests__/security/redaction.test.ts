import {
  REDACTED,
  redactConsoleArgs,
  redactError,
  redactString,
  redactValue,
} from '../../src/security/redaction';

describe('T71 mobile log redaction', () => {
  it('removes token, identity and GPS canaries from free-form text', () => {
    const value =
      'authorization=Bearer mobile-token email=rider@example.invalid ' +
      'lat=52.167123 lon=22.290456 coordinates=[52.1, 22.2] ' +
      'route_path=[[52.3, 22.4], [52.5, 22.6]]';

    const redacted = redactString(value);

    for (const canary of [
      'mobile-token',
      'rider@example.invalid',
      '52.167123',
      '22.290456',
      '52.1',
      '22.2',
      '52.3',
      '22.4',
      '52.5',
      '22.6',
    ]) {
      expect(redacted).not.toContain(canary);
    }
    expect(redacted).toContain(REDACTED);
  });

  it('redacts sensitive structured fields while preserving safe metrics', () => {
    const redacted = redactValue({
      request: {
        authorization: 'Bearer structured-token',
        user_id: 99123,
      },
      telemetry: {
        coordinates: [52.167123, 22.290456],
        speed: 9.4,
      },
    }) as Record<string, Record<string, unknown>>;

    expect(redacted.request.authorization).toBe(REDACTED);
    expect(redacted.request.user_id).toBe(REDACTED);
    expect(redacted.telemetry.coordinates).toBe(REDACTED);
    expect(redacted.telemetry.speed).toBe(9.4);
  });

  it('redacts errors before they are passed to Crashlytics or console', () => {
    const safe = redactError(
      new Error('token=error-token lat=52.167123 email=rider@example.invalid'),
    );

    expect(safe.message).not.toContain('error-token');
    expect(safe.message).not.toContain('52.167123');
    expect(safe.message).not.toContain('rider@example.invalid');
    expect(safe.message).toContain(REDACTED);
  });

  it('redacts every argument passed through the console bootstrap', () => {
    const [message, payload] = redactConsoleArgs([
      'authorization=Bearer console-token',
      { coordinates: [52.1, 22.2], email: 'console@example.invalid', safe: 7 },
    ]);

    expect(String(message)).not.toContain('console-token');
    expect(payload).toEqual({ coordinates: REDACTED, email: REDACTED, safe: 7 });
  });
});
