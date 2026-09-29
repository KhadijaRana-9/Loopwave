import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { cleanupTenant, signedWhatsappWebhookPost, signupTenant, type TestSession } from './helpers.js'
import { prisma } from '@/config/prisma.js'
import { encryptSecret } from '@/utils/crypto.js'
import { dispatchCampaign } from '@/services/campaigns.service.js'
import { templatesService } from '@/services/templates.service.js'

// CONTRACT tests: Loopwave's code against payload shapes taken from Meta's
// official webhook / Graph documentation — the shapes a hand-written fixture
// tends to get wrong and that only break once real Meta traffic arrives:
//   * entry[].id is the WABA id, identical on EVERY event
//   * messages[].from is bare digits (no '+')
//   * message_template_id is a JSON integer
//   * status webhooks can arrive out of order
// Only the network boundary to graph.facebook.com is stubbed (global fetch);
// everything else runs for real against the database. That proves OUR
// handling. It does NOT prove Meta accepts a real number/template/token —
// nothing in this file is "verified against Meta".
const WABA_ID = `waba-contract-${Date.now()}` // one WABA => the same entry.id on every event, as in production
const uniq = () => Math.random().toString(36).slice(2, 8)

function inbound(phoneNumberId: string, from: string, wamid: string, text: string) {
  return {
    object: 'whatsapp_business_account',
    entry: [
      {
        id: WABA_ID,
        changes: [
          {
            field: 'messages',
            value: {
              messaging_product: 'whatsapp',
              metadata: { display_phone_number: '15550001000', phone_number_id: phoneNumberId },
              contacts: [{ profile: { name: 'Contract Contact' }, wa_id: from }],
              messages: [{ from, id: wamid, timestamp: String(Math.floor(Date.now() / 1000)), type: 'text', text: { body: text } }],
            },
          },
        ],
      },
    ],
  }
}

function statusEvent(phoneNumberId: string, wamid: string, status: string, extra: Record<string, unknown> = {}) {
  return {
    object: 'whatsapp_business_account',
    entry: [
      {
        id: WABA_ID,
        changes: [
          {
            field: 'messages',
            value: {
              messaging_product: 'whatsapp',
              metadata: { display_phone_number: '15550001000', phone_number_id: phoneNumberId },
              statuses: [{ id: wamid, status, timestamp: String(Date.now()), recipient_id: '923000000000', ...extra }],
            },
          },
        ],
      },
    ],
  }
}

function templateEvent(metaTemplateId: number, event: string, reason: string | null = null) {
  return {
    object: 'whatsapp_business_account',
    entry: [{ id: WABA_ID, changes: [{ field: 'message_template_status_update', value: { event, message_template_id: metaTemplateId, message_template_name: 'x', message_template_language: 'en_US', reason } }] }],
  }
}

async function connectNumber(tenantId: string, opts: { phoneNumberId: string; token?: string; status?: 'CONNECTED' | 'DISCONNECTED' | 'REAUTHORIZATION_REQUIRED'; waba?: string }) {
  const account = await prisma.whatsAppAccount.create({ data: { tenantId, wabaId: opts.waba ?? `${WABA_ID}-${uniq()}`, accessTokenCipher: encryptSecret(opts.token ?? 'test-token') } })
  const number = await prisma.whatsAppPhoneNumber.create({
    data: { accountId: account.id, displayNumber: '+15550001000', label: 'Contract Line', metaPhoneNumberId: opts.phoneNumberId, status: opts.status ?? 'CONNECTED', connectedAt: new Date() },
  })
  return { account, number }
}

