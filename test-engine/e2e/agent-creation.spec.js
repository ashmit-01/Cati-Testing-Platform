import { test, expect } from '@playwright/test';

const dismissWelcomeOverlay = async (page) => {
    const welcomeText = page.getByText(
        /Welcome! Let us set things up together/i
    );

    if (await welcomeText.isVisible({ timeout: 2_000 }).catch(() => false)) {
        const overlay = welcomeText.locator('..');

        const closeButton = overlay.getByRole('button').last();

        if (
            await closeButton.isVisible({ timeout: 1_000 }).catch(() => false)
        ) {
            await closeButton.click();
        } else {
            await page.keyboard.press('Escape');
        }

        await expect(welcomeText).not.toBeVisible({
            timeout: 5_000
        });
    }
};

test.describe('E2E - Agent Creation', () => {

    test('Create AI Receptionist agent from dashboard', async ({ page }) => {

        // 1. Open Dashboard
        await page.goto('/dashboard', {
            waitUntil: 'domcontentloaded',
            timeout: 30_000
        });

        await expect(page).toHaveURL(/\/dashboard/, {
            timeout: 10_000
        });

        await expect(
            page.getByRole('heading', {
                name: /Dashboard/i
            })
        ).toBeVisible({
            timeout: 10_000
        });


        // 2. Handle CATI welcome/onboarding overlay
        await dismissWelcomeOverlay(page);


        // 3. Navigate to Agents
        const agentsLink = page.getByRole('link', {
            name: 'Agents',
            exact: true
        });

        await expect(agentsLink).toBeVisible({
            timeout: 10_000
        });

        await agentsLink.click();

        await expect(page).toHaveURL(/\/agents/, {
            timeout: 10_000
        });


        // 4. Verify Agents page
        const createAgentButton = page.getByRole('button', {
            name: 'Create Agent'
        });

        await expect(createAgentButton).toBeVisible({
            timeout: 10_000
        });

        await expect(createAgentButton).toBeEnabled();


        // 5. Open Create Agent
        await createAgentButton.click();

        await expect(
            page.getByRole('heading', {
                name: 'Create AI Agent'
            })
        ).toBeVisible({
            timeout: 10_000
        });


        // 6. Enter company name
        const companyName = page.getByRole('textbox', {
            name: 'Your company name'
        });

        await expect(companyName).toBeVisible({
            timeout: 10_000
        });

        await companyName.fill('QA Test Company');


        // 7. Open prebuilt templates
        const prebuiltButton = page.getByRole('button', {
            name: /Use Prebuilt Agent/i
        });

        await expect(prebuiltButton).toBeVisible({
            timeout: 10_000
        });

        await prebuiltButton.click();


        // 8. Select AI Receptionist template
        const templateButton = page.getByText(
            'Use this template →'
        ).first();

        await expect(templateButton).toBeVisible({
            timeout: 10_000
        });

        await templateButton.click();


        // 9. Verify agent configuration page
        await expect(page).toHaveURL(
            /\/agents\/[^/]+\/configure/,
            {
                timeout: 15_000
            }
        );

        await expect(
            page.getByText(/Agent draft created/i)
        ).toBeVisible({
            timeout: 10_000
        });
    });

});