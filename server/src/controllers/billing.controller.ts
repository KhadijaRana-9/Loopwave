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

export const billingController = {
  getSubscription: asyncHandler(async (req: Request, res: Response) => res.json(await billingService.getCurrentSubscription(tenantId(req)))),
  listPlans: asyncHandler(async (_req: Request, res: Response) => res.json({ plans: await billingService.listPlans() })),
  listInvoices: asyncHandler(async (req: Request, res: Response) => res.json({ invoices: await billingService.listInvoices(tenantId(req)) })),
  checkout: asyncHandler(async (req: Request, res: Response) => res.json(await billingService.checkout(tenantId(req), req.body.planId))),

  // Stripe/Razorpay call this directly with no user session — signature
  // verification is the only trust boundary. Every event is logged for
  // idempotent replay protection before (and even if) processing fails.
  webhook: asyncHandler(async (req: Request, res: Response) => {
    const signature = req.header('stripe-signature')
    const rawBody = (req as Request & { rawBody?: Buffer }).rawBody
    if (rawBody && !verifyStripeSignature(rawBody, signature)) {
      return res.status(401).json({ error: { code: 'INVALID_SIGNATURE', message: 'Webhook signature verification failed' } })
    }

    const event = req.body as { id?: string; type?: string; data?: { object?: { metadata?: { tenantId?: string; planId?: string }; subscription?: string } } }
    const externalId = event.id ?? `unverified_${Date.now()}`

    const alreadyProcessed = await prisma.webhookEvent.findUnique({ where: { source_externalId: { source: 'stripe', externalId } } })
    if (alreadyProcessed) return res.status(200).send('OK')

    if (event.type === 'checkout.session.completed' && event.data?.object?.metadata?.tenantId && event.data.object.metadata.planId) {
      await billingRepository.confirmFromWebhook(
        event.data.object.metadata.tenantId,
        event.data.object.metadata.planId,
        event.data.object.subscription ?? '',
        'stripe',
      )
    }

    await prisma.webhookEvent.create({ data: { source: 'stripe', externalId, payload: req.body as object, processedAt: new Date() } })
    res.status(200).send('OK')
  }),
}
