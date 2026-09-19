import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { prisma } from '@/config/prisma.js'
import { cleanupTenant, signupTenant, type TestSession } from './helpers.js'

// The single most important property of a multi-tenant SaaS: no request
// authenticated as Tenant B can read or mutate a Tenant A row, no matter what
// id it asks for by guessing/enumeration. Every check below arranges a real
// resource in Tenant A, then attacks it from an authenticated Tenant B
// session through the real HTTP API — never by calling repository/service
// code directly, since the whole point is proving the boundary as an
// external attacker would actually experience it.
describe('multi-tenant isolation (IDOR)', () => {
  let tenantA: TestSession
  let tenantB: TestSession

  let contactId: string
  let dealId: string
  let templateId: string
  let campaignId: string
  let aiAgentId: string
  let chatbotId: string
  let automationId: string
  let formId: string
  let conversationId: string
  let whatsappNumberId: string

  beforeAll(async () => {
    tenantA = await signupTenant('tenantA')
    tenantB = await signupTenant('tenantB')

    const contactRes = await tenantA.agent.post('/api/contacts').send({ name: 'Tenant A Contact', phone: '+15551230001' })
    contactId = contactRes.body.contact.id

    const dealRes = await tenantA.agent.post('/api/pipeline/deals').send({ contactId, title: 'Tenant A Deal', value: 500 })
    dealId = dealRes.body.deal.id

    const templateRes = await tenantA.agent.post('/api/templates').send({ name: 'tenant_a_template', category: 'utility', body: 'Hello {{1}}', variables: ['name'] })
    templateId = templateRes.body.template.id

    // Scheduled far in the future so campaign creation doesn't also kick off
    // a concurrent background send — this fixture only needs the campaign to
    // exist, not to actually process, and avoids adding unrelated DB load
    // while the rest of this setup is still running.
    const campaignRes = await tenantA.agent
      .post('/api/campaigns')
      .send({ name: 'Tenant A Campaign', templateId, audienceFilter: {}, scheduledAt: new Date(Date.now() + 3_600_000).toISOString() })
    campaignId = campaignRes.body.campaign.id

    const agentRes = await tenantA.agent.post('/api/ai-agents').send({ name: 'Tenant A Agent' })
    aiAgentId = agentRes.body.agent.id

    const botRes = await tenantA.agent.post('/api/chatbots').send({ name: 'Tenant A Bot' })
    chatbotId = botRes.body.chatbot.id

    const automationRes = await tenantA.agent.post('/api/automations').send({ name: 'Tenant A Automation' })
    automationId = automationRes.body.automation.id

    const formRes = await tenantA.agent.post('/api/forms').send({ name: 'Tenant A Form', fields: [] })
    formId = formRes.body.form.id

    const whatsappRes = await tenantA.agent.post('/api/whatsapp/connect').send({ label: 'Tenant A Line', phoneNumber: `+1555${Date.now()}`.slice(0, 13) })
    whatsappNumberId = whatsappRes.body.id

    // No "start a conversation" endpoint exists yet (agents only reply to
    // existing threads) — seeded directly via Prisma, which is a legitimate
    // way to arrange a fixture; only the cross-tenant *access* below goes
    // through the real API.
    const conversation = await prisma.conversation.create({ data: { tenantId: tenantA.tenantId, contactId } })
    conversationId = conversation.id
  })

  afterAll(async () => {
    await cleanupTenant(tenantA)
    await cleanupTenant(tenantB)
  })

  it('Tenant B cannot read or mutate Tenant A contact', async () => {
    expect((await tenantB.agent.get(`/api/contacts/${contactId}`)).status).toBe(404)
    expect((await tenantB.agent.patch(`/api/contacts/${contactId}`).send({ name: 'Hijacked' })).status).toBe(404)
    expect((await tenantB.agent.delete(`/api/contacts/${contactId}`)).status).toBe(404)
    const list = await tenantB.agent.get('/api/contacts')
    expect(list.body.items.find((c: { id: string }) => c.id === contactId)).toBeUndefined()
  })

  it('Tenant B cannot read or mutate Tenant A deal', async () => {
    expect((await tenantB.agent.get(`/api/pipeline/deals/${dealId}`)).status).toBe(404)
    expect((await tenantB.agent.patch(`/api/pipeline/deals/${dealId}`).send({ value: 999999 })).status).toBe(404)
    const list = await tenantB.agent.get('/api/pipeline/deals')
    expect(list.body.deals.find((d: { id: string }) => d.id === dealId)).toBeUndefined()
  })

  it('Tenant B cannot mutate Tenant A template, and never sees it listed', async () => {
    expect((await tenantB.agent.patch(`/api/templates/${templateId}`).send({ body: 'Hijacked' })).status).toBe(404)
    expect((await tenantB.agent.delete(`/api/templates/${templateId}`)).status).toBe(404)
    const list = await tenantB.agent.get('/api/templates')
    expect(list.body.templates.find((t: { id: string }) => t.id === templateId)).toBeUndefined()
  })

  it('Tenant B cannot read or act on Tenant A campaign', async () => {
    expect((await tenantB.agent.get(`/api/campaigns/${campaignId}`)).status).toBe(404)
    expect((await tenantB.agent.post(`/api/campaigns/${campaignId}/cancel`)).status).toBe(404)
    expect((await tenantB.agent.post(`/api/campaigns/${campaignId}/duplicate`)).status).toBe(404)
    const list = await tenantB.agent.get('/api/campaigns')
    expect(list.body.campaigns.find((c: { id: string }) => c.id === campaignId)).toBeUndefined()
  })

  it('Tenant B cannot read, mutate, or run Tenant A AI agent', async () => {
    expect((await tenantB.agent.get(`/api/ai-agents/${aiAgentId}`)).status).toBe(404)
    expect((await tenantB.agent.patch(`/api/ai-agents/${aiAgentId}`).send({ name: 'Hijacked' })).status).toBe(404)
    expect((await tenantB.agent.post(`/api/ai-agents/${aiAgentId}/test`).send({ message: 'hi', history: [] })).status).toBe(404)
  })

  it('Tenant B cannot read or mutate Tenant A chatbot', async () => {
    expect((await tenantB.agent.get(`/api/chatbots/${chatbotId}`)).status).toBe(404)
    expect((await tenantB.agent.patch(`/api/chatbots/${chatbotId}`).send({ name: 'Hijacked' })).status).toBe(404)
    expect((await tenantB.agent.delete(`/api/chatbots/${chatbotId}`)).status).toBe(404)
  })

  it('Tenant B cannot read, mutate, or trigger Tenant A automation', async () => {
    expect((await tenantB.agent.get(`/api/automations/${automationId}`)).status).toBe(404)
    expect((await tenantB.agent.patch(`/api/automations/${automationId}`).send({ name: 'Hijacked' })).status).toBe(404)
    expect((await tenantB.agent.post(`/api/automations/${automationId}/toggle`)).status).toBe(404)
    expect((await tenantB.agent.post(`/api/automations/${automationId}/test`)).status).toBe(404)
  })

  it('Tenant B cannot mutate or delete Tenant A form, and never sees its submissions', async () => {
    expect((await tenantB.agent.patch(`/api/forms/${formId}`).send({ name: 'Hijacked' })).status).toBe(404)
    expect((await tenantB.agent.get(`/api/forms/${formId}/submissions`)).status).toBe(404)
    expect((await tenantB.agent.delete(`/api/forms/${formId}`)).status).toBe(404)
  })

  it('Tenant B cannot read or reply to Tenant A conversation', async () => {
    expect((await tenantB.agent.get(`/api/conversations/${conversationId}`)).status).toBe(404)
    expect((await tenantB.agent.post(`/api/conversations/${conversationId}/messages`).send({ text: 'Hijacked' })).status).toBe(404)
    expect((await tenantB.agent.patch(`/api/conversations/${conversationId}/assign`).send({ agentId: tenantB.userId })).status).toBe(404)
    expect((await tenantB.agent.patch(`/api/conversations/${conversationId}/status`).send({ status: 'resolved' })).status).toBe(404)
    const list = await tenantB.agent.get('/api/conversations')
    expect(list.body.conversations.find((c: { id: string }) => c.id === conversationId)).toBeUndefined()
  })

  it('Tenant B cannot disconnect Tenant A WhatsApp number, and never sees it listed', async () => {
    expect((await tenantB.agent.post(`/api/whatsapp/numbers/${whatsappNumberId}/disconnect`)).status).toBe(404)
    const list = await tenantB.agent.get('/api/whatsapp/numbers')
    expect(list.body.numbers.find((n: { id: string }) => n.id === whatsappNumberId)).toBeUndefined()
  })

  it('Tenant B sees its own billing/subscription state, never Tenant A\'s', async () => {
    await tenantA.agent.post('/api/billing/checkout').send({ planId: 'business' })
    const bRes = await tenantB.agent.get('/api/billing/subscription')
    expect(bRes.status).toBe(200)
    expect(bRes.body.plan.id).not.toBe('business')
  })

  it('Tenant B sees its own integration connection state, never Tenant A\'s', async () => {
    await tenantA.agent.post('/api/integrations/shopify/config').send({ config: { storeUrl: 'tenant-a.myshopify.com', apiKey: 'secret-a' } })
    const bRes = await tenantB.agent.get('/api/integrations')
    expect(bRes.status).toBe(200)
    const shopify = bRes.body.integrations.find((i: { id: string }) => i.id === 'shopify')
    expect(shopify.connected).toBe(false)
    expect(shopify.config).toEqual({})
  })

  it('Tenant B cannot add a note to Tenant A deal or conversation', async () => {
    expect((await tenantB.agent.post(`/api/pipeline/deals/${dealId}/notes`).send({ text: 'Hijacked note' })).status).toBe(404)
    expect((await tenantB.agent.post(`/api/conversations/${conversationId}/notes`).send({ text: 'Hijacked note' })).status).toBe(404)
  })
})
