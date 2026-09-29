import { templatesRepository } from '@/repositories/templates.repository.js'
import { whatsappRepository } from '@/repositories/whatsapp.repository.js'
import { assertUnderLimit } from '@/services/planLimits.service.js'
import { ApiError } from '@/utils/apiError.js'
import { decryptSecret } from '@/utils/crypto.js'
import * as metaGraph from '@/integrations/metaGraph.js'
import { MetaGraphError, type MetaTemplateComponent } from '@/integrations/metaGraph.js'
import { mapMetaTemplateStatus } from '@/utils/metaTemplateStatus.js'
import { toImportableTemplate, toSkippedTemplate, type SkippedTemplate } from '@/utils/metaTemplateImport.js'
import type { z } from 'zod'
import type { createTemplateSchema, updateTemplateSchema } from '@/validators/templates.validators.js'
import { Prisma, type Template } from '@prisma/client'

// How many positional {{n}} variables a piece of template text uses (the
// highest n). Meta requires a sample value for each one at submission time.
function positionalVariableCount(text: string): number {
  const indexes = [...text.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1]))
  return indexes.length ? Math.max(...indexes) : 0
}

function sampleValues(count: number): string[] {
  return Array.from({ length: count }, (_, i) => `Sample ${i + 1}`)
}

function buildComponents(template: Pick<Template, 'headerType' | 'header' | 'body' | 'footer' | 'buttons'>): MetaTemplateComponent[] {
  const components: MetaTemplateComponent[] = []
  if (template.headerType !== 'NONE') {
    if (template.headerType === 'TEXT') {
      const headerText = template.header ?? ''
      const headerVars = positionalVariableCount(headerText)
      components.push({ type: 'HEADER', format: 'TEXT', text: headerText, ...(headerVars ? { example: { header_text: sampleValues(headerVars).slice(0, 1) } } : {}) })
    } else {
      components.push({ type: 'HEADER', format: template.headerType as 'IMAGE' | 'VIDEO' | 'DOCUMENT' })
    }
  }
  const bodyVars = positionalVariableCount(template.body)
  components.push({ type: 'BODY', text: template.body, ...(bodyVars ? { example: { body_text: [sampleValues(bodyVars)] } } : {}) })
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

  // A REAL submission to Meta's template review — refused outright when no
  // WhatsApp Business account is connected (see below), never simulated. The
  // actual APPROVED/REJECTED/PAUSED outcome arrives later via the
  // message_template_status_update webhook (whatsappWebhook.service.ts) or a
  // manual sync, not decided here.
  async submitForReview(tenantId: string, id: string) {
    const template = await templatesRepository.findById(tenantId, id)
    if (!template) throw ApiError.notFound('Template not found')

    const connected = await whatsappRepository.getConnectedCredentials(tenantId)
    if (!connected?.account.wabaId || !connected.account.accessTokenCipher) {
      // Nothing can be submitted without a real WABA. Flipping to PENDING here
      // would claim "awaiting Meta review" for a template Meta has never seen
      // (and strand it there — the UI only offers Submit on drafts), so it
      // stays a DRAFT and the tenant is told exactly what's missing.
      throw ApiError.badRequest('Connect a WhatsApp Business account before submitting a template to Meta for review.')
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
  // synced = local rows reconciled with Meta; imported = templates that existed
  // only on Meta and were brought in; skipped = Meta-only templates that can't
  // be sent faithfully from here (variables, carousel, ...) or hit the plan
  // limit. importedTemplates / skippedTemplates list every one of them (with the
  // reason for each skip), so the counts can always be checked against the rows.
  async syncFromMeta(tenantId: string): Promise<{
    synced: number
    imported: number
    skipped: number
    total: number
    importedTemplates: { name: string; language: string }[]
    skippedTemplates: SkippedTemplate[]
  }> {
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
    const importedTemplates: { name: string; language: string }[] = []
    const skippedTemplates: SkippedTemplate[] = []
    for (const remoteTemplate of remote.data) {
      // Same name can exist once per language on Meta — match on both, or one
      // language's approval would be applied to another language's row.
      const sameLanguage = (t: Template) => !remoteTemplate.language || t.language.replace('-', '_') === remoteTemplate.language.replace('-', '_')
      const match = local.find((t) => t.metaTemplateId === remoteTemplate.id || (t.name === remoteTemplate.name && sameLanguage(t) && !t.metaTemplateId))
      if (!match) {
        // A template that exists on the WABA but not here (e.g. the tenant
        // connected an account that already had approved templates): bring it
        // in if it can be sent faithfully, otherwise count it as skipped.
        const importable = toImportableTemplate(remoteTemplate)
        if (!importable.ok) {
          skippedTemplates.push(toSkippedTemplate(remoteTemplate, importable.code, importable.reason))
          continue
        }
        try {
          // Imported rows count against the plan's template limit like any other.
          await assertUnderLimit(tenantId, 'templates', local.length + importedTemplates.length)
          await templatesRepository.create(tenantId, { ...importable.data, metaSyncedAt: now })
          importedTemplates.push({ name: importable.data.name, language: importable.data.language })
        } catch (err) {
          if (err instanceof ApiError && err.code === 'PLAN_LIMIT_REACHED') {
            skippedTemplates.push(toSkippedTemplate(remoteTemplate, 'PLAN_LIMIT', "Your plan's template limit has been reached. Delete a template or upgrade, then sync again"))
          } else if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
            // Same name+language already exists locally under a different Meta id — never overwrite it.
            skippedTemplates.push(toSkippedTemplate(remoteTemplate, 'NAME_CONFLICT', 'A template with this name and language already exists here and is linked to a different Meta template'))
          } else {
            throw err
          }
        }
        continue
      }
      // Through the shared mapper: Meta's vocabulary is wider than our enum
      // (DISABLED, IN_APPEAL, ...); casting it straight over throws.
      const status = mapMetaTemplateStatus(remoteTemplate.status)
      await templatesRepository.update(tenantId, match.id, {
        ...(status ? { status } : {}),
        ...(status === 'REJECTED' ? { rejectedReason: remoteTemplate.rejected_reason && remoteTemplate.rejected_reason !== 'NONE' ? remoteTemplate.rejected_reason : null } : {}),
        ...(status && status !== 'REJECTED' ? { rejectedReason: null } : {}),
        metaTemplateId: remoteTemplate.id,
        metaSyncedAt: now,
      })
      synced += 1
    }

    return {
      synced,
      imported: importedTemplates.length,
      skipped: skippedTemplates.length,
      total: remote.data.length,
      importedTemplates,
      skippedTemplates,
    }
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
