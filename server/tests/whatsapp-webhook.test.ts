import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import request from 'supertest'
import { app, cleanupTenant, signedWhatsappWebhookPost, signupTenant, type TestSession } from './helpers.js'
import { prisma } from '@/config/prisma.js'
import { env } from '@/config/env.js'

// WHATSAPP_APP_SECRET is set to a fixture value for the whole test run (see
// vitest.config.ts) so the controller's real, fail-closed signature
// verification (whatsapp.controller.ts#receiveWebhook) is actually
// exercised here — every request below is genuinely HMAC-signed the same
// way Meta signs a real webhook, not sent with verification skipped. What's
// under test: webhook -> contact/conversation/message creation, opt-in/
// opt-out state, the 24h freeform-send gate, and signature enforcement itself.
describe('WhatsApp webhook — inbound messages, opt-in/opt-out, template status sync, 24h send window', () => {
  let tenant: TestSession
  let phoneNumberId: string
  // WebhookEvent rows aren't tenant-scoped and are never cleaned up by
  // cleanupTenant, so a fixed entry id here would collide with a leftover
  // row from a previous run of this same file against a persistent dev DB
  // (its idempotency guard would then correctly-but-confusingly treat every
  // request in a re-run as an already-seen duplicate). Unique per run.
  const entryId = `test-waba-entry-${Date.now()}`
  const contactPhone = '+15559990001'

  // Signed + waits for the async (post-ack) processing — see helpers.ts.
  const signedWebhookPost = signedWhatsappWebhookPost

  beforeAll(async () => {
    tenant = await signupTenant('whatsapp-webhook')
    phoneNumberId = `test-phone-${Date.now()}`
    const account = await prisma.whatsAppAccount.create({ data: { tenantId: tenant.tenantId, wabaId: `test-waba-${Date.now()}` } })
    await prisma.whatsAppPhoneNumber.create({
      data: { accountId: account.id, displayNumber: '+15550001111', metaPhoneNumberId: phoneNumberId, status: 'CONNECTED', connectedAt: new Date() },
    })
  })

  afterAll(async () => {
    await cleanupTenant(tenant)
  })

  function inboundPayload(text: string, waMessageId: string) {
    return {
      entry: [
        {
          // Real Meta deliveries use a distinct entry id per delivery too —
          // reusing waMessageId here (already unique per call-site) keeps
          // the idempotency guard from ever treating two different test
          // messages as the same delivery.
          id: `${entryId}-${waMessageId}`,
          changes: [
            {
              field: 'messages',
              value: {
                metadata: { phone_number_id: phoneNumberId },
                contacts: [{ wa_id: contactPhone, profile: { name: 'Webhook Test Contact' } }],
                messages: [{ from: contactPhone, id: waMessageId, type: 'text', text: { body: text } }],
              },
            },
          ],
        },
      ],
    }
  }

  it("answers Meta's GET verification handshake with the challenge only for the correct verify token", async () => {
    const ok = await request(app)
      .get('/api/whatsapp/webhook')
      .query({ 'hub.mode': 'subscribe', 'hub.verify_token': env.WHATSAPP_VERIFY_TOKEN, 'hub.challenge': 'challenge-12345' })
    expect(ok.status).toBe(200)
    expect(ok.text).toBe('challenge-12345')

    const wrong = await request(app).get('/api/whatsapp/webhook').query({ 'hub.mode': 'subscribe', 'hub.verify_token': 'wrong', 'hub.challenge': 'x' })
    expect(wrong.status).toBe(403)
  })

  it('rejects a webhook delivery with no signature header — fails closed rather than skipping verification', async () => {
    const res = await request(app).post('/api/whatsapp/webhook').send(inboundPayload('unsigned', `wamid.${Date.now()}.unsigned`))
    expect(res.status).toBe(401)
  })

  it('rejects a webhook delivery with an incorrect signature', async () => {
    const res = await request(app)
      .post('/api/whatsapp/webhook')
      .set('x-hub-signature-256', 'sha256=not-the-real-signature')
      .send(inboundPayload('forged', `wamid.${Date.now()}.forged`))
    expect(res.status).toBe(401)
  })

  it('an inbound message creates a real contact, conversation and message, and opts the contact in', async () => {
    const res = await signedWebhookPost(inboundPayload('Hi, I need help', `wamid.${Date.now()}.1`))
    expect(res.status).toBe(200)

    const contact = await prisma.contact.findFirst({ where: { tenantId: tenant.tenantId, phone: contactPhone } })
    expect(contact).not.toBeNull()
    expect(contact!.whatsappOptIn).toBe('OPTED_IN')
    expect(contact!.optInSource).toBe('whatsapp_reply')

    const conversation = await prisma.conversation.findFirst({ where: { tenantId: tenant.tenantId, contactId: contact!.id }, include: { messages: true } })
    expect(conversation).not.toBeNull()
    expect(conversation!.messages.some((m) => m.text === 'Hi, I need help' && m.direction === 'INBOUND')).toBe(true)
  })

  it('an agent can send a freeform reply within the 24h window (demo mode — no real Meta connection in tests)', async () => {
    const contact = await prisma.contact.findFirstOrThrow({ where: { tenantId: tenant.tenantId, phone: contactPhone } })
    const conversation = await prisma.conversation.findFirstOrThrow({ where: { tenantId: tenant.tenantId, contactId: contact.id } })

    const res = await tenant.agent.post(`/api/conversations/${conversation.id}/messages`).send({ text: 'Thanks for reaching out!' })
    expect(res.status).toBe(201)
    expect(res.body.message.status).toBe('sent')
  })

  it('rejects a freeform reply to a conversation the contact has never messaged in', async () => {
    const coldContact = await prisma.contact.create({ data: { tenantId: tenant.tenantId, name: 'Cold Contact', phone: '+15559990002', source: 'manual' } })
    const conversation = await prisma.conversation.create({ data: { tenantId: tenant.tenantId, contactId: coldContact.id } })

    const res = await tenant.agent.post(`/api/conversations/${conversation.id}/messages`).send({ text: 'Hey there!' })
    expect(res.status).toBe(400)
    expect(res.body.error.message).toMatch(/never messaged/i)
  })

  it('rejects a freeform reply once the customer-service window has closed', async () => {
    const staleContact = await prisma.contact.create({ data: { tenantId: tenant.tenantId, name: 'Stale Contact', phone: '+15559990003', source: 'manual' } })
    const conversation = await prisma.conversation.create({ data: { tenantId: tenant.tenantId, contactId: staleContact.id } })
    await prisma.message.create({
      data: { conversationId: conversation.id, direction: 'INBOUND', type: 'text', text: 'hi', status: 'RECEIVED', createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000) },
    })

    const res = await tenant.agent.post(`/api/conversations/${conversation.id}/messages`).send({ text: 'Sorry for the late reply!' })
    expect(res.status).toBe(400)
    expect(res.body.error.message).toMatch(/24-hour/i)
  })

  it('a "stop" reply opts the contact out and is never re-flipped back to opted-in by a later message', async () => {
    const res = await signedWebhookPost(inboundPayload('STOP', `wamid.${Date.now()}.2`))
    expect(res.status).toBe(200)

    const contact = await prisma.contact.findFirstOrThrow({ where: { tenantId: tenant.tenantId, phone: contactPhone } })
    expect(contact.whatsappOptIn).toBe('OPTED_OUT')
    expect(contact.optOutAt).not.toBeNull()

    // A further inbound message must not silently re-opt them in.
    await signedWebhookPost(inboundPayload('actually wait', `wamid.${Date.now()}.3`))
    const after = await prisma.contact.findFirstOrThrow({ where: { id: contact.id } })
    expect(after.whatsappOptIn).toBe('OPTED_OUT')
  })

  it('a duplicate webhook delivery (same entry id) is processed only once', async () => {
    const dupContact = await prisma.contact.create({ data: { tenantId: tenant.tenantId, name: 'Dup Contact', phone: '+15559990004', source: 'manual' } })
    await prisma.conversation.create({ data: { tenantId: tenant.tenantId, contactId: dupContact.id } })

    const payload = {
      entry: [
        {
          id: `duplicate-entry-id-${Date.now()}`,
          changes: [
            {
              field: 'messages',
              value: {
                metadata: { phone_number_id: phoneNumberId },
                contacts: [{ wa_id: dupContact.phone, profile: { name: dupContact.name } }],
                messages: [{ from: dupContact.phone, id: 'wamid.duplicate-test', type: 'text', text: { body: 'only once please' } }],
              },
            },
          ],
        },
      ],
    }

    const first = await signedWebhookPost(payload)
    const second = await signedWebhookPost(payload)
    expect(first.status).toBe(200)
    expect(second.status).toBe(200)

    const conversation = await prisma.conversation.findFirstOrThrow({ where: { tenantId: tenant.tenantId, contactId: dupContact.id }, include: { messages: true } })
    expect(conversation.messages.filter((m) => m.waMessageId === 'wamid.duplicate-test')).toHaveLength(1)
  })

  it('a message_template_status_update event syncs the local template status', async () => {
    const template = await prisma.template.create({
      data: { tenantId: tenant.tenantId, name: `sync_test_${Date.now()}`, category: 'marketing', body: 'Hello {{1}}', status: 'PENDING', metaTemplateId: `meta-tpl-${Date.now()}` },
    })

    const res = await signedWebhookPost({
      entry: [
        {
          id: `${entryId}-template-status`,
          changes: [{ field: 'message_template_status_update', value: { event: 'REJECTED', message_template_id: template.metaTemplateId, reason: 'INVALID_FORMAT' } }],
        },
      ],
    })
    expect(res.status).toBe(200)

    const updated = await prisma.template.findUniqueOrThrow({ where: { id: template.id } })
    expect(updated.status).toBe('REJECTED')
    expect(updated.rejectedReason).toBe('INVALID_FORMAT')
  })
})
