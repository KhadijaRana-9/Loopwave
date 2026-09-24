import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { cleanupTenant, signupTenant, type TestSession } from './helpers.js'
import { prisma } from '@/config/prisma.js'

// A number that WAS connected but Meta has since flagged
// (REAUTHORIZATION_REQUIRED/ERROR) must block sends with a clear, honest
// error — not silently fall back to a demo-mode "sent" result, which would
// hide a real connection going bad. See
// conversations.service.ts#resolveSendCredentials /
// campaigns.service.ts#dispatchCampaign. A tenant with NO WhatsApp number
// at all is a different, legitimate case (honest demo mode) — untouched
// here, already covered by whatsapp-webhook.test.ts's "demo mode" send.
describe('WhatsApp reauthorization blocks sends instead of silently demo-sending', () => {
  let tenant: TestSession
  let conversationId: string

  beforeAll(async () => {
    tenant = await signupTenant('whatsapp-reauth-block')
    const account = await prisma.whatsAppAccount.create({ data: { tenantId: tenant.tenantId, wabaId: `reauth-waba-${Date.now()}` } })
    await prisma.whatsAppPhoneNumber.create({
      data: { accountId: account.id, displayNumber: '+15550007777', metaPhoneNumberId: `reauth-phone-${Date.now()}`, status: 'REAUTHORIZATION_REQUIRED' },
    })

    const contact = await prisma.contact.create({ data: { tenantId: tenant.tenantId, name: 'Reauth Test Contact', phone: '+15559990099', source: 'manual' } })
    const conversation = await prisma.conversation.create({ data: { tenantId: tenant.tenantId, contactId: contact.id } })
    conversationId = conversation.id
    await prisma.message.create({
      data: { conversationId, direction: 'INBOUND', type: 'text', text: 'hi', status: 'RECEIVED', createdAt: new Date() },
    })
  })

  afterAll(async () => {
    await cleanupTenant(tenant)
  })

  it('rejects a freeform reply with a clear reconnect message instead of a fake demo "sent" result', async () => {
    const res = await tenant.agent.post(`/api/conversations/${conversationId}/messages`).send({ text: 'This should not send.' })
    expect(res.status).toBe(400)
    expect(res.body.error.message).toMatch(/reauthorized/i)
  })
})
