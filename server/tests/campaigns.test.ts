import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { cleanupTenant, cleanupUser, inviteAndLogin, signupTenant, type TestSession } from './helpers.js'
import { prisma } from '@/config/prisma.js'

describe('Campaigns — AI compose, audience resolution, usage enforcement, tenant isolation, RBAC', () => {
  let tenantA: TestSession
  let tenantB: TestSession
  let supportAgent: TestSession

  beforeAll(async () => {
    tenantA = await signupTenant('campaigns-a')
    tenantB = await signupTenant('campaigns-b')
    supportAgent = await inviteAndLogin(tenantA, 'support_agent')

    // New contacts default to UNKNOWN (never assumed opted in) — campaigns
    // require an explicit OPTED_IN, so these two are set directly to
    // exercise the eligibility filter itself.
    await tenantA.agent.post('/api/contacts').send({ name: 'Aisha Buyer', phone: '+15551110001', whatsappOptIn: 'OPTED_IN' })
    await tenantA.agent.post('/api/contacts').send({ name: 'Ravi Buyer', phone: '+15551110002', whatsappOptIn: 'OPTED_IN' })
    await tenantA.agent.post('/api/contacts').send({ name: 'Zoe Optout', phone: '+15551110003', whatsappOptIn: 'OPTED_OUT' })
  })

  afterAll(async () => {
    await cleanupUser(supportAgent)
    await cleanupTenant(tenantA)
    await cleanupTenant(tenantB)
  })

  it('AI compose returns a real message built from the brief (demo provider — no OPENAI_API_KEY in test env)', async () => {
    const res = await tenantA.agent.post('/api/campaigns/ai/compose').send({
      campaignName: 'Summer Sale',
      topic: 'Summer Sale is Live',
      subheading: 'Up to 50% off',
      cta: 'Shop Now',
      action: 'generate',
    })
    expect(res.status).toBe(200)
    expect(res.body.message).toContain('Summer Sale')
    expect(res.body.demo).toBe(true)
  })

  it('audience preview resolves "all" mode server-side, excluding opted-out contacts, without the caller sending a contact list', async () => {
    const res = await tenantA.agent.post('/api/campaigns/audience/preview').send({ audienceFilter: { mode: 'all' } })
    expect(res.status).toBe(200)
    expect(res.body.count).toBe(2) // 2 opted-in — the opted-out contact is excluded
    expect(res.body.plan.limit).toBe(250) // Free Trial plan default
  })

  it('creates a campaign from an AI-composed message and actually sends it (demo WhatsApp provider)', async () => {
    const res = await tenantA.agent.post('/api/campaigns').send({
      name: 'Summer Sale',
      message: 'Hi {{firstName}}, our sale is live!',
      audienceFilter: { mode: 'all' },
    })
    expect(res.status).toBe(201)
    expect(res.body.campaign.audienceSize).toBe(2)
    expect(['running', 'completed']).toContain(res.body.campaign.status)
  })

  it('rejects a message using a variable nothing can resolve, instead of silently sending a literal {{placeholder}}', async () => {
    const res = await tenantA.agent.post('/api/campaigns').send({
      name: 'Broken Vars',
      message: 'Hi {{firstName}}, your code is {{totallyMadeUpField}}',
      audienceFilter: { mode: 'all' },
    })
    expect(res.status).toBe(400)
    expect(res.body.error.details.unresolvableVariables).toContain('totallyMadeUpField')
  })

  it('backend blocks a send that would exceed the plan\'s remaining monthly message allowance, even though the frontend never sent a count', async () => {
    const periodKey = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`
    // Read real current usage first (the earlier test's send is fire-and-
    // forget, so its usage record may or may not have landed yet) instead of
    // assuming a prior state, then push it to exactly 1-short of the limit —
    // proves the block is a real recalculation against real usage rows, not
    // a frontend-supplied number.
    // dispatchCampaign records usage BEFORE it stamps COMPLETED, so once every
    // earlier campaign has settled its usage is final. Without this wait the
    // read below races the earlier fire-and-forget send on a slow remote DB.
    for (let i = 0; i < 90; i++) {
      const list = await tenantA.agent.get('/api/campaigns')
      if ((list.body.campaigns as { status: string }[]).every((c) => ['completed', 'failed', 'draft', 'cancelled'].includes(c.status))) break
      await new Promise((r) => setTimeout(r, 1000))
    }

    const before = await tenantA.agent.post('/api/campaigns/audience/preview').send({ audienceFilter: { mode: 'all' } })
    const { limit, used } = before.body.plan as { limit: number; used: number }
    const topUp = limit - used - 1
    if (topUp > 0) await prisma.usageRecord.create({ data: { tenantId: tenantA.tenantId, metric: 'monthlyMarketingMessages', amount: topUp, periodKey } })

    const res = await tenantA.agent.post('/api/campaigns').send({
      name: 'Over Limit Campaign',
      message: 'Hi {{firstName}}, one more sale!',
      audienceFilter: { mode: 'all' },
    })
    expect(res.status).toBe(402)
    expect(res.body.error.code).toBe('USAGE_ALLOWANCE_EXCEEDED')
    expect(res.body.error.details.remaining).toBe(1)
    expect(res.body.error.message).toContain('2')
  })

  it('tenant B cannot see, cancel, or send using tenant A\'s campaigns or contacts', async () => {
    const listA = await tenantA.agent.get('/api/campaigns')
    const campaignId = listA.body.campaigns[0].id as string

    const getRes = await tenantB.agent.get(`/api/campaigns/${campaignId}`)
    expect(getRes.status).toBe(404)

    const cancelRes = await tenantB.agent.post(`/api/campaigns/${campaignId}/cancel`)
    expect(cancelRes.status).toBe(404)

    // Tenant B's own audience preview must never see tenant A's contacts.
    const previewRes = await tenantB.agent.post('/api/campaigns/audience/preview').send({ audienceFilter: { mode: 'all' } })
    expect(previewRes.body.count).toBe(0)
  })

  it('a support agent (no MANAGE_CAMPAIGNS/SEND_CAMPAIGNS permission) cannot create or list campaigns', async () => {
    const listRes = await supportAgent.agent.get('/api/campaigns')
    expect(listRes.status).toBe(403)

    const createRes = await supportAgent.agent.post('/api/campaigns').send({ name: 'x', message: 'x', audienceFilter: { mode: 'all' } })
    expect(createRes.status).toBe(403)
  })

  it('scheduling for later returns a SCHEDULED campaign, and cancelling it prevents it from ever running', async () => {
    const future = new Date(Date.now() + 3600_000).toISOString()
    const createRes = await tenantB.agent.post('/api/contacts').send({ name: 'Later Buyer', phone: '+15551110099' })
    expect(createRes.status).toBe(201)

    const scheduleRes = await tenantB.agent.post('/api/campaigns').send({
      name: 'Scheduled Sale',
      message: 'Hi {{firstName}}, coming soon!',
      audienceFilter: { mode: 'all' },
      scheduledAt: future,
    })
    expect(scheduleRes.status).toBe(201)
    expect(scheduleRes.body.campaign.status).toBe('scheduled')

    const cancelRes = await tenantB.agent.post(`/api/campaigns/${scheduleRes.body.campaign.id}/cancel`)
    expect(cancelRes.status).toBe(200)
    expect(cancelRes.body.campaign.status).toBe('draft')
    expect(cancelRes.body.campaign.scheduledAt).toBeNull()
  })
})
