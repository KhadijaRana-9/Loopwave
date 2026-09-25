import { prisma } from '@/config/prisma.js'
import { whatsappRepository } from '@/repositories/whatsapp.repository.js'
import { conversationsRepository } from '@/repositories/conversations.repository.js'
import { campaignsRepository } from '@/repositories/campaigns.repository.js'
import { sendWhatsAppMessage } from '@/integrations/whatsapp.adapter.js'
import * as metaGraph from '@/integrations/metaGraph.js'
import { uploadObject, mediaObjectKey, isStorageConfigured } from '@/integrations/storage.adapter.js'
import { decryptSecret } from '@/utils/crypto.js'
import { getIo } from '@/websocket/io.js'
import { serializeNotification } from '@/utils/serializers.js'
import { mapMetaTemplateStatus } from '@/utils/metaTemplateStatus.js'

// Meta's Cloud API webhook shape (trimmed to the fields we read):
// entry[].changes[].value.{ metadata.phone_number_id, contacts[].{wa_id,profile.name}, messages[], statuses[] }
// A separate change.field of 'message_template_status_update' carries
// template approval/rejection events instead of message/status events.
interface MetaWebhookMedia {
  id?: string
  mime_type?: string
  sha256?: string
  caption?: string
  filename?: string
}

interface MetaWebhookMessage {
  from?: string
  id?: string
  type?: string
  text?: { body?: string }
  image?: MetaWebhookMedia
  video?: MetaWebhookMedia
  document?: MetaWebhookMedia
}

interface MetaWebhookStatus {
  id?: string
  status?: string
  errors?: { code?: number; title?: string; message?: string; error_data?: { details?: string } }[]
}

interface MetaWebhookValue {
  metadata?: { phone_number_id?: string }
  contacts?: { wa_id?: string; profile?: { name?: string } }[]
  messages?: MetaWebhookMessage[]
  statuses?: MetaWebhookStatus[]
  event?: string
  // Meta sends this as a JSON *integer* (e.g. 1689556908129832), unlike the
  // string id our create-template call stored — always compare via String().
  message_template_id?: number | string
  reason?: string | null
}

interface MetaWebhookPayload {
  entry?: {
    changes?: { field?: string; value?: MetaWebhookValue }[]
  }[]
}

const STATUS_MAP: Record<string, 'SENT' | 'DELIVERED' | 'READ' | 'FAILED'> = {
  sent: 'SENT',
  delivered: 'DELIVERED',
  read: 'READ',
  failed: 'FAILED',
}

// A status may only move a message FORWARD — Meta doesn't guarantee webhook
// ordering, and a late "delivered" arriving after "read" must not regress it.
const EARLIER_MESSAGE_STATUSES = {
  SENT: ['QUEUED'],
  DELIVERED: ['QUEUED', 'SENT'],
  READ: ['QUEUED', 'SENT', 'DELIVERED'],
  FAILED: ['QUEUED', 'SENT'],
} as const

function describeStatusError(status: MetaWebhookStatus): string | undefined {
  const err = status.errors?.[0]
  if (!err) return undefined
  const text = err.error_data?.details ?? err.message ?? err.title ?? 'Message could not be delivered'
  return err.code ? `${text} (WhatsApp error ${err.code})` : text
}

const OPT_OUT_KEYWORDS = new Set(['stop', 'unsubscribe', 'stop promotions'])

