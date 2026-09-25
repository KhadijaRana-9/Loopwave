import { prisma } from '@/config/prisma.js'
import type { Prisma } from '@prisma/client'

export const whatsappRepository = {
  getAccount(tenantId: string) {
    return prisma.whatsAppAccount.findFirst({ where: { tenantId }, include: { phoneNumbers: true } })
  },

  async getOrCreateAccount(tenantId: string) {
    const existing = await prisma.whatsAppAccount.findFirst({ where: { tenantId } })
    if (existing) return existing
    return prisma.whatsAppAccount.create({ data: { tenantId } })
  },

  // The tenant's currently-usable send credentials, if any — the one place
  // every send path (conversations, campaigns) should look for them.
  getConnectedCredentials(tenantId: string) {
    return prisma.whatsAppPhoneNumber.findFirst({
      where: { status: 'CONNECTED', account: { tenantId } },
      include: { account: true },
    })
  },

  listNumbers(tenantId: string) {
    return prisma.whatsAppPhoneNumber.findMany({ where: { account: { tenantId } }, orderBy: { id: 'asc' } })
  },

  // Excludes DISCONNECTED numbers — otherwise a tenant on a plan limited to
  // 1 WhatsApp number could disconnect it and then never connect a
  // replacement, since the count driving the plan-limit check would never
  // go back down.
  count(tenantId: string) {
    return prisma.whatsAppPhoneNumber.count({ where: { account: { tenantId }, status: { not: 'DISCONNECTED' } } })
  },

  // Cross-tenant hijack guards — a WABA or phone number Meta says is real
  // must never be attachable to a second tenant. Excludes DISCONNECTED so a
  // number genuinely freed up by one tenant can be reconnected (by them or,
  // legitimately, by whoever Meta says now owns that number).
  findAccountByWabaId(wabaId: string) {
    return prisma.whatsAppAccount.findFirst({ where: { wabaId }, include: { phoneNumbers: true } })
  },

  findNumberByMetaPhoneNumberId(metaPhoneNumberId: string) {
    return prisma.whatsAppPhoneNumber.findFirst({ where: { metaPhoneNumberId, status: { not: 'DISCONNECTED' } }, include: { account: true } })
  },

  // Webhook routing: phone_number_id -> the ONE tenant that currently holds
  // it. A REAUTHORIZATION_REQUIRED or ERROR number must still receive (and
  // record) inbound events, but a DISCONNECTED row must never match —
  // metaPhoneNumberId isn't unique, and once workspace A disconnects a number
  // workspace B can legitimately connect the same one (see
  // findNumberByMetaPhoneNumberId above). Matching A's stale row would route
  // B's customers' messages into A's inbox.
  findByMetaPhoneNumberId(metaPhoneNumberId: string) {
    return prisma.whatsAppPhoneNumber.findFirst({
      where: { metaPhoneNumberId, status: { not: 'DISCONNECTED' } },
      include: { account: true },
    })
  },

  async upsertAccount(
    tenantId: string,
    data: { wabaId: string; businessId: string | null; businessName: string | null; accessTokenCipher: string; tokenExpiresAt: Date | null },
  ) {
    // Keyed by (tenant, WABA), not just tenant: a workspace that connects a
    // second WABA must get its own account row. Updating "the tenant's
    // account" in place would swap the token under the first WABA's numbers,
    // and every send from them would then fail against the wrong token. A
    // never-connected account (workspaces get an empty one at signup) is
    // adopted instead of leaving an orphan behind.
    const sameWaba = await prisma.whatsAppAccount.findFirst({ where: { tenantId, wabaId: data.wabaId } })
    const target = sameWaba ?? (await prisma.whatsAppAccount.findFirst({ where: { tenantId, wabaId: null } }))
    if (target) return prisma.whatsAppAccount.update({ where: { id: target.id }, data })
    return prisma.whatsAppAccount.create({ data: { tenantId, ...data } })
  },

  async upsertNumber(
    accountId: string,
    metaPhoneNumberId: string,
    data: {
      displayNumber: string
      verifiedName: string
      qualityRating: string | null
      label: string
      status: 'CONNECTED'
      connectedAt: Date
    },
  ) {
    const existing = await prisma.whatsAppPhoneNumber.findFirst({ where: { accountId, metaPhoneNumberId } })
    if (existing) return prisma.whatsAppPhoneNumber.update({ where: { id: existing.id }, data })
    return prisma.whatsAppPhoneNumber.create({ data: { accountId, metaPhoneNumberId, ...data } })
  },

  updateNumberStatus(id: string, status: Prisma.WhatsAppPhoneNumberUpdateInput['status']) {
    return prisma.whatsAppPhoneNumber.update({ where: { id }, data: { status } }).catch(() => null)
  },

  // A number that WAS connected but Meta has since invalidated (bad token)
  // or errored — distinct from a tenant that simply never connected one.
  // Send paths use this to fail loudly instead of silently falling back to
  // demo mode, which would hide a real, previously-working connection
  // going bad behind a fake "sent" result.
  findRequiringReauth(tenantId: string) {
    return prisma.whatsAppPhoneNumber.findFirst({
      where: { account: { tenantId }, status: { in: ['REAUTHORIZATION_REQUIRED', 'ERROR'] } },
    })
  },

  // Accounts whose token is expiring soon — driven by the proactive
  // token-expiry job (server/src/jobs/whatsappTokenExpiry.job.ts). Only
  // ever CONNECTED numbers matter here: a REAUTHORIZATION_REQUIRED one has
  // already been flagged, and a DISCONNECTED one no longer needs the token.
  findAccountsWithExpiringTokens(withinMs: number) {
    return prisma.whatsAppAccount.findMany({
      where: {
        tokenExpiresAt: { not: null, lte: new Date(Date.now() + withinMs) },
        phoneNumbers: { some: { status: 'CONNECTED' } },
      },
      include: { phoneNumbers: { where: { status: 'CONNECTED' } } },
    })
  },

  async disconnect(tenantId: string, id: string) {
    const result = await prisma.whatsAppPhoneNumber.updateMany({
      where: { id, account: { tenantId } },
      data: { status: 'DISCONNECTED' },
    })
    return result.count > 0
  },
}
