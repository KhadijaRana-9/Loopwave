import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { cleanupTenant, cleanupUser, inviteAndLogin, signupTenant, type TestSession } from './helpers.js'

describe('RBAC — permissions enforced server-side, not just hidden in the UI', () => {
  let owner: TestSession
  let viewer: TestSession
  let supportAgent: TestSession

  beforeAll(async () => {
    owner = await signupTenant('rbac')
    // Trial plan caps teamMembers at 2 (i.e. just the owner + 1) — upgrade
    // via the real sandbox checkout path so inviting two teammates below
    // doesn't hit that unrelated limit.
    await owner.agent.post('/api/billing/checkout').send({ planId: 'pro' })
    viewer = await inviteAndLogin(owner, 'viewer')
    supportAgent = await inviteAndLogin(owner, 'support_agent')
  })

  afterAll(async () => {
    await cleanupUser(viewer)
    await cleanupUser(supportAgent)
    await cleanupTenant(owner)
  })

  it('owner can create a contact', async () => {
    const res = await owner.agent.post('/api/contacts').send({ name: 'RBAC Test Contact', phone: '+15550001111' })
    expect(res.status).toBe(201)
  })

  it('viewer can list contacts (VIEW_CONTACTS) but not create one (no EDIT_CONTACTS)', async () => {
    const listRes = await viewer.agent.get('/api/contacts')
    expect(listRes.status).toBe(200)

    const createRes = await viewer.agent.post('/api/contacts').send({ name: 'Should Fail', phone: '+15550002222' })
    expect(createRes.status).toBe(403)
  })

  it('viewer cannot access billing (owner-only permission)', async () => {
    const res = await viewer.agent.get('/api/billing/subscription')
    expect(res.status).toBe(403)
  })

  it('support agent can view inbox but cannot manage campaigns', async () => {
    const inboxRes = await supportAgent.agent.get('/api/conversations')
    expect(inboxRes.status).toBe(200)

    const campaignRes = await supportAgent.agent.get('/api/campaigns')
    expect(campaignRes.status).toBe(403)
  })

  it('viewer cannot invite team members (MANAGE_TEAM required)', async () => {
    const res = await viewer.agent.post('/api/team').send({ name: 'Nope', email: 'nope@test.loopwave.internal', role: 'viewer' })
    expect(res.status).toBe(403)
  })

  it('non-super-admin cannot reach the super admin API', async () => {
    const res = await owner.agent.get('/api/admin/tenants')
    expect(res.status).toBe(403)
  })

  it('unauthenticated request is rejected before permission checks even run', async () => {
    const res = await owner.agent.post('/api/auth/logout')
    expect(res.status).toBe(204)
    const after = await owner.agent.get('/api/contacts')
    expect(after.status).toBe(401)
  })
})
