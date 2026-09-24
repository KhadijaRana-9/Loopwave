import { randomUUID } from 'node:crypto'
import { campaignsRepository } from '@/repositories/campaigns.repository.js'
import { whatsappRepository } from '@/repositories/whatsapp.repository.js'
import { sendWhatsAppMessage, scheduleDemoRecipientProgression } from '@/integrations/whatsapp.adapter.js'
import * as metaGraph from '@/integrations/metaGraph.js'
import { generateCampaignMessage } from '@/integrations/ai.adapter.js'
import { uploadObject, getSignedReadUrl, mediaObjectKey, isStorageConfigured } from '@/integrations/storage.adapter.js'
import { assertMediaAllowed } from '@/utils/mediaLimits.js'
import { assertTemplateApproved, assertContactOptedIn } from '@/services/whatsappCompliance.service.js'
import { recordUsage } from '@/services/usage.service.js'
import { assertUsageAllowance } from '@/services/planLimits.service.js'
import { notifyTenant } from '@/services/notifications.service.js'
import { enqueueCampaignSend, removeCampaignSend } from '@/jobs/campaigns.queue.js'
import { serializeTemplate } from '@/utils/serializers.js'
import { resolveVariableValues, extractVariables, unresolvableVariables } from '@/utils/messageVariables.js'
import { decryptSecret } from '@/utils/crypto.js'
import { ApiError } from '@/utils/apiError.js'
import { prisma } from '@/config/prisma.js'
import type { z } from 'zod'
import type { createCampaignSchema, campaignComposeSchema, audienceFilterSchema } from '@/validators/campaigns.validators.js'
import type { Campaign, Template } from '@prisma/client'

type CampaignWithTemplate = Campaign & { template: Template }

async function serialize(campaign: CampaignWithTemplate) {
  const stats = await campaignsRepository.stats(campaign.id)
  return {
    id: campaign.id,
    name: campaign.name,
    templateId: campaign.templateId,
    template: serializeTemplate(campaign.template),
    status: campaign.status.toLowerCase(),
    audienceFilter: campaign.audienceFilter,
    headerMediaUrl: campaign.headerMediaUrl,
    headerMediaMimeType: campaign.headerMediaMimeType,
    scheduledAt: campaign.scheduledAt,
    startedAt: campaign.startedAt,
    completedAt: campaign.completedAt,
    createdAt: campaign.createdAt,
    updatedAt: campaign.updatedAt,
    ...stats,
  }
}

function headerMediaParameter(campaign: Pick<Campaign, 'headerMediaMetaId' | 'headerMediaMimeType'>) {
  if (!campaign.headerMediaMetaId || !campaign.headerMediaMimeType) return null
  const kind = campaign.headerMediaMimeType.startsWith('image/') ? 'image' : campaign.headerMediaMimeType.startsWith('video/') ? 'video' : 'document'
  return { type: 'header' as const, parameters: [{ type: kind, [kind]: { id: campaign.headerMediaMetaId } }] }
}

