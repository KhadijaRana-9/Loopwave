import crypto from 'node:crypto'
import { env } from '@/config/env.js'
import { prisma } from '@/config/prisma.js'

export interface SendMessageResult {
  waMessageId: string
  status: 'SENT' | 'FAILED'
  demo: boolean
  errorMessage?: string
  /** Meta error code 190 = invalid/expired token — callers flip the number to REAUTHORIZATION_REQUIRED on this. */
  authError?: boolean
}

interface SendCommon {
  to: string
  /** The sending tenant's own connected number + decrypted token — never a shared/global credential. Omitted (or either half missing) => honest demo mode. */
  metaPhoneNumberId?: string | null
  accessToken?: string | null
}

export type SendMessagePayload =
  | (SendCommon & { kind: 'text'; text: string })
  | (SendCommon & { kind: 'media'; mediaType: 'image' | 'video' | 'document'; mediaId: string; caption?: string; filename?: string })
  | (SendCommon & { kind: 'template'; templateName: string; language: string; components?: unknown[] })

// Sends through the real Meta WhatsApp Cloud API when the tenant has a
// connected number + token; otherwise runs a clearly-labeled demo
// simulation. Demo mode still writes real status transitions to the
// database — it never fakes a "connected" state, it just can't reach a real
// WhatsApp number yet. Every real send uses the CALLING TENANT'S OWN token,
// resolved by the caller (conversations.service.ts / campaigns.service.ts) —
// this file never reads a shared/global credential.
export async function sendWhatsAppMessage(params: SendMessagePayload): Promise<SendMessageResult> {
  if (params.metaPhoneNumberId && params.accessToken) {
    try {
      const body = buildSendBody(params)
      const res = await fetch(`https://graph.facebook.com/${env.WHATSAPP_API_VERSION}/${params.metaPhoneNumberId}/messages`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${params.accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const payload = (await res.json().catch(() => null)) as { messages?: { id: string }[]; error?: { message?: string; code?: number } } | null
      if (!res.ok) {
        return {
          waMessageId: '',
          status: 'FAILED',
          demo: false,
          errorMessage: payload?.error?.message ?? `Meta API error (${res.status})`,
          authError: isTokenInvalidCode(payload?.error?.code),
        }
      }
      return { waMessageId: payload?.messages?.[0]?.id ?? '', status: 'SENT', demo: false }
    } catch (err) {
      return { waMessageId: '', status: 'FAILED', demo: false, errorMessage: err instanceof Error ? err.message : 'Network error calling Meta API' }
    }
  }

  return { waMessageId: `demo_${crypto.randomUUID()}`, status: 'SENT', demo: true }
}

// Meta OAuthException codes meaning "this token can't be used any more":
// 190 (invalid/expired/revoked access token, incl. its 458/460/463/467
// subcodes) and 102 (API session no longer valid). Anything else — rate
// limits, policy errors, a bad recipient — must NOT flip a healthy
// connection to REAUTHORIZATION_REQUIRED.
function isTokenInvalidCode(code: number | undefined): boolean {
  return code === 190 || code === 102
}

function buildSendBody(params: SendMessagePayload): Record<string, unknown> {
  // Contacts store phones however they were typed ("+92 300 1234567");
  // the Cloud API wants the bare international digits.
  const base = { messaging_product: 'whatsapp', to: params.to.replace(/\D/g, '') }
  if (params.kind === 'text') return { ...base, type: 'text', text: { body: params.text } }
  if (params.kind === 'media') {
    const mediaObject: Record<string, unknown> = { id: params.mediaId }
    if (params.caption) mediaObject.caption = params.caption
    if (params.mediaType === 'document' && params.filename) mediaObject.filename = params.filename
    return { ...base, type: params.mediaType, [params.mediaType]: mediaObject }
  }
  // template
  return {
    ...base,
    type: 'template',
    template: {
      name: params.templateName,
      language: { code: params.language },
      ...(params.components?.length ? { components: params.components } : {}),
    },
  }
}

// Only ever called on demo-mode sends. Simulates realistic delivery latency
// while writing a real, persisted status transition — not a UI-only fake.
export function scheduleDemoStatusProgression(messageId: string) {
  setTimeout(() => {
    prisma.message.update({ where: { id: messageId }, data: { status: 'DELIVERED' } }).catch(() => {})
  }, 1200 + Math.random() * 1200)
}

export function scheduleDemoRecipientProgression(recipientId: string) {
  setTimeout(() => {
    prisma.campaignRecipient.update({ where: { id: recipientId }, data: { status: 'DELIVERED', deliveredAt: new Date() } }).catch(() => {})
  }, 800 + Math.random() * 1500)
}
