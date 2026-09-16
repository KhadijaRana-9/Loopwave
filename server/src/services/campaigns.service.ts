import { randomUUID } from 'node:crypto'
import { campaignsRepository } from '@/repositories/campaigns.repository.js'
import { sendWhatsAppMessage, scheduleDemoRecipientProgression } from '@/integrations/whatsapp.adapter.js'
import { generateCampaignMessage } from '@/integrations/ai.adapter.js'
import { recordUsage } from '@/services/usage.service.js'
import { assertUsageAllowance } from '@/services/planLimits.service.js'
import { notifyTenant } from '@/services/notifications.service.js'
import { enqueueCampaignSend } from '@/jobs/campaigns.queue.js'
import { serializeTemplate } from '@/utils/serializers.js'
import { resolveMessageVariables, extractVariables, unresolvableVariables } from '@/utils/messageVariables.js'
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
    scheduledAt: campaign.scheduledAt,
    startedAt: campaign.startedAt,
    completedAt: campaign.completedAt,
    createdAt: campaign.createdAt,
    updatedAt: campaign.updatedAt,
    ...stats,
  }
}

// Actually delivers the campaign: fetches every still-pending recipient,
// sends through the WhatsApp adapter (real Cloud API if configured, an
// honestly-labeled demo simulation otherwise), and persists a real status
// per recipient — nothing here is a fabricated success count. Exported so
// both the in-process fallback below and the BullMQ worker (jobs/campaign.worker.ts)
// call the exact same delivery logic.
export async function dispatchCampaign(tenantId: string, campaignId: string) {
  const campaign = await campaignsRepository.findById(tenantId, campaignId)
  if (!campaign) return

  const pending = await campaignsRepository.pendingRecipients(campaignId)
  const contacts = await prisma.contact.findMany({ where: { id: { in: pending.map((r) => r.contactId) } }, select: { id: true, name: true, phone: true, company: true } })
  const contactById = new Map(contacts.map((c) => [c.id, c]))

  for (const recipient of pending) {
    const contact = contactById.get(recipient.contactId)
    if (!contact?.phone) {
      await campaignsRepository.updateRecipient(recipient.id, { status: 'FAILED', errorMessage: 'Contact has no phone number on file' })
      continue
    }
    const text = resolveMessageVariables(campaign.template.body, contact)
    const result = await sendWhatsAppMessage({ to: contact.phone, text })
    if (result.status === 'SENT') {
      await campaignsRepository.updateRecipient(recipient.id, { status: 'SENT', waMessageId: result.waMessageId || null, sentAt: new Date() })
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
  if (queued) return

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
    // instead of a parallel "ad hoc message" concept. Auto-approved: there's
    // no external Meta template review in demo mode, and dispatchCampaign
    // never gates on status. Templates are unique per (tenantId, name,
    // language) — a campaign name alone isn't (two "Summer Sale" campaigns is
    // normal), so this gets a disambiguating suffix rather than colliding.
    const template =
      existingTemplate ??
      (await prisma.template.create({
        data: {
          tenantId,
          name: `${input.name} (${randomUUID().slice(0, 8)})`,
          category: 'marketing',
          language: input.language || 'en_US',
          status: 'APPROVED',
          body: input.message!,
          variables: extractVariables(input.message!),
        },
      }))

    const campaign = await campaignsRepository.create(tenantId, {
      name: input.name,
      templateId: template.id,
      audienceFilter: input.audienceFilter,
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
    const updated = await campaignsRepository.update(tenantId, id, { status: 'DRAFT', scheduledAt: null })
    return serialize(updated!)
  },
}
