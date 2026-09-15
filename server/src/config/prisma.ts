import { PrismaClient } from '@prisma/client'
import { isProduction } from './env.js'

// Single shared client — avoids exhausting the Postgres connection pool
// under tsx's hot-reload, which would otherwise create a new client per reload.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: isProduction ? ['error', 'warn'] : ['error', 'warn'],
  })

if (!isProduction) globalForPrisma.prisma = prisma
