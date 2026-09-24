import type { Contact } from '@prisma/client'

// Variables resolvable from real contact/tenant data — no fabricated values.
// {{shopLink}} and {{discount}} aren't contact fields; they resolve from
// campaign-level context passed in by the caller (extra), falling back to an
// empty string rather than leaking a broken {{placeholder}} into a send.
function buildVariableValues(contact: Pick<Contact, 'name' | 'phone' | 'company'>, extra: Record<string, string>): Record<string, string> {
  return {
    firstName: contact.name?.split(' ')[0] || 'there',
    lastName: contact.name?.split(' ').slice(1).join(' ') || '',
    name: contact.name || 'there',
    companyName: contact.company || '',
    phone: contact.phone || '',
    ...extra,
  }
}

export function resolveMessageVariables(text: string, contact: Pick<Contact, 'name' | 'phone' | 'company'>, extra: Record<string, string> = {}): string {
  const values = buildVariableValues(contact, extra)
  return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key: string) => (key in values ? values[key] ?? '' : match))
}

// Same value lookup as resolveMessageVariables, but returns an ordered array
// instead of interpolating into text — what a real Meta template send needs,
// since Meta template bodies use positional {{1}}, {{2}}... parameters, not
// the named {{firstName}} placeholders Loopwave's editor uses. `names` is
// Template.variables, already stored in the order they appear in the body.
export function resolveVariableValues(names: string[], contact: Pick<Contact, 'name' | 'phone' | 'company'>, extra: Record<string, string> = {}): string[] {
  const values = buildVariableValues(contact, extra)
  return names.map((name) => values[name] ?? '')
}

export function extractVariables(text: string): string[] {
  const found = new Set<string>()
  for (const m of text.matchAll(/\{\{\s*(\w+)\s*\}\}/g)) found.add(m[1] as string)
  return [...found]
}

const KNOWN_VARIABLES = new Set(['firstName', 'lastName', 'name', 'companyName', 'phone', 'discount', 'shopLink'])

// Flags variables the campaign is using that resolveMessageVariables has no
// source for and that aren't provided as campaign-level extras — so the
// composer can warn before send instead of mailing out a literal "{{foo}}".
export function unresolvableVariables(text: string, providedExtraKeys: string[]): string[] {
  const known = new Set([...KNOWN_VARIABLES, ...providedExtraKeys])
  return extractVariables(text).filter((v) => !known.has(v))
}
