import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { cleanupTenant, cleanupUser, inviteAndLogin, signupTenant, type TestSession } from './helpers.js'

describe('Billing — sandbox checkout, cancel/resume, webhook security, tenant isolation, RBAC', () => {
  let tenantA: TestSession
  let tenantB: TestSession
  let supportAgent: TestSession

  beforeAll(async () => {
    tenantA = await signupTenant('billing-a')
    tenantB = await signupTenant('billing-b')
    supportAgent = await inviteAndLogin(tenantA, 'support_agent')
  })

  afterAll(async () => {
    await cleanupUser(supportAgent)
    await cleanupTenant(tenantA)
    await cleanupTenant(tenantB)
  })

  it('new tenant starts on the Free Trial plan, in sandbox mode (no provider configured in test env)', async () => {
    const res = await tenantA.agent.get('/api/billing/subscription')
    expect(res.status).toBe(200)
    expect(res.body.plan.id).toBe('trial')
    expect(res.body.sandbox).toBe(true)
    expect(res.body.billingCycle).toBe('monthly')
  })

  it('sandbox checkout switches the plan immediately and creates an honestly-labeled sandbox invoice', async () => {
    const res = await tenantA.agent.post('/api/billing/checkout').send({ planId: 'starter', billingCycle: 'monthly' })
    expect(res.status).toBe(200)
    expect(res.body.sandbox).toBe(true)
    expect(res.body.plan.id).toBe('starter')

    const sub = await tenantA.agent.get('/api/billing/subscription')
    expect(sub.body.plan.id).toBe('starter')
    expect(sub.body.status).toBe('active')

    const invoices = await tenantA.agent.get('/api/billing/invoices')
    expect(invoices.body.invoices.length).toBeGreaterThan(0)
    expect(invoices.body.invoices[0].number).toMatch(/^SANDBOX-/)
    expect(invoices.body.invoices[0].status).toBe('paid')
    expect(invoices.body.invoices[0].amount).toBe(999) // Starter plan price, monthly
  })

  it('yearly sandbox checkout charges 10x the monthly price (2 months free), not the raw monthly amount', async () => {
    const res = await tenantA.agent.post('/api/billing/checkout').send({ planId: 'pro', billingCycle: 'yearly' })
    expect(res.status).toBe(200)

    const sub = await tenantA.agent.get('/api/billing/subscription')
    expect(sub.body.billingCycle).toBe('yearly')

    const invoices = await tenantA.agent.get('/api/billing/invoices')
    const latest = invoices.body.invoices[0]
    expect(latest.amount).toBe(2999 * 10) // Pro plan price x 10
  })

  it('cancelling a sandbox subscription is immediate and reverts to the Free Trial plan (no real billing period to honor)', async () => {
    const res = await tenantA.agent.post('/api/billing/cancel')
    expect(res.status).toBe(200)
    expect(res.body.sandbox).toBe(true)
    expect(res.body.immediate).toBe(true)
    expect(res.body.plan.id).toBe('trial')

    const sub = await tenantA.agent.get('/api/billing/subscription')
    expect(sub.body.status).toBe('cancelled')
  })

  it('cancelling an already-cancelled subscription is rejected, not silently accepted', async () => {
    const res = await tenantA.agent.post('/api/billing/cancel')
    expect(res.status).toBe(400)
  })

  it('resuming a subscription that was never scheduled for cancellation is rejected', async () => {
    const res = await tenantB.agent.post('/api/billing/resume')
    expect(res.status).toBe(400)
  })

  it('rejects a payment webhook with no signature header — fails closed rather than skipping verification', async () => {
    const res = await tenantA.agent
      .post('/api/billing/webhook')
      .set('Content-Type', 'application/json')
      .send({ id: 'evt_test_no_sig', type: 'checkout.session.completed', data: { object: {} } })
    expect(res.status).toBe(401)
  })

  it('a role without MANAGE_BILLING cannot read or change billing', async () => {
    const getRes = await supportAgent.agent.get('/api/billing/subscription')
    expect(getRes.status).toBe(403)
    const checkoutRes = await supportAgent.agent.post('/api/billing/checkout').send({ planId: 'starter' })
    expect(checkoutRes.status).toBe(403)
    const cancelRes = await supportAgent.agent.post('/api/billing/cancel')
    expect(cancelRes.status).toBe(403)
  })

  it('tenant isolation — tenant B never sees tenant A\'s invoices or subscription state', async () => {
    const bSub = await tenantB.agent.get('/api/billing/subscription')
    expect(bSub.body.plan.id).toBe('trial') // unaffected by tenant A's plan changes above

    const bInvoices = await tenantB.agent.get('/api/billing/invoices')
    const aInvoiceNumbers = (await tenantA.agent.get('/api/billing/invoices')).body.invoices.map((i: { number: string }) => i.number)
    for (const inv of bInvoices.body.invoices) {
      expect(aInvoiceNumbers).not.toContain(inv.number)
    }
  })
})
