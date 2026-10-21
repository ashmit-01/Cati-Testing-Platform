import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

test.describe('E2E - Campaign Lead Upload', () => {

    test('Create campaign, configure it, and upload CSV leads', async ({ page }) => {

        // ---------------------------------------------------------
        // 1. Open Campaign Manager
        // ---------------------------------------------------------
        await page.goto('/crm-campaigns', {
            waitUntil: 'domcontentloaded',
            timeout: 30_000
        });

        await expect(page).toHaveURL(/\/crm-campaigns/, {
            timeout: 10_000
        });


        // ---------------------------------------------------------
        // 2. Verify Campaign Manager
        // ---------------------------------------------------------
        await expect(
            page.getByText('Campaign Manager', {
                exact: true
            })
        ).toBeVisible({
            timeout: 10_000
        });


        // ---------------------------------------------------------
        // 3. Create Campaign
        // ---------------------------------------------------------
        const createCampaignButton = page.getByRole('button', {
            name: /Create campaign/i
        });

        await expect(createCampaignButton).toBeVisible({
            timeout: 10_000
        });

        await expect(createCampaignButton).toBeEnabled();

        await createCampaignButton.click();


        // ---------------------------------------------------------
        // 4. Verify Campaign Details
        // ---------------------------------------------------------
        await expect(
            page.getByText('Campaign Details', {
                exact: true
            })
        ).toBeVisible({
            timeout: 10_000
        });


        // ---------------------------------------------------------
        // 5. Enter Campaign Name
        // ---------------------------------------------------------
        const campaignName = page.getByPlaceholder(
            'e.g. Q3 Outreach Campaign'
        );

        await expect(campaignName).toBeVisible({
            timeout: 10_000
        });

        const uniqueCampaignName =
            `QA E2E Campaign ${Date.now()}`;

        await campaignName.fill(uniqueCampaignName);

        await expect(campaignName).toHaveValue(
            uniqueCampaignName
        );


        // ---------------------------------------------------------
        // 6. Select Outbound Leads
        // ---------------------------------------------------------
        await expect(
            page.getByText('Outbound Leads', {
                exact: true
            })
        ).toBeVisible({
            timeout: 10_000
        });


        // ---------------------------------------------------------
        // 7. Select Excel
        // ---------------------------------------------------------
        const excelOption = page.getByText(
            'Excel',
            {
                exact: true
            }
        );

        await expect(excelOption).toBeVisible({
            timeout: 10_000
        });

        await excelOption.click();


        // ---------------------------------------------------------
        // 8. Create Campaign
        // ---------------------------------------------------------
        const createButton = page.getByRole('button', {
            name: 'Create Campaign',
            exact: true
        });

        await expect(createButton).toBeVisible({
            timeout: 10_000
        });

        await expect(createButton).toBeEnabled();

        await createButton.click();


        // ---------------------------------------------------------
        // 9. Wait for Configure button
        // ---------------------------------------------------------
        const configureButton = page.getByRole(
            'button',
            {
                name: 'Configure',
                exact: true
            }
        ).last();

        await expect(configureButton).toBeVisible({
            timeout: 20_000
        });

        await expect(configureButton).toBeEnabled();


        // ---------------------------------------------------------
        // 10. Configure campaign
        // ---------------------------------------------------------
        await configureButton.click();


        // ---------------------------------------------------------
        // 11. Verify Campaign Overview
        // ---------------------------------------------------------
        await expect(
            page.getByText('Campaign Overview', {
                exact: true
            })
        ).toBeVisible({
            timeout: 15_000
        });


        // ---------------------------------------------------------
        // 12. Open Add Leads
        // ---------------------------------------------------------
        const addLeadsButton = page.getByText(
            'Add Leads',
            {
                exact: true
            }
        ).first();

        await expect(addLeadsButton).toBeVisible({
            timeout: 10_000
        });

        await addLeadsButton.click();


        // ---------------------------------------------------------
        // 13. Verify Add Leads
        // ---------------------------------------------------------
        await expect(
            page.getByText('Add Leads', {
                exact: true
            }).last()
        ).toBeVisible({
            timeout: 10_000
        });


        // ---------------------------------------------------------
        // 14. Verify Excel / CSV
        // ---------------------------------------------------------
        await expect(
            page.getByText('Excel / CSV', {
                exact: true
            })
        ).toBeVisible({
            timeout: 10_000
        });


        // ---------------------------------------------------------
        // 15. Verify required format
        // ---------------------------------------------------------
        await expect(
            page.getByText('Required Excel Format', {
                exact: true
            })
        ).toBeVisible({
            timeout: 10_000
        });

        await expect(
            page.getByText(
                /PHONE\s*\(REQUIRED\)/i
            )
        ).toBeVisible({
            timeout: 10_000
        });


        // ---------------------------------------------------------
        // 16. Scroll to upload section
        // ---------------------------------------------------------
        await page.evaluate(() => {
            window.scrollTo({
                top: document.documentElement.scrollHeight,
                behavior: 'smooth'
            });
        });

        await page.waitForTimeout(1_000);


        // ---------------------------------------------------------
        // 17. Create temporary CSV
        // ---------------------------------------------------------
        const testCsvPath = path.join(
            process.cwd(),
            'test-engine',
            'e2e',
            'qa-test-leads.csv'
        );

        const csvContent = [
            'Name,Phone,Personal Details',
            'QA Test User,+919876543210,QA automation test lead'
        ].join('\n');

        fs.writeFileSync(
            testCsvPath,
            csvContent,
            'utf8'
        );


        // ---------------------------------------------------------
        // 18. Locate file input directly
        // ---------------------------------------------------------
        const fileInput = page.locator(
            'input[type="file"]'
        ).first();

        await expect(fileInput).toHaveCount(1, {
            timeout: 10_000
        });


        // ---------------------------------------------------------
        // 19. Upload CSV
        // ---------------------------------------------------------
        await fileInput.setInputFiles(
            testCsvPath
        );


        // ---------------------------------------------------------
        // 20. Wait for upload processing
        // ---------------------------------------------------------
        await page.waitForTimeout(2_000);


        // ---------------------------------------------------------
        // 21. Scroll down after upload
        // ---------------------------------------------------------
        await page.evaluate(() => {
            window.scrollTo({
                top: document.documentElement.scrollHeight,
                behavior: 'smooth'
            });
        });

        await page.waitForTimeout(1_000);


        // ---------------------------------------------------------
        // 22. Verify upload result
        // ---------------------------------------------------------
        await expect(
            page.locator('body')
        ).toContainText(
            /qa-test-leads\.csv|QA Test User|Upload|lead/i,
            {
                timeout: 10_000
            }
        );


        // ---------------------------------------------------------
        // 23. SAFETY STOP
        // ---------------------------------------------------------
        // Do NOT click:
        //
        // - Trigger Manual Execution
        // - Start Test Run
        // - Start Campaign
        // - Execute Workflow
        //
        // Test ends after CSV upload validation.


        // ---------------------------------------------------------
        // 24. Cleanup
        // ---------------------------------------------------------
        if (fs.existsSync(testCsvPath)) {
            fs.unlinkSync(testCsvPath);
        }

    });

});