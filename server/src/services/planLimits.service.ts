import { prisma } from '@/config/prisma.js'
import { getMonthlyUsage } from '@/services/usage.service.js'
import { ApiError } from '@/utils/apiError.js'

interface PlanLimits {
  contacts?: number
  teamMembers?: number
  whatsappNumbers?: number
  chatbotFlows?: number
  automationWorkflows?: number
  monthlyConversations?: number
  monthlyMarketingMessages?: number
  aiUsage?: number
  storageGb?: number
  integrations?: number
  [key: string]: number | undefined
}

// -1 in a plan's limits JSON means unlimited, mirroring PLAN_LIMIT_KEYS /
// usagePercent in the frontend's src/constants/plans.js — same convention on
// both sides so a plan record edited in Super Admin means the same thing to
// both the UI meter and this server-side gate.
export async function assertUnderLimit(tenantId: string, metric: keyof PlanLimits, currentCount: number) {
  const subscription = await prisma.subscription.findUnique({ where: { tenantId }, include: { plan: true } })
  if (!subscription) return // no subscription record yet — fail open rather than block onboarding edge cases

  const limits = subscription.plan.limits as PlanLimits
  const limit = limits[metric]
  if (limit === undefined || limit === -1) return
  if (currentCount >= limit) throw ApiError.planLimitReached(String(metric))
}

// For rolling monthly metrics (messages sent, AI generations) where the
// question isn't "is a stock count at capacity" but "does used + this
// request fit inside the monthly allowance". Backend-authoritative: the
// frontend may show an estimate, but this is what actually blocks a send.
export async function assertUsageAllowance(tenantId: string, metric: keyof PlanLimits, additionalAmount: number) {
  const subscription = await prisma.subscription.findUnique({ where: { tenantId }, include: { plan: true } })
  if (!subscription) return { limit: -1, used: 0, remaining: Infinity }

  const limits = subscription.plan.limits as PlanLimits
  const limit = limits[metric]
  const usage = await getMonthlyUsage(tenantId)
  const used = usage[String(metric)] ?? 0

  if (limit === undefined || limit === -1) return { limit: -1, used, remaining: Infinity }

  const remaining = Math.max(0, limit - used)
  if (additionalAmount > remaining) {
    throw ApiError.usageAllowanceExceeded(
      `You selected ${additionalAmount.toLocaleString()} recipients, but your plan currently has ${remaining.toLocaleString()} messages available.`,
      { limit, used, requested: additionalAmount, remaining },
    )
  }
  return { limit, used, remaining }
}
