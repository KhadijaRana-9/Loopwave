import { prisma } from '@/config/prisma.js'

export const whatsappRepository = {
  async getOrCreateAccount(tenantId: string) {
    const existing = await prisma.whatsAppAccount.findFirst({ where: { tenantId } })
    if (existing) return existing
    return prisma.whatsAppAccount.create({ data: { tenantId, isDemoMode: true } })
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

  addNumber(accountId: string, label: string, displayNumber: string) {
    return prisma.whatsAppPhoneNumber.create({
      data: { accountId, label, displayNumber, status: 'PENDING_VERIFICATION' },
    })
  },

  // Scoped to this tenant's own account, not globally — a real duplicate
  // check across all of Meta's numbers isn't something this app can do
  // without real Meta credentials, but a tenant re-adding a number they
  // already registered is a genuine, checkable mistake worth catching.
  findExistingNumber(accountId: string, displayNumber: string) {
    return prisma.whatsAppPhoneNumber.findFirst({ where: { accountId, displayNumber, status: { not: 'DISCONNECTED' } } })
  },

  async disconnect(tenantId: string, id: string) {
    const result = await prisma.whatsAppPhoneNumber.updateMany({
      where: { id, account: { tenantId } },
      data: { status: 'DISCONNECTED' },
    })
    return result.count > 0
  },

  findByMetaPhoneNumberId(metaPhoneNumberId: string) {
    return prisma.whatsAppPhoneNumber.findFirst({ where: { metaPhoneNumberId }, include: { account: true } })
  },
}
