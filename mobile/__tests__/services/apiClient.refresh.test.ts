import axios from 'axios';
import { API_PATHS_FULL } from '@4velo/api-client';
import { authTokenStorage } from '../../src/services/authTokenStorage';

const mockGet = jest.fn();
const mockPost = jest.fn();
const mockRequest = jest.fn();

jest.mock('axios', () => {
  const actual = jest.requireActual('axios');
  const instance = {
    get: (...args: unknown[]) => mockGet(...args),
    post: (...args: unknown[]) => mockPost(...args),
    request: (...args: unknown[]) => mockRequest(...args),
    defaults: { headers: { common: {} as Record<string, string> } },
    interceptors: {
      request: { use: jest.fn() },
      response: { use: jest.fn((ok, err) => { (instance as any)._errorHandler = err; }) },
    },
  };
  return {
    ...actual,
    create: () => instance,
    post: (...args: unknown[]) => mockPost(...args),
  };
});

jest.mock('../../src/services/FirebaseService', () => ({
  firebaseCapture: jest.fn(),
}));

describe('apiClient refresh helpers', () => {
  beforeEach(() => {
    jest.resetModules();
    authTokenStorage.__resetForTests();
    mockGet.mockReset();
    mockPost.mockReset();
    mockRequest.mockReset();
  });

  test('authTokenStorage integrates with refresh payload contract', async () => {
    await authTokenStorage.setTokens('old', 'refresh-token');
    mockPost.mockResolvedValueOnce({ data: { access: 'new-access-token' } });

    const refresh = await authTokenStorage.getRefreshToken();
    const res = await axios.post(`${API_PATHS_FULL.authTokenRefresh}`, { refresh });
    await authTokenStorage.setTokens(res.data.access, refresh);

    await expect(authTokenStorage.getAccessToken()).resolves.toBe('new-access-token');
    expect(mockPost).toHaveBeenCalledWith(API_PATHS_FULL.authTokenRefresh, {
      refresh: 'refresh-token',
    });
  });
});
