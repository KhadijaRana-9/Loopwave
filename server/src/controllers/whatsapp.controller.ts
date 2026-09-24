import type { Request, Response } from 'express'
import { Prisma } from '@prisma/client'
import { whatsappService } from '@/services/whatsapp.service.js'
import { processWhatsAppWebhook } from '@/services/whatsappWebhook.service.js'
import { asyncHandler } from '@/utils/asyncHandler.js'
import { ApiError } from '@/utils/apiError.js'
import { env } from '@/config/env.js'
import { prisma } from '@/config/prisma.js'
import crypto from 'node:crypto'

function tenantId(req: Request): string {
  if (!req.auth?.tenantId) throw ApiError.forbidden('No active workspace for this session')
  return req.auth.tenantId
}

export const whatsappController = {
  listNumbers: asyncHandler(async (req: Request, res: Response) => {
    res.json({ numbers: await whatsappService.listNumbers(tenantId(req)) })
  }),
  getSignupConfig: (req: Request, res: Response) => {
    res.json(whatsappService.getSignupConfig())
  },
  completeSignup: asyncHandler(async (req: Request, res: Response) => {
    const number = await whatsappService.completeEmbeddedSignup(tenantId(req), req.body)
    res.status(201).json(number)
  }),
  disconnect: asyncHandler(async (req: Request, res: Response) => {
    await whatsappService.disconnect(tenantId(req), req.params.id as string)
    res.status(204).send()
  }),

  // Meta calls this once with hub.mode/verify_token/hub.challenge to confirm
  // webhook ownership before it will ever POST a real event to it.
  verifyWebhook: (req: Request, res: Response) => {
    const mode = req.query['hub.mode']
    const token = req.query['hub.verify_token']
    const challenge = req.query['hub.challenge']
    if (mode === 'subscribe' && token === env.WHATSAPP_VERIFY_TOKEN && env.WHATSAPP_VERIFY_TOKEN) {
      res.status(200).send(challenge)
    } else {
      res.status(403).send('Verification failed')
    }
  },

  // Meta signs every webhook body with X-Hub-Signature-256 (HMAC-SHA256 over
  // the raw body using the app secret) — verified here before anything in
  // the payload is trusted, and every event is logged for idempotent replay
  // protection regardless of whether processing succeeds. Fails CLOSED when
  // WHATSAPP_APP_SECRET isn't configured — matching billing's Stripe webhook
  // (payments.adapter.ts#verifyStripeSignature) — rather than skipping
  // verification, which would let anyone POST fabricated WhatsApp events.
  receiveWebhook: asyncHandler(async (req: Request, res: Response) => {
    const signature = req.header('x-hub-signature-256')
    const rawBody = (req as Request & { rawBody?: Buffer }).rawBody

    if (!env.WHATSAPP_APP_SECRET || !rawBody) {
      return res.status(401).json({ error: { code: 'NOT_CONFIGURED', message: 'WhatsApp webhook is not configured to accept events yet' } })
    }

    const expected = 'sha256=' + crypto.createHmac('sha256', env.WHATSAPP_APP_SECRET).update(rawBody).digest('hex')
    // Constant-time comparison — a plain !== leaks timing information an
    // attacker can use to guess the signature byte-by-byte.
    const signatureBuf = Buffer.from(signature ?? '')
    const expectedBuf = Buffer.from(expected)
    const valid = signatureBuf.length === expectedBuf.length && crypto.timingSafeEqual(signatureBuf, expectedBuf)
    if (!valid) {
      return res.status(401).json({ error: { code: 'INVALID_SIGNATURE', message: 'Webhook signature verification failed' } })
    }

    const externalId = req.body?.entry?.[0]?.id ?? crypto.randomUUID()

    // The insert itself is the idempotency guard (relies on the @@unique
    // constraint), not a separate find-then-create — two deliveries of the
    // same event racing each other resolve safely: exactly one insert wins,
    // the other hits P2002 and is treated as an already-seen duplicate.
    let firstDelivery = true
    try {
      await prisma.webhookEvent.create({ data: { source: 'whatsapp', externalId, payload: req.body } })
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        firstDelivery = false
      } else {
        throw err
      }
    }

    // Meta retries webhooks it didn't get a fast 200 for — respond first,
    // then process, so a slow DB write never causes a duplicate delivery.
    res.status(200).send('EVENT_RECEIVED')
    if (!firstDelivery) return

    try {
      await processWhatsAppWebhook(req.body)
      await prisma.webhookEvent.update({ where: { source_externalId: { source: 'whatsapp', externalId } }, data: { processedAt: new Date() } })
    } catch (err) {
      await prisma.webhookEvent
        .update({
          where: { source_externalId: { source: 'whatsapp', externalId } },
          data: { errorMessage: err instanceof Error ? err.message : 'Unknown error processing webhook' },
        })
        .catch(() => {})
    }
  }),
}
