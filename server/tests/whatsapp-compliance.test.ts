import { describe, expect, it, afterAll, beforeAll } from 'vitest'
import { assertCanSendFreeform, assertContactOptedIn, assertTemplateApproved } from '@/services/whatsappCompliance.service.js'
import { cleanupTenant, signupTenant, type TestSession } from './helpers.js'

describe('WhatsApp compliance engine — 24h window, opt-in, template approval', () => {
  it('assertCanSendFreeform rejects a contact who has never messaged in', () => {
    expect(() => assertCanSendFreeform([])).toThrow(/never messaged/i)
  })

  it('assertCanSendFreeform rejects once the last inbound message is older than 24h', () => {
    const messages = [{ direction: 'INBOUND' as const, createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000) }]
    expect(() => assertCanSendFreeform(messages)).toThrow(/24-hour/i)
  })

  it('assertCanSendFreeform allows a reply within the 24h window, using the most recent inbound message', () => {
    const messages = [
      { direction: 'INBOUND' as const, createdAt: new Date(Date.now() - 30 * 60 * 60 * 1000) }, // stale, but not the last one
      { direction: 'OUTBOUND' as const, createdAt: new Date(Date.now() - 20 * 60 * 60 * 1000) },
      { direction: 'INBOUND' as const, createdAt: new Date(Date.now() - 1 * 60 * 60 * 1000) }, // recent
    ]
    expect(() => assertCanSendFreeform(messages)).not.toThrow()
  })

  it('assertContactOptedIn rejects UNKNOWN and OPTED_OUT, allows only OPTED_IN', () => {
    expect(() => assertContactOptedIn('UNKNOWN')).toThrow(/not opted in/i)
    expect(() => assertContactOptedIn('OPTED_OUT')).toThrow(/opted out/i)
    expect(() => assertContactOptedIn('OPTED_IN')).not.toThrow()
  })

  it('assertTemplateApproved rejects anything but APPROVED', () => {
    expect(() => assertTemplateApproved({ status: 'DRAFT', name: 'promo' })).toThrow(/not approved/i)
    expect(() => assertTemplateApproved({ status: 'PENDING', name: 'promo' })).toThrow(/not approved/i)
    expect(() => assertTemplateApproved({ status: 'REJECTED', name: 'promo' })).toThrow(/not approved/i)
    expect(() => assertTemplateApproved({ status: 'APPROVED', name: 'promo' })).not.toThrow()
  })

  describe('campaign audience eligibility respects the tri-state opt-in (real HTTP + DB)', () => {
    let tenant: TestSession

    beforeAll(async () => {
      tenant = await signupTenant('whatsapp-compliance-audience')
      await tenant.agent.post('/api/contacts').send({ name: 'In', phone: '+15558880001', whatsappOptIn: 'OPTED_IN' })
      await tenant.agent.post('/api/contacts').send({ name: 'Out', phone: '+15558880002', whatsappOptIn: 'OPTED_OUT' })
      await tenant.agent.post('/api/contacts').send({ name: 'Unknown', phone: '+15558880003' }) // defaults to UNKNOWN — never assumed opted in
    })

    afterAll(async () => {
      await cleanupTenant(tenant)
    })

    it('only counts the OPTED_IN contact, excluding OPTED_OUT and UNKNOWN', async () => {
      const res = await tenant.agent.post('/api/campaigns/audience/preview').send({ audienceFilter: { mode: 'all' } })
      expect(res.status).toBe(200)
      expect(res.body.count).toBe(1)
    })
  })
})
