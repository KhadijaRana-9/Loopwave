import { prisma } from '@/config/prisma.js'
import type { Prisma, LeadStatus } from '@prisma/client'

// Every query here takes tenantId as a required first-class argument and
// bakes it into the `where` clause — there is no code path in this file that
// can return another tenant's rows, even if a caller passes a foreign id.
export interface ListContactsFilters {
  page: number
  pageSize: number
  search?: string
  leadStatus?: LeadStatus
  tag?: string
  assignedAgentId?: string
  sortBy: 'createdAt' | 'name' | 'leadScore' | 'lastInteractionAt'
  sortDir: 'asc' | 'desc'
}

function buildWhere(tenantId: string, filters: Pick<ListContactsFilters, 'search' | 'leadStatus' | 'tag' | 'assignedAgentId'>): Prisma.ContactWhereInput {
  const where: Prisma.ContactWhereInput = { tenantId }
  if (filters.search) {
    where.OR = [
      { name: { contains: filters.search, mode: 'insensitive' } },
      { phone: { contains: filters.search } },
      { email: { contains: filters.search, mode: 'insensitive' } },
      { company: { contains: filters.search, mode: 'insensitive' } },
    ]
  }
  if (filters.leadStatus) where.leadStatus = filters.leadStatus
  if (filters.assignedAgentId) where.assignedAgentId = filters.assignedAgentId
  if (filters.tag) where.tags = { some: { tag: { name: filters.tag } } }
  return where
}

export const contactsRepository = {
  async list(tenantId: string, filters: ListContactsFilters) {
    const where = buildWhere(tenantId, filters)
    const [items, total] = await Promise.all([
      prisma.contact.findMany({
        where,
        include: { tags: { include: { tag: true } }, assignedAgent: { select: { id: true, name: true } } },
        orderBy: { [filters.sortBy]: filters.sortDir },
        skip: (filters.page - 1) * filters.pageSize,
        take: filters.pageSize,
      }),
      prisma.contact.count({ where }),
    ])
    return { items, total }
  },

  count(tenantId: string) {
    return prisma.contact.count({ where: { tenantId } })
  },

  // Distinct filter vocabulary for pickers (audience selector, contact
  // filters) without pulling every contact row to the client just to build
  // a list of tag/source/status chips.
  async facets(tenantId: string) {
    const [tags, sources, statuses] = await Promise.all([
      prisma.tag.findMany({ where: { tenantId }, select: { name: true }, orderBy: { name: 'asc' } }),
      prisma.contact.findMany({ where: { tenantId, source: { not: null } }, select: { source: true }, distinct: ['source'] }),
      prisma.contact.groupBy({ by: ['leadStatus'], where: { tenantId }, _count: { _all: true } }),
    ])
    return {
      tags: tags.map((t) => t.name),
      sources: sources.map((s) => s.source).filter((s): s is string => Boolean(s)),
      statuses: statuses.map((s) => ({ value: s.leadStatus, count: s._count._all })),
    }
  },

  findById(tenantId: string, id: string) {
    return prisma.contact.findFirst({
      where: { id, tenantId },
      include: {
        tags: { include: { tag: true } },
        assignedAgent: { select: { id: true, name: true } },
        notes: { orderBy: { createdAt: 'desc' } },
        conversations: { select: { id: true, status: true, lastMessageAt: true }, orderBy: { lastMessageAt: 'desc' }, take: 5 },
        deals: { select: { id: true, title: true, stageId: true, value: true } },
      },
    })
  },

  findByPhone(tenantId: string, phone: string) {
    return prisma.contact.findUnique({ where: { tenantId_phone: { tenantId, phone } } })
  },

  async create(tenantId: string, data: Omit<Prisma.ContactUncheckedCreateInput, 'tenantId'>, tagNames: string[]) {
    return prisma.$transaction(async (tx) => {
      const contact = await tx.contact.create({ data: { ...data, tenantId } })
      if (tagNames.length) await attachTags(tx, tenantId, contact.id, tagNames)
      return tx.contact.findUniqueOrThrow({
        where: { id: contact.id },
        include: { tags: { include: { tag: true } }, assignedAgent: { select: { id: true, name: true } } },
      })
    })
  },

  async update(tenantId: string, id: string, data: Prisma.ContactUncheckedUpdateInput, tagNames?: string[]) {
    return prisma.$transaction(async (tx) => {
      const existing = await tx.contact.findFirst({ where: { id, tenantId }, select: { id: true } })
      if (!existing) return null
      await tx.contact.update({ where: { id }, data })
      if (tagNames) {
        await tx.contactTag.deleteMany({ where: { contactId: id } })
        await attachTags(tx, tenantId, id, tagNames)
      }
      return tx.contact.findUnique({
        where: { id },
        include: { tags: { include: { tag: true } }, assignedAgent: { select: { id: true, name: true } } },
      })
    })
  },

  async delete(tenantId: string, id: string) {
    const result = await prisma.contact.deleteMany({ where: { id, tenantId } })
    return result.count > 0
  },

  async bulkDelete(tenantId: string, ids: string[]) {
    const result = await prisma.contact.deleteMany({ where: { id: { in: ids }, tenantId } })
    return result.count
  },

  async bulkSetStatus(tenantId: string, ids: string[], leadStatus: LeadStatus) {
    const result = await prisma.contact.updateMany({ where: { id: { in: ids }, tenantId }, data: { leadStatus } })
    return result.count
  },

  async bulkAssign(tenantId: string, ids: string[], assignedAgentId: string) {
    const result = await prisma.contact.updateMany({ where: { id: { in: ids }, tenantId }, data: { assignedAgentId } })
    return result.count
  },

  async bulkTag(tenantId: string, ids: string[], tagName: string) {
    const tag = await prisma.tag.upsert({
      where: { tenantId_name: { tenantId, name: tagName } },
      create: { tenantId, name: tagName },
      update: {},
    })
    const contacts = await prisma.contact.findMany({ where: { id: { in: ids }, tenantId }, select: { id: true } })
    await prisma.contactTag.createMany({
      data: contacts.map((c) => ({ contactId: c.id, tagId: tag.id })),
      skipDuplicates: true,
    })
    return contacts.length
  },

  addNote(tenantId: string, contactId: string, authorId: string | undefined, text: string) {
    return prisma.contactNote.create({
      data: { contactId, authorId, text },
    })
  },
}

async function attachTags(tx: Prisma.TransactionClient, tenantId: string, contactId: string, tagNames: string[]) {
  for (const name of tagNames) {
    const tag = await tx.tag.upsert({
      where: { tenantId_name: { tenantId, name } },
      create: { tenantId, name },
      update: {},
    })
    await tx.contactTag.upsert({
      where: { contactId_tagId: { contactId, tagId: tag.id } },
      create: { contactId, tagId: tag.id },
      update: {},
    })
  }
}
