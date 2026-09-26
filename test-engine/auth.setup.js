import { test as setup, expect } from '@playwright/test';
import path from 'path';

setup.setTimeout(60_000);

const authFile = path.join(
    process.cwd(),
    'playwright',
    '.auth',
    'user.json'
);

setup('authenticate', async ({ page }) => {
    await page.goto('/auth/login', {
        waitUntil: 'domcontentloaded',
        timeout: 60_000
    });

    await page
        .getByRole('textbox', { name: 'you@example.com' })
        .fill(process.env.TEST_EMAIL);

    await page
        .getByRole('textbox', { name: 'Enter password' })
        .fill(process.env.TEST_PASSWORD);

    await page
        .getByRole('button', { name: 'Sign in' })
        .click();

    await expect(page).toHaveURL(/\/dashboard/, {
        timeout: 30_000
    });

    await page.context().storageState({
        path: authFile
    });
});