// Actually delivers the campaign: fetches every still-pending recipient,
// sends through the WhatsApp adapter (real Cloud API — as an actual
// `type: template` send referencing the Meta-approved template by name and
// positional {{1}}/{{2}}... parameters, never freeform text, since that's
// what Meta requires for business-initiated messages — or an
// honestly-labeled demo simulation when the tenant has no connected number),
// and persists a real status per recipient — nothing here is a fabricated
// success count. Exported so both the in-process fallback below and the
// BullMQ worker (jobs/campaign.worker.ts) call the exact same delivery logic.
export async function dispatchCampaign(tenantId: string, campaignId: string) {
  const campaign = await campaignsRepository.findById(tenantId, campaignId)
  if (!campaign) return

  const connected = await whatsappRepository.getConnectedCredentials(tenantId)
  const metaPhoneNumberId = connected?.metaPhoneNumberId ?? null
  const accessToken = connected?.account.accessTokenCipher ? decryptSecret(connected.account.accessTokenCipher) : null

  // A number that WAS connected but Meta has since flagged it
  // (REAUTHORIZATION_REQUIRED/ERROR) must block the whole send, not
  // silently fall back to demo mode — that would hide a real connection
  // going bad behind a fake "sent" campaign.
  if (!metaPhoneNumberId || !accessToken) {
    const blocked = await whatsappRepository.findRequiringReauth(tenantId)
    if (blocked) {
      await campaignsRepository.update(tenantId, campaignId, { status: 'FAILED' })
      await notifyTenant(tenantId, {
        category: 'integration_error',
        title: `Campaign "${campaign.name}" blocked — WhatsApp needs reauthorization`,
        body: `${blocked.label ?? blocked.displayNumber} needs to be reconnected in WhatsApp settings before this campaign can send.`,
      })
      return
    }
  }

  // Meta enforces template approval server-side for any real send — this
  // just fails the whole campaign fast with a clear reason instead of
  // burning through recipients on a template Meta will reject every time.
  // Demo mode (no real connection yet) isn't gated on this: nothing it does
  // is a real Meta interaction, so there's no approval state to falsify —
  // see the WhatsApp integration audit for why this distinction matters.
  if (metaPhoneNumberId && accessToken) {
    try {
      assertTemplateApproved(campaign.template)
    } catch (err) {
      await campaignsRepository.update(tenantId, campaignId, { status: 'FAILED' })
      await notifyTenant(tenantId, {
        category: 'campaign_failed',
        title: `Campaign "${campaign.name}" failed`,
        body: err instanceof Error ? err.message : 'Template not approved',
      })
      return
    }
  }

  const pending = await campaignsRepository.pendingRecipients(campaignId)
  const contacts = await prisma.contact.findMany({
    where: { id: { in: pending.map((r) => r.contactId) } },
    select: { id: true, name: true, phone: true, company: true, whatsappOptIn: true },
  })
  const contactById = new Map(contacts.map((c) => [c.id, c]))
  const header = headerMediaParameter(campaign)

  for (const recipient of pending) {
    const contact = contactById.get(recipient.contactId)
    if (!contact?.phone) {
      await campaignsRepository.updateRecipient(recipient.id, { status: 'FAILED', errorMessage: 'Contact has no phone number on file' })
      continue
    }
    // Re-checked here, not just at campaign creation — a contact can opt out
    // in the time between creating a campaign and it actually sending
    // (immediately for "send now", up to weeks later for a scheduled one).
    try {
      assertContactOptedIn(contact.whatsappOptIn)
    } catch {
      await campaignsRepository.updateRecipient(recipient.id, { status: 'FAILED', errorMessage: 'Contact opted out before this campaign sent' })
      continue
    }

    const values = resolveVariableValues(campaign.template.variables as string[], contact)
    const components = [...(header ? [header] : []), ...(values.length ? [{ type: 'body' as const, parameters: values.map((text) => ({ type: 'text', text })) }] : [])]

    const result = await sendWhatsAppMessage({
      kind: 'template',
      to: contact.phone,
      templateName: campaign.template.name,
      language: campaign.template.language,
      components,
      metaPhoneNumberId,
      accessToken,
    })
    if (result.status === 'SENT') {
      await campaignsRepository.updateRecipient(recipient.id, { status: 'SENT', waMessageId: result.waMessageId || null, sentAt: new Date(), demo: result.demo })
      if (result.demo) scheduleDemoRecipientProgression(recipient.id)
    } else {
      await campaignsRepository.updateRecipient(recipient.id, { status: 'FAILED', errorMessage: result.errorMessage })
    }
  }

  if (pending.length) await recordUsage(tenantId, 'monthlyMarketingMessages', pending.length)
  await campaignsRepository.update(tenantId, campaignId, { status: 'COMPLETED', completedAt: new Date() })
  await notifyTenant(tenantId, {
    category: 'campaign_completed',
    title: `Campaign "${campaign.name}" completed`,
    body: `${pending.length} message${pending.length === 1 ? '' : 's'} sent.`,
  })
}

// Delayed sends fall back to an in-process timer when Redis/BullMQ isn't
// reachable — it works for the lifetime of this server process but doesn't
// survive a restart. The real production path is jobs/campaigns.queue.ts +
// the dedicated worker (npm run worker), tried first in scheduleSend below.
const scheduledTimers = new Map<string, ReturnType<typeof setTimeout>>()

function scheduleFutureSendFallback(tenantId: string, campaignId: string, atMs: number) {
  // Visible on purpose: this degraded path silently working is exactly what
  // makes a real Redis outage invisible in production — a scheduled
  // campaign quietly stops surviving restarts and stops coordinating across
  // a horizontally-scaled deployment, with no signal to anyone unless this
  // is logged.
  console.warn(`[campaigns] BullMQ/Redis unavailable — campaign ${campaignId} scheduled via in-process fallback timer (won't survive a restart)`)
  const delay = Math.max(0, atMs - Date.now())
  const timer = setTimeout(() => {
    scheduledTimers.delete(campaignId)
    campaignsRepository
      .update(tenantId, campaignId, { status: 'RUNNING', startedAt: new Date() })
      .then(() => dispatchCampaign(tenantId, campaignId))
      .catch(() => {})
  }, delay)
  scheduledTimers.set(campaignId, timer)
}

