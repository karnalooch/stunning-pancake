/** Resolve API base URL (always ends with /api, absolute when possible). */
export function resolveApiBaseUrl(): string {
  let baseURL = import.meta.env.VITE_API_URL || '';
  if (!baseURL) {
    if (
      typeof window !== 'undefined' &&
      (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ) {
      baseURL = 'http://localhost:8000/api';
    } else {
      baseURL = '/api';
    }
  }
  if (baseURL && !baseURL.endsWith('/api') && !baseURL.endsWith('/api/')) {
    baseURL = `${baseURL.replace(/\/$/, '')}/api`;
  }
  if (baseURL.startsWith('/') && typeof window !== 'undefined') {
    baseURL = `${window.location.protocol}//${window.location.host}${baseURL}`;
  }
  return baseURL.replace(/\/$/, '');
}

export function resolveApiDocsUrl(): string {
  return `${resolveApiBaseUrl()}/docs/`;
}
