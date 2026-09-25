import { whatsappRepository } from '@/repositories/whatsapp.repository.js'
import { assertUnderLimit } from '@/services/planLimits.service.js'
import { serializeWhatsAppNumber } from '@/utils/serializers.js'
import { ApiError } from '@/utils/apiError.js'
import { env, integrationReadiness } from '@/config/env.js'
import { encryptSecret } from '@/utils/crypto.js'
import * as metaGraph from '@/integrations/metaGraph.js'
import { MetaGraphError } from '@/integrations/metaGraph.js'

export const whatsappService = {
  async listNumbers(tenantId: string) {
    const numbers = await whatsappRepository.listNumbers(tenantId)
    return numbers.map(serializeWhatsAppNumber)
  },

  // Public, non-secret values the frontend needs to decide whether to render
  // the real "Continue with Meta" button (and init the Facebook JS SDK) or
  // the honest "not configured" state — see GET /whatsapp/signup-config.
  getSignupConfig() {
    return {
      configured: integrationReadiness.whatsappSignup,
      appId: integrationReadiness.whatsappSignup ? env.META_APP_ID : null,
      configId: integrationReadiness.whatsappSignup ? env.META_CONFIG_ID : null,
    }
  },

  // The real Embedded Signup completion: the frontend already ran Meta's
  // popup and got back an authorization `code` plus the wabaId/phoneNumberId
  // Meta's postMessage reported. None of that is trusted at face value — we
  // exchange the code ourselves and re-fetch the WABA/number details
  // straight from the Graph API before writing anything down. See
  // src/pages/app/Whatsapp.jsx for the frontend half of this flow.
  async completeEmbeddedSignup(
    tenantId: string,
    input: { code: string; wabaId: string; phoneNumberId: string; businessId?: string; label: string },
  ) {
    if (!integrationReadiness.whatsappSignup) {
      throw ApiError.badRequest('Meta WhatsApp integration is not configured yet — set META_APP_ID, META_CONFIG_ID and WHATSAPP_APP_SECRET')
    }

    // Cross-tenant isolation: a WABA or number already attached to a
    // different tenant can never be claimed by this one, no matter what the
    // frontend or even Meta's response says — this is the hard guarantee
    // requirement #3 asks for.
    const existingAccount = await whatsappRepository.findAccountByWabaId(input.wabaId)
    if (existingAccount && existingAccount.tenantId !== tenantId) {
      throw ApiError.conflict('This WhatsApp Business Account is already connected to a different workspace')
    }
    const existingNumber = await whatsappRepository.findNumberByMetaPhoneNumberId(input.phoneNumberId)
    if (existingNumber && existingNumber.account.tenantId !== tenantId) {
      throw ApiError.conflict('This phone number is already connected to a different workspace')
    }

    // Reconnecting a number this workspace already holds (e.g. one flagged
    // REAUTHORIZATION_REQUIRED) restores its existing row in place — it must
    // not count against the plan's number limit a second time, or a tenant on
    // a 1-number plan could never recover their own broken connection.
    if (!existingNumber) {
      const count = await whatsappRepository.count(tenantId)
      await assertUnderLimit(tenantId, 'whatsappNumbers', count)
    }

    let longLived: { accessToken: string; expiresInSeconds: number | null }
    let wabaDetails: Awaited<ReturnType<typeof metaGraph.getWabaDetails>>
    let numberDetails: Awaited<ReturnType<typeof metaGraph.getPhoneNumberDetails>>
    try {
      const initial = await metaGraph.exchangeCodeForToken(input.code)
      // Best-effort extension to a ~60-day token. The token the code exchange
      // returns for an Embedded Signup "60 expiration token" configuration is
      // already business-scoped, and Meta's docs don't document
      // fb_exchange_token for that token type — so if Meta refuses the second
      // exchange, keep the first token (with ITS real expiry) rather than
      // failing a connection that already succeeded. Any non-Meta failure
      // (network etc.) still aborts.
      longLived = initial
      try {
        longLived = await metaGraph.exchangeForLongLivedToken(initial.accessToken)
      } catch (extendErr) {
        if (!(extendErr instanceof MetaGraphError)) throw extendErr
      }

      // Re-verify against the Graph API using the token we just obtained —
      // if the tenant doesn't actually have access to this WABA/number, these
      // calls fail and nothing gets persisted.
      ;[wabaDetails, numberDetails] = await Promise.all([
        metaGraph.getWabaDetails(input.wabaId, longLived.accessToken),
        metaGraph.getPhoneNumberDetails(input.phoneNumberId, longLived.accessToken),
      ])

      await metaGraph.subscribeAppToWaba(input.wabaId, longLived.accessToken)
      // Best-effort — a number Embedded Signup already registered will 400 here; that's fine.
      await metaGraph.registerPhoneNumber(input.phoneNumberId, longLived.accessToken).catch(() => {})
    } catch (err) {
      // Surface Meta's real error instead of a generic 500 — requirement #11.
      if (err instanceof MetaGraphError) throw ApiError.badRequest(`Meta rejected this connection: ${err.message}`)
      throw err
    }

    const tokenExpiresAt = longLived.expiresInSeconds ? new Date(Date.now() + longLived.expiresInSeconds * 1000) : null

    const account = await whatsappRepository.upsertAccount(tenantId, {
      wabaId: input.wabaId,
      businessId: wabaDetails.businessId ?? input.businessId ?? null,
      businessName: wabaDetails.name,
      accessTokenCipher: encryptSecret(longLived.accessToken),
      tokenExpiresAt,
    })

    const number = await whatsappRepository.upsertNumber(account.id, input.phoneNumberId, {
      displayNumber: numberDetails.displayNumber,
      verifiedName: numberDetails.verifiedName,
      qualityRating: numberDetails.qualityRating,
      label: input.label,
      status: 'CONNECTED',
      connectedAt: new Date(),
    })

    return serializeWhatsAppNumber(number)
  },

  async disconnect(tenantId: string, id: string) {
    const ok = await whatsappRepository.disconnect(tenantId, id)
    if (!ok) throw ApiError.notFound('WhatsApp number not found')
  },
}
