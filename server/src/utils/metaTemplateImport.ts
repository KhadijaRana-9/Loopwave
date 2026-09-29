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
// skipped, and every skip is reported with a machine-readable code, a
// human-readable reason and the traits below, so nothing is silently dropped.
const HAS_VARIABLE = /\{\{[^}]*\}\}/
const HAS_MEDIA_FORMAT = /"format":"(?:IMAGE|VIDEO|DOCUMENT)"/
const STATIC_BUTTON_TYPES = new Set(['QUICK_REPLY', 'URL', 'PHONE_NUMBER'])
const HEADER_TYPES: Record<string, TemplateHeaderType> = { TEXT: 'TEXT', IMAGE: 'IMAGE', VIDEO: 'VIDEO', DOCUMENT: 'DOCUMENT' }

export type SkipCode =
  | 'STATUS_UNMAPPED'
  | 'NO_LANGUAGE'
  | 'UNSUPPORTED_CATEGORY'
  | 'NAMED_PARAMETERS'
  | 'UNSUPPORTED_HEADER'
  | 'HEADER_HAS_VARIABLES'
  | 'UNSUPPORTED_BUTTON'
  | 'BUTTON_URL_HAS_VARIABLE'
  | 'CAROUSEL'
  | 'UNSUPPORTED_COMPONENT'
  | 'NO_BODY'
  | 'BODY_HAS_VARIABLES'
  | 'PLAN_LIMIT'
  | 'NAME_CONFLICT'

// Skips that mean "Loopwave has no way to represent or send this template".
const UNSUPPORTED_CODES = new Set<SkipCode>([
  'STATUS_UNMAPPED',
  'UNSUPPORTED_CATEGORY',
  'NAMED_PARAMETERS',
  'UNSUPPORTED_HEADER',
  'UNSUPPORTED_BUTTON',
  'UNSUPPORTED_COMPONENT',
  'NO_LANGUAGE',
  'NO_BODY',
])

export interface SkippedTemplate {
  name: string
  language: string | null
  /** Meta's own status for the template (APPROVED, PENDING, ...). */
  metaStatus: string
  code: SkipCode
  reason: string
  /** The template text/buttons contain {{...}} placeholders that would need mapping to contact fields. */
  requiresVariables: boolean
  isCarousel: boolean
  /** Has an image/video/document header (or media in carousel cards). */
  hasMediaHeader: boolean
  /** Loopwave cannot represent or send this kind of template. */
  unsupported: boolean
  /** Skipped only because the workspace's plan template limit was reached. */
  planLimit: boolean
}

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

// Traits that describe a Meta template regardless of why (or whether) it is skipped.
function describeTraits(remote: MetaTemplateSummary) {
  const components = remote.components ?? []
  const serialized = JSON.stringify(components)
  return {
    requiresVariables: HAS_VARIABLE.test(serialized),
    isCarousel: components.some((c) => c.type === 'CAROUSEL'),
    hasMediaHeader: HAS_MEDIA_FORMAT.test(serialized),
  }
}

export function toSkippedTemplate(remote: MetaTemplateSummary, code: SkipCode, reason: string): SkippedTemplate {
  return {
    name: remote.name,
    language: remote.language ?? null,
    metaStatus: remote.status,
    code,
    reason,
    ...describeTraits(remote),
    unsupported: UNSUPPORTED_CODES.has(code),
    planLimit: code === 'PLAN_LIMIT',
  }
}

type Rejection = { ok: false; code: SkipCode; reason: string }
const reject = (code: SkipCode, reason: string): Rejection => ({ ok: false, code, reason })

export function toImportableTemplate(remote: MetaTemplateSummary): { ok: true; data: ImportableTemplate } | Rejection {
  const status = mapMetaTemplateStatus(remote.status)
  if (!status) return reject('STATUS_UNMAPPED', `Meta status ${remote.status} has no local equivalent`)
  if (!remote.language) return reject('NO_LANGUAGE', 'Meta returned no language for this template')
  const category = remote.category?.toLowerCase()
  if (category !== 'utility' && category !== 'marketing' && category !== 'authentication') return reject('UNSUPPORTED_CATEGORY', `Category ${remote.category} isn't supported`)
  if (remote.parameter_format && remote.parameter_format !== 'POSITIONAL') return reject('NAMED_PARAMETERS', 'Uses named parameters; only positional {{1}} parameters are supported')

  let headerType: TemplateHeaderType = 'NONE'
  let header: string | null = null
  let body: string | null = null
  let footer: string | null = null
  const buttons: ImportableTemplate['buttons'] = []

  for (const component of remote.components ?? []) {
    if (component.type === 'HEADER') {
      const mapped = component.format ? HEADER_TYPES[component.format] : undefined
      if (!mapped) return reject('UNSUPPORTED_HEADER', `Header format ${component.format} isn't supported`)
      headerType = mapped
      if (mapped === 'TEXT') {
        if (HAS_VARIABLE.test(component.text ?? '')) return reject('HEADER_HAS_VARIABLES', 'The header uses {{n}} variables that would need mapping to contact fields')
        header = component.text ?? null
      }
    } else if (component.type === 'BODY') {
      body = component.text ?? null
    } else if (component.type === 'FOOTER') {
      footer = component.text ?? null
    } else if (component.type === 'BUTTONS') {
      for (const button of component.buttons ?? []) {
        if (!STATIC_BUTTON_TYPES.has(button.type)) return reject('UNSUPPORTED_BUTTON', `Button type ${button.type} isn't supported`)
        if (HAS_VARIABLE.test(button.url ?? '')) return reject('BUTTON_URL_HAS_VARIABLE', 'A button URL contains a variable, which needs a send payload Loopwave does not build')
        buttons.push({ type: button.type, text: button.text, ...(button.url ? { url: button.url } : {}), ...(button.phone_number ? { phone_number: button.phone_number } : {}) })
      }
    } else if (component.type === 'CAROUSEL') {
      return reject('CAROUSEL', "Carousel templates can't be sent from Loopwave yet")
    } else {
      return reject('UNSUPPORTED_COMPONENT', `Component ${component.type} isn't supported`)
    }
  }

  if (!body) return reject('NO_BODY', 'The template has no body text')
  if (HAS_VARIABLE.test(body)) return reject('BODY_HAS_VARIABLES', 'The body uses {{n}} variables that would need mapping to contact fields')

  return { ok: true, data: { name: remote.name, language: remote.language, category, status, headerType, header, body, footer, buttons, variables: [], metaTemplateId: remote.id } }
}
