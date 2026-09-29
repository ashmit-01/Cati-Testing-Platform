import { test as setup, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';


setup.setTimeout(90_000);

console.log("🔥 AUTH SETUP STARTED");
console.log("FRONTEND_URL =", process.env.FRONTEND_URL);
console.log("TEST_EMAIL =", !!process.env.TEST_EMAIL);
console.log("TEST_PASSWORD =", !!process.env.TEST_PASSWORD);

const authDir = path.join(process.cwd(), 'playwright', '.auth');
const authFile = path.join(authDir, 'user.json');

setup('authenticate', async ({ page }) => {
    const email = process.env.TEST_EMAIL;
    const password = process.env.TEST_PASSWORD;
    const baseURL = process.env.FRONTEND_URL;

    console.log('========== AUTH SETUP ==========');
    console.log('FRONTEND_URL:', baseURL);
    console.log('TEST_EMAIL configured:', !!email);
    console.log('TEST_PASSWORD configured:', !!password);

    expect(baseURL, 'FRONTEND_URL must be configured').toBeTruthy();
    expect(email, 'TEST_EMAIL must be configured').toBeTruthy();
    expect(password, 'TEST_PASSWORD must be configured').toBeTruthy();

    console.log('Opening CATI login...');

    const response = await page.goto(
        `${baseURL}/auth/login`,
        {
            waitUntil: 'domcontentloaded',
            timeout: 30_000,
        }
    );

    console.log('Login response status:', response?.status());
    console.log('Current URL:', page.url());
    console.log('Page title:', await page.title());

    await page.screenshot({
        path: path.join(process.cwd(), 'test-results', 'render-login.png'),
        fullPage: true,
    }).catch(() => {});

    console.log('Looking for email field...');

    const emailInput = page.getByRole('textbox', {
        name: 'you@example.com',
    });

    await expect(emailInput).toBeVisible({
        timeout: 15_000,
    });

    await emailInput.fill(email.trim());

    console.log('Email entered.');

    const passwordInput = page.getByRole('textbox', {
        name: 'Enter password',
    });

    await expect(passwordInput).toBeVisible({
        timeout: 15_000,
    });

    await passwordInput.fill(password);

    console.log('Password entered.');

    console.log('Clicking Sign in...');

    await page.getByRole('button', {
        name: 'Sign in',
    }).click();

    console.log('Sign in clicked.');

    await expect(page).toHaveURL(
        /\/dashboard/,
        {
            timeout: 30_000,
        }
    );

    console.log('Dashboard reached:', page.url());

    await fs.promises.mkdir(authDir, {
        recursive: true,
    });

    await page.context().storageState({
        path: authFile,
    });

    console.log('Authentication state saved:', authFile);
    console.log('========== AUTH COMPLETE ==========');
});