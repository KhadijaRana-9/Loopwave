import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
    },
  },
  test: {
    environment: 'node',
    globals: false,
    // Generous timeouts: these are real integration tests against a Neon
    // serverless Postgres instance, which can take several seconds to wake
    // its compute back up after being idle (cold start), independent of
    // application code.
    testTimeout: 30_000,
    hookTimeout: 60_000,
    // Real integration tests against the live database configured in
    // server/.env — no mocking of Prisma. Run sequentially: tests create and
    // clean up their own tenants but share the same DB connection pool.
    fileParallelism: false,
  },
})
