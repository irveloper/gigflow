import { defineConfig } from "vitest/config"
import react from "@vitejs/plugin-react"
import tsconfigPaths from "vite-tsconfig-paths"

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    environment: "jsdom",
    globals: true,
    env: {
      DATABASE_URL: "postgresql://localhost:5432/test",
      NEXTAUTH_SECRET: "test-secret-for-vitest",
      NEXTAUTH_URL: "http://localhost:3000",
      AWS_REGION: "us-east-1",
      AWS_ACCESS_KEY_ID: "test-key-id",
      AWS_SECRET_ACCESS_KEY: "test-secret-key",
      AWS_S3_BUCKET: "test-bucket",
    },
    setupFiles: ["./vitest.setup.ts"],
    include: ["**/__tests__/**/*.{test,spec}.ts?(x)", "**/*.{test,spec}.ts?(x)"],
    exclude: [
      "node_modules",
      ".next",
      // scenario files are living docs, not test runners
      "specs/features/**/*.scenarios.ts",
      // integration tests require a real database — run via pnpm test:integration
      "__tests__/api/**",
    ],
    coverage: {
      provider: "v8",
      include: ["features/**", "entities/**", "shared/**"],
      exclude: ["**/__tests__/**", "specs/**"],
      reporter: ["text", "json-summary"],
    },
  },
})
