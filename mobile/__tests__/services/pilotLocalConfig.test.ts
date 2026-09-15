import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const { build } = JSON.parse(
  readFileSync(resolve(__dirname, '../../eas.json'), 'utf8'),
);

describe('pilot-local build configuration', () => {
  test('uses an independent internal development profile', () => {
    expect(build['pilot-local']).toMatchObject({
      node: '22.13.0',
      developmentClient: true,
      distribution: 'internal',
      channel: 'pilot-local',
    });
    expect(build['pilot-local']).not.toHaveProperty('extends');
  });

  test('targets only the two ADB reverse service endpoints', () => {
    expect(build['pilot-local'].env.EXPO_PUBLIC_API_URL).toBe('http://localhost:8000');
    expect(build['pilot-local'].env.EXPO_PUBLIC_TELEMETRY_URL).toBe('http://localhost:8001');
  });

  test('explicitly disables the optional WS lane and requests Firebase off', () => {
    // This checks declared intent; Firebase consumers do not yet honor the flag.
    expect(build['pilot-local'].env.EXPO_PUBLIC_TELEMETRY_WS_INGEST).toBe('false');
    expect(build['pilot-local'].env.EXPO_PUBLIC_ENABLE_FIREBASE).toBe('false');
  });
});
