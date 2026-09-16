import { prisma } from '@/config/prisma.js'
import { getMonthlyUsage } from '@/services/usage.service.js'

function dayKey(d: Date) {
  return d.toISOString().slice(0, 10)
}

function series(days: number, dates: string[]) {
  const counts = new Map<string, number>()
  for (const d of dates) counts.set(d, (counts.get(d) ?? 0) + 1)
  const out: { date: string; value: number }[] = []
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const key = dayKey(d)
    out.push({ date: key, value: counts.get(key) ?? 0 })
  }
  return out
}

function pct(part: number, total: number) {
  return total === 0 ? 0 : Number(((part / total) * 100).toFixed(1))
}

// A real (if simple) trend signal: first half of the window vs. second half,
// rather than a fabricated random-looking percentage. Returns null — not a
// fake 0% — when there isn't enough of a baseline to compare against.
function halfPeriodChange<T extends { createdAt: Date }>(part: (rows: T[]) => number, rows: T[], since: Date, days: number): string | null {
  const midpoint = new Date(since.getTime() + (days * 86_400_000) / 2)
  const firstHalf = rows.filter((r) => r.createdAt < midpoint)
  const secondHalf = rows.filter((r) => r.createdAt >= midpoint)
  if (firstHalf.length === 0) return null
  const before = part(firstHalf)
  const after = part(secondHalf)
  const diff = Number((after - before).toFixed(1))
  if (diff === 0) return '0%'
  return `${diff > 0 ? '+' : ''}${diff}%`
}

