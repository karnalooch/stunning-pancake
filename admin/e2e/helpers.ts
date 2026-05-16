import { type Page } from '@playwright/test';

/**
 * Shared E2E helpers — mockBackend and login for all admin E2E tests.
 */

const API_GLOB = '**/api/**';

export async function mockBackend(page: Page) {
  await page.route(API_GLOB, async (route) => {
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
      body: JSON.stringify({ data: [], results: [], count: 0 }),
    });
  });
}

export async function login(page: Page) {
  await page.goto('/');
  // HashRouter redirects to /login when unauthenticated
  await page.waitForTimeout(500);
  const isOnLogin = page.url().includes('login') || (await page.getByRole('button', { name: 'Sign In' }).isVisible().catch(() => false));
  if (isOnLogin) {
    await page.getByLabel('Email or Username').fill('admin');
    await page.getByLabel('Password', { exact: true }).fill('password');
    await page.getByRole('button', { name: 'Sign In' }).click();
  }
  await page.waitForTimeout(500);
  await expect(page.getByTestId('admin-sidebar')).toBeVisible({ timeout: 5000 });
}
