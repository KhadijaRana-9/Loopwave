import crypto from 'node:crypto'
import { env, integrationReadiness } from '@/config/env.js'
import { prisma } from '@/config/prisma.js'

export interface SendMessageResult {
  waMessageId: string
  status: 'SENT' | 'FAILED'
  demo: boolean
  errorMessage?: string
}

// Sends through the real Meta WhatsApp Cloud API when a workspace has valid
// credentials configured; otherwise runs a clearly-labeled demo simulation.
// Demo mode still writes real status transitions to the database — it never
// fakes a "connected" state, it just can't reach a real WhatsApp number yet.
export async function sendWhatsAppMessage(params: { to: string; text: string; metaPhoneNumberId?: string | null }): Promise<SendMessageResult> {
  if (integrationReadiness.whatsapp && params.metaPhoneNumberId) {
    try {
      const res = await fetch(`https://graph.facebook.com/${env.WHATSAPP_API_VERSION}/${params.metaPhoneNumberId}/messages`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ messaging_product: 'whatsapp', to: params.to, type: 'text', text: { body: params.text } }),
      })
      const payload = (await res.json().catch(() => null)) as { messages?: { id: string }[]; error?: { message?: string } } | null
      if (!res.ok) return { waMessageId: '', status: 'FAILED', demo: false, errorMessage: payload?.error?.message ?? `Meta API error (${res.status})` }
      return { waMessageId: payload?.messages?.[0]?.id ?? '', status: 'SENT', demo: false }
    } catch (err) {
      return { waMessageId: '', status: 'FAILED', demo: false, errorMessage: err instanceof Error ? err.message : 'Network error calling Meta API' }
    }
  }

  return { waMessageId: `demo_${crypto.randomUUID()}`, status: 'SENT', demo: true }
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
