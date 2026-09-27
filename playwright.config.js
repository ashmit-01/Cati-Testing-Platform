import { defineConfig } from '@playwright/test';
import 'dotenv/config';

export default defineConfig({
    testDir: './test-engine',

    timeout: 30_000,

    expect: {
        timeout: 5_000
    },

    fullyParallel: false,

    retries: process.env.CI ? 1 : 0,

    reporter: [
        ['list'],
        ['html', {
            outputFolder: 'playwright-report',
            open: 'never'
        }]
    ],

    use: {
        baseURL: process.env.FRONTEND_URL || 'https://usecati.com',

        headless: true,

        actionTimeout: 10_000,

        navigationTimeout: 15_000,

        screenshot: 'only-on-failure',

        video: 'retain-on-failure',

        trace: 'retain-on-failure'
    },

    projects: [
        {
            name: 'setup',

            testMatch: /.*\.setup\.js/
        },

        {
            name: 'chromium',

            testIgnore: [
                '**/login.spec.js',
                '**/landing.spec.js'
            ],

            use: {
                browserName: 'chromium',

                storageState: 'playwright/.auth/user.json'
            },

            dependencies: ['setup']
        },

        {
            name: 'unauthenticated',

            testMatch: [
                '**/login.spec.js',
                '**/landing.spec.js'
            ],

            use: {
                browserName: 'chromium',

                storageState: undefined
            }
        }
    ]
});