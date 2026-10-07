import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright E2E Test Configuration for Magguru.
 * Ensures isolation, determinism, failure tracing, and production data safety.
 */

const PORT = process.env.PORT || 3100;
const BASE_URL = process.env.PLAYWRIGHT_TEST_BASE_URL || `http://localhost:${PORT}`;

// HARD GUARD: Test must never run against production domain
if (BASE_URL.includes("magguru.web.id")) {
  throw new Error("FATAL: E2E Tests CANNOT run against production domain magguru.web.id! Test aborted.");
}

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60 * 1000,
  expect: {
    timeout: 15 * 1000,
  },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ["list"],
    ["html", { outputFolder: "playwright-report", open: "never" }],
  ],
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    extraHTTPHeaders: {
      "x-e2e-test": "true",
    },
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: `npx next dev -p ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: false,
    timeout: 120 * 1000,
    env: {
      NEXT_PUBLIC_SUPABASE_URL: "https://test-magguru.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e2e-test-key-for-isolated-testing-only",
      E2E_TEST: "true",
      PORT: String(PORT),
    },
  },
});
