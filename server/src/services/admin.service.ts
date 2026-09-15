import { adminRepository } from '@/repositories/admin.repository.js'
import { getUsageSnapshot } from '@/services/usage.service.js'
import { serializeAiAgent, serializePlan, serializeTeamMember } from '@/utils/serializers.js'
import { ApiError } from '@/utils/apiError.js'
import type { z } from 'zod'
import type { createPlanSchema, updatePlanSchema } from '@/validators/admin.validators.js'

export const adminService = {
  async listTenants() {
    const tenants = await adminRepository.listTenants()
    return tenants.map((t) => ({
      id: t.id,
      name: t.name,
      planId: t.subscription?.planId ?? null,
      plan: t.subscription?.plan ? serializePlan(t.subscription.plan) : null,
      status: t.status.toLowerCase(),
      mrr: t.subscription?.status === 'ACTIVE' ? (t.subscription.plan.price ?? 0) : 0,
      users: t.memberships.length,
      createdAt: t.createdAt,
    }))
  },

  async setTenantStatus(id: string, status: string, actorUserId: string) {
    const ok = await adminRepository.setStatus(id, status.toUpperCase() as never)
    if (!ok) throw ApiError.notFound('Tenant not found')
    await adminRepository.writeAuditLog({ userId: actorUserId, tenantId: id, action: 'tenant.status_changed', entityType: 'Tenant', entityId: id, meta: { status } })
    const tenants = await this.listTenants()
    return tenants.find((t) => t.id === id)
  },

  async getPlatformDashboard() {
    const [byStatus, mrr] = await Promise.all([adminRepository.countByStatus(), adminRepository.sumActiveMrr()])
    const countFor = (s: string) => byStatus.find((b) => b.status === s)?._count._all ?? 0
    const total = byStatus.reduce((sum, b) => sum + b._count._all, 0)
    return {
      totalBusinesses: total,
      activeBusinesses: countFor('ACTIVE'),
      trialBusinesses: countFor('TRIAL'),
      suspendedBusinesses: countFor('SUSPENDED'),
      paidBusinesses: countFor('ACTIVE'),
      mrr,
    }
  },

  async listPlatformUsers() {
    const memberships = await adminRepository.listPlatformUsers()
    return memberships.map((m) => ({ ...serializeTeamMember(m.user, m), tenantId: m.tenantId, tenantName: m.tenant.name }))
  },

  async listPlans() {
    return (await adminRepository.listPlans()).map(serializePlan)
  },

  async updatePlan(id: string, input: z.infer<typeof updatePlanSchema>) {
    const existing = await adminRepository.listPlans()
    const plan = existing.find((p) => p.id === id)
    if (!plan) throw ApiError.notFound('Plan not found')
    const limits = input.limits ? { ...(plan.limits as object), ...input.limits } : undefined
    const updated = await adminRepository.updatePlan(id, { ...input, ...(limits ? { limits } : {}) })
    return serializePlan(updated)
  },

  async createPlan(input: z.infer<typeof createPlanSchema>) {
    const created = await adminRepository.createPlan(input)
    return serializePlan(created)
  },

  async getTenantUsage(tenantId: string) {
    return getUsageSnapshot(tenantId)
  },

  async listAiAgentsAcrossTenants() {
    const agents = await adminRepository.listAiAgentsAcrossTenants()
    return agents.map((a) => ({ ...serializeAiAgent(a), tenantId: a.tenantId, tenantName: a.tenant.name }))
  },

  async listCampaignsAcrossTenants() {
    const campaigns = await adminRepository.listCampaignsAcrossTenants()
    return campaigns.map((c) => ({
      id: c.id,
      name: c.name,
      status: c.status.toLowerCase(),
      tenantId: c.tenantId,
      tenantName: c.tenant.name,
      template: c.template ? { name: c.template.name } : null,
      sent: c.recipients.filter((r) => r.status !== 'PENDING' && r.status !== 'FAILED').length,
      converted: c.events.filter((e) => e.type === 'converted').length,
      createdAt: c.createdAt,
    }))
  },

  async listSystemLogs() {
    const logs = await adminRepository.listAuditLogs()
    return logs.map((l) => ({
      id: l.id,
      level: (l.meta as { level?: string } | null)?.level ?? 'info',
      event: l.action,
      message: (l.meta as { message?: string } | null)?.message ?? l.action.replace(/[._]/g, ' '),
      tenant: l.tenant?.name ?? '—',
      user: l.user?.name ?? 'system',
      status: (l.meta as { status?: string } | null)?.status ?? 'success',
      createdAt: l.createdAt,
    }))
  },
}
