import { test, expect } from '@playwright/test';

const openBulkCalling = async (page) => {
    await page.goto('/campaigns', {
        waitUntil: 'domcontentloaded',
        timeout: 30_000
    });

    await expect(page).toHaveURL(/\/campaigns/, {
        timeout: 10_000
    });
};

const openCampaignSetup = async (page) => {
    await openBulkCalling(page);

    const createCampaignButton = page.getByRole('button', {
        name: /Create Campaign/i
    });

    await expect(createCampaignButton).toBeVisible({
        timeout: 10_000
    });

    await expect(createCampaignButton).toBeEnabled();

    await createCampaignButton.click();

    await expect(
        page.getByText('Campaign Setup', {
            exact: true
        })
    ).toBeVisible({
        timeout: 10_000
    });
};


test.describe('Bulk Calling - UI', () => {

    test('Bulk Calling page loads successfully', async ({ page }) => {
        await openBulkCalling(page);

        await expect(
            page.getByRole('button', {
                name: /Create Campaign/i
            })
        ).toBeVisible({
            timeout: 10_000
        });

        await expect(
            page.getByText('Your Campaigns', {
                exact: true
            })
        ).toBeVisible({
            timeout: 10_000
        });
    });


    test('Bulk Calling campaign list is displayed', async ({ page }) => {
        await openBulkCalling(page);

        await expect(
            page.getByText('Your Campaigns', {
                exact: true
            })
        ).toBeVisible({
            timeout: 10_000
        });
    });


    test('Create Campaign opens Campaign Setup', async ({ page }) => {
        await openCampaignSetup(page);

        await expect(
            page.getByText('Contacts Preview', {
                exact: true
            })
        ).toBeVisible({
            timeout: 10_000
        });

        await expect(
            page.getByRole('button', {
                name: /Back to Campaigns/i
            })
        ).toBeVisible({
            timeout: 10_000
        });
    });


    test('Campaign Setup displays required fields', async ({ page }) => {
        await openCampaignSetup(page);

        await expect(
            page.getByPlaceholder('e.g. March Lead Outreach')
        ).toBeVisible({
            timeout: 10_000
        });

        await expect(
            page.getByText(/^Agent\s*\*?$/i).first()
        ).toBeVisible({
            timeout: 10_000
        });

        const uploadTab = page.getByText(
            /Upload\s+Excel\s*\/\s*CSV/i
        ).first();

        await expect(uploadTab).toBeVisible({
            timeout: 10_000
        });

        await expect(
            page.getByText(
                /Copy-Paste Numbers\s*\(Max 50\)/i
            ).first()
        ).toBeVisible({
            timeout: 10_000
        });
    });


    test('Campaign cannot be started when there are zero contacts', async ({ page }) => {
        await openCampaignSetup(page);

        const startCampaignButton = page.getByRole('button', {
            name: /Start Campaign \(0 contacts\)/i
        });

        await expect(startCampaignButton).toBeVisible({
            timeout: 10_000
        });

        await expect(startCampaignButton).toBeDisabled();
    });


    test('Campaign Setup allows entering a campaign name', async ({ page }) => {
        await openCampaignSetup(page);

        const campaignName = page.getByPlaceholder(
            'e.g. March Lead Outreach'
        );

        await expect(campaignName).toBeVisible({
            timeout: 10_000
        });

        await campaignName.fill('QA UI Test Campaign');

        await expect(campaignName).toHaveValue(
            'QA UI Test Campaign'
        );
    });

});