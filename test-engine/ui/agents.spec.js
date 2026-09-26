import { test, expect } from '@playwright/test';

test('Agents page loads successfully', async ({ page }) => {
    await page.goto('/agents');

    await expect(page).toHaveURL(/\/agents/);

    await expect(
        page.getByRole('button', { name: 'Create Agent' })
    ).toBeVisible();
});


test('Create Agent requires company name before selecting template', async ({ page }) => {
    await page.goto('/agents');

    await page
        .getByRole('button', { name: 'Create Agent' })
        .click();

    await expect(
        page.getByRole('heading', { name: 'Create AI Agent' })
    ).toBeVisible();

    await page
        .getByRole('button', { name: /Use Prebuilt Agent/i })
        .click();

    await page
        .getByText('Use this template →')
        .first()
        .click();

    await expect(
        page.getByText(
            /Please enter company name before selecting template/i
        )
    ).toBeVisible();
});


test('Create AI Receptionist agent from prebuilt template', async ({ page }) => {
    await page.goto('/agents');

    await page
        .getByRole('button', { name: 'Create Agent' })
        .click();

    await expect(
        page.getByRole('heading', { name: 'Create AI Agent' })
    ).toBeVisible();

    await page
        .getByRole('textbox', { name: 'Your company name' })
        .fill('QA Test Company');

    await page
        .getByRole('button', { name: /Use Prebuilt Agent/i })
        .click({ noWaitAfter: true });

    const templateButton = page
        .getByText('Use this template →')
        .first();

    await expect(templateButton).toBeVisible({
        timeout: 15_000
    });

    await templateButton.click();

    await expect(page).toHaveURL(
        /\/agents\/[^/]+\/configure/,
        {
            timeout: 15_000
        }
    );

    await expect(
        page.getByText(/Agent draft created/i)
    ).toBeVisible({
        timeout: 15_000
    });
});