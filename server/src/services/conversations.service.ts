import { conversationsRepository, type ListConversationsFilters } from '@/repositories/conversations.repository.js'
import { attachAuthorNames, resolveAuthorName } from '@/utils/notes.js'
import { sendWhatsAppMessage, scheduleDemoStatusProgression } from '@/integrations/whatsapp.adapter.js'
import { recordUsage } from '@/services/usage.service.js'
import { ApiError } from '@/utils/apiError.js'
import { prisma } from '@/config/prisma.js'

type ConversationWithRelations = NonNullable<Awaited<ReturnType<typeof conversationsRepository.findById>>>

function serializeMessage(message: ConversationWithRelations['messages'][number]) {
  return {
    id: message.id,
    direction: message.direction.toLowerCase(),
    type: message.type,
    text: message.text,
    mediaUrl: message.mediaUrl,
    status: message.status.toLowerCase(),
    errorMessage: message.errorMessage,
    createdAt: message.createdAt,
  }
}

async function serializeConversation(conversation: ConversationWithRelations) {
  const notes = await attachAuthorNames(conversation.notes)
  return {
    id: conversation.id,
    contactId: conversation.contactId,
    status: conversation.status.toLowerCase(),
    priority: conversation.priority.toLowerCase(),
    assignedAgentId: conversation.assignments[0]?.agentId ?? null,
    tags: conversation.contact.tags.map((t) => t.tag.name),
    unread: conversation.unreadCount,
    lastMessageAt: conversation.lastMessageAt,
    messages: conversation.messages.map(serializeMessage),
    notes: notes.map((n) => ({ id: n.id, author: n.author, text: n.text, createdAt: n.createdAt })),
    contact: {
      id: conversation.contact.id,
      name: conversation.contact.name,
      phone: conversation.contact.phone,
      email: conversation.contact.email,
    },
  }
}

export const conversationsService = {
  async list(tenantId: string, filters: ListConversationsFilters) {
    const conversations = await conversationsRepository.list(tenantId, filters)
    return Promise.all(conversations.map(serializeConversation))
  },

  async getById(tenantId: string, id: string) {
    const conversation = await conversationsRepository.findById(tenantId, id)
    if (!conversation) throw ApiError.notFound('Conversation not found')
    return serializeConversation(conversation)
  },

  async sendMessage(tenantId: string, conversationId: string, text: string) {
    const conversation = await conversationsRepository.findById(tenantId, conversationId)
    if (!conversation) throw ApiError.notFound('Conversation not found')

    const account = await prisma.whatsAppAccount.findFirst({
      where: { tenantId },
      include: { phoneNumbers: { where: { status: 'CONNECTED' }, take: 1 } },
    })

    const created = await conversationsRepository.addMessage(conversationId, {
      direction: 'OUTBOUND',
      type: 'text',
      text,
      status: 'QUEUED',
    })

    const result = await sendWhatsAppMessage({
      to: conversation.contact.phone,
      text,
      metaPhoneNumberId: account?.phoneNumbers[0]?.metaPhoneNumberId,
    })

    const updated = await prisma.message.update({
      where: { id: created.id },
      data: {
        status: result.status,
        waMessageId: result.waMessageId || null,
        errorMessage: result.errorMessage,
      },
    })

    if (result.status === 'SENT' && result.demo) scheduleDemoStatusProgression(updated.id)

    await conversationsRepository.touchLastMessage(conversationId, updated.createdAt, true)
    await recordUsage(tenantId, 'monthlyConversations')

    return serializeMessage(updated)
  },

  async assign(tenantId: string, id: string, agentId: string | null) {
    const updated = await conversationsRepository.assign(tenantId, id, agentId)
    if (!updated) throw ApiError.notFound('Conversation not found')
    return serializeConversation(updated)
  },

  async updateStatus(tenantId: string, id: string, status: 'OPEN' | 'PENDING' | 'RESOLVED') {
    const ok = await conversationsRepository.setStatus(tenantId, id, status)
    if (!ok) throw ApiError.notFound('Conversation not found')
    return this.getById(tenantId, id)
  },

  async addNote(tenantId: string, conversationId: string, authorId: string | undefined, text: string) {
    const conversation = await prisma.conversation.findFirst({ where: { id: conversationId, tenantId }, select: { id: true } })
    if (!conversation) throw ApiError.notFound('Conversation not found')
    const note = await conversationsRepository.addNote(conversationId, authorId, text)
    const author = await resolveAuthorName(authorId)
    return { id: note.id, text: note.text, createdAt: note.createdAt, author }
  },
}
