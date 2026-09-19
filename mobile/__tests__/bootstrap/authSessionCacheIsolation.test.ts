import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = readFileSync(
  resolve(__dirname, '../../src/bootstrap/useAuthSession.ts'),
  'utf8',
);

describe('auth session ride-cache isolation', () => {
  test('clears cached ride history whenever the user session is discarded', () => {
    expect(source).toContain("import { OfflineCacheService } from '../services/OfflineCacheService'");

    const clears = source.match(/OfflineCacheService\.clearHistory\(\)/g) ?? [];
    expect(clears.length).toBeGreaterThanOrEqual(3);

    const logoutStart = source.indexOf('const handleLogout');
    const logoutClear = source.indexOf('OfflineCacheService.clearHistory()', logoutStart);
    const logoutUserReset = source.indexOf('auth.user.set(null)', logoutStart);

    expect(logoutStart).toBeGreaterThanOrEqual(0);
    expect(logoutClear).toBeGreaterThan(logoutStart);
    expect(logoutClear).toBeLessThan(logoutUserReset);
  });
});