// Every number below comes from a real query against this tenant's own data
// — no hard-coded or randomized figures. A metric with no cheap real
// period-over-period comparison reports a plain value instead of a
// fabricated trend arrow (see Section 21: "avoid misleading visualizations").
export const analyticsService = {
  async messaging(tenantId: string, days: number) {
    const since = new Date(Date.now() - days * 86_400_000)
    const messages = await prisma.message.findMany({
      where: { conversation: { tenantId }, direction: 'OUTBOUND', createdAt: { gte: since } },
      select: { conversationId: true, status: true, createdAt: true },
    })
    const total = messages.length
    const delivered = messages.filter((m) => m.status === 'DELIVERED' || m.status === 'READ')
    const read = messages.filter((m) => m.status === 'READ')

    // "Replied" is a real relationship, not a status field: an outbound message counts
    // as replied when the same conversation has an inbound message after it.
    const conversationIds = [...new Set(messages.map((m) => m.conversationId))]
    const inboundMessages = conversationIds.length
      ? await prisma.message.findMany({
          where: { conversationId: { in: conversationIds }, direction: 'INBOUND' },
          select: { conversationId: true, createdAt: true },
        })
      : []
    const inboundByConversation = new Map<string, Date[]>()
    for (const m of inboundMessages) {
      const list = inboundByConversation.get(m.conversationId) ?? []
      list.push(m.createdAt)
      inboundByConversation.set(m.conversationId, list)
    }
    const wasReplied = (m: (typeof messages)[number]) => (inboundByConversation.get(m.conversationId) ?? []).some((t) => t > m.createdAt)
    const replied = messages.filter(wasReplied)

    const deliveredRate = (rows: typeof messages) => pct(rows.filter((m) => m.status === 'DELIVERED' || m.status === 'READ').length, rows.length || 1)
    const readRateOf = (rows: typeof messages) => pct(rows.filter((m) => m.status === 'READ').length, rows.length || 1)
    const replyRateOf = (rows: typeof messages) => pct(rows.filter(wasReplied).length, rows.length || 1)
    return {
      sent: series(days, messages.map((m) => dayKey(m.createdAt))),
      delivered: series(days, delivered.map((m) => dayKey(m.createdAt))),
      read: series(days, read.map((m) => dayKey(m.createdAt))),
      deliveryRate: pct(delivered.length, total),
      readRate: pct(read.length, total),
      replyRate: pct(replied.length, total),
      deliveryRateChange: halfPeriodChange(deliveredRate, messages, since, days),
      readRateChange: halfPeriodChange(readRateOf, messages, since, days),
      replyRateChange: halfPeriodChange(replyRateOf, messages, since, days),
      totalSent: total,
    }
  },

  async campaigns(tenantId: string, days: number) {
    const since = new Date(Date.now() - days * 86_400_000)
    const campaigns = await prisma.campaign.findMany({
      where: { tenantId, createdAt: { gte: since } },
      include: { recipients: true, events: true },
    })
    const performance = series(days, campaigns.map((c) => dayKey(c.createdAt)))
    const topCampaigns = campaigns
      .map((c) => ({
        name: c.name,
        converted: c.events.filter((e) => e.type === 'converted').length,
        ctr: pct(c.events.filter((e) => e.type === 'clicked').length, c.recipients.length || 1),
      }))
      .sort((a, b) => b.converted - a.converted)
      .slice(0, 5)
    const totalRecipients = campaigns.reduce((sum, c) => sum + c.recipients.length, 0)
    const totalConverted = campaigns.reduce((sum, c) => sum + c.events.filter((e) => e.type === 'converted').length, 0)
    const conversionRateOf = (rows: typeof campaigns) => {
      const recipients = rows.reduce((sum, c) => sum + c.recipients.length, 0)
      const converted = rows.reduce((sum, c) => sum + c.events.filter((e) => e.type === 'converted').length, 0)
      return pct(converted, recipients || 1)
    }
    return {
      performance,
      conversionRate: pct(totalConverted, totalRecipients),
      conversionRateChange: halfPeriodChange(conversionRateOf, campaigns, since, days),
      topCampaigns,
    }
  },

  async contacts(tenantId: string, days: number) {
    const since = new Date(Date.now() - days * 86_400_000)
    const contacts = await prisma.contact.findMany({ where: { tenantId, createdAt: { gte: since } }, select: { createdAt: true, source: true } })
    const bySourceMap = new Map<string, number>()
    for (const c of contacts) bySourceMap.set(c.source ?? 'Unknown', (bySourceMap.get(c.source ?? 'Unknown') ?? 0) + 1)
    return {
      newContacts: series(days, contacts.map((c) => dayKey(c.createdAt))),
      bySource: [...bySourceMap.entries()].map(([name, value]) => ({ name, value })),
    }
  },

  async leads(tenantId: string) {
    const rows = await prisma.contact.groupBy({ by: ['leadStatus'], where: { tenantId }, _count: { _all: true } })
    const byStatus = Object.fromEntries(rows.map((r) => [r.leadStatus, r._count._all]))
    const order: { key: string; stage: string }[] = [
      { key: 'NEW', stage: 'New' },
      { key: 'QUALIFIED', stage: 'Qualified' },
      { key: 'CONTACTED', stage: 'Contacted' },
      { key: 'INTERESTED', stage: 'Interested' },
      { key: 'DEMO_BOOKED', stage: 'Demo Booked' },
      { key: 'CONVERTED', stage: 'Converted' },
    ]
    const agg = await prisma.contact.aggregate({ where: { tenantId }, _avg: { leadScore: true } })
    return {
      funnel: order.map((o) => ({ stage: o.stage, value: byStatus[o.key] ?? 0 })),
      avgLeadScore: Math.round(agg._avg.leadScore ?? 0),
    }
  },

  async conversion(tenantId: string, days: number) {
    const since = new Date(Date.now() - days * 86_400_000)
    const deals = await prisma.deal.findMany({ where: { tenantId, stage: { key: 'converted' }, updatedAt: { gte: since } }, select: { updatedAt: true, value: true } })
    const totalDeals = await prisma.deal.count({ where: { tenantId } })
    return {
      conversionTrend: series(days, deals.map((d) => dayKey(d.updatedAt))),
      conversionRate: pct(deals.length, totalDeals),
      revenueInfluenced: deals.reduce((sum, d) => sum + d.value, 0),
    }
  },

  async agents(tenantId: string) {
    const members = await prisma.membership.findMany({
      where: { tenantId, role: { in: ['MANAGER', 'SALES_AGENT', 'SUPPORT_AGENT'] }, status: 'ACTIVE' },
      include: { user: true },
    })
    const results = await Promise.all(
      members.map(async (m) => {
        const [handled, resolved] = await Promise.all([
          prisma.conversationAssignment.count({ where: { agentId: m.userId, conversation: { tenantId } } }),
          prisma.conversation.count({ where: { tenantId, status: 'RESOLVED', assignments: { some: { agentId: m.userId } } } }),
        ])
        return { agentId: m.userId, name: m.user.name, conversationsHandled: handled, resolutionRate: pct(resolved, handled) }
      }),
    )
    return results
  },

  async aiUsage(tenantId: string, days: number) {
    const since = new Date(Date.now() - days * 86_400_000)
    const rows = await prisma.usageRecord.findMany({ where: { tenantId, metric: 'aiUsage', createdAt: { gte: since } }, select: { createdAt: true } })
    const agents = await prisma.aIAgent.aggregate({ where: { tenantId }, _sum: { conversationsHandled: true } })
    return { conversations: series(days, rows.map((r) => dayKey(r.createdAt))), totalHandled: agents._sum.conversationsHandled ?? 0 }
  },

  async automations(tenantId: string) {
    const automations = await prisma.automation.findMany({ where: { tenantId }, include: { executions: true } })
    const totalRuns = automations.reduce((sum, a) => sum + a.executions.length, 0)
    const successRuns = automations.reduce((sum, a) => sum + a.executions.filter((e) => e.status === 'SUCCESS').length, 0)
    return {
      totalRuns,
      successRate: pct(successRuns, totalRuns),
      topWorkflows: automations.map((a) => ({ name: a.name, runs: a.runsThisMonth })).sort((a, b) => b.runs - a.runs).slice(0, 5),
    }
  },

  async whatsappUsage(tenantId: string, days: number) {
    const since = new Date(Date.now() - days * 86_400_000)
    const messages = await prisma.message.findMany({ where: { conversation: { tenantId }, createdAt: { gte: since } }, select: { createdAt: true } })
    const numbers = await prisma.whatsAppPhoneNumber.findMany({ where: { account: { tenantId } }, select: { qualityRating: true } })
    const monthly = await getMonthlyUsage(tenantId)
    return {
      volume: series(days, messages.map((m) => dayKey(m.createdAt))),
      qualityRating: numbers.find((n) => n.qualityRating)?.qualityRating ?? 'unrated',
      monthlyMessageCount: monthly.monthlyMarketingMessages ?? 0,
    }
  },
}
