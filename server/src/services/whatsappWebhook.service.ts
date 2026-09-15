import { prisma } from '@/config/prisma.js'
import { whatsappRepository } from '@/repositories/whatsapp.repository.js'
import { conversationsRepository } from '@/repositories/conversations.repository.js'
import { getIo } from '@/websocket/io.js'
import { serializeNotification } from '@/utils/serializers.js'

// Meta's Cloud API webhook shape (trimmed to the fields we read):
// entry[].changes[].value.{ metadata.phone_number_id, contacts[].{wa_id,profile.name}, messages[], statuses[] }
interface MetaWebhookPayload {
  entry?: {
    changes?: {
      value?: {
        metadata?: { phone_number_id?: string }
        contacts?: { wa_id?: string; profile?: { name?: string } }[]
        messages?: { from?: string; id?: string; type?: string; text?: { body?: string } }[]
        statuses?: { id?: string; status?: string }[]
      }
    }[]
  }[]
}

const STATUS_MAP: Record<string, 'SENT' | 'DELIVERED' | 'READ' | 'FAILED'> = {
  sent: 'SENT',
  delivered: 'DELIVERED',
  read: 'READ',
  failed: 'FAILED',
}

// Turns a real (or realistically-shaped test) Meta webhook payload into
// actual inbox state: a real Contact, a real Conversation, a real inbound
// Message row — not just a logged event. This is what makes "receive a
// WhatsApp message" a real feature instead of only outbound sending being wired up.
export async function processWhatsAppWebhook(payload: MetaWebhookPayload): Promise<void> {
  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value
      if (!value) continue

      const phoneNumberId = value.metadata?.phone_number_id
      const number = phoneNumberId ? await whatsappRepository.findByMetaPhoneNumberId(phoneNumberId) : null
      // No number registered for this phone_number_id — nothing to route
      // this event to. This is expected until a real WABA is connected and
      // its phone number's metaPhoneNumberId is recorded (see whatsapp.service.ts).
      if (!number) continue

      const tenantId = number.account.tenantId

      for (const message of value.messages ?? []) {
        if (!message.from) continue
        const contactName = value.contacts?.find((c) => c.wa_id === message.from)?.profile?.name ?? message.from

        const contact = await prisma.contact.upsert({
          where: { tenantId_phone: { tenantId, phone: message.from } },
          create: { tenantId, name: contactName, phone: message.from, source: 'WhatsApp' },
          update: { lastInteractionAt: new Date() },
        })

        const conversation = await conversationsRepository.getOrCreateForContact(tenantId, contact.id)
        if (!conversation) continue

        const created = await conversationsRepository.addMessage(conversation.id, {
          direction: 'INBOUND',
          type: message.type ?? 'text',
          text: message.text?.body ?? null,
          status: 'RECEIVED',
          waMessageId: message.id,
        })
        await conversationsRepository.touchLastMessage(conversation.id, created.createdAt, false)

        const notification = await prisma.notification.create({
          data: { tenantId, category: 'new_lead', title: `New WhatsApp message from ${contactName}`, body: message.text?.body ?? undefined },
        })
        getIo()?.to(`tenant:${tenantId}`).emit('conversation:message', { conversationId: conversation.id })
        getIo()?.to(`tenant:${tenantId}`).emit('notification:new', serializeNotification(notification))
      }

      // Delivery/read receipts for messages we sent — matched by the Meta
      // message id recorded when the outbound send succeeded.
      for (const status of value.statuses ?? []) {
        const mapped = status.status ? STATUS_MAP[status.status] : undefined
        if (!status.id || !mapped) continue
        await prisma.message.updateMany({ where: { waMessageId: status.id }, data: { status: mapped } }).catch(() => {})
      }
    }
  }
}
