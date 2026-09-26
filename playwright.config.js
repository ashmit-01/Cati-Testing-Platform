import { defineConfig } from '@playwright/test';
import 'dotenv/config';

export default defineConfig({
    testDir: './test-engine',

    timeout: 30_000,

    fullyParallel: true,

    retries: process.env.CI ? 1 : 0,

    reporter: [
        ['list'],
        ['html', { outputFolder: 'playwright-report', open: 'never' }]
    ],

    use: {
        baseURL: process.env.FRONTEND_URL || 'https://usecati.com',
        headless: true,
        screenshot: 'only-on-failure',
        video: 'retain-on-failure',
        trace: 'retain-on-failure'
    },

    projects: [
        {
            name: 'setup',
            testMatch: /.*\.setup\.js/,
        },

        {
            name: 'chromium',
            testIgnore: [
                '**/login.spec.js',
                '**/landing.spec.js',
                '**/api/**',
            ],
            use: {
                browserName: 'chromium',
                storageState: 'playwright/.auth/user.json',
            },
            dependencies: ['setup'],
        },

        {
            name: 'unauthenticated',
            testMatch: [
                '**/login.spec.js',
                '**/landing.spec.js'
            ],
            use: {
                browserName: 'chromium',
                storageState: undefined,
            },
        },

        {
            name: 'api',
            testMatch: /api\/specs\/.*\.spec\.js/,
            use: {
                baseURL: process.env.BACKEND_URL || 'http://localhost:5000',
            },
        },
    ],
});