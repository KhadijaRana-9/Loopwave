import { prisma } from '@/config/prisma.js'
import type { ConversationStatus, Prisma } from '@prisma/client'

export interface ListConversationsFilters {
  status?: ConversationStatus
  assignedAgentId?: string
  search?: string
}

const conversationInclude = {
  contact: { include: { tags: { include: { tag: true } } } },
  messages: { orderBy: { createdAt: 'asc' as const } },
  notes: { orderBy: { createdAt: 'desc' as const } },
  assignments: { where: { unassignedAt: null }, orderBy: { assignedAt: 'desc' as const }, take: 1 },
} satisfies Prisma.ConversationInclude

export const conversationsRepository = {
  async list(tenantId: string, filters: ListConversationsFilters) {
    const where: Prisma.ConversationWhereInput = { tenantId }
    if (filters.status) where.status = filters.status
    if (filters.assignedAgentId === 'unassigned') {
      where.assignments = { none: { unassignedAt: null } }
    } else if (filters.assignedAgentId) {
      where.assignments = { some: { agentId: filters.assignedAgentId, unassignedAt: null } }
    }
    if (filters.search) {
      where.contact = { name: { contains: filters.search, mode: 'insensitive' } }
    }
    return prisma.conversation.findMany({ where, include: conversationInclude, orderBy: { lastMessageAt: 'desc' } })
  },

  findById(tenantId: string, id: string) {
    return prisma.conversation.findFirst({ where: { id, tenantId }, include: conversationInclude })
  },

  findByContactId(tenantId: string, contactId: string) {
    return prisma.conversation.findFirst({ where: { tenantId, contactId }, include: conversationInclude })
  },

  async getOrCreateForContact(tenantId: string, contactId: string) {
    const existing = await this.findByContactId(tenantId, contactId)
    if (existing) return existing
    const created = await prisma.conversation.create({ data: { tenantId, contactId } })
    return this.findById(tenantId, created.id)
  },

  addMessage(conversationId: string, data: Omit<Prisma.MessageUncheckedCreateInput, 'conversationId'>) {
    return prisma.message.create({ data: { ...data, conversationId } })
  },

  async touchLastMessage(conversationId: string, at: Date, resetUnread: boolean) {
    return prisma.conversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: at, ...(resetUnread ? { unreadCount: 0 } : { unreadCount: { increment: 1 } }) },
    })
  },

  async setStatus(tenantId: string, id: string, status: ConversationStatus) {
    const result = await prisma.conversation.updateMany({ where: { id, tenantId }, data: { status } })
    return result.count > 0
  },

  async assign(tenantId: string, id: string, agentId: string | null) {
    const conversation = await prisma.conversation.findFirst({ where: { id, tenantId }, select: { id: true } })
    if (!conversation) return null
    await prisma.conversationAssignment.updateMany({ where: { conversationId: id, unassignedAt: null }, data: { unassignedAt: new Date() } })
    if (agentId) {
      await prisma.conversationAssignment.create({ data: { conversationId: id, agentId } })
    }
    return this.findById(tenantId, id)
  },

  addNote(conversationId: string, authorId: string | undefined, text: string) {
    return prisma.conversationNote.create({ data: { conversationId, authorId, text } })
  },
}
