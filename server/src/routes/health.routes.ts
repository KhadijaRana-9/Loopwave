import { Router } from 'express'
import { prisma } from '@/config/prisma.js'
import { integrationReadiness } from '@/config/env.js'

const router = Router()

router.get('/health', (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() })
})

router.get('/ready', async (_req, res) => {
  const checks: Record<string, 'ok' | 'error'> = { database: 'ok' }
  try {
    await prisma.$queryRaw`SELECT 1`
  } catch {
    checks.database = 'error'
  }

  const ready = Object.values(checks).every((v) => v === 'ok')
  res.status(ready ? 200 : 503).json({ status: ready ? 'ready' : 'not_ready', checks, integrations: integrationReadiness })
})

export default router
