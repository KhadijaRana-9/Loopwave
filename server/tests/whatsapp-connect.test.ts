import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { cleanupTenant, cleanupUser, inviteAndLogin, signupTenant, type TestSession } from './helpers.js'

// No Meta Developer App is configured in the test environment (same as
// every environment right now — see the WhatsApp integration audit), so
// what's provable here is: validation, RBAC, and the honest "not
// configured" refusal. The full connect flow (code exchange, cross-tenant
// WABA/number hijack guard, encrypted token storage) is implemented in
// whatsapp.service.ts#completeEmbeddedSignup but requires real
// META_APP_ID/META_CONFIG_ID/WHATSAPP_APP_SECRET to exercise end-to-end —
// it is NOT claimed as tested here. whatsapp-webhook.test.ts covers the
// parts of the real flow (webhook routing, tenant resolution, template
// status sync) that don't require a live Meta App.
describe('WhatsApp Embedded Signup connect — validation, RBAC, honest not-configured refusal', () => {
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

  it('GET /whatsapp/signup-config honestly reports not configured (no Meta App in this environment)', async () => {
    const res = await tenant.agent.get('/api/whatsapp/signup-config')
    expect(res.status).toBe(200)
    expect(res.body.configured).toBe(false)
    expect(res.body.appId).toBeNull()
  })

  it('rejects a connect request missing the required Embedded Signup fields', async () => {
    const res = await tenant.agent.post('/api/whatsapp/connect').send({ label: 'Sales Line' })
    expect(res.status).toBe(400)
  })

  it('refuses to connect — honestly, not silently — when no Meta App is configured', async () => {
    const res = await tenant.agent.post('/api/whatsapp/connect').send({
      code: 'fake-auth-code',
      wabaId: 'fake-waba-id',
      phoneNumberId: 'fake-phone-number-id',
      label: 'Sales Line',
    })
    expect(res.status).toBe(400)
    expect(res.body.error.message).toMatch(/not configured/i)

    // And critically: nothing gets marked CONNECTED as a side effect of the refusal.
    const list = await tenant.agent.get('/api/whatsapp/numbers')
    expect(list.body.numbers.some((n: { status: string }) => n.status === 'connected')).toBe(false)
  })

  it('a role without MANAGE_WHATSAPP cannot attempt to connect a number', async () => {
    const res = await viewer.agent.post('/api/whatsapp/connect').send({ code: 'x', wabaId: 'x', phoneNumberId: 'x', label: 'Viewer Attempt' })
    expect(res.status).toBe(403)
  })

  it('a role without MANAGE_WHATSAPP cannot list or disconnect numbers either', async () => {
    const listRes = await viewer.agent.get('/api/whatsapp/numbers')
    expect(listRes.status).toBe(403)
    const disconnectRes = await viewer.agent.post('/api/whatsapp/numbers/nonexistent/disconnect')
    expect(disconnectRes.status).toBe(403)
  })
})
