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

  count(tenantId: string) {
    return prisma.whatsAppPhoneNumber.count({ where: { account: { tenantId } } })
  },

  addNumber(accountId: string, label: string) {
    return prisma.whatsAppPhoneNumber.create({
      data: { accountId, label, displayNumber: 'Pending Meta verification', status: 'PENDING_VERIFICATION' },
    })
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
