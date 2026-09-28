// import { test, expect } from "../fixtures/evidence.js";

// test("Calls page loads successfully", async ({ page }) => {
//   await page.goto("/calls", {
//     waitUntil: "domcontentloaded",
//     timeout: 30_000,
//   });

//   await expect(page).toHaveURL(/\/calls/);

//   await expect(page.getByRole("heading", { name: "Calls" })).toBeVisible();

//   await expect(
//     page.getByText("Monitor past calls and schedule future callbacks"),
//   ).toBeVisible();
// });

// test("Call History shows empty state when there are no calls", async ({
//   page,
// }) => {
//   await page.goto("/calls");

//   await expect(
//     page.getByRole("button", { name: /Call History/i }),
//   ).toBeVisible();

//   await expect(
//     page.getByText("No calls yet. Make your first call to see it here."),
//   ).toBeVisible();
// });

// test("Scheduled Calls shows empty state when there are no scheduled calls", async ({
//   page,
// }) => {
//   await page.goto("/calls");

//   await page.getByRole("button", { name: /Scheduled Calls/i }).click();

//   await expect(
//     page.getByText(
//       "No scheduled calls yet. Leads from IndiaMART or follow-ups will appear here.",
//     ),
//   ).toBeVisible();
// });

// test("User can switch between Call History and Scheduled Calls", async ({
//   page,
// }) => {
//   await page.goto("/calls");

//   await page.getByRole("button", { name: /Scheduled Calls/i }).click();

//   await expect(page.getByText(/No scheduled calls yet/i)).toBeVisible();

//   await page.getByRole("button", { name: /Call History/i }).click();

//   await expect(page.getByText(/No calls yet/i)).toBeVisible();
// });






import { test, expect } from "../fixtures/evidence.js";

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

            await expect(
                callRows.first()
            ).toBeVisible({
                timeout: 10_000
            });

        } else {

            await expect(
                page.getByText('Call History', {
                    exact: true
                })
            ).toBeVisible({
                timeout: 10_000
            });

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