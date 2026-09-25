import { prisma } from '@/config/prisma.js'
import type { LeadStatus, Prisma } from '@prisma/client'

export interface AudienceFilter {
  mode?: 'all' | 'filter' | 'contacts'
  tags?: string[]
  sources?: string[]
  statuses?: string[]
  search?: string
  assignedAgentId?: string
  contactIds?: string[]
}

export const campaignsRepository = {
  list(tenantId: string) {
    return prisma.campaign.findMany({ where: { tenantId }, include: { template: true }, orderBy: { createdAt: 'desc' } })
  },

  findById(tenantId: string, id: string) {
    return prisma.campaign.findFirst({ where: { id, tenantId }, include: { template: true } })
  },

  count(tenantId: string) {
    return prisma.campaign.count({ where: { tenantId } })
  },

  create(tenantId: string, data: Omit<Prisma.CampaignUncheckedCreateInput, 'tenantId'>) {
    return prisma.campaign.create({ data: { ...data, tenantId }, include: { template: true } })
  },

  async update(tenantId: string, id: string, data: Prisma.CampaignUncheckedUpdateInput) {
    const existing = await prisma.campaign.findFirst({ where: { id, tenantId }, select: { id: true } })
    if (!existing) return null
    return prisma.campaign.update({ where: { id }, data, include: { template: true } })
  },

  async stats(campaignId: string) {
    const [recipientCounts, eventCounts, audienceSize, demoSent] = await Promise.all([
      prisma.campaignRecipient.groupBy({ by: ['status'], where: { campaignId }, _count: { _all: true } }),
      prisma.campaignEvent.groupBy({ by: ['type'], where: { campaignId }, _count: { _all: true } }),
      prisma.campaignRecipient.count({ where: { campaignId } }),
      // Surfaced so the UI can never present a simulated send run (no real
      // WhatsApp number connected at dispatch time) as indistinguishable
      // from a real Meta-confirmed one.
      prisma.campaignRecipient.count({ where: { campaignId, demo: true } }),
    ])
    const byStatus = Object.fromEntries(recipientCounts.map((r) => [r.status, r._count._all]))
    const byEvent = Object.fromEntries(eventCounts.map((e) => [e.type, e._count._all]))
    return {
      audienceSize,
      sent: (byStatus.SENT ?? 0) + (byStatus.DELIVERED ?? 0) + (byStatus.READ ?? 0),
      delivered: (byStatus.DELIVERED ?? 0) + (byStatus.READ ?? 0),
      read: byStatus.READ ?? 0,
      failed: byStatus.FAILED ?? 0,
      replied: byEvent.replied ?? 0,
      clicked: byEvent.clicked ?? 0,
      converted: byEvent.converted ?? 0,
      demoSent,
    }
  },

  // Server-side audience resolution — the one place "select all" actually
  // gets resolved. Eligibility (opted in, has a phone number) is enforced
  // here so it can never be bypassed by a frontend that forgot to filter.
  audienceWhere(tenantId: string, filter: AudienceFilter): Prisma.ContactWhereInput {
    const eligible: Prisma.ContactWhereInput = { tenantId, whatsappOptIn: 'OPTED_IN', phone: { not: '' } }
    if (filter.mode === 'contacts') {
      return { ...eligible, id: { in: filter.contactIds ?? [] } }
    }
    if (filter.mode === 'all') return eligible

    const and: Prisma.ContactWhereInput[] = []
    if (filter.tags?.length) and.push({ tags: { some: { tag: { name: { in: filter.tags } } } } })
    if (filter.sources?.length) and.push({ source: { in: filter.sources } })
    if (filter.statuses?.length) and.push({ leadStatus: { in: filter.statuses.map((s) => s.toUpperCase()) as LeadStatus[] } })
    if (filter.assignedAgentId) and.push({ assignedAgentId: filter.assignedAgentId })
    if (filter.search) {
      and.push({
        OR: [
          { name: { contains: filter.search, mode: 'insensitive' } },
          { phone: { contains: filter.search } },
          { company: { contains: filter.search, mode: 'insensitive' } },
        ],
      })
    }
    return and.length ? { ...eligible, AND: and } : eligible
  },

  countAudience(tenantId: string, filter: AudienceFilter) {
    return prisma.contact.count({ where: this.audienceWhere(tenantId, filter) })
  },

  resolveAudience(tenantId: string, filter: AudienceFilter) {
    return prisma.contact.findMany({ where: this.audienceWhere(tenantId, filter), select: { id: true, phone: true, name: true } })
  },

  createRecipients(campaignId: string, contactIds: string[]) {
    return prisma.campaignRecipient.createMany({ data: contactIds.map((contactId) => ({ campaignId, contactId })), skipDuplicates: true })
  },

  pendingRecipients(campaignId: string) {
    return prisma.campaignRecipient.findMany({ where: { campaignId, status: 'PENDING' } })
  },

  updateRecipient(id: string, data: Prisma.CampaignRecipientUncheckedUpdateInput) {
    return prisma.campaignRecipient.update({ where: { id }, data })
  },

  // Bridges the real Meta delivery/read webhook (matched by waMessageId) to
  // the campaign recipient it belongs to — without this, real-provider sends
  // would show accurate Message status but frozen PENDING campaign stats.
  updateRecipientByWaMessageId(waMessageId: string, data: Prisma.CampaignRecipientUncheckedUpdateInput) {
    return prisma.campaignRecipient.updateMany({ where: { waMessageId }, data })
  },

  // Meta does not guarantee status webhooks arrive in order (a late
  // "delivered" can land after "read"), so a status may only ADVANCE: it is
  // applied only if the recipient is currently at an earlier stage. Without
  // this, campaign delivery/read stats could silently go backwards.
  advanceRecipientByWaMessageId(
    waMessageId: string,
    status: 'SENT' | 'DELIVERED' | 'READ' | 'FAILED',
    extra: Prisma.CampaignRecipientUncheckedUpdateInput = {},
  ) {
    const earlier: Record<typeof status, ('PENDING' | 'SENT' | 'DELIVERED' | 'READ')[]> = {
      SENT: ['PENDING'],
      DELIVERED: ['PENDING', 'SENT'],
      READ: ['PENDING', 'SENT', 'DELIVERED'],
      FAILED: ['PENDING', 'SENT'],
    }
    return prisma.campaignRecipient.updateMany({ where: { waMessageId, status: { in: earlier[status] } }, data: { ...extra, status } })
  },

  addEvent(campaignId: string, type: string, meta: Prisma.InputJsonValue = {}) {
    return prisma.campaignEvent.create({ data: { campaignId, type, meta } })
  },

  // Most recent campaign this contact actually received a message from
  // (SENT/DELIVERED/READ, i.e. excluding still-PENDING/FAILED rows) — used to
  // attribute an inbound reply back to the campaign that likely prompted it.
  mostRecentDeliveredRecipient(contactId: string) {
    return prisma.campaignRecipient.findFirst({
      where: { contactId, status: { in: ['SENT', 'DELIVERED', 'READ'] } },
      orderBy: { sentAt: 'desc' },
    })
  },

  hasReplyEvent(campaignId: string, contactId: string) {
    return prisma.campaignEvent.findFirst({ where: { campaignId, type: 'replied', meta: { path: ['contactId'], equals: contactId } } })
  },
}
