import { test, expect } from '@playwright/test';

test.use({ storageState: undefined });

test('CATI landing page loads successfully', async ({ page }) => {
    await page.goto('/', {
        waitUntil: 'domcontentloaded',
        timeout: 30_000
    });

    await expect(page).toHaveTitle(/CATI/i);
});