async function scheduleSend(tenantId: string, campaignId: string, sendAtMs: number) {
  const delayMs = Math.max(0, sendAtMs - Date.now())
  const queued = await enqueueCampaignSend(tenantId, campaignId, delayMs)
  if (queued) {
    // The worker flips this to RUNNING when it actually dequeues the job
    // (near-immediate for delayMs<=5000), but a job sitting delayed in Redis
    // for longer than that needs to show as SCHEDULED for the whole wait —
    // otherwise it looks like an unsent draft and "cancel scheduled
    // campaign" has no SCHEDULED campaign to find.
    if (delayMs > 5000) await campaignsRepository.update(tenantId, campaignId, { status: 'SCHEDULED' })
    return
  }

  if (delayMs <= 5000) {
    await campaignsRepository.update(tenantId, campaignId, { status: 'RUNNING', startedAt: new Date() })
    void dispatchCampaign(tenantId, campaignId)
  } else {
    await campaignsRepository.update(tenantId, campaignId, { status: 'SCHEDULED' })
    scheduleFutureSendFallback(tenantId, campaignId, sendAtMs)
  }
}

export const campaignsService = {
  async list(tenantId: string) {
    return Promise.all((await campaignsRepository.list(tenantId)).map(serialize))
  },

  // Uploads the ONE media file a campaign's template header needs (Meta
  // template headers reference a media *handle*, not a file per recipient —
  // every recipient's send reuses this same upload). Requires a real
  // connected number: there's no meaningful "demo" media upload to fake.
  async uploadHeaderMedia(tenantId: string, file: { buffer: Buffer; mimeType: string; filename: string }) {
    const { kind } = assertMediaAllowed(file.mimeType, file.buffer.length)
    if (kind === 'document') throw ApiError.badRequest('Document headers are not supported yet — use image or video')

    const connected = await whatsappRepository.getConnectedCredentials(tenantId)
    if (!connected?.metaPhoneNumberId || !connected.account.accessTokenCipher) {
      throw ApiError.badRequest('Connect a real WhatsApp number before uploading campaign header media')
    }
    if (!isStorageConfigured()) {
      throw ApiError.badRequest('Media storage is not configured yet — set STORAGE_ENDPOINT/STORAGE_BUCKET/STORAGE_ACCESS_KEY_ID/STORAGE_SECRET_ACCESS_KEY.')
    }
    const accessToken = decryptSecret(connected.account.accessTokenCipher)

    const key = mediaObjectKey(tenantId, `campaign-header-${randomUUID()}`, file.filename)
    await uploadObject(key, file.buffer, file.mimeType)
    const uploaded = await metaGraph.uploadMedia(connected.metaPhoneNumberId, accessToken, file.buffer, file.mimeType, file.filename)
    const previewUrl = await getSignedReadUrl(key)

    return { headerMediaUrl: key, headerMediaMetaId: uploaded.id, headerMediaMimeType: file.mimeType, previewUrl }
  },

  async getById(tenantId: string, id: string) {
    const campaign = await campaignsRepository.findById(tenantId, id)
    if (!campaign) throw ApiError.notFound('Campaign not found')
    return serialize(campaign)
  },

  async create(tenantId: string, input: z.infer<typeof createCampaignSchema>) {
    let existingTemplate: Template | null = null
    if (input.templateId) {
      existingTemplate = await prisma.template.findFirst({ where: { id: input.templateId, tenantId } })
      if (!existingTemplate) throw ApiError.notFound('Template not found')
    } else if (input.message) {
      // Only the AI-composed/hand-written path uses named {{variable}}
      // personalization — pre-existing templates use Meta-style positional
      // {{1}}/{{2}} placeholders filled once per campaign (see
      // CampaignWizard's Variables step), a different, untouched flow.
      const unresolvable = unresolvableVariables(input.message, ['discount', 'shopLink'])
      if (unresolvable.length) {
        throw ApiError.badRequest(`The message uses variables that can't be resolved: ${unresolvable.map((v) => `{{${v}}}`).join(', ')}`, { unresolvableVariables: unresolvable })
      }
    } else {
      throw ApiError.badRequest('Either templateId or message is required')
    }

    const audience = await campaignsRepository.resolveAudience(tenantId, input.audienceFilter)
    // Backend-authoritative, and checked before any row is written: recalculated
    // here from the real resolved audience size, never trusted from a
    // frontend-supplied count, and never leaves an orphaned template behind
    // when it blocks the send.
    await assertUsageAllowance(tenantId, 'monthlyMarketingMessages', audience.length)

    // AI-composed (or hand-written) campaign message becomes a real Template
    // row now that the send is known to be allowed — reuses the exact same
    // send/approval/audit path every other campaign already goes through,
    // instead of a parallel "ad hoc message" concept. Starts DRAFT, same as
    // any other new template — it is NOT auto-approved. A real Meta
    // connection requires actually submitting it (templates.service.ts) and
    // waiting for Meta's review; dispatchCampaign enforces APPROVED once a
    // real number is connected (see above). Templates are unique per
    // (tenantId, name, language) — a campaign name alone isn't (two "Summer
    // Sale" campaigns is normal), so this gets a disambiguating suffix.
    const template =
      existingTemplate ??
      (await prisma.template.create({
        data: {
          tenantId,
          name: `${input.name} (${randomUUID().slice(0, 8)})`,
          category: 'marketing',
          language: input.language || 'en_US',
          status: 'DRAFT',
          body: input.message!,
          variables: extractVariables(input.message!),
        },
      }))

    const campaign = await campaignsRepository.create(tenantId, {
      name: input.name,
      templateId: template.id,
      audienceFilter: input.audienceFilter,
      headerMediaUrl: input.headerMediaUrl,
      headerMediaMetaId: input.headerMediaMetaId,
      headerMediaMimeType: input.headerMediaMimeType,
      scheduledAt: input.scheduledAt,
      status: 'DRAFT',
    })
    if (audience.length) await campaignsRepository.createRecipients(campaign.id, audience.map((c) => c.id))

    const sendAtMs = input.scheduledAt ? new Date(input.scheduledAt).getTime() : Date.now()
    await scheduleSend(tenantId, campaign.id, sendAtMs)

    const final = await campaignsRepository.findById(tenantId, campaign.id)
    return serialize(final!)
  },

  async previewAudience(tenantId: string, filter: z.infer<typeof audienceFilterSchema>) {
    const count = await campaignsRepository.countAudience(tenantId, filter)
    const allowance = await assertUsageAllowance(tenantId, 'monthlyMarketingMessages', 0).catch(() => null)
    return {
      count,
      plan: allowance ? { limit: allowance.limit, used: allowance.used, remaining: allowance.remaining === Infinity ? -1 : allowance.remaining } : null,
    }
  },

  async composeMessage(tenantId: string, input: z.infer<typeof campaignComposeSchema>) {
    const result = await generateCampaignMessage(input)
    await recordUsage(tenantId, 'aiUsage', 1)
    return result
  },

  async duplicate(tenantId: string, id: string) {
    const source = await campaignsRepository.findById(tenantId, id)
    if (!source) throw ApiError.notFound('Campaign not found')
    const audience = await campaignsRepository.resolveAudience(tenantId, source.audienceFilter as object)
    const copy = await campaignsRepository.create(tenantId, {
      name: `${source.name} (copy)`,
      templateId: source.templateId,
      audienceFilter: source.audienceFilter as object,
      status: 'DRAFT',
    })
    if (audience.length) await campaignsRepository.createRecipients(copy.id, audience.map((c) => c.id))
    return serialize(copy)
  },

  async cancelScheduled(tenantId: string, id: string) {
    const existing = await campaignsRepository.findById(tenantId, id)
    if (!existing) throw ApiError.notFound('Campaign not found')
    if (existing.status !== 'SCHEDULED') throw ApiError.badRequest('Only scheduled campaigns can be cancelled')
    const timer = scheduledTimers.get(id)
    if (timer) {
      clearTimeout(timer)
      scheduledTimers.delete(id)
    }
    // Must remove the actual delayed job, not just flip the DB status back
    // to draft — otherwise the queued send still fires at its original time
    // regardless of what the campaign now shows as.
    await removeCampaignSend(id)
    const updated = await campaignsRepository.update(tenantId, id, { status: 'DRAFT', scheduledAt: null })
    return serialize(updated!)
  },
}
