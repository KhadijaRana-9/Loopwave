import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanupTenant, signupTenant, type TestSession } from './helpers.js'
import { prisma } from '@/config/prisma.js'
import { integrationReadiness } from '@/config/env.js'
import { whatsappService } from '@/services/whatsapp.service.js'
import { decryptSecret } from '@/utils/crypto.js'

// IMPORTANT — what this file is and is NOT.
// It stubs ONLY the network boundary to graph.facebook.com (global fetch) with
// canned Graph API response shapes, and runs Loopwave's real completeEmbeddedSignup
// / repository / crypto / Prisma code against them. That proves OUR logic:
// encrypted token storage, no token leakage to the API, cross-tenant claim
// guards, reconnect-in-place, honest Meta-error surfacing.
// It does NOT prove Meta accepts a real code, a real WABA or a real number —
// that needs real META_APP_ID/META_CONFIG_ID/WHATSAPP_APP_SECRET and a real
// Embedded Signup run, which no test in this repo can do. Nothing here should
// be read as "verified against Meta".
const LONG_LIVED_TOKEN = 'EAAG-test-long-lived-token-not-a-real-meta-token'

describe('Embedded Signup completion — our logic against a stubbed Graph API boundary', () => {
  let tenantA: TestSession
  let tenantB: TestSession
  const wabaId = `waba-${Date.now()}`
  const phoneNumberId = `phone-${Date.now()}`
  const originalReadiness = integrationReadiness.whatsappSignup

  const input = { code: 'test-auth-code', wabaId, phoneNumberId, label: 'Sales Line' }

  function stubGraph(overrides: { failStep?: string } = {}) {
    return vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      const u = String(url)
      const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
      if (overrides.failStep && u.includes(overrides.failStep)) {
        return json({ error: { message: 'Invalid verification code format.', code: 100 } }, 400)
      }
      if (u.includes('/oauth/access_token') && u.includes('fb_exchange_token')) return json({ access_token: LONG_LIVED_TOKEN, expires_in: 5_184_000 })
      if (u.includes('/oauth/access_token')) return json({ access_token: 'short-lived-token', token_type: 'bearer', expires_in: 3600 })
      if (u.includes('/subscribed_apps')) return json({ success: true })
      if (u.includes('/register')) return json({ success: true })
      if (u.includes(`/${wabaId}?`)) return json({ id: wabaId, name: 'Test Business WABA', owner_business_info: { id: 'biz-123' } })
      if (u.includes(`/${phoneNumberId}?`)) return json({ id: phoneNumberId, display_phone_number: '+92 300 1234567', verified_name: 'Test Business', quality_rating: 'GREEN' })
      return json({ error: { message: `Unstubbed Graph call in test: ${u}`, code: 1 } }, 500)
    })
  }

  beforeAll(async () => {
    tenantA = await signupTenant('embedded-signup-a')
    tenantB = await signupTenant('embedded-signup-b')
  })

  beforeEach(() => {
    integrationReadiness.whatsappSignup = true
  })

  afterEach(() => {
    integrationReadiness.whatsappSignup = originalReadiness
    vi.restoreAllMocks()
  })

  afterAll(async () => {
    await cleanupTenant(tenantA)
    await cleanupTenant(tenantB)
  })

  it('stores WABA id, business id, phone number id, and an ENCRYPTED per-tenant token', async () => {
    stubGraph()
    const number = await whatsappService.completeEmbeddedSignup(tenantA.tenantId, input)
    expect(number.status).toBe('connected')

    const account = await prisma.whatsAppAccount.findFirstOrThrow({ where: { tenantId: tenantA.tenantId }, include: { phoneNumbers: true } })
    expect(account.wabaId).toBe(wabaId)
    expect(account.businessId).toBe('biz-123')
    expect(account.phoneNumbers[0]?.metaPhoneNumberId).toBe(phoneNumberId)
    expect(account.phoneNumbers[0]?.displayNumber).toBe('+92 300 1234567')

    expect(account.accessTokenCipher).toBeTruthy()
    expect(account.accessTokenCipher).not.toContain(LONG_LIVED_TOKEN)
    expect(decryptSecret(account.accessTokenCipher!)).toBe(LONG_LIVED_TOKEN)

    const daysToExpiry = (account.tokenExpiresAt!.getTime() - Date.now()) / 86_400_000
    expect(daysToExpiry).toBeGreaterThan(59)
    expect(daysToExpiry).toBeLessThan(61)
  })

  it('never returns the token or its ciphertext through any WhatsApp API response', async () => {
    const res = await tenantA.agent.get('/api/whatsapp/numbers')
    expect(res.status).toBe(200)
    const body = JSON.stringify(res.body)
    expect(body).not.toContain(LONG_LIVED_TOKEN)
    expect(body).not.toMatch(/accessToken|accessTokenCipher|wabaId/i)
    expect(res.body.numbers).toHaveLength(1)
  })

  it("another workspace cannot claim this WABA or phone number, and never sees it listed", async () => {
    stubGraph()
    await expect(whatsappService.completeEmbeddedSignup(tenantB.tenantId, { ...input, label: 'Hijack' })).rejects.toThrow(/different workspace/i)

    const res = await tenantB.agent.get('/api/whatsapp/numbers')
    expect(res.body.numbers).toHaveLength(0)
    // (Every workspace gets an empty account row at signup — what matters is
    // that the rejected claim attached neither this WABA nor this number to B.)
    expect(await prisma.whatsAppAccount.count({ where: { tenantId: tenantB.tenantId, wabaId } })).toBe(0)
    expect(await prisma.whatsAppPhoneNumber.count({ where: { account: { tenantId: tenantB.tenantId }, metaPhoneNumberId: phoneNumberId } })).toBe(0)
  })

  it('surfaces the real Meta error and persists nothing when Meta rejects the connection', async () => {
    const before = await prisma.whatsAppPhoneNumber.count({ where: { account: { tenantId: tenantB.tenantId } } })
    stubGraph({ failStep: '/oauth/access_token' })
    await expect(
      whatsappService.completeEmbeddedSignup(tenantB.tenantId, { code: 'bad', wabaId: `waba-other-${Date.now()}`, phoneNumberId: `phone-other-${Date.now()}`, label: 'X' }),
    ).rejects.toThrow(/Meta rejected this connection: Invalid verification code format/)
    expect(await prisma.whatsAppPhoneNumber.count({ where: { account: { tenantId: tenantB.tenantId } } })).toBe(before)
  })

  it('reconnecting a REAUTHORIZATION_REQUIRED number restores the SAME row (no duplicate) even at the plan limit', async () => {
    const existing = await prisma.whatsAppPhoneNumber.findFirstOrThrow({ where: { account: { tenantId: tenantA.tenantId } } })
    await prisma.whatsAppPhoneNumber.update({ where: { id: existing.id }, data: { status: 'REAUTHORIZATION_REQUIRED' } })

    stubGraph()
    const reconnected = await whatsappService.completeEmbeddedSignup(tenantA.tenantId, input)
    expect(reconnected.status).toBe('connected')

    const numbers = await prisma.whatsAppPhoneNumber.findMany({ where: { account: { tenantId: tenantA.tenantId } } })
    expect(numbers).toHaveLength(1)
    expect(numbers[0]?.id).toBe(existing.id)
    expect(numbers[0]?.status).toBe('CONNECTED')
  })

  it('refuses honestly — makes no Graph call — when the Meta App is not configured', async () => {
    integrationReadiness.whatsappSignup = false
    const spy = stubGraph()
    await expect(whatsappService.completeEmbeddedSignup(tenantB.tenantId, input)).rejects.toThrow(/not configured/i)
    expect(spy).not.toHaveBeenCalled()
  })
})
