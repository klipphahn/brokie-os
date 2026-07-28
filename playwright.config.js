import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.SMOKE_PORT || 3417);
const BASE_URL = process.env.SMOKE_BASE_URL || `http://127.0.0.1:${PORT}`;

/**
 * Isolated admin smoke suite.
 * Starts a production `next start` server with no third-party credentials.
 */
export default defineConfig({
  testDir: "./smoke",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  timeout: 60_000,
  expect: {
    timeout: 15_000
  },
  reporter: process.env.CI
    ? [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]]
    : [["list"]],
  outputDir: "test-results",
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    ...devices["Desktop Chrome"]
  },
  webServer: {
    command: `node ./node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      ...process.env,
      PORT: String(PORT),
      HOSTNAME: "127.0.0.1",
      NEXT_TELEMETRY_DISABLED: "1",
      NEXT_PUBLIC_APP_URL: BASE_URL,
      // Fail-closed auth without live Supabase / Shopify / Printful / OpenAI.
      NEXT_PUBLIC_SUPABASE_URL: "",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "",
      SUPABASE_SERVICE_ROLE_KEY: "",
      PRINTFUL_TOKEN: "",
      PRINTFUL_STORE_ID: "",
      SHOPIFY_STORE_DOMAIN: "",
      SHOPIFY_ADMIN_ACCESS_TOKEN: "",
      SHOPIFY_CLIENT_ID: "",
      SHOPIFY_CLIENT_SECRET: "",
      OPENAI_API_KEY: "",
      ADMIN_EMAIL: "smoke-admin@example.com",
      CRON_SECRET: ""
    }
  }
});
