import { defineConfig } from '@playwright/test';
import 'dotenv/config';

export default defineConfig({
  testDir: './test-engine',

  timeout: 30_000,

  expect: {
    timeout: 5_000,
  },

  fullyParallel: true,

  retries: process.env.CI ? 1 : 0,

  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['./reports/jsonReporter.js'],
  ],

  use: {
    baseURL: process.env.FRONTEND_URL || 'https://usecati.com',

    headless: true,

    actionTimeout: 10_000,

    navigationTimeout: 15_000,

    screenshot: 'only-on-failure',

    video: 'retain-on-failure',

    trace: 'retain-on-failure',
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
        '**/websocket/**',
        '**/ai/**',
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
        '**/landing.spec.js',
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

    {
      name: 'websocket',

      // Pure Node WebSocket protocol tests (no browser/page needed) -
      // kept out of the 'chromium' project so they don't depend on the
      // UI 'setup' project or a storageState file.
      testMatch: /websocket\/.*\.spec\.js/,

      use: {
        baseURL: process.env.BACKEND_URL || 'http://localhost:5000',
      },
    },

    {
      name: 'ai',

      // AI/voice behavioral tests drive the AI engine over REST
      // (test-engine/api/helpers/aiEngine.helper.js), not a browser.
      testMatch: /(^|\/)ai\/.*\.spec\.js/,

      use: {
        baseURL: process.env.BACKEND_URL || 'http://localhost:5000',
      },
    },
  ],
});