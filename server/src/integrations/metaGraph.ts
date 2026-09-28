import crypto from 'node:crypto'
import { env } from '@/config/env.js'

// Thin client over the pieces of the Meta Graph API this integration needs:
// Embedded Signup code exchange, WABA/phone number lookups, template
// management, and media upload/download. Every function here makes a real
// HTTP call — nothing in this file simulates a response. Callers decide what
// to do when Meta isn't configured (see integrationReadiness.whatsappSignup);
// this module assumes it's being called with real values.

const GRAPH_BASE = `https://graph.facebook.com/${env.WHATSAPP_API_VERSION}`

export class MetaGraphError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: number,
  ) {
    super(message)
    this.name = 'MetaGraphError'
  }
}

interface MetaErrorBody {
  error?: { message?: string; code?: number; error_subcode?: number }
}

async function graphFetch<T>(path: string, init: RequestInit & { accessToken?: string } = {}): Promise<T> {
  const { accessToken, headers, ...rest } = init
  const res = await fetch(`${GRAPH_BASE}${path}`, {
    ...rest,
    headers: {
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...headers,
    },
  })
  const body = (await res.json().catch(() => null)) as (T & MetaErrorBody) | null
  if (!res.ok) {
    throw new MetaGraphError(body?.error?.message ?? `Meta Graph API error (${res.status})`, res.status, body?.error?.code)
  }
  return body as T
}

// Step 1 of Embedded Signup: the frontend's FB.login() returns a short-lived
// authorization `code`, exchanged here for a token scoped to whatever the
// tenant granted access to during the popup (their own WABA, never ours).
export async function exchangeCodeForToken(code: string): Promise<{ accessToken: string; expiresInSeconds: number | null }> {
  const params = new URLSearchParams({ client_id: env.META_APP_ID, client_secret: env.WHATSAPP_APP_SECRET, code })
  const data = await graphFetch<{ access_token: string; token_type: string; expires_in?: number }>(`/oauth/access_token?${params}`)
  return { accessToken: data.access_token, expiresInSeconds: data.expires_in ?? null }
}

// Short-lived tokens from the code exchange are ~1-2h; exchange once more
// for a long-lived (~60 day) token, which is what actually gets encrypted
// and stored per tenant.
export async function exchangeForLongLivedToken(shortLivedToken: string): Promise<{ accessToken: string; expiresInSeconds: number | null }> {
  const params = new URLSearchParams({
    grant_type: 'fb_exchange_token',
    client_id: env.META_APP_ID,
    client_secret: env.WHATSAPP_APP_SECRET,
    fb_exchange_token: shortLivedToken,
  })
  const data = await graphFetch<{ access_token: string; expires_in?: number }>(`/oauth/access_token?${params}`)
  return { accessToken: data.access_token, expiresInSeconds: data.expires_in ?? null }
}

// Re-verifies the WABA the frontend claims to have connected — never trust
// the postMessage payload alone, since it's client-controlled.
export async function getWabaDetails(wabaId: string, accessToken: string): Promise<{ id: string; name: string; businessId: string | null }> {
  const data = await graphFetch<{ id: string; name: string; owner_business_info?: { id: string } }>(
    `/${wabaId}?fields=id,name,owner_business_info`,
    { accessToken },
  )
  return { id: data.id, name: data.name, businessId: data.owner_business_info?.id ?? null }
}

export async function getPhoneNumberDetails(
  phoneNumberId: string,
  accessToken: string,
): Promise<{ id: string; displayNumber: string; verifiedName: string; qualityRating: string | null }> {
  const data = await graphFetch<{ id: string; display_phone_number: string; verified_name: string; quality_rating?: string }>(
    `/${phoneNumberId}?fields=id,display_phone_number,verified_name,quality_rating`,
    { accessToken },
  )
  return { id: data.id, displayNumber: data.display_phone_number, verifiedName: data.verified_name, qualityRating: data.quality_rating ?? null }
}

// Tells Meta to deliver this WABA's webhook events to our app (the single
// app-level webhook URL/verify token already configured — see
// whatsapp.controller.ts). Required once per WABA after signup.
export async function subscribeAppToWaba(wabaId: string, accessToken: string): Promise<void> {
  await graphFetch(`/${wabaId}/subscribed_apps`, { method: 'POST', accessToken })
}

// Enables Cloud API sending for a newly-connected number. The PIN is only
// used for Meta's internal two-step verification on this number and is
// never shown to or needed by the tenant for an API-only integration, so a
// fresh random one is fine.
export async function registerPhoneNumber(phoneNumberId: string, accessToken: string): Promise<void> {
  const pin = crypto.randomInt(100000, 999999).toString()
  await graphFetch(`/${phoneNumberId}/register`, {
    method: 'POST',
    accessToken,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', pin }),
  })
}

