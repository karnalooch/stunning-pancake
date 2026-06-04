/** Shared telemetry service base URL (HTTP + WS). */

export const TELEMETRY_URL =
  process.env.EXPO_PUBLIC_TELEMETRY_URL ??
  'https://docker-telemetry-production-123c.up.railway.app';
