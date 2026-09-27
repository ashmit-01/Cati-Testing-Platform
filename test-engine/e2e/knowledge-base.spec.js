import { test, expect } from '@playwright/test';

test.describe('E2E - Knowledge Base', () => {

    test('Add general knowledge text and verify it is saved', async ({ page }) => {

        // ---------------------------------------------------------
        // 1. Open Agents
        // ---------------------------------------------------------
        await page.goto('/agents', {
            waitUntil: 'domcontentloaded',
            timeout: 30_000
        });

        await expect(page).toHaveURL(/\/agents/, {
            timeout: 10_000
        });


        // ---------------------------------------------------------
        // 2. Find the Promotional Campaign agent
        // ---------------------------------------------------------
        const agent = page
            .getByText('Promotional Campaign', {
                exact: true
            })
            .first();

        await expect(agent).toBeVisible({
            timeout: 15_000
        });


        // ---------------------------------------------------------
        // 3. Open the agent
        // ---------------------------------------------------------
        await agent.click();


        // ---------------------------------------------------------
        // 4. Verify Agent Knowledge Base button
        // ---------------------------------------------------------
        const knowledgeBaseButton = page.getByRole(
            'button',
            {
                name: /Edit Agent Knowledge Base/i
            }
        );

        await expect(knowledgeBaseButton).toBeVisible({
            timeout: 15_000
        });


        // ---------------------------------------------------------
        // 5. Open Agent Knowledge Base
        // ---------------------------------------------------------
        await knowledgeBaseButton.click();


        // ---------------------------------------------------------
        // 6. Verify Knowledge Base page
        // ---------------------------------------------------------
        await expect(
            page.getByRole('heading', {
                name: 'Agent Knowledge Base',
                exact: true
            })
        ).toBeVisible({
            timeout: 15_000
        });


        // ---------------------------------------------------------
        // 7. Open Add General Text
        // ---------------------------------------------------------
        const addGeneralTextButton = page.getByRole(
            'button',
            {
                name: 'Add General Text',
                exact: true
            }
        );

        await expect(addGeneralTextButton).toBeVisible({
            timeout: 10_000
        });

        await addGeneralTextButton.click();


        // ---------------------------------------------------------
        // 8. Verify General Knowledge Text form
        // ---------------------------------------------------------
        await expect(
            page.getByText('Add General Knowledge Text', {
                exact: true
            })
        ).toBeVisible({
            timeout: 10_000
        });


        // ---------------------------------------------------------
        // 9. Locate textarea
        // ---------------------------------------------------------
        const knowledgeTextarea = page.getByPlaceholder(
            'Paste agency knowledge text here...'
        );

        await expect(knowledgeTextarea).toBeVisible({
            timeout: 10_000
        });


        // ---------------------------------------------------------
        // 10. Create unique QA knowledge
        // ---------------------------------------------------------
        const qaKnowledge =
            `QA automation knowledge test ${Date.now()}. ` +
            `This text is added by the CATI QA E2E test suite. ` +
            `It verifies that general knowledge text can be saved successfully.`;


        // ---------------------------------------------------------
        // 11. Enter knowledge
        // ---------------------------------------------------------
        await knowledgeTextarea.fill(qaKnowledge);

        await expect(knowledgeTextarea).toHaveValue(
            qaKnowledge
        );


        // ---------------------------------------------------------
        // 12. Verify Save Text button
        // ---------------------------------------------------------
        const saveTextButton = page.getByRole(
            'button',
            {
                name: 'Save Text',
                exact: true
            }
        );

        await expect(saveTextButton).toBeVisible({
            timeout: 10_000
        });

        await expect(saveTextButton).toBeEnabled();


        // ---------------------------------------------------------
        // 13. Save knowledge
        // ---------------------------------------------------------
        await saveTextButton.click();


        // ---------------------------------------------------------
        // 14. Wait for ingestion
        // ---------------------------------------------------------
        await page.waitForTimeout(2_000);


        // ---------------------------------------------------------
        // 15. Find Ingested Knowledge Resources
        // ---------------------------------------------------------
        const resourcesHeading = page.getByText(
            'Ingested Knowledge Resources',
            {
                exact: true
            }
        );

        await expect(resourcesHeading).toBeVisible({
            timeout: 15_000
        });

        await resourcesHeading.scrollIntoViewIfNeeded();


        // ---------------------------------------------------------
        // 16. Verify saved QA knowledge
        // ---------------------------------------------------------
        await expect(
            page.locator('body')
        ).toContainText(
            qaKnowledge,
            {
                timeout: 15_000
            }
        );


        // ---------------------------------------------------------
        // SAFETY STOP
        // ---------------------------------------------------------
        // Do NOT:
        // - Clear Agent KB
        // - Delete the resource
        // - Modify existing resources
        // - Add destinations
        // - Sync unrelated resources
        //
        // Test ends after verifying the saved QA text.

    });

});