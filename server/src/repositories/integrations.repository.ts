import { prisma } from '@/config/prisma.js'
import type { Prisma } from '@prisma/client'

export const integrationsRepository = {
  listForTenant(tenantId: string) {
    return prisma.integration.findMany({ where: { tenantId } })
  },

  findOne(tenantId: string, providerKey: string) {
    return prisma.integration.findUnique({ where: { tenantId_providerKey: { tenantId, providerKey } } })
  },

  setConnected(tenantId: string, providerKey: string, connected: boolean) {
    return prisma.integration.upsert({
      where: { tenantId_providerKey: { tenantId, providerKey } },
      create: { tenantId, providerKey, connected },
      update: { connected },
    })
  },

  saveConfig(tenantId: string, providerKey: string, config: Record<string, unknown>) {
    const json = config as Prisma.InputJsonValue
    return prisma.integration.upsert({
      where: { tenantId_providerKey: { tenantId, providerKey } },
      create: { tenantId, providerKey, connected: true, config: json, lastSyncedAt: new Date() },
      update: { connected: true, config: json, lastSyncedAt: new Date(), lastError: null },
    })
  },
}
