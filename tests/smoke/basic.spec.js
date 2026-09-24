import { test, expect } from '@playwright/test';

test('QA platform smoke test - CATI frontend is reachable', async ({ page }) => {
  const url = process.env.FRONTEND_URL;

  test.skip(!url, 'Set FRONTEND_URL in .env before running CATI smoke tests.');

  const response = await page.goto(url, { waitUntil: 'domcontentloaded' });

  expect(response).not.toBeNull();
  expect(response.status()).toBeLessThan(500);
});
