import { e2eConfig } from '../bootstrap/e2eConfig';

export function isGpsBackgroundProofEnabled(): boolean {
  return __DEV__ && e2eConfig.gpsBackgroundProof;
}

export function logGpsBackgroundProof(
  event: 'STARTED' | 'POINT_ACCEPTED' | 'RESUMED',
  fields: Record<string, string | number | boolean>,
): void {
  if (!isGpsBackgroundProofEnabled()) return;
  const details = Object.entries(fields)
    .map(([key, value]) => `${key}=${String(value)}`)
    .join(' ');
  // eslint-disable-next-line no-console
  console.log(`[E2E GPS BG] ${event}${details ? ` ${details}` : ''}`);
}
