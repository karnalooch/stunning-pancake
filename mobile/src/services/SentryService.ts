/**
 * Sentry Initialization — SPORT Mobile App (v2.1 Gold Master)
 * ========================================================
 * Constitution §10.1: Privacy-by-Design — no PII to Sentry.
 */

import * as Sentry from '@sentry/react-native';

const DSN = process.env.SENTRY_DSN ?? '';
const ENV = process.env.SENTRY_ENVIRONMENT ?? 'development';
const RELEASE = '2.1.0';

let _initialized = false;

export function initSentry(): void {
  if (!DSN || _initialized) return;

  Sentry.init({
    dsn: DSN,
    environment: ENV,
    release: `sport-mobile@${RELEASE}`,
    tracesSampleRate: ENV === 'production' ? 0.1 : 1.0,

    beforeSend(event) {
      if (event.breadcrumbs) {
        const crumbs = event.breadcrumbs as any;
        if (crumbs.values) {
          crumbs.values = crumbs.values.filter(
            (b: any) => !b.message?.includes('GPS') && !b.message?.includes('lat='),
          );
        }
      }
      return event;
    },
  });

  _initialized = true;
  console.log(`[Sentry] Initialized for env=${ENV} (v2.1)`);
}

export function sentryCapture(err: unknown, context: string): void {
  if (!_initialized) return;
  const error = err instanceof Error ? err : new Error(String(err));
  Sentry.withScope((scope) => {
    scope.setTag('context', context);
    Sentry.captureException(error);
  });
}
