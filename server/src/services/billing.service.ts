import { billingRepository } from '@/repositories/billing.repository.js'
import { getUsageSnapshot } from '@/services/usage.service.js'
import { activeProvider, createCheckoutSession } from '@/integrations/payments.adapter.js'
import { serializePlan } from '@/utils/serializers.js'
import { ApiError } from '@/utils/apiError.js'
import { env } from '@/config/env.js'

export const billingService = {
  async getCurrentSubscription(tenantId: string) {
    const subscription = await billingRepository.getSubscription(tenantId)
    if (!subscription) throw ApiError.notFound('No subscription found for this workspace')
    const usage = await getUsageSnapshot(tenantId)
    return {
      plan: serializePlan(subscription.plan),
      status: subscription.status.toLowerCase(),
      renewsAt: subscription.currentPeriodEnd,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      usage,
    }
  },

  async listPlans() {
    return (await billingRepository.listPlans()).map(serializePlan)
  },

  async listInvoices(tenantId: string) {
    const subscription = await billingRepository.getSubscription(tenantId)
    if (!subscription) return []
    const invoices = await billingRepository.listInvoices(subscription.id)
    return invoices.map((inv) => ({
      id: inv.id,
      number: inv.number,
      amount: inv.amount,
      status: inv.status.toLowerCase(),
      issuedAt: inv.issuedAt,
      planId: subscription.planId,
    }))
  },

  // No real charge happens here — see payments.adapter.ts. When a provider
  // is configured this returns a real checkout URL and the plan change is
  // deferred to the webhook; otherwise it switches the plan immediately in
  // an honestly-labeled sandbox mode, matching the existing UI copy
  // ("simulated in the demo build — no real charge is made").
  async checkout(tenantId: string, planId: string) {
    const plan = await billingRepository.getPlan(planId)
    if (!plan) throw ApiError.notFound('Plan not found')
    if (plan.price === null) throw ApiError.badRequest('Contact sales for Enterprise pricing')

    const provider = activeProvider()
    if (provider) {
      const session = await createCheckoutSession({
        tenantId,
        planId,
        amount: plan.price,
        successUrl: `${env.WEB_APP_URL}/app/billing?checkout=success`,
        cancelUrl: `${env.WEB_APP_URL}/app/billing?checkout=cancelled`,
      })
      return { sandbox: false, checkoutUrl: session.checkoutUrl }
    }

    const subscription = await billingRepository.getSubscription(tenantId)
    if (!subscription) throw ApiError.notFound('No subscription found for this workspace')
    const updated = await billingRepository.switchPlanSandbox(tenantId, planId)
    if (plan.price > 0) await billingRepository.createSandboxInvoice(subscription.id, plan.price)
    return { sandbox: true, plan: serializePlan(updated.plan) }
  },
}
