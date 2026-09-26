import { test, expect } from '@playwright/test';

test.use({ storageState: undefined });

test('Login rejects invalid credentials', async ({ page }) => {
    await page.goto('/auth/login', {
        waitUntil: 'domcontentloaded',
        timeout: 30_000
    });

    await page.getByRole('textbox', { name: 'you@example.com' }).fill('invalid@mail.com');
    await page.getByRole('textbox', { name: 'Enter password' }).fill('Wrong');

    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(
        page.getByText(/invalid credential/i)
    ).toBeVisible({ timeout: 10_000 });
});

test('User can login successfully', async ({ page }) => {
    await page.goto('/auth/login', {
        waitUntil: 'domcontentloaded',
        timeout: 30_000
    });

    await page.getByRole('textbox', { name: 'you@example.com' }).fill(process.env.TEST_EMAIL);
    await page.getByRole('textbox', { name: 'Enter password' }).fill(process.env.TEST_PASSWORD);

    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(page).toHaveURL(/\/dashboard/, {
        timeout: 30_000
    });
});