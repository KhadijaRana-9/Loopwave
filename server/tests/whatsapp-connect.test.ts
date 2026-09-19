import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { cleanupTenant, cleanupUser, inviteAndLogin, signupTenant, type TestSession } from './helpers.js'

describe('WhatsApp connect — phone validation, duplicate handling, sandbox labeling, RBAC', () => {
  let tenant: TestSession
  let viewer: TestSession

  beforeAll(async () => {
    tenant = await signupTenant('whatsapp-connect')
    viewer = await inviteAndLogin(tenant, 'viewer')
  })

  afterAll(async () => {
    await cleanupUser(viewer)
    await cleanupTenant(tenant)
  })

  it('rejects a connect request with no phone number', async () => {
    const res = await tenant.agent.post('/api/whatsapp/connect').send({ label: 'No Number' })
    expect(res.status).toBe(400)
  })

  it('rejects an obviously-invalid phone number instead of storing arbitrary text', async () => {
    const res = await tenant.agent.post('/api/whatsapp/connect').send({ label: 'Bad Number', phoneNumber: 'not-a-phone-number' })
    expect(res.status).toBe(400)
  })

  it('rejects a number missing the leading + / country code', async () => {
    const res = await tenant.agent.post('/api/whatsapp/connect').send({ label: 'No Plus', phoneNumber: '923001234567' })
    expect(res.status).toBe(400)
  })

  it('connects a valid E.164 number, stores the real number, and honestly labels it sandbox (no Meta credentials in test env)', async () => {
    const phoneNumber = `+1555${Date.now()}`.slice(0, 13)
    const res = await tenant.agent.post('/api/whatsapp/connect').send({ label: 'Sales Line', phoneNumber })
    expect(res.status).toBe(201)
    expect(res.body.sandbox).toBe(true)
    expect(res.body.status).toBe('pending_verification')
    expect(res.body.displayNumber).toBe(phoneNumber) // the real number, not a placeholder string

    const list = await tenant.agent.get('/api/whatsapp/numbers')
    expect(list.body.numbers.find((n: { id: string }) => n.id === res.body.id)?.sandbox).toBe(true)
  })

  it('rejects re-adding the exact same number while it is still pending/connected on this workspace', async () => {
    // Own tenant — the Free Trial plan only allows 1 WhatsApp number, and the
    // shared `tenant` above already used its one slot in the previous test.
    const dup = await signupTenant('whatsapp-duplicate')
    await dup.agent.post('/api/billing/checkout').send({ planId: 'business', billingCycle: 'monthly' }) // sandbox — raises the limit so this test can add 2
    const phoneNumber = `+1556${Date.now()}`.slice(0, 13)
    const first = await dup.agent.post('/api/whatsapp/connect').send({ label: 'Duplicate Test', phoneNumber })
    expect(first.status).toBe(201)

    const second = await dup.agent.post('/api/whatsapp/connect').send({ label: 'Duplicate Test Again', phoneNumber })
    expect(second.status).toBe(409)
    await cleanupTenant(dup)
  })

  it('allows re-adding a number after the previous entry was disconnected', async () => {
    const reconnect = await signupTenant('whatsapp-reconnect')
    const phoneNumber = `+1557${Date.now()}`.slice(0, 13)
    const first = await reconnect.agent.post('/api/whatsapp/connect').send({ label: 'Reconnect Test', phoneNumber })
    expect(first.status).toBe(201)

    await reconnect.agent.post(`/api/whatsapp/numbers/${first.body.id}/disconnect`)

    const second = await reconnect.agent.post('/api/whatsapp/connect').send({ label: 'Reconnect Test 2', phoneNumber })
    expect(second.status).toBe(201)
    await cleanupTenant(reconnect)
  })

  it('a role without MANAGE_WHATSAPP cannot connect a number', async () => {
    const res = await viewer.agent.post('/api/whatsapp/connect').send({ label: 'Viewer Attempt', phoneNumber: `+1558${Date.now()}`.slice(0, 13) })
    expect(res.status).toBe(403)
  })
})
