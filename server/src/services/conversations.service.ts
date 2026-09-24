import { conversationsRepository, type ListConversationsFilters } from '@/repositories/conversations.repository.js'
import { whatsappRepository } from '@/repositories/whatsapp.repository.js'
import { attachAuthorNames, resolveAuthorName } from '@/utils/notes.js'
import { sendWhatsAppMessage, scheduleDemoStatusProgression } from '@/integrations/whatsapp.adapter.js'
import * as metaGraph from '@/integrations/metaGraph.js'
import { uploadObject, getSignedReadUrl, mediaObjectKey, isStorageConfigured } from '@/integrations/storage.adapter.js'
import { assertMediaAllowed } from '@/utils/mediaLimits.js'
import { assertCanSendFreeform } from '@/services/whatsappCompliance.service.js'
import { recordUsage } from '@/services/usage.service.js'
import { notifyTenant } from '@/services/notifications.service.js'
import { decryptSecret } from '@/utils/crypto.js'
import { ApiError } from '@/utils/apiError.js'
import { prisma } from '@/config/prisma.js'

type ConversationWithRelations = NonNullable<Awaited<ReturnType<typeof conversationsRepository.findById>>>

function serializeMessage(message: ConversationWithRelations['messages'][number]) {
  return {
    id: message.id,
    direction: message.direction.toLowerCase(),
    type: message.type,
    text: message.text,
    mediaUrl: message.mediaUrl ? `/api/conversations/media/${message.id}` : null,
    mediaMimeType: message.mediaMimeType,
    mediaFileName: message.mediaFileName,
    status: message.status.toLowerCase(),
    errorMessage: message.errorMessage,
    demo: message.demo,
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

// The one place every outbound send resolves "can this tenant actually
// reach Meta right now" — a connected number + its decrypted token, or
// neither, never a shared/global fallback. See whatsapp.adapter.ts.
//
// A tenant with no WhatsApp number at all still gets the honest demo
// fallback (null/null) — but a number that WAS connected and Meta has
// since flagged (REAUTHORIZATION_REQUIRED/ERROR) must fail loudly here,
// not silently degrade into a fake "sent" demo message.
async function resolveSendCredentials(tenantId: string) {
  const connected = await whatsappRepository.getConnectedCredentials(tenantId)
  if (connected?.metaPhoneNumberId && connected.account.accessTokenCipher) {
    return { metaPhoneNumberId: connected.metaPhoneNumberId, accessToken: decryptSecret(connected.account.accessTokenCipher) }
  }
  const blocked = await whatsappRepository.findRequiringReauth(tenantId)
  if (blocked) {
    throw ApiError.badRequest('Your WhatsApp connection needs to be reauthorized before you can send messages — reconnect it in WhatsApp settings.')
  }
  return { metaPhoneNumberId: null, accessToken: null }
}

async function flagAuthErrorIfNeeded(tenantId: string, authError: boolean | undefined) {
  if (!authError) return
  const connected = await whatsappRepository.getConnectedCredentials(tenantId)
  if (!connected) return
  await whatsappRepository.updateNumberStatus(connected.id, 'REAUTHORIZATION_REQUIRED')
  await notifyTenant(tenantId, {
    category: 'integration_error',
    title: 'WhatsApp connection needs reauthorization',
    body: `Meta rejected a message sent from ${connected.label ?? connected.displayNumber} — reconnect it in WhatsApp settings to resume sending.`,
  })
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
    assertCanSendFreeform(conversation.messages)

    const { metaPhoneNumberId, accessToken } = await resolveSendCredentials(tenantId)

    const created = await conversationsRepository.addMessage(conversationId, {
      direction: 'OUTBOUND',
      type: 'text',
      text,
      status: 'QUEUED',
    })

    const result = await sendWhatsAppMessage({ kind: 'text', to: conversation.contact.phone, text, metaPhoneNumberId, accessToken })
    await flagAuthErrorIfNeeded(tenantId, result.authError)

    const updated = await prisma.message.update({
      where: { id: created.id },
      data: { status: result.status, waMessageId: result.waMessageId || null, errorMessage: result.errorMessage, demo: result.demo },
    })

    if (result.status === 'SENT' && result.demo) scheduleDemoStatusProgression(updated.id)

    await conversationsRepository.touchLastMessage(conversationId, updated.createdAt, true)
    await recordUsage(tenantId, 'monthlyConversations')

    return serializeMessage(updated)
  },

  // Agent-attached image/video/document reply. Same 24h-window rule as a
  // text reply — WhatsApp doesn't distinguish media from text for the
  // customer-service-window policy, only templates get an exception.
  async sendMedia(tenantId: string, conversationId: string, file: { buffer: Buffer; mimeType: string; filename: string }, caption?: string) {
    const conversation = await conversationsRepository.findById(tenantId, conversationId)
    if (!conversation) throw ApiError.notFound('Conversation not found')
    assertCanSendFreeform(conversation.messages)

    const { kind } = assertMediaAllowed(file.mimeType, file.buffer.length)
    const { metaPhoneNumberId, accessToken } = await resolveSendCredentials(tenantId)
    if (!metaPhoneNumberId || !accessToken) {
      throw ApiError.badRequest('Connect a real WhatsApp number before sending media — media cannot be simulated in demo mode.')
    }
    if (!isStorageConfigured()) {
      throw ApiError.badRequest('Media storage is not configured yet — set STORAGE_ENDPOINT/STORAGE_BUCKET/STORAGE_ACCESS_KEY_ID/STORAGE_SECRET_ACCESS_KEY.')
    }

    const created = await conversationsRepository.addMessage(conversationId, {
      direction: 'OUTBOUND',
      type: kind,
      text: caption ?? null,
      status: 'QUEUED',
      mediaMimeType: file.mimeType,
      mediaFileName: file.filename,
      mediaSizeBytes: file.buffer.length,
    })

    const key = mediaObjectKey(tenantId, created.id, file.filename)
    await uploadObject(key, file.buffer, file.mimeType)
    await prisma.message.update({ where: { id: created.id }, data: { mediaUrl: key } })

    const uploaded = await metaGraph.uploadMedia(metaPhoneNumberId, accessToken, file.buffer, file.mimeType, file.filename)
    const result = await sendWhatsAppMessage({
      kind: 'media',
      to: conversation.contact.phone,
      mediaType: kind,
      mediaId: uploaded.id,
      caption,
      filename: kind === 'document' ? file.filename : undefined,
      metaPhoneNumberId,
      accessToken,
    })
    await flagAuthErrorIfNeeded(tenantId, result.authError)

    const updated = await prisma.message.update({
      where: { id: created.id },
      data: { status: result.status, waMessageId: result.waMessageId || null, errorMessage: result.errorMessage, metaMediaId: uploaded.id, demo: result.demo },
    })

    await conversationsRepository.touchLastMessage(conversationId, updated.createdAt, true)
    await recordUsage(tenantId, 'monthlyConversations')

    return serializeMessage(updated)
  },

  // Tenant-scoped media proxy — never hands back a raw storage URL, mints a
  // short-lived signed one on demand (see storage.adapter.ts).
  async getMediaSignedUrl(tenantId: string, messageId: string): Promise<string> {
    const message = await prisma.message.findFirst({
      where: { id: messageId, conversation: { tenantId } },
      select: { mediaUrl: true },
    })
    if (!message?.mediaUrl) throw ApiError.notFound('Media not found')
    return getSignedReadUrl(message.mediaUrl)
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