describe('Meta contract — webhook ingestion (real payload shapes)', () => {
  let tenantA: TestSession
  let tenantB: TestSession
  const phoneA = `contract-phone-a-${uniq()}`

  beforeAll(async () => {
    tenantA = await signupTenant('contract-a')
    tenantB = await signupTenant('contract-b')
    await connectNumber(tenantA.tenantId, { phoneNumberId: phoneA })
  })
  afterAll(async () => {
    await cleanupTenant(tenantA)
    await cleanupTenant(tenantB)
  })

  it('processes EVERY event from the same WABA — entry[].id is the WABA id, not an event id', async () => {
    const from = '923111000001'
    const r1 = await signedWhatsappWebhookPost(inbound(phoneA, from, `wamid.${uniq()}`, 'first message'))
    const r2 = await signedWhatsappWebhookPost(inbound(phoneA, from, `wamid.${uniq()}`, 'second message'))
    expect([r1.status, r2.status]).toEqual([200, 200])

    const contact = await prisma.contact.findFirstOrThrow({ where: { tenantId: tenantA.tenantId, phone: `+${from}` } })
    const conversation = await prisma.conversation.findFirstOrThrow({ where: { tenantId: tenantA.tenantId, contactId: contact.id }, include: { messages: true } })
    expect(conversation.messages.map((m) => m.text).sort()).toEqual(['first message', 'second message'])
  })

  it('a re-delivery of the identical body is still deduplicated', async () => {
    const payload = inbound(phoneA, '923111000009', `wamid.${uniq()}`, 'only once')
    await signedWhatsappWebhookPost(payload)
    await signedWhatsappWebhookPost(payload)
    const contact = await prisma.contact.findFirstOrThrow({ where: { tenantId: tenantA.tenantId, phone: '+923111000009' } })
    const messages = await prisma.message.findMany({ where: { conversation: { contactId: contact.id } } })
    expect(messages).toHaveLength(1)
  })

  it("an inbound sender (bare digits) attaches to the existing '+E.164' contact instead of creating a duplicate", async () => {
    const existing = await prisma.contact.create({ data: { tenantId: tenantA.tenantId, name: 'Existing Customer', phone: '+923111000002', source: 'import', whatsappOptIn: 'UNKNOWN' } })
    await signedWhatsappWebhookPost(inbound(phoneA, '923111000002', `wamid.${uniq()}`, 'hello again'))

    const matches = await prisma.contact.findMany({ where: { tenantId: tenantA.tenantId, phone: { in: ['+923111000002', '923111000002'] } } })
    expect(matches).toHaveLength(1)
    expect(matches[0]?.id).toBe(existing.id)
    expect(matches[0]?.whatsappOptIn).toBe('OPTED_IN') // the ORIGINAL contact's consent state was updated
    const conversation = await prisma.conversation.findFirstOrThrow({ where: { contactId: existing.id }, include: { messages: true } })
    expect(conversation.messages.some((m) => m.text === 'hello again')).toBe(true)
  })

  it('delivery statuses only move forward, and a failed status records Meta\'s error', async () => {
    const contact = await prisma.contact.create({ data: { tenantId: tenantA.tenantId, name: 'Status Contact', phone: '+923111000003', source: 'manual' } })
    const conversation = await prisma.conversation.create({ data: { tenantId: tenantA.tenantId, contactId: contact.id } })
    const okWamid = `wamid.ok-${uniq()}`
    const failWamid = `wamid.fail-${uniq()}`
    await prisma.message.create({ data: { conversationId: conversation.id, direction: 'OUTBOUND', type: 'text', text: 'a', status: 'SENT', waMessageId: okWamid } })
    await prisma.message.create({ data: { conversationId: conversation.id, direction: 'OUTBOUND', type: 'text', text: 'b', status: 'SENT', waMessageId: failWamid } })

    await signedWhatsappWebhookPost(statusEvent(phoneA, okWamid, 'read'))
    await signedWhatsappWebhookPost(statusEvent(phoneA, okWamid, 'delivered')) // arrives late
    await signedWhatsappWebhookPost(statusEvent(phoneA, okWamid, 'sent')) // arrives even later
    expect((await prisma.message.findFirstOrThrow({ where: { waMessageId: okWamid } })).status).toBe('READ')

    await signedWhatsappWebhookPost(
      statusEvent(phoneA, failWamid, 'failed', { errors: [{ code: 131047, title: 'Re-engagement message', message: 'Re-engagement message', error_data: { details: 'More than 24 hours have passed since the customer last replied.' } }] }),
    )
    await signedWhatsappWebhookPost(statusEvent(phoneA, failWamid, 'delivered')) // must not resurrect a failed message
    const failed = await prisma.message.findFirstOrThrow({ where: { waMessageId: failWamid } })
    expect(failed.status).toBe('FAILED')
    expect(failed.errorMessage).toMatch(/More than 24 hours/)
    expect(failed.errorMessage).toMatch(/131047/)
  })

  it('template status webhooks match Meta\'s INTEGER template id and map its full lifecycle vocabulary', async () => {
    const metaId = 1689556908000 + Math.floor(Math.random() * 999)
    const template = await prisma.template.create({
      data: { tenantId: tenantA.tenantId, name: `contract_tpl_${uniq()}`, category: 'marketing', body: 'Hi', status: 'PENDING', metaTemplateId: String(metaId) },
    })
    const status = async () => prisma.template.findUniqueOrThrow({ where: { id: template.id } })

    await signedWhatsappWebhookPost(templateEvent(metaId, 'REJECTED', 'INVALID_FORMAT'))
    expect(await status()).toMatchObject({ status: 'REJECTED', rejectedReason: 'INVALID_FORMAT' })
    await signedWhatsappWebhookPost(templateEvent(metaId, 'IN_APPEAL', 'NONE'))
    expect(await status()).toMatchObject({ status: 'PENDING', rejectedReason: null })
    await signedWhatsappWebhookPost(templateEvent(metaId, 'APPROVED', 'NONE'))
    expect((await status()).status).toBe('APPROVED')
    await signedWhatsappWebhookPost(templateEvent(metaId, 'DISABLED'))
    expect((await status()).status).toBe('PAUSED')
    await signedWhatsappWebhookPost(templateEvent(metaId, 'REINSTATED'))
    expect((await status()).status).toBe('APPROVED')
  })

  it('routes to the workspace that CURRENTLY holds a phone number, never to a stale DISCONNECTED row from another workspace', async () => {
    const sharedPhone = `contract-shared-${uniq()}`
    await connectNumber(tenantA.tenantId, { phoneNumberId: sharedPhone, status: 'DISCONNECTED' }) // A released it first
    await connectNumber(tenantB.tenantId, { phoneNumberId: sharedPhone, status: 'CONNECTED' }) // B holds it now
    await signedWhatsappWebhookPost(inbound(sharedPhone, '923111000004', `wamid.${uniq()}`, 'for workspace B'))

    expect(await prisma.contact.count({ where: { tenantId: tenantB.tenantId, phone: '+923111000004' } })).toBe(1)
    expect(await prisma.contact.count({ where: { tenantId: tenantA.tenantId, phone: '+923111000004' } })).toBe(0)
  })
})

