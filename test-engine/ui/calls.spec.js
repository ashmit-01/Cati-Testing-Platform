import { test, expect } from '@playwright/test';

test('Calls page loads successfully', async ({ page }) => {
    await page.goto('/calls', {
        waitUntil: 'domcontentloaded',
        timeout: 30_000
    });

    await expect(page).toHaveURL(/\/calls/);

    await expect(
        page.getByRole('heading', { name: 'Calls' })
    ).toBeVisible();

    await expect(
        page.getByText('Monitor past calls and schedule future callbacks')
    ).toBeVisible();
});

test('Call History shows empty state when there are no calls', async ({ page }) => {
    await page.goto('/calls');

    await expect(
        page.getByRole('button', { name: /Call History/i })
    ).toBeVisible();

    await expect(
        page.getByText('No calls yet. Make your first call to see it here.')
    ).toBeVisible();
});

test('Scheduled Calls shows empty state when there are no scheduled calls', async ({ page }) => {
    await page.goto('/calls');

    await page
        .getByRole('button', { name: /Scheduled Calls/i })
        .click();

    await expect(
        page.getByText(
            'No scheduled calls yet. Leads from IndiaMART or follow-ups will appear here.'
        )
    ).toBeVisible();
});

test('User can switch between Call History and Scheduled Calls', async ({ page }) => {
    await page.goto('/calls');

    await page
        .getByRole('button', { name: /Scheduled Calls/i })
        .click();

    await expect(
        page.getByText(/No scheduled calls yet/i)
    ).toBeVisible();

    await page
        .getByRole('button', { name: /Call History/i })
        .click();

    await expect(
        page.getByText(/No calls yet/i)
    ).toBeVisible();
});