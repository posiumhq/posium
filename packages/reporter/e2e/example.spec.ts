import { test, expect } from '@playwright/test';

test.describe('Playwright Website Tests', () => {
  test('visit playwright home', async ({ page }) => {
    // Navigate to playwright website
    await page.goto('https://playwright.dev');

    // Take a screenshot
    //await page.screenshot({ path: 'playwright-home.png' });

    // Simple assertion to demonstrate test passing
    expect(true).toBeTruthy();
  });

  test('visit playwright docs', async ({ page }) => {
    // Navigate to playwright website
    await page.goto('https://playwright.dev/docs/intro');

    expect(true).toBeTruthy();
  });

  test('flaky test - passes on retry', async ({ page }, testInfo) => {
    // This test demonstrates retry handling
    // Fails on first attempt (retry 0), passes on second attempt (retry 1)
    await page.goto('https://playwright.dev');

    if (testInfo.retry === 0) {
      // First attempt - fail
      console.log('First attempt - intentionally failing');
      expect(1).toBe(2); // This will fail
    } else {
      // Retry attempt - pass
      console.log(`Retry attempt ${testInfo.retry} - passing`);
      expect(true).toBeTruthy();
    }
  });

  test('failing test - always fails', async ({ page }) => {
    // This test always fails to demonstrate error reporting
    await page.goto('https://playwright.dev');

    // Take multiple steps to show step tracking
    await page.click('a[href="/docs/intro"]');
    await page.waitForLoadState('networkidle');

    // Intentionally fail
    expect(1).toBe(2); // This will always fail
  });
});

