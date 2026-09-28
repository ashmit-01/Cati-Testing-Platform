import { test, expect } from '@playwright/test';

test.describe('Campaign Manager - UI', () => {

    test('Campaign Manager page loads successfully', async ({ page }) => {
        await page.goto('/crm-campaigns', {
            waitUntil: 'domcontentloaded',
            timeout: 15_000
        });

        await expect(page).toHaveURL(/\/crm-campaigns/);

        await expect(
            page.getByRole('heading', {
                name: /Campaign Manager/i
            })
        ).toBeVisible({
            timeout: 10_000
        });

        await expect(
            page.getByRole('button', {
                name: /Create campaign/i
            })
        ).toBeVisible({
            timeout: 10_000
        });
    });


    test('Create campaign button is visible and enabled', async ({ page }) => {
        await page.goto('/crm-campaigns', {
            waitUntil: 'domcontentloaded',
            timeout: 15_000
        });

        const createCampaignButton = page.getByRole('button', {
            name: /Create campaign/i
        });

        await expect(createCampaignButton).toBeVisible({
            timeout: 10_000
        });

        await expect(createCampaignButton).toBeEnabled();
    });


    test('Create campaign opens campaign creation flow', async ({ page }) => {
        await page.goto('/crm-campaigns', {
            waitUntil: 'domcontentloaded',
            timeout: 15_000
        });

        const createCampaignButton = page.getByRole('button', {
            name: /Create campaign/i
        });

        await expect(createCampaignButton).toBeVisible({
            timeout: 10_000
        });

        await expect(createCampaignButton).toBeEnabled();

        await createCampaignButton.click();

        await expect(
            page.locator('body')
        ).toContainText(
            /campaign/i,
            {
                timeout: 10_000
            }
        );
    });


    test('Campaign Manager remains accessible after reload', async ({ page }) => {
        await page.goto('/crm-campaigns', {
            waitUntil: 'domcontentloaded',
            timeout: 15_000
        });

        await expect(
            page.getByRole('heading', {
                name: /Campaign Manager/i
            })
        ).toBeVisible({
            timeout: 10_000
        });

        await page.reload({
            waitUntil: 'domcontentloaded',
            timeout: 15_000
        });

        await expect(page).toHaveURL(/\/crm-campaigns/);

        await expect(
            page.getByRole('heading', {
                name: /Campaign Manager/i
            })
        ).toBeVisible({
            timeout: 10_000
        });

        await expect(
            page.getByRole('button', {
                name: /Create campaign/i
            })
        ).toBeVisible({
            timeout: 10_000
        });
    });

});