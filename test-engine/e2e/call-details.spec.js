import { test, expect } from '@playwright/test';

test.describe('E2E - Call Details and Transcript', () => {

    test('Open a call and verify call details and transcript', async ({ page }) => {

        // 1. Open Calls
        await page.goto('/calls', {
            waitUntil: 'domcontentloaded',
            timeout: 20_000
        });

        await expect(page).toHaveURL(/\/calls/, {
            timeout: 10_000
        });

        await expect(
            page.getByRole('heading', {
                name: 'Calls',
                exact: true
            })
        ).toBeVisible({
            timeout: 10_000
        });


        // 2. Verify Call History
        await expect(
            page.getByText('Call History', {
                exact: true
            })
        ).toBeVisible({
            timeout: 10_000
        });


        // 3. Open the first available call
        const firstCall = page.locator('tbody tr').first();

        await expect(firstCall).toBeVisible({
            timeout: 10_000
        });

        await firstCall.click();


        // 4. Verify Call Details modal
        const callDetailsHeading = page.getByRole('heading', {
            name: 'Call Details',
            exact: true
        });

        await expect(callDetailsHeading).toBeVisible({
            timeout: 10_000
        });

        await expect(
            page.getByText(
                'View call information and transcript',
                { exact: true }
            )
        ).toBeVisible({
            timeout: 10_000
        });


        // 5. Locate the actual Call Details modal
        const modal = page
            .locator('div.fixed')
            .filter({
                has: page.getByRole('heading', {
                    name: 'Call Details',
                    exact: true
                })
            })
            .first();

        await expect(modal).toBeVisible({
            timeout: 10_000
        });


        // 6. Verify call information
        await expect(
            modal.getByText(/FROM\s+NUMBER/i)
        ).toBeVisible({
            timeout: 10_000
        });

        await expect(
            modal.getByText(/TO\s+NUMBER\s*\/\s*RECIPIENT/i)
        ).toBeVisible({
            timeout: 10_000
        });

        await expect(
            modal.getByText(/^DURATION$/i)
        ).toBeVisible({
            timeout: 10_000
        });

        await expect(
            modal.getByText(/^CREDITS USED$/i)
        ).toBeVisible({
            timeout: 10_000
        });

        await expect(
            modal.getByText(/^STATUS$/i)
        ).toBeVisible({
            timeout: 10_000
        });

        await expect(
            modal.getByText(/^DATE$/i)
        ).toBeVisible({
            timeout: 10_000
        });

        await expect(
            modal.getByText(/^AGENT USED$/i)
        ).toBeVisible({
            timeout: 10_000
        });


        // 7. Find the scrollable content area inside the modal
        const scrollableArea = modal
            .locator('div.overflow-y-auto')
            .first();

        await expect(scrollableArea).toBeVisible({
            timeout: 10_000
        });


        // 8. Scroll down to Key Insights / Transcript
        await scrollableArea.evaluate((element) => {
            element.scrollTop = element.scrollHeight;
        });


        // 9. Verify Key Insights
        const keyInsights = modal.getByText(
            /^KEY INSIGHTS$/i
        );

        await expect(keyInsights).toBeVisible({
            timeout: 10_000
        });


        // 10. Verify Transcript heading
        const transcriptHeading = modal.getByText(
            /^TRANSCRIPT$/i
        );

        await expect(transcriptHeading).toBeVisible({
            timeout: 10_000
        });


        // 11. Scroll transcript into view
        await transcriptHeading.scrollIntoViewIfNeeded();


        // 12. Verify transcript contains conversation
        await expect(
            modal.getByText(/Agent:/i).last()
        ).toBeVisible({
            timeout: 10_000
        });

        await expect(
            modal.getByText(/User:/i).last()
        ).toBeVisible({
            timeout: 10_000
        });


        // 13. Verify transcript text is actually present
        const transcriptSection = transcriptHeading.locator('..');

        await expect(
            transcriptSection
        ).toContainText(/Agent:|User:/i, {
            timeout: 10_000
        });


        // 14. Close the modal using the footer Close button
        const closeButton = modal.getByText(
            'Close',
            { exact: true }
        );

        await expect(closeButton).toBeVisible({
            timeout: 10_000
        });

        await closeButton.click();


        // 15. Verify Call Details modal closed
        await expect(
            callDetailsHeading
        ).not.toBeVisible({
            timeout: 10_000
        });
    });

});