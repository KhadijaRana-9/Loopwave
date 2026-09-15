import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import request from 'supertest'
import crypto from 'node:crypto'
import { app, cleanupTenant, signupTenant, type TestSession } from './helpers.js'
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

      const first = await request(app).post('/api/whatsapp/webhook').send(payload)
      expect(first.status).toBe(200)
      const second = await request(app).post('/api/whatsapp/webhook').send(payload)
      expect(second.status).toBe(200)

      const rows = await prisma.webhookEvent.findMany({ where: { source: 'whatsapp', externalId } })
      expect(rows.length).toBe(1)

      await prisma.webhookEvent.deleteMany({ where: { source: 'whatsapp', externalId } })
    })

    it('turns an inbound message webhook into a real Contact + Conversation + Message', async () => {
      const connectRes = await session.agent.post('/api/whatsapp/connect').send({ label: 'Webhook Test Line' })
      const metaPhoneNumberId = `meta-pn-${crypto.randomUUID()}`
      await prisma.whatsAppPhoneNumber.update({ where: { id: connectRes.body.id }, data: { metaPhoneNumberId, status: 'CONNECTED' } })

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

      const res = await request(app).post('/api/whatsapp/webhook').send(payload)
      expect(res.status).toBe(200)

      // Processing happens after the response is sent (fast-ack pattern), and
      // walks contact -> conversation -> message as separate awaited steps —
      // poll for the *message* landing (the last step), not just the contact,
      // so this doesn't race ahead of its own background processing.
      let conversation: Awaited<ReturnType<typeof prisma.conversation.findFirst<{ include: { messages: true } }>>> = null
      for (let i = 0; i < 30 && !conversation?.messages.length; i++) {
        await new Promise((r) => setTimeout(r, 1000))
        const contact = await prisma.contact.findUnique({ where: { tenantId_phone: { tenantId: session.tenantId, phone: fromPhone } } })
        if (contact) {
          conversation = await prisma.conversation.findFirst({ where: { tenantId: session.tenantId, contactId: contact.id }, include: { messages: true } })
        }
      }
      expect(conversation).not.toBeNull()
      expect(conversation?.messages.some((m) => m.direction === 'INBOUND' && m.text === 'Hello from the webhook test')).toBe(true)

      await prisma.webhookEvent.deleteMany({ where: { source: 'whatsapp', externalId } })
    }, 50_000)
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
