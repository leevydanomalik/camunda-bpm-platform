import { defineConfig, devices } from "@playwright/test";

/**
 * E2E test configuration for camunda-next-webapps.
 * Chromium-only by default. Add more projects as parity with the old webapps grows.
 */
export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.spec.{js,ts}",
  timeout: 60000,
  expect: {
    timeout: 10000,
  },
  fullyParallel: false,
  workers: 1,
  reporter: [
    [
      "html",
      {
        outputFolder: "playwright-report",
        open: "never",
      },
    ],
    ["list"],
    ["json", { outputFile: "test-results/test-results.json" }],
  ],
  use: {
    baseURL: "http://localhost:3000",
    viewport: { width: 1280, height: 720 },
    ignoreHTTPSErrors: true,
    actionTimeout: 10000,
    navigationTimeout: 15000,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        channel: "chrome",
        launchOptions: {
          args: ["--start-maximized"],
        },
      },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
