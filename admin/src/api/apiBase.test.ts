import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolveApiBaseUrl, resolveApiDocsUrl } from './apiBase';

describe('resolveApiBaseUrl', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('appends /api when VITE_API_URL omits suffix', () => {
    vi.stubEnv('VITE_API_URL', 'https://backend-production-55c7.up.railway.app');
    expect(resolveApiBaseUrl()).toBe('https://backend-production-55c7.up.railway.app/api');
    expect(resolveApiDocsUrl()).toBe('https://backend-production-55c7.up.railway.app/api/docs/');
  });

  it('preserves trailing /api when already present', () => {
    vi.stubEnv('VITE_API_URL', 'https://example.com/api/');
    expect(resolveApiBaseUrl()).toBe('https://example.com/api');
  });
});