describe('Meta contract — campaign dispatch with the tenant\'s own credentials', () => {
  let tenantC: TestSession
  let tenantD: TestSession
  const phoneC = `contract-phone-c-${uniq()}`
  const phoneD = `contract-phone-d-${uniq()}`
  let calls: { url: string; auth: string; body: Record<string, unknown> }[] = []

  beforeAll(async () => {
    tenantC = await signupTenant('contract-c')
    tenantD = await signupTenant('contract-d')
    await connectNumber(tenantC.tenantId, { phoneNumberId: phoneC, token: 'good-token-C' })
    await connectNumber(tenantD.tenantId, { phoneNumberId: phoneD, token: 'dead-token-D' })
  })
  afterEach(() => vi.restoreAllMocks())
  afterAll(async () => {
    await cleanupTenant(tenantC)
    await cleanupTenant(tenantD)
  })

  function stubMessages(respond: (n: number) => { status: number; body: unknown }) {
    calls = []
    return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input)
      const headers = (init?.headers ?? {}) as Record<string, string>
      calls.push({ url, auth: headers.Authorization ?? '', body: JSON.parse(String(init?.body ?? '{}')) })
      const { status, body } = respond(calls.length)
      return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
    })
  }

  async function seedCampaign(tenantId: string, contacts: { phone: string; optIn: 'OPTED_IN' | 'OPTED_OUT' }[]) {
    const template = await prisma.template.create({
      data: { tenantId, name: `promo_${uniq()}`, category: 'marketing', language: 'en_US', body: 'Big sale today', status: 'APPROVED', metaTemplateId: uniq() },
    })
    const campaign = await prisma.campaign.create({ data: { tenantId, name: 'Contract Campaign', templateId: template.id, status: 'RUNNING', audienceFilter: { mode: 'all' } } })
    const created = []
    for (const c of contacts) {
      const contact = await prisma.contact.create({ data: { tenantId, name: `C ${uniq()}`, phone: c.phone, source: 'manual', whatsappOptIn: c.optIn } })
      await prisma.campaignRecipient.create({ data: { campaignId: campaign.id, contactId: contact.id } })
      created.push(contact)
    }
    return { template, campaign, contacts: created }
  }

  it('sends an APPROVED template through Meta with THIS tenant\'s token and digits-only numbers, tracks message ids, skips opted-out, then applies status webhooks in order', async () => {
    const { template, campaign } = await seedCampaign(tenantC.tenantId, [
      { phone: '+92 300 1111111', optIn: 'OPTED_IN' },
      { phone: '+923002222222', optIn: 'OPTED_IN' },
      { phone: '+923003333333', optIn: 'OPTED_OUT' },
    ])
    stubMessages((n) => ({ status: 200, body: { messaging_product: 'whatsapp', messages: [{ id: `wamid.CONTRACT-${campaign.id}-${n}` }] } }))

    await dispatchCampaign(tenantC.tenantId, campaign.id)

    expect(calls).toHaveLength(2) // the opted-out contact never reaches Meta
    for (const call of calls) {
      expect(call.url).toContain(`/${phoneC}/messages`)
      expect(call.auth).toBe('Bearer good-token-C') // decrypted from THIS tenant's account, not a shared credential
      expect(call.body).toMatchObject({ messaging_product: 'whatsapp', type: 'template', template: { name: template.name, language: { code: 'en_US' } } })
    }
    expect(calls.map((c) => c.body.to).sort()).toEqual(['923001111111', '923002222222'])

    const recipients = await prisma.campaignRecipient.findMany({ where: { campaignId: campaign.id }, orderBy: { id: 'asc' } })
    const sent = recipients.filter((r) => r.status === 'SENT')
    expect(sent).toHaveLength(2)
    expect(sent.every((r) => r.waMessageId?.startsWith('wamid.CONTRACT-') && r.demo === false)).toBe(true)
    expect(recipients.find((r) => r.status === 'FAILED')?.errorMessage).toMatch(/opted out/i)
    expect((await prisma.campaign.findUniqueOrThrow({ where: { id: campaign.id } })).status).toBe('COMPLETED')
    const usage = await prisma.usageRecord.aggregate({ where: { tenantId: tenantC.tenantId, metric: 'monthlyMarketingMessages' }, _sum: { amount: true } })
    expect(usage._sum.amount).toBe(2) // only messages that actually went out count

    const first = sent[0]!.waMessageId!
    await signedWhatsappWebhookPost(statusEvent(phoneC, first, 'read'))
    await signedWhatsappWebhookPost(statusEvent(phoneC, first, 'delivered')) // late — must not undo READ
    const stats = await tenantC.agent.get(`/api/campaigns/${campaign.id}`)
    expect(stats.body.campaign).toMatchObject({ sent: 2, delivered: 1, read: 1, failed: 1, demoSent: 0 })
  })

  it('STOPS the campaign the moment Meta rejects the token: flags the number, notifies, leaves recipients unsent', async () => {
    const { campaign } = await seedCampaign(tenantD.tenantId, [
      { phone: '+923004444444', optIn: 'OPTED_IN' },
      { phone: '+923005555555', optIn: 'OPTED_IN' },
    ])
    stubMessages(() => ({ status: 401, body: { error: { message: 'Error validating access token: Session has expired', type: 'OAuthException', code: 190 } } }))

    await dispatchCampaign(tenantD.tenantId, campaign.id)

    expect(calls).toHaveLength(1) // did NOT keep hammering Meta for every recipient
    const recipients = await prisma.campaignRecipient.findMany({ where: { campaignId: campaign.id } })
    expect(recipients.every((r) => r.status === 'PENDING')).toBe(true) // never attempted with a working connection
    expect((await prisma.campaign.findUniqueOrThrow({ where: { id: campaign.id } })).status).toBe('FAILED')
    expect((await prisma.whatsAppPhoneNumber.findFirstOrThrow({ where: { metaPhoneNumberId: phoneD } })).status).toBe('REAUTHORIZATION_REQUIRED')
    const notes = await prisma.notification.findMany({ where: { tenantId: tenantD.tenantId } })
    expect(notes.some((n) => n.category === 'integration_error')).toBe(true)
    expect(notes.some((n) => n.category === 'campaign_failed' && /reauthorization/i.test(n.title))).toBe(true)
  })
})

