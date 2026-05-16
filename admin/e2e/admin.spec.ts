import { test, expect } from '@playwright/test';
import { mockBackend, login } from './helpers';

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
