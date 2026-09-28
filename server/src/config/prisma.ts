import { PrismaClient } from '@prisma/client'
import { isProduction } from './env.js'

// Single shared client — avoids exhausting the Postgres connection pool
// under tsx's hot-reload, which would otherwise create a new client per reload.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: isProduction ? ['error', 'warn'] : ['error', 'warn'],
    // Prisma's default interactive-transaction timeout is 5s. Signup, contact
    // create/update and the chatbot/AI-agent saves each run several sequential
    // queries inside one transaction; against a remote Postgres (Neon — a cold
    // start alone can take seconds, and each round-trip is ~0.5s from some
    // regions) that overran 5s and failed the whole request with P2028 (seen in
    // the test suite as signup 500s). A slow database should make a request
    // slow, not fail it.
    transactionOptions: { maxWait: 15_000, timeout: 30_000 },
  })

if (!isProduction) globalForPrisma.prisma = prisma
