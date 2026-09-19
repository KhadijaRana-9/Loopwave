import { whatsappRepository } from '@/repositories/whatsapp.repository.js'
import { assertUnderLimit } from '@/services/planLimits.service.js'
import { serializeWhatsAppNumber } from '@/utils/serializers.js'
import { ApiError } from '@/utils/apiError.js'
import { integrationReadiness } from '@/config/env.js'

export const whatsappService = {
  async listNumbers(tenantId: string) {
    const numbers = await whatsappRepository.listNumbers(tenantId)
    // Sandbox reflects whether this workspace can reach real Meta right now
    // (a global environment condition), not something stored per-record —
    // computed the same way here as on the connect response so a page
    // refresh shows the same Sandbox label instead of it disappearing.
    return numbers.map((n) => ({ ...serializeWhatsAppNumber(n), sandbox: !integrationReadiness.whatsapp }))
  },

  // Real production flow: Meta's Embedded Signup OAuth popup hands back a
  // code that's exchanged for a WABA + phone number id. Without live Meta
  // app credentials that popup can't be opened, so this creates the number
  // in PENDING_VERIFICATION — an honest "not yet connected" state, not a
  // faked success (see Section 10 / integrationReadiness.whatsapp).
  async startEmbeddedSignup(tenantId: string, label: string, phoneNumber: string) {
    const count = await whatsappRepository.count(tenantId)
    await assertUnderLimit(tenantId, 'whatsappNumbers', count)
    const account = await whatsappRepository.getOrCreateAccount(tenantId)
    const existing = await whatsappRepository.findExistingNumber(account.id, phoneNumber)
    if (existing) throw ApiError.conflict('This number is already connected (or pending) on this workspace')
    const number = await whatsappRepository.addNumber(account.id, label, phoneNumber)
    return { ...serializeWhatsAppNumber(number), sandbox: !integrationReadiness.whatsapp }
  },

  async disconnect(tenantId: string, id: string) {
    const ok = await whatsappRepository.disconnect(tenantId, id)
    if (!ok) throw ApiError.notFound('WhatsApp number not found')
  },
}
