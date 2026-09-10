import { type Page, expect } from '@playwright/test';
import { mockLiveTelemetryBody } from './fixtures/liveMapTelemetry';

/**
 * Shared E2E helpers — mockBackend and login for all admin E2E tests.
 */

const API_GLOB = '**/api/**';
const TELEMETRY_LIVE_GLOB = '**/activities/telemetry/live/**';

/** Playwright session flag — read by E2EAuthBootstrap (no Vite env required). */
export async function seedPlaywrightE2e(page: Page) {
  await page.addInitScript(() => {
    sessionStorage.setItem('playwright-e2e', '1');
    sessionStorage.removeItem('live-map-layer-v');
  });
}

/** Exercise the real login screen even when the preview was built with VITE_E2E=1. */
export async function disablePlaywrightE2eAuth(page: Page) {
  await page.addInitScript(() => {
    sessionStorage.setItem('playwright-e2e', '0');
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
  });
}

function isApiRequest(url: string): boolean {
  try {
    const path = new URL(url).pathname;
    return path.startsWith('/api/');
  } catch {
    return false;
  }
}

export async function mockBackend(page: Page) {
  await page.route((url) => isApiRequest(url.toString()), async (route) => {
    const url = route.request().url();
    const method = route.request().method();

    if (url.includes('/auth/token/') && method === 'POST') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          access: 'test-access-token',
          refresh: 'test-refresh-token',
        }),
      });
    }

    if (url.includes('/users/profile/')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            id: 1,
            username: 'admin',
            role: 'GLOBAL_OWNER',
            tenant_id: null,
          },
        }),
      });
    }

    if (url.includes('/users/rbac/user-roles/my_roles/')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    }

    if (url.includes('/infra/health/')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'ok',
          backend: { status: 'ok', uptime_seconds: 3600 },
          postgresql: { status: 'ok', latency_ms: 2 },
          redis: { status: 'ok', mode: 'standalone', latency_ms: 1 },
          celery: { status: 'ok', workers: 1 },
          storage: { status: 'ok', usage_pct: 12 },
        }),
      });
    }

    // Dashboard stats
    if (url.includes('/activities/admin/stats/')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          total_users: 12847,
          total_activities: 48291,
          total_distance_km: 847.2,
          total_calories: 2400000,
          new_users_last_7d: 234,
          new_activities_last_7d: 1847,
          verified_total: 48164,
          verified_pct: 94.2,
          unverified_total: 127,
          per_tenant: [],
        }),
      });
    }

    // Default: empty success
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: {}, results: [], count: 0 }),
    });
  });
}

/** Live Map poll — positions + city_counts for zoom LOD screenshots. */
export async function mockLiveMapTelemetry(page: Page) {
  await page.route(TELEMETRY_LIVE_GLOB, async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    const method = route.request().method();

    if (path.includes('/telemetry/live/audit') && method === 'POST') {
      return route.fulfill({ status: 204, body: '' });
    }

    if (path.includes('/telemetry/live/aggregate')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          type: 'FeatureCollection',
          features: [],
          meta: { cells: 0, mode: 'hexbin', render_mode: 'clusters' },
        }),
      });
    }

    if (path.includes('/telemetry/live/stream')) {
      return route.fulfill({ status: 200, contentType: 'text/event-stream', body: '' });
    }

    const detail = url.searchParams.get('detail');
    const bbox = url.searchParams.get('bbox');
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockLiveTelemetryBody(detail, bbox)),
    });
  });
}

export async function mockBackendWithLiveMap(page: Page) {
  await mockBackend(page);
  await mockLiveMapTelemetry(page);
}

export async function login(page: Page) {
  await disablePlaywrightE2eAuth(page);
  await page.goto('/#/login');
  await page.getByLabel('Username or Email').fill('admin');
  await page.getByLabel('Password').fill('password');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByTestId('admin-sidebar')).toBeVisible({ timeout: 15000 });
}
