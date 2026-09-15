import { whatsappRepository } from '@/repositories/whatsapp.repository.js'
import { assertUnderLimit } from '@/services/planLimits.service.js'
import { serializeWhatsAppNumber } from '@/utils/serializers.js'
import { ApiError } from '@/utils/apiError.js'
import { integrationReadiness } from '@/config/env.js'

export const whatsappService = {
  async listNumbers(tenantId: string) {
    return (await whatsappRepository.listNumbers(tenantId)).map(serializeWhatsAppNumber)
  },

  // Real production flow: Meta's Embedded Signup OAuth popup hands back a
  // code that's exchanged for a WABA + phone number id. Without live Meta
  // app credentials that popup can't be opened, so this creates the number
  // in PENDING_VERIFICATION — an honest "not yet connected" state, not a
  // faked success (see Section 10 / integrationReadiness.whatsapp).
  async startEmbeddedSignup(tenantId: string, label: string) {
    const count = await whatsappRepository.count(tenantId)
    await assertUnderLimit(tenantId, 'whatsappNumbers', count)
    const account = await whatsappRepository.getOrCreateAccount(tenantId)
    const number = await whatsappRepository.addNumber(account.id, label)
    return { ...serializeWhatsAppNumber(number), sandbox: !integrationReadiness.whatsapp }
  },

  async disconnect(tenantId: string, id: string) {
    const ok = await whatsappRepository.disconnect(tenantId, id)
    if (!ok) throw ApiError.notFound('WhatsApp number not found')
  },
}
