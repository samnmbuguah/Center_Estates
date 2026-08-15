import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: 1,
  workers: process.env.CI ? 1 : 2,
  timeout: 90000,
  expect: { timeout: 15000 },
  reporter: [
    ["list"],
    ["html", { outputFolder: "artifacts/playwright-report", open: "never" }],
    ["junit", { outputFile: "artifacts/playwright-results.xml" }],
  ],
  outputDir: "artifacts/test-results",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "https://centerestates.com",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    ignoreHTTPSErrors: true,
    // Use test database for all E2E tests
    extraHTTPHeaders: {
      'X-Test-Mode': 'true',
    },
  },
  projects: [
    // Setup project for test database
    {
      name: 'setup-test-db',
      testMatch: /.*\.setup\.ts/,
    },
    // Test projects that depend on setup
    { 
      name: "desktop-chromium", 
      use: { ...devices["Desktop Chrome"] },
      dependencies: ['setup-test-db']
    },
    { 
      name: "mobile-chromium", 
      use: { ...devices["Pixel 7"] },
      dependencies: ['setup-test-db']
    },
  ],
});
