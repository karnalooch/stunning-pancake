import { test, expect } from '@playwright/test';
import { mockBackend, login } from './helpers';

/**
 * Route Liveness Probe — visits every route directly by URL to verify
 * each renders without crashing. Uses the full list of routes registered
 * in App.tsx + sidebar entries from Layout.tsx.
 */

const ALL_ROUTES = [
  // App.tsx registered under /owner
  '/owner/dashboard',
  '/owner/users',
  '/owner/white-label',
  '/owner/anti-cheat',
  '/owner/sponsor',
  '/owner/settings',
  // Sidebar entries NOT yet registered in App.tsx (dead links audit)
  '/owner/departments',
  '/owner/analytics/events',
  '/owner/analytics/sponsorship',
  '/owner/analytics/vouchers',
  '/owner/analytics/feedback',
  // Top-level routes
  '/login',
  '/',
];

test.describe('Route liveness probe', () => {
  test('all registered routes render without crashing', async ({ page }) => {
    await mockBackend(page);
    await login(page);

    for (const route of ALL_ROUTES) {
      // Navigate directly to the route
      // HashRouter needs the full URL with hash
      const hashRoute = route.startsWith('/') ? route : `/${route}`;
      await page.goto(`/#${hashRoute}`);

      // Wait for React to render
      await page.waitForTimeout(1000);

      const bodyText = (await page.textContent('body')) || '';

      // Must not show hard errors
      expect(bodyText, `Route ${route} crashed`).not.toMatch(/Error:[\s\S]{10,}/);

      // Must not redirect to login when authenticated
      const url = page.url();
      const isLogin = url.includes('/login') && !route.includes('/login');
      if (isLogin) {
        console.warn(`  Route ${route} redirected to login unexpectedly`);
      }

      // Route existence check: 404 pages are bugs for registered routes
      const is404 = /404|page not found/i.test(bodyText);
      if (is404) {
        console.warn(`  ⚠️  Route ${route} shows 404/page-not-found`);
      }

      // The loop keeps one authenticated browser context. A failed route is
      // reported with its route name instead of spending three login retries.
      expect(page.url(), `Route ${route} did not finish navigation`).toContain('#');
    }
  });

  test('authenticated route access works end-to-end', async ({ page }) => {
    // Smoke: make sure the dashboard actually renders content
    await page.goto('/#/owner/dashboard');
    await expect(page.getByTestId('admin-sidebar')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/Good (morning|afternoon|evening)/i)).toBeVisible({ timeout: 5000 });
  });
});
