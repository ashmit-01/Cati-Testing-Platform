import { test, expect } from '@playwright/test';

const openPhoneNumbers = async (page) => {
    await page.goto('/settings?tab=phone-numbers', {
        waitUntil: 'domcontentloaded',
        timeout: 30_000
    });

    await expect(page).toHaveURL(/\/settings\?tab=phone-numbers/, {
        timeout: 10_000
    });
};

test.describe('Phone Numbers - UI', () => {

    test('Phone Numbers page loads successfully', async ({ page }) => {
        await openPhoneNumbers(page);

        await expect(
            page.getByRole('heading', {
                name: 'Settings',
                exact: true
            })
        ).toBeVisible({
            timeout: 10_000
        });

        await expect(
            page.getByRole('heading', {
                name: 'Phone Numbers',
                exact: true
            })
        ).toBeVisible({
            timeout: 10_000
        });
    });


    test('Phone Numbers tab is active', async ({ page }) => {
        await openPhoneNumbers(page);

        await expect(
            page.getByText('Phone Numbers', {
                exact: true
            }).first()
        ).toBeVisible({
            timeout: 10_000
        });

        await expect(
            page.getByText(
                'Manage purchased phone numbers and assign them to agents',
                { exact: true }
            )
        ).toBeVisible({
            timeout: 10_000
        });
    });


    test('Empty phone number state is displayed', async ({ page }) => {
        await openPhoneNumbers(page);

        await expect(
            page.getByText('No phone numbers yet', {
                exact: true
            })
        ).toBeVisible({
            timeout: 10_000
        });

        await expect(
            page.getByText(
                'Purchase a phone number to start receiving calls',
                { exact: true }
            )
        ).toBeVisible({
            timeout: 10_000
        });
    });


    test('Buy Phone Number action is available', async ({ page }) => {
        await openPhoneNumbers(page);

        const buyButton = page.getByRole('button', {
            name: /Buy Phone Number/i
        }).first();

        await expect(buyButton).toBeVisible({
            timeout: 10_000
        });

        await expect(buyButton).toBeEnabled();
    });


    test('First phone number call-to-action is displayed', async ({ page }) => {
        await openPhoneNumbers(page);

        const firstPhoneButton = page.getByRole('button', {
            name: /Buy Your First Phone Number/i
        });

        await expect(firstPhoneButton).toBeVisible({
            timeout: 10_000
        });

        await expect(firstPhoneButton).toBeEnabled();
    });


    test('Phone Numbers page remains accessible after reload', async ({ page }) => {
        await openPhoneNumbers(page);

        await page.reload({
            waitUntil: 'domcontentloaded',
            timeout: 30_000
        });

        await expect(page).toHaveURL(/\/settings\?tab=phone-numbers/, {
            timeout: 10_000
        });

        await expect(
            page.getByRole('heading', {
                name: 'Phone Numbers',
                exact: true
            })
        ).toBeVisible({
            timeout: 10_000
        });

        await expect(
            page.getByText('No phone numbers yet', {
                exact: true
            })
        ).toBeVisible({
            timeout: 10_000
        });
    });

});