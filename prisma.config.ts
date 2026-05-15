import { defineConfig } from "prisma/config"

// Ensure local environment variables are loaded for Prisma CLI commands
try {
  process.loadEnvFile('.env.local')
} catch (e) {
  // Ignore if file doesn't exist
}

// Prisma 7: connection URL lives here (for migrate/studio commands)
// Runtime URL is passed via PrismaPg adapter in lib/prisma.ts
export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: process.env.DATABASE_URL,
  },
  migrations: {
    seed: "tsx prisma/seed.ts",
  },
})