// Turns a real (or realistically-shaped test) Meta webhook payload into
// actual inbox state: a real Contact, a real Conversation, a real inbound
// Message row (including media, downloaded from Meta and mirrored into our
// own storage) — not just a logged event.
export async function processWhatsAppWebhook(payload: MetaWebhookPayload): Promise<void> {
  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value
      if (!value) continue

      if (change.field === 'message_template_status_update') {
        await handleTemplateStatusUpdate(value)
        continue
      }

      const phoneNumberId = value.metadata?.phone_number_id
      const number = phoneNumberId ? await whatsappRepository.findByMetaPhoneNumberId(phoneNumberId) : null
      // No number registered for this phone_number_id — nothing to route
      // this event to. This is expected until a real WABA is connected and
      // its phone number's metaPhoneNumberId is recorded (see whatsapp.service.ts).
      if (!number) continue

      const tenantId = number.account.tenantId
      const accessToken = number.account.accessTokenCipher ? decryptSecret(number.account.accessTokenCipher) : null

      for (const message of value.messages ?? []) {
        if (!message.from) continue
        await handleInboundMessage(tenantId, message, value.contacts, accessToken)
      }

      // Delivery/read receipts for messages we sent — matched by the Meta
      // message id recorded when the outbound send succeeded.
      for (const status of value.statuses ?? []) {
        const mapped = status.status ? STATUS_MAP[status.status] : undefined
        if (!status.id || !mapped) continue
        const errorMessage = mapped === 'FAILED' ? describeStatusError(status) : undefined

        // Forward-only (see EARLIER_MESSAGE_STATUSES). Deliberately NOT
        // swallowing errors any more: a failed update must surface on the
        // WebhookEvent row (errorMessage) so a retry/investigation is possible,
        // not silently leave a message stuck at an old status.
        await prisma.message.updateMany({
          where: { waMessageId: status.id, status: { in: [...EARLIER_MESSAGE_STATUSES[mapped]] } },
          data: { status: mapped, ...(errorMessage ? { errorMessage } : {}) },
        })

        // Same status event also drives campaign recipient/analytics state
        // for real Meta sends — demo-mode sends get this from
        // scheduleDemoRecipientProgression instead (see whatsapp.adapter.ts).
        if (mapped === 'DELIVERED' || mapped === 'READ' || mapped === 'FAILED') {
          const extra =
            mapped === 'DELIVERED' ? { deliveredAt: new Date() } : mapped === 'READ' ? { readAt: new Date() } : { errorMessage: errorMessage ?? 'Message could not be delivered' }
          await campaignsRepository.advanceRecipientByWaMessageId(status.id, mapped, extra)
        }
      }
    }
  }
}

async function handleTemplateStatusUpdate(value: MetaWebhookValue) {
  if (value.message_template_id === undefined || value.message_template_id === null) return
  const status = mapMetaTemplateStatus(value.event)
  if (!status) return
  await prisma.template.updateMany({
    // String(): Meta sends the id as an integer, we stored it as a string.
    where: { metaTemplateId: String(value.message_template_id) },
    data: {
      status,
      rejectedReason: status === 'REJECTED' && value.reason && value.reason !== 'NONE' ? value.reason : null,
      metaSyncedAt: new Date(),
    },
  })
}

async function handleInboundMessage(tenantId: string, message: MetaWebhookMessage, contacts: MetaWebhookValue['contacts'], accessToken: string | null) {
  const contactName = contacts?.find((c) => c.wa_id === message.from)?.profile?.name ?? message.from!

  const contact = await findOrCreateInboundContact(tenantId, message.from!, contactName)

  const bodyText = message.text?.body ?? null
  await applyOptInSignal(tenantId, contact.id, contact.whatsappOptIn, bodyText, message.from!, accessToken)

  const conversation = await conversationsRepository.getOrCreateForContact(tenantId, contact.id)
  if (!conversation) return

  const mediaObj = message.image ?? message.video ?? message.document
  const mediaFields = mediaObj?.id ? await mirrorInboundMedia(tenantId, message.id!, mediaObj, accessToken) : {}

  const created = await conversationsRepository.addMessage(conversation.id, {
    direction: 'INBOUND',
    type: message.type ?? 'text',
    text: bodyText ?? mediaObj?.caption ?? null,
    status: 'RECEIVED',
    waMessageId: message.id,
    ...mediaFields,
  })
  await conversationsRepository.touchLastMessage(conversation.id, created.createdAt, false)

  // Attribute the reply to whichever campaign most recently messaged this
  // contact, so campaign analytics reflect real inbound replies instead of
  // only outbound delivery/read — see campaigns analytics "replied" stat
  // (campaigns.repository.ts#stats). One event per contact per campaign.
  const recentCampaignRecipient = await campaignsRepository.mostRecentDeliveredRecipient(contact.id)
  if (recentCampaignRecipient) {
    const alreadyRecorded = await campaignsRepository.hasReplyEvent(recentCampaignRecipient.campaignId, contact.id)
    if (!alreadyRecorded) await campaignsRepository.addEvent(recentCampaignRecipient.campaignId, 'replied', { contactId: contact.id })
  }

  const notification = await prisma.notification.create({
    data: { tenantId, category: 'new_lead', title: `New WhatsApp message from ${contactName}`, body: bodyText ?? undefined },
  })
  getIo()?.to(`tenant:${tenantId}`).emit('conversation:message', { conversationId: conversation.id })
  getIo()?.to(`tenant:${tenantId}`).emit('notification:new', serializeNotification(notification))
}

