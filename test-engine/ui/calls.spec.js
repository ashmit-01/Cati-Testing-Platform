import { test, expect } from '@playwright/test';

test.describe('Calls - UI', () => {

    test('Calls page loads successfully', async ({ page }) => {

        await page.goto('/calls', {
            waitUntil: 'commit',
            timeout: 60_000
        });

        await expect(page).toHaveURL(/\/calls/, {
            timeout: 15_000
        });

        await expect(
            page.getByRole('heading', {
                name: 'Calls',
                exact: true
            })
        ).toBeVisible({
            timeout: 15_000
        });

        await expect(
            page.getByText('Call History', {
                exact: true
            })
        ).toBeVisible({
            timeout: 15_000
        });
    });


    test('Call History displays calls or a valid empty state', async ({ page }) => {

        await page.goto('/calls', {
            waitUntil: 'commit',
            timeout: 60_000
        });

        await expect(page).toHaveURL(/\/calls/, {
            timeout: 15_000
        });

        await expect(
            page.getByText('Call History', {
                exact: true
            })
        ).toBeVisible({
            timeout: 15_000
        });

        const callRows = page.locator('tbody tr');
        const rowCount = await callRows.count();

        if (rowCount > 0) {

            // Production currently contains call data
            await expect(
                callRows.first()
            ).toBeVisible({
                timeout: 10_000
            });

        } else {

            // No calls: verify the section rendered correctly
            await expect(
                page.getByText('Call History', {
                    exact: true
                })
            ).toBeVisible({
                timeout: 10_000
            });

            // Make sure the application did not show a server/application error
            await expect(
                page.locator('body')
            ).not.toContainText(
                /Internal Server Error|Something went wrong/i
            );
        }
    });


    test('Scheduled Calls section is accessible', async ({ page }) => {

        await page.goto('/calls', {
            waitUntil: 'commit',
            timeout: 60_000
        });

        await expect(page).toHaveURL(/\/calls/, {
            timeout: 15_000
        });

        const scheduledCallsButton = page.getByRole(
            'button',
            {
                name: /Scheduled Calls/i
            }
        );

        await expect(
            scheduledCallsButton
        ).toBeVisible({
            timeout: 15_000
        });

        await scheduledCallsButton.click();

        await expect(
            page.getByText('Scheduled Calls', {
                exact: true
            })
        ).toBeVisible({
            timeout: 10_000
        });
    });


    test('User can switch between Call History and Scheduled Calls', async ({ page }) => {

        await page.goto('/calls', {
            waitUntil: 'commit',
            timeout: 60_000
        });

        await expect(page).toHaveURL(/\/calls/, {
            timeout: 15_000
        });

        // Verify Call History button
        const callHistoryButton = page.getByRole(
            'button',
            {
                name: /Call History/i
            }
        );

        await expect(
            callHistoryButton
        ).toBeVisible({
            timeout: 15_000
        });

        // Verify Scheduled Calls button
        const scheduledCallsButton = page.getByRole(
            'button',
            {
                name: /Scheduled Calls/i
            }
        );

        await expect(
            scheduledCallsButton
        ).toBeVisible({
            timeout: 15_000
        });

        // Switch to Scheduled Calls
        await scheduledCallsButton.click();

        await expect(
            page.getByText('Scheduled Calls', {
                exact: true
            })
        ).toBeVisible({
            timeout: 10_000
        });

        // Switch back to Call History
        await callHistoryButton.click();

        await expect(
            page.getByText('Call History', {
                exact: true
            })
        ).toBeVisible({
            timeout: 10_000
        });
    });

});