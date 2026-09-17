import type { Request, Response } from 'express'
import { billingService } from '@/services/billing.service.js'
import { billingRepository } from '@/repositories/billing.repository.js'
import { asyncHandler } from '@/utils/asyncHandler.js'
import { ApiError } from '@/utils/apiError.js'
import { verifyStripeSignature } from '@/integrations/payments.adapter.js'
import { prisma } from '@/config/prisma.js'

function tenantId(req: Request): string {
  if (!req.auth?.tenantId) throw ApiError.forbidden('No active workspace for this session')
  return req.auth.tenantId
}

interface StripeEvent {
  id?: string
  type?: string
  data?: {
    object?: {
      id?: string
      metadata?: { tenantId?: string; planId?: string; billingCycle?: string }
      subscription?: string
      customer?: string
      amount_paid?: number
      amount_due?: number
      period_end?: number
      current_period_end?: number
      cancel_at_period_end?: boolean
      status?: string
    }
  }
}

// Every handler below is reached only after signature verification — Stripe
// is the sole source of truth for what actually happened to a payment, so
// nothing here is reachable from an authenticated client request.
async function handleCheckoutCompleted(obj: NonNullable<StripeEvent['data']>['object']) {
  const tenantIdMeta = obj?.metadata?.tenantId
  const planId = obj?.metadata?.planId
  const billingCycle = obj?.metadata?.billingCycle === 'yearly' ? 'yearly' : 'monthly'
  if (!tenantIdMeta || !planId || !obj?.subscription || !obj?.customer) return
  await billingRepository.confirmFromWebhook(tenantIdMeta, planId, obj.subscription, obj.customer, 'stripe', billingCycle)
}

async function handleInvoicePaid(obj: NonNullable<StripeEvent['data']>['object']) {
  if (!obj?.subscription || !obj.id) return
  const subscription = await billingRepository.getSubscriptionByProviderSubId(obj.subscription)
  if (!subscription) return
  const amountRupees = Math.round((obj.amount_paid ?? 0) / 100)
  await billingRepository.recordRealInvoice(subscription.id, amountRupees, 'PAID', obj.id)
  if (obj.period_end) {
    await billingRepository.syncPeriodAndCancelFlag(obj.subscription, { currentPeriodEnd: new Date(obj.period_end * 1000), status: 'ACTIVE' })
  }
}

async function handleInvoicePaymentFailed(obj: NonNullable<StripeEvent['data']>['object']) {
  if (!obj?.subscription) return
  const subscription = await billingRepository.getSubscriptionByProviderSubId(obj.subscription)
  if (!subscription) return
  const amountRupees = Math.round((obj.amount_due ?? 0) / 100)
  await billingRepository.recordRealInvoice(subscription.id, amountRupees, 'FAILED', obj.id ?? null)
  await billingRepository.markPastDue(subscription.tenantId)
}

async function handleSubscriptionUpdated(obj: NonNullable<StripeEvent['data']>['object']) {
  if (!obj?.id) return
  await billingRepository.syncPeriodAndCancelFlag(obj.id, {
    ...(obj.current_period_end ? { currentPeriodEnd: new Date(obj.current_period_end * 1000) } : {}),
    ...(typeof obj.cancel_at_period_end === 'boolean' ? { cancelAtPeriodEnd: obj.cancel_at_period_end } : {}),
  })
}

// Only fires once the period already paid for has actually ended — reverting
// to the free plan here never cuts off service still owed to the subscriber.
async function handleSubscriptionDeleted(obj: NonNullable<StripeEvent['data']>['object']) {
  if (!obj?.id) return
  await billingRepository.downgradeToFreeOnCancellation(obj.id)
}

export const billingController = {
  getSubscription: asyncHandler(async (req: Request, res: Response) => res.json(await billingService.getCurrentSubscription(tenantId(req)))),
  listPlans: asyncHandler(async (_req: Request, res: Response) => res.json({ plans: await billingService.listPlans() })),
  listInvoices: asyncHandler(async (req: Request, res: Response) => res.json({ invoices: await billingService.listInvoices(tenantId(req)) })),
  checkout: asyncHandler(async (req: Request, res: Response) => res.json(await billingService.checkout(tenantId(req), req.body.planId, req.body.billingCycle))),
  cancel: asyncHandler(async (req: Request, res: Response) => res.json(await billingService.cancel(tenantId(req)))),
  resume: asyncHandler(async (req: Request, res: Response) => res.json(await billingService.resume(tenantId(req)))),
  paymentMethod: asyncHandler(async (req: Request, res: Response) => res.json({ paymentMethod: await billingService.getPaymentMethod(tenantId(req)) })),

  // Stripe calls this directly with no user session — signature verification
  // is the only trust boundary, and it is mandatory: a request with no
  // capturable raw body is rejected rather than silently let through.
  webhook: asyncHandler(async (req: Request, res: Response) => {
    const signature = req.header('stripe-signature')
    const rawBody = (req as Request & { rawBody?: Buffer }).rawBody
    if (!rawBody || !verifyStripeSignature(rawBody, signature)) {
      return res.status(401).json({ error: { code: 'INVALID_SIGNATURE', message: 'Webhook signature verification failed' } })
    }

    const event = req.body as StripeEvent
    const externalId = event.id ?? `unverified_${Date.now()}`

    const alreadyProcessed = await prisma.webhookEvent.findUnique({ where: { source_externalId: { source: 'stripe', externalId } } })
    if (alreadyProcessed) return res.status(200).send('OK')

    // Recorded as processed ONLY after the handler below actually succeeds —
    // if it throws, no row is written, so Stripe's automatic webhook retry
    // re-enters this same handler instead of being silently swallowed by the
    // idempotency check above.
    const obj = event.data?.object
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(obj)
        break
      case 'invoice.paid':
        await handleInvoicePaid(obj)
        break
      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(obj)
        break
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(obj)
        break
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(obj)
        break
      default:
        break // event types we don't act on are still recorded below so a replay of the same event is a no-op
    }
    await prisma.webhookEvent.create({ data: { source: 'stripe', externalId, payload: req.body as object, processedAt: new Date() } })

    res.status(200).send('OK')
  }),
}
