import type { TemplateHeaderType, TemplateStatus } from '@prisma/client'
import type { MetaTemplateSummary } from '@/integrations/metaGraph.js'
import { mapMetaTemplateStatus } from '@/utils/metaTemplateStatus.js'

// Turns a template that already exists (and was approved) on the tenant's
// WABA into a local row, so a customer who connects an existing WhatsApp
// Business account sees — and can send — the templates they already have.
//
// Only templates Loopwave can send FAITHFULLY as they are get imported. A
// template with {{n}} variables would need a mapping from each placeholder to
// a contact field that Meta's record doesn't carry, and a carousel / named-
// parameter / dynamic-URL template needs send payloads this app doesn't build
// — importing those would produce rows that fail at send time. They are
// skipped, with a reason, and counted in the sync result instead.
const HAS_VARIABLE = /\{\{[^}]*\}\}/
const STATIC_BUTTON_TYPES = new Set(['QUICK_REPLY', 'URL', 'PHONE_NUMBER'])
const HEADER_TYPES: Record<string, TemplateHeaderType> = { TEXT: 'TEXT', IMAGE: 'IMAGE', VIDEO: 'VIDEO', DOCUMENT: 'DOCUMENT' }

export interface ImportableTemplate {
  name: string
  language: string
  category: string
  status: TemplateStatus
  headerType: TemplateHeaderType
  header: string | null
  body: string
  footer: string | null
  buttons: { type: string; text: string; url?: string; phone_number?: string }[]
  variables: string[]
  metaTemplateId: string
}

export function toImportableTemplate(remote: MetaTemplateSummary): { ok: true; data: ImportableTemplate } | { ok: false; reason: string } {
  const status = mapMetaTemplateStatus(remote.status)
  if (!status) return { ok: false, reason: `status ${remote.status} has no local equivalent` }
  if (!remote.language) return { ok: false, reason: 'no language' }
  const category = remote.category?.toLowerCase()
  if (category !== 'utility' && category !== 'marketing' && category !== 'authentication') return { ok: false, reason: `unsupported category ${remote.category}` }
  if (remote.parameter_format && remote.parameter_format !== 'POSITIONAL') return { ok: false, reason: 'uses named parameters' }

  let headerType: TemplateHeaderType = 'NONE'
  let header: string | null = null
  let body: string | null = null
  let footer: string | null = null
  let buttons: ImportableTemplate['buttons'] = []

  for (const component of remote.components ?? []) {
    if (component.type === 'HEADER') {
      const mapped = component.format ? HEADER_TYPES[component.format] : undefined
      if (!mapped) return { ok: false, reason: `unsupported header format ${component.format}` }
      headerType = mapped
      if (mapped === 'TEXT') {
        if (HAS_VARIABLE.test(component.text ?? '')) return { ok: false, reason: 'header has variables' }
        header = component.text ?? null
      }
    } else if (component.type === 'BODY') {
      body = component.text ?? null
    } else if (component.type === 'FOOTER') {
      footer = component.text ?? null
    } else if (component.type === 'BUTTONS') {
      for (const button of component.buttons ?? []) {
        if (!STATIC_BUTTON_TYPES.has(button.type)) return { ok: false, reason: `unsupported button type ${button.type}` }
        if (HAS_VARIABLE.test(button.url ?? '')) return { ok: false, reason: 'button URL has a variable' }
        buttons.push({ type: button.type, text: button.text, ...(button.url ? { url: button.url } : {}), ...(button.phone_number ? { phone_number: button.phone_number } : {}) })
      }
    } else {
      return { ok: false, reason: `unsupported component ${component.type}` }
    }
  }

  if (!body) return { ok: false, reason: 'no body' }
  if (HAS_VARIABLE.test(body)) return { ok: false, reason: 'body has variables' }

  return { ok: true, data: { name: remote.name, language: remote.language, category, status, headerType, header, body, footer, buttons, variables: [], metaTemplateId: remote.id } }
}
