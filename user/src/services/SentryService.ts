/**
 * Sentry Initialization — SPORT Mobile App (Milestone 3)
 * ========================================================
 * Constitution §10.1: Privacy-by-Design — no PII to Sentry.
 *
 * Wire this at the top of App.tsx before any component mounts.
 *
 * Usage:
 *   import { initSentry, sentryCapture } from '@/services/SentryService';
 *   initSentry();
 */

import * as Sentry from '@sentry/react-native';

const DSN = process.env.SENTRY_DSN ?? '';
const ENV = process.env.SENTRY_ENVIRONMENT ?? 'development';
const RELEASE = process.env.APP_VERSION ?? '0.0.0';

let _initialized = false;

/**
 * Initialize Sentry SDK if DSN is configured.
 * Silently no-ops if DSN is empty (local dev without Sentry).
 */
export function initSentry(): void {
  if (!DSN || _initialized) return;

  Sentry.init({
    dsn: DSN,
    environment: ENV,
    release: `sport-mobile@${RELEASE}`,
    tracesSampleRate: ENV === 'production' ? 0.1 : 1.0,

    // Privacy-by-Design (Constitution §10.1)
    // GPS coordinates must NEVER reach Sentry.
    beforeSend(event) {
      // Strip any breadcrumbs that might contain GPS data
      if (event.breadcrumbs?.values) {
        event.breadcrumbs.values = event.breadcrumbs.values.filter(
          (b) => !b.message?.includes('GPS') && !b.message?.includes('lat='),
        );
      }
      return event;
    },

    integrations: [
      Sentry.reactNativeTracingIntegration(),
    ],
  });

  _initialized = true;
  console.log(`[Sentry] Initialized for env=${ENV}`);
}

/**
 * Captures an exception with optional context.
 * Safe to call before initSentry() — will no-op gracefully.
 *
 * @param err - Error object or any unknown thrown value.
 * @param context - String tag for the error source (e.g. 'GpsSyncManager').
 */
export function sentryCapture(err: unknown, context: string): void {
  if (!_initialized) return;
  const error = err instanceof Error ? err : new Error(String(err));
  Sentry.withScope((scope) => {
    scope.setTag('context', context);
    Sentry.captureException(error);
  });
}

/**
 * Adds a breadcrumb (non-GPS) for tracing user flows.
 */
export function sentryBreadcrumb(message: string, category: string): void {
  if (!_initialized) return;
  Sentry.addBreadcrumb({ message, category, level: 'info' });
}
