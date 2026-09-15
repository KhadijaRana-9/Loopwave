import { prisma } from '@/config/prisma.js'
import type { LeadStatus, Prisma } from '@prisma/client'

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
    const [recipientCounts, eventCounts, audienceSize] = await Promise.all([
      prisma.campaignRecipient.groupBy({ by: ['status'], where: { campaignId }, _count: { _all: true } }),
      prisma.campaignEvent.groupBy({ by: ['type'], where: { campaignId }, _count: { _all: true } }),
      prisma.campaignRecipient.count({ where: { campaignId } }),
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
    }
  },

  resolveAudience(tenantId: string, filter: { tags?: string[]; sources?: string[]; statuses?: string[] }) {
    const where: Prisma.ContactWhereInput = { tenantId }
    const and: Prisma.ContactWhereInput[] = []
    if (filter.tags?.length) and.push({ tags: { some: { tag: { name: { in: filter.tags } } } } })
    if (filter.sources?.length) and.push({ source: { in: filter.sources } })
    if (filter.statuses?.length) and.push({ leadStatus: { in: filter.statuses.map((s) => s.toUpperCase()) as LeadStatus[] } })
    if (and.length) where.AND = and
    return prisma.contact.findMany({ where, select: { id: true, phone: true, name: true } })
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

  addEvent(campaignId: string, type: string) {
    return prisma.campaignEvent.create({ data: { campaignId, type } })
  },
}
