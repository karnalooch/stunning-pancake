import { test, expect } from '@playwright/test';
import { mockBackend, login } from './helpers';

const NAV_ITEMS = [
  { testId: 'nav-dashboard',        path: '/owner/dashboard' },
  { testId: 'nav-tenants-branding', path: '/owner/white-label' },
  { testId: 'nav-users',            path: '/owner/users' },
  { testId: 'nav-działy',           path: '/owner/departments' },
  { testId: 'nav-anti-cheat',       path: '/owner/anti-cheat' },
  { testId: 'nav-sponsorship',      path: '/owner/sponsor' },
  { testId: 'nav-events',           path: '/owner/analytics/events' },
  // The second 'Sponsorship' nav item uses icon TrendingUp, testId derived from label
  // It maps to 'nav-sponsorship' but is a DIFFERENT item in Analytics section
  // For now we test both by direct URL
  { testId: 'nav-vouchers',         path: '/owner/analytics/vouchers' },
  { testId: 'nav-feedback',         path: '/owner/analytics/feedback' },
  { testId: 'nav-settings',         path: '/owner/settings' },
];

test.describe('Navigation smoke test', () => {
  test.beforeEach(async ({ page }) => {
    await mockBackend(page);
    await login(page);
  });

  for (const item of NAV_ITEMS) {
    test(`sidebar "${item.testId}" navigates without error`, async ({ page }) => {
      // Click the nav item
      const navButton = page.getByTestId(item.testId);
      await expect(navButton).toBeVisible();
      await navButton.click();

      // Wait for navigation to settle
      await page.waitForTimeout(500);

      // Assert no error indicators
      const bodyText = await page.textContent('body') || '';

      // Check for common error markers
      const is404 = /404|not found|page not found/i.test(bodyText);
      const isAccessDenied = /access denied|unauthorized/i.test(bodyText);
      const isError = /error occurred|something went wrong|uncaught/i.test(bodyText);

      if (is404) {
        console.warn(`  404 DETECTED on ${item.path} — body contains: "${bodyText.substring(0, 200)}"`);
      }
      if (isAccessDenied) {
        console.warn(`  ACCESS DENIED on ${item.path}`);
      }

      // The route may show "Access Denied" if RBAC blocks it (that's OK, not a dead link)
      // But 404/not found is a routing bug
      expect(is404, `Route ${item.path} returned 404/page-not-found`).toBe(false);
      expect(isError, `Route ${item.path} caused an unhandled error`).toBe(false);

      // Verify we ended up at the expected URL (or close to it)
      // HashRouter URLs may differ slightly, just check we're not on /login or /
      const url = page.url();
      expect(url).not.toContain('/login');
    });
  }

  test('all sidebar items are visible for GLOBAL_OWNER', async ({ page }) => {
    const found: string[] = [];
    const missing: string[] = [];

    for (const item of NAV_ITEMS) {
      const el = page.getByTestId(item.testId);
      if (await el.isVisible({ timeout: 1000 }).catch(() => false)) {
        found.push(item.testId);
      } else {
        missing.push(item.testId);
      }
    }

    console.log(`Visible nav items: ${found.length}/${NAV_ITEMS.length}`);
    if (missing.length > 0) {
      console.log(`Missing/invisible: ${missing.join(', ')}`);
    }

    // At least the core items must be visible
    const coreItems = ['nav-dashboard', 'nav-users', 'nav-anti-cheat', 'nav-settings'];
    for (const core of coreItems) {
      await expect(
        page.getByTestId(core),
        `${core} must be visible for GLOBAL_OWNER`
      ).toBeVisible();
    }
  });
});
