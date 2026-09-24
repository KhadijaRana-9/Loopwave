import { ApiError } from '@/utils/apiError.js'
import type { Message, Template } from '@prisma/client'

const CUSTOMER_SERVICE_WINDOW_MS = 24 * 60 * 60 * 1000

// WhatsApp only allows free-form (non-template) business replies within 24h
// of the customer's last message — outside that window, or before they've
// ever messaged in, only an approved template can reach them. This is a
// real Meta policy, not a Loopwave-invented restriction, and Meta enforces
// it server-side regardless of what we do here — this check just fails
// fast with a clear message instead of letting the send hit Meta and bounce.
export function assertCanSendFreeform(messages: Pick<Message, 'direction' | 'createdAt'>[]): void {
  const lastInbound = [...messages].reverse().find((m) => m.direction === 'INBOUND')
  if (!lastInbound) {
    throw ApiError.badRequest(
      'This contact has never messaged you on WhatsApp — send an approved template to start the conversation instead of a free-form message.',
    )
  }
  const elapsed = Date.now() - lastInbound.createdAt.getTime()
  if (elapsed > CUSTOMER_SERVICE_WINDOW_MS) {
    throw ApiError.badRequest('Outside the 24-hour customer service window for this contact — send an approved template instead of a free-form message.')
  }
}

// Business-initiated / marketing sends (campaigns, and any deliberate
// outreach outside an active customer-service reply) require real,
// recorded consent — never assumed. Freeform replies inside an open
// conversation are a separate policy dimension and aren't gated by this.
export function assertContactOptedIn(whatsappOptIn: 'OPTED_IN' | 'OPTED_OUT' | 'UNKNOWN'): void {
  if (whatsappOptIn !== 'OPTED_IN') {
    throw ApiError.badRequest(
      whatsappOptIn === 'OPTED_OUT'
        ? 'This contact has opted out of WhatsApp messages.'
        : 'This contact has not opted in to WhatsApp messages yet.',
    )
  }
}

export function assertTemplateApproved(template: Pick<Template, 'status' | 'name'>): void {
  if (template.status !== 'APPROVED') {
    throw ApiError.badRequest(`Template "${template.name}" is not approved by Meta yet (status: ${template.status.toLowerCase()}) — it can't be sent until it is.`)
  }
}