export interface MetaTemplateComponent {
  type: 'HEADER' | 'BODY' | 'FOOTER' | 'BUTTONS'
  format?: 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT'
  text?: string
  // Meta rejects a template whose body/header uses {{n}} variables without
  // sample values (`body_text` is a list of parameter rows, one sample per {{n}}).
  example?: { body_text?: string[][]; header_text?: string[] }
  buttons?: { type: string; text: string; url?: string; phone_number?: string }[]
}

// A component as Meta RETURNS it — wider than what we submit (MetaTemplateComponent):
// existing templates can carry carousels, offers, etc. that this app doesn't build.
export interface MetaRemoteComponent {
  type: string
  format?: string
  text?: string
  buttons?: { type: string; text: string; url?: string; phone_number?: string }[]
}

export interface MetaTemplateSummary {
  id: string
  name: string
  status: string
  language?: string
  rejected_reason?: string
  category?: string
  parameter_format?: string
  components?: MetaRemoteComponent[]
}

export async function createMetaTemplate(
  wabaId: string,
  accessToken: string,
  payload: { name: string; category: string; language: string; components: MetaTemplateComponent[] },
): Promise<{ id: string; status: string }> {
  return graphFetch(`/${wabaId}/message_templates`, {
    method: 'POST',
    accessToken,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

// Follows Graph pagination — a single call returns only the first page
// (25 by default), so a WABA with more templates than that would otherwise
// never be fully reconciled by a sync.
export async function listMetaTemplates(wabaId: string, accessToken: string): Promise<{ data: MetaTemplateSummary[] }> {
  const all: MetaTemplateSummary[] = []
  let after: string | undefined
  for (let page = 0; page < 20; page++) {
    // Components make each row much larger than the id/status summary, so pages are smaller than before.
    const query = new URLSearchParams({ fields: 'id,name,status,language,rejected_reason,category,parameter_format,components', limit: '50' })
    if (after) query.set('after', after)
    const res = await graphFetch<{ data: MetaTemplateSummary[]; paging?: { cursors?: { after?: string }; next?: string } }>(
      `/${wabaId}/message_templates?${query}`,
      { accessToken },
    )
    all.push(...res.data)
    if (!res.paging?.next || !res.paging.cursors?.after) break
    after = res.paging.cursors.after
  }
  return { data: all }
}

// Meta deletes by template name (removing every language variant of it at
// once) rather than by our local id — there is no per-language delete on
// this endpoint. Callers pass the template's name.
export async function deleteMetaTemplate(wabaId: string, accessToken: string, name: string): Promise<void> {
  await graphFetch(`/${wabaId}/message_templates?name=${encodeURIComponent(name)}`, { method: 'DELETE', accessToken })
}

// Uploads a file to Meta's per-message media store and returns the handle
// (`id`) used to reference it when sending. Required before sending any
// image/video/document — Meta doesn't accept raw bytes inline in a message.
export async function uploadMedia(phoneNumberId: string, accessToken: string, buffer: Buffer, mimeType: string, filename: string): Promise<{ id: string }> {
  const form = new FormData()
  form.append('messaging_product', 'whatsapp')
  form.append('file', new Blob([buffer], { type: mimeType }), filename)
  const res = await fetch(`${GRAPH_BASE}/${phoneNumberId}/media`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    body: form,
  })
  const body = (await res.json().catch(() => null)) as ({ id: string } & MetaErrorBody) | null
  if (!res.ok) throw new MetaGraphError(body?.error?.message ?? `Meta media upload failed (${res.status})`, res.status, body?.error?.code)
  return { id: body!.id }
}

// Inbound media arrives in a webhook as just a media `id` — this resolves it
// to a short-lived, authenticated download URL (must be fetched with the
// same access token, and promptly — Meta expires these quickly).
export async function getMediaUrl(mediaId: string, accessToken: string): Promise<{ url: string; mimeType: string; sha256: string; fileSizeBytes: number }> {
  const data = await graphFetch<{ url: string; mime_type: string; sha256: string; file_size: number }>(`/${mediaId}`, { accessToken })
  return { url: data.url, mimeType: data.mime_type, sha256: data.sha256, fileSizeBytes: data.file_size }
}

export async function downloadMediaBytes(url: string, accessToken: string): Promise<Buffer> {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } })
  if (!res.ok) throw new MetaGraphError(`Failed to download media from Meta (${res.status})`, res.status)
  return Buffer.from(await res.arrayBuffer())
}
