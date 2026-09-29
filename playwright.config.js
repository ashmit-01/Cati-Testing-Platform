import { defineConfig } from '@playwright/test';
import 'dotenv/config';

export default defineConfig({
  testDir: './test-engine',

  // Run sequentially on Render for stability.
  workers: 1,

  // Individual test timeout.
  timeout: 45_000,

  expect: {
    timeout: 7_000,
  },

  fullyParallel: false,

  retries: process.env.CI ? 1 : 0,

  reporter: [
    ['list'],
    ['json', {
      outputFile:
        process.env.PLAYWRIGHT_JSON_OUTPUT_FILE ||
        'playwright-results.json',
    }],
    ['html', {
      outputFolder: 'playwright-report',
      open: 'never',
    }],
  ],

  use: {
    baseURL:
      process.env.FRONTEND_URL ||
      'https://usecati.com',

    headless: true,

    actionTimeout: 15_000,

    navigationTimeout: 30_000,

    screenshot: 'off',

    video: 'off',

    trace: 'off',

    ignoreHTTPSErrors: false,
  },

  projects: [
    // -------------------------------------------------
    // AUTH SETUP
    // -------------------------------------------------
    {
      name: 'setup',

      testMatch: /auth\.setup\.js/,

      use: {
        baseURL:
          process.env.FRONTEND_URL ||
          'https://usecati.com',

        browserName: 'chromium',

        headless: true,

        storageState: undefined,
      },
    },

    // -------------------------------------------------
    // AUTHENTICATED UI TESTS
    // -------------------------------------------------
    {
      name: 'chromium',

      testMatch: /.*\.spec\.js/,

      testIgnore: [
        '**/login.spec.js',
        '**/landing.spec.js',
        '**/api/**',
      ],

      use: {
        browserName: 'chromium',

        baseURL:
          process.env.FRONTEND_URL ||
          'https://usecati.com',

        storageState:
          'playwright/.auth/user.json',

        headless: true,
      },

      dependencies: ['setup'],
    },

    // -------------------------------------------------
    // UNAUTHENTICATED UI TESTS
    // -------------------------------------------------
    {
      name: 'unauthenticated',

      testMatch: [
        '**/login.spec.js',
        '**/landing.spec.js',
      ],

      use: {
        browserName: 'chromium',

        baseURL:
          process.env.FRONTEND_URL ||
          'https://usecati.com',

        storageState: undefined,

        headless: true,
      },
    },

    // -------------------------------------------------
    // API TESTS
    // -------------------------------------------------
    {
      name: 'api',

      testMatch:
        /api[\\/]specs[\\/].*\.spec\.js/,

      use: {
        baseURL:
          process.env.BACKEND_URL ||
          'http://localhost:5000',
      },
    },
  ],
});