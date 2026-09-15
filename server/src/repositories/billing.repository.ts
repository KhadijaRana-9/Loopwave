import { prisma } from '@/config/prisma.js'

export const billingRepository = {
  getSubscription(tenantId: string) {
    return prisma.subscription.findUnique({ where: { tenantId }, include: { plan: true } })
  },

  listPlans() {
    return prisma.plan.findMany({ orderBy: { price: 'asc' } })
  },

  getPlan(id: string) {
    return prisma.plan.findUnique({ where: { id } })
  },

  listInvoices(subscriptionId: string) {
    return prisma.invoice.findMany({ where: { subscriptionId }, orderBy: { issuedAt: 'desc' } })
  },

  switchPlanSandbox(tenantId: string, planId: string) {
    return prisma.subscription.update({
      where: { tenantId },
      data: { planId, status: 'ACTIVE', currentPeriodEnd: new Date(Date.now() + 30 * 86_400_000) },
      include: { plan: true },
    })
  },

  async createSandboxInvoice(subscriptionId: string, amount: number) {
    const count = await prisma.invoice.count({ where: { subscriptionId } })
    return prisma.invoice.create({
      data: {
        subscriptionId,
        number: `SANDBOX-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`,
        amount,
        status: 'PAID',
        issuedAt: new Date(),
      },
    })
  },

  confirmFromWebhook(tenantId: string, planId: string, providerSubId: string, provider: string) {
    return prisma.subscription.update({
      where: { tenantId },
      data: { planId, status: 'ACTIVE', provider, providerSubId, currentPeriodEnd: new Date(Date.now() + 30 * 86_400_000) },
    })
  },
}
