import { prisma } from '@/config/prisma.js'

function currentPeriodKey(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

// Rolling monthly counters (conversations, marketing messages, AI replies,
// automation runs) — plan-limit enforcement for these reads the same rows via
// getUsageForTenant, so incrementing here is what actually gates a tenant
// once assertUnderLimit checks it (see planLimits.service.ts).
export async function recordUsage(tenantId: string, metric: string, amount = 1) {
  await prisma.usageRecord.create({ data: { tenantId, metric, amount, periodKey: currentPeriodKey() } })
}

export async function getMonthlyUsage(tenantId: string): Promise<Record<string, number>> {
  const periodKey = currentPeriodKey()
  const rows = await prisma.usageRecord.groupBy({ by: ['metric'], where: { tenantId, periodKey }, _sum: { amount: true } })
  const usage: Record<string, number> = {}
  for (const row of rows) usage[row.metric] = row._sum.amount ?? 0
  return usage
}

// Stock metrics (how many rows currently exist) plus the rolling monthly
// counters above, assembled into the same shape the frontend's usage meters
// already expect (see src/constants/plans.js PLAN_LIMIT_KEYS).
export async function getUsageSnapshot(tenantId: string) {
  const [contacts, teamMembers, whatsappNumbers, chatbotFlows, automationWorkflows, integrations, monthly, tenant] = await Promise.all([
    prisma.contact.count({ where: { tenantId } }),
    prisma.membership.count({ where: { tenantId, status: { not: 'DISABLED' } } }),
    prisma.whatsAppPhoneNumber.count({ where: { account: { tenantId } } }),
    prisma.chatbot.count({ where: { tenantId } }),
    prisma.automation.count({ where: { tenantId } }),
    prisma.integration.count({ where: { tenantId, connected: true } }),
    getMonthlyUsage(tenantId),
    prisma.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { createdAt: true } }),
  ])

  // How many days of analytics data the tenant could actually have accumulated
  // so far, not a fixed placeholder — a brand-new signup has 0, not some
  // arbitrary "you're already over the limit" number.
  const analyticsHistoryDays = Math.max(0, Math.floor((Date.now() - tenant.createdAt.getTime()) / 86_400_000))

  return {
    contacts,
    teamMembers,
    whatsappNumbers,
    chatbotFlows,
    automationWorkflows,
    integrations,
    monthlyConversations: monthly.monthlyConversations ?? 0,
    monthlyMarketingMessages: monthly.monthlyMarketingMessages ?? 0,
    aiUsage: monthly.aiUsage ?? 0,
    storageGb: 0,
    analyticsHistoryDays,
  }
}