describe('Meta contract — template submission and sync', () => {
  let tenantE: TestSession
  const waba = `${WABA_ID}-tpl`

  beforeAll(async () => {
    tenantE = await signupTenant('contract-e')
    await connectNumber(tenantE.tenantId, { phoneNumberId: `contract-phone-e-${uniq()}`, token: 'token-E', waba })
  })
  afterEach(() => vi.restoreAllMocks())
  afterAll(async () => {
    await cleanupTenant(tenantE)
  })

  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

  it('submits variables WITH sample values (Meta rejects templates without them) and records the real submission', async () => {
    const draft = await prisma.template.create({
      data: { tenantId: tenantE.tenantId, name: `submit_${uniq()}`, category: 'marketing', language: 'en_US', body: 'Hi {{1}}, your code is {{2}}', variables: ['name', 'code'], status: 'DRAFT' },
    })
    const captured: { url: string; auth: string; body: { components: { type: string; example?: { body_text?: string[][] } }[] } }[] = []
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      captured.push({ url: String(input), auth: ((init?.headers ?? {}) as Record<string, string>).Authorization ?? '', body: JSON.parse(String(init?.body)) })
      return json({ id: '999000111', status: 'PENDING', category: 'MARKETING' })
    })

    const updated = await templatesService.submitForReview(tenantE.tenantId, draft.id)

    expect(captured).toHaveLength(1)
    expect(captured[0]!.url).toContain(`/${waba}/message_templates`)
    expect(captured[0]!.auth).toBe('Bearer token-E')
    expect(captured[0]!.body.components.find((c) => c.type === 'BODY')?.example?.body_text).toEqual([['Sample 1', 'Sample 2']])
    expect(updated).toMatchObject({ status: 'PENDING', metaTemplateId: '999000111' })
    expect(updated.submittedAt).not.toBeNull()
  })

  it('sync follows pagination, matches by name AND language, maps Meta\'s wider status vocabulary, and survives unknown statuses', async () => {
    const t = uniq()
    const mk = (name: string, language: string, metaTemplateId: string | null = null) =>
      prisma.template.create({ data: { tenantId: tenantE.tenantId, name, category: 'marketing', language, body: 'x', status: 'PENDING', metaTemplateId } })
    const promoEn = await mk(`promo_${t}`, 'en_US', '101')
    const promoHi = await mk(`promo_${t}`, 'hi')
    const other = await mk(`other_${t}`, 'en_US')
    const third = await mk(`third_${t}`, 'en_US')
    const mystery = await mk(`mystery_${t}`, 'en_US')

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input)
      if (url.includes('after=CUR1')) {
        return json({
          data: [
            { id: '303', name: `third_${t}`, status: 'IN_APPEAL', language: 'en_US' },
            { id: '202', name: `promo_${t}`, status: 'REJECTED', language: 'hi', rejected_reason: 'INVALID_FORMAT' },
            { id: '404', name: `mystery_${t}`, status: 'SOMETHING_META_ADDS_LATER', language: 'en_US' },
          ],
          paging: { cursors: { after: 'CUR2' } },
        })
      }
      return json({
        data: [
          { id: '101', name: `promo_${t}`, status: 'APPROVED', language: 'en_US' },
          { id: '505', name: `other_${t}`, status: 'DISABLED', language: 'en_US' },
        ],
        paging: { cursors: { after: 'CUR1' }, next: 'https://graph.facebook.com/next-page' },
      })
    })

    const result = await templatesService.syncFromMeta(tenantE.tenantId)
    expect(result.total).toBe(5)

    const row = (id: string) => prisma.template.findUniqueOrThrow({ where: { id } })
    expect(await row(promoEn.id)).toMatchObject({ status: 'APPROVED', metaTemplateId: '101' })
    expect(await row(promoHi.id)).toMatchObject({ status: 'REJECTED', metaTemplateId: '202', rejectedReason: 'INVALID_FORMAT' }) // NOT applied to the en_US row
    expect(await row(other.id)).toMatchObject({ status: 'PAUSED', metaTemplateId: '505' })
    expect(await row(third.id)).toMatchObject({ status: 'PENDING', metaTemplateId: '303' })
    expect(await row(mystery.id)).toMatchObject({ status: 'PENDING', metaTemplateId: '404' }) // an unknown Meta status must not throw or clobber the local state
    expect((await row(promoEn.id)).metaSyncedAt).not.toBeNull()
  })

  it("sync imports the approved templates that already exist on the WABA (Meta's real component shapes), skips the ones it can't send faithfully, and never duplicates on a re-sync", async () => {
    const t = uniq()
    // Shapes copied from what Meta's Graph API really returned for a test WABA's templates.
    const remote = [
      {
        id: '7001', name: `hello_${t}`, status: 'APPROVED', language: 'en_US', category: 'UTILITY', parameter_format: 'POSITIONAL',
        components: [
          { type: 'HEADER', format: 'TEXT', text: 'Hello World' },
          { type: 'BODY', text: 'Welcome and congratulations!! This message demonstrates your ability to send a WhatsApp message notification.' },
          { type: 'FOOTER', text: 'WhatsApp Business Platform sample message' },
        ],
      },
      {
        id: '7002', name: `order_${t}`, status: 'APPROVED', language: 'en_US', category: 'UTILITY', parameter_format: 'POSITIONAL',
        components: [{ type: 'HEADER', format: 'TEXT', text: 'Order confirmed' }, { type: 'BODY', text: 'Hi {{1}}, your order number is {{2}}.' }],
      },
      {
        id: '7003', name: `carousel_${t}`, status: 'APPROVED', language: 'en_US', category: 'MARKETING', parameter_format: 'POSITIONAL',
        components: [
          { type: 'BODY', text: 'Fresh summer recipes.' },
          { type: 'BUTTONS', buttons: [{ type: 'URL', text: 'Get free delivery', url: 'https://example.com/x' }] },
          { type: 'CAROUSEL', cards: [{ components: [{ type: 'HEADER', format: 'IMAGE' }] }, { components: [{ type: 'HEADER', format: 'IMAGE' }] }] },
        ],
      },
      {
        id: '7004', name: `image_${t}`, status: 'APPROVED', language: 'en_US', category: 'MARKETING', parameter_format: 'POSITIONAL',
        components: [
          { type: 'HEADER', format: 'IMAGE' },
          { type: 'BODY', text: 'Free delivery for all online orders' },
          { type: 'BUTTONS', buttons: [{ type: 'URL', text: 'Get free delivery', url: 'https://developers.facebook.com/' }] },
        ],
      },
      { id: '7005', name: `named_${t}`, status: 'APPROVED', language: 'en_US', category: 'UTILITY', parameter_format: 'NAMED', components: [{ type: 'BODY', text: 'Hi.' }] },
      { id: '7006', name: `flagged_${t}`, status: 'FLAGGED', language: 'en_US', category: 'UTILITY', parameter_format: 'POSITIONAL', components: [{ type: 'BODY', text: 'Hi.' }] },
    ]
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => json({ data: remote }))

    const first = await templatesService.syncFromMeta(tenantE.tenantId)
    expect(first).toMatchObject({ synced: 0, imported: 2, skipped: 4, total: 6 })
    // The counts are derived from the lists, so what is reported as imported/skipped is exactly what happened.
    expect(first.importedTemplates.map((x) => x.name).sort()).toEqual([`hello_${t}`, `image_${t}`].sort())
    const skippedBy = Object.fromEntries(first.skippedTemplates.map((s) => [s.name, s]))
    expect(Object.keys(skippedBy).sort()).toEqual([`carousel_${t}`, `flagged_${t}`, `named_${t}`, `order_${t}`].sort())
    expect(skippedBy[`order_${t}`]).toMatchObject({ code: 'BODY_HAS_VARIABLES', language: 'en_US', metaStatus: 'APPROVED', requiresVariables: true, isCarousel: false, hasMediaHeader: false, unsupported: false, planLimit: false })
    expect(skippedBy[`carousel_${t}`]).toMatchObject({ code: 'CAROUSEL', isCarousel: true, hasMediaHeader: true, requiresVariables: false, planLimit: false })
    expect(skippedBy[`named_${t}`]).toMatchObject({ code: 'NAMED_PARAMETERS', unsupported: true, requiresVariables: false, planLimit: false })
    expect(skippedBy[`flagged_${t}`]).toMatchObject({ code: 'STATUS_UNMAPPED', unsupported: true, metaStatus: 'FLAGGED', planLimit: false })
    expect(first.skippedTemplates.every((s) => s.reason.length > 0)).toBe(true)

    const byName = async (name: string) => prisma.template.findMany({ where: { tenantId: tenantE.tenantId, name } })
    const [hello] = await byName(`hello_${t}`)
    expect(hello).toMatchObject({ status: 'APPROVED', category: 'utility', language: 'en_US', headerType: 'TEXT', header: 'Hello World', footer: 'WhatsApp Business Platform sample message', metaTemplateId: '7001', variables: [] })
    expect(hello!.metaSyncedAt).not.toBeNull()
    const [image] = await byName(`image_${t}`)
    expect(image).toMatchObject({ status: 'APPROVED', headerType: 'IMAGE', header: null, metaTemplateId: '7004' })
    expect(image!.buttons).toEqual([{ type: 'URL', text: 'Get free delivery', url: 'https://developers.facebook.com/' }])
    for (const skipped of ['order', 'carousel', 'named', 'flagged']) expect(await byName(`${skipped}_${t}`)).toHaveLength(0)

    // Re-sync: the imported rows now match by Meta id — reconciled, not duplicated.
    const second = await templatesService.syncFromMeta(tenantE.tenantId)
    expect(second).toMatchObject({ synced: 2, imported: 0, skipped: 4, total: 6 })
    expect(second.importedTemplates).toEqual([])
    expect(await byName(`hello_${t}`)).toHaveLength(1)
    expect(await byName(`image_${t}`)).toHaveLength(1)
  })

  it('reports a template skipped ONLY because of the plan limit as such, and imports nothing past the limit', async () => {
    const t = uniq()
    const planId = `qa-limit-${t}`
    const current = await prisma.template.count({ where: { tenantId: tenantE.tenantId } })
    const subscription = await prisma.subscription.findUniqueOrThrow({ where: { tenantId: tenantE.tenantId } })
    await prisma.plan.create({ data: { id: planId, name: 'QA template limit', limits: { templates: current + 1 } } })
    await prisma.subscription.update({ where: { tenantId: tenantE.tenantId }, data: { planId } })
    const simple = (id: string, name: string) => ({
      id, name, status: 'APPROVED', language: 'en_US', category: 'UTILITY', parameter_format: 'POSITIONAL',
      components: [{ type: 'BODY', text: 'Plain text, no variables.' }],
    })
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => json({ data: [simple('8001', `limit_a_${t}`), simple('8002', `limit_b_${t}`)] }))

    try {
      const result = await templatesService.syncFromMeta(tenantE.tenantId)
      expect(result).toMatchObject({ synced: 0, imported: 1, skipped: 1, total: 2 })
      expect(result.importedTemplates).toEqual([{ name: `limit_a_${t}`, language: 'en_US' }])
      expect(result.skippedTemplates).toHaveLength(1)
      expect(result.skippedTemplates[0]).toMatchObject({ name: `limit_b_${t}`, code: 'PLAN_LIMIT', planLimit: true, requiresVariables: false, isCarousel: false, hasMediaHeader: false, unsupported: false })
      expect(await prisma.template.count({ where: { tenantId: tenantE.tenantId, name: `limit_b_${t}` } })).toBe(0)
    } finally {
      await prisma.subscription.update({ where: { tenantId: tenantE.tenantId }, data: { planId: subscription.planId } })
      await prisma.plan.delete({ where: { id: planId } })
    }
  })
})
