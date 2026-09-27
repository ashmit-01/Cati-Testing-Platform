import { expect } from '@playwright/test';

export async function login(page) {
    await page.goto('/auth/login', {
        waitUntil: 'domcontentloaded',
        timeout: 30_000
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

    await page.waitForTimeout(2000);

    console.log('After login URL:', page.url());

    if (page.url().includes('/onboarding')) {
        const skipButton = page.getByRole('button', { name: 'Skip' });

        if (await skipButton.isVisible().catch(() => false)) {
            await skipButton.click();
        }
    }

    await expect(page).toHaveURL(/\/dashboard/, {
        timeout: 30_000
    });
}