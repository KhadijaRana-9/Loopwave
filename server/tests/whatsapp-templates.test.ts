import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { cleanupTenant, hasLiveWhatsappCredentials, signupTenant, type TestSession } from './helpers.js'

// No real Meta App is configured in this environment (same as every
// environment right now — see the WhatsApp integration audit), so what's
// provable here is: honest not-configured refusal for template submission
// and sync. The real-Graph-API half (createMetaTemplate/listMetaTemplates/
// deleteMetaTemplate actually round-tripping to Meta) is gated below and
// currently skips — it is NOT claimed as tested here, and starts running
// automatically once real credentials are configured.
describe('WhatsApp templates — submit-for-review, sync-from-Meta, delete', () => {
  let tenant: TestSession

  beforeAll(async () => {
    tenant = await signupTenant('whatsapp-templates')
  })

  afterAll(async () => {
    await cleanupTenant(tenant)
  })

  async function createDraftTemplate() {
    const res = await tenant.agent.post('/api/templates').send({
      name: `qa_template_${Date.now()}`,
      category: 'marketing',
      language: 'en_US',
      body: 'Hello {{1}}, this is a test template.',
      variables: ['name'],
    })
    if (res.status !== 201) throw new Error(`Template create failed: ${res.status} ${JSON.stringify(res.body)}`)
    return res.body.template
  }

  it('refuses to submit without a connected WhatsApp account — the template stays a draft, never a fake "pending Meta review"', async () => {
    const template = await createDraftTemplate()
    const res = await tenant.agent.post(`/api/templates/${template.id}/submit`)
    expect(res.status).toBe(400)
    expect(res.body.error.message).toMatch(/connect a whatsapp business account/i)

    const list = await tenant.agent.get('/api/templates')
    const after = list.body.templates.find((t: { id: string }) => t.id === template.id)
    expect(after.status).toBe('draft')
    expect(after.metaTemplateId).toBeNull()
    expect(after.submittedAt).toBeNull()
  })

  it('refuses to sync from Meta — honestly, not silently — when no WhatsApp number is connected', async () => {
    const res = await tenant.agent.post('/api/templates/sync')
    expect(res.status).toBe(400)
    expect(res.body.error.message).toMatch(/connect a real whatsapp number/i)
  })

  it('deleting a draft template that was never submitted to Meta just removes it locally', async () => {
    const template = await createDraftTemplate()
    const res = await tenant.agent.delete(`/api/templates/${template.id}`)
    expect(res.status).toBe(204)
    const list = await tenant.agent.get('/api/templates')
    expect(list.body.templates.some((t: { id: string }) => t.id === template.id)).toBe(false)
  })

  // --- Real Meta Graph API round-trip (unverified in this environment) ---
  describe.skipIf(!hasLiveWhatsappCredentials())('real Meta submission/sync/delete (requires META_APP_ID/META_CONFIG_ID/WHATSAPP_APP_SECRET + a connected WABA)', () => {
    it.todo('submitForReview with a connected account creates a real Meta template and stores metaTemplateId + submittedAt')
    it.todo('syncFromMeta reconciles local status/metaSyncedAt against a real GET /{wabaId}/message_templates response')
    it.todo('deleting a submitted template also removes it on Meta via deleteMetaTemplate')
  })
})
