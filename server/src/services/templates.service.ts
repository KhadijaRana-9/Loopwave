import { templatesRepository } from '@/repositories/templates.repository.js'
import { whatsappRepository } from '@/repositories/whatsapp.repository.js'
import { assertUnderLimit } from '@/services/planLimits.service.js'
import { ApiError } from '@/utils/apiError.js'
import { decryptSecret } from '@/utils/crypto.js'
import * as metaGraph from '@/integrations/metaGraph.js'
import { MetaGraphError, type MetaTemplateComponent } from '@/integrations/metaGraph.js'
import type { z } from 'zod'
import type { createTemplateSchema, updateTemplateSchema } from '@/validators/templates.validators.js'
import type { Template } from '@prisma/client'

function buildComponents(template: Pick<Template, 'headerType' | 'header' | 'body' | 'footer' | 'buttons'>): MetaTemplateComponent[] {
  const components: MetaTemplateComponent[] = []
  if (template.headerType !== 'NONE') {
    components.push(
      template.headerType === 'TEXT'
        ? { type: 'HEADER', format: 'TEXT', text: template.header ?? '' }
        : { type: 'HEADER', format: template.headerType as 'IMAGE' | 'VIDEO' | 'DOCUMENT' },
    )
  }
  components.push({ type: 'BODY', text: template.body })
  if (template.footer) components.push({ type: 'FOOTER', text: template.footer })
  const buttons = Array.isArray(template.buttons) ? (template.buttons as MetaTemplateComponent['buttons']) : []
  if (buttons?.length) components.push({ type: 'BUTTONS', buttons })
  return components
}

export const templatesService = {
  list(tenantId: string) {
    return templatesRepository.list(tenantId)
  },

  async create(tenantId: string, input: z.infer<typeof createTemplateSchema>) {
    const count = await templatesRepository.count(tenantId)
    await assertUnderLimit(tenantId, 'templates', count)
    const { headerType, ...rest } = input
    return templatesRepository.create(tenantId, { ...rest, headerType: headerType.toUpperCase() as Uppercase<typeof headerType>, status: 'DRAFT' })
  },

  async update(tenantId: string, id: string, input: z.infer<typeof updateTemplateSchema>) {
    const { headerType, ...rest } = input
    const updated = await templatesRepository.update(tenantId, id, { ...rest, ...(headerType ? { headerType: headerType.toUpperCase() as Uppercase<typeof headerType> } : {}) })
    if (!updated) throw ApiError.notFound('Template not found')
    return updated
  },

  // Without a connected Meta account this stays a local-only PENDING flip —
  // honest (never silently becomes APPROVED, nothing here claims Meta
  // reviewed it). With one connected, this is a REAL submission to Meta's
  // template review; the actual APPROVED/REJECTED/PAUSED outcome arrives
  // later via the message_template_status_update webhook (whatsappWebhook.service.ts),
  // not decided here.
  async submitForReview(tenantId: string, id: string) {
    const template = await templatesRepository.findById(tenantId, id)
    if (!template) throw ApiError.notFound('Template not found')

    const connected = await whatsappRepository.getConnectedCredentials(tenantId)
    if (!connected?.account.wabaId || !connected.account.accessTokenCipher) {
      const updated = await templatesRepository.update(tenantId, id, { status: 'PENDING' })
      return updated!
    }

    try {
      const accessToken = decryptSecret(connected.account.accessTokenCipher)
      const result = await metaGraph.createMetaTemplate(connected.account.wabaId, accessToken, {
        name: template.name,
        category: template.category.toUpperCase(),
        language: template.language,
        components: buildComponents(template),
      })
      const now = new Date()
      const updated = await templatesRepository.update(tenantId, id, { status: 'PENDING', metaTemplateId: result.id, submittedAt: now, metaSyncedAt: now })
      return updated!
    } catch (err) {
      if (err instanceof MetaGraphError) throw ApiError.badRequest(`Meta rejected this template: ${err.message}`)
      throw err
    }
  },

  // Pulls the real, current status of every submitted template straight
  // from Meta and reconciles it locally — closes the gap where a template
  // could drift (e.g. someone edits/removes it directly in Meta Business
  // Manager) without this app ever finding out until the next unrelated
  // webhook event, if ever.
  async syncFromMeta(tenantId: string): Promise<{ synced: number; total: number }> {
    const connected = await whatsappRepository.getConnectedCredentials(tenantId)
    if (!connected?.account.wabaId || !connected.account.accessTokenCipher) {
      throw ApiError.badRequest('Connect a real WhatsApp number before syncing templates with Meta.')
    }

    const accessToken = decryptSecret(connected.account.accessTokenCipher)
    let remote: Awaited<ReturnType<typeof metaGraph.listMetaTemplates>>
    try {
      remote = await metaGraph.listMetaTemplates(connected.account.wabaId, accessToken)
    } catch (err) {
      if (err instanceof MetaGraphError) throw ApiError.badRequest(`Could not reach Meta: ${err.message}`)
      throw err
    }

    const local = await templatesRepository.list(tenantId)
    const now = new Date()
    let synced = 0
    for (const remoteTemplate of remote.data) {
      const match = local.find((t) => t.metaTemplateId === remoteTemplate.id || (t.name === remoteTemplate.name && !t.metaTemplateId))
      if (!match) continue
      const status = remoteTemplate.status.toUpperCase() as Template['status']
      await templatesRepository.update(tenantId, match.id, { status, metaTemplateId: remoteTemplate.id, metaSyncedAt: now })
      synced += 1
    }

    return { synced, total: remote.data.length }
  },

  async remove(tenantId: string, id: string) {
    const template = await templatesRepository.findById(tenantId, id)
    if (!template) throw ApiError.notFound('Template not found')

    // Best-effort: if this template was ever really submitted to Meta, try
    // to remove it there too so local and Meta state don't silently
    // diverge. A tenant with no live connection (or Meta already having it
    // gone) shouldn't be blocked from deleting their own local copy, so a
    // failure here doesn't stop the local delete below.
    if (template.metaTemplateId) {
      const connected = await whatsappRepository.getConnectedCredentials(tenantId)
      if (connected?.account.wabaId && connected.account.accessTokenCipher) {
        const accessToken = decryptSecret(connected.account.accessTokenCipher)
        await metaGraph.deleteMetaTemplate(connected.account.wabaId, accessToken, template.name).catch(() => {})
      }
    }

    const ok = await templatesRepository.delete(tenantId, id)
    if (!ok) throw ApiError.notFound('Template not found')
  },
}
