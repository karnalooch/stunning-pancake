import { test, expect } from '@playwright/test';

/**
 * Critical path: Sidebar navigation
 *
 * Verifies that all 5 view modules are accessible via sidebar buttons
 * and that the main content area updates on click.
 */
test.describe('Sidebar Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('renders all navigation buttons', async ({ page }) => {
    await expect(page.locator('#nav-live')).toBeVisible();
    await expect(page.locator('#nav-events')).toBeVisible();
    await expect(page.locator('#nav-clubs')).toBeVisible();
    await expect(page.locator('#nav-anticheat')).toBeVisible();
    await expect(page.locator('#nav-analytics')).toBeVisible();
  });

  test('switches to Events view', async ({ page }) => {
    await page.click('#nav-events');
    await expect(page.locator('#create-event-button')).toBeVisible();
  });

  test('switches to Clubs view', async ({ page }) => {
    await page.click('#nav-clubs');
    await expect(page.locator('#create-club-button')).toBeVisible();
  });

  test('switches to Anti-Cheat view', async ({ page }) => {
    await page.click('#nav-anticheat');
    await expect(page.getByText('INTEGRITY SCORE')).toBeVisible();
  });

  test('switches to Analytics view', async ({ page }) => {
    await page.click('#nav-analytics');
    await expect(page.getByText('Aktywności / dzień (7d)')).toBeVisible();
  });
});

/**
 * Critical path: Live Tracking view
 */
test.describe('Live Tracking View', () => {
  test('renders map container', async ({ page }) => {
    await page.goto('/');
    // MapLibre canvas is present
    await expect(page.locator('.map-container')).toBeVisible();
  });

  test('shows LIVE indicator', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.live-indicator')).toBeVisible();
  });
});

/**
 * Critical path: Top bar
 */
test.describe('Top Bar', () => {
  test('shows admin search input', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#admin-global-search')).toBeVisible();
  });

  test('shows sidebar', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#admin-sidebar')).toBeVisible();
  });
});
