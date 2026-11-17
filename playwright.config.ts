import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;

export default defineConfig({
  testDir: "tests/e2e",
  testMatch: "**/*.spec.ts",
  globalTeardown: "./tests/e2e/global-teardown.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: { baseURL: `http://localhost:${PORT}`, trace: "on-first-retry" },
  projects: [
    { name: "mobile", use: { ...devices["Pixel 7"] } },
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    // End-to-end tests always run against the mock payment provider.
    command: `npm run build && npm run start -- -p ${PORT}`,
    url: `http://localhost:${PORT}/api/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: {
      PAYMENTS_MODE: "mock",
      EMAIL_TRANSPORT: "file",
      // Placeholders so the Google button renders; tests stub Google itself.
      GOOGLE_CLIENT_ID: "e2e-placeholder.apps.googleusercontent.com",
      GOOGLE_CLIENT_SECRET: "e2e-placeholder-secret",
      APP_URL: `http://localhost:${PORT}`,
    },
  },
});
