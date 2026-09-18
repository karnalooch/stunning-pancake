import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

describe('repository Firebase platform artifact contract', () => {
  test.each([
    ['Android', 'google-services.json'],
    ['iOS', 'GoogleService-Info.plist'],
  ])('tracks the %s Google Services artifact (%s)', (_platform, filename) => {
    expect(existsSync(resolve(__dirname, '../..', filename))).toBe(true);
  });
});
