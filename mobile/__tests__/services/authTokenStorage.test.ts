import { authTokenStorage } from '../../src/services/authTokenStorage';

describe('authTokenStorage', () => {
  beforeEach(() => {
    authTokenStorage.__resetForTests();
  });

  test('stores and retrieves access/refresh tokens', async () => {
    await authTokenStorage.setTokens('access-1', 'refresh-1');
    await expect(authTokenStorage.getAccessToken()).resolves.toBe('access-1');
    await expect(authTokenStorage.getRefreshToken()).resolves.toBe('refresh-1');
  });

  test('clearTokens removes both keys', async () => {
    await authTokenStorage.setTokens('access-1', 'refresh-1');
    await authTokenStorage.clearTokens();
    await expect(authTokenStorage.getAccessToken()).resolves.toBeNull();
    await expect(authTokenStorage.getRefreshToken()).resolves.toBeNull();
  });
});
