import { REDACTED, redactError, redactString, redactValue } from '../redaction';

describe('T71 mobile redaction', () => {
  it('removes token, identity and GPS canaries from strings', () => {
    const input = [
      'authorization=Bearer mobile-secret-token',
      'token=eyJabcdefghijk.abcdefghijkl.abcdefghijkl',
      'email=rider@example.invalid',
      'user_id=99123',
      'device_id=pilot-phone',
      'lat=52.167123',
      'lon=22.290456',
      'db=postgres://pilot:password@db:5432/fourvelo',
    ].join(' ');

    const output = redactString(input);

    for (const canary of [
      'mobile-secret-token',
      'eyJabcdefghijk.abcdefghijkl.abcdefghijkl',
      'rider@example.invalid',
      '99123',
      'pilot-phone',
      '52.167123',
      '22.290456',
      'pilot:password',
    ]) {
      expect(output).not.toContain(canary);
    }
    expect(output).toContain(REDACTED);
  });

  it('redacts nested analytics payloads without mutating safe values', () => {
    const input = {
      source: 'ride-summary',
      rider: {
        email: 'pilot@example.invalid',
        user_id: 44,
      },
      telemetry: {
        coordinates: [52.1, 22.2],
        speed_bucket: 'fast',
      },
    };

    expect(redactValue(input)).toEqual({
      source: 'ride-summary',
      rider: {
        email: REDACTED,
        user_id: REDACTED,
      },
      telemetry: {
        coordinates: REDACTED,
        speed_bucket: 'fast',
      },
    });
  });

  it('redacts Error message and stack before Crashlytics receives them', () => {
    const error = new Error('upload failed token=mobile-error-token lat=52.167123');
    error.stack = 'Error: rider@example.invalid lon=22.290456';

    const safe = redactError(error);

    expect(safe.message).not.toContain('mobile-error-token');
    expect(safe.message).not.toContain('52.167123');
    expect(safe.stack).not.toContain('rider@example.invalid');
    expect(safe.stack).not.toContain('22.290456');
    expect(`${safe.message} ${safe.stack}`).toContain(REDACTED);
  });

  it('fails closed on cyclic objects', () => {
    const input: Record<string, unknown> = { safe: 'value' };
    input.self = input;

    const output = redactValue(input) as Record<string, unknown>;

    expect(output.safe).toBe('value');
    expect(output.self).toBe(REDACTED);
  });
});
