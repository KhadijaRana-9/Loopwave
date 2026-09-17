import { billingRepository } from '@/repositories/billing.repository.js'
import { getUsageSnapshot } from '@/services/usage.service.js'
import { activeProvider, createCheckoutSession, setStripeCancelAtPeriodEnd, fetchStripeDefaultPaymentMethod, type BillingCycle } from '@/integrations/payments.adapter.js'
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
      provider: subscription.provider,
      sandbox: !subscription.provider,
      billingCycle: subscription.billingCycle,
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

  async getPaymentMethod(tenantId: string) {
    const subscription = await billingRepository.getSubscription(tenantId)
    if (!subscription?.provider || !subscription.providerCustomerId) return null
    if (subscription.provider !== 'stripe') return null
    return fetchStripeDefaultPaymentMethod(subscription.providerCustomerId)
  },

  // No real charge happens here — see payments.adapter.ts. When a provider
  // is configured this returns a real checkout URL and the plan change is
  // deferred to the webhook; otherwise it switches the plan immediately in
  // an honestly-labeled sandbox mode, matching the existing UI copy
  // ("simulated in the demo build — no real charge is made").
  async checkout(tenantId: string, planId: string, billingCycle: BillingCycle) {
    const plan = await billingRepository.getPlan(planId)
    if (!plan) throw ApiError.notFound('Plan not found')
    if (plan.price === null) throw ApiError.badRequest('Contact sales for Enterprise pricing')

    const provider = activeProvider()
    if (provider === 'stripe') {
      const session = await createCheckoutSession({
        tenantId,
        planId,
        amount: plan.price,
        billingCycle,
        successUrl: `${env.WEB_APP_URL}/app/billing?checkout=success`,
        cancelUrl: `${env.WEB_APP_URL}/app/billing?checkout=cancelled`,
      })
      return { sandbox: false, checkoutUrl: session.checkoutUrl }
    }

    const subscription = await billingRepository.getSubscription(tenantId)
    if (!subscription) throw ApiError.notFound('No subscription found for this workspace')
    const updated = await billingRepository.switchPlanSandbox(tenantId, planId, billingCycle)
    const sandboxAmount = billingCycle === 'yearly' ? plan.price * 10 : plan.price
    if (sandboxAmount > 0) await billingRepository.createSandboxInvoice(subscription.id, sandboxAmount)
    return { sandbox: true, plan: serializePlan(updated.plan) }
  },

  // Always schedules cancellation for the end of the period already paid
  // for — real subscriptions only actually deactivate once Stripe's
  // customer.subscription.deleted webhook confirms the period ended.
  // Sandbox has no real period to honor, so it cancels immediately and the
  // response says so explicitly.
  async cancel(tenantId: string) {
    const subscription = await billingRepository.getSubscription(tenantId)
    if (!subscription) throw ApiError.notFound('No subscription found for this workspace')
    if (subscription.status === 'CANCELLED') throw ApiError.badRequest('Subscription is already cancelled')

    if (subscription.provider === 'stripe' && subscription.providerSubId) {
      await setStripeCancelAtPeriodEnd(subscription.providerSubId, true)
      const updated = await billingRepository.scheduleCancelAtPeriodEnd(tenantId)
      return { sandbox: false, immediate: false, cancelAtPeriodEnd: true, renewsAt: updated.currentPeriodEnd, plan: serializePlan(updated.plan) }
    }

    const updated = await billingRepository.cancelSandboxImmediately(tenantId)
    return { sandbox: true, immediate: true, cancelAtPeriodEnd: false, renewsAt: null, plan: serializePlan(updated.plan) }
  },

  async resume(tenantId: string) {
    const subscription = await billingRepository.getSubscription(tenantId)
    if (!subscription) throw ApiError.notFound('No subscription found for this workspace')
    if (!subscription.cancelAtPeriodEnd) throw ApiError.badRequest('Subscription is not scheduled for cancellation')
    if (subscription.provider !== 'stripe' || !subscription.providerSubId) {
      throw ApiError.badRequest('This subscription was cancelled immediately (sandbox mode) — switch to a plan to resubscribe')
    }

    await setStripeCancelAtPeriodEnd(subscription.providerSubId, false)
    const updated = await billingRepository.unscheduleCancelAtPeriodEnd(tenantId)
    return { cancelAtPeriodEnd: false, renewsAt: updated.currentPeriodEnd, plan: serializePlan(updated.plan) }
  },
}
