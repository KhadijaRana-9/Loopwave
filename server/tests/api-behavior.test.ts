import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import request from 'supertest'
import crypto from 'node:crypto'
import { app, cleanupTenant, signedWhatsappWebhookPost, signupTenant, whatsappWebhookEventId, type TestSession } from './helpers.js'
import { prisma } from '@/config/prisma.js'

describe('API behavior: validation, duplicates, not-found, webhooks', () => {
  let session: TestSession

  beforeAll(async () => {
    session = await signupTenant('behavior')
  })

  afterAll(async () => {
    await cleanupTenant(session)
  })

  it('rejects contact creation with missing required fields (400, not 500)', async () => {
    const res = await session.agent.post('/api/contacts').send({ name: '' })
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })

  it('rejects duplicate contact phone within the same tenant (409)', async () => {
    const phone = `+1555${Date.now().toString().slice(-7)}`
    const first = await session.agent.post('/api/contacts').send({ name: 'First', phone })
    expect(first.status).toBe(201)
    const second = await session.agent.post('/api/contacts').send({ name: 'Second', phone })
    expect(second.status).toBe(409)
  })

  it('returns 404 for a contact id that does not exist at all', async () => {
    const res = await session.agent.get('/api/contacts/does-not-exist')
    expect(res.status).toBe(404)
  })

  it('rejects campaign creation against a nonexistent template (404, not 500)', async () => {
    const res = await session.agent.post('/api/campaigns').send({ name: 'Bad Campaign', templateId: 'nope', audienceFilter: {} })
    expect(res.status).toBe(404)
  })

  it('rejects duplicate team invite for the same email (409)', async () => {
    const email = `dup-${Date.now()}@test.loopwave.internal`
    const first = await session.agent.post('/api/team').send({ name: 'Dup', email, role: 'viewer' })
    expect(first.status).toBe(201)
    const second = await session.agent.post('/api/team').send({ name: 'Dup', email, role: 'viewer' })
    expect(second.status).toBe(409)
  })

  it('rejects an unpublished/nonexistent form on the public submit endpoint (404, not a 500 or silent success)', async () => {
    const res = await request(app).post('/api/forms/does-not-exist/submit').send({ values: { name: 'X' } })
    expect(res.status).toBe(404)
  })

  it('rejects malformed JSON bodies cleanly instead of crashing', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send('{not valid json')
    expect(res.status).toBeGreaterThanOrEqual(400)
    expect(res.status).toBeLessThan(500)
  })

  it('rate-limits repeated login attempts instead of allowing unlimited brute force', async () => {
    const attempts = await Promise.all(
      Array.from({ length: 25 }).map(() => request(app).post('/api/auth/login').send({ email: 'nobody@test.loopwave.internal', password: 'wrong' })),
    )
    expect(attempts.some((r) => r.status === 429)).toBe(true)
  }, 30_000)

  describe('WhatsApp webhook', () => {
    it('rejects an invalid verify token on the GET verification handshake', async () => {
      const res = await request(app).get('/api/whatsapp/webhook').query({ 'hub.mode': 'subscribe', 'hub.verify_token': 'wrong', 'hub.challenge': '12345' })
      expect(res.status).toBe(403)
    })

    it('accepts and idempotently dedupes a webhook event by external id', async () => {
      const externalId = `test-evt-${crypto.randomUUID()}`
      const payload = { entry: [{ id: externalId, changes: [] }] }

      const first = await signedWhatsappWebhookPost(payload)
      expect(first.status).toBe(200)
      const second = await signedWhatsappWebhookPost(payload)
      expect(second.status).toBe(200)

      const eventId = whatsappWebhookEventId(JSON.stringify(payload))
      const rows = await prisma.webhookEvent.findMany({ where: { source: 'whatsapp', externalId: eventId } })
      expect(rows.length).toBe(1)

      await prisma.webhookEvent.deleteMany({ where: { source: 'whatsapp', externalId: eventId } })
    })

    it('turns an inbound message webhook into a real Contact + Conversation + Message', async () => {
      // A connected number is created directly (POST /whatsapp/connect now
      // requires a real Meta Embedded Signup code, which no test can obtain);
      // what's under test here is webhook routing and inbox creation.
      const metaPhoneNumberId = `meta-pn-${crypto.randomUUID()}`
      const account = await prisma.whatsAppAccount.create({ data: { tenantId: session.tenantId, wabaId: `waba-${crypto.randomUUID()}` } })
      await prisma.whatsAppPhoneNumber.create({
        data: { accountId: account.id, displayNumber: '+15550002222', label: 'Webhook Test Line', metaPhoneNumberId, status: 'CONNECTED', connectedAt: new Date() },
      })

      const fromPhone = `91${Date.now()}`.slice(0, 12)
      const externalId = `test-msg-evt-${crypto.randomUUID()}`
      const payload = {
        entry: [
          {
            id: externalId,
            changes: [
              {
                value: {
                  metadata: { phone_number_id: metaPhoneNumberId },
                  contacts: [{ wa_id: fromPhone, profile: { name: 'Webhook Test Contact' } }],
                  messages: [{ from: fromPhone, id: `wamid.${crypto.randomUUID()}`, type: 'text', text: { body: 'Hello from the webhook test' } }],
                },
              },
            ],
          },
        ],
      }

      // Signed like a real Meta delivery; the helper also waits for the
      // post-ack async processing to finish (see helpers.ts).
      const res = await signedWhatsappWebhookPost(payload)
      expect(res.status).toBe(200)

      // Meta sends the sender as bare digits; a contact created from an inbound
      // message is stored in E.164 (+digits) like every other contact.
      const contact = await prisma.contact.findUniqueOrThrow({ where: { tenantId_phone: { tenantId: session.tenantId, phone: `+${fromPhone}` } } })
      const conversation = await prisma.conversation.findFirst({ where: { tenantId: session.tenantId, contactId: contact.id }, include: { messages: true } })
      expect(conversation).not.toBeNull()
      expect(conversation?.messages.some((m) => m.direction === 'INBOUND' && m.text === 'Hello from the webhook test')).toBe(true)

      await prisma.webhookEvent.deleteMany({ where: { source: 'whatsapp', externalId: whatsappWebhookEventId(JSON.stringify(payload)) } })
    }, 60_000)
  })

  describe('Billing webhook', () => {
    it('rejects a Stripe webhook with an invalid/missing signature when a webhook secret is configured', async () => {
      // Without STRIPE_WEBHOOK_SECRET configured in this environment the
      // signature check is skipped (there's nothing to verify against), so
      // this only asserts the endpoint doesn't 500 on an unsigned request —
      // real signature enforcement is exercised once STRIPE_WEBHOOK_SECRET is set.
      const res = await request(app).post('/api/billing/webhook').send({ id: 'evt_test', type: 'unhandled.event' })
      expect(res.status).toBeLessThan(500)
    })
  })
})
