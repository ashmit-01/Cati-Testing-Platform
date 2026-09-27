import { test, expect } from '@playwright/test';

const openWallet = async (page) => {
    await page.goto('/wallet', {
        waitUntil: 'domcontentloaded',
        timeout: 30_000
    });

    await expect(page).toHaveURL(/\/wallet/, {
        timeout: 10_000
    });
};

test.describe('Wallet / Credits - UI', () => {

    test('Wallet page loads successfully', async ({ page }) => {
        await openWallet(page);

        await expect(
            page.getByRole('heading', {
                name: 'Credits',
                exact: true
            })
        ).toBeVisible({
            timeout: 10_000
        });

        await expect(
            page.getByText('Credit Balance', {
                exact: true
            })
        ).toBeVisible({
            timeout: 10_000
        });

        await expect(
            page.getByText('Credit Ledger', {
                exact: true
            })
        ).toBeVisible({
            timeout: 10_000
        });
    });


    test('Credit balance information is displayed', async ({ page }) => {
        await openWallet(page);

        await expect(
            page.getByText('Credit Balance', {
                exact: true
            })
        ).toBeVisible({
            timeout: 10_000
        });

        await expect(
            page.getByText(/\d+\s+credits/i).first()
        ).toBeVisible({
            timeout: 10_000
        });
    });


    test('Plan status information is displayed', async ({ page }) => {
        await openWallet(page);

        await expect(
            page.getByText(/PLAN STATUS/i).first()
        ).toBeVisible({
            timeout: 10_000
        });

        await expect(
            page.getByText(/^Active$/i).first()
        ).toBeVisible({
            timeout: 10_000
        });

        await expect(
            page.getByText(/^Enterprise$/i).first()
        ).toBeVisible({
            timeout: 10_000
        });
    });


    test('Credit usage statistics are displayed', async ({ page }) => {
        await openWallet(page);

        await expect(
            page.getByText(/CREDITS USED TODAY/i).first()
        ).toBeVisible({
            timeout: 10_000
        });

        await expect(
            page.getByText(/CALLS THIS MONTH/i).first()
        ).toBeVisible({
            timeout: 10_000
        });

        await expect(
            page.getByText(/AVG CREDITS\s*\/\s*CALL/i).first()
        ).toBeVisible({
            timeout: 10_000
        });
    });


    test('Credit ledger is displayed', async ({ page }) => {
        await openWallet(page);

        await expect(
            page.getByText('Credit Ledger', {
                exact: true
            })
        ).toBeVisible({
            timeout: 10_000
        });

        await expect(
            page.getByText(
                'Recent credit activity and balance changes.',
                { exact: true }
            )
        ).toBeVisible({
            timeout: 10_000
        });

        await expect(
            page.getByText(/^DATE$/i).first()
        ).toBeVisible({
            timeout: 10_000
        });

        await expect(
            page.getByText(/^TYPE$/i).first()
        ).toBeVisible({
            timeout: 10_000
        });

        await expect(
            page.getByText(/^DESCRIPTION$/i).first()
        ).toBeVisible({
            timeout: 10_000
        });

        await expect(
            page.getByText(/^CREDITS$/i).first()
        ).toBeVisible({
            timeout: 10_000
        });

        await expect(
            page.getByText(/CREDIT BALANCE AFTER/i).first()
        ).toBeVisible({
            timeout: 10_000
        });
    });


    test('Wallet provides plan management options', async ({ page }) => {
        await openWallet(page);

        await expect(
            page.getByRole('button', {
                name: /View Plans/i
            })
        ).toBeVisible({
            timeout: 10_000
        });

        await expect(
            page.getByRole('button', {
                name: /Manage Plan/i
            })
        ).toBeVisible({
            timeout: 10_000
        });
    });

});