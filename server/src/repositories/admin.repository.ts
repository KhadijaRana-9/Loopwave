import { prisma } from '@/config/prisma.js'
import type { Prisma, TenantStatus } from '@prisma/client'

export const adminRepository = {
  listTenants() {
    return prisma.tenant.findMany({
      include: { subscription: { include: { plan: true } }, memberships: { where: { status: 'ACTIVE' } } },
      orderBy: { createdAt: 'desc' },
    })
  },

  async setStatus(id: string, status: TenantStatus) {
    const result = await prisma.tenant.updateMany({ where: { id }, data: { status } })
    return result.count > 0
  },

  countByStatus() {
    return prisma.tenant.groupBy({ by: ['status'], _count: { _all: true } })
  },

  async sumActiveMrr() {
    const subs = await prisma.subscription.findMany({ where: { status: 'ACTIVE' }, include: { plan: true } })
    return subs.reduce((sum, s) => sum + (s.plan.price ?? 0), 0)
  },

  listPlatformUsers() {
    return prisma.membership.findMany({
      where: { status: { not: 'DISABLED' } },
      include: { user: true, tenant: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    })
  },

  listPlans() {
    return prisma.plan.findMany({ orderBy: { price: 'asc' } })
  },

  updatePlan(id: string, data: Prisma.PlanUpdateInput) {
    return prisma.plan.update({ where: { id }, data })
  },

  createPlan(data: Prisma.PlanCreateInput) {
    return prisma.plan.create({ data })
  },

  listAiAgentsAcrossTenants() {
    return prisma.aIAgent.findMany({ include: { tenant: { select: { name: true } } }, orderBy: { createdAt: 'desc' }, take: 200 })
  },

  listCampaignsAcrossTenants() {
    return prisma.campaign.findMany({
      include: { tenant: { select: { name: true } }, template: true, recipients: true, events: true },
      orderBy: { createdAt: 'desc' },
      take: 200,
    })
  },

  listAuditLogs() {
    return prisma.auditLog.findMany({ include: { tenant: { select: { name: true } }, user: { select: { name: true } } }, orderBy: { createdAt: 'desc' }, take: 100 })
  },

  writeAuditLog(params: { userId?: string; tenantId?: string; action: string; entityType?: string; entityId?: string; meta?: object; ip?: string }) {
    return prisma.auditLog.create({ data: params })
  },
}
