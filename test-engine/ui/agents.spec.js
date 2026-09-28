import { test, expect } from '../fixtures/evidence.js';

test.setTimeout(60_000);

test.describe('Agents - UI', () => {

    test('Agents page loads successfully', async ({ page }) => {

        await page.goto('/agents', {
            waitUntil: 'domcontentloaded',
            timeout: 30_000
        });

        await expect(page).toHaveURL(/\/agents/, {
            timeout: 10_000
        });

        await expect(
            page.getByRole('button', {
                name: 'Create Agent'
            })
        ).toBeVisible({
            timeout: 15_000
        });
    });


    test('Create Agent requires company name before selecting template', async ({ page }) => {

        await page.goto('/agents', {
            waitUntil: 'domcontentloaded',
            timeout: 30_000
        });

        await expect(page).toHaveURL(/\/agents/, {
            timeout: 10_000
        });

        await page
            .getByRole('button', {
                name: 'Create Agent'
            })
            .click();

        await expect(
            page.getByRole('heading', {
                name: 'Create AI Agent'
            })
        ).toBeVisible({
            timeout: 15_000
        });


        // Open prebuilt agents
        await page
            .getByRole('button', {
                name: /Use Prebuilt Agent/i
            })
            .click();


        // Select the first template without entering company name
        const templateButton = page
            .getByText('Use this template →')
            .first();

        await expect(templateButton).toBeVisible({
            timeout: 15_000
        });

        await templateButton.click();


        // Verify validation message
        await expect(
            page.getByText(
                /Please enter company name before selecting template/i
            )
        ).toBeVisible({
            timeout: 15_000
        });
    });


    test('Create AI Receptionist agent from prebuilt template', async ({ page }) => {

        await page.goto('/agents', {
            waitUntil: 'domcontentloaded',
            timeout: 30_000
        });

        await expect(page).toHaveURL(/\/agents/, {
            timeout: 10_000
        });


        // Open Create Agent
        await page
            .getByRole('button', {
                name: 'Create Agent'
            })
            .click();


        await expect(
            page.getByRole('heading', {
                name: 'Create AI Agent'
            })
        ).toBeVisible({
            timeout: 15_000
        });


        // Enter company name
        await page
            .getByRole('textbox', {
                name: 'Your company name'
            })
            .fill('QA Test Company');


        // Open prebuilt agents
        await page
            .getByRole('button', {
                name: /Use Prebuilt Agent/i
            })
            .click();


        // Select template
        const templateButton = page
            .getByText('Use this template →')
            .first();

        await expect(templateButton).toBeVisible({
            timeout: 15_000
        });

        await templateButton.click();


        // Verify agent configuration page
        await expect(page).toHaveURL(
            /\/agents\/[^/]+\/configure/,
            {
                timeout: 15_000
            }
        );


        // Verify draft was created
        await expect(
            page.getByText(/Agent draft created/i)
        ).toBeVisible({
            timeout: 15_000
        });
    });

});