import { defineConfig } from "vitest/config"
import react from "@vitejs/plugin-react"
import tsconfigPaths from "vite-tsconfig-paths"

/**
 * Integration test config — runs against a real (local) database.
 * Requires DATABASE_URL to point to a test database.
 *
 * Usage:
 *   pnpm test:integration
 */
export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    name: "integration",
    environment: "jsdom",
    globals: true,
    testTimeout: 30_000,
    hookTimeout: 30_000,
    env: {
      DATABASE_URL: process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/plugin_cancun",
      NEXTAUTH_SECRET: "test-secret-for-integration",
      NEXTAUTH_URL: "http://localhost:3000",
      AWS_REGION: "us-east-1",
      AWS_ACCESS_KEY_ID: "test-key-id",
      AWS_SECRET_ACCESS_KEY: "test-secret-key",
      AWS_S3_BUCKET: "test-bucket",
      STRIPE_SECRET_KEY: "sk_test_placeholder",
      STRIPE_WEBHOOK_SECRET: "whsec_placeholder",
      STRIPE_PRICE_STARTER_MONTHLY: "price_starter_monthly",
      STRIPE_PRICE_STARTER_ANNUAL: "price_starter_annual",
      STRIPE_PRICE_GROWTH_MONTHLY: "price_growth_monthly",
      STRIPE_PRICE_GROWTH_ANNUAL: "price_growth_annual",
      STRIPE_PRICE_PRO_MONTHLY: "price_pro_monthly",
      STRIPE_PRICE_PRO_ANNUAL: "price_pro_annual",
      RESEND_API_KEY: "re_test_placeholder",
      RESEND_FROM_EMAIL: "test@example.com",
    },
    include: ["src/__tests__/api/**/*.test.ts", "src/__tests__/features/payments.test.ts"],
    exclude: ["node_modules", ".next"],
    server: {
      deps: {
        inline: ["next-auth"],
      },
    },
    // Run serially to avoid DB conflicts between test files
    pool: "forks",
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
  },
})
