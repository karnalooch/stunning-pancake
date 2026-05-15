import { test, expect, type Page } from '@playwright/test';

/**
 * Admin Panel E2E — critical paths
 *
 * Flow under test:
 *   1. Unauthenticated user is redirected to login page
 *   2. After successful login, the admin shell (sidebar) is visible
 *   3. Navigation links route to Users / Settings (and other modules)
 *
 * The backend is mocked at the network layer via `page.route` so these tests
 * can run without a real API. App uses HashRouter, so URLs use "#/...".
 */

const API_GLOB = '**/api/**';

async function mockBackend(page: Page) {
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

    // Default: empty success
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: [], results: [] }),
    });
  });
}

async function login(page: Page) {
  await page.goto('/');
  // HashRouter redirects to /login when unauthenticated
  await expect(page.getByText('4VELO Platform')).toBeVisible();
  await page.getByLabel('Email or Username').fill('admin');
  await page.getByLabel('Password', { exact: true }).fill('password');
  await page.getByRole('button', { name: 'Sign In' }).click();
  // Sidebar appears after successful login
  await expect(page.getByTestId('admin-sidebar')).toBeVisible();
}

test.describe('Authentication', () => {
  test('unauthenticated visit shows login page', async ({ page }) => {
    await mockBackend(page);
    await page.goto('/');
    await expect(page.getByText('4VELO Platform')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible();
  });

  test('successful login reveals admin shell', async ({ page }) => {
    await mockBackend(page);
    await login(page);
    await expect(page.getByTestId('admin-sidebar')).toBeVisible();
    await expect(page.getByText('4VELO').first()).toBeVisible();
  });
});

test.describe('Admin shell navigation', () => {
  test.beforeEach(async ({ page }) => {
    await mockBackend(page);
    await login(page);
  });

  test('sidebar shows expected nav items for GLOBAL_OWNER', async ({ page }) => {
    await expect(page.getByTestId('nav-dashboard')).toBeVisible();
    await expect(page.getByTestId('nav-users')).toBeVisible();
    await expect(page.getByTestId('nav-tenants-branding')).toBeVisible();
    await expect(page.getByTestId('nav-anti-cheat')).toBeVisible();
    await expect(page.getByTestId('nav-settings')).toBeVisible();
  });

  test('clicking Users navigates to /owner/users', async ({ page }) => {
    await page.getByTestId('nav-users').click();
    await expect(page).toHaveURL(/#\/owner\/users/);
  });

  test('clicking Settings navigates to /owner/settings', async ({ page }) => {
    await page.getByTestId('nav-settings').click();
    await expect(page).toHaveURL(/#\/owner\/settings/);
  });

  test('clicking Dashboard navigates to /owner/dashboard', async ({ page }) => {
    await page.getByTestId('nav-dashboard').click();
    await expect(page).toHaveURL(/#\/owner\/dashboard/);
  });
});
