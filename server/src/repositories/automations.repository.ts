import { prisma } from '@/config/prisma.js'
import type { Prisma } from '@prisma/client'

export const automationsRepository = {
  list(tenantId: string) {
    return prisma.automation.findMany({ where: { tenantId }, orderBy: { updatedAt: 'desc' } })
  },

  findById(tenantId: string, id: string) {
    return prisma.automation.findFirst({ where: { id, tenantId } })
  },

  count(tenantId: string) {
    return prisma.automation.count({ where: { tenantId } })
  },

  create(tenantId: string, data: Omit<Prisma.AutomationUncheckedCreateInput, 'tenantId'>) {
    return prisma.automation.create({ data: { ...data, tenantId } })
  },

  async update(tenantId: string, id: string, data: Prisma.AutomationUncheckedUpdateInput) {
    const existing = await prisma.automation.findFirst({ where: { id, tenantId }, select: { id: true } })
    if (!existing) return null
    return prisma.automation.update({ where: { id }, data })
  },

  listExecutions(automationId: string) {
    return prisma.automationExecution.findMany({ where: { automationId }, orderBy: { startedAt: 'desc' }, take: 25 })
  },

  createExecution(automationId: string, status: 'SUCCESS' | 'FAILED', errorMessage?: string) {
    return prisma.automationExecution.create({ data: { automationId, status, errorMessage, finishedAt: new Date() } })
  },
}