// Meta delivers `from` as bare digits ("923001234567") while contacts are
// stored E.164 ("+923001234567"). Upserting on the raw value would create a
// SECOND contact for every existing customer who replies — splitting the
// conversation and leaving the original contact's opt-in state untouched —
// so match either spelling first and store new contacts as E.164.
async function findOrCreateInboundContact(tenantId: string, from: string, name: string) {
  const digits = from.replace(/\D/g, '')
  const candidates = [`+${digits}`, digits]
  const existing = await prisma.contact.findFirst({ where: { tenantId, phone: { in: candidates } } })
  if (existing) return prisma.contact.update({ where: { id: existing.id }, data: { lastInteractionAt: new Date() } })
  try {
    return await prisma.contact.create({ data: { tenantId, name, phone: `+${digits}`, source: 'WhatsApp' } })
  } catch (err) {
    // Two messages from a brand-new contact processed concurrently: the
    // loser hits the (tenantId, phone) unique constraint — use the winner's row.
    const raced = await prisma.contact.findFirst({ where: { tenantId, phone: { in: candidates } } })
    if (raced) return raced
    throw err
  }
}

// A user messaging in is treated as implicit consent (standard practice
// under WhatsApp's Business Messaging Policy) — but only moves UNKNOWN to
// OPTED_IN, never overrides an explicit OPTED_OUT. A stop/unsubscribe
// keyword always wins and gets one real confirmation reply back — a
// working unsubscribe path, not just a flag flip.
async function applyOptInSignal(
  tenantId: string,
  contactId: string,
  currentStatus: 'OPTED_IN' | 'OPTED_OUT' | 'UNKNOWN',
  bodyText: string | null,
  fromPhone: string,
  accessToken: string | null,
) {
  const normalized = bodyText?.trim().toLowerCase() ?? ''
  if (OPT_OUT_KEYWORDS.has(normalized)) {
    if (currentStatus === 'OPTED_OUT') return
    await prisma.contact.update({ where: { id: contactId }, data: { whatsappOptIn: 'OPTED_OUT', optOutAt: new Date() } })
    const connected = await whatsappRepository.getConnectedCredentials(tenantId)
    if (connected?.metaPhoneNumberId && accessToken) {
      await sendWhatsAppMessage({
        kind: 'text',
        to: fromPhone,
        text: "You've been unsubscribed from WhatsApp messages from this business. Message us anytime to start a new conversation.",
        metaPhoneNumberId: connected.metaPhoneNumberId,
        accessToken,
      }).catch(() => {})
    }
    return
  }
  if (currentStatus === 'UNKNOWN') {
    await prisma.contact.update({ where: { id: contactId }, data: { whatsappOptIn: 'OPTED_IN', optInSource: 'whatsapp_reply' } })
  }
}

// Resolves Meta's short-lived media id to bytes and mirrors them into our
// own storage. If storage isn't configured yet, the message is still
// recorded (mime type, size, Meta's media id) — just without a mediaUrl —
// rather than silently dropping the event.
async function mirrorInboundMedia(tenantId: string, waMessageId: string, mediaObj: MetaWebhookMedia, accessToken: string | null) {
  if (!mediaObj.id || !accessToken) return {}
  try {
    const details = await metaGraph.getMediaUrl(mediaObj.id, accessToken)
    const fields: Record<string, unknown> = {
      mediaMimeType: details.mimeType,
      mediaSizeBytes: details.fileSizeBytes,
      mediaFileName: mediaObj.filename ?? null,
      metaMediaId: mediaObj.id,
    }
    if (isStorageConfigured()) {
      const bytes = await metaGraph.downloadMediaBytes(details.url, accessToken)
      const key = mediaObjectKey(tenantId, waMessageId, mediaObj.filename ?? `media-${waMessageId}`)
      await uploadObject(key, bytes, details.mimeType)
      fields.mediaUrl = key
    }
    return fields
  } catch {
    // Meta media fetch/download failed — the message is still recorded via
    // the caller without media fields rather than losing the whole event.
    return {}
  }
